import { useState } from 'react';
import type { SpectralSubtractionOptions } from '../audio/offline/spectralSubtraction';

interface SpectralControlsProps {
  disabled: boolean;
  defaults: Required<SpectralSubtractionOptions>;
  onChange: (opts: SpectralSubtractionOptions) => void;
}

export function SpectralControls({ disabled, defaults, onChange }: SpectralControlsProps) {
  const [noiseProfileMs, setNoiseProfileMs] = useState(defaults.noiseProfileMs);
  const [oversubtraction, setOversubtraction] = useState(defaults.oversubtraction);
  const [spectralFloor, setSpectralFloor] = useState(defaults.spectralFloor);

  const emit = (next: Partial<SpectralSubtractionOptions>) =>
    onChange({ noiseProfileMs, oversubtraction, spectralFloor, ...next });

  return (
    <div className="spectral-controls">
      <p className="mode-note">
        Re-rendered offline from the same Original recording on every change — frame-based FFT processing isn't run
        live in this PoC.
      </p>
      <label className="live-control">
        Noise profile window: {noiseProfileMs}ms
        <input
          type="range"
          min={100}
          max={1000}
          step={50}
          disabled={disabled}
          value={noiseProfileMs}
          onChange={(e) => {
            const v = Number(e.target.value);
            setNoiseProfileMs(v);
            emit({ noiseProfileMs: v });
          }}
        />
      </label>
      <label className="live-control">
        Oversubtraction: {oversubtraction.toFixed(2)}
        <input
          type="range"
          min={0.5}
          max={3}
          step={0.1}
          disabled={disabled}
          value={oversubtraction}
          onChange={(e) => {
            const v = Number(e.target.value);
            setOversubtraction(v);
            emit({ oversubtraction: v });
          }}
        />
      </label>
      <label className="live-control">
        Spectral floor: {spectralFloor.toFixed(3)}
        <input
          type="range"
          min={0}
          max={0.2}
          step={0.005}
          disabled={disabled}
          value={spectralFloor}
          onChange={(e) => {
            const v = Number(e.target.value);
            setSpectralFloor(v);
            emit({ spectralFloor: v });
          }}
        />
      </label>
    </div>
  );
}
