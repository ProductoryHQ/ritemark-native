# A2 — whisper-cli long-run audit

**Blocks:** R3 (on-device engine), R2 (progress/cancel), R9 (confidence)
**Date:** 2026-08-12 · Apple M4 Pro, macOS 25.5, `ggml-large-v3-turbo.bin` (1.6 GB)
**Binary:** `extensions/ritemark/binaries/darwin-arm64/whisper-cli`
**Verdict: SHIP.**

## The question

`voiceDictation/whisperCpp.ts` is built for 5-second dictation chunks: `--no-timestamps`, a hard 30-second process timeout, and a hallucination filter for short utterances. What the same binary does on a 60-minute file — output format, progress, memory, cancellation — was unknown.

## Throughput and memory

`long-meeting.mp3`, 60 min 34 s (3 634 s of audio), `-l auto -pp -oj`:

| Measure | Value |
|---|---|
| Wall clock | **154.65 s** |
| Realtime factor | **23.5×** |
| Peak RSS | **2.47 GB** (model is 1.6 GB) |
| Segments produced | 623 (avg 100 chars) |
| Language detection | `en`, p = 0.9998 |
| Exit code | 0 |

A 60-minute meeting transcribes on-device in about two and a half minutes. This is materially faster than assumed when the sprint was scoped, and it makes the local engine a genuinely usable default rather than the "private but slow" option.

Peak RSS of 2.47 GB is worth surfacing in the UI story: on an 8 GB machine, transcription plus a running Ritemark plus a browser will be tight. Not a blocker; note it if users report pressure.

## Output format

`-oj` (`--output-json`) writes a sibling `.json`:

```
{ "result": { "language": "en" },
  "transcription": [
    { "timestamps": { "from": "00:00:00,000", "to": "00:00:04,240" },
      "offsets":    { "from": 0, "to": 4240 },          // milliseconds
      "text": " Today we are looking at why version control matters…" } ] }
```

`-ojf` (`--output-json-full`) adds a `tokens` array per segment:

```
{ "text": " Today", "offsets": { "from": 100, "to": 340 },
  "id": 2692, "p": 0.881785, "t_dtw": -1 }
```

**Use `-ojf`.** Parse `offsets` (ms) rather than the formatted `timestamps` string.

## Finding — the local engine *does* have confidence data

`p` is a per-token probability, and `--print-confidence` exists as a display flag. R9 was specified as ElevenLabs-only on the assumption that on-device transcripts carry no confidence signal. That assumption was wrong.

**R9 is revised (2026-08-12):** low-confidence highlighting works on both engines — `p` on-device, `logprob` from ElevenLabs. Thresholds differ per engine and must be documented separately in code. This makes the private path meaningfully better: you can see where Whisper was unsure even without speaker separation.

## Progress

`-pp` (`--print-progress`) emits to **stderr** — not stdout — in 5 % steps:

```
whisper_print_progress_callback: progress =  65%
```

Note the double-space padding for two-digit values. Parse with `/progress\s*=\s*(\d+)%/`. Twenty progress events were observed across the 60-minute run. Transcript segments go to **stdout**; the two streams must be read separately.

## Exit codes — a trap

| Condition | Exit code |
|---|---|
| Success | 0 |
| Missing input file | 2 |
| Missing model | 3 |
| **File exists but cannot be decoded (e.g. `.m4a`, truncated file)** | **0** |

An undecodable file exits **0** while printing `error: failed to read audio data as wav` to stderr and producing no transcript.

`whisperCpp.ts` today treats `code === 0` as success. The new engine must **not** rely on exit code alone: success requires exit 0 **and** a parseable JSON output file **and** at least one segment. Otherwise a corrupt recording produces a silent empty "successful" transcript.

(Live dictation is not exposed to this today because it always feeds whisper a WAV it just wrote itself. Worth a look in a later sprint, not this one.)

## Cancellation

`SIGTERM` during a long run terminates the process immediately (`Terminated: 15`); `pgrep whisper-cli` shows no orphans afterwards. Standard `child.kill()` is sufficient for R2's cancel path. Temp-file cleanup remains the caller's job.

## Flag set for the new file path

```
-m <model> -f <audio>
-l auto              # detect language; result.language reports it
-ojf                 # segments + per-token p + ms offsets
-of <tmp-basename>   # output path (extension appended)
-pp                  # progress on stderr, 5% steps
-t <threads>
```

Deliberately **not** carried over from dictation: `--no-timestamps` (we need timestamps), the 30-second timeout (removed entirely), `--max-len 0`, and the short-utterance hallucination filter — which is tuned for 5-second chunks and would be wrong here.

## Fixture caveat

Fixtures are macOS `say` synthesis, and `long-meeting.mp3` is a ~2-minute dialogue looped ~32× to reach an hour. Throughput, memory, progress, exit-code and cancellation results are valid. **Accuracy, diarization quality and hallucination behaviour are not measurable from these files** — they need a real recording, which is Jarmo's Phase 7 job, not a synthetic fixture's.
