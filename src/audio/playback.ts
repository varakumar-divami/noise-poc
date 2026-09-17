let activeSource: AudioBufferSourceNode | null = null;

/** Plays one finalized recording at a time — starting a new one stops any current playback. */
export function playBuffer(ctx: AudioContext, buffer: AudioBuffer, onEnded?: () => void): void {
  stopPlayback();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.onended = () => {
    if (activeSource === source) activeSource = null;
    onEnded?.();
  };
  activeSource = source;
  source.start();
}

export function stopPlayback(): void {
  if (activeSource) {
    try {
      activeSource.stop();
    } catch {
      /* already stopped */
    }
    activeSource = null;
  }
}
