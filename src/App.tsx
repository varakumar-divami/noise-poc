import { useEffect, useState } from 'react';
import { useCaptureSession } from './hooks/useCaptureSession';
import { ModePanel } from './components/ModePanel';
import { DebugPanel } from './components/DebugPanel';
import { ComparisonTable } from './components/ComparisonTable';
import { DeviceSelector } from './components/DeviceSelector';
import { SpectralControls } from './components/SpectralControls';
import { HighpassControls, NoiseGateControls } from './components/LiveControls';
import type { LiveModeId, ModeId } from './audio/types';
import './App.css';

function useElapsedSeconds(isRunning: boolean) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!isRunning) return;
    const startedAt = Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed((Date.now() - startedAt) / 1000), 200);
    return () => clearInterval(id);
  }, [isRunning]);
  return elapsed;
}

function App() {
  const {
    phase,
    liveChains,
    recordings,
    trackInfo,
    rnnoiseAvailable,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    error,
    startPhase1,
    stopPhase1,
    startPhase2,
    stopPhase2,
    setHighpassCutoff,
    setGateParams,
    runSpectral,
    loadTracker,
    latestChunkPreview,
  } = useCaptureSession();

  const isPhase1Recording = phase === 'phase1-recording';
  const isPhase2Recording = phase === 'phase2-recording';
  const elapsed = useElapsedSeconds(isPhase1Recording || isPhase2Recording);

  const chainFor = (id: ModeId) => liveChains.find((c) => c.modeId === id);
  const liveModeIds: LiveModeId[] = isPhase1Recording
    ? (['original', 'highpass', 'noisegate', ...(rnnoiseAvailable ? (['rnnoise'] as const) : [])] as LiveModeId[])
    : [];

  return (
    <div className="app">
      <header>
        <h1>PCM Noise Suppression PoC</h1>
        <p className="subtitle">
          Mic → PCM → processing → visual/audio comparison. Not production code — see README for what NOT to
          conclude from this demo.
        </p>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <section className="controls-bar">
        <DeviceSelector
          devices={devices}
          selectedDeviceId={selectedDeviceId}
          onChange={setSelectedDeviceId}
          disabled={isPhase1Recording || isPhase2Recording}
        />

        {phase === 'idle' && <button onClick={startPhase1}>Start Recording</button>}
        {isPhase1Recording && (
          <>
            <span className="rec-duration">Phase 1 — Original / HPF / Gate / RNNoise — {elapsed.toFixed(1)}s</span>
            <button onClick={stopPhase1}>Stop Phase 1</button>
          </>
        )}
        {phase === 'phase1-done' && (
          <>
            <span>Phase 1 done. Repeat similar sounds for the Browser-NS reference pass, then start it.</span>
            <button onClick={startPhase2}>Record Browser-NS Pass</button>
          </>
        )}
        {isPhase2Recording && (
          <>
            <span className="rec-duration">Phase 2 — Browser NS — {elapsed.toFixed(1)}s</span>
            <button onClick={stopPhase2}>Stop Phase 2</button>
          </>
        )}
        {phase === 'complete' && <button onClick={startPhase1}>Start New Session</button>}
      </section>

      <p className="phase-note">
        Original vs. Browser-NS can't be recorded simultaneously: Chrome/Firefox apply mic echo-cancellation /
        noise-suppression / AGC at the shared hardware level, not per <code>getUserMedia()</code> call — so they're
        captured as two sequential passes instead of pretending they're the same take.
      </p>

      <section className="mode-grid">
        <ModePanel modeId="original" chain={chainFor('original')} recording={recordings.original} />
        <ModePanel
          modeId="highpass"
          chain={chainFor('highpass')}
          recording={recordings.highpass}
          loadPercent={loadTracker.get('highpass')}
          controls={<HighpassControls onChange={setHighpassCutoff} />}
        />
        <ModePanel
          modeId="noisegate"
          chain={chainFor('noisegate')}
          recording={recordings.noisegate}
          loadPercent={loadTracker.get('noisegate')}
          controls={<NoiseGateControls onChange={setGateParams} />}
        />
        {rnnoiseAvailable ? (
          <ModePanel modeId="rnnoise" chain={chainFor('rnnoise')} recording={recordings.rnnoise} />
        ) : (
          <div className="mode-panel mode-panel-stub">
            <h3>RNNoise (WASM)</h3>
            <p>Not available in this browser/build (requires a 48kHz AudioContext and successful WASM load).</p>
          </div>
        )}
        <ModePanel modeId="browserNs" chain={chainFor('browserNs')} recording={recordings.browserNs} />
      </section>

      <section className="spectral-section">
        <h2>Spectral / DSP Noise Reduction (offline)</h2>
        <SpectralControls disabled={phase === 'idle' || isPhase1Recording} onRun={runSpectral} />
        <ModePanel modeId="spectral" recording={recordings.spectral} />
      </section>

      <DebugPanel
        trackInfo={trackInfo}
        liveModes={liveModeIds}
        isLive={isPhase1Recording}
        latestChunkPreview={latestChunkPreview}
      />

      <section className="comparison-section">
        <h2>Comparison</h2>
        <ComparisonTable recordings={recordings} loadTracker={loadTracker} rnnoiseAvailable={rnnoiseAvailable} />
      </section>
    </div>
  );
}

export default App;
