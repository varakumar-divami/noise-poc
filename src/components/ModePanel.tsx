import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ModeId } from '../audio/types';
import { MODE_BLURBS, MODE_LABELS } from '../audio/types';
import { getSharedAudioContext } from '../audio/context';
import { playBuffer } from '../audio/playback';
import { rms, waveformEnvelope } from '../audio/analysis';

interface ModePanelProps {
  modeId: ModeId;
  liveAnalyser?: AnalyserNode | null; // present only for Original while actively recording
  buffer?: AudioBuffer | null;
  controls?: ReactNode;
}

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

export function ModePanel({ modeId, liveAnalyser, buffer, controls }: ModePanelProps) {
  const waveformRef = useRef<HTMLCanvasElement>(null);
  const spectrumRef = useRef<HTMLCanvasElement>(null);
  const playAnalyserRef = useRef<AnalyserNode | null>(null);
  const [liveRms, setLiveRms] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Animate from whichever AnalyserNode is active right now: live mic while recording, or
  // playback while a clip is playing. The browser's own FFT drives the spectrum bars.
  useEffect(() => {
    const analyser = liveAnalyser ?? (isPlaying ? playAnalyserRef.current : null);
    if (!analyser) return;
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
  }, [liveAnalyser, isPlaying]);

  // Nothing actively animating this panel: show a static overview of the whole clip.
  useEffect(() => {
    if (liveAnalyser || isPlaying || !buffer) return;
    const data = buffer.getChannelData(0);
    const wCanvas = waveformRef.current;
    if (wCanvas) {
      const { min, max } = waveformEnvelope(data, wCanvas.width);
      drawWaveform(wCanvas, min, max);
    }
    const sCanvas = spectrumRef.current;
    if (sCanvas) sCanvas.getContext('2d')!.clearRect(0, 0, sCanvas.width, sCanvas.height);
  }, [liveAnalyser, isPlaying, buffer]);

  const handlePlay = async () => {
    if (!buffer) return;
    const ctx = await getSharedAudioContext();
    if (!playAnalyserRef.current) playAnalyserRef.current = ctx.createAnalyser();
    setIsPlaying(true);
    playBuffer(ctx, buffer, { analyser: playAnalyserRef.current, onEnded: () => setIsPlaying(false) });
  };

  const displayedRms = liveAnalyser || isPlaying ? liveRms : buffer ? rms(buffer.getChannelData(0)) : 0;

  return (
    <div className="mode-panel">
      <h3>{MODE_LABELS[modeId]}</h3>
      <p className="mode-blurb">{MODE_BLURBS[modeId]}</p>
      <canvas ref={waveformRef} width={320} height={80} className="viz-canvas" />
      <canvas ref={spectrumRef} width={320} height={60} className="viz-canvas" />
      <div className="mode-meta">
        <span>RMS: {displayedRms.toFixed(3)}</span>
      </div>
      {controls}
      <div className="mode-actions">
        <button onClick={handlePlay} disabled={!buffer || isPlaying}>
          {isPlaying ? 'Playing…' : '▶ Play'}
        </button>
        {buffer && <span className="mode-recording-meta">{buffer.duration.toFixed(1)}s</span>}
      </div>
    </div>
  );
}
