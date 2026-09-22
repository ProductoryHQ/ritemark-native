# Sprint 118 Spec — Direct Transcribe Recording

**Parent:** [sprint-plan.md](./sprint-plan.md) · **Release:** [v1.12.0](../release-plan.md) · **Issue:** [#328](https://github.com/ProductoryHQ/ritemark-native/issues/328) · **Evidence:** [research/current-state-audit.md](./research/current-state-audit.md)

## Purpose

Add a bounded, crash-safe microphone capture path to the Transcribe activity-bar app. Capturing audio ends by producing a real file; only then does the existing pending-import card ask the user to choose on-device or ElevenLabs transcription.

## Principles

- **Capture is not transcription.** Recording only creates audio; existing privacy/engine consent remains authoritative.
- **The host owns file truth.** A webview never claims Saved until the host has finalized and verified the file.
- **Bound memory, ordered bytes.** Long recordings stream in numbered chunks and never accumulate as one webview/host buffer.
- **Partial is not success.** Interrupted/corrupt audio is recoverable or discardable, never silently promoted.
- **User owns the finished file.** Final audio is visible in a deliberate location outside opaque transcript metadata.
- **One microphone at a time.** Capture sessions are process-scoped and reject competing panels/windows deterministically.

## Proposed Capture Baseline

- 16,000 Hz, mono, signed 16-bit little-endian PCM.
- Webview sends bounded base64 raw-PCM chunks with `sessionId`, `sequence`, format, byte count, and optional duration count; it does not send a complete WAV header per chunk.
- Host writes a `.wav.part` file with reserved header, appends PCM in sequence, patches the WAV header only on Stop, fsyncs/closes where supported, validates duration/header/size, and atomically renames to `.wav`.
- Target size is approximately 32 KB/second (115.2 MB/hour) before filesystem overhead.

Phase 0 must validate browser sample-rate/resampling quality, chunk size/backpressure, long-run drift, actual file compatibility, and whether the VS Code message channel reliably handles the chosen bound on macOS and Windows.

## Requirements

### R1: Direct recording interaction

As a user, I want to record beside Add recording, so I can create input without another app.

Acceptance criteria:
- Idle Transcribe shows separate **Record** and **Add recording** actions with microphone/file icons and clear accessible names.
- Record opens or begins the approved destination/permission flow from a user gesture.
- Recording shows elapsed time, a visible recording indicator, current destination/file name, and primary **Stop and use recording** plus secondary **Cancel**.
- Stop cannot be triggered twice and transitions through a non-interruptible **Saving recording…** state until host result.
- Successful save opens the existing pending-import card; it does not automatically choose an engine or upload.
- Pause/resume, trimming, monitoring, and input selection are not shown in v1.11.
- *(revised 2026-09-22)* The release is now v1.12.0; the sprint moved there on 2026-09-15. The criterion is unchanged: none of these controls ship in this sprint.

### R2: Permission and device honesty

As a user, I want actionable microphone errors, so Ritemark never tells me to change the wrong setting.

Acceptance criteria:
- Capture checks Permissions Policy delegation and `navigator.mediaDevices` support before requesting a device.
- OS denial, no device, device busy/unreadable, browser policy/internal configuration, track-ended/device removal, and unexpected capture errors have distinct safe copy.
- macOS recovery can invoke the existing System Settings action only for an actual OS permission case.
- Internal webview delegation failure is described as a Ritemark build/configuration problem, not a user permission choice.
- Denial/error creates no successful recording or pending import and releases all acquired tracks/audio nodes.

### R3: Typed ordered recording session

As the team, we want one validated capture protocol, so stale or duplicated chunks cannot corrupt another file.

Acceptance criteria:
- A host-created UUID session and exact-field request/result/event union cover prepare/start, chunk, stop, cancel, state, accepted-byte acknowledgment, backpressure, saved, failed, and recovery.
- The host validates session ownership, sequence, format, decoded length, cumulative bytes/duration, message bounds, and legal state transition.
- Duplicate already-acknowledged chunks are idempotent; gaps/out-of-order/future-session chunks fail or request bounded replay under the frozen Phase 0 rule.
- Stop includes the final sequence/count and succeeds only after every accepted chunk is durably written.
- Late chunks after Stop/Cancel/failure and messages from a replaced webview cannot mutate the terminal session.
- Only one active recording session exists per extension host; a second start returns visible conflict state.

### R4: Crash-safe user-owned audio file

As a user, I want the recorded audio preserved honestly, so I can find, replay, and reuse it.

Acceptance criteria:
- Phase 0 freezes destination rules: recommended `Recordings/` inside the selected workspace; a multi-root choice is explicit; no-folder flow chooses a target before capture.
- Names are filesystem-safe, timestamp-based, collision-free, and shown before/during capture.
- Partial and final paths remain inside an approved user or managed recovery root; path traversal and arbitrary webview paths are rejected.
- Host uses async bounded writes, closes descriptors, patches/validates RIFF sizes, and atomically promotes only a valid WAV.
- Final file is playable/probeable and its measured duration matches accepted sample count within a defined tolerance.
- Existing files are never overwritten silently.

### R5: Existing Transcribe pipeline remains authoritative

As a user, I want a recording to behave like any imported audio file.

Acceptance criteria:
- After finalization the host stages the final path through the same `_stageImport` validation/duration/engine-estimate path as Add recording.
- The pending card still asks which engine to use and shows the existing local/privacy/cost distinction before any upload or transcription.
- `JobManager.enqueue`, `SessionStore`, Transcript Workbench, speaker rename, export, relink, and Insights receive no special “live recording” branch.
- If the user clears the pending card, the finalized audio file remains theirs and is not deleted.
- If transcription fails/cancels, the recording file remains unchanged and can be retried/imported again.

### R6: Cancellation, interruption, and recovery

As a user, I want cancelled or interrupted recording to have a predictable outcome.

Acceptance criteria:
- Cancel stops capture, closes the host session, and asks/executes the approved partial-file disposition without creating a pending import.
- Webview disposal, panel hide, and panel reopen behavior are distinct: hiding must not rely on renderer survival unless explicitly proven; reload/disposal ends or detaches under a frozen rule.
- App shutdown checkpoints active session metadata before closing the file.
- On restart, valid non-empty partials appear in one **Recording interrupted** recovery state with **Save recovered recording** and **Discard**; zero/invalid partials are cleaned safely.
- Recovery never calls a partial file complete without rebuilding/validating its WAV header.
- Discard targets only the exact managed partial and is recoverable where practical; it never deletes imported/final user audio.

### R7: Cross-platform performance and limits

As a user, I want long recording to remain responsive and predictable.

Acceptance criteria:
- Real-device capture is verified in RUNDEV and packaged macOS arm64 plus native Windows; macOS x64 permission/signing remains a release matrix row.
- A one-hour synthetic/realistic stream holds bounded renderer/host memory and produces expected size/duration without sequence loss.
- Host backpressure prevents unbounded postMessage/write queues; overload pauses/fails visibly rather than dropping audio silently.
- Phase 0 freezes a maximum supported duration/size or a warning-only policy based on measured results.
- Timer display derives from accepted/captured samples or a monotonic clock with drift reconciliation; it does not imply bytes saved before acknowledgment.
- TCC/manifest/Permissions Policy requirements are verified rather than assumed; any shell change changes delivery tier and triggers its own architecture/release documentation.

### R8: Flag, accessibility, privacy, docs, and regression safety

As the team, we want direct recording independently disableable during rollout without weakening Transcribe.

Acceptance criteria:
- `transcribe-direct-recording` is experimental and default true; the flag gates both UI and every host recording message.
- Flag-off leaves Add recording, existing library, transcription, and workbench fully functional and leaves finalized user audio untouched.
- No audio bytes enter logs, telemetry, Memento, webview persisted state, or transcript metadata beyond existing file path/fingerprint rules.
- Controls/status are keyboard/screen-reader accessible, non-color-only, usable at narrow width/200% zoom/high contrast/reduced motion.
- Capture protocol/sink/UI tests and existing Transcribe/dictation regressions pass; architecture, user docs, changelog, v1.11 release notes, tracker, issue, and QA are current.
- *(revised 2026-09-22)* Read "v1.11 release notes" as the v1.12.0 release notes (`docs/releases/v1.12.0/release-notes.md`), because the sprint moved releases on 2026-09-15.

## Non-Requirements

- Pause/resume, waveform preview while recording, level meter, device picker, monitoring, trimming, editing, denoise, or compression.
- System audio, meeting bots, multiple microphones, stereo, or video.
- Windows/Intel local Whisper support (#133/#203).
- Automatic transcription, automatic cloud upload, or bypassing existing cost/privacy consent.
- Syncing recordings between devices or hiding final audio in extension storage as the only copy.

## Phase 0 Decisions

1. Validate and approve sample format, resampler, chunk size, message/backpressure bounds, and long-run drift/size.
2. Freeze workspace, multi-root, no-folder, naming, collision, and user-ownership rules. *(Decided 2026-09-22 by Jarmo: with a folder open, save into the project; with no folder open, ask where to save before recording starts. Phase 0 freezes the rest.)*
3. Freeze panel hide/reload/disposal, app-shutdown, partial recovery, and discard behavior.
4. Approve one-active-session ownership and stop/finalization atomicity.
5. Decide duration/size warning or hard limit from measured evidence.
6. Confirm no shell/patch/permission manifest changes are needed, or reclassify delivery impact explicitly.
7. Approve [design.md](./design.md) and the default-on experimental flag.
