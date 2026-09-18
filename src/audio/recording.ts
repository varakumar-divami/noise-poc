import { getSharedAudioContext } from './context';
import type { DeviceTrackInfo } from './types';

export interface ActiveRecording {
  analyser: AnalyserNode;
  trackInfo: DeviceTrackInfo;
  stop: () => Promise<AudioBuffer>;
  latestChunk: () => Float32Array | undefined;
}

/**
 * getUserMedia -> MediaStreamAudioSourceNode fanned into an AnalyserNode (live viz/PCM preview)
 * and a single recorder-tap AudioWorklet (the only way to get raw Float32 PCM chunks into JS).
 */
export async function startRecording(): Promise<ActiveRecording> {
  const ctx = await getSharedAudioContext();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
  });

  const source = ctx.createMediaStreamSource(stream);

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);

  const tap = new AudioWorkletNode(ctx, 'recorder-tap-processor', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    channelCount: 1,
    processorOptions: { modeId: 'original', chunkSize: 2048 },
  });
  source.connect(tap);

  const chunks: Float32Array[] = [];
  let latestChunk: Float32Array | undefined;
  tap.port.onmessage = (event: MessageEvent<{ samples: Float32Array }>) => {
    chunks.push(event.data.samples);
    latestChunk = event.data.samples;
  };

  const track = stream.getAudioTracks()[0];
  const settings = track.getSettings();
  const trackInfo: DeviceTrackInfo = {
    sampleRate: ctx.sampleRate,
    channelCount: settings.channelCount ?? 1,
    sampleSize: (settings as MediaTrackSettings & { sampleSize?: number }).sampleSize ?? null,
  };

  const stop = async (): Promise<AudioBuffer> => {
    source.disconnect();
    tap.port.onmessage = null;
    tap.disconnect();
    stream.getTracks().forEach((t) => t.stop());

    const total = chunks.reduce((sum, c) => sum + c.length, 0);
    const samples = new Float32Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      samples.set(chunk, offset);
      offset += chunk.length;
    }
    const buffer = ctx.createBuffer(1, Math.max(samples.length, 1), ctx.sampleRate);
    buffer.copyToChannel(samples, 0);
    return buffer;
  };

  return { analyser, trackInfo, stop, latestChunk: () => latestChunk };
}
