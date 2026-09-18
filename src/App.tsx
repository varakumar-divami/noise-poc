import { useEffect, useState } from 'react';
import { useNoiseDemo } from './hooks/useNoiseDemo';
import { ModePanel } from './components/ModePanel';
import { DebugPanel } from './components/DebugPanel';
import { GateControls, FilterControls } from './components/Controls';
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
    analyser,
    trackInfo,
    error,
    originalBuffer,
    gateParams,
    gateBuffer,
    filterParams,
    filterBuffer,
    startRecording,
    stopRecording,
    updateGateParams,
    updateFilterParams,
    latestChunkPreview,
  } = useNoiseDemo();

  const isRecording = phase === 'recording';
  const elapsed = useElapsedSeconds(isRecording);

  return (
    <div className="app">
      <header>
        <h1>Minimal PCM Noise Suppression PoC</h1>
        <p className="subtitle">
          Record once, then compare Original against two simple amplitude/frequency processing approaches — no
          AI models, no external libraries, just native Web Audio nodes.
        </p>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <section className="controls-bar">
        {phase === 'idle' && <button onClick={startRecording}>Start Recording</button>}
        {isRecording && (
          <>
            <span className="rec-duration">Recording — {elapsed.toFixed(1)}s</span>
            <button onClick={stopRecording}>Stop Recording</button>
          </>
        )}
        {phase === 'recorded' && <button onClick={startRecording}>Start New Recording</button>}
      </section>

      <section className="mode-grid">
        <ModePanel modeId="original" liveAnalyser={isRecording ? analyser : null} buffer={originalBuffer} />
        <ModePanel
          modeId="noisegate"
          buffer={gateBuffer}
          controls={<GateControls initial={gateParams} onChange={updateGateParams} />}
        />
        <ModePanel
          modeId="filter"
          buffer={filterBuffer}
          controls={<FilterControls initial={filterParams} onChange={updateFilterParams} />}
        />
      </section>

      <DebugPanel trackInfo={trackInfo} isLive={isRecording} latestChunkPreview={latestChunkPreview} />
    </div>
  );
}

export default App;
