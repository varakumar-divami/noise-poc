export type ModeId = 'original' | 'noisegate' | 'filter';

export const MODE_LABELS: Record<ModeId, string> = {
  original: 'Original',
  noisegate: 'Noise Gate',
  filter: 'Frequency Filter',
};

export const MODE_BLURBS: Record<ModeId, string> = {
  original: 'Untouched mic audio — the baseline everything else is judged against.',
  noisegate:
    'Mutes the signal below an amplitude threshold. Removes quiet hiss/hum between speech — it cannot tell quiet speech apart from quiet noise.',
  filter:
    'Removes a whole frequency band with a native high-pass/low-pass filter — shows which frequencies the noise actually lives in.',
};

export type RecordingPhase = 'idle' | 'recording' | 'recorded';

export interface DeviceTrackInfo {
  sampleRate: number;
  channelCount: number;
  sampleSize: number | null;
}

export interface GateParams {
  /** Linear amplitude (0..1) — samples with a smoothed envelope below this are gated to silence. */
  threshold: number;
}

export type FilterType = 'highpass' | 'lowpass';

export interface FilterParams {
  type: FilterType;
  cutoffHz: number;
}
