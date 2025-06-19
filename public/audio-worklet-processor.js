// AudioWorkletProcessor for raw PCM recording
class RawPCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];

    if (input.length > 0) {
      const inputChannel = input[0]; // モノラル

      for (let i = 0; i < inputChannel.length; i++) {
        this.buffer[this.bufferIndex] = inputChannel[i];
        this.bufferIndex++;

        // バッファが満杯になったらメインスレッドに送信
        if (this.bufferIndex >= this.bufferSize) {
          // Float32Arrayをコピーして送信
          const pcmChunk = new Float32Array(this.buffer);
          this.port.postMessage({
            type: "pcmData",
            data: pcmChunk,
          });

          this.bufferIndex = 0;
        }
      }
    }

    return true; // プロセッサーを継続
  }
}

registerProcessor("raw-pcm-processor", RawPCMProcessor);
