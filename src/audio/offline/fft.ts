/**
 * Minimal iterative radix-2 Cooley-Tukey FFT/IFFT, in-place on parallel
 * real/imaginary Float64Arrays. `size` must be a power of two.
 */

function bitReverse(re: Float64Array, im: Float64Array, size: number): void {
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
}

function fft(re: Float64Array, im: Float64Array, size: number, inverse: boolean): void {
  bitReverse(re, im, size);
  for (let len = 2; len <= size; len <<= 1) {
    const half = len >> 1;
    const angleStep = ((inverse ? 1 : -1) * 2 * Math.PI) / len;
    for (let i = 0; i < size; i += len) {
      for (let k = 0; k < half; k++) {
        const angle = angleStep * k;
        const wr = Math.cos(angle);
        const wi = Math.sin(angle);
        const evenIdx = i + k;
        const oddIdx = i + k + half;
        const tr = re[oddIdx] * wr - im[oddIdx] * wi;
        const ti = re[oddIdx] * wi + im[oddIdx] * wr;
        re[oddIdx] = re[evenIdx] - tr;
        im[oddIdx] = im[evenIdx] - ti;
        re[evenIdx] += tr;
        im[evenIdx] += ti;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < size; i++) {
      re[i] /= size;
      im[i] /= size;
    }
  }
}

/** Forward FFT of a real-valued frame. Returns full-length complex spectrum. */
export function fftForward(frame: Float32Array): { re: Float64Array; im: Float64Array } {
  const size = frame.length;
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  re.set(frame);
  fft(re, im, size, false);
  return { re, im };
}

/** Inverse FFT back to a real-valued time-domain frame (imaginary part discarded). */
export function fftInverse(re: Float64Array, im: Float64Array): Float32Array {
  const size = re.length;
  const reCopy = re.slice();
  const imCopy = im.slice();
  fft(reCopy, imCopy, size, true);
  const out = new Float32Array(size);
  for (let i = 0; i < size; i++) out[i] = reCopy[i];
  return out;
}

export function hannWindow(size: number): Float64Array {
  const w = new Float64Array(size);
  for (let i = 0; i < size; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
  }
  return w;
}
