export type ProcessedModeId = 'highpass' | 'noisegate' | 'rnnoise' | 'spectral';
export type ModeId = 'original' | ProcessedModeId | 'browserNs';

export const PROCESSED_MODE_IDS: ProcessedModeId[] = ['highpass', 'noisegate', 'rnnoise', 'spectral'];

export const MODE_LABELS: Record<ModeId, string> = {
  original: 'Original',
  highpass: 'High-Pass Filter',
  noisegate: 'Noise Gate',
  rnnoise: 'RNNoise (WASM)',
  spectral: 'Spectral Subtraction (offline)',
  browserNs: 'Browser Noise Suppression (optional, separate pass)',
};

export interface ModeChain {
  modeId: ModeId;
  analyser: AnalyserNode;
  tap: AudioWorkletNode;
}

export interface ChunkMessage {
  modeId: ModeId;
  samples: Float32Array;
  timestamp: number;
}

export interface FinalizedRecording {
  modeId: ModeId;
  buffer: AudioBuffer;
  durationSec: number;
  byteSize: number;
}

export type RecordingPhase = 'idle' | 'recording' | 'recorded';
export type BrowserNsPhase = 'idle' | 'recording' | 'recorded';

export type StepStatus = 'pending' | 'running' | 'done' | 'error' | 'unavailable';

export interface ProcessingStep {
  modeId: ProcessedModeId;
  status: StepStatus;
  /** e.g. "38ms · 92x realtime" or an error message */
  detail?: string;
}

export interface DeviceTrackInfo {
  sampleRate: number;
  channelCount: number;
  sampleSize: number | null;
}
