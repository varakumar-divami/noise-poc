import type { LoadMetricMessage, ModeId } from './types';

export interface ModeMetric {
  loadPercent: number | null; // approx. worklet processing time as % of real-time budget
  latencyLabel: string;
  latencyIsApprox: boolean;
}

/** Fixed, architectural latency labels — not runtime-measured, no fabricated precision. */
export const STATIC_LATENCY_LABELS: Record<ModeId, { label: string; isApprox: boolean }> = {
  original: { label: 'N/A — not exposed by Web Audio API', isApprox: false },
  highpass: { label: '~0ms (sample-synchronous IIR, no buffering)', isApprox: false },
  noisegate: { label: '~0ms (sample-synchronous IIR, no buffering)', isApprox: false },
  rnnoise: { label: '~10ms (fixed 480-sample internal frame @48kHz)', isApprox: true },
  browserNs: { label: 'N/A — not exposed by Web Audio API', isApprox: false },
  spectral: { label: 'N/A — offline, not real-time', isApprox: false },
};

/** Tracks the rolling per-mode worklet load % reported by highpass/noise-gate processors. */
export class LoadTracker {
  private loadByMode = new Map<ModeId, number>();

  handleLoad = (msg: LoadMetricMessage): void => {
    this.loadByMode.set(msg.modeId, (msg.avgProcessMs / msg.quantumBudgetMs) * 100);
  };

  get(modeId: ModeId): number | null {
    return this.loadByMode.get(modeId) ?? null;
  }

  reset(): void {
    this.loadByMode.clear();
  }
}
