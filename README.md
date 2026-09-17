# PCM Noise Suppression PoC

Small, throwaway React + TypeScript + Vite demo: capture microphone audio in the
browser, compare five noise-suppression approaches side by side (live waveform,
live spectrum, RMS, playback), and show what happens to the underlying PCM data
along the way.

**This is not production code.** It exists to give the team a visual/audible
feel for different noise-suppression approaches before deciding a direction for
NIMS's real audio pipeline.

## Project structure

```
src/
  App.tsx                     session state machine, phase orchestration, layout
  components/
    ModePanel.tsx              waveform + spectrum canvases, RMS, play button
    DebugPanel.tsx              PCM debug info + rolling sample preview
    ComparisonTable.tsx          mode x (processing/load/latency/audio) table
    DeviceSelector.tsx            mic picker
    SpectralControls.tsx           offline spectral-subtraction controls
    LiveControls.tsx                 high-pass/noise-gate sliders
  audio/
    context.ts                  shared AudioContext singleton
    captureSession.ts            orchestrates the two recording phases + graphs
    graphBuilder.ts               per-mode chain assembly
    recordingStore.ts              chunk accumulation -> AudioBuffer
    metrics.ts                     approx. load tracking + static latency labels
    playback.ts                    AudioBufferSourceNode playback
    worklets/                      (types only — actual processors are in public/worklets)
    rnnoise/rnnoiseNode.ts          RNNoise wrapper, 48kHz guard, stub fallback
    offline/
      fft.ts                       hand-rolled radix-2 FFT
      spectralSubtraction.ts        Boll-1979 spectral subtraction
  hooks/useCaptureSession.ts    React state wrapper around CaptureSession
public/
  worklets/*.js                 AudioWorkletProcessor files, loaded as static assets
  rnnoise/*                     RNNoise worklet + wasm, copied from node_modules on install
scripts/copy-rnnoise-assets.mjs  postinstall: syncs RNNoise assets into public/
```

Worklet processors are plain `.js` files served straight from `public/` rather
than bundled through Vite. This sidesteps any ambiguity around bundling
AudioWorklet code + WASM binaries through Vite's dependency pre-bundling — they're
loaded via `audioContext.audioWorklet.addModule('/worklets/xxx.js')` and are not
type-checked with the rest of the app. Fine for a demo this size.

## Dependencies and licenses

| Dependency | License | Notes |
|---|---|---|
| React, Vite, TypeScript | MIT | standard tooling |
| `@sapphi-red/web-noise-suppressor` | MIT | wrapper exposing `RnnoiseWorkletNode` |
| `xiph/rnnoise` (bundled inside the above via shiguredo/rnnoise-wasm) | BSD-3-Clause | Mozilla/Xiph origin — permissive, commercial use fine, no source-disclosure obligation, keep the copyright notice |
| FFT / biquad / noise-gate DSP | n/a (hand-rolled) | no external DSP library needed |

## How the audio pipeline works

```
getUserMedia() -> MediaStream -> AudioContext -> AudioWorklet -> PCM frames -> processing -> viz/playback
```

One shared `AudioContext` is created once (requesting 48kHz — a hint, not a
guarantee; the actual value is always read back from `ctx.sampleRate`, never
assumed). A single `MediaStreamAudioSourceNode` fans out natively (no splitter
needed) into four concurrent chains:

- **Original** — straight through, no processing.
- **High-Pass Filter** — hand-rolled biquad, live-adjustable cutoff.
- **Noise Gate** — hand-rolled envelope-follower gate, live-adjustable threshold/attack/release.
- **RNNoise** — WASM, dropped inline via `@sapphi-red/web-noise-suppressor`.

Each chain ends in an `AnalyserNode` (for live waveform/spectrum) followed by a
single generic `RecorderTapProcessor` worklet (one class, five instances, each
tagged with a `modeId`) that batches 2048 samples and hands them to the main
thread as transferable `Float32Array`s for recording and the PCM debug preview.
None of the chains connect to `destination` — with a live mic open, monitoring
through speakers without echo cancellation would howl.

### Why Original vs. Browser-NS is two passes, not one

Chrome/Firefox apply mic echo-cancellation, noise-suppression, and AGC at the
shared hardware/APM layer, not per `getUserMedia()` call. Opening two concurrent
streams with different constraints on the same physical mic does not reliably
give two independently-processed tracks — they end up processed identically, or
the second call re-negotiates the device mid-session and glitches the first
stream. So the demo records in two sequential phases instead: Phase 1 captures
Original/High-Pass/Noise-Gate/RNNoise together (genuinely the same time window,
directly comparable), then Phase 2 opens a fresh `getUserMedia` call with
`echoCancellation/noiseSuppression/autoGainControl: true` for the Browser-NS
reference — recorded separately, with the UI saying so.

The **Spectral/DSP** mode is derived offline, after Stop, from Phase 1's
Original buffer — frame-based FFT processing isn't run live in this PoC.

## How PCM is obtained

Web Audio always delivers samples as 32-bit floats in the range -1..1,
regardless of the microphone hardware's native ADC bit depth (commonly 16- or
24-bit integer PCM) — that conversion happens below the Web Audio API and isn't
exposed to JS. The debug panel reports `MediaStreamTrack.getSettings().sampleSize`
where the browser provides it, and is explicit when it doesn't. The "PCM
samples" preview scales the live Float32 values to an int16-equivalent range
(`value * 32767`) purely for a familiar display — it's a display conversion, not
the wire format.

## How each processing approach works

- **High-Pass Filter** — RBJ Audio EQ Cookbook Butterworth biquad; cutoff is a
  k-rate `AudioParam`, coefficients recompute only when it changes. Zero added
  latency (single-sample IIR).
- **Noise Gate** — one-pole envelope follower (`exp(-1/(T_sec * sampleRate))`)
  with independent attack/release time constants, plus separately-smoothed gate
  gain to avoid zipper/click artifacts at the gate boundary.
- **RNNoise** — a small recurrent neural network trained for voice-band noise
  suppression, running as WASM in an AudioWorklet; needs a 48kHz context and
  processes internally in fixed 480-sample (10ms) frames — that's the only
  real, disclosable added latency in this demo.
- **Spectral Subtraction (offline)** — classic Boll (1979): FFT (1024,
  75%-overlap Hann-windowed frames), average magnitude spectrum of the first
  ~400ms as a noise profile, subtract with oversubtraction + a spectral floor
  (avoids "musical noise"), reuse the noisy phase, inverse-FFT, overlap-add.

## How to run

```
pnpm install
pnpm dev
```

Open the printed localhost URL in Chrome, grant mic permission, click **Start
Recording**.

## Known browser limitations

- Mic echo-cancellation/noise-suppression/AGC constraints are negotiated at the
  shared hardware/APM layer, not per track — see "two passes" above.
- The `AudioContext({sampleRate: 48000})` constructor option is a hint; some
  hardware won't honor it. RNNoise disables itself (with a visible stub panel)
  if the actual context isn't exactly 48000Hz.
- There is no Web Audio API to measure true OS-level CPU% or true mic-to-app
  input latency; the comparison table's "Load" column is a `performance.now()`-based
  proxy (worklet processing time as % of the render-quantum budget), clearly
  labeled approximate, and cells the API genuinely can't measure are `N/A`.
- `AudioWorklet` requires a secure context (HTTPS, or `localhost` in dev).

## What we should NOT conclude from this PoC

- No WER (word-error-rate) numbers were measured — "does it sound cleaner"
  is not the same as "does it transcribe better."
- This is a small, informal listening test on one machine/mic — not a
  statistically meaningful comparison across devices, rooms, or speakers.
- It says nothing about how any of this interacts with Sarvam's actual STT
  pipeline — that needs a real end-to-end test, not this demo.
- Nothing here is production-ready: no error recovery beyond basic try/catch,
  no persistence, no multi-user support, no accessibility pass.
