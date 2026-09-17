import { fftForward, hannWindow } from './offline/fft';

/** Min/max per pixel column — gives an accurate waveform shape at any zoom level. */
export function waveformEnvelope(data: Float32Array, buckets: number): { min: Float32Array; max: Float32Array } {
  const min = new Float32Array(buckets);
  const max = new Float32Array(buckets);
  const bucketSize = Math.max(1, Math.floor(data.length / buckets));
  for (let b = 0; b < buckets; b++) {
    let lo = 1;
    let hi = -1;
    const start = b * bucketSize;
    const end = b === buckets - 1 ? data.length : start + bucketSize;
    for (let i = start; i < end && i < data.length; i++) {
      const v = data[i];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    min[b] = lo <= hi ? lo : 0;
    max[b] = lo <= hi ? hi : 0;
  }
  return { min, max };
}

export function rms(data: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
  return Math.sqrt(sum / data.length);
}

/** Average magnitude spectrum (in dB) across several evenly-spaced frames of the buffer. */
export function averageSpectrumDb(data: Float32Array, fftSize = 1024, frameCount = 16): Float32Array {
  const bins = fftSize / 2 + 1;
  const accum = new Float64Array(bins);
  const window = hannWindow(fftSize);
  let used = 0;

  if (data.length < fftSize) {
    const frame = new Float32Array(fftSize);
    frame.set(data);
    for (let i = 0; i < fftSize; i++) frame[i] *= window[i];
    const { re, im } = fftForward(frame);
    for (let k = 0; k < bins; k++) accum[k] += Math.hypot(re[k], im[k]);
    used = 1;
  } else {
    const step = Math.max(1, Math.floor((data.length - fftSize) / Math.max(1, frameCount - 1)));
    for (let f = 0, pos = 0; f < frameCount && pos + fftSize <= data.length; f++, pos += step) {
      const frame = new Float32Array(fftSize);
      for (let i = 0; i < fftSize; i++) frame[i] = data[pos + i] * window[i];
      const { re, im } = fftForward(frame);
      for (let k = 0; k < bins; k++) accum[k] += Math.hypot(re[k], im[k]);
      used++;
    }
  }

  const out = new Float32Array(bins);
  for (let k = 0; k < bins; k++) {
    const mag = used > 0 ? accum[k] / used : 0;
    out[k] = 20 * Math.log10(Math.max(mag, 1e-6));
  }
  return out;
}
