import { GoogleGenAI } from "@google/genai";
import { useCallback } from "react";
import type { RecordedItem } from "../types/audio";

export const useTranscription = () => {
  const ai = new GoogleGenAI({
    apiKey: import.meta.env.VITE_GOOGLE_API_KEY ?? "",
  });

  const transcribeAudio = useCallback(
    async (
      item: RecordedItem,
      onStart: (id: string) => void,
      onComplete: (id: string, transcription: string) => void,
      onError: (id: string, error: string) => void,
    ) => {
      if (!import.meta.env.VITE_GOOGLE_API_KEY) {
        alert(
          "Google API キーが設定されていません。環境変数 VITE_GOOGLE_API_KEY を設定してください。",
        );
        return;
      }

      // 書き起こし開始
      onStart(item.id);

      try {
        // BlobをBase64に変換
        const arrayBuffer = await item.audioBlob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const base64String = btoa(String.fromCharCode(...uint8Array));

        // Gemini APIで書き起こし
        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: [
            {
              text: "Please transcribe the audio in Japanese. Provide only the transcription text without any additional formatting or explanations.",
            },
            {
              inlineData: {
                mimeType: "audio/wav",
                data: base64String,
              },
            },
          ],
        });

        const transcription =
          response.text?.trim() ?? "書き起こしに失敗しました";
        onComplete(item.id, transcription);
        console.log(`書き起こし完了 (ID: ${item.id}):`, transcription);
      } catch (error) {
        console.error("書き起こしエラー:", error);
        onError(item.id, "書き起こし中にエラーが発生しました");
        alert(
          "書き起こし中にエラーが発生しました。APIキーとネットワーク接続を確認してください。",
        );
      }
    },
    [ai],
  );

  return { transcribeAudio };
};
