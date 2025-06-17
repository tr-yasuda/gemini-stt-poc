export type RecordedItem = {
  id: string;
  timestamp: Date;
  audioBlob: Blob;
  duration: number;
  transcription?: string;
  isTranscribing?: boolean;
}

export type SilenceDetectionConfig = {
  enabled: boolean;
  threshold: number;
  duration: number;
}

export type AutoSplitConfig = {
  maxDuration: {
    enabled: boolean;
    duration: number; // 最大録音時間（秒）
  };
  intervalSplit: {
    enabled: boolean;
    interval: number; // 自動分割間隔（秒）
  };
}

export type VolumeMonitoringData = {
  currentVolume: number;
  isAboveThreshold: boolean;
}
