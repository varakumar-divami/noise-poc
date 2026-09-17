// RBJ Audio EQ Cookbook Butterworth high-pass biquad.
// cutoff is a k-rate AudioParam so slider changes apply within one render quantum,
// no graph rebuild needed. Zero added latency (single-sample IIR, no lookahead).
class HighpassProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'cutoff', defaultValue: 100, minValue: 20, maxValue: 1000, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this.x1 = 0; this.x2 = 0; this.y1 = 0; this.y2 = 0;
    this.lastCutoff = -1;
    this.b0 = 0; this.b1 = 0; this.b2 = 0; this.a1 = 0; this.a2 = 0;
    this._loadAccumMs = 0;
    this._loadAccumCount = 0;
    this._lastReport = currentTime;
  }

  recomputeCoefficients(cutoffHz) {
    const Q = Math.SQRT1_2; // Butterworth (maximally flat) response
    const omega = (2 * Math.PI * cutoffHz) / sampleRate;
    const alpha = Math.sin(omega) / (2 * Q);
    const cosw = Math.cos(omega);

    const b0 = (1 + cosw) / 2;
    const b1 = -(1 + cosw);
    const b2 = (1 + cosw) / 2;
    const a0 = 1 + alpha;
    const a1 = -2 * cosw;
    const a2 = 1 - alpha;

    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0;
    this.a1 = a1 / a0; this.a2 = a2 / a0;
    this.lastCutoff = cutoffHz;
  }

  process(inputs, outputs, parameters) {
    const t0 = performance.now();
    const input = inputs[0] && inputs[0][0];
    const output = outputs[0] && outputs[0][0];
    if (!input || !output) return true;

    const cutoff = parameters.cutoff[0];
    if (cutoff !== this.lastCutoff) this.recomputeCoefficients(cutoff);

    for (let i = 0; i < input.length; i++) {
      const x0 = input[i];
      const y0 =
        this.b0 * x0 + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
      this.x2 = this.x1; this.x1 = x0;
      this.y2 = this.y1; this.y1 = y0;
      output[i] = y0;
    }

    this._reportLoad(performance.now() - t0);
    return true;
  }

  _reportLoad(processMs) {
    this._loadAccumMs += processMs;
    this._loadAccumCount += 1;
    if (currentTime - this._lastReport >= 1) {
      this.port.postMessage({
        type: 'load',
        avgProcessMs: this._loadAccumMs / this._loadAccumCount,
        quantumBudgetMs: (128 / sampleRate) * 1000,
      });
      this._loadAccumMs = 0;
      this._loadAccumCount = 0;
      this._lastReport = currentTime;
    }
  }
}

registerProcessor('highpass-processor', HighpassProcessor);
