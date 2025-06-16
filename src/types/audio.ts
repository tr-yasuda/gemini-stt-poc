export interface RecordedItem {
  id: string;
  timestamp: Date;
  audioBlob: Blob;
  duration: number;
  transcription?: string;
  isTranscribing?: boolean;
}

export interface SilenceDetectionConfig {
  enabled: boolean;
  threshold: number;
  duration: number;
}

export interface VolumeMonitoringData {
  currentVolume: number;
  isAboveThreshold: boolean;
}