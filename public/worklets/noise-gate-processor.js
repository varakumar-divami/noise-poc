// Amplitude-based noise gate: one-pole envelope follower + smoothed gate gain
// (separate smoothing avoids zipper/click artifacts at the gate boundary).
// thresholdDb is dBFS for an intuitive slider; attack/release are ms time constants.
class NoiseGateProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'thresholdDb', defaultValue: -50, minValue: -80, maxValue: 0, automationRate: 'k-rate' },
      { name: 'attackMs', defaultValue: 5, minValue: 0.1, maxValue: 200, automationRate: 'k-rate' },
      { name: 'releaseMs', defaultValue: 100, minValue: 1, maxValue: 1000, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this.envelope = 0;
    this.gainState = 0;
    this._loadAccumMs = 0;
    this._loadAccumCount = 0;
    this._lastReport = currentTime;
  }

  msToCoeff(ms) {
    return Math.exp(-1 / ((ms / 1000) * sampleRate));
  }

  process(inputs, outputs, parameters) {
    const t0 = performance.now();
    const input = inputs[0] && inputs[0][0];
    const output = outputs[0] && outputs[0][0];
    if (!input || !output) return true;

    const thresholdDb = parameters.thresholdDb[0];
    const attackMs = parameters.attackMs[0];
    const releaseMs = parameters.releaseMs[0];
    const thresholdLinear = Math.pow(10, thresholdDb / 20);

    const attackCoeff = this.msToCoeff(attackMs);
    const releaseCoeff = this.msToCoeff(releaseMs);
    const gateAttackCoeff = this.msToCoeff(Math.max(attackMs, 1));
    const gateReleaseCoeff = this.msToCoeff(releaseMs);

    for (let i = 0; i < input.length; i++) {
      const x = input[i];
      const rectified = Math.abs(x);

      const envCoeff = rectified > this.envelope ? attackCoeff : releaseCoeff;
      this.envelope = envCoeff * this.envelope + (1 - envCoeff) * rectified;

      const targetGain = this.envelope >= thresholdLinear ? 1 : 0;
      const smoothCoeff = targetGain > this.gainState ? gateAttackCoeff : gateReleaseCoeff;
      this.gainState = smoothCoeff * this.gainState + (1 - smoothCoeff) * targetGain;

      output[i] = x * this.gainState;
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

registerProcessor('noise-gate-processor', NoiseGateProcessor);
