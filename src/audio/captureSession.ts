import { getSharedAudioContext } from './context';
import {
  buildHighpassChain,
  buildNoiseGateChain,
  buildPassthroughChain,
  buildRnnoiseChain,
  disconnectChain,
} from './graphBuilder';
import { LoadTracker } from './metrics';
import { tryBuildRnnoiseNode } from './rnnoise/rnnoiseNode';
import { RecordingStore } from './recordingStore';
import { denoiseSpectralSubtraction, type SpectralSubtractionOptions } from './offline/spectralSubtraction';
import { LIVE_MODE_IDS, type DeviceTrackInfo, type FinalizedRecording, type ModeChain } from './types';

function trackInfoFrom(track: MediaStreamTrack, ctx: AudioContext): DeviceTrackInfo {
  const settings = track.getSettings();
  return {
    sampleRate: ctx.sampleRate,
    channelCount: settings.channelCount ?? 1,
    sampleSize: (settings as MediaTrackSettings & { sampleSize?: number }).sampleSize ?? null,
  };
}

export class CaptureSession {
  private ctx: AudioContext | null = null;
  readonly recordingStore = new RecordingStore();
  readonly loadTracker = new LoadTracker();

  private phase1Stream: MediaStream | null = null;
  private phase1Source: MediaStreamAudioSourceNode | null = null;
  private phase1Chains = new Map<string, ModeChain>();
  private rawOriginalSamples: Float32Array | null = null;

  private phase2Stream: MediaStream | null = null;
  private phase2Source: MediaStreamAudioSourceNode | null = null;
  private phase2Chain: ModeChain | null = null;

  rnnoiseAvailable = true;

  async getContext(): Promise<AudioContext> {
    this.ctx = await getSharedAudioContext();
    return this.ctx;
  }

  async startPhase1(deviceId?: string): Promise<{ chains: ModeChain[]; trackInfo: DeviceTrackInfo }> {
    const ctx = await this.getContext();
    this.phase1Stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      },
    });

    this.phase1Source = ctx.createMediaStreamSource(this.phase1Stream);
    this.recordingStore.start(LIVE_MODE_IDS);

    const callbacks = { onChunk: this.recordingStore.handleChunk, onLoad: this.loadTracker.handleLoad };

    const original = buildPassthroughChain(ctx, this.phase1Source, 'original', callbacks);
    const highpass = buildHighpassChain(ctx, this.phase1Source, callbacks);
    const noisegate = buildNoiseGateChain(ctx, this.phase1Source, callbacks);
    this.phase1Chains.set('original', original);
    this.phase1Chains.set('highpass', highpass);
    this.phase1Chains.set('noisegate', noisegate);

    const rnnoiseInit = await tryBuildRnnoiseNode(ctx);
    if (rnnoiseInit) {
      const rnnoise = buildRnnoiseChain(ctx, this.phase1Source, rnnoiseInit.node, callbacks);
      this.phase1Chains.set('rnnoise', rnnoise);
      this.rnnoiseAvailable = true;
    } else {
      this.rnnoiseAvailable = false;
    }

    const trackInfo = trackInfoFrom(this.phase1Stream.getAudioTracks()[0], ctx);
    return { chains: [...this.phase1Chains.values()], trackInfo };
  }

  /** Finalizes the 4 live recordings and tears down phase-1's live graph/stream. */
  stopPhase1(): FinalizedRecording[] {
    const ctx = this.ctx!;
    const results: FinalizedRecording[] = [];
    for (const [modeId, chain] of this.phase1Chains) {
      const raw = this.recordingStore.finalizeRaw(chain.modeId);
      if (modeId === 'original') this.rawOriginalSamples = raw;
      results.push(this.recordingStore.toAudioBuffer(ctx, chain.modeId, raw));
      disconnectChain(chain);
    }
    this.phase1Source?.disconnect();
    this.phase1Stream?.getTracks().forEach((t) => t.stop());
    this.phase1Chains.clear();
    this.phase1Source = null;
    this.phase1Stream = null;
    return results;
  }

  async startPhase2(deviceId?: string): Promise<{ chain: ModeChain; trackInfo: DeviceTrackInfo }> {
    const ctx = await this.getContext();
    this.phase2Stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      },
    });
    this.phase2Source = ctx.createMediaStreamSource(this.phase2Stream);
    this.recordingStore.start(['browserNs']);
    this.phase2Chain = buildPassthroughChain(ctx, this.phase2Source, 'browserNs', {
      onChunk: this.recordingStore.handleChunk,
    });
    const trackInfo = trackInfoFrom(this.phase2Stream.getAudioTracks()[0], ctx);
    return { chain: this.phase2Chain, trackInfo };
  }

  stopPhase2(): FinalizedRecording {
    const ctx = this.ctx!;
    const result = this.recordingStore.toAudioBuffer(ctx, 'browserNs');
    if (this.phase2Chain) disconnectChain(this.phase2Chain);
    this.phase2Source?.disconnect();
    this.phase2Stream?.getTracks().forEach((t) => t.stop());
    this.phase2Chain = null;
    this.phase2Source = null;
    this.phase2Stream = null;
    return result;
  }

  /** Offline-only: runs spectral subtraction over Phase 1's captured Original buffer. */
  runSpectralSubtraction(opts?: SpectralSubtractionOptions): FinalizedRecording | null {
    if (!this.ctx || !this.rawOriginalSamples) return null;
    const denoised = denoiseSpectralSubtraction(this.rawOriginalSamples, this.ctx.sampleRate, opts);
    return this.recordingStore.toAudioBuffer(this.ctx, 'spectral', denoised);
  }

  latestChunkPreview(modeId: Parameters<RecordingStore['latestChunk']>[0]) {
    return this.recordingStore.latestChunk(modeId);
  }
}
