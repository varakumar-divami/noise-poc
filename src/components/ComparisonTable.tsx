import type { FinalizedRecording, ModeId } from '../audio/types';
import { MODE_LABELS } from '../audio/types';
import { getSharedAudioContext } from '../audio/context';
import { playBuffer } from '../audio/playback';
import { STATIC_LATENCY_LABELS, type LoadTracker } from '../audio/metrics';

const ROWS: { modeId: ModeId; processing: string }[] = [
  { modeId: 'original', processing: 'None (raw mic)' },
  { modeId: 'browserNs', processing: 'getUserMedia NS/AEC/AGC' },
  { modeId: 'highpass', processing: 'DSP — biquad high-pass' },
  { modeId: 'noisegate', processing: 'DSP — envelope-follower gate' },
  { modeId: 'rnnoise', processing: 'WASM — RNNoise (RNN)' },
  { modeId: 'spectral', processing: 'DSP — offline spectral subtraction' },
];

interface ComparisonTableProps {
  recordings: Partial<Record<ModeId, FinalizedRecording>>;
  loadTracker: LoadTracker;
  rnnoiseAvailable: boolean;
}

export function ComparisonTable({ recordings, loadTracker, rnnoiseAvailable }: ComparisonTableProps) {
  const handlePlay = async (recording: FinalizedRecording) => {
    const ctx = await getSharedAudioContext();
    playBuffer(ctx, recording.buffer);
  };

  return (
    <table className="comparison-table">
      <thead>
        <tr>
          <th>Mode</th>
          <th>Processing</th>
          <th>Approx. Load</th>
          <th>Approx. Latency</th>
          <th>Audio</th>
        </tr>
      </thead>
      <tbody>
        {ROWS.map(({ modeId, processing }) => {
          if (modeId === 'rnnoise' && !rnnoiseAvailable) {
            return (
              <tr key={modeId}>
                <td>{MODE_LABELS[modeId]}</td>
                <td colSpan={4}>Not available in this browser/build</td>
              </tr>
            );
          }
          const recording = recordings[modeId];
          const load = loadTracker.get(modeId);
          return (
            <tr key={modeId}>
              <td>{MODE_LABELS[modeId]}</td>
              <td>{processing}</td>
              <td>{load != null ? `~${load.toFixed(1)}%` : '—'}</td>
              <td>{STATIC_LATENCY_LABELS[modeId].label}</td>
              <td>
                <button disabled={!recording} onClick={() => recording && handlePlay(recording)}>
                  ▶ Play
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
