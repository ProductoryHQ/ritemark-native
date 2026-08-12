# A1 — Audio preparation and transfer audit

**Blocks:** R5 (and, indirectly, the whole local-engine path)
**Date:** 2026-08-12 · Apple M4 Pro, macOS 25.5
**Verdict: SHIP — and the original problem does not exist.**

## The question

The plan assumed the on-device engine needs 16 kHz mono WAV, that the webview would have to decode it, and that ~115 MB of PCM would then have to cross the webview→host bridge in chunks. That transfer was the sprint's top technical risk.

## What was tested

Fixtures generated with macOS `say` (see `make-fixtures.sh` in the session scratchpad — synthetic speech, so **no accuracy conclusions may be drawn from these files**; they exist to measure throughput and I/O):

| Fixture | Duration | Size |
|---|---|---|
| `short-2spk.m4a` | 1 min 53 s | 1.4 MB |
| `long-meeting.m4a` | 60 min 34 s | 44 MB |
| `mono-lecture.mp3` | 22 s | 265 KB |

## Finding 1 — whisper-cli reads compressed audio natively

The bundled binary's own help text says: `supported audio formats: flac, mp3, ogg, wav`.

Verified by running the bundled `binaries/darwin-arm64/whisper-cli` directly:

| Input | Result |
|---|---|
| `.mp3` | Transcribed correctly, no conversion |
| `.wav` (16 kHz mono) | Transcribed correctly |
| `.flac` | Transcribed correctly |
| `.ogg` | Not tested — claimed by help text |
| `.m4a` | **Fails**: `error: failed to read audio data as wav` |

So for mp3 / wav / flac / ogg there is **no preparation step at all** — hand the file to whisper-cli.

## Finding 2 — `afconvert` handles m4a in the host, in about a second

`.m4a` (the format iPhone Voice Memos and most recorders produce) still needs conversion. macOS ships `/usr/bin/afconvert`, so no dependency has to be bundled:

```
afconvert -f WAVE -d LEI16@16000 -c 1 input.m4a output.wav
```

| Input | Wall clock | Output |
|---|---|---|
| `short-2spk.m4a` (1 min 53 s) | **0.151 s** | 3.5 MB WAV |
| `long-meeting.m4a` (60 min 34 s) | **1.229 s** | 110 MB WAV |

A 60-minute recording converts in **1.2 seconds**, entirely in the extension host, writing straight to a temp file.

## Consequence

**The webview decode path and the chunked bridge transfer are both cancelled.** Nothing large crosses the bridge; the webview never touches audio bytes for transcription purposes. This removes the sprint's highest-rated technical risk and a whole implementation strategy from `audioPrep.ts`.

`afconvert` being macOS-only costs nothing: the local engine is macOS-only anyway (D4 / #133).

## Changes to the plan

1. **R5 (revised 2026-08-12).** Preparation is host-side. `mp3`/`wav`/`flac`/`ogg` are passed to the engine unchanged; `m4a`/`aac` are converted with `afconvert` to a temp 16 kHz mono WAV, deleted when the job ends. No `decodeAudioData`, no `OfflineAudioContext`, no `transcribe:audioChunk` bridge message.
2. **Technical plan Workstream 1.** `audioPrep.ts` shrinks to: format gate → (optional) `afconvert` spawn → temp-file lifecycle → peak extraction.
3. **Peaks for the waveform** are computed host-side by scanning a 16 kHz mono WAV (produced by the same `afconvert` call for m4a, or a cheap dedicated one for other formats) and downsampling to ~2000 points, stored on the session. Given the 1.2 s conversion cost, this is not a concern.
4. **`transcribe:audioChunk`** is removed from the bridge message list.

## Residual risks

- `.ogg` support is claimed but untested; verify during Phase 1 or drop it from the accepted list.
- `afconvert` on a corrupt file must be checked for its own exit code — do not assume it fails loudly (see A2's exit-code trap).
- Windows has neither `afconvert` nor a local engine, so `m4a` on Windows goes to ElevenLabs, which accepts it directly. No gap.
