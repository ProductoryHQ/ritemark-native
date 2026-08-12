# Sprint 108 Tasks

Status here is the source of truth for "what is done" — but only when it agrees with the code. Do not pre-tick: before `[x]`, the change must exist on `sprint-108-transcription-workbench`.

## Phase 0: Audits — COMPLETE (2026-08-12)

- [x] Produce fixtures: `short-2spk.m4a` (1:53), `long-meeting.m4a` (60:34), `mono-lecture.mp3`, `broken.m4a`, `screen-recording.mp4` — generated with macOS `say` + ffmpeg via `make-fixtures.sh` (session scratchpad; not committed — synthetic speech, valid for throughput/IO only)
- [x] `research/audio-transfer-audit.md` (A1) — **transfer problem eliminated**: native mp3/wav/flac/ogg support + `afconvert` for m4a (1.2 s / 60 min)
- [x] `research/whisper-longrun-audit.md` (A2) — 23.5× realtime, 2.47 GB peak, `-ojf` + `-pp` flag set fixed, clean SIGTERM, **exit-0-on-undecodable trap** documented
- [x] `research/webview-audio-audit.md` (A3) — playback + seek verified live via CDP; 223 ms seek to 45:00 in a 42 MB file, range requests served; user-gesture rule recorded
- [x] `research/elevenlabs-prior-art.md` — Scribe integration reviewed in `productory-videomark`; `xi-api-key`, no-windowing decision, majority-vote speaker folding
- [x] **Gate: passed** — no re-scope needed; spec R4/R5/R7/R9 revised and technical plan updated to match

## Phase 0b: Fixture follow-up (carried into Phase 1)

- [ ] Verify `.ogg` actually decodes, or drop it from the accepted format list
- [ ] Confirm `afconvert` fails loudly on a corrupt m4a (do not assume — see the A2 exit-code trap)

## Phase 1: Engine abstraction and job pipeline (R2, R3, R4)

- [ ] `src/speech/types.ts` — session, segment, word, speaker, job-state types
- [ ] `src/speech/TranscriptionEngine.ts` — interface + capability shape
- [ ] `src/speech/engineRegistry.ts` — registration, platform filtering, readiness
- [ ] `src/speech/engines/whisperLocalEngine.ts` — file path with timestamps, progress, no fixed timeout, cancellation (flags from A2)
- [ ] `src/speech/engines/elevenLabsEngine.ts` — multipart upload, `diarize`, word timestamps, `speaker_id` folding, `logprob` capture, typed error mapping
- [ ] `src/speech/audioPrep.ts` — format gate, temp WAV assembly per A1, peak computation and storage
- [ ] `src/speech/JobManager.ts` — queue, state machine, progress events, cancel + cleanup, in-flight persistence for interrupted-job recovery
- [ ] `src/speech/SessionStore.ts` — globalStorage CRUD, fingerprint keying, relink, delete, size accounting
- [ ] `src/speech/transcriptMarkdown.ts` — session → markdown writer
- [ ] Unit tests: markdown writer, word→segment folding, JobManager state machine incl. restart recovery, registry platform filtering, cost estimation
- [ ] Commit Workstream 1

## Phase 2: Settings, keys, flag (R4, R13)

- [ ] `features/flags.ts` — add `transcription-workbench` (`stable`, `['darwin','win32']`)
- [ ] `RitemarkSettingsProvider.ts` — `elevenlabs-api-key` in the SecretStorage key list + store/read/test handlers
- [ ] `RitemarkSettings.tsx` — ElevenLabs key card in the existing API Keys section (no page restructure)
- [ ] Settings: transcription data size + **Clear transcription data**
- [ ] Unit test: flag platform gating
- [ ] Commit Workstream 2

## Phase 3: Transcribe activity-bar app (R1, R13)

- [ ] `media/transcribe-icon.svg` — audio-lines mark matching the existing activity-bar icon set
- [ ] `package.json` — `ritemark-transcribe` container + `ritemark.transcribeView`
- [ ] `src/views/TranscribeViewProvider.ts` — modelled on `AgentLibraryViewProvider`; job subscription; activity-bar badge
- [ ] `extension.ts` — register behind the flag
- [ ] `webview/src/main.tsx` — route `data-editor-type === 'transcribe-panel'` (lazy)
- [ ] `components/transcribe/TranscribePanel.tsx` + `RecordingRow` + `EngineStatusCard` + `DropZone` (shadcn `ui/button` only)
- [ ] First-run state, engine cards with real state, Windows message linking #133
- [ ] Drag-and-drop and file-picker import; video/broken-file refusal copy
- [ ] Commit Workstream 3

## Phase 4: Workbench, playback, speakers, confidence (R6–R9)

- [ ] **First:** click-and-listen check — audible playback under a real user gesture (A3 could not verify this via CDP)
- [ ] **First:** verify `ritemark.transcriptWorkbench` at `priority: "default"` wins over built-in `vscode.audioPreview` for mp3/wav/ogg
- [ ] `src/transcriptWorkbenchProvider.ts` — `CustomReadonlyEditorProvider` (pdf provider shape)
- [ ] `package.json` — `ritemark.transcriptWorkbench` custom editor for the audio extensions
- [ ] `webview/src/main.tsx` — route `data-editor-type === 'transcript-workbench'` (lazy)
- [ ] `Workbench.tsx` — layout shell, session load, scroll restore, no-session → offer to transcribe
- [ ] `PlayerBar.tsx` — play/pause, time, speed, seek (per A3)
- [ ] `Waveform.tsx` — canvas from stored peaks, click-to-seek, no library
- [ ] `TranscriptPane.tsx` / `Segment.tsx` — click-to-seek, active highlight, auto-scroll with manual-scroll yield, keyboard shortcuts
- [ ] `SpeakerBar.tsx` / `RenamePopover.tsx` — chips, stable palette, global rename with affected count, persistence
- [ ] On-device "no speaker separation" row + **Re-run with ElevenLabs**
- [ ] `ConfidenceMark.tsx` — `logprob` threshold (documented in code), absent for engines without confidence
- [ ] Unit tests: active-segment selection, rename reducer, peaks downsampling
- [ ] Commit Workstream 4

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
