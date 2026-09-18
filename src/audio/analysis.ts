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
