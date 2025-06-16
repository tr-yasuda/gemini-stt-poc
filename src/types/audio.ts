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

export type VolumeMonitoringData = {
  currentVolume: number;
  isAboveThreshold: boolean;
}
