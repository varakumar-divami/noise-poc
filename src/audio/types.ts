export type LiveModeId = 'original' | 'highpass' | 'noisegate' | 'rnnoise';
export type ModeId = LiveModeId | 'browserNs' | 'spectral';

export const LIVE_MODE_IDS: LiveModeId[] = ['original', 'highpass', 'noisegate', 'rnnoise'];

export const MODE_LABELS: Record<ModeId, string> = {
  original: 'Original',
  highpass: 'High-Pass Filter',
  noisegate: 'Noise Gate',
  rnnoise: 'RNNoise (WASM)',
  browserNs: 'Browser Noise Suppression',
  spectral: 'Spectral Subtraction (offline)',
};

export interface ModeChain {
  modeId: ModeId;
  /** Node whose AudioParams (if any) the UI can control live. */
  controlNode: AudioWorkletNode | null;
  analyser: AnalyserNode;
  tap: AudioWorkletNode;
}

export interface ChunkMessage {
  modeId: ModeId;
  samples: Float32Array;
  timestamp: number;
}

export interface LoadMetricMessage {
  modeId: ModeId;
  avgProcessMs: number;
  quantumBudgetMs: number;
}

export interface FinalizedRecording {
  modeId: ModeId;
  buffer: AudioBuffer;
  durationSec: number;
  byteSize: number;
}

export type SessionPhase =
  | 'idle'
  | 'phase1-recording'
  | 'phase1-done'
  | 'phase2-recording'
  | 'complete';

export interface DeviceTrackInfo {
  sampleRate: number;
  channelCount: number;
  sampleSize: number | null;
}
