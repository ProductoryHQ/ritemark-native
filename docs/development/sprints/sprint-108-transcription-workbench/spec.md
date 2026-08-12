# Sprint 108 Spec — Transcription Workbench

## Purpose

Turn a recording into a corrected, speaker-attributed transcript and then into markdown, entirely inside Ritemark. The user chooses per recording whether the audio stays on their machine (Whisper) or goes to ElevenLabs Scribe for real speaker separation — and the app makes that trade legible instead of hiding it.

## Principles

- **The trade is visible.** Private and "knows who spoke" are mutually exclusive today. Every surface that offers a choice states what is given up.
- **Never fabricate attribution.** If the engine cannot tell speakers apart, the transcript says so. No guessed speakers.
- **The user can verify.** Any line can be played back. Any insight cites a timestamp that seeks the audio.
- **Nothing is trapped.** Sessions live in app storage (D5), so a markdown export is written automatically — the user's work is always also a file they own.
- **Failures are designed.** No engine, no key, offline, video file, no disk space: each has copy and a next action.

---

## Requirements

### R1: Transcribe activity-bar app

As someone with a folder of recordings, I want a Transcribe item in the activity bar that lists my recordings and their state, so I can start a transcription and see what is running.

Acceptance criteria:
- A new activity-bar container `ritemark-transcribe` with a webview view, alongside Home / Agent Library / Browser.
- **Add recording** opens a file picker; the panel also accepts drag-and-drop of an audio file.
- Recordings are grouped: **Open** (currently in a workbench tab), **Transcribing** (with percent and time remaining), **Library** (finished), **Not transcribed**.
- A running job shows a progress badge on the activity-bar icon.
- Each row shows duration and, when finished, the engine used and speaker count.

### R2: Job pipeline with persistence

As someone transcribing a 90-minute recording, I want to keep working while it runs and not lose it if I close the panel, so transcription is a background job and not a modal.

Acceptance criteria:
- A job manager runs transcription jobs independent of any webview; closing the Transcribe panel or the workbench tab does not cancel a job.
- Job state (queued, preparing, transcribing, drafting, done, failed, cancelled) is observable from both the panel and the workbench.
- **Cancel** stops the job, terminates any child process, and removes temp files.
- Jobs are persisted; after an app restart an unfinished job is shown as **Interrupted** with **Retry** and **Discard**. It is never silently dropped.
- One job runs at a time; further imports queue.

### R3: On-device Whisper file engine (macOS)

As someone with confidential client audio, I want to transcribe on my own machine, so the audio never leaves it.

Acceptance criteria:
- A file-transcription code path separate from live dictation: timestamps **on**, no fixed process timeout, progress reported while running, cancellable.
- Output is timestamped segments, not one text blob.
- Model download reuses the existing `voiceDictation/modelManager.ts` (`ggml-large-v3-turbo`, ~1.5 GB, stored in `~/.ritemark/models`); the panel offers **Download model** when it is missing, with progress and a resumable partial download.
- The resulting session is marked `speakerSeparation: 'none'`; the workbench states "On-device — no speaker separation" and offers **Re-run with ElevenLabs**.
- Existing live dictation continues to work unchanged.

### R4: ElevenLabs Scribe engine

As someone transcribing an interview, I want real speaker separation, so I know who said what.

Acceptance criteria:
- `elevenlabs-api-key` is stored in VS Code SecretStorage and configured from Settings, following the existing BYOK key pattern in `RitemarkSettingsProvider`.
- Transcription posts the original audio file to `POST https://api.elevenlabs.io/v1/speech-to-text` with `diarize: true` and word-level timestamps; the response's per-word `speaker_id` is folded into segments.
- Before any upload, a confirm step states **what leaves the machine** (file, duration) and the **estimated cost**, and requires an explicit action to proceed.
- **The whole file goes in one request — never windowed.** (Revised 2026-08-12 after [prior-art review](research/elevenlabs-prior-art.md): `speaker_id` is assigned per request, so splitting a meeting into windows renumbers the speakers at every boundary and makes global rename impossible.)
- Progress is therefore two-phase and honest: **real byte progress during upload**, then an indeterminate "Transcribing…" state with elapsed time during processing. No invented percentage.
- The request is cancellable at any point via `AbortSignal`.
- Detected language, speaker count, engine and estimated cost are recorded on the session and shown in the workbench header.
- API errors (401, 429, quota, 5xx, network drop) map to designed messages with a next action, never a raw status code.

### R5: Audio preparation and peaks

*(revised 2026-08-12 after audit [A1](research/audio-transfer-audit.md) — preparation is host-side; the webview decode and chunked bridge transfer are cancelled.)*

As someone dropping whatever file the recorder produced, I want it to just work, so I don't convert files by hand.

Acceptance criteria:
- Accepted: `.m4a`, `.mp3`, `.wav`, `.flac`, `.ogg`, `.aac`.
- `.mp3`, `.wav`, `.flac`, `.ogg` are passed to the on-device engine **unchanged** — whisper-cli decodes them natively (verified in A1).
- `.m4a` / `.aac` are converted host-side with macOS `afconvert` to a temp 16 kHz mono WAV (measured: 1.2 s for a 60-minute file), deleted when the job ends. No audio bytes cross the webview bridge.
- A low-resolution peak array (~2000 points) is computed **once** at import and stored on the session; the waveform renders from it. No waveform library is added to the bundle.
- Video containers (`.mp4`, `.mov`, `.mkv`, `.webm`) are rejected with: what happened, why, and what to do instead.
- Files that decode to zero-length or unreadable audio fail with a designed message.

### R6: Transcript Workbench editor

As someone reviewing a transcript, I want a purpose-built surface rather than a wall of text, so I can read, correct and attribute speech.

Acceptance criteria:
- A custom editor `ritemark.transcriptWorkbench` registered for the accepted audio extensions; opening an audio file from the Transcribe panel **or from the Explorer** opens the workbench.
- Layout matches the approved prototype: header (title, date, engine, language, speaker count, **Re-run with…**, **Export**), player bar, speaker bar, transcript, insights rail.
- Opening an audio file that has no session offers to transcribe it, choosing an engine.
- The workbench survives tab switching (`retainContextWhenHidden`) and restores scroll position.

### R7: Playback synced to the transcript

As someone about to quote a client, I want to hear the audio at that line, so I can verify it before I send it.

Acceptance criteria:
- Play/pause, current time / total, and a playback-speed control (1×, 1.25×, 1.5×, 2×).
- Clicking a transcript line seeks the audio to that segment's start and plays.
- The currently playing segment is highlighted and auto-scrolls into view; auto-scroll pauses when the user scrolls manually and resumes on the next seek.
- Clicking the waveform seeks to that position.
- Keyboard: space toggles play/pause when the transcript has focus; ←/→ skip 5 s.
- Playback works for the file where it lives — the audio is never copied into app storage.
- **The first play must come from a real user gesture** — no auto-play on open, no play from a programmatically dispatched event. (Audit [A3](research/webview-audio-audit.md): the webview refuses `play()` without one.)

### R8: Speaker chips and global rename

As someone with `Speaker 1` and `Speaker 2` in a transcript, I want to name them once, so the transcript reads like a record of a conversation.

Acceptance criteria:
- A speaker bar lists every detected speaker as a chip with a stable colour, plus an **Unassigned** chip with a count when the engine left segments unattributed.
- Clicking a chip opens a rename field stating how many segments it will affect; confirming renames every occurrence, in the workbench and in any subsequent export.
- Renames persist on the session and survive reopening the tab and restarting the app.
- Speaker colours are stable across sessions for the same session id.
- When `speakerSeparation` is `'none'` (on-device), the speaker bar is replaced by an explanatory row with **Re-run with ElevenLabs** — no fake speaker chips.

### R9: Low-confidence highlighting

*(revised 2026-08-12 after audit [A2](research/whisper-longrun-audit.md) — the on-device engine **does** expose per-token confidence, so this is no longer ElevenLabs-only.)*

As someone whose recordings are full of names and Estonian/English code-switching, I want to see where the engine was unsure, so I know where to look.

Acceptance criteria:
- Words below a documented confidence threshold are highlighted in amber with a dotted underline, on **both** engines — `p` per token from whisper-cli `-ojf`, `logprob` per word from ElevenLabs.
- Thresholds are per-engine, documented in code, and tuned against a real recording.
- The highlight has a tooltip explaining what it means.
- If an engine ever reports no confidence data, highlighting is absent entirely (not empty, not zeroed) and the UI does not imply otherwise.

### R10: Insights rail

As someone who needs a deliverable rather than a transcript, I want the summary, decisions, actions and key quotes on screen, so I can write the memo.

Acceptance criteria:
- The rail offers **Summary**, **Decisions**, **Action items**, **Key quotes**, generated by the existing agent runtime — no new AI stack, model ids from `ai/modelConfig.ts`.
- Every generated item carries a timestamp; clicking it seeks the audio and scrolls the transcript there.
- The rail is explicitly labelled as generated, with the model named.
- Generation is re-runnable and cancellable, and its state (generating / done / failed) is visible.
- Insights are stored on the session and reload with the tab.
- With no agent runtime configured, the rail explains what to configure instead of failing.

### R11: Export to Markdown

As someone who works in markdown, I want the transcript as a file in my workspace, so everything downstream in Ritemark works.

Acceptance criteria:
- **Export to Markdown** writes a `.md` into the workspace containing: front matter (title, date, duration, engine, language, speakers, source audio path), speaker headings with timestamps, and — when generated — the insights.
- The exported file opens in the Ritemark editor immediately after writing.
- **A markdown export is also written automatically when a transcription completes**, so a transcript is never only in app storage (mitigates D5).
- Re-exporting after edits overwrites the previous export only after confirmation, or writes a numbered sibling.
- Default location is configurable; it defaults to a `Transcripts/` folder in the workspace root.

### R12: Session store

As a user, I expect my corrections to still be there tomorrow.

Acceptance criteria:
- Sessions (segments, speakers, renames, insights, peaks, engine metadata) are stored in the extension's global storage, keyed to the audio file's path and content fingerprint.
- Reopening the same audio file restores the session, including renames and insights.
- Moving or renaming the audio file surfaces the session as unlinked rather than silently losing it.
- Deleting a session from the panel removes its stored data and never touches the audio file or an exported `.md`.
- Total store size is visible in Settings with a way to clear it.

### R13: Platform and failure honesty

As a Windows user, or a user with nothing set up yet, I want to understand what I can and cannot do, so I am not staring at a dead button.

Acceptance criteria:
- Feature flag `transcription-workbench`, platforms `['darwin', 'win32']`.
- On Windows the on-device engine card reads "Not available on Windows yet" and links to #133; ElevenLabs works fully.
- With no engine ready, the panel's first-run state shows both engine cards with their real state and a single action each (**Download model** / **Add key**).
- Choosing a cloud engine while offline is refused before upload, using the existing connectivity policy (`ai/connectivityPolicy.ts`).
- Insufficient disk space for the model is detected before the download starts.
- Every failure path in scenarios.md produces a message naming the cause and the next action.

---

## Non-Requirements

- Live meeting capture or system-audio recording
- Real-time / streaming transcription
- Translation, or transcription into a language other than the spoken one
- Video files, and therefore bundling ffmpeg
- Windows on-device Whisper (#133)
- Batch import of multiple files in one action
- Cloud storage, sync, or sharing of recordings and transcripts
- ElevenLabs speaker library / voice fingerprint matching, entity redaction, multi-channel tracks
- Editing the audio itself
- Replacing or changing live voice dictation

## Resolved Questions

| Date | Question | Decision |
|---|---|---|
| 2026-08-12 | Which UI shape? | Option B — Transcript Workbench (Jarmo) |
| 2026-08-12 | Phase the build? | No — one sprint, full scope (Jarmo) |
| 2026-08-12 | Speakers on the private path? | No speakers; state it plainly. No LLM guessing (Jarmo) |
| 2026-08-12 | Windows? | Ships ElevenLabs-only with an honest message (Jarmo) |
| 2026-08-12 | Where does session data live? | Extension global storage; auto-export mitigates the trapped-data risk (Jarmo + R11) |
| 2026-08-12 | Video files? | Rejected with guidance; no ffmpeg (Claude, stated assumption) |
| 2026-08-12 | STT engines in `ai/modelConfig.ts`? | No — engines are runtimes, not LLM models. Own registry in `src/speech/`, mirroring `runtime/`. Confirmed at the Architecture Gate |

## Phase 0 audit outcomes (2026-08-12)

| Audit | Question | Outcome |
|---|---|---|
| [A1](research/audio-transfer-audit.md) | Can a 60-min decoded WAV cross the bridge? | **Moot.** whisper-cli reads mp3/wav/flac/ogg natively; `afconvert` handles m4a host-side in 1.2 s. Webview decode and chunked transfer cancelled. |
| [A2](research/whisper-longrun-audit.md) | whisper-cli on a 60-min file? | **Ship.** 23.5× realtime (154 s for 60 min), 2.47 GB peak RSS, JSON segments with per-token confidence, progress on stderr in 5 % steps, clean SIGTERM. Trap found: undecodable audio exits **0**. |
| [A3](research/webview-audio-audit.md) | Webview `<audio>` playback and seeking? | **Ship.** Seek to 45:00 in a 42 MB file in 223 ms with 2 buffered ranges — range requests are served. No fallback needed. First play needs a user gesture. |
| [Prior art](research/elevenlabs-prior-art.md) | — | A working Scribe integration exists in `productory-videomark`; auth is `xi-api-key`, and its 300 s windowing must **not** be copied (breaks speaker identity). |

## Open Questions

- Confidence thresholds for R9 on each engine — set against a real recording during Phase 4, then documented in code.
- Whether `ritemark.transcriptWorkbench` at `priority: "default"` actually outranks the built-in `vscode.audioPreview` for `mp3`/`wav`/`ogg` — verify in Phase 4 (fallbacks: "Reopen Editor With…", or strip `media-preview` from the build).
- `.ogg` support is claimed by whisper-cli's help text but was not tested; verify in Phase 1 or drop it from the accepted list.
