import type { ChunkMessage, LoadMetricMessage, ModeChain, ModeId } from './types';

const CHUNK_SIZE = 2048;

export interface GraphCallbacks {
  onChunk: (msg: ChunkMessage) => void;
  onLoad?: (msg: LoadMetricMessage) => void;
}

function buildTap(ctx: AudioContext, modeId: ModeId, callbacks: GraphCallbacks): AudioWorkletNode {
  const tap = new AudioWorkletNode(ctx, 'recorder-tap-processor', {
    numberOfInputs: 1,
    numberOfOutputs: 0,
    channelCount: 1,
    processorOptions: { modeId, chunkSize: CHUNK_SIZE },
  });
  tap.port.onmessage = (event: MessageEvent<{ modeId: ModeId; samples: Float32Array; timestamp: number }>) => {
    callbacks.onChunk(event.data);
  };
  return tap;
}

function attachLoadReporting(node: AudioWorkletNode, modeId: ModeId, callbacks: GraphCallbacks): void {
  if (!callbacks.onLoad) return;
  node.port.onmessage = (event: MessageEvent<{ type: string; avgProcessMs: number; quantumBudgetMs: number }>) => {
    if (event.data?.type === 'load') {
      callbacks.onLoad!({ modeId, avgProcessMs: event.data.avgProcessMs, quantumBudgetMs: event.data.quantumBudgetMs });
    }
  };
}

/** Plain pass-through chain: source -> analyser -> tap. Used for Original and Browser-NS. */
export function buildPassthroughChain(
  ctx: AudioContext,
  source: AudioNode,
  modeId: ModeId,
  callbacks: GraphCallbacks
): ModeChain {
  const analyser = new AnalyserNode(ctx, { fftSize: 2048, smoothingTimeConstant: 0 });
  const tap = buildTap(ctx, modeId, callbacks);
  source.connect(analyser);
  analyser.connect(tap);
  return { modeId, controlNode: null, analyser, tap };
}

export function buildHighpassChain(ctx: AudioContext, source: AudioNode, callbacks: GraphCallbacks): ModeChain {
  const hpf = new AudioWorkletNode(ctx, 'highpass-processor', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    channelCount: 1,
  });
  attachLoadReporting(hpf, 'highpass', callbacks);
  const analyser = new AnalyserNode(ctx, { fftSize: 2048, smoothingTimeConstant: 0 });
  const tap = buildTap(ctx, 'highpass', callbacks);
  source.connect(hpf);
  hpf.connect(analyser);
  analyser.connect(tap);
  return { modeId: 'highpass', controlNode: hpf, analyser, tap };
}

export function buildNoiseGateChain(ctx: AudioContext, source: AudioNode, callbacks: GraphCallbacks): ModeChain {
  const gate = new AudioWorkletNode(ctx, 'noise-gate-processor', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    channelCount: 1,
  });
  attachLoadReporting(gate, 'noisegate', callbacks);
  const analyser = new AnalyserNode(ctx, { fftSize: 2048, smoothingTimeConstant: 0 });
  const tap = buildTap(ctx, 'noisegate', callbacks);
  source.connect(gate);
  gate.connect(analyser);
  analyser.connect(tap);
  return { modeId: 'noisegate', controlNode: gate, analyser, tap };
}

export function buildRnnoiseChain(
  ctx: AudioContext,
  source: AudioNode,
  rnnoiseNode: AudioWorkletNode,
  callbacks: GraphCallbacks
): ModeChain {
  const analyser = new AnalyserNode(ctx, { fftSize: 2048, smoothingTimeConstant: 0 });
  const tap = buildTap(ctx, 'rnnoise', callbacks);
  source.connect(rnnoiseNode);
  rnnoiseNode.connect(analyser);
  analyser.connect(tap);
  return { modeId: 'rnnoise', controlNode: null, analyser, tap };
}

/** Tears down a single chain's own nodes. Does NOT touch the shared source node
 *  (which may fan out to other chains) — callers disconnect the source once,
 *  after all its chains have been torn down. */
export function disconnectChain(chain: ModeChain): void {
  chain.analyser.disconnect();
  chain.tap.disconnect();
  chain.tap.port.onmessage = null;
  if (chain.controlNode) {
    chain.controlNode.disconnect();
    chain.controlNode.port.onmessage = null;
  }
}
