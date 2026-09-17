import { useCallback, useEffect, useRef, useState } from 'react';
import { CaptureSession } from '../audio/captureSession';
import { formatRenderStats } from '../audio/metrics';
import type { NoiseGateParams } from '../audio/offline/processors';
import type { SpectralSubtractionOptions } from '../audio/offline/spectralSubtraction';
import type {
  BrowserNsPhase,
  DeviceTrackInfo,
  FinalizedRecording,
  ModeChain,
  ModeId,
  ProcessedModeId,
  ProcessingStep,
  RecordingPhase,
} from '../audio/types';
import { PROCESSED_MODE_IDS } from '../audio/types';

const DEFAULTS = {
  highpassCutoff: 100,
  gate: { thresholdDb: -50, attackMs: 5, releaseMs: 100 } as NoiseGateParams,
  spectral: { noiseProfileMs: 400, oversubtraction: 1.8, spectralFloor: 0.02 } as SpectralSubtractionOptions,
};

function initialSteps(): ProcessingStep[] {
  return PROCESSED_MODE_IDS.map((modeId) => ({ modeId, status: 'pending' }));
}

export function useCaptureSession() {
  const sessionRef = useRef<CaptureSession | null>(null);
  if (!sessionRef.current) sessionRef.current = new CaptureSession();
  const session = sessionRef.current;

  const [recordingPhase, setRecordingPhase] = useState<RecordingPhase>('idle');
  const [browserNsPhase, setBrowserNsPhase] = useState<BrowserNsPhase>('idle');
  const [liveChain, setLiveChain] = useState<ModeChain | null>(null);
  const [trackInfo, setTrackInfo] = useState<DeviceTrackInfo | null>(null);
  const [recordings, setRecordings] = useState<Partial<Record<ModeId, FinalizedRecording>>>({});
  const [renderStats, setRenderStats] = useState<Partial<Record<ProcessedModeId, string>>>({});
  const [steps, setSteps] = useState<ProcessingStep[]>(initialSteps());
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(list.filter((d) => d.kind === 'audioinput'));
    } catch {
      /* permission not granted yet */
    }
  }, []);

  useEffect(() => {
    refreshDevices();
    navigator.mediaDevices.addEventListener?.('devicechange', refreshDevices);
    return () => navigator.mediaDevices.removeEventListener?.('devicechange', refreshDevices);
  }, [refreshDevices]);

  const setStep = useCallback((modeId: ProcessedModeId, patch: Partial<ProcessingStep>) => {
    setSteps((prev) => prev.map((s) => (s.modeId === modeId ? { ...s, ...patch } : s)));
  }, []);

  const runPipeline = useCallback(async () => {
    setSteps(initialSteps());

    setStep('highpass', { status: 'running' });
    try {
      const { recording, renderMs } = await session.processHighpass(DEFAULTS.highpassCutoff);
      setRecordings((prev) => ({ ...prev, highpass: recording }));
      setRenderStats((prev) => ({ ...prev, highpass: formatRenderStats(renderMs, recording.durationSec) }));
      setStep('highpass', { status: 'done', detail: formatRenderStats(renderMs, recording.durationSec) });
    } catch (err) {
      setStep('highpass', { status: 'error', detail: err instanceof Error ? err.message : String(err) });
    }

    setStep('noisegate', { status: 'running' });
    try {
      const { recording, renderMs } = await session.processNoiseGate(DEFAULTS.gate);
      setRecordings((prev) => ({ ...prev, noisegate: recording }));
      setRenderStats((prev) => ({ ...prev, noisegate: formatRenderStats(renderMs, recording.durationSec) }));
      setStep('noisegate', { status: 'done', detail: formatRenderStats(renderMs, recording.durationSec) });
    } catch (err) {
      setStep('noisegate', { status: 'error', detail: err instanceof Error ? err.message : String(err) });
    }

    setStep('rnnoise', { status: 'running' });
    try {
      const result = await session.processRnnoise();
      if (!result) {
        setStep('rnnoise', { status: 'unavailable', detail: 'WASM/worklet init failed or non-48kHz device' });
      } else {
        setRecordings((prev) => ({ ...prev, rnnoise: result.recording }));
        setRenderStats((prev) => ({ ...prev, rnnoise: formatRenderStats(result.renderMs, result.recording.durationSec) }));
        setStep('rnnoise', { status: 'done', detail: formatRenderStats(result.renderMs, result.recording.durationSec) });
      }
    } catch (err) {
      setStep('rnnoise', { status: 'error', detail: err instanceof Error ? err.message : String(err) });
    }

    setStep('spectral', { status: 'running' });
    try {
      const { recording, renderMs } = session.processSpectral(DEFAULTS.spectral);
      setRecordings((prev) => ({ ...prev, spectral: recording }));
      setRenderStats((prev) => ({ ...prev, spectral: formatRenderStats(renderMs, recording.durationSec) }));
      setStep('spectral', { status: 'done', detail: formatRenderStats(renderMs, recording.durationSec) });
    } catch (err) {
      setStep('spectral', { status: 'error', detail: err instanceof Error ? err.message : String(err) });
    }
  }, [session, setStep]);

  const startRecording = useCallback(async () => {
    setError(null);
    setRecordings({});
    setRenderStats({});
    setSteps(initialSteps());
    try {
      const { chain, trackInfo: info } = await session.startRecording(selectedDeviceId);
      setLiveChain(chain);
      setTrackInfo(info);
      setRecordingPhase('recording');
      refreshDevices();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [session, selectedDeviceId, refreshDevices]);

  const stopRecording = useCallback(() => {
    const result = session.stopRecording();
    setRecordings((prev) => ({ ...prev, original: result }));
    setLiveChain(null);
    setRecordingPhase('recorded');
    void runPipeline();
  }, [session, runPipeline]);

  const startBrowserNsPass = useCallback(async () => {
    setError(null);
    try {
      const { chain, trackInfo: info } = await session.startBrowserNsPass(selectedDeviceId);
      setLiveChain(chain);
      setTrackInfo(info);
      setBrowserNsPhase('recording');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [session, selectedDeviceId]);

  const stopBrowserNsPass = useCallback(() => {
    const result = session.stopBrowserNsPass();
    setRecordings((prev) => ({ ...prev, browserNs: result }));
    setLiveChain(null);
    setBrowserNsPhase('recorded');
  }, [session]);

  // Debounced re-render helpers: slider drags shouldn't fire an offline render per pixel.
  const debounceRefs = useRef<Partial<Record<ProcessedModeId, ReturnType<typeof setTimeout>>>>({});
  const debounce = useCallback((modeId: ProcessedModeId, fn: () => void, delayMs = 200) => {
    const existing = debounceRefs.current[modeId];
    if (existing) clearTimeout(existing);
    debounceRefs.current[modeId] = setTimeout(fn, delayMs);
  }, []);

  const updateHighpassCutoff = useCallback(
    (hz: number) => {
      if (!session.hasOriginal()) return;
      debounce('highpass', async () => {
        setStep('highpass', { status: 'running' });
        const { recording, renderMs } = await session.processHighpass(hz);
        setRecordings((prev) => ({ ...prev, highpass: recording }));
        setStep('highpass', { status: 'done', detail: formatRenderStats(renderMs, recording.durationSec) });
      });
    },
    [session, debounce, setStep]
  );

  const updateGateParams = useCallback(
    (params: NoiseGateParams) => {
      if (!session.hasOriginal()) return;
      debounce('noisegate', async () => {
        setStep('noisegate', { status: 'running' });
        const { recording, renderMs } = await session.processNoiseGate(params);
        setRecordings((prev) => ({ ...prev, noisegate: recording }));
        setStep('noisegate', { status: 'done', detail: formatRenderStats(renderMs, recording.durationSec) });
      });
    },
    [session, debounce, setStep]
  );

  const updateSpectralParams = useCallback(
    (opts: SpectralSubtractionOptions) => {
      if (!session.hasOriginal()) return;
      debounce('spectral', () => {
        setStep('spectral', { status: 'running' });
        const { recording, renderMs } = session.processSpectral(opts);
        setRecordings((prev) => ({ ...prev, spectral: recording }));
        setStep('spectral', { status: 'done', detail: formatRenderStats(renderMs, recording.durationSec) });
      });
    },
    [session, debounce, setStep]
  );

  return {
    recordingPhase,
    browserNsPhase,
    liveChain,
    trackInfo,
    recordings,
    renderStats,
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
    defaults: DEFAULTS,
    latestChunkPreview: () => session.latestOriginalChunkPreview(),
  };
}
