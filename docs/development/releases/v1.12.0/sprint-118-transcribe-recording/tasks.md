# Sprint 118 Tasks

Implementation checklist for [technical-plan.md](./technical-plan.md). Tick `[x]` only with branch diff/evidence.

> **Gate:** Phase 0 is audit/prototype/documentation only. Product code begins after Jarmo approves capture format, protocol, destinations, recovery, UX, flag, and delivery-tier impact.

## Phase 0: Audit and freeze (W0 — R1–R8)

- [ ] Capture current dictation/Transcribe/permission/pipeline evidence in `research/capture-and-storage-decisions.md`.
- [ ] Measure device sample rates, resampler quality, 16 kHz PCM compatibility, chunk/message bounds, backpressure, and one-hour size/drift/memory.
- [ ] Verify current webview microphone delegation, CSP, macOS TCC, Windows behavior, and packaged/dev differences.
- [ ] Freeze exact capture format, chunk size, sequence/replay rule, ack/backpressure bound, timer, and duration/size policy.
- [ ] Freeze destination/naming/collision/multi-root/no-folder/user-ownership rules. *(Direction decided 2026-09-22: in-project with a folder open; ask before recording with none)*
- [ ] Freeze one-active-session, panel hide/reload, shutdown, recovery, discard, and zero/invalid partial rules.
- [ ] Approve `design.md`, default-on experimental flag, and shell-tier impact.
- [ ] **Jarmo Phase 0 gate:** authorize implementation.

## Phase 1: Host session and WAV sink (W1 — R3, R4, R6)

- [ ] Add versioned recording types and exact-field protocol/runtime validators.
- [ ] Add `recordingPaths.ts` with safe roots, names, collision handling, and managed partial validation.
- [ ] Add `WavRecordingSink` with reserved header, serialized append, byte/sample counts, finalize validation, and atomic promotion.
- [ ] Add `RecordingController` with one-active-session, sequence/idempotency, ack/backpressure, terminal generations, shutdown checkpoint, and recovery inventory.
- [ ] Test valid/invalid headers, duplicate/gap/stale chunks, disk full, collision, failed rename, crash recovery, and exact cleanup.

## Phase 2: Webview capture and permission handling (W2 — R1–R3, R7)

- [ ] Add bounded capture hook with approved AudioWorklet/contained fallback and 16 kHz mono PCM output.
- [ ] Add sequence/chunk metadata, bounded base64 transport, acknowledgment/backpressure, and final-count Stop.
- [ ] Add permission-policy, denied, no-device, busy/unreadable, track-ended, suspended-context, and teardown handling.
- [ ] Add fake MediaStream/AudioContext/resampler/chunking/cleanup tests.

## Phase 3: Destination, recovery, and pipeline (W3 — R4–R6)

- [ ] Implement single/multi-root/no-folder destination flow and visible safe final name.
- [ ] Route only validated final files through existing `_stageImport` and PendingImportCard.
- [ ] Add interrupted recording recovery/save/discard with valid-WAV reconstruction.
- [ ] Verify clear pending/transcription failure/cancel preserve finalized audio.
- [ ] Verify SessionStore/JobManager/Workbench require no recording-specific branch.

## Phase 4: UI, flag, and accessibility (W4 — R1, R2, R5, R6, R8)

- [ ] Implement idle/recording/saving/error/conflict/recovery states from `design.md`.
- [ ] Add experimental/default-true `transcribe-direct-recording` to registry/settings and gate UI/host coherently.
- [ ] Verify flag-off preserves every existing Transcribe behavior and finalized file.
- [ ] Verify keyboard, screen reader, polite live status, focus, narrow width, 200% zoom, high contrast, and reduced motion.

## Phase 5: Long-run and native validation (W5 — R7)

- [ ] Run one-hour deterministic stream with measured memory, queue depth, size, duration, and content integrity.
- [ ] Run real-device RUNDEV/macOS packaged capture, playback, probe, pending import, local engine, and ElevenLabs consent path.
- [ ] Run native Windows capture/playback/probe/pending-import matrix.
- [ ] Confirm shell/permission manifest impact and record any release-tier consequence.

## Phase 6: QA and closeout (W6 — R8)

- [ ] Run focused recording/speech/dictation/feature/webview/extension tests and builds.
- [ ] Walk every ★ scenario and link evidence.
- [ ] Run `./scripts/validate-qa.sh` through repository QA.
- [ ] Update architecture, Transcribe/privacy user docs, changelog, v1.12.0 release notes (was v1.11 before the 2026-09-15 move), parent tracker, issue, and PR.
- [ ] Verify every checked task against branch diff/evidence before readiness handoff.
