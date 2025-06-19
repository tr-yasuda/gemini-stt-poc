import { useCallback, useRef, useState } from "react";
import type {
  AudioFormat,
  AudioFormatConfig,
  AutoSplitConfig,
} from "../types/audio";

// 利用可能な音声フォーマット
export const AVAILABLE_AUDIO_FORMATS: AudioFormat[] = [
  // WebM フォーマット（OpusとVorbisのみサポート）
  {
    mimeType: "audio/webm;codecs=opus",
    extension: "webm",
    label: "WebM (Opus) - 推奨",
    codec: "opus",
  },
  {
    mimeType: "audio/webm;codecs=vorbis",
    extension: "webm",
    label: "WebM (Vorbis)",
    codec: "vorbis",
  },
  {
    mimeType: "audio/webm",
    extension: "webm",
    label: "WebM (デフォルト)",
  },

  // OGG フォーマット
  {
    mimeType: "audio/ogg;codecs=opus",
    extension: "ogg",
    label: "OGG (Opus)",
    codec: "opus",
  },
  {
    mimeType: "audio/ogg;codecs=vorbis",
    extension: "ogg",
    label: "OGG (Vorbis)",
    codec: "vorbis",
  },
  {
    mimeType: "audio/ogg;codecs=flac",
    extension: "ogg",
    label: "OGG (FLAC)",
    codec: "flac",
  },
  {
    mimeType: "audio/ogg",
    extension: "ogg",
    label: "OGG (デフォルト)",
  },

  // MP4 フォーマット（主にAACファミリー）
  {
    mimeType: "audio/mp4;codecs=mp4a.40.2",
    extension: "m4a",
    label: "MP4 (AAC-LC)",
    codec: "aac",
  },
  {
    mimeType: "audio/mp4;codecs=mp4a.40.5",
    extension: "m4a",
    label: "MP4 (HE-AAC)",
    codec: "aac",
  },
  {
    mimeType: "audio/mp4",
    extension: "m4a",
    label: "MP4 (デフォルト)",
  },

  // 3GPP フォーマット
  {
    mimeType: "audio/3gpp;codecs=samr",
    extension: "3gp",
    label: "3GPP (AMR-NB)",
    codec: "amr",
  },
  {
    mimeType: "audio/3gpp2;codecs=samr",
    extension: "3g2",
    label: "3GPP2 (AMR-NB)",
    codec: "amr",
  },

  // WAV フォーマット (PCM)
  {
    mimeType: "audio/wav;codecs=1",
    extension: "wav",
    label: "PCM (WAV 16-bit)",
    codec: "pcm",
  },
  {
    mimeType: "audio/wav",
    extension: "wav",
    label: "PCM (WAV)",
    codec: "pcm",
  },

  // その他のフォーマット
  {
    mimeType: "audio/mpeg",
    extension: "mp3",
    label: "MP3",
    codec: "mp3",
  },
  {
    mimeType: "audio/aac",
    extension: "aac",
    label: "AAC",
    codec: "aac",
  },
  {
    mimeType: "audio/flac",
    extension: "flac",
    label: "FLAC (ロスレス)",
    codec: "flac",
  },
  {
    mimeType: "audio/x-flac",
    extension: "flac",
    label: "FLAC (x-flac)",
    codec: "flac",
  },
  {
    mimeType: "audio/amr",
    extension: "amr",
    label: "AMR (Adaptive Multi-Rate)",
    codec: "amr",
  },
  {
    mimeType: "audio/amr-wb",
    extension: "amr",
    label: "AMR-WB (Wideband)",
    codec: "amr-wb",
  },

  // 実験的・特殊フォーマット
  {
    mimeType: "audio/x-matroska;codecs=opus",
    extension: "mka",
    label: "Matroska (Opus)",
    codec: "opus",
  },
  {
    mimeType: "audio/x-matroska;codecs=vorbis",
    extension: "mka",
    label: "Matroska (Vorbis)",
    codec: "vorbis",
  },
  {
    mimeType: "audio/x-matroska;codecs=flac",
    extension: "mka",
    label: "Matroska (FLAC)",
    codec: "flac",
  },

  // より多くの実験的フォーマット
  {
    mimeType: "audio/x-ms-wma",
    extension: "wma",
    label: "Windows Media Audio",
    codec: "wma",
  },
  {
    mimeType: "audio/x-aiff",
    extension: "aiff",
    label: "PCM (AIFF)",
    codec: "pcm",
  },
  {
    mimeType: "audio/x-au",
    extension: "au",
    label: "PCM (AU Sun Audio)",
    codec: "pcm",
  },
  {
    mimeType: "audio/basic",
    extension: "au",
    label: "Basic Audio (μ-law)",
    codec: "ulaw",
  },
  {
    mimeType: "audio/L16",
    extension: "raw",
    label: "PCM (Linear 16-bit)",
    codec: "pcm",
  },
  {
    mimeType: "audio/L24",
    extension: "raw",
    label: "PCM (Linear 24-bit)",
    codec: "pcm",
  },
  {
    mimeType: "audio/x-caf",
    extension: "caf",
    label: "Core Audio Format",
    codec: "various",
  },

  // モバイル向けフォーマット
  {
    mimeType: "audio/3gpp;codecs=samr",
    extension: "3gp",
    label: "3GPP (AMR-NB 8kHz)",
    codec: "amr-nb",
  },
  {
    mimeType: "audio/3gpp;codecs=sawb",
    extension: "3gp",
    label: "3GPP (AMR-WB 16kHz)",
    codec: "amr-wb",
  },

  // 追加のWebMバリエーション
  {
    mimeType: "audio/webm;codecs=pcm",
    extension: "webm",
    label: "PCM (WebM)",
    codec: "pcm",
  },

  // 追加のMP4バリエーション
  {
    mimeType: "audio/mp4;codecs=mp4a.40.29",
    extension: "m4a",
    label: "MP4 (HE-AACv2)",
    codec: "aac",
  },
  {
    mimeType: "audio/mp4;codecs=alac",
    extension: "m4a",
    label: "MP4 (Apple Lossless)",
    codec: "alac",
  },

  // 古いフォーマット
  {
    mimeType: "audio/x-wav",
    extension: "wav",
    label: "PCM (WAV x-wav)",
    codec: "pcm",
  },
  {
    mimeType: "audio/vnd.wave",
    extension: "wav",
    label: "PCM (WAV vnd.wave)",
    codec: "pcm",
  },
];

// ブラウザでサポートされているフォーマットをフィルタリング
export const getSupportedAudioFormats = (): AudioFormat[] => {
  const supported = AVAILABLE_AUDIO_FORMATS.filter((format) => {
    try {
      return MediaRecorder.isTypeSupported(format.mimeType);
    } catch {
      return false;
    }
  });

  console.log(
    `サポート済み音声フォーマット: ${supported.length}/${AVAILABLE_AUDIO_FORMATS.length}`,
  );
  return supported;
};

// デバッグ用：すべてのフォーマットのサポート状況を表示
export const debugAudioFormats = () => {
  console.log("=== 音声フォーマット サポート状況 ===");
  AVAILABLE_AUDIO_FORMATS.forEach((format) => {
    try {
      const isSupported = MediaRecorder.isTypeSupported(format.mimeType);
      console.log(`${isSupported ? "✅" : "❌"} ${format.label}`);
      console.log(`   MIME: ${format.mimeType}`);
      console.log(`   拡張子: .${format.extension}`);
      if (format.codec) console.log(`   コーデック: ${format.codec}`);
      console.log("");
    } catch (error) {
      console.log(`⚠️ ${format.label} - エラー:`, error);
    }
  });
};

export const useAudioRecorder = (
  autoSplitConfig?: AutoSplitConfig,
  audioFormatConfig?: AudioFormatConfig,
) => {
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
          console.log("最大時間による自動分割");
          onSplit();
        }, autoSplitConfig.maxDuration.duration * 1000);
      }

      // 定期間隔による自動分割
      if (autoSplitConfig.intervalSplit.enabled) {
        const setupIntervalSplit = () => {
          intervalSplitTimerRef.current = setTimeout(() => {
            console.log("定期間隔による自動分割");
            onSplit();
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

        // MediaRecorderのオプションを設定
        const mediaRecorderOptions: MediaRecorderOptions = {};
        if (audioFormatConfig?.format.mimeType) {
          mediaRecorderOptions.mimeType = audioFormatConfig.format.mimeType;
        }
        if (audioFormatConfig?.bitrate) {
          mediaRecorderOptions.audioBitsPerSecond = audioFormatConfig.bitrate;
        }

        mediaRecorderRef.current = new MediaRecorder(
          stream,
          mediaRecorderOptions,
        );
        audioChunksRef.current = [];
        currentSegmentStartTimeRef.current = 0;

        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorderRef.current.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: audioFormatConfig?.format.mimeType || "audio/webm",
          });

          // 実際の経過時間を計算
          const currentTime = Date.now();
          const actualDuration =
            (currentTime - recordingStartTimeRef.current) / 1000;
          const segmentStart = currentSegmentStartTimeRef.current;
          const segmentDuration = actualDuration - segmentStart;

          if (segmentDuration > 1.5 && audioBlob.size > 0) {
            onRecordingSaved(audioBlob, segmentDuration);
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
          const mediaRecorderOptions: MediaRecorderOptions = {};
          if (audioFormatConfig?.format.mimeType) {
            mediaRecorderOptions.mimeType = audioFormatConfig.format.mimeType;
          }
          if (audioFormatConfig?.bitrate) {
            mediaRecorderOptions.audioBitsPerSecond = audioFormatConfig.bitrate;
          }

          mediaRecorderRef.current = new MediaRecorder(
            streamRef.current,
            mediaRecorderOptions,
          );

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
              type: audioFormatConfig?.format.mimeType || "audio/webm",
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
