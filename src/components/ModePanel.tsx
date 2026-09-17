import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { FinalizedRecording, ModeChain, ModeId } from '../audio/types';
import { MODE_LABELS } from '../audio/types';
import { STATIC_LATENCY_LABELS } from '../audio/metrics';
import { getSharedAudioContext } from '../audio/context';
import { playBuffer } from '../audio/playback';

interface ModePanelProps {
  modeId: ModeId;
  chain?: ModeChain;
  recording?: FinalizedRecording;
  loadPercent?: number | null;
  controls?: ReactNode;
  note?: string;
}

function computeRms(data: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
  return Math.sqrt(sum / data.length);
}

export function ModePanel({ modeId, chain, recording, loadPercent, controls, note }: ModePanelProps) {
  const waveformRef = useRef<HTMLCanvasElement>(null);
  const spectrumRef = useRef<HTMLCanvasElement>(null);
  const [rms, setRms] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!chain) return;
    const analyser = chain.analyser;
    const timeData = new Float32Array(analyser.fftSize);
    const freqData = new Float32Array(analyser.frequencyBinCount);
    let raf = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);

      analyser.getFloatTimeDomainData(timeData);
      setRms(computeRms(timeData));

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
      if (sCanvas) {
        const ctx2d = sCanvas.getContext('2d')!;
        ctx2d.clearRect(0, 0, sCanvas.width, sCanvas.height);
        ctx2d.fillStyle = '#60a5fa';
        const barWidth = sCanvas.width / freqData.length;
        for (let i = 0; i < freqData.length; i++) {
          const db = freqData[i]; // typically -100..0
          const norm = Math.max(0, (db + 100) / 100);
          const barHeight = norm * sCanvas.height;
          ctx2d.fillRect(i * barWidth, sCanvas.height - barHeight, barWidth, barHeight);
        }
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [chain]);

  const handlePlay = async () => {
    if (!recording) return;
    const ctx = await getSharedAudioContext();
    setIsPlaying(true);
    playBuffer(ctx, recording.buffer, () => setIsPlaying(false));
  };

  const latency = STATIC_LATENCY_LABELS[modeId];

  return (
    <div className="mode-panel">
      <h3>{MODE_LABELS[modeId]}</h3>
      {note && <p className="mode-note">{note}</p>}
      <canvas ref={waveformRef} width={320} height={80} className="viz-canvas" />
      <canvas ref={spectrumRef} width={320} height={60} className="viz-canvas" />
      <div className="mode-meta">
        <span>RMS: {rms.toFixed(3)}</span>
        {loadPercent != null && <span>Load: ~{loadPercent.toFixed(1)}%</span>}
        <span title="Architectural estimate, see README">Latency: {latency.label}</span>
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
