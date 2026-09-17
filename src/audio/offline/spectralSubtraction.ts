import { fftForward, fftInverse, hannWindow } from './fft';

export interface SpectralSubtractionOptions {
  fftSize?: number;
  hopSize?: number;
  noiseProfileMs?: number;
  oversubtraction?: number;
  spectralFloor?: number;
}

const DEFAULTS: Required<SpectralSubtractionOptions> = {
  fftSize: 1024,
  hopSize: 256, // 75% overlap
  noiseProfileMs: 400,
  oversubtraction: 1.8,
  spectralFloor: 0.02,
};

function estimateNoiseProfile(
  input: Float32Array,
  fftSize: number,
  hopSize: number,
  window: Float64Array,
  noiseFrameCount: number
): Float64Array {
  const profile = new Float64Array(fftSize / 2 + 1);
  let framesUsed = 0;
  for (let f = 0; f < noiseFrameCount; f++) {
    const pos = f * hopSize;
    if (pos + fftSize > input.length) break;
    const frame = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) frame[i] = input[pos + i] * window[i];
    const { re, im } = fftForward(frame);
    for (let k = 0; k <= fftSize / 2; k++) {
      profile[k] += Math.hypot(re[k], im[k]);
    }
    framesUsed++;
  }
  if (framesUsed > 0) {
    for (let k = 0; k < profile.length; k++) profile[k] /= framesUsed;
  }
  return profile;
}

/**
 * Boll (1979) magnitude spectral subtraction with oversubtraction + spectral
 * flooring, reusing the noisy phase on reconstruction. Runs once, offline, over
 * an already-captured buffer — not intended for live use in this PoC.
 */
export function denoiseSpectralSubtraction(
  input: Float32Array,
  sampleRate: number,
  opts: SpectralSubtractionOptions = {}
): Float32Array {
  const { fftSize, hopSize, noiseProfileMs, oversubtraction, spectralFloor } = { ...DEFAULTS, ...opts };
  const window = hannWindow(fftSize);
  const noiseFrameCount = Math.max(1, Math.floor((noiseProfileMs / 1000) * sampleRate / hopSize));
  const noiseMagProfile = estimateNoiseProfile(input, fftSize, hopSize, window, noiseFrameCount);

  const output = new Float32Array(input.length + fftSize);

  for (let pos = 0; pos + fftSize <= input.length; pos += hopSize) {
    const frame = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) frame[i] = input[pos + i] * window[i];

    const { re, im } = fftForward(frame);

    for (let k = 0; k <= fftSize / 2; k++) {
      const mag = Math.hypot(re[k], im[k]);
      const phase = Math.atan2(im[k], re[k]);
      const cleanMag = Math.max(mag - oversubtraction * noiseMagProfile[k], spectralFloor * mag);
      re[k] = cleanMag * Math.cos(phase);
      im[k] = cleanMag * Math.sin(phase);
      if (k > 0 && k < fftSize / 2) {
        re[fftSize - k] = re[k];
        im[fftSize - k] = -im[k];
      }
    }

    const timeFrame = fftInverse(re, im);
    for (let i = 0; i < fftSize; i++) {
      output[pos + i] += timeFrame[i] * window[i];
    }
  }

  return output.subarray(0, input.length);
}
