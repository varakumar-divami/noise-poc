import { renderBufferThroughNode } from './renderThroughWorklet';
import { tryBuildRnnoiseNode } from '../rnnoise/rnnoiseNode';

export async function renderHighpass(sourceBuffer: AudioBuffer, cutoffHz: number): Promise<AudioBuffer> {
  return renderBufferThroughNode(sourceBuffer, sourceBuffer.sampleRate, ['/worklets/highpass-processor.js'], (ctx) => {
    const node = new AudioWorkletNode(ctx, 'highpass-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
    });
    node.parameters.get('cutoff')!.setValueAtTime(cutoffHz, 0);
    return node;
  });
}

export interface NoiseGateParams {
  thresholdDb: number;
  attackMs: number;
  releaseMs: number;
}

export async function renderNoiseGate(sourceBuffer: AudioBuffer, params: NoiseGateParams): Promise<AudioBuffer> {
  return renderBufferThroughNode(sourceBuffer, sourceBuffer.sampleRate, ['/worklets/noise-gate-processor.js'], (ctx) => {
    const node = new AudioWorkletNode(ctx, 'noise-gate-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
    });
    node.parameters.get('thresholdDb')!.setValueAtTime(params.thresholdDb, 0);
    node.parameters.get('attackMs')!.setValueAtTime(params.attackMs, 0);
    node.parameters.get('releaseMs')!.setValueAtTime(params.releaseMs, 0);
    return node;
  });
}

/** Returns null if RNNoise can't be initialized in an offline 48kHz context (should be rare/never). */
export async function renderRnnoise(sourceBuffer: AudioBuffer): Promise<AudioBuffer | null> {
  const length = Math.ceil(sourceBuffer.duration * 48000) + 1;
  const offlineCtx = new OfflineAudioContext({ numberOfChannels: 1, length, sampleRate: 48000 });
  const init = await tryBuildRnnoiseNode(offlineCtx);
  if (!init) return null;

  const src = offlineCtx.createBufferSource();
  src.buffer = sourceBuffer;
  src.connect(init.node);
  init.node.connect(offlineCtx.destination);
  src.start();
  return offlineCtx.startRendering();
}
