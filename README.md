# Minimal PCM Noise Suppression PoC

Small, throwaway React + TypeScript + Vite demo: capture microphone audio in
the browser and compare **Original** against two very simple processing
approaches — an **amplitude noise gate** and a **frequency filter** — using
only native Web Audio nodes.

**This is not production code.** The question it's built to answer is narrow:
*can simple amplitude/frequency processing meaningfully reduce common
environmental noise, before we consider anything more sophisticated (WASM
models, external SDKs, etc.)?*

## Project structure

```
src/
  App.tsx                    Start/Stop button, the 3 mode panels, PCM debug panel
  audio/
    context.ts                shared AudioContext singleton
    recording.ts               getUserMedia -> AnalyserNode + recorder-tap worklet -> AudioBuffer
    noiseGate.ts                 amplitude gate, plain JS over a Float32Array
    filter.ts                     native BiquadFilterNode via OfflineAudioContext
    playback.ts                   AudioBufferSourceNode playback (optionally through an analyser)
    analysis.ts                    rms() and waveformEnvelope() helpers
    types.ts                        ModeId/labels/blurbs, param types
  components/
    ModePanel.tsx              waveform + spectrum canvases, RMS, Play button
    Controls.tsx                 Noise Gate threshold slider, Filter type + cutoff slider
    DebugPanel.tsx                 PCM debug info + rolling sample preview
  hooks/useNoiseDemo.ts       React state: recording lifecycle + on-demand gate/filter recompute
public/
  worklets/recorder-tap-processor.js   the one custom AudioWorklet in this app
```

No external audio-processing package is used anywhere — no RNNoise/WASM, no
hand-rolled FFT, no spectral subtraction. That keeps this PoC free of any
third-party audio licensing question.

## How it works

```
getUserMedia() -> MediaStreamAudioSourceNode -> AnalyserNode (live viz)
                                              -> recorder-tap worklet -> Original AudioBuffer
```

Recording only ever captures **one** chain: the raw mic signal. There's a
single `AnalyserNode` for live waveform/spectrum/RMS while recording, and one
small custom `AudioWorkletProcessor` (`recorder-tap-processor.js`) whose only
job is handing batches of raw `Float32Array` PCM samples back to the main
thread — that's the one place in this app where an `AudioWorklet` is
genuinely necessary, since there's no other way to get uncompressed PCM out
of a live `MediaStream` and into JS.

**Noise Gate** and **Frequency Filter** are not separate live recordings.
They're computed on demand from that single Original buffer, and recomputed
every time you move a slider:

- **Noise Gate** (`noiseGate.ts`) — a plain JS loop over the buffer's
  samples. An envelope follower tracks signal level; once it drops below the
  threshold, a *separately smoothed* gain ramps toward 0 (attack 5ms /
  release 120ms) instead of hard-cutting to 0 — that's what avoids the click
  a literal `sample < threshold ? 0 : sample` would produce at the gate
  boundary. No `AudioWorklet` needed — it's a batch transform over an array
  that already exists in memory, not a real-time constraint.
- **Frequency Filter** (`filter.ts`) — the buffer rendered through a native
  `BiquadFilterNode` inside an `OfflineAudioContext` (high-pass 20Hz–1kHz or
  low-pass 2kHz–20kHz, your choice). Fully native; no custom DSP code.

Both recomputes finish in low milliseconds for a 10–30s clip, so moving a
slider and hitting **Play** feels immediate. Nothing ever connects to
`ctx.destination` while the mic is live — monitoring raw mic input through
speakers without echo cancellation would howl — so "hearing the effect" means
record once, then Play each of the three panels to compare.

Waveform and spectrum are drawn from whichever `AnalyserNode` is active: the
live one while recording (Original panel only), or a temporary one inserted
into the graph while a clip is playing (any panel). The spectrum bars are the
browser's own FFT (`AnalyserNode.getFloatFrequencyData`) — nothing hand-rolled.

## How PCM is obtained

Web Audio always delivers samples as 32-bit floats in the range -1..1,
regardless of the microphone hardware's native ADC bit depth (commonly 16- or
24-bit integer PCM) — that conversion happens below the Web Audio API and
isn't exposed to JS. The debug panel reports
`MediaStreamTrack.getSettings().sampleSize` where the browser provides it,
and is explicit when it doesn't. The "PCM samples" preview scales the live
Float32 values to an int16-equivalent range (`value * 32767`) purely for a
familiar display — it's a display conversion, not the wire format. Only
~20 samples are shown, not the whole buffer.

## Dependencies and licenses

| Dependency | License | Notes |
|---|---|---|
| React, Vite, TypeScript | MIT | standard tooling |
| Everything audio-related | n/a | native Web Audio API only — no third-party DSP/audio package |

## How to run

```
pnpm install
pnpm dev
```

Open the printed localhost URL in Chrome, grant mic permission, click **Start
Recording**, speak for 10–30s, **Stop Recording**, then compare panels and
drag the sliders.

## Known browser limitations

- There is no Web Audio API to measure true OS-level CPU% or true
  mic-to-app input latency — this PoC doesn't attempt to.
- `AudioWorklet` requires a secure context (HTTPS, or `localhost` in dev).

## What we should NOT conclude from this PoC

- No WER (word-error-rate) numbers were measured — "does it sound cleaner"
  is not the same as "does it transcribe better."
- This is a small, informal listening test on one machine/mic — not a
  statistically meaningful comparison across devices, rooms, or speakers.
- A noise gate and a fixed-band filter are the *simplest possible* baselines.
  If they clearly aren't enough, that's a reason to look at smarter
  approaches next — not evidence that nothing simple can help at all.
- Nothing here is production-ready: no error recovery beyond basic
  try/catch, no persistence, no multi-user support, no accessibility pass.
