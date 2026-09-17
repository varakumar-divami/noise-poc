/** Real, measured numbers now that processing is an offline render rather than a live worklet graph. */
export function formatRenderStats(renderMs: number, audioDurationSec: number): string {
  const durationMs = audioDurationSec * 1000;
  if (renderMs <= 0 || durationMs <= 0) return `${renderMs.toFixed(1)}ms`;
  const multiple = durationMs / renderMs;
  return `${renderMs.toFixed(1)}ms (${multiple.toFixed(0)}x realtime)`;
}
