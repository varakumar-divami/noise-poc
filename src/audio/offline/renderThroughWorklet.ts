/**
 * Renders an already-captured AudioBuffer through an AudioWorkletNode-based
 * effect using OfflineAudioContext — same DSP code as a live graph, but run
 * once, deterministically, over the whole buffer. Far more reliable for a demo
 * than keeping several live worklet graphs in sync during capture.
 *
 * If `sourceBuffer.sampleRate` differs from `outputSampleRate`, the browser
 * resamples automatically when the AudioBufferSourceNode is connected into a
 * context running at a different rate.
 */
export async function renderBufferThroughNode(
  sourceBuffer: AudioBuffer,
  outputSampleRate: number,
  workletModuleUrls: string[],
  buildNode: (offlineCtx: OfflineAudioContext) => AudioNode
): Promise<AudioBuffer> {
  const length = Math.ceil((sourceBuffer.duration * outputSampleRate) + 1);
  const offlineCtx = new OfflineAudioContext({
    numberOfChannels: 1,
    length,
    sampleRate: outputSampleRate,
  });

  for (const url of workletModuleUrls) {
    await offlineCtx.audioWorklet.addModule(url);
  }

  const src = offlineCtx.createBufferSource();
  src.buffer = sourceBuffer;
  const node = buildNode(offlineCtx);
  src.connect(node);
  node.connect(offlineCtx.destination);
  src.start();

  return offlineCtx.startRendering();
}
