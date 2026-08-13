# Sprint 108 Tasks

Status here is the source of truth for "what is done" — but only when it agrees with the code. Do not pre-tick: before `[x]`, the change must exist on `sprint-108-transcription-workbench`.

## Phase 0: Audits — COMPLETE (2026-08-12)

- [x] Produce fixtures: `short-2spk.m4a` (1:53), `long-meeting.m4a` (60:34), `mono-lecture.mp3`, `broken.m4a`, `screen-recording.mp4` — generated with macOS `say` + ffmpeg via `make-fixtures.sh` (session scratchpad; not committed — synthetic speech, valid for throughput/IO only)
- [x] `research/audio-transfer-audit.md` (A1) — **transfer problem eliminated**: native mp3/wav/flac/ogg support + `afconvert` for m4a (1.2 s / 60 min)
- [x] `research/whisper-longrun-audit.md` (A2) — 23.5× realtime, 2.47 GB peak, `-ojf` + `-pp` flag set fixed, clean SIGTERM, **exit-0-on-undecodable trap** documented
- [x] `research/webview-audio-audit.md` (A3) — playback + seek verified live via CDP; 223 ms seek to 45:00 in a 42 MB file, range requests served; user-gesture rule recorded
- [x] `research/elevenlabs-prior-art.md` — Scribe integration reviewed in `productory-videomark`; `xi-api-key`, no-windowing decision, majority-vote speaker folding
- [x] **Gate: passed** — no re-scope needed; spec R4/R5/R7/R9 revised and technical plan updated to match

## Phase 0b: Fixture follow-up — COMPLETE (2026-08-12)

- [x] `.ogg` decodes natively through the bundled binary — stays in the accepted list
- [x] `afconvert` fails loudly on a corrupt m4a (exit 1, no output file) — it does *not* share whisper-cli's exit-0 trap

## Phase 1: Engine abstraction and job pipeline (R2, R3, R4) — COMPLETE (2026-08-12)

- [x] `src/speech/types.ts` — session, segment, word, speaker, job-state types; seconds everywhere; `TranscriptionError` with user-facing codes
- [x] `src/speech/TranscriptionEngine.ts` — interface + capability shape, mirroring `runtime/AgentRuntime.ts`
- [x] `src/speech/engineRegistry.ts` — registration, platform filtering, readiness, local-first preference
- [x] `src/speech/engines/whisperLocalEngine.ts` — A2 flag set (`-ojf -pp -l auto`, no timeout), stderr progress parsing, SIGTERM cancel, **success judged on parsed output not exit code**
- [x] `src/speech/engines/elevenLabsEngine.ts` — streamed multipart with real upload progress, `xi-api-key`, `diarize`, one request (no windowing), `logprob` → 0..1 confidence, typed error mapping
- [x] `src/speech/segmentFolding.ts` — majority-vote speaker, speaker-change break, breath break, runaway guard *(not in the original plan; extracted so the folding rules are testable without a network call)*
- [x] `src/speech/audioPrep.ts` — format gate, `afconvert` for m4a/aac, pass-through otherwise, streaming peak extraction with proper RIFF chunk walking
- [x] `src/speech/JobManager.ts` — single-flight queue, state machine, progress events, cancel + temp cleanup, in-flight persistence for interrupted-job recovery
- [x] `src/speech/SessionStore.ts` — file-backed globalStorage CRUD, fingerprint keying, relink, delete, size accounting
- [x] `src/speech/transcriptMarkdown.ts` — session → markdown writer
- [x] Unit tests — 7 files, all passing: folding, engine parsing, audio prep, markdown, session store, registry, job manager
- [x] Registered the new tests in `package.json` **ahead of the first pre-existing failure**, so they actually run under `npm test`
- [x] `tsc --noEmit` clean
- [x] Commit Workstream 1

### Found during Phase 1

- **Bug caught in review, fixed + regression-tested:** `JobManager.pump()` reused the enqueue call's request for every queued job, so a second recording would have transcribed in the first one's language. Each job now carries its own request.
- **Pre-existing, out of scope:** `npm test` short-circuits at test 31 of 68 (`SaveFileNodeExecutor.integration.test.ts` needs the `vscode` module). Running each independently: **65 pass, 3 fail** — that one, `ClaudeCodeNodeExecutor.integration.test.ts` (same cause) and `daemon/workspaceConsent.test.ts` (top-level await under CJS). Not introduced by this sprint; flagged separately.
- **Waveform peaks are macOS-only** (they come from `afconvert`). Phase 4 needs a plain seek-bar fallback on Windows.

## Phase 2: Settings, keys, flag (R4, R13) — COMPLETE (2026-08-12)

- [x] `features/flags.ts` — `transcription-workbench` (`stable`, `['darwin','win32']` — broader than `voice-dictation` on purpose)
- [x] `RitemarkSettingsProvider.ts` — `elevenlabs-api-key` read + payload fields; **storage needed no change**, the `setApiKey` handler was already generic on `message.key`
- [x] `testElevenLabsKey` — authenticated `GET /v1/user`, so a bad key is caught in Settings rather than halfway through a 44 MB upload
- [x] `RitemarkSettings.tsx` — ElevenLabs card appended to the existing API Keys section, copied structurally from the OpenRouter card. Purely additive; no restructure
- [x] Transcription data row (size + **Clear**) under Component readiness, with a modal confirm that names what is and is not deleted
- [x] `src/speech/paths.ts` — one definition of the session directory, shared by Settings and the pipeline
- [x] Unit test: flag platform gating, incl. a guard that it never silently matches `voice-dictation`'s macOS-only list
- [x] Verified live in dev mode via CDP: both surfaces render, `Clear` correctly disabled when empty, rest of the page intact
- [x] `tsc` clean (host + webview), webview bundle rebuilt, `pre-commit-validator.sh` green
- [x] Commit Workstream 2

### Found during Phase 2

- **Verification caught a false pass.** After the first build the card did not appear: `tsc --noEmit` and the webview build had both run, but the extension host bundle had not — `npm run compile` is what emits `out/extension.js`. The old host never sent `transcriptionEnabled`, so the flag-gated card silently stayed hidden. Same shape as the known `build-prod.sh` trap: type-checking is not compiling.
- Copy fix after reading it on screen: the empty state read "Nothing stored yet — stored transcripts, speaker names and corrections." Now the whole sentence is chosen per state.

## Phase 3: Transcribe activity-bar app (R1, R13) — COMPLETE (2026-08-12)

- [x] `media/transcribe-icon.svg` — audio-lines mark, phosphor-weight, matching the existing set
- [x] `package.json` — `ritemark-transcribe` container + `ritemark.transcribeView`
- [x] `src/views/TranscribeViewProvider.ts` — import/staging, engine state, job subscription, activity-bar badge
- [x] `src/speech/durationProbe.ts` + test — `afinfo` then WAV header; returns **null** rather than inventing a length for a cost estimate
- [x] `src/speech/index.ts` — one factory for registry + jobs + store, called from `extension.ts`
- [x] `extension.ts` — registered behind the flag; `recoverInterrupted()` runs on activation
- [x] `webview/src/main.tsx` — lazy route for `transcribe-panel`
- [x] `components/transcribe/TranscribePanel.tsx` + `types.ts` — drop zone, pending-import engine chooser, job rows, library rows, first-run cards. shadcn `Button` throughout
- [x] First-run state, engine cards with real state, Windows path links #133
- [x] Drag-and-drop and file-picker import; video/unsupported refusal copy
- [x] Commit Workstream 3

### Verified live in dev mode (CDP)

- Drop `long-meeting.m4a` → duration probed as **1 h 1 min**, engine choices with cost, on-device marked Free/private, ElevenLabs correctly disabled with "No API key — needed for speaker separation"
- Full transcription of `short-2spk.m4a` → job row → Library. Session on disk: **38 segments, 2002 peaks, 372 words with confidence** (min 0.115 — R9 has real on-device data, confirming A2 in production), `speakerSeparation: 'none'`, `speakers: []` — no invented speakers
- Video drop → "Video files are not supported yet. Export the audio track…"

### Found during Phase 3

- **Upstream VS Code bug — activity-bar badge cannot be cleared with `undefined`.** `WebviewViewPane.updateBadge` stores the new badge then registers an activity only `if (badge)`; it never clears the previous activity, so a finished job left "1 transcribing" on the icon permanently. Worked around by assigning `{ value: 0 }`, which the renderer hides via its `if (total > 0)` check. **Deliberately not patched:** `patches/` is shell-tier, so a three-line upstream fix would turn this sprint into a full app rebuild + notarization for a cosmetic badge. Worth revisiting if a shell release happens for other reasons.
- **Finder drag-and-drop cannot be supported.** Electron no longer exposes a filesystem path for files dragged from Finder, so that case shows "Use Add recording to pick it instead" rather than failing silently. Dragging from the VS Code Explorer works (uri-list).
- `Icon` only accepts sizes 12/14/16/20 — caught by the type-checker, not at runtime.

## Phase 4: Workbench, playback, speakers, confidence (R6–R9) — COMPLETE (2026-08-12)

- [x] **Click-and-listen confirmed.** A real CDP `Input` click on Play (a genuine user gesture, unlike `element.click()`) produced `paused: false`, `currentTime` advancing, `readyState: 4`, `volume: 1`, `muted: false`, no media error. The last A3 unknown is closed.
- [x] **Priority contest won.** Opening `mono-lecture.mp3` gave the **Transcript** editor with our `<audio>` element, not the built-in `vscode.audioPreview`. `priority: "default"` outranks `builtin` as expected — no patch, no stripping of `media-preview` needed.
- [x] `src/transcriptWorkbenchProvider.ts` — `CustomReadonlyEditorProvider` over the audio file; never reads the file into memory (the webview streams it by URI); `localResourceRoots` includes the recording's folder
- [x] `package.json` — custom editor for `.m4a .mp3 .wav .flac .ogg .aac` at `priority: "default"`
- [x] `webview/src/main.tsx` — lazy `transcript-workbench` route
- [x] `Workbench.tsx` — player, speaker bar, transcript; no-session state offers to transcribe with the same honest engine choice; running-job state shows progress
- [x] Player — play/pause, clock, 1×/1.25×/1.5×/2×, seek. **Never auto-plays** (A3's user-gesture rule)
- [x] `Waveform.tsx` — canvas from stored peaks, click-to-seek, no library added. Falls back to a plain seek bar where there are no peaks (Windows)
- [x] Transcript — click-to-seek-and-play, active highlight, auto-scroll that yields on manual scroll, space/←/→ keys
- [x] Speaker chips, stable palette, rename popover stating the affected segment count, persisted host-side
- [x] On-device "cannot separate speakers" row + **Re-run with ElevenLabs**
- [x] Confidence marking on both engines, per-engine thresholds documented in code, absent when an engine reports nothing
- [x] Unit tests — `playback.test.ts`: active-segment selection (incl. gaps), speaker palette, thresholds, clock, peak resampling
- [x] Commit Workstream 4

### Found during Phase 4

- **Bug caught by looking at the screenshot, not by any test:** whisper's timestamp tokens (`[_TT_212]`) were leaking into the word list and, carrying low probabilities, being painted amber — so the transcript read `software.[_TT_212]` with an "uncertain" mark. The special-token filter required a trailing `_` (`[_BEG_]`, `[_EOT_]`) and timestamp tokens end in a digit. Fixed, regression-tested, and re-verified end to end: 0 tokens leaking, and low-confidence marks dropped from 5 bogus to **1 genuine** word. The segment `text` field was always clean, which is why nothing upstream noticed.
- The icon pack has no pause glyph; a `minus` reads as "remove", so pause is two bars.

### Not verified live

- **Diarized UI** — speaker chips, colours, and global rename — has no ElevenLabs key on this machine, so it is covered by unit tests and the host-side rename path only. Needs a real diarized recording at QA (Jarmo's key).

## Phase 5: Insights rail (R10)

- [ ] `src/speech/insights.ts` — prompts, existing runtime, model ids from `ai/modelConfig.ts`, timestamp→segment resolution, cancellable
- [ ] `InsightsRail.tsx` — cards, generated-content label naming the model, timestamp seek buttons, generating/failed/no-runtime states
- [ ] Persist insights on the session
- [ ] Unit test: timestamp resolution incl. unresolvable items dropped
- [ ] Commit Workstream 5

## Phase 6: Export and sessions (R11, R12)

- [ ] Export command — target resolution (setting, default `Transcripts/`), write, open in Ritemark editor
- [ ] Auto-export on completion (D5 mitigation)
- [ ] Overwrite confirmation / numbered sibling
- [ ] Relink flow for moved audio; delete that leaves audio and exports untouched
- [ ] Unit tests: markdown shape with renames, target-path resolution incl. no workspace open
- [ ] Commit Workstream 6

## Phase 7: QA and closeout

- [ ] Run the full `scenarios.md` matrix in dev mode (`/rundev`) with the real fixtures, including the 60-minute file — Claude drives it before Jarmo is told it is ready
- [ ] Walk every `[x]` above and confirm the matching code is on the branch (`git diff main...HEAD`)
- [ ] Windows pass: ElevenLabs end-to-end + on-device unavailability message
- [ ] Report webview bundle size against the #107 baseline
- [ ] `npm run compile` + webview `npm run build`; focused unit tests green
- [ ] `.claude/hooks/pre-commit-validator.sh` green; `qa-validator` review
- [ ] Update `docs/development/architecture.md` — new `src/speech/` subsystem, new editor surface, TO-BE note on collapsing dictation onto the same engine
- [ ] Update `docs/CHANGELOG.md` and release notes
- [ ] Update linked GitHub issues; open a follow-up issue for Windows local Whisper if #133 needs re-scoping
- [ ] Open PR, `pr-reviewer` review, merge
