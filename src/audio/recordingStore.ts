import type { ChunkMessage, FinalizedRecording, ModeId } from './types';

/** Accumulates chunks per mode during a recording pass, then concatenates once at Stop. */
export class RecordingStore {
  private chunksByMode = new Map<ModeId, Float32Array[]>();
  private latestChunkByMode = new Map<ModeId, Float32Array>();

  start(modeIds: ModeId[]): void {
    for (const id of modeIds) {
      this.chunksByMode.set(id, []);
    }
  }

  handleChunk = (msg: ChunkMessage): void => {
    const list = this.chunksByMode.get(msg.modeId);
    if (!list) return; // not part of the active recording (e.g. stray late message)
    list.push(msg.samples);
    this.latestChunkByMode.set(msg.modeId, msg.samples);
  };

  latestChunk(modeId: ModeId): Float32Array | undefined {
    return this.latestChunkByMode.get(modeId);
  }

  /** Concatenates all chunks for one mode into a single Float32Array of raw samples. */
  finalizeRaw(modeId: ModeId): Float32Array {
    const chunks = this.chunksByMode.get(modeId) ?? [];
    const total = chunks.reduce((sum, c) => sum + c.length, 0);
    const out = new Float32Array(total);
    let offset = 0;
    for (const c of chunks) {
      out.set(c, offset);
      offset += c.length;
    }
    return out;
  }

  toAudioBuffer(ctx: AudioContext, modeId: ModeId, samples?: Float32Array): FinalizedRecording {
    const raw = samples ?? this.finalizeRaw(modeId);
    const buffer = ctx.createBuffer(1, Math.max(raw.length, 1), ctx.sampleRate);
    buffer.copyToChannel(raw as Float32Array<ArrayBuffer>, 0);
    return {
      modeId,
      buffer,
      durationSec: raw.length / ctx.sampleRate,
      byteSize: raw.length * 4, // Float32
    };
  }

  reset(): void {
    this.chunksByMode.clear();
    this.latestChunkByMode.clear();
  }
}
