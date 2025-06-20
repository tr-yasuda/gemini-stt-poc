import { useCallback, useState } from "react";
import type { RecordedItem } from "../types/audio";

export const useRecordingsList = () => {
  const [recordedItems, setRecordedItems] = useState<RecordedItem[]>([]);

  const addRecording = useCallback((audioBlob: Blob, duration: number) => {
    const newItem: RecordedItem = {
      id: Date.now().toString(),
      timestamp: new Date(),
      audioBlob,
      duration,
    };

    setRecordedItems((prev) => [newItem, ...prev]);

    return newItem;
  }, []);

  const deleteRecording = useCallback((id: string) => {
    setRecordedItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateTranscription = useCallback(
    (id: string, transcription: string, isTranscribing = false) => {
      setRecordedItems((prev) =>
        prev.map((record) =>
          record.id === id
            ? { ...record, transcription, isTranscribing }
            : record,
        ),
      );
    },
    [],
  );

  const setTranscribingStatus = useCallback(
    (id: string, isTranscribing: boolean) => {
      setRecordedItems((prev) =>
        prev.map((record) =>
          record.id === id ? { ...record, isTranscribing } : record,
        ),
      );
    },
    [],
  );

  const downloadAudio = useCallback(
    (item: RecordedItem, extension = "webm") => {
      const url = URL.createObjectURL(item.audioBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `音声録音_${item.timestamp.toLocaleDateString("ja-JP").replace(/\//g, "-")}_${item.id}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [],
  );

  return {
    recordedItems,
    addRecording,
    deleteRecording,
    updateTranscription,
    setTranscribingStatus,
    downloadAudio,
  };
};
