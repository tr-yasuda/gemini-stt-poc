import { Download, Mic, MicOff, Pause, Play, Trash2, FileText } from "lucide-react";
import { useRef, useState } from "react";
import { GoogleGenAI } from "@google/genai";

interface RecordedItem {
  id: string;
  timestamp: Date;
  audioBlob: Blob;
  duration: number;
  transcription?: string;
  isTranscribing?: boolean;
}

const AudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedItems, setRecordedItems] = useState<RecordedItem[]>([]);
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [silenceDetectionEnabled, setSilenceDetectionEnabled] = useState(true);
  const [currentVolume, setCurrentVolume] = useState(0);
  const [silenceThreshold, setSilenceThreshold] = useState(0.02); // 音量閾値
  const [silenceDuration, setSilenceDuration] = useState(3); // 無音継続時間（秒）

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const volumeCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentSegmentStartTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingStartTimeRef = useRef<number>(0);

  // Gemini APIの初期化
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GOOGLE_API_KEY ?? "" });

  // 音量監視機能
  const setupVolumeMonitoring = (stream: MediaStream) => {
    if (!silenceDetectionEnabled) return;

    try {
      // AudioContextをクリーンアップしてから新しく作成
      if (audioContextRef.current) {
        audioContextRef.current.close();
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
        if (average < silenceThreshold) {
          if (!silenceTimerRef.current) {
            console.log(`無音検出開始 - タイマー開始 (${silenceDuration}秒)`);
            silenceTimerRef.current = setTimeout(() => {
              console.log('無音継続時間経過 - 分割実行');
              splitRecording();
            }, silenceDuration * 1000);
          }
        } else {
          // 音声が検出されたらタイマーをリセット
          if (silenceTimerRef.current) {
            console.log('音声検出 - タイマーリセット');
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        }
      };

      volumeCheckIntervalRef.current = setInterval(checkVolume, 100);
    } catch (error) {
      console.error("音量監視のセットアップに失敗:", error);
    }
  };

  // 録音分割機能
  const splitRecording = () => {
    if (!mediaRecorderRef.current || !streamRef.current) {
      console.log('MediaRecorderまたはStreamが存在しません');
      return;
    }
    
    // 実際の経過時間を計算
    const currentTime = Date.now();
    const actualDuration = (currentTime - recordingStartTimeRef.current) / 1000;
    const segmentStart = currentSegmentStartTimeRef.current;
    
    console.log('録音分割を実行中...', { 
      actualDuration, 
      segmentStart, 
      recordingTime,
      segmentDuration: actualDuration - segmentStart
    });
    
    // 現在の録音を停止して保存
    mediaRecorderRef.current.stop();
    
    // 新しい録音セグメントを開始
    setTimeout(() => {
      if (streamRef.current) {
        console.log('新しいセグメントを開始');
        audioChunksRef.current = [];
        
        // 新しいMediaRecorderを作成
        mediaRecorderRef.current = new MediaRecorder(streamRef.current);
        
        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorderRef.current.onstop = () => {
          console.log('分割セグメント停止:', { chunksLength: audioChunksRef.current.length });
          const audioBlob = new Blob(audioChunksRef.current, {
            type: "audio/wav",
          });
          
          // 実際の経過時間を計算
          const currentTime = Date.now();
          const actualDuration = (currentTime - recordingStartTimeRef.current) / 1000;
          const segmentStart = currentSegmentStartTimeRef.current;
          const segmentDuration = actualDuration - segmentStart;
          
          console.log('セグメント時間:', { 
            actualDuration, 
            segmentStart, 
            segmentDuration,
            blobSize: audioBlob.size 
          });
          
          if (segmentDuration > 0.5 && audioBlob.size > 0) { // 0.5秒以上の録音のみ保存
            saveRecording(audioBlob, segmentDuration);
          } else {
            console.log('セグメントをスキップ - 時間またはサイズが不足');
          }
        };
        
        mediaRecorderRef.current.start();
        currentSegmentStartTimeRef.current = actualDuration;
        
        // 無音検出タイマーをリセット
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      }
    }, 100);
  };

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      currentSegmentStartTimeRef.current = 0;

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        console.log('メイン録音停止:', { chunksLength: audioChunksRef.current.length });
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/wav",
        });
        
        // 実際の経過時間を計算
        const currentTime = Date.now();
        const actualDuration = (currentTime - recordingStartTimeRef.current) / 1000;
        const segmentStart = currentSegmentStartTimeRef.current;
        const segmentDuration = actualDuration - segmentStart;
        
        console.log('メイン録音時間:', { 
          actualDuration, 
          segmentStart, 
          segmentDuration,
          blobSize: audioBlob.size 
        });
        
        if (segmentDuration > 0.5 && audioBlob.size > 0) { // 0.5秒以上の録音のみ保存
          saveRecording(audioBlob, segmentDuration);
        } else {
          console.log('メイン録音をスキップ - 時間またはサイズが不足');
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // 録音開始時刻を記録
      recordingStartTimeRef.current = Date.now();
      currentSegmentStartTimeRef.current = 0;

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      // 音量監視を開始（setIsRecordingの後で）
      setTimeout(() => {
        setupVolumeMonitoring(stream);
      }, 100);

    } catch (error) {
      console.error("Error starting recording:", error);
      alert(
        "マイクへのアクセスが許可されていません。ブラウザの設定を確認してください。",
      );
    }
  };

  // Stop recording
  const stopRecording = () => {
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

    // 各種タイマーとインターバルをクリア
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (volumeCheckIntervalRef.current) {
      clearInterval(volumeCheckIntervalRef.current);
      volumeCheckIntervalRef.current = null;
    }

    // AudioContextをクリーンアップ
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsRecording(false);
    setCurrentVolume(0);
  };

  // Save recording
  const saveRecording = (audioBlob: Blob, duration?: number) => {
    console.log('saveRecording called:', { blobSize: audioBlob.size, duration });
    
    const finalRecordingTime = duration || recordingTime;
    const newItem: RecordedItem = {
      id: Date.now().toString(),
      timestamp: new Date(),
      audioBlob,
      duration: finalRecordingTime,
    };

    console.log('新しい録音アイテムを追加:', newItem);
    setRecordedItems((prev) => {
      const updatedItems = [newItem, ...prev];
      console.log('録音履歴更新:', updatedItems);
      
      // 新しいセグメントが保存されたら自動的に書き起こしを開始
      setTimeout(() => {
        console.log('自動書き起こしを開始:', newItem.id);
        transcribeAudio(newItem);
      }, 500); // 少し遅延を入れてUIの更新を確実にする
      
      return updatedItems;
    });
    
    if (!duration) { // 完全停止の場合のみ録音時間をリセット
      setRecordingTime(0);
    }
  };

  // Download audio file
  const downloadAudio = (item: RecordedItem) => {
    const url = URL.createObjectURL(item.audioBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `音声録音_${item.timestamp.toLocaleDateString("ja-JP").replace(/\//g, "-")}_${item.id}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Play/pause audio
  const togglePlayAudio = (item: RecordedItem) => {
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
      audioRef.current.play();
      setCurrentPlayingId(item.id);

      audioRef.current.onended = () => {
        setCurrentPlayingId(null);
        URL.revokeObjectURL(url);
      };
    }
  };

  // Delete recording
  const deleteRecording = (id: string) => {
    setRecordedItems((prev) => prev.filter((item) => item.id !== id));
    if (currentPlayingId === id) {
      setCurrentPlayingId(null);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // 音声を書き起こしする機能
  const transcribeAudio = async (item: RecordedItem) => {
    if (!import.meta.env.VITE_GOOGLE_API_KEY) {
      alert("Google API キーが設定されていません。環境変数 VITE_GOOGLE_API_KEY を設定してください。");
      return;
    }

    // 書き起こし中の状態に更新
    setRecordedItems((prev) =>
      prev.map((record) =>
        record.id === item.id ? { ...record, isTranscribing: true } : record
      )
    );

    try {
      // BlobをBase64に変換
      const arrayBuffer = await item.audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const base64String = btoa(String.fromCharCode(...uint8Array));

      // Gemini APIで書き起こし
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          { text: "Please transcribe the audio in Japanese. Provide only the transcription text without any additional formatting or explanations." },
          {
            inlineData: {
              mimeType: "audio/wav",
              data: base64String,
            },
          },
        ],
      });

      const transcription = response.text?.trim() || "書き起こしに失敗しました";

      // 書き起こし結果を保存
      setRecordedItems((prev) =>
        prev.map((record) =>
          record.id === item.id
            ? { ...record, transcription, isTranscribing: false }
            : record
        )
      );

      console.log(`書き起こし完了 (ID: ${item.id}):`, transcription);
    } catch (error) {
      console.error("書き起こしエラー:", error);
      
      // エラー状態を更新
      setRecordedItems((prev) =>
        prev.map((record) =>
          record.id === item.id
            ? { ...record, transcription: "書き起こし中にエラーが発生しました", isTranscribing: false }
            : record
        )
      );

      alert("書き起こし中にエラーが発生しました。APIキーとネットワーク接続を確認してください。");
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-2xl font-bold mb-6 text-center">
          音声録音システム（無音検出・自動書き起こし機能付き）
        </h2>

        {/* Silence Detection Settings */}
        <div className="mb-6 p-4 bg-muted/50 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">無音検出設定</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="silenceDetection"
                checked={silenceDetectionEnabled}
                onChange={(e) => setSilenceDetectionEnabled(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="silenceDetection">自動分割を有効化</label>
            </div>
            
            <div className="flex flex-col space-y-1">
              <label className="text-sm text-muted-foreground">
                音量閾値: {(silenceThreshold * 100).toFixed(1)}%
              </label>
              <input
                type="range"
                min="0.001"
                max="0.1"
                step="0.001"
                value={silenceThreshold}
                onChange={(e) => setSilenceThreshold(parseFloat(e.target.value))}
                className="w-full"
                disabled={isRecording}
              />
            </div>
            
            <div className="flex flex-col space-y-1">
              <label className="text-sm text-muted-foreground">
                無音継続時間: {silenceDuration}秒
              </label>
              <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={silenceDuration}
                onChange={(e) => setSilenceDuration(parseFloat(e.target.value))}
                className="w-full"
                disabled={isRecording}
              />
            </div>
          </div>
        </div>

        {/* Recording Controls */}
        <div className="flex flex-col items-center space-y-4">
          <div className="flex items-center space-x-4">
            <button
              type={"button"}
              onClick={isRecording ? stopRecording : startRecording}
              className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                isRecording
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
              <span>{isRecording ? "録音停止" : "録音開始"}</span>
            </button>
          </div>

          {/* Recording Status */}
          {isRecording && (
            <div className="text-center w-full max-w-md">
              <div className="text-lg font-mono mb-2">
                録音時間: {formatTime(recordingTime)}
              </div>
              
              {/* Volume Level Indicator */}
              {silenceDetectionEnabled && (
                <div className="mb-2">
                  <div className="text-sm text-muted-foreground mb-1">
                    音量レベル: {(currentVolume * 100).toFixed(1)}%
                  </div>
                  <div className="w-full bg-muted rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-150 ${
                        currentVolume > silenceThreshold
                          ? 'bg-green-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(currentVolume * 100, 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {currentVolume > silenceThreshold ? '音声検出中' : '無音状態'}
                  </div>
                </div>
              )}
              
              <div className="flex items-center justify-center space-x-2">
                <div className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
                <span className="text-sm text-muted-foreground">
                  録音中...{silenceDetectionEnabled ? '（自動分割有効）' : ''}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recorded Items */}
      <div className="bg-card rounded-lg border p-6">
        <div className="mb-4">
          <div className="text-sm text-muted-foreground">
            デバッグ: recordedItems.length = {recordedItems.length}
          </div>
        </div>
        {recordedItems.length > 0 ? (
          <div>
            <h3 className="text-xl font-semibold mb-4">
              録音履歴 ({recordedItems.length}件)
              {silenceDetectionEnabled && (
                <span className="text-sm text-muted-foreground ml-2">
                  ※無音検出により自動分割・自動書き起こし
                </span>
              )}
            </h3>
            <div className="space-y-4">
            {recordedItems.map((item, index) => (
              <div key={item.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <div className="text-sm font-medium">
                        セグメント #{recordedItems.length - index}
                      </div>
                      {silenceDetectionEnabled && index === 0 && (
                        <div className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                          最新
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {item.timestamp.toLocaleString("ja-JP")}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      録音時間: {formatTime(item.duration)}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      type={"button"}
                      onClick={() => togglePlayAudio(item)}
                      className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                      title="音声再生"
                    >
                      {currentPlayingId === item.id ? (
                        <Pause size={18} />
                      ) : (
                        <Play size={18} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => transcribeAudio(item)}
                      disabled={item.isTranscribing}
                      className="p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      title="音声書き起こし"
                    >
                      <FileText size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadAudio(item)}
                      className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                      title="音声ダウンロード"
                    >
                      <Download size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteRecording(item.id)}
                      className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                      title="削除"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                
                {/* 書き起こし結果表示エリア */}
                <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                  <div className="text-sm font-medium mb-2">書き起こし結果:</div>
                  {item.isTranscribing ? (
                    <div className="text-sm text-muted-foreground flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span>書き起こし中...</span>
                    </div>
                  ) : item.transcription ? (
                    <div className="text-sm whitespace-pre-wrap bg-background p-3 rounded border">
                      {item.transcription}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                      <span>書き起こし開始中...</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            録音履歴がありません。録音を開始してください。
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioRecorder;
