import { useState } from 'react';
import type { NoiseGateParams } from '../audio/offline/processors';

interface HighpassControlsProps {
  initial: number;
  onChange: (hz: number) => void;
}

export function HighpassControls({ initial, onChange }: HighpassControlsProps) {
  const [cutoff, setCutoff] = useState(initial);
  return (
    <label className="live-control">
      Cutoff: {cutoff} Hz
      <input
        type="range"
        min={20}
        max={1000}
        value={cutoff}
        onChange={(e) => {
          const v = Number(e.target.value);
          setCutoff(v);
          onChange(v);
        }}
      />
    </label>
  );
}

interface NoiseGateControlsProps {
  initial: NoiseGateParams;
  onChange: (params: NoiseGateParams) => void;
}

export function NoiseGateControls({ initial, onChange }: NoiseGateControlsProps) {
  const [thresholdDb, setThresholdDb] = useState(initial.thresholdDb);
  const [attackMs, setAttackMs] = useState(initial.attackMs);
  const [releaseMs, setReleaseMs] = useState(initial.releaseMs);

  const emit = (patch: Partial<NoiseGateParams>) => onChange({ thresholdDb, attackMs, releaseMs, ...patch });

  return (
    <div className="live-control-group">
      <label className="live-control">
        Threshold: {thresholdDb} dB
        <input
          type="range"
          min={-80}
          max={0}
          value={thresholdDb}
          onChange={(e) => {
            const v = Number(e.target.value);
            setThresholdDb(v);
            emit({ thresholdDb: v });
          }}
        />
      </label>
      <label className="live-control">
        Attack: {attackMs} ms
        <input
          type="range"
          min={0.1}
          max={200}
          value={attackMs}
          onChange={(e) => {
            const v = Number(e.target.value);
            setAttackMs(v);
            emit({ attackMs: v });
          }}
        />
      </label>
      <label className="live-control">
        Release: {releaseMs} ms
        <input
          type="range"
          min={1}
          max={1000}
          value={releaseMs}
          onChange={(e) => {
            const v = Number(e.target.value);
            setReleaseMs(v);
            emit({ releaseMs: v });
          }}
        />
      </label>
    </div>
  );
}
