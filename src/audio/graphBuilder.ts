import type { ChunkMessage, ModeChain, ModeId } from './types';

const CHUNK_SIZE = 2048;

export interface GraphCallbacks {
  onChunk: (msg: ChunkMessage) => void;
}

/** source -> analyser (live viz) -> tap (records raw PCM). Used for the live capture pass
 *  (Original, and separately Browser-NS) — processed modes are rendered offline, see audio/offline/. */
export function buildPassthroughChain(
  ctx: AudioContext,
  source: AudioNode,
  modeId: ModeId,
  callbacks: GraphCallbacks
): ModeChain {
  const analyser = new AnalyserNode(ctx, { fftSize: 2048, smoothingTimeConstant: 0 });
  const tap = new AudioWorkletNode(ctx, 'recorder-tap-processor', {
    numberOfInputs: 1,
    numberOfOutputs: 0,
    channelCount: 1,
    processorOptions: { modeId, chunkSize: CHUNK_SIZE },
  });
  tap.port.onmessage = (event: MessageEvent<{ modeId: ModeId; samples: Float32Array; timestamp: number }>) => {
    callbacks.onChunk(event.data);
  };
  source.connect(analyser);
  analyser.connect(tap);
  return { modeId, analyser, tap };
}

/** Tears down a single chain's own nodes. Does NOT touch the shared source node
 *  (which may fan out to other chains) — callers disconnect the source separately. */
export function disconnectChain(chain: ModeChain): void {
  chain.analyser.disconnect();
  chain.tap.disconnect();
  chain.tap.port.onmessage = null;
}
