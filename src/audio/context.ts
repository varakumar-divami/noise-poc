let sharedContext: AudioContext | null = null;

// Our hand-rolled processors — must be registered via addModule() before any
// `new AudioWorkletNode(ctx, name)` call for that name will work.
const CORE_WORKLET_MODULES = [
  '/worklets/recorder-tap-processor.js',
  '/worklets/highpass-processor.js',
  '/worklets/noise-gate-processor.js',
];

/**
 * The `sampleRate` passed here is a hint only (per spec) — most modern hardware
 * honors 48000, but browsers may silently resample or ignore it. Callers must
 * read back `ctx.sampleRate` rather than assuming the requested value.
 */
export async function getSharedAudioContext(): Promise<AudioContext> {
  if (sharedContext && sharedContext.state !== 'closed') {
    if (sharedContext.state === 'suspended') await sharedContext.resume();
    return sharedContext;
  }
  sharedContext = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' });
  await sharedContext.resume();
  await Promise.all(CORE_WORKLET_MODULES.map((url) => sharedContext!.audioWorklet.addModule(url)));
  return sharedContext;
}

export async function closeSharedAudioContext(): Promise<void> {
  if (sharedContext && sharedContext.state !== 'closed') {
    await sharedContext.close();
  }
  sharedContext = null;
}
