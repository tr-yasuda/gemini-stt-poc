import { GoogleGenAI } from "@google/genai";
import { useCallback } from "react";
import type { RecordedItem } from "../types/audio";

export const useTranscription = (selectedModel = "gemini-2.0-flash-lite") => {
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
        // BlobをBase64に変換（大きなファイルに対応）
        const base64String = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") {
              // "data:audio/webm;base64," を除去してBase64部分のみを取得
              const base64 = reader.result.split(",")[1];
              resolve(base64);
            } else {
              reject(new Error("FileReader result is not a string"));
            }
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(item.audioBlob);
        });

        // Gemini APIで書き起こし
        const response = await ai.models.generateContent({
          model: selectedModel,
          contents: [
            {
              text: "Please transcribe the audio exactly as spoken, using the same language as the audio (e.g., Japanese, English, or Korean). Return only the transcription text, without any explanations or commentary. If no speech is detected or the audio is silent, return nothing.",
            },
            {
              inlineData: {
                mimeType: "audio/webm",
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
    [ai, selectedModel],
  );

  return { transcribeAudio };
};
