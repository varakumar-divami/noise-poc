import { useState } from 'react';
import type { FilterParams, FilterType, GateParams } from '../audio/types';

interface GateControlsProps {
  initial: GateParams;
  onChange: (params: GateParams) => void;
}

export function GateControls({ initial, onChange }: GateControlsProps) {
  const [threshold, setThreshold] = useState(initial.threshold);

  return (
    <label className="live-control">
      Noise Gate Threshold: {threshold.toFixed(3)}
      <input
        type="range"
        min={0}
        max={0.3}
        step={0.001}
        value={threshold}
        onChange={(e) => {
          const v = Number(e.target.value);
          setThreshold(v);
          onChange({ threshold: v });
        }}
      />
    </label>
  );
}

const CUTOFF_RANGE: Record<FilterType, { min: number; max: number; default: number }> = {
  highpass: { min: 20, max: 1000, default: 100 },
  lowpass: { min: 2000, max: 20000, default: 8000 },
};

interface FilterControlsProps {
  initial: FilterParams;
  onChange: (params: FilterParams) => void;
}

export function FilterControls({ initial, onChange }: FilterControlsProps) {
  const [type, setType] = useState<FilterType>(initial.type);
  const [cutoffHz, setCutoffHz] = useState(initial.cutoffHz);

  const changeType = (nextType: FilterType) => {
    const nextCutoff = CUTOFF_RANGE[nextType].default;
    setType(nextType);
    setCutoffHz(nextCutoff);
    onChange({ type: nextType, cutoffHz: nextCutoff });
  };

  const range = CUTOFF_RANGE[type];

  return (
    <div className="live-control-group">
      <div className="filter-type-toggle">
        <label>
          <input type="radio" name="filter-type" checked={type === 'highpass'} onChange={() => changeType('highpass')} />
          High-pass
        </label>
        <label>
          <input type="radio" name="filter-type" checked={type === 'lowpass'} onChange={() => changeType('lowpass')} />
          Low-pass
        </label>
      </div>
      <label className="live-control">
        Cutoff: {cutoffHz} Hz
        <input
          type="range"
          min={range.min}
          max={range.max}
          value={cutoffHz}
          onChange={(e) => {
            const v = Number(e.target.value);
            setCutoffHz(v);
            onChange({ type, cutoffHz: v });
          }}
        />
      </label>
    </div>
  );
}
