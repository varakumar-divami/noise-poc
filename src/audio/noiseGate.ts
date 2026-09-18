import type { GateParams } from './types';

const ATTACK_MS = 5;
const RELEASE_MS = 120;

/**
 * Simple amplitude noise gate: an envelope follower tracks the signal level, and once it
 * drops below `threshold` the (separately smoothed) gain ramps toward 0 instead of cutting
 * instantly — that ramp is what avoids the click a hard `sample < threshold ? 0 : sample`
 * would cause at the gate boundary.
 */
export function applyNoiseGate(buffer: AudioBuffer, ctx: AudioContext, params: GateParams): AudioBuffer {
  const input = buffer.getChannelData(0);
  const output = new Float32Array(input.length);
  const sampleRate = buffer.sampleRate;
  const attackCoeff = Math.exp(-1 / ((ATTACK_MS / 1000) * sampleRate));
  const releaseCoeff = Math.exp(-1 / ((RELEASE_MS / 1000) * sampleRate));

  let envelope = 0;
  let gain = 1;
  for (let i = 0; i < input.length; i++) {
    const sample = input[i];
    const rectified = Math.abs(sample);
    const envCoeff = rectified > envelope ? attackCoeff : releaseCoeff;
    envelope = envCoeff * envelope + (1 - envCoeff) * rectified;

    const targetGain = envelope < params.threshold ? 0 : 1;
    const gainCoeff = targetGain > gain ? attackCoeff : releaseCoeff;
    gain = gainCoeff * gain + (1 - gainCoeff) * targetGain;

    output[i] = sample * gain;
  }

  const out = ctx.createBuffer(1, output.length, sampleRate);
  out.copyToChannel(output, 0);
  return out;
}
