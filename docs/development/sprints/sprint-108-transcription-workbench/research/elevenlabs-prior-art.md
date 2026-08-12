# ElevenLabs Scribe — prior art from `productory-videomark`

**Relates to:** R4 (ElevenLabs engine), R2 (progress), R8 (speakers)
**Date:** 2026-08-12
**Source:** `~/Projects/productory-videomark/src/server/transcribe.ts` (801 lines) — a working, shipped Scribe integration with diarization, pointed out by Jarmo mid-Phase-0.
**Verdict: reuse the shapes, change one decision.**

This is not a dependency and nothing is copied wholesale — videomark builds *subtitles*, we build *transcripts*, and the difference changes the segmentation rules. But it has already paid for several lessons.

## What transfers directly

### The request

```ts
const form = new FormData();
form.append("file", new Blob([audio], { type: "audio/mpeg" }), basename);
form.append("model_id", "scribe_v2");
form.append("language_code", language);
form.append("timestamps_granularity", "word");
form.append("diarize", "true");

await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
  method: "POST", signal, headers: { "xi-api-key": apiKey }, body: form,
});
```

Two corrections to the technical plan, which assumed the published REST reference:
- Auth is the **`xi-api-key` header**, not a bearer token.
- `fetch` + `FormData` + `Blob` is sufficient — **no multipart assembled by hand, no new dependency**. Node 20/22 in the extension host has all three.

### The error shape

Failures return `{ detail: string | { message: string } }` — both forms occur, and both must be handled before the message reaches the user. videomark distinguishes fatal (bad key, rejected file) from retryable (truncated or malformed answer) and only retries the latter. R4's error mapping should keep that split.

### The response

`body.words[]` — `{ text, start, end, type, speaker_id }` — filtered to `type === "word"` (the array also carries `spacing` and `audio_event` entries).

### Word → segment folding, with the flicker fix

The part worth taking almost verbatim (`groupWords`, lines 453–499). Two lessons that were clearly learned the hard way, both preserved in comments:

1. **A segment's speaker is the majority vote of its words, not the first word's.** Diarization flickers on short interjections; a segment labelled by a one-word "mhm" gets attributed to the wrong person.
2. **A speaker change forces a segment break.** Scribe glues fast exchanges into one segment otherwise, and a two-speaker segment cannot be attributed at all.

There is also a warning worth heeding in `transcribeWindow`: rebuilding segment objects field-by-field instead of spreading is *"how the speaker label silently died between the provider and the cue."* Spread, then override.

## What must change: do not window a diarized request

videomark cuts audio into **300-second windows** and transcribes them in parallel, with the comment: *"Real timestamps mean a window exists only to move the progress bar."* For subtitles that is free.

For a meeting transcript it is not. **`speaker_id` is assigned per request.** A 60-minute meeting cut into twelve windows comes back with twelve independent numbering schemes — the person who is `speaker_0` in window 1 may be `speaker_1` in window 2. Global speaker rename (R8) becomes impossible, and the transcript would attribute the same voice to different people at arbitrary boundaries.

**Decision:** Sprint 108 sends **one request for the whole file**. Scribe accepts up to 5 GB / ~10 hours, so a meeting always fits.

The cost is progress reporting. R2/R4 acceptance criteria change accordingly:

- **Upload phase** — real byte progress, which for a 44 MB file on a normal connection is the visible part.
- **Processing phase** — no server-side progress on the sync endpoint. Show an indeterminate "Transcribing…" state with elapsed time, not a fake percentage.
- Cancellation stays exact via `AbortSignal`.

If an honest percentage during processing turns out to matter, the answer is ElevenLabs' async/webhook mode (`webhook: true` → `202` + `request_id`), not windowing. That is a follow-up, not this sprint.

## Segmentation thresholds differ

videomark's `MAX_WORDS = 12` / `MAX_CHARS = 90` / `BREATH_SECONDS = 0.6` exist because a subtitle must be readable in two lines. A transcript wants paragraph-shaped turns.

Sprint 108 keeps the **breath break** and the **speaker-change break**, drops the word/char caps, and adds a maximum turn length only as a runaway guard. Values to be tuned against a real recording, then documented in code.

## Not carried over

- The multi-provider fallback chain (Gemini / OpenAI). Ritemark's fallback is the on-device engine, chosen by the user rather than silently.
- `fitToWindow` / `squeeze` timestamp repair — only needed for LLM-estimated timestamps. Scribe's are measured, and so are Whisper's.
- `findPauses` via ffmpeg — we have no ffmpeg (D6) and no windowing, so no pause planning is needed.
