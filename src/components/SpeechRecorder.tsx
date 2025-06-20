import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import {
  debugAudioFormats,
  getSupportedAudioFormats,
  useAudioRecorder,
} from "@/hooks/useAudioRecorder";
import { useRawPCMRecorder } from "@/hooks/useRawPCMRecorder";
import { useRecordingsList } from "@/hooks/useRecordingsList";
import { useTranscription } from "@/hooks/useTranscription";
import { useVolumeMonitoring } from "@/hooks/useVolumeMonitoring";
import {
  Download,
  FileText,
  Loader2,
  Mic,
  MicOff,
  Pause,
  Play,
  Scissors,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import type {
  AudioFormat,
  AudioFormatConfig,
  AutoSplitConfig,
  RecordedItem,
  SilenceDetectionConfig,
} from "../types/audio";

// 利用可能なGeminiモデル
const AVAILABLE_MODELS = [
  { value: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { value: "gemini-2.5-flash-preview-05-20", label: "Gemini 2.5 Flash" },
  { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
  { value: "gemini-1.5-flash-8b", label: "Gemini 1.5 Flash 8B" },
] as const;

const AudioRecorder = () => {
  const [silenceDetectionEnabled, setSilenceDetectionEnabled] = useState(true);
  const [silenceThreshold, setSilenceThreshold] = useState(0.05); // 音量閾値
  const [silenceDuration, setSilenceDuration] = useState(1); // 無音継続時間（秒）

  // 新しい自動分割設定
  const [maxDurationEnabled, setMaxDurationEnabled] = useState(false);
  const [maxDuration, setMaxDuration] = useState(300); // 最大録音時間（秒）
  const [intervalSplitEnabled, setIntervalSplitEnabled] = useState(false);
  const [intervalDuration, setIntervalDuration] = useState(60); // 定期分割間隔（秒）

  // モデル選択
  const [selectedModel, setSelectedModel] = useState<string>(
    "gemini-2.0-flash-lite",
  );

  // 音声フォーマット選択
  const supportedFormats = getSupportedAudioFormats();
  const [selectedFormat, setSelectedFormat] = useState<AudioFormat>(
    supportedFormats.find((f) => f.mimeType === "audio/webm;codecs=opus") ||
      supportedFormats.find((f) => f.mimeType === "audio/webm") ||
      supportedFormats[0],
  );
  const [audioBitrate, setAudioBitrate] = useState<number>(128000); // 128kbps

  // PCMモード設定
  const [useRawPCM, setUseRawPCM] = useState<boolean>(false);
  const [pcmSampleRate, setPcmSampleRate] = useState<number>(44100);

  const silenceConfig: SilenceDetectionConfig = {
    enabled: silenceDetectionEnabled,
    threshold: silenceThreshold,
    duration: silenceDuration,
  };

  const autoSplitConfig: AutoSplitConfig = {
    maxDuration: {
      enabled: maxDurationEnabled,
      duration: maxDuration,
    },
    intervalSplit: {
      enabled: intervalSplitEnabled,
      interval: intervalDuration,
    },
  };

  const audioFormatConfig: AudioFormatConfig = {
    format: selectedFormat,
    bitrate: audioBitrate,
  };

  // Custom hooks
  const {
    isRecording,
    recordingTime,
    currentSegmentTime,
    startRecording,
    stopRecording,
    splitRecording,
    manualSplit,
    formatTime,
  } = useAudioRecorder(autoSplitConfig, audioFormatConfig);

  const {
    isRecording: isPCMRecording,
    recordingTime: pcmRecordingTime,
    startRawPCMRecording,
    stopRawPCMRecording,
    formatTime: formatPCMTime,
  } = useRawPCMRecorder();

  const {
    volumeData,
    setupVolumeMonitoring,
    stopVolumeMonitoring,
    resetSilenceTimer,
  } = useVolumeMonitoring(silenceConfig);

  const {
    recordedItems,
    addRecording,
    deleteRecording,
    updateTranscription,
    setTranscribingStatus,
    downloadAudio,
  } = useRecordingsList();

  const { currentPlayingId, togglePlayAudio, stopCurrentPlayback } =
    useAudioPlayer();

  const { transcribeAudio } = useTranscription(selectedModel);

  // Recording handlers
  const handleStartRecording = async () => {
    if (useRawPCM) {
      // Raw PCMモード
      await startRawPCMRecording(
        (audioBlob, duration) => {
          const newItem = addRecording(audioBlob, duration);
          setTimeout(() => {
            console.log("Raw PCM自動書き起こしを開始:", newItem.id);
            handleTranscribeAudio(newItem);
          }, 500);
        },
        pcmSampleRate,
        1, // モノラル
      );
    } else {
      // MediaRecorderモード
      await startRecording(
        (audioBlob, duration) => {
          const newItem = addRecording(audioBlob, duration);
          setTimeout(() => {
            console.log("自動書き起こしを開始:", newItem.id);
            handleTranscribeAudio(newItem);
          }, 500);
        },
        (stream: MediaStream) =>
          setupVolumeMonitoring(stream, handleSplitRecording),
        handleSplitRecording,
      );
    }
  };

  const handleStopRecording = async () => {
    if (useRawPCM) {
      stopRawPCMRecording((audioBlob, duration) => {
        const newItem = addRecording(audioBlob, duration);
        setTimeout(() => {
          console.log("Raw PCM最終書き起こしを開始:", newItem.id);
          handleTranscribeAudio(newItem);
        }, 500);
      });
    } else {
      stopRecording();
      await stopVolumeMonitoring();
    }
  };

  const handleSplitRecording = () => {
    splitRecording((audioBlob, duration) => {
      const newItem = addRecording(audioBlob, duration);
      // 分割された新しいセグメントも自動書き起こし
      setTimeout(async () => {
        console.log("分割セグメント自動書き起こしを開始:", newItem.id);
        await handleTranscribeAudio(newItem);
      }, 500);
    });
    resetSilenceTimer();
  };

  const handleManualSplit = () => {
    manualSplit((audioBlob, duration) => {
      const newItem = addRecording(audioBlob, duration);
      // 手動分割された新しいセグメントも自動書き起こし
      setTimeout(async () => {
        console.log("手動分割セグメント自動書き起こしを開始:", newItem.id);
        await handleTranscribeAudio(newItem);
      }, 500);
    });
    resetSilenceTimer();
  };

  const handleDeleteRecording = (id: string) => {
    deleteRecording(id);
    if (currentPlayingId === id) {
      stopCurrentPlayback();
    }
  };

  const handleTranscribeAudio = async (item: RecordedItem) => {
    await transcribeAudio(
      item,
      (id) => setTranscribingStatus(id, true),
      (id, transcription) => updateTranscription(id, transcription, false),
      (id, error) => updateTranscription(id, error, false),
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            音声録音システム（無音検出・自動書き起こし機能付き）
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Silence Detection Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">無音検出設定</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="silenceDetection"
                    checked={silenceDetectionEnabled}
                    onCheckedChange={setSilenceDetectionEnabled}
                  />
                  <Label htmlFor="silenceDetection" className="text-sm">
                    無音検出分割を有効化
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">
                    音量閾値: {(silenceThreshold * 100).toFixed(1)}%
                  </Label>
                  <Slider
                    value={[silenceThreshold]}
                    onValueChange={(value) => setSilenceThreshold(value[0])}
                    min={0.001}
                    max={0.1}
                    step={0.001}
                    disabled={isRecording}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">
                    無音継続時間: {silenceDuration}秒
                  </Label>
                  <Slider
                    value={[silenceDuration]}
                    onValueChange={(value) => setSilenceDuration(value[0])}
                    min={0.1}
                    max={10}
                    step={0.1}
                    disabled={isRecording}
                    className="w-full"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Auto Split Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">時間分割設定</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="maxDurationSplit"
                      checked={maxDurationEnabled}
                      onCheckedChange={setMaxDurationEnabled}
                    />
                    <Label htmlFor="maxDurationSplit" className="text-sm">
                      最大録音時間で分割
                    </Label>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">
                      最大録音時間: {Math.floor(maxDuration / 60)}分
                      {maxDuration % 60}秒
                    </Label>
                    <Slider
                      value={[maxDuration]}
                      onValueChange={(value) => setMaxDuration(value[0])}
                      min={60}
                      max={1800} // 30分
                      step={30}
                      disabled={isRecording || !maxDurationEnabled}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="intervalSplit"
                      checked={intervalSplitEnabled}
                      onCheckedChange={setIntervalSplitEnabled}
                    />
                    <Label htmlFor="intervalSplit" className="text-sm">
                      定期間隔で分割
                    </Label>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">
                      分割間隔: {Math.floor(intervalDuration / 60)}分
                      {intervalDuration % 60}秒
                    </Label>
                    <Slider
                      value={[intervalDuration]}
                      onValueChange={(value) => setIntervalDuration(value[0])}
                      min={10}
                      max={600} // 10分
                      step={10}
                      disabled={isRecording || !intervalSplitEnabled}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Model Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">書き起こしモデル設定</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label className="text-sm">モデル選択</Label>
                <Select
                  value={selectedModel}
                  onValueChange={setSelectedModel}
                  disabled={isRecording}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="モデルを選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_MODELS.map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  録音中はモデルを変更できません。モデルにより処理速度や精度が異なります。
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Audio Format Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">音声フォーマット設定</CardTitle>
            </CardHeader>
            <CardContent>
              {/* PCMモード切り替え */}
              <div className="mb-6 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950">
                <div className="flex items-center space-x-2 mb-3">
                  <Switch
                    id="rawPCMMode"
                    checked={useRawPCM}
                    onCheckedChange={setUseRawPCM}
                    disabled={isRecording || isPCMRecording}
                  />
                  <Label htmlFor="rawPCMMode" className="text-sm font-medium">
                    Raw PCMモード（高精度書き起こし用）
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  {useRawPCM
                    ? "マイクから直接PCM生データを取得します。圧縮による音質劣化がないため、書き起こし精度が向上する可能性があります。"
                    : "MediaRecorder APIを使用して録音します。様々なフォーマットを選択できます。"}
                </p>
              </div>

              {useRawPCM ? (
                // Raw PCMモードの設定
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm">
                      サンプルレート: {(pcmSampleRate / 1000).toFixed(1)}kHz
                    </Label>
                    <Slider
                      value={[pcmSampleRate]}
                      onValueChange={(value) => setPcmSampleRate(value[0])}
                      min={8000}
                      max={48000}
                      step={8000}
                      disabled={isRecording || isPCMRecording}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      高いサンプルレートほど音質が良くなりますが、ファイルサイズも大きくなります。
                    </p>
                  </div>

                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm">
                      <strong>PCM設定:</strong>{" "}
                      {(pcmSampleRate / 1000).toFixed(1)}kHz, 16-bit, モノラル
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      出力ファイル: WAV形式 (.wav)
                    </p>
                  </div>
                </div>
              ) : (
                // MediaRecorderモードの設定
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm">音声フォーマット</Label>
                    <Select
                      value={selectedFormat.mimeType}
                      onValueChange={(value) => {
                        const format = supportedFormats.find(
                          (f) => f.mimeType === value,
                        );
                        if (format) setSelectedFormat(format);
                      }}
                      disabled={isRecording || isPCMRecording}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="フォーマットを選択してください" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        {supportedFormats.map((format) => (
                          <SelectItem
                            key={format.mimeType}
                            value={format.mimeType}
                          >
                            <div className="flex flex-col">
                              <span>{format.label}</span>
                              <span className="text-xs text-muted-foreground">
                                .{format.extension}{" "}
                                {format.codec && `(${format.codec})`}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      ブラウザでサポートされているフォーマットのみ表示されます。
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">
                      音声ビットレート: {(audioBitrate / 1000).toFixed(0)}kbps
                    </Label>
                    <Slider
                      value={[audioBitrate]}
                      onValueChange={(value) => setAudioBitrate(value[0])}
                      min={8000}
                      max={320000}
                      step={8000}
                      disabled={isRecording || isPCMRecording}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      高いビットレートほど音質が良くなりますが、ファイルサイズも大きくなります。低ビットレート（8-32kbps）は音声認識用途に適しています。
                    </p>
                  </div>
                </div>
              )}

              {!useRawPCM && (
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm">
                        <strong>選択中:</strong> {selectedFormat.label} (
                        {(audioBitrate / 1000).toFixed(0)}kbps)
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        ファイル拡張子: .{selectedFormat.extension}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        サポート済みフォーマット: {supportedFormats.length}個
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={debugAudioFormats}
                      className="text-xs"
                    >
                      デバッグ情報
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Separator />

          {/* Recording Controls */}
          <div className="flex flex-col items-center space-y-4">
            <div className="flex space-x-4">
              <Button
                onClick={
                  isRecording || isPCMRecording
                    ? handleStopRecording
                    : handleStartRecording
                }
                size="lg"
                variant={
                  isRecording || isPCMRecording ? "destructive" : "default"
                }
                className="flex items-center space-x-2 px-6 py-3"
              >
                {isRecording || isPCMRecording ? (
                  <MicOff size={20} />
                ) : (
                  <Mic size={20} />
                )}
                <span>
                  {isRecording || isPCMRecording ? "録音停止" : "録音開始"}
                </span>
              </Button>

              {isRecording && !useRawPCM && (
                <Button
                  onClick={handleManualSplit}
                  size="lg"
                  variant="outline"
                  className="flex items-center space-x-2 px-6 py-3"
                >
                  <Scissors size={20} />
                  <span>手動分割</span>
                </Button>
              )}
            </div>

            {/* Recording Status */}
            {(isRecording || isPCMRecording) && (
              <div className="text-center w-full max-w-md space-y-4">
                <div className="space-y-1">
                  {useRawPCM ? (
                    <div className="text-lg font-mono">
                      PCM録音時間: {formatPCMTime(pcmRecordingTime)}
                    </div>
                  ) : (
                    <>
                      <div className="text-lg font-mono">
                        全体録音時間: {formatTime(recordingTime)}
                      </div>
                      <div className="text-md font-mono text-muted-foreground">
                        現在のセグメント: {formatTime(currentSegmentTime)}
                      </div>
                    </>
                  )}
                  {/* 次の分割までの時間を表示（PCMモードでは非表示） */}
                  {!useRawPCM &&
                    (maxDurationEnabled || intervalSplitEnabled) && (
                      <div className="text-sm text-muted-foreground">
                        {maxDurationEnabled &&
                          currentSegmentTime < maxDuration && (
                            <div>
                              最大時間まで:{" "}
                              {formatTime(maxDuration - currentSegmentTime)}
                            </div>
                          )}
                        {intervalSplitEnabled && (
                          <div>
                            次の定期分割まで:{" "}
                            {formatTime(
                              intervalDuration -
                                (currentSegmentTime % intervalDuration),
                            )}
                          </div>
                        )}
                      </div>
                    )}

                  {useRawPCM && (
                    <div className="text-sm text-muted-foreground">
                      Raw PCMモード - 高精度録音中
                    </div>
                  )}
                </div>

                {/* Volume Level Indicator（PCMモードでは非表示） */}
                {!useRawPCM && silenceDetectionEnabled && (
                  <div className="space-y-2">
                    <Label className="text-sm">
                      音量レベル: {(volumeData.currentVolume * 100).toFixed(1)}%
                    </Label>
                    <Progress
                      value={Math.min(volumeData.currentVolume * 100, 100)}
                      className={`w-full h-3 ${
                        volumeData.isAboveThreshold
                          ? "[&>div]:bg-green-500"
                          : "[&>div]:bg-red-500"
                      }`}
                    />
                    <div className="text-xs text-muted-foreground">
                      {volumeData.isAboveThreshold ? "音声検出中" : "無音状態"}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-center space-x-2">
                  <div className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
                  <span className="text-sm text-muted-foreground">
                    録音中...
                    {(silenceDetectionEnabled ||
                      maxDurationEnabled ||
                      intervalSplitEnabled) &&
                      "（自動分割有効）"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recorded Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">
              録音履歴 ({recordedItems.length}件)
            </CardTitle>
            {(silenceDetectionEnabled ||
              maxDurationEnabled ||
              intervalSplitEnabled) && (
              <div className="flex flex-wrap gap-2">
                {silenceDetectionEnabled && (
                  <Badge variant="secondary" className="text-xs">
                    無音検出分割
                  </Badge>
                )}
                {maxDurationEnabled && (
                  <Badge variant="outline" className="text-xs">
                    最大時間分割
                  </Badge>
                )}
                {intervalSplitEnabled && (
                  <Badge variant="outline" className="text-xs">
                    定期間隔分割
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {recordedItems.length > 0 ? (
            <div className="space-y-4">
              {recordedItems.map((item, index) => (
                <Card key={item.id} className="border-2">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <Label className="text-sm font-medium">
                            セグメント #{recordedItems.length - index}
                          </Label>
                          {silenceDetectionEnabled && index === 0 && (
                            <Badge variant="secondary" className="text-xs">
                              最新
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {item.timestamp.toLocaleString("ja-JP")}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          録音時間: {formatTime(item.duration)}
                        </div>
                      </div>
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => togglePlayAudio(item)}
                          title="音声再生"
                        >
                          {currentPlayingId === item.id ? (
                            <Pause size={18} />
                          ) : (
                            <Play size={18} />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleTranscribeAudio(item)}
                          disabled={item.isTranscribing}
                          title="音声書き起こし"
                        >
                          <FileText size={18} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            downloadAudio(item, selectedFormat.extension)
                          }
                          title="音声ダウンロード"
                        >
                          <Download size={18} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteRecording(item.id)}
                          title="削除"
                          className="hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 size={18} />
                        </Button>
                      </div>
                    </div>

                    <Separator className="my-3" />

                    {/* 書き起こし結果表示エリア */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        書き起こし結果:
                      </Label>
                      {item.isTranscribing ? (
                        <div className="text-sm text-muted-foreground flex items-center space-x-2 p-3 bg-muted/50 rounded-md">
                          <Loader2 size={16} className="animate-spin" />
                          <span>書き起こし中...</span>
                        </div>
                      ) : item.transcription ? (
                        <div className="text-sm whitespace-pre-wrap bg-background p-3 rounded-md border">
                          {item.transcription}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground flex items-center space-x-2 p-3 bg-muted/50 rounded-md">
                          <Loader2 size={16} className="animate-spin" />
                          <span>書き起こし開始中...</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              録音履歴がありません。録音を開始してください。
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AudioRecorder;
