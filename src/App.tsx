import { useEffect, useState } from 'react';
import { useCaptureSession } from './hooks/useCaptureSession';
import { ModePanel } from './components/ModePanel';
import { DebugPanel } from './components/DebugPanel';
import { ComparisonTable } from './components/ComparisonTable';
import { DeviceSelector } from './components/DeviceSelector';
import { SpectralControls } from './components/SpectralControls';
import { HighpassControls, NoiseGateControls } from './components/LiveControls';
import type { ProcessingStep, StepStatus } from './audio/types';
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

const STEP_ICON: Record<StepStatus, string> = {
  pending: '○', // ○
  running: '◐', // spinner-ish
  done: '✓', // ✓
  error: '✗', // ✗
  unavailable: '–', // –
};

function PipelineStatus({ steps }: { steps: ProcessingStep[] }) {
  return (
    <ol className="pipeline-status">
      <li className="pipeline-step done">
        <span className="pipeline-icon">{STEP_ICON.done}</span> 1. Record raw audio
      </li>
      {steps.map((step, i) => (
        <li key={step.modeId} className={`pipeline-step ${step.status}`}>
          <span className="pipeline-icon">{STEP_ICON[step.status]}</span> {i + 2}.{' '}
          {step.modeId === 'highpass' && 'Apply High-Pass Filter'}
          {step.modeId === 'noisegate' && 'Apply Noise Gate'}
          {step.modeId === 'rnnoise' && 'Apply RNNoise (WASM)'}
          {step.modeId === 'spectral' && 'Apply Spectral Subtraction'}
          {step.detail && step.status !== 'pending' && <span className="pipeline-detail"> — {step.detail}</span>}
        </li>
      ))}
    </ol>
  );
}

function App() {
  const {
    recordingPhase,
    browserNsPhase,
    liveChain,
    trackInfo,
    recordings,
    steps,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    error,
    startRecording,
    stopRecording,
    startBrowserNsPass,
    stopBrowserNsPass,
    updateHighpassCutoff,
    updateGateParams,
    updateSpectralParams,
    defaults,
    latestChunkPreview,
  } = useCaptureSession();

  const isRecording = recordingPhase === 'recording';
  const isBrowserNsRecording = browserNsPhase === 'recording';
  const elapsed = useElapsedSeconds(isRecording || isBrowserNsRecording);

  const stepStatus = (modeId: string) => steps.find((s) => s.modeId === modeId);

  return (
    <div className="app">
      <header>
        <h1>PCM Noise Suppression PoC</h1>
        <p className="subtitle">
          Record once → every processing approach runs automatically on that same recording. See README for what
          NOT to conclude from this demo.
        </p>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <section className="controls-bar">
        <DeviceSelector
          devices={devices}
          selectedDeviceId={selectedDeviceId}
          onChange={setSelectedDeviceId}
          disabled={isRecording || isBrowserNsRecording}
        />

        {recordingPhase === 'idle' && <button onClick={startRecording}>Start Recording</button>}
        {isRecording && (
          <>
            <span className="rec-duration">Recording — {elapsed.toFixed(1)}s</span>
            <button onClick={stopRecording}>Stop Recording</button>
          </>
        )}
        {recordingPhase === 'recorded' && <button onClick={startRecording}>Start New Recording</button>}
      </section>

      {recordingPhase !== 'idle' && (
        <section className="pipeline-section">
          <h2>What's happening</h2>
          <PipelineStatus steps={steps} />
        </section>
      )}

      <section className="mode-grid">
        <ModePanel modeId="original" chain={isRecording ? liveChain : undefined} recording={recordings.original} />
        <ModePanel
          modeId="highpass"
          recording={recordings.highpass}
          status={stepStatus('highpass')?.status}
          statusDetail={stepStatus('highpass')?.detail}
          controls={<HighpassControls initial={defaults.highpassCutoff} onChange={updateHighpassCutoff} />}
        />
        <ModePanel
          modeId="noisegate"
          recording={recordings.noisegate}
          status={stepStatus('noisegate')?.status}
          statusDetail={stepStatus('noisegate')?.detail}
          controls={<NoiseGateControls initial={defaults.gate} onChange={updateGateParams} />}
        />
        <ModePanel
          modeId="rnnoise"
          recording={recordings.rnnoise}
          status={stepStatus('rnnoise')?.status}
          statusDetail={stepStatus('rnnoise')?.detail}
          note="Requires a 48kHz capture context; disables itself with a clear status instead of failing silently."
        />
      </section>

      <section className="spectral-section">
        <h2>Spectral / DSP Noise Reduction (offline)</h2>
        <SpectralControls
          disabled={recordingPhase !== 'recorded'}
          defaults={defaults.spectral as Required<typeof defaults.spectral>}
          onChange={updateSpectralParams}
        />
        <ModePanel
          modeId="spectral"
          recording={recordings.spectral}
          status={stepStatus('spectral')?.status}
          statusDetail={stepStatus('spectral')?.detail}
        />
      </section>

      <section className="browser-ns-section">
        <h2>Browser Noise Suppression (optional, separate pass)</h2>
        <p className="phase-note">
          Chrome/Firefox apply echo-cancellation / noise-suppression / AGC at the shared hardware level, not per{' '}
          <code>getUserMedia()</code> call — so this can't be derived from the recording above. It needs its own,
          separate live capture. Try to repeat similar sounds for a fair comparison.
        </p>
        <div className="controls-bar">
          {browserNsPhase === 'idle' && (
            <button disabled={recordingPhase === 'idle'} onClick={startBrowserNsPass}>
              Record Browser-NS Pass
            </button>
          )}
          {isBrowserNsRecording && (
            <>
              <span className="rec-duration">Recording — {elapsed.toFixed(1)}s</span>
              <button onClick={stopBrowserNsPass}>Stop</button>
            </>
          )}
          {browserNsPhase === 'recorded' && <button onClick={startBrowserNsPass}>Record Again</button>}
        </div>
        <ModePanel modeId="browserNs" chain={isBrowserNsRecording ? liveChain : undefined} recording={recordings.browserNs} />
      </section>

      <DebugPanel trackInfo={trackInfo} isLive={isRecording} latestChunkPreview={latestChunkPreview} />

      <section className="comparison-section">
        <h2>Comparison</h2>
        <ComparisonTable recordings={recordings} steps={steps} />
      </section>
    </div>
  );
}

export default App;
