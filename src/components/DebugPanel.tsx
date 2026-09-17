import { useEffect, useState } from 'react';
import type { DeviceTrackInfo } from '../audio/types';

const CHUNK_SIZE = 2048;
const PREVIEW_COUNT = 16;

interface DebugPanelProps {
  trackInfo: DeviceTrackInfo | null;
  isLive: boolean;
  latestChunkPreview: () => Float32Array | undefined;
}

export function DebugPanel({ trackInfo, isLive, latestChunkPreview }: DebugPanelProps) {
  const [preview, setPreview] = useState<number[]>([]);

  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(() => {
      const chunk = latestChunkPreview();
      if (chunk) {
        setPreview(Array.from(chunk.slice(0, PREVIEW_COUNT)).map((v) => Math.round(v * 32767)));
      }
    }, 400);
    return () => clearInterval(id);
  }, [isLive, latestChunkPreview]);

  if (!trackInfo) return null;

  const chunkDurationMs = (CHUNK_SIZE / trackInfo.sampleRate) * 1000;

  return (
    <div className="debug-panel">
      <h3>PCM Debug — raw mic capture</h3>
      <div className="debug-grid">
        <span>Sample rate</span><span>{trackInfo.sampleRate} Hz</span>
        <span>Channels</span><span>{trackInfo.channelCount}</span>
        <span>Bit depth (browser-reported)</span>
        <span>
          {trackInfo.sampleSize != null
            ? `${trackInfo.sampleSize}-bit`
            : 'not reported — Web Audio always delivers 32-bit float samples (-1..1); native ADC bit depth isn’t exposed by the API'}
        </span>
        <span>Samples per chunk</span><span>{CHUNK_SIZE}</span>
        <span>Chunk duration</span><span>{chunkDurationMs.toFixed(2)} ms</span>
      </div>

      {isLive && (
        <div className="debug-preview">
          <code>PCM samples (int16-equivalent, display only): [{preview.join(', ')}, ...]</code>
        </div>
      )}
    </div>
  );
}
