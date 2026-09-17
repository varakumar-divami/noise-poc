import type { FinalizedRecording, ModeId, ProcessingStep } from '../audio/types';
import { MODE_LABELS } from '../audio/types';
import { getSharedAudioContext } from '../audio/context';
import { playBuffer } from '../audio/playback';

const ROWS: { modeId: ModeId; processing: string }[] = [
  { modeId: 'original', processing: 'None (raw mic, live capture)' },
  { modeId: 'browserNs', processing: 'getUserMedia NS/AEC/AGC (live capture, separate pass)' },
  { modeId: 'highpass', processing: 'DSP — biquad high-pass (offline render)' },
  { modeId: 'noisegate', processing: 'DSP — envelope-follower gate (offline render)' },
  { modeId: 'rnnoise', processing: 'WASM — RNNoise (offline render)' },
  { modeId: 'spectral', processing: 'DSP — spectral subtraction (offline render)' },
];

interface ComparisonTableProps {
  recordings: Partial<Record<ModeId, FinalizedRecording>>;
  steps: ProcessingStep[];
}

export function ComparisonTable({ recordings, steps }: ComparisonTableProps) {
  const stepFor = (modeId: ModeId) => steps.find((s) => s.modeId === modeId);

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
          <th>Render time (measured)</th>
          <th>Audio</th>
        </tr>
      </thead>
      <tbody>
        {ROWS.map(({ modeId, processing }) => {
          const step = stepFor(modeId);
          const recording = recordings[modeId];
          let renderCell = '—';
          if (modeId === 'original' || modeId === 'browserNs') renderCell = 'n/a — captured live, not rendered';
          else if (step?.status === 'unavailable') renderCell = 'Not available in this browser/build';
          else if (step?.status === 'error') renderCell = `Error: ${step.detail}`;
          else if (step?.detail) renderCell = step.detail;

          return (
            <tr key={modeId}>
              <td>{MODE_LABELS[modeId]}</td>
              <td>{processing}</td>
              <td>{renderCell}</td>
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
