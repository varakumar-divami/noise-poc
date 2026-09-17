import { getSharedAudioContext } from './context';
import { buildPassthroughChain, disconnectChain } from './graphBuilder';
import { finalizedFromBuffer, RecordingStore } from './recordingStore';
import { renderHighpass, renderNoiseGate, renderRnnoise, type NoiseGateParams } from './offline/processors';
import { denoiseSpectralSubtraction, type SpectralSubtractionOptions } from './offline/spectralSubtraction';
import type { DeviceTrackInfo, FinalizedRecording, ModeChain } from './types';

function trackInfoFrom(track: MediaStreamTrack, ctx: AudioContext): DeviceTrackInfo {
  const settings = track.getSettings();
  return {
    sampleRate: ctx.sampleRate,
    channelCount: settings.channelCount ?? 1,
    sampleSize: (settings as MediaTrackSettings & { sampleSize?: number }).sampleSize ?? null,
  };
}

export interface RenderResult {
  recording: FinalizedRecording;
  renderMs: number;
}

export class CaptureSession {
  private ctx: AudioContext | null = null;
  readonly recordingStore = new RecordingStore();

  private liveStream: MediaStream | null = null;
  private liveSource: MediaStreamAudioSourceNode | null = null;
  private liveChain: ModeChain | null = null;
  private originalBuffer: AudioBuffer | null = null;

  private browserNsStream: MediaStream | null = null;
  private browserNsSource: MediaStreamAudioSourceNode | null = null;
  private browserNsChain: ModeChain | null = null;

  async getContext(): Promise<AudioContext> {
    this.ctx = await getSharedAudioContext();
    return this.ctx;
  }

  async startRecording(deviceId?: string): Promise<{ chain: ModeChain; trackInfo: DeviceTrackInfo }> {
    const ctx = await this.getContext();
    this.liveStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      },
    });
    this.liveSource = ctx.createMediaStreamSource(this.liveStream);
    this.recordingStore.start(['original']);
    this.liveChain = buildPassthroughChain(ctx, this.liveSource, 'original', {
      onChunk: this.recordingStore.handleChunk,
    });
    const trackInfo = trackInfoFrom(this.liveStream.getAudioTracks()[0], ctx);
    return { chain: this.liveChain, trackInfo };
  }

  stopRecording(): FinalizedRecording {
    const ctx = this.ctx!;
    const raw = this.recordingStore.finalizeRaw('original');
    const result = this.recordingStore.toAudioBuffer(ctx, 'original', raw);
    this.originalBuffer = result.buffer;

    if (this.liveChain) disconnectChain(this.liveChain);
    this.liveSource?.disconnect();
    this.liveStream?.getTracks().forEach((t) => t.stop());
    this.liveChain = null;
    this.liveSource = null;
    this.liveStream = null;
    return result;
  }

  async startBrowserNsPass(deviceId?: string): Promise<{ chain: ModeChain; trackInfo: DeviceTrackInfo }> {
    const ctx = await this.getContext();
    this.browserNsStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      },
    });
    this.browserNsSource = ctx.createMediaStreamSource(this.browserNsStream);
    this.recordingStore.start(['browserNs']);
    this.browserNsChain = buildPassthroughChain(ctx, this.browserNsSource, 'browserNs', {
      onChunk: this.recordingStore.handleChunk,
    });
    const trackInfo = trackInfoFrom(this.browserNsStream.getAudioTracks()[0], ctx);
    return { chain: this.browserNsChain, trackInfo };
  }

  stopBrowserNsPass(): FinalizedRecording {
    const ctx = this.ctx!;
    const result = this.recordingStore.toAudioBuffer(ctx, 'browserNs');
    if (this.browserNsChain) disconnectChain(this.browserNsChain);
    this.browserNsSource?.disconnect();
    this.browserNsStream?.getTracks().forEach((t) => t.stop());
    this.browserNsChain = null;
    this.browserNsSource = null;
    this.browserNsStream = null;
    return result;
  }

  hasOriginal(): boolean {
    return this.originalBuffer !== null;
  }

  async processHighpass(cutoffHz: number): Promise<RenderResult> {
    const t0 = performance.now();
    const buffer = await renderHighpass(this.originalBuffer!, cutoffHz);
    return { recording: finalizedFromBuffer('highpass', buffer), renderMs: performance.now() - t0 };
  }

  async processNoiseGate(params: NoiseGateParams): Promise<RenderResult> {
    const t0 = performance.now();
    const buffer = await renderNoiseGate(this.originalBuffer!, params);
    return { recording: finalizedFromBuffer('noisegate', buffer), renderMs: performance.now() - t0 };
  }

  /** Returns null if RNNoise can't be initialized (e.g. WASM/worklet load failure). */
  async processRnnoise(): Promise<RenderResult | null> {
    const t0 = performance.now();
    const buffer = await renderRnnoise(this.originalBuffer!);
    if (!buffer) return null;
    return { recording: finalizedFromBuffer('rnnoise', buffer), renderMs: performance.now() - t0 };
  }

  processSpectral(opts?: SpectralSubtractionOptions): RenderResult {
    const ctx = this.ctx!;
    const t0 = performance.now();
    const raw = this.originalBuffer!.getChannelData(0);
    const denoised = denoiseSpectralSubtraction(raw, this.originalBuffer!.sampleRate, opts);
    const buffer = ctx.createBuffer(1, denoised.length, this.originalBuffer!.sampleRate);
    buffer.copyToChannel(denoised as Float32Array<ArrayBuffer>, 0);
    return { recording: finalizedFromBuffer('spectral', buffer), renderMs: performance.now() - t0 };
  }

  latestOriginalChunkPreview(): Float32Array | undefined {
    return this.recordingStore.latestChunk('original');
  }
}
