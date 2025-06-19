import { useCallback, useRef, useState } from "react";
import type {
  SilenceDetectionConfig,
  VolumeMonitoringData,
} from "../types/audio";

export const useVolumeMonitoring = (config: SilenceDetectionConfig) => {
  const [currentVolume, setCurrentVolume] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const volumeCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const setupVolumeMonitoring = useCallback(
    async (stream: MediaStream, onSilenceDetected: () => void) => {
      if (!config.enabled) return;

      try {
        // AudioContextをクリーンアップしてから新しく作成
        if (audioContextRef.current) {
          await audioContextRef.current.close();
        }

        audioContextRef.current = new AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();

        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);

        analyserRef.current.fftSize = 256;
        analyserRef.current.smoothingTimeConstant = 0.8;
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        // 音量チェックのループ
        const checkVolume = () => {
          if (!analyserRef.current) return;

          analyserRef.current.getByteFrequencyData(dataArray);

          // 平均音量を計算
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength / 255; // 0-1の範囲に正規化
          setCurrentVolume(average);

          // 無音検出
          if (average < config.threshold) {
            if (!silenceTimerRef.current) {
              silenceTimerRef.current = setTimeout(() => {
                console.log("無音検出による自動分割");
                onSilenceDetected();
              }, config.duration * 1000);
            }
          } else {
            // 音声が検出されたらタイマーをリセット
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }
          }
        };

        volumeCheckIntervalRef.current = setInterval(checkVolume, 100);
      } catch (error) {
        console.error("音量監視のセットアップに失敗:", error);
      }
    },
    [config.enabled, config.threshold, config.duration],
  );

  const stopVolumeMonitoring = useCallback(async () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (volumeCheckIntervalRef.current) {
      clearInterval(volumeCheckIntervalRef.current);
      volumeCheckIntervalRef.current = null;
    }

    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setCurrentVolume(0);
  }, []);

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const volumeData: VolumeMonitoringData = {
    currentVolume,
    isAboveThreshold: currentVolume > config.threshold,
  };

  return {
    volumeData,
    setupVolumeMonitoring,
    stopVolumeMonitoring,
    resetSilenceTimer,
  };
};
