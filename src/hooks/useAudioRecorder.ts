import { useCallback, useRef, useState } from "react";
import type { AutoSplitConfig } from "../types/audio";

export const useAudioRecorder = (autoSplitConfig?: AutoSplitConfig) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [currentSegmentTime, setCurrentSegmentTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const currentSegmentStartTimeRef = useRef<number>(0);
  const maxDurationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const intervalSplitTimerRef = useRef<NodeJS.Timeout | null>(null);

  const setupAutoSplitTimers = useCallback(
    (onSplit: () => void) => {
      if (!autoSplitConfig) return;

      // 最大録音時間による自動分割
      if (autoSplitConfig.maxDuration.enabled) {
        maxDurationTimerRef.current = setTimeout(() => {
          console.log("最大録音時間に達したため分割実行");
          onSplit();
        }, autoSplitConfig.maxDuration.duration * 1000);
      }

      // 定期間隔による自動分割
      if (autoSplitConfig.intervalSplit.enabled) {
        const setupIntervalSplit = () => {
          intervalSplitTimerRef.current = setTimeout(() => {
            console.log("定期間隔により分割実行");
            onSplit();
            // 次の分割タイマーをセットアップ
            setupIntervalSplit();
          }, autoSplitConfig.intervalSplit.interval * 1000);
        };
        setupIntervalSplit();
      }
    },
    [autoSplitConfig],
  );

  const clearAutoSplitTimers = useCallback(() => {
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
    if (intervalSplitTimerRef.current) {
      clearTimeout(intervalSplitTimerRef.current);
      intervalSplitTimerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(
    async (
      onRecordingSaved: (audioBlob: Blob, duration: number) => void,
      onVolumeMonitoringSetup: (stream: MediaStream) => void,
      onAutoSplit?: () => void,
    ) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        streamRef.current = stream;

        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];
        currentSegmentStartTimeRef.current = 0;

        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorderRef.current.onstop = () => {
          console.log("メイン録音停止:", {
            chunksLength: audioChunksRef.current.length,
          });
          const audioBlob = new Blob(audioChunksRef.current, {
            type: "audio/webm",
          });

          // 実際の経過時間を計算
          const currentTime = Date.now();
          const actualDuration =
            (currentTime - recordingStartTimeRef.current) / 1000;
          const segmentStart = currentSegmentStartTimeRef.current;
          const segmentDuration = actualDuration - segmentStart;

          console.log("メイン録音時間:", {
            actualDuration,
            segmentStart,
            segmentDuration,
            blobSize: audioBlob.size,
          });

          if (segmentDuration > 1.5 && audioBlob.size > 0) {
            // 1.5 秒以上の録音のみ保存
            onRecordingSaved(audioBlob, segmentDuration);
          } else {
            console.log("メイン録音をスキップ - 時間またはサイズが不足");
          }
        };

        mediaRecorderRef.current.start();
        setIsRecording(true);
        setRecordingTime(0);
        setCurrentSegmentTime(0);

        // 録音開始時刻を記録
        recordingStartTimeRef.current = Date.now();
        currentSegmentStartTimeRef.current = 0;

        // Start timer
        timerRef.current = setInterval(() => {
          setRecordingTime((prev) => prev + 1);
          setCurrentSegmentTime((prev) => prev + 1);
        }, 1000);

        // 自動分割タイマーを設定
        if (onAutoSplit) {
          setupAutoSplitTimers(onAutoSplit);
        }

        // 音量監視を開始（setIsRecordingの後で）
        setTimeout(() => {
          onVolumeMonitoringSetup(stream);
        }, 100);
      } catch (error) {
        console.error("Error starting recording:", error);
        alert(
          "マイクへのアクセスが許可されていません。ブラウザの設定を確認してください。",
        );
      }
    },
    [setupAutoSplitTimers],
  );

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }

    // ストリームを停止
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }

    // タイマーをクリア
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // 自動分割タイマーをクリア
    clearAutoSplitTimers();

    setIsRecording(false);
    setRecordingTime(0);
    setCurrentSegmentTime(0);
  }, [isRecording, clearAutoSplitTimers]);

  const splitRecording = useCallback(
    (onRecordingSaved: (audioBlob: Blob, duration: number) => void) => {
      if (!mediaRecorderRef.current || !streamRef.current) {
        console.log("MediaRecorderまたはStreamが存在しません");
        return;
      }

      // 実際の経過時間を計算
      const currentTime = Date.now();
      const actualDuration =
        (currentTime - recordingStartTimeRef.current) / 1000;
      const segmentStart = currentSegmentStartTimeRef.current;

      console.log("録音分割を実行中...", {
        actualDuration,
        segmentStart,
        recordingTime,
        segmentDuration: actualDuration - segmentStart,
      });

      // 現在の録音を停止して保存
      mediaRecorderRef.current.stop();

      // 新しい録音セグメントを開始
      setTimeout(() => {
        if (streamRef.current) {
          console.log("新しいセグメントを開始");
          audioChunksRef.current = [];

          // 新しいMediaRecorderを作成
          mediaRecorderRef.current = new MediaRecorder(streamRef.current);

          mediaRecorderRef.current.ondataavailable = (event) => {
            if (event.data.size > 0) {
              audioChunksRef.current.push(event.data);
            }
          };

          mediaRecorderRef.current.onstop = () => {
            console.log("分割セグメント停止:", {
              chunksLength: audioChunksRef.current.length,
            });
            const audioBlob = new Blob(audioChunksRef.current, {
              type: "audio/webm",
            });

            // 実際の経過時間を計算
            const currentTime = Date.now();
            const actualDuration =
              (currentTime - recordingStartTimeRef.current) / 1000;
            const segmentStart = currentSegmentStartTimeRef.current;
            const segmentDuration = actualDuration - segmentStart;

            console.log("セグメント時間:", {
              actualDuration,
              segmentStart,
              segmentDuration,
              blobSize: audioBlob.size,
            });

            if (segmentDuration > 1.5 && audioBlob.size > 0) {
              // 1.5 秒以上の録音のみ保存
              onRecordingSaved(audioBlob, segmentDuration);
            } else {
              console.log("セグメントをスキップ - 時間またはサイズが不足");
            }
          };

          mediaRecorderRef.current.start();
          currentSegmentStartTimeRef.current = actualDuration;
          
          // 現在のセグメント時間をリセット
          setCurrentSegmentTime(0);
          
          // 自動分割タイマーを再設定（間隔分割のみ）
          if (autoSplitConfig?.intervalSplit.enabled) {
            const setupIntervalSplit = () => {
              intervalSplitTimerRef.current = setTimeout(() => {
                console.log("定期間隔により分割実行");
                splitRecording(onRecordingSaved);
              }, autoSplitConfig.intervalSplit.interval * 1000);
            };
            setupIntervalSplit();
          }
        }
      }, 100);
    },
    [recordingTime, autoSplitConfig],
  );

  const manualSplit = useCallback(
    (onRecordingSaved: (audioBlob: Blob, duration: number) => void) => {
      console.log("手動分割を実行");
      splitRecording(onRecordingSaved);
    },
    [splitRecording],
  );

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  return {
    isRecording,
    recordingTime,
    currentSegmentTime,
    startRecording,
    stopRecording,
    splitRecording,
    manualSplit,
    formatTime,
  };
};
