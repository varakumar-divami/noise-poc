import { useState } from 'react';

interface HighpassControlsProps {
  onChange: (hz: number) => void;
}

export function HighpassControls({ onChange }: HighpassControlsProps) {
  const [cutoff, setCutoff] = useState(100);
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
  onChange: (params: { thresholdDb?: number; attackMs?: number; releaseMs?: number }) => void;
}

export function NoiseGateControls({ onChange }: NoiseGateControlsProps) {
  const [thresholdDb, setThresholdDb] = useState(-50);
  const [attackMs, setAttackMs] = useState(5);
  const [releaseMs, setReleaseMs] = useState(100);

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
            onChange({ thresholdDb: v });
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
            onChange({ attackMs: v });
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
            onChange({ releaseMs: v });
          }}
        />
      </label>
    </div>
  );
}
