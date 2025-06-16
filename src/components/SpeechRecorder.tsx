import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useAudioPlayer } from "@/hooks/useAudioPlayer.ts";
import { useAudioRecorder } from "@/hooks/useAudioRecorder.ts";
import { useRecordingsList } from "@/hooks/useRecordingsList.ts";
import { useTranscription } from "@/hooks/useTranscription.ts";
import { useVolumeMonitoring } from "@/hooks/useVolumeMonitoring.ts";
import {
  Download,
  FileText,
  Loader2,
  Mic,
  MicOff,
  Pause,
  Play,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import type { RecordedItem, SilenceDetectionConfig } from "../types/audio";

const AudioRecorder = () => {
  const [silenceDetectionEnabled, setSilenceDetectionEnabled] = useState(true);
  const [silenceThreshold, setSilenceThreshold] = useState(0.05); // 音量閾値
  const [silenceDuration, setSilenceDuration] = useState(1); // 無音継続時間（秒）

  const silenceConfig: SilenceDetectionConfig = {
    enabled: silenceDetectionEnabled,
    threshold: silenceThreshold,
    duration: silenceDuration,
  };

  // Custom hooks
  const {
    isRecording,
    recordingTime,
    startRecording,
    stopRecording,
    splitRecording,
    formatTime,
  } = useAudioRecorder();

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

  const { transcribeAudio } = useTranscription();

  // Recording handlers
  const handleStartRecording = async () => {
    await startRecording(
      (audioBlob, duration) => {
        const newItem = addRecording(audioBlob, duration);
        // 新しいセグメントが保存されたら自動的に書き起こしを開始
        setTimeout(() => {
          console.log("自動書き起こしを開始:", newItem.id);
          handleTranscribeAudio(newItem);
        }, 500);
      },
      (stream: MediaStream) =>
        setupVolumeMonitoring(stream, handleSplitRecording),
    );
  };

  const handleStopRecording = async () => {
    stopRecording();
    await stopVolumeMonitoring();
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
                    自動分割を有効化
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

          <Separator />

          {/* Recording Controls */}
          <div className="flex flex-col items-center space-y-4">
            <Button
              onClick={isRecording ? handleStopRecording : handleStartRecording}
              size="lg"
              variant={isRecording ? "destructive" : "default"}
              className="flex items-center space-x-2 px-6 py-3"
            >
              {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
              <span>{isRecording ? "録音停止" : "録音開始"}</span>
            </Button>

            {/* Recording Status */}
            {isRecording && (
              <div className="text-center w-full max-w-md space-y-4">
                <div className="text-lg font-mono">
                  録音時間: {formatTime(recordingTime)}
                </div>

                {/* Volume Level Indicator */}
                {silenceDetectionEnabled && (
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
                    録音中...{silenceDetectionEnabled ? "（自動分割有効）" : ""}
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
            {silenceDetectionEnabled && (
              <Badge variant="secondary" className="text-xs">
                無音検出により自動分割・自動書き起こし
              </Badge>
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
                          onClick={() => downloadAudio(item)}
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
