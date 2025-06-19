import { useCallback, useRef, useState } from "react";

export const useRawPCMRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const pcmDataRef = useRef<Float32Array[]>([]);

  const startRawPCMRecording = useCallback(
    async (
      _onRecordingSaved: (audioBlob: Blob, duration: number) => void,
      sampleRate = 44100,
      channels = 1,
    ) => {
      try {
        // マイクアクセスを取得
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: sampleRate,
            channelCount: channels,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
        mediaStreamRef.current = stream;

        // AudioContextを作成
        audioContextRef.current = new (
          window.AudioContext ??
          (window as Window & { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext
        )({
          sampleRate: sampleRate,
        });

        const audioContext = audioContextRef.current;

        // AudioWorkletを追加
        await audioContext.audioWorklet.addModule(
          "/audio-worklet-processor.js",
        );

        const source = audioContext.createMediaStreamSource(stream);
        sourceRef.current = source;

        // AudioWorkletNodeを作成
        const workletNode = new AudioWorkletNode(
          audioContext,
          "raw-pcm-processor",
        );
        workletNodeRef.current = workletNode;

        pcmDataRef.current = [];

        // AudioWorkletからのメッセージを処理
        workletNode.port.onmessage = (event) => {
          if (event.data.type === "pcmData") {
            pcmDataRef.current.push(event.data.data);
          }
        };

        // 音声処理チェーンを接続
        source.connect(workletNode);
        workletNode.connect(audioContext.destination);

        setIsRecording(true);
        setRecordingTime(0);
        recordingStartTimeRef.current = Date.now();

        // タイマー開始
        timerRef.current = setInterval(() => {
          setRecordingTime((prev) => prev + 1);
        }, 1000);

        console.log("Raw PCM録音開始:", {
          sampleRate: audioContext.sampleRate,
          channels: channels,
        });
      } catch (error) {
        console.error("Raw PCM録音開始エラー:", error);
        alert("マイクへのアクセスが許可されていません。");
      }
    },
    [],
  );

  const stopRawPCMRecording = useCallback(
    (onRecordingSaved: (audioBlob: Blob, duration: number) => void) => {
      if (!audioContextRef.current || !isRecording) return;

      // 録音停止
      if (workletNodeRef.current) {
        workletNodeRef.current.disconnect();
        workletNodeRef.current = null;
      }

      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }

      if (mediaStreamRef.current) {
        for (const track of mediaStreamRef.current.getTracks()) {
          track.stop();
        }
        mediaStreamRef.current = null;
      }

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // PCMデータをWAVファイルに変換
      const audioContext = audioContextRef.current;
      const sampleRate = audioContext.sampleRate;
      const duration = (Date.now() - recordingStartTimeRef.current) / 1000;

      if (pcmDataRef.current.length > 0) {
        const wavBlob = createWAVBlob(pcmDataRef.current, sampleRate);
        onRecordingSaved(wavBlob, duration);
        console.log("Raw PCM録音完了:", {
          duration: duration,
          chunks: pcmDataRef.current.length,
          sampleRate: sampleRate,
          blobSize: wavBlob.size,
        });
      }

      // AudioContextを閉じる
      audioContextRef.current.close();
      audioContextRef.current = null;
      pcmDataRef.current = [];

      setIsRecording(false);
      setRecordingTime(0);
    },
    [isRecording],
  );

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  return {
    isRecording,
    recordingTime,
    startRawPCMRecording,
    stopRawPCMRecording,
    formatTime,
  };
};

// Float32ArrayをInt16に変換する関数（提供コードを参考に最適化）
function convertFloat32ToInt16(input: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  let offset = 0;

  for (let i = 0; i < input.length; i++, offset += 2) {
    // Float32 (-1.0 to 1.0) を Int16 (-32768 to 32767) に変換
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return buffer;
}

// PCMデータをWAVファイルに変換する関数（改善版）
function createWAVBlob(pcmChunks: Float32Array[], sampleRate: number): Blob {
  // 各チャンクを変換してバイナリデータを結合
  const pcmBuffers: ArrayBuffer[] = [];
  let totalPCMBytes = 0;

  for (const chunk of pcmChunks) {
    const buffer = convertFloat32ToInt16(chunk);
    pcmBuffers.push(buffer);
    totalPCMBytes += buffer.byteLength;
  }

  // WAVヘッダーを作成
  const headerBuffer = new ArrayBuffer(44);
  const headerView = new DataView(headerBuffer);

  // WAVヘッダー（最適化版）
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      headerView.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  headerView.setUint32(4, 36 + totalPCMBytes, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  headerView.setUint32(16, 16, true);
  headerView.setUint16(20, 1, true); // PCM format
  headerView.setUint16(22, 1, true); // mono
  headerView.setUint32(24, sampleRate, true);
  headerView.setUint32(28, sampleRate * 2, true); // byte rate
  headerView.setUint16(32, 2, true); // block align
  headerView.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  headerView.setUint32(40, totalPCMBytes, true);

  // ヘッダーとPCMデータを結合してBlobを作成
  const blobParts = [headerBuffer, ...pcmBuffers];
  return new Blob(blobParts, { type: "audio/wav" });
}
