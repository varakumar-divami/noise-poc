import { useCallback, useEffect, useRef, useState } from 'react';
import { CaptureSession } from '../audio/captureSession';
import type { DeviceTrackInfo, FinalizedRecording, ModeChain, ModeId, SessionPhase } from '../audio/types';
import type { SpectralSubtractionOptions } from '../audio/offline/spectralSubtraction';

export function useCaptureSession() {
  const sessionRef = useRef<CaptureSession | null>(null);
  if (!sessionRef.current) sessionRef.current = new CaptureSession();
  const session = sessionRef.current;

  const [phase, setPhase] = useState<SessionPhase>('idle');
  const [liveChains, setLiveChains] = useState<ModeChain[]>([]);
  const [recordings, setRecordings] = useState<Partial<Record<ModeId, FinalizedRecording>>>({});
  const [trackInfo, setTrackInfo] = useState<DeviceTrackInfo | null>(null);
  const [rnnoiseAvailable, setRnnoiseAvailable] = useState(true);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(list.filter((d) => d.kind === 'audioinput'));
    } catch {
      /* ignore — permission likely not granted yet */
    }
  }, []);

  useEffect(() => {
    refreshDevices();
    navigator.mediaDevices.addEventListener?.('devicechange', refreshDevices);
    return () => navigator.mediaDevices.removeEventListener?.('devicechange', refreshDevices);
  }, [refreshDevices]);

  const startPhase1 = useCallback(async () => {
    setError(null);
    try {
      const { chains, trackInfo: info } = await session.startPhase1(selectedDeviceId);
      setLiveChains(chains);
      setTrackInfo(info);
      setRnnoiseAvailable(session.rnnoiseAvailable);
      setPhase('phase1-recording');
      refreshDevices();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [session, selectedDeviceId, refreshDevices]);

  const stopPhase1 = useCallback(() => {
    const results = session.stopPhase1();
    setRecordings((prev) => {
      const next = { ...prev };
      for (const r of results) next[r.modeId] = r;
      return next;
    });
    setLiveChains([]);
    setPhase('phase1-done');
  }, [session]);

  const startPhase2 = useCallback(async () => {
    setError(null);
    try {
      const { chain, trackInfo: info } = await session.startPhase2(selectedDeviceId);
      setLiveChains([chain]);
      setTrackInfo(info);
      setPhase('phase2-recording');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [session, selectedDeviceId]);

  const stopPhase2 = useCallback(() => {
    const result = session.stopPhase2();
    setRecordings((prev) => ({ ...prev, [result.modeId]: result }));
    setLiveChains([]);
    setPhase('complete');
  }, [session]);

  const setHighpassCutoff = useCallback(
    (hz: number) => {
      const chain = liveChains.find((c) => c.modeId === 'highpass');
      chain?.controlNode?.parameters.get('cutoff')?.setValueAtTime(hz, chain.controlNode.context.currentTime);
    },
    [liveChains]
  );

  const setGateParams = useCallback(
    (params: { thresholdDb?: number; attackMs?: number; releaseMs?: number }) => {
      const chain = liveChains.find((c) => c.modeId === 'noisegate');
      if (!chain?.controlNode) return;
      const now = chain.controlNode.context.currentTime;
      if (params.thresholdDb !== undefined) chain.controlNode.parameters.get('thresholdDb')?.setValueAtTime(params.thresholdDb, now);
      if (params.attackMs !== undefined) chain.controlNode.parameters.get('attackMs')?.setValueAtTime(params.attackMs, now);
      if (params.releaseMs !== undefined) chain.controlNode.parameters.get('releaseMs')?.setValueAtTime(params.releaseMs, now);
    },
    [liveChains]
  );

  const runSpectral = useCallback(
    (opts?: SpectralSubtractionOptions) => {
      const result = session.runSpectralSubtraction(opts);
      if (result) setRecordings((prev) => ({ ...prev, spectral: result }));
      return result;
    },
    [session]
  );

  return {
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
    loadTracker: session.loadTracker,
    latestChunkPreview: session.latestChunkPreview.bind(session),
  };
}
