import { RnnoiseWorkletNode, loadRnnoise } from '@sapphi-red/web-noise-suppressor';

let workletModuleLoaded = false;

export interface RnnoiseInitResult {
  node: RnnoiseWorkletNode;
}

/**
 * RNNoise (via @sapphi-red/web-noise-suppressor) assumes a 48kHz context.
 * Returns null (never throws) if the context isn't 48kHz or init fails for any
 * reason — callers should render a disabled/stub panel in that case instead of
 * blocking the rest of the demo.
 */
export async function tryBuildRnnoiseNode(ctx: AudioContext): Promise<RnnoiseInitResult | null> {
  if (ctx.sampleRate !== 48000) {
    console.warn(`[rnnoise] AudioContext is ${ctx.sampleRate}Hz, RNNoise requires 48000Hz. Disabling.`);
    return null;
  }

  try {
    if (!workletModuleLoaded) {
      await ctx.audioWorklet.addModule('/rnnoise/rnnoiseWorklet.js');
      workletModuleLoaded = true;
    }
    const wasmBinary = await loadRnnoise({
      url: '/rnnoise/rnnoise.wasm',
      simdUrl: '/rnnoise/rnnoise_simd.wasm',
    });
    const node = new RnnoiseWorkletNode(ctx, { maxChannels: 1, wasmBinary });
    return { node };
  } catch (err) {
    console.error('[rnnoise] init failed, falling back to stub panel', err);
    return null;
  }
}
