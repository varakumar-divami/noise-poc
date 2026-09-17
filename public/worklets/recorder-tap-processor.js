// Generic recording/debug tap. One class, instantiated once per mode.
// Batches samples and hands them to the main thread as transferable Float32Arrays
// tagged with modeId, both for final-recording accumulation and the live PCM
// debug preview. Never modifies the signal — pure pass-through.
class RecorderTapProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = options.processorOptions || {};
    this.modeId = opts.modeId;
    this.chunkSize = opts.chunkSize || 2048;
    this.buffer = new Float32Array(this.chunkSize);
    this.writeIdx = 0;
  }

  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input) return true;

    for (let i = 0; i < input.length; i++) {
      this.buffer[this.writeIdx++] = input[i];
      if (this.writeIdx === this.chunkSize) {
        this.port.postMessage(
          { modeId: this.modeId, samples: this.buffer, timestamp: currentTime },
          [this.buffer.buffer]
        );
        this.buffer = new Float32Array(this.chunkSize);
        this.writeIdx = 0;
      }
    }
    return true;
  }
}

registerProcessor('recorder-tap-processor', RecorderTapProcessor);
