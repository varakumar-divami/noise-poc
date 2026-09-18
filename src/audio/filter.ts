import type { FilterParams } from './types';

/** Renders the buffer through a native BiquadFilterNode — shows which frequencies get removed. */
export async function applyFilter(buffer: AudioBuffer, params: FilterParams): Promise<AudioBuffer> {
  const offlineCtx = new OfflineAudioContext(1, buffer.length, buffer.sampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;
  const biquad = offlineCtx.createBiquadFilter();
  biquad.type = params.type;
  biquad.frequency.value = params.cutoffHz;
  source.connect(biquad);
  biquad.connect(offlineCtx.destination);
  source.start();
  return offlineCtx.startRendering();
}
