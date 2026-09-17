import { RnnoiseWorkletNode, loadRnnoise } from '@sapphi-red/web-noise-suppressor';

export interface RnnoiseInitResult {
  node: RnnoiseWorkletNode;
}

/**
 * RNNoise (via @sapphi-red/web-noise-suppressor) assumes a 48kHz context.
 * Works with either a live AudioContext or an OfflineAudioContext — each
 * BaseAudioContext needs its own addModule() call since worklet registration
 * is per-context, not global.
 * Returns null (never throws) on any failure — callers should render a
 * disabled/stub panel instead of blocking the rest of the demo.
 */
export async function tryBuildRnnoiseNode(ctx: BaseAudioContext): Promise<RnnoiseInitResult | null> {
  if (ctx.sampleRate !== 48000) {
    console.warn(`[rnnoise] context is ${ctx.sampleRate}Hz, RNNoise requires 48000Hz. Disabling.`);
    return null;
  }

  try {
    await ctx.audioWorklet.addModule('/rnnoise/rnnoiseWorklet.js');
    const wasmBinary = await loadRnnoise({
      url: '/rnnoise/rnnoise.wasm',
      simdUrl: '/rnnoise/rnnoise_simd.wasm',
    });
    // The package's .d.ts narrows to AudioContext, but AudioWorkletNode construction works
    // identically against any BaseAudioContext (including OfflineAudioContext) at runtime.
    const node = new RnnoiseWorkletNode(ctx as AudioContext, { maxChannels: 1, wasmBinary });
    return { node };
  } catch (err) {
    console.error('[rnnoise] init failed, falling back to stub panel', err);
    return null;
  }
}
