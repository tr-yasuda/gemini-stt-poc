import { useCallback, useRef, useState } from "react";
import type { RecordedItem } from "../types/audio";

export const useAudioPlayer = () => {
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlayAudio = useCallback(
    async (item: RecordedItem) => {
      if (currentPlayingId === item.id) {
        if (audioRef.current) {
          audioRef.current.pause();
          setCurrentPlayingId(null);
        }
      } else {
        if (audioRef.current) {
          audioRef.current.pause();
        }

        const url = URL.createObjectURL(item.audioBlob);
        audioRef.current = new Audio(url);
        await audioRef.current.play();
        setCurrentPlayingId(item.id);

        audioRef.current.onended = () => {
          setCurrentPlayingId(null);
          URL.revokeObjectURL(url);
        };
      }
    },
    [currentPlayingId],
  );

  const stopCurrentPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setCurrentPlayingId(null);
    }
  }, []);

  return {
    currentPlayingId,
    togglePlayAudio,
    stopCurrentPlayback,
  };
};
