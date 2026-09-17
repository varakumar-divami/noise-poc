import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { FinalizedRecording, ModeChain, ModeId, StepStatus } from '../audio/types';
import { MODE_LABELS } from '../audio/types';
import { getSharedAudioContext } from '../audio/context';
import { playBuffer } from '../audio/playback';
import { averageSpectrumDb, rms, waveformEnvelope } from '../audio/analysis';

interface ModePanelProps {
  modeId: ModeId;
  chain?: ModeChain | null; // present only while this mode is being LIVE-captured (Original / Browser-NS)
  recording?: FinalizedRecording;
  status?: StepStatus;
  statusDetail?: string;
  controls?: ReactNode;
  note?: string;
}

const STATUS_LABEL: Record<StepStatus, string> = {
  pending: 'Waiting for recording…',
  running: 'Processing…',
  done: 'Ready',
  error: 'Failed',
  unavailable: 'Not available',
};

function drawWaveform(canvas: HTMLCanvasElement, min: Float32Array, max: Float32Array) {
  const ctx2d = canvas.getContext('2d')!;
  ctx2d.clearRect(0, 0, canvas.width, canvas.height);
  ctx2d.strokeStyle = '#4ade80';
  const mid = canvas.height / 2;
  for (let x = 0; x < min.length; x++) {
    const y0 = mid - max[x] * mid;
    const y1 = mid - min[x] * mid;
    ctx2d.beginPath();
    ctx2d.moveTo(x, y0);
    ctx2d.lineTo(x, Math.max(y1, y0 + 1));
    ctx2d.stroke();
  }
}

function drawSpectrumBars(canvas: HTMLCanvasElement, freqDb: Float32Array) {
  const ctx2d = canvas.getContext('2d')!;
  ctx2d.clearRect(0, 0, canvas.width, canvas.height);
  ctx2d.fillStyle = '#60a5fa';
  const barWidth = canvas.width / freqDb.length;
  for (let i = 0; i < freqDb.length; i++) {
    const norm = Math.max(0, (freqDb[i] + 100) / 100);
    const barHeight = norm * canvas.height;
    ctx2d.fillRect(i * barWidth, canvas.height - barHeight, barWidth, barHeight);
  }
}

export function ModePanel({ modeId, chain, recording, status, statusDetail, controls, note }: ModePanelProps) {
  const waveformRef = useRef<HTMLCanvasElement>(null);
  const spectrumRef = useRef<HTMLCanvasElement>(null);
  const [liveRms, setLiveRms] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Live mode: animate from the AnalyserNode while this mode is actively being captured.
  useEffect(() => {
    if (!chain) return;
    const analyser = chain.analyser;
    const timeData = new Float32Array(analyser.fftSize);
    const freqData = new Float32Array(analyser.frequencyBinCount);
    let raf = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      analyser.getFloatTimeDomainData(timeData);
      setLiveRms(rms(timeData));

      const wCanvas = waveformRef.current;
      if (wCanvas) {
        const ctx2d = wCanvas.getContext('2d')!;
        ctx2d.clearRect(0, 0, wCanvas.width, wCanvas.height);
        ctx2d.strokeStyle = '#4ade80';
        ctx2d.beginPath();
        const step = wCanvas.width / timeData.length;
        for (let i = 0; i < timeData.length; i++) {
          const x = i * step;
          const y = (0.5 - timeData[i] * 0.5) * wCanvas.height;
          if (i === 0) ctx2d.moveTo(x, y);
          else ctx2d.lineTo(x, y);
        }
        ctx2d.stroke();
      }

      analyser.getFloatFrequencyData(freqData);
      const sCanvas = spectrumRef.current;
      if (sCanvas) drawSpectrumBars(sCanvas, freqData);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [chain]);

  // Static mode: once a recording exists (and isn't currently live), draw it once from the buffer.
  useEffect(() => {
    if (chain || !recording) return;
    const data = recording.buffer.getChannelData(0);
    const wCanvas = waveformRef.current;
    const sCanvas = spectrumRef.current;
    if (wCanvas) {
      const { min, max } = waveformEnvelope(data, wCanvas.width);
      drawWaveform(wCanvas, min, max);
    }
    if (sCanvas) {
      drawSpectrumBars(sCanvas, averageSpectrumDb(data));
    }
  }, [chain, recording]);

  const handlePlay = async () => {
    if (!recording) return;
    const ctx = await getSharedAudioContext();
    setIsPlaying(true);
    playBuffer(ctx, recording.buffer, () => setIsPlaying(false));
  };

  const displayedRms = chain ? liveRms : recording ? rms(recording.buffer.getChannelData(0)) : 0;

  return (
    <div className="mode-panel">
      <div className="mode-panel-header">
        <h3>{MODE_LABELS[modeId]}</h3>
        {status && <span className={`status-badge status-${status}`}>{STATUS_LABEL[status]}</span>}
      </div>
      {note && <p className="mode-note">{note}</p>}
      <canvas ref={waveformRef} width={320} height={80} className="viz-canvas" />
      <canvas ref={spectrumRef} width={320} height={60} className="viz-canvas" />
      <div className="mode-meta">
        <span>RMS: {displayedRms.toFixed(3)}</span>
        {statusDetail && status === 'done' && <span title="Measured render time for this offline pass">{statusDetail}</span>}
      </div>
      {controls}
      <div className="mode-actions">
        <button onClick={handlePlay} disabled={!recording || isPlaying}>
          {isPlaying ? 'Playing…' : '▶ Play'}
        </button>
        {recording && (
          <span className="mode-recording-meta">
            {recording.durationSec.toFixed(1)}s · {(recording.byteSize / 1024).toFixed(0)}KB
          </span>
        )}
      </div>
    </div>
  );
}
