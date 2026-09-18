import { useCallback, useRef, useState } from 'react';
import { getSharedAudioContext } from '../audio/context';
import { applyFilter } from '../audio/filter';
import { applyNoiseGate } from '../audio/noiseGate';
import { startRecording as startRecordingSession, type ActiveRecording } from '../audio/recording';
import type { DeviceTrackInfo, FilterParams, GateParams, RecordingPhase } from '../audio/types';

const DEFAULT_GATE: GateParams = { threshold: 0.02 };
const DEFAULT_FILTER: FilterParams = { type: 'highpass', cutoffHz: 100 };

export function useNoiseDemo() {
  const [phase, setPhase] = useState<RecordingPhase>('idle');
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [trackInfo, setTrackInfo] = useState<DeviceTrackInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [originalBuffer, setOriginalBuffer] = useState<AudioBuffer | null>(null);
  const [gateParams, setGateParams] = useState<GateParams>(DEFAULT_GATE);
  const [gateBuffer, setGateBuffer] = useState<AudioBuffer | null>(null);
  const [filterParams, setFilterParams] = useState<FilterParams>(DEFAULT_FILTER);
  const [filterBuffer, setFilterBuffer] = useState<AudioBuffer | null>(null);

  const activeRef = useRef<ActiveRecording | null>(null);

  const recomputeGate = useCallback(async (buffer: AudioBuffer, params: GateParams) => {
    const ctx = await getSharedAudioContext();
    setGateBuffer(applyNoiseGate(buffer, ctx, params));
  }, []);

  const recomputeFilter = useCallback(async (buffer: AudioBuffer, params: FilterParams) => {
    setFilterBuffer(await applyFilter(buffer, params));
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setOriginalBuffer(null);
    setGateBuffer(null);
    setFilterBuffer(null);
    try {
      const rec = await startRecordingSession();
      activeRef.current = rec;
      setAnalyser(rec.analyser);
      setTrackInfo(rec.trackInfo);
      setPhase('recording');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const stopRecording = useCallback(async () => {
    const rec = activeRef.current;
    if (!rec) return;
    const buffer = await rec.stop();
    activeRef.current = null;
    setAnalyser(null);
    setOriginalBuffer(buffer);
    setPhase('recorded');
    void recomputeGate(buffer, gateParams);
    void recomputeFilter(buffer, filterParams);
  }, [gateParams, filterParams, recomputeGate, recomputeFilter]);

  const updateGateParams = useCallback(
    (params: GateParams) => {
      setGateParams(params);
      if (originalBuffer) void recomputeGate(originalBuffer, params);
    },
    [originalBuffer, recomputeGate]
  );

  const updateFilterParams = useCallback(
    (params: FilterParams) => {
      setFilterParams(params);
      if (originalBuffer) void recomputeFilter(originalBuffer, params);
    },
    [originalBuffer, recomputeFilter]
  );

  return {
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
    latestChunkPreview: () => activeRef.current?.latestChunk(),
  };
}
