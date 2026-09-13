# Sprint 118 Technical Plan

Architecture and workstreams for [spec.md](./spec.md), grounded in [research/current-state-audit.md](./research/current-state-audit.md).

## Architecture Overview

```text
TranscribePanel webview
  useTranscribeRecording (Web Audio capture/resample)
          ↕ typed record protocol + bounded acknowledgments
TranscribeViewProvider
          ↕
RecordingController ── one-active-session policy
          ↕
WavRecordingSink (.wav.part → validate → atomic .wav)
          ↓ successful finalized path only
TranscribeViewProvider._stageImport(path)
          ↓ existing pending engine/privacy card
JobManager → existing engines → SessionStore → Transcript Workbench
```

Capture, file writing, and transcription remain separate state machines. `RecordingController` is composed into `TranscribeViewProvider`; raw file lifecycle does not enter the React store or `JobManager`.

## Proposed Files

Host:

```text
extensions/ritemark/src/speech/recording/types.ts
extensions/ritemark/src/speech/recording/protocol.ts
extensions/ritemark/src/speech/recording/recordingPaths.ts
extensions/ritemark/src/speech/recording/WavRecordingSink.ts
extensions/ritemark/src/speech/recording/RecordingController.ts
```

Webview:

```text
extensions/ritemark/webview/src/components/transcribe/useTranscribeRecording.ts
extensions/ritemark/webview/src/components/transcribe/RecordingCard.tsx
extensions/ritemark/webview/src/components/transcribe/RecordingRecoveryCard.tsx
extensions/ritemark/webview/src/components/transcribe/recordingProtocol.ts (type-only projection if build boundaries require)
```

Integrations: `TranscribeViewProvider.ts`, `TranscribePanel.tsx`, Transcribe `types.ts`, feature flags/package settings, extension activation/disposal, architecture/docs/tests.

## Recording State Machine

```text
idle
  → preparing-destination
  → requesting-permission
  → recording
  → stopping
  → finalizing
  → saved → existing pending import

recording/preparing → cancelling → cancelled
any non-terminal → failed
restart with valid partial → interrupted → recovering → saved | discarded
```

Only the host may transition to `saved`. Terminal session IDs are never reused.

## Workstream 0: Capture/storage audit and freeze (R1–R8)

- Measure current dictation Web Audio capture, actual device sample rates, resampler output, Permissions Policy, CSP, TCC, and packaged/dev behavior.
- Prototype raw PCM chunk bounds and acknowledgments through the VS Code webview channel; simulate slow writes, duplicate/gap/reorder, reload, and one-hour input.
- Validate 16 kHz mono PCM intelligibility and compatibility with duration probe, `audioPrep`, Whisper, ElevenLabs, and browser playback.
- Freeze destinations, names, multi-root/no-folder choice, active-session policy, duration/size rules, backpressure, interruption/recovery, and cleanup in `research/capture-and-storage-decisions.md`.
- Approve [design.md](./design.md), flag, and shell-tier impact.
- Stop for Jarmo's Phase 0 decision.

## Workstream 1: Host protocol, controller, and sink (R3, R4, R6)

- Define exact request/result/event codecs and bounds; validate base64/byte count/format/session/sequence before write.
- `RecordingController` owns session state, one-active-session arbitration, request idempotency, backpressure, shutdown checkpoint, and webview attachment generation.
- `WavRecordingSink` creates a collision-safe managed `.part`, reserves 44-byte header, appends raw PCM asynchronously/serially, tracks cumulative bytes/samples, patches RIFF header, closes, validates, and atomically renames.
- Persist minimal active-session recovery metadata outside webview state; never persist audio bytes in Memento.
- Inject filesystem/clock/ID for deterministic tests and use exact explicit paths for cleanup.

## Workstream 2: Web Audio capture and transport (R2, R3, R7)

- Extract only safe primitives from `useVoiceDictation`; do not reuse its drop-while-busy/transcribe-and-delete controller.
- Request mono capture from a direct user gesture; inspect actual sample rate and resample PCM to the approved baseline.
- Prefer AudioWorklet if supported by current CSP/bundle and measured stable; otherwise document/contain ScriptProcessor fallback. Phase 0 freezes the choice.
- Accumulate only one bounded chunk window, encode raw PCM, send exact sequence, and respect host acknowledgment/backpressure before exceeding the queue bound.
- Detect permission policy, denial, no device, track ended, context suspension, and teardown all audio nodes/tracks on every terminal path.
- Derive timer/byte estimate from captured/accepted samples under the approved display rule.

## Workstream 3: Destination, recovery, and Transcribe integration (R4–R6)

- Resolve destination before capture: selected single/multi-root workspace `Recordings/` or explicit no-folder target.
- On successful finalization call the existing `_stageImport(finalPath)`; do not bypass classify/duration/estimate/pending flow.
- Add interrupted partial inventory/recovery using exact controller metadata; rebuild/validate WAV before Save recovered recording.
- Cancel/discard removes only managed partials and never finalized/imported audio or SessionStore records.
- Ensure extension deactivate closes/checkpoints the sink without falsely staging a pending import.

## Workstream 4: Panel UX and flag (R1, R2, R5, R6, R8)

- Implement [design.md](./design.md) idle, permission, recording, saving, success/pending, error, conflict, and recovery states.
- Keep engine/privacy choice entirely in the existing PendingImportCard after save.
- Gate host registration/handling and UI projection with default-on experimental `transcribe-direct-recording`; `transcription-workbench` remains stable and independent.
- Add polite live updates, focus restoration, keyboard actions, reduced-motion alternative, high-contrast tokens, and narrow-width layouts.

## Workstream 5: Verification and long-run evidence (R7)

- Pure sink/protocol/controller tests: headers, byte counts, collisions, state transitions, invalid messages, duplicates/gaps, slow writes, disk full, recovery, exact cleanup.
- Webview capture tests with fake MediaStream/AudioContext and permission/device failures.
- Integration with `_stageImport`, duration probe, engine estimates, JobManager, clear pending, and transcript flow.
- One-hour deterministic stream performance/memory/backpressure evidence.
- Real-device RUNDEV and packaged macOS plus native Windows capture/play/probe/Transcribe matrix.
- Verify no shell permission/manifest change or document exact required change/delivery impact.

## Workstream 6: Docs, QA, and closeout (R8)

- Run focused recording, speech, dictation, webview, feature-gate, extension build, and repository QA.
- Update architecture for recording subsystem/protocol/state ownership/flag and branch-date rule.
- Update Transcribe user docs, privacy/cost copy, changelog, v1.11 release notes, release tracker, issue, and PR evidence.

## Implementation Order

W0 audit/prototype → decision gate → W1 host sink/controller → W2 capture transport → W3 destination/recovery/pipeline → W4 UX/flag → W5 native/long-run evidence → W6 QA/docs.

## Architecture Gate

Triggered by a new `speech/recording` subsystem, typed webview protocol, managed partial-file lifecycle, new feature flag, and extension deactivate behavior. Update architecture before close. The webview remains filesystem-sandboxed and the existing path-driven `JobManager` remains the only transcription pipeline.
