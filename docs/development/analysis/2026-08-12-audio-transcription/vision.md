# Audio Transcription in Ritemark — Product Vision

**Date:** 2026-08-12
**Status:** Vision draft — awaiting Jarmo's prototype selection (no sprint created, no code written)
**Author:** Claude (product)
**Working name:** **Transcribe** (activity-bar app)
**Target release:** not v1.9.0 (reserved for Cloud) — proposed v1.10.0
**Sprint number:** to be assigned when the queue reaches it (102–106 queued, 107 approved-on-hold)

---

## 1. The problem, stated as it actually happens

Jarmo records client meetings, interviews and workshops. To turn a recording into something he can work with, today he:

1. uploads the audio to OneDrive,
2. lets Microsoft Word transcribe it,
3. hand-converts Word's output into markdown,
4. brings the markdown back into Ritemark,
5. and only then does the actual work — the memo, the decisions, the follow-ups.

Steps 1–4 are pure tax. They cost time, they scatter the material across three apps, and step 1 means **client-confidential audio is uploaded to a third party by default**, with no decision point where that choice is made deliberately.

Ritemark already owns steps 5 and beyond. It has a Whisper stack (live dictation), AI runtimes, Flows, and a markdown editor. What it lacks is the front half: **audio goes in, structured markdown comes out, without leaving the app.**

## 2. Who this is for

| Persona | What they record | What they need out of it |
|---|---|---|
| **Consultant** (Jarmo's own case) | Client calls, workshops, discovery sessions | A written record with speakers named, decisions and actions extracted, a memo they can send |
| **Researcher / interviewer** | 1:1 interviews, focus groups | Accurate quotes attributed to the right person, timestamps to verify, ability to fix names and jargon |
| **Product / engineering lead** | Team meetings, design reviews | Action items and open questions; the transcript itself is disposable |
| **Student / lecture attendee** | Lectures, talks | Clean readable notes, not a raw transcript wall |

Common thread: **the transcript is raw material, not the deliverable.** The deliverable is a markdown document a person is willing to send to somebody else. Any design that stops at "here is your transcript" only solves half the job.

## 3. Jobs to be done (the needs, precisely)

- **N1 — Get text out of audio without leaving the app.** Drop a file, get a transcript. No browser, no OneDrive, no re-formatting.
- **N2 — Decide where the audio goes.** Private (on-device, nothing leaves the machine) vs. best quality (cloud API). The user makes that call per recording, knowingly, and can see which was used afterwards.
- **N3 — Know who said what.** Interviews and meetings are useless as a wall of undifferentiated text. Speaker labels, and the ability to rename `Speaker 1` → `Kadri` once and have it apply everywhere.
- **N4 — Trust it.** Jump to the audio at a given line to check a quote. Fix mis-heard names, product terms, Estonian/English code-switching.
- **N5 — Get to the deliverable.** Summary, decisions, action items, key quotes, open questions — as markdown, in the workspace, editable in Ritemark.
- **N6 — Keep working while it runs.** A 90-minute recording is a background job with visible progress, not a modal that freezes the app.
- **N7 — Not be surprised by cost.** If a cloud engine is used, show the estimated cost before the upload, not on the invoice.

## 4. Hard constraints (these shape the product, not just the build)

These are grounded in the current codebase and the two engines' actual capabilities. They are not negotiable by design preference.

**C1 — Local Whisper is macOS arm64 only.**
`getWhisperBinaryPath()` throws on anything but `darwin-arm64`; only `binaries/darwin-arm64/whisper-cli` ships, and the `voice-dictation` flag is `platforms: ['darwin']`. On Windows there is **no local engine today** (tracked as [#133](https://github.com/ProductoryHQ/ritemark-native/issues/133)). So on Windows, Transcribe is ElevenLabs-only unless we also ship a Windows whisper build. The UI must state this honestly rather than showing a disabled control with no explanation.

**C2 — Local Whisper cannot do real speaker diarization. ElevenLabs can.**
whisper.cpp offers only `-tdrz` (tinydiarize: experimental, English-only, `small.en` model, marks speaker *changes* — not identities) and a stereo-channel split. Neither is real diarization. ElevenLabs Scribe does proper diarization with per-word `speaker_id`, up to 32 speakers.
**This is the single most important product fact:** *private* and *knows who spoke* are, today, mutually exclusive. The product must present this as an explicit, understandable trade — not hide it behind a settings toggle.
Middle path worth testing: local transcript + an LLM pass that *guesses* speaker turns from content. It is a heuristic, it will be wrong sometimes, and it must be labelled as a guess if we ship it.

**C3 — The existing Whisper wrapper cannot be reused as-is.**
`whisperCpp.ts` is built for live dictation: 5-second chunks, `--no-timestamps`, a hard **30-second process timeout**, and a hallucination filter tuned for short utterances. File transcription needs the opposite: timestamps on, no timeout, progress reporting, cancellation, and segment output. This is a sibling code path, not a parameter change.

**C4 — Audio decoding is an unsolved dependency.**
whisper-cli needs 16 kHz mono WAV. Users will drop `.m4a`, `.mp3`, `.mp4`, `.mov`. Two options: (a) decode in the webview with `AudioContext.decodeAudioData` + resample — no new native dependency, covers mp3/m4a/wav/flac/ogg, but **fails on video containers**; (b) bundle ffmpeg — covers everything including video, but adds tens of MB to the app and a new signing/notarization surface (see the agent-binary signing landmine). Recommendation: (a) for v1, with a clear "video not supported yet" message; revisit (b) if users actually drop video.

**C5 — Cloud engine means money and data leaving the machine.**
ElevenLabs Scribe: `POST /v1/speech-to-text`, ~$0.22/hour, up to 5 GB / ~10 h files, async via webhook for long jobs. The key lives in VS Code SecretStorage — but `apiKeyManager.ts` is currently **OpenAI-specific** (single `API_KEY_ID` secret). It needs a second slot plus a Settings row before this feature can exist.

**C6 — Long jobs must survive the UI.** A 90-minute file is minutes of compute locally. Jobs must persist across sidebar close and (ideally) across app restart, with resumable or at least honestly-failed state.

**C7 — Artifacts belong in the workspace.** Ritemark is a file-first app. A transcript should be a real `.md` file in the user's folder, not a record in a hidden database. The audio file should be referenced where it already lives, not copied — unless the user asks for a self-contained session folder.

## 5. Flows

### F1 — First run (no engine ready)
User opens **Transcribe** for the first time. The panel does not show an empty file list; it shows the two engines and their real state:
- *On-device (Whisper)* — "Model not downloaded · 1.5 GB" → **Download model**. On Windows: "Not available on Windows yet" with a link to #133.
- *ElevenLabs Scribe* — "API key not set" → **Add key** (opens Settings).
Choosing neither is a valid state; the user leaves and comes back.

### F2 — Transcribe locally (private path)
Drag a file onto the panel (or **Add recording**). The app shows: file name, duration, detected/selected language, engine = On-device, estimated time, and **no speaker labels** stated up front. Start → job appears with progress. Result: a `.md` file in the workspace, opened in the editor.

### F3 — Transcribe with ElevenLabs (speakers path)
Same entry. Engine = ElevenLabs, so the confirm step additionally shows: **"This uploads 47 min of audio to ElevenLabs. Estimated cost $0.17."** and the diarization options (auto-detect speakers / expected count). Start → upload with progress → transcript with `Speaker 1..n`.

### F4 — Review and correct
Rename `Speaker 1` → real name once, applied to every occurrence. Fix mis-heard terms. Click a line to hear the audio at that point (the trust mechanism for N4). Confidence-flagged low-certainty spans (ElevenLabs returns `logprob` per word).

### F5 — Insights
On a finished transcript, run one or more recipes: **Summary**, **Decisions**, **Action items**, **Key quotes**, **Open questions**, **Meeting memo**. Output is markdown appended to the document or written as a sibling file. Implemented on the existing AI runtime + Flows machinery — not a new AI stack.

### F6 — Handoff
The transcript is a normal Ritemark document from here: edit it, ask the AI sidebar about it, export to PDF/DOCX, (later) share it via Cloud.

### F7 — Interrupted job
Close the panel → the job keeps running, the activity-bar badge shows progress. Quit the app mid-job → on restart the job is shown as interrupted with a **Resume** or **Discard** choice; it never silently disappears.

### F8 — Failure paths (each needs designed copy, not a toast with an error code)
No engine available on this platform · no API key · offline with cloud engine selected (the connectivity policy already exists) · unsupported/video file · file longer than the engine allows · API error or quota · not enough disk space for the 1.5 GB model · corrupted audio.

## 6. Scope proposal

**Phase 1 — "Audio in, markdown out"** (the sprint we would actually plan first)
File-transcription pipeline separate from dictation; both engines behind one `TranscriptionEngine` interface; ElevenLabs key in SecretStorage + Settings row; activity-bar app with job queue, progress, cancel; transcript written as `.md` into the workspace and opened in the editor; honest empty/failure states; no insights, no playback.

**Phase 2 — "Who said what"**
Diarization UX: speaker chips, global rename, per-speaker colouring; audio playback synced to the transcript; low-confidence highlighting.

**Phase 3 — "The deliverable"**
Insight recipes as Flows; templates (meeting memo, interview notes, lecture notes); batch import of multiple files.

**Explicitly out of scope for now:** live meeting capture / system-audio recording, real-time streaming transcription, translation, cloud storage of transcripts, team sharing of recordings, Windows local Whisper (separate issue #133).

## 7. Architecture note (needs the Sprint Architecture Gate)

Recommendation: introduce `src/speech/` with a `TranscriptionEngine` interface and a registry, mirroring the existing `AgentRuntime` pattern — `engines/whisperLocal.ts`, `engines/elevenLabs.ts`, plus a `TranscriptionJobManager` for queue/persistence. Live dictation stays where it is but eventually consumes the same local engine, so there is one Whisper integration, not two.

Open architectural questions for the gate: does the engine registry belong in `ai/modelConfig.ts` (the locked "single registry" rule is written for **LLM model IDs**, and STT engines are runtimes rather than models — I believe it needs its own registry, but that is a decision, not an assumption); does the job store live in `globalState` or a workspace file; is the transcript format plain `.md` or a session folder with sidecar JSON.

## 8. Decisions I need from you

| # | Decision | Options | My recommendation |
|---|---|---|---|
| **D1** | **Which UI shape** — this is the one that unblocks everything | Prototype A / B / C (see below) | **A now, B as Phase 2** — but this is genuinely your call |
| **D2** | Diarization on the private path | Ship local without speakers · add an LLM guess labelled as a guess · make speakers ElevenLabs-only | Local without speakers in Phase 1; revisit after you've used it |
| **D3** | Video files (`.mp4`, `.mov`) | Bundle ffmpeg · audio-only for now | Audio-only for v1 — ffmpeg is a signing/notarization surface we don't need yet |
| **D4** | Where transcripts land | Beside the audio file · a `Transcripts/` folder in the workspace · ask each time | Beside the audio, overridable in Settings |
| **D5** | Windows at launch | ElevenLabs-only on Windows · hold the feature until #133 · ship mac-first | ElevenLabs-only on Windows, stated plainly in the UI |
| **D6** | Default engine when both are available | Always ask · remember last choice · default to on-device | Default on-device, remember the last choice per workspace |

## 9. Prototypes

Three genuinely different product shapes, not three skins. Open `prototypes/index.html` to compare them side by side.

| | **A — Library & Document** | **B — Transcript Workbench** | **C — Recipe Pipeline** |
|---|---|---|---|
| **Bet** | The transcript is just another document; Ritemark already handles documents | Transcription deserves a real editor surface of its own | Nobody wants a transcript; they want the memo |
| **Sidebar is** | The job queue + recording library | A thin launcher | The whole app |
| **Main surface** | The transcript as a normal `.md` file in the editor | A dedicated workbench tab: waveform, speakers, insights rail | The generated memo as `.md`; raw transcript is an appendix |
| **Speakers** | Markdown headings you can find-and-replace | First-class chips with global rename + colour | Resolved by the recipe; user confirms names once |
| **Insights** | The existing AI sidebar, on the open document | A dedicated rail inside the workbench | The point of the product |
| **Playback** | None (open the file in a player) | Synced, click-a-line-to-seek | None |
| **Build weight** | Lightest | Heaviest — new custom editor, audio pipeline, waveform | Medium — leans on the Flows engine |
| **Risk** | Feels like a downloader, not a product | Big surface to get right; competes with dedicated tools | Hides the source; LLM errors become invisible |

---

## What happens next

1. You pick a prototype (or a hybrid) and answer D2–D6.
2. Only then does a sprint get planned — spec, technical plan, tasks, and a branch. No code until you approve the sprint plan.
