let activeSource: AudioBufferSourceNode | null = null;

interface PlayOptions {
  /** Route playback through this analyser (so a caller can animate waveform/spectrum while it plays). */
  analyser?: AnalyserNode;
  onEnded?: () => void;
}

/** Plays one buffer at a time — starting a new one stops any current playback. */
export function playBuffer(ctx: AudioContext, buffer: AudioBuffer, opts: PlayOptions = {}): void {
  stopPlayback();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  if (opts.analyser) {
    source.connect(opts.analyser);
    opts.analyser.connect(ctx.destination);
  } else {
    source.connect(ctx.destination);
  }
  source.onended = () => {
    if (activeSource === source) activeSource = null;
    opts.onEnded?.();
  };
  activeSource = source;
  source.start();
}

function stopPlayback(): void {
  if (activeSource) {
    try {
      activeSource.stop();
    } catch {
      /* already stopped */
    }
    activeSource = null;
  }
}
