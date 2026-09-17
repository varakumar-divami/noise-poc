import { useState } from 'react';
import type { SpectralSubtractionOptions } from '../audio/offline/spectralSubtraction';

interface SpectralControlsProps {
  disabled: boolean;
  onRun: (opts: SpectralSubtractionOptions) => void;
}

export function SpectralControls({ disabled, onRun }: SpectralControlsProps) {
  const [noiseProfileMs, setNoiseProfileMs] = useState(400);
  const [oversubtraction, setOversubtraction] = useState(1.8);
  const [spectralFloor, setSpectralFloor] = useState(0.02);

  return (
    <div className="spectral-controls">
      <p className="mode-note">
        Applied offline to the captured Original buffer — frame-based FFT processing isn't run live
        in this PoC. Adjust and re-run against the same recording.
      </p>
      <label>
        Noise profile window: {noiseProfileMs}ms
        <input
          type="range"
          min={100}
          max={1000}
          step={50}
          value={noiseProfileMs}
          onChange={(e) => setNoiseProfileMs(Number(e.target.value))}
        />
      </label>
      <label>
        Oversubtraction: {oversubtraction.toFixed(2)}
        <input
          type="range"
          min={0.5}
          max={3}
          step={0.1}
          value={oversubtraction}
          onChange={(e) => setOversubtraction(Number(e.target.value))}
        />
      </label>
      <label>
        Spectral floor: {spectralFloor.toFixed(3)}
        <input
          type="range"
          min={0}
          max={0.2}
          step={0.005}
          value={spectralFloor}
          onChange={(e) => setSpectralFloor(Number(e.target.value))}
        />
      </label>
      <button disabled={disabled} onClick={() => onRun({ noiseProfileMs, oversubtraction, spectralFloor })}>
        Run / Re-run spectral subtraction
      </button>
    </div>
  );
}
