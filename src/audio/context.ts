let sharedContext: AudioContext | null = null;

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
  return sharedContext;
}

export async function closeSharedAudioContext(): Promise<void> {
  if (sharedContext && sharedContext.state !== 'closed') {
    await sharedContext.close();
  }
  sharedContext = null;
}
