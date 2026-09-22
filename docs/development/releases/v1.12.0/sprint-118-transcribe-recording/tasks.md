# Sprint 118 Tasks

Implementation checklist for [technical-plan.md](./technical-plan.md). Tick `[x]` only with branch diff/evidence.

> **Gate:** Phase 0 is audit/prototype/documentation only. Product code begins after Jarmo approves capture format, protocol, destinations, recovery, UX, flag, and delivery-tier impact.

## Phase 0: Audit and freeze (W0 — R1–R8)

- [x] Capture current dictation/Transcribe/permission/pipeline evidence in `research/capture-and-storage-decisions.md`. *(audit re-verified, D1–D4)*
- [ ] Measure device sample rates, resampler quality, 16 kHz PCM compatibility, chunk/message bounds, backpressure, and one-hour size/drift/memory. *(S1–S4b done on RunDev: 48 kHz default context, ScriptProcessor pace, hidden panel, one-hour run with no leak and a silent OS suspension found. Real-microphone resampling and host transport move to the signed-build check and Phase 1 tests, per the gate)*
- [ ] Verify current webview microphone delegation, CSP, macOS TCC, Windows behavior, and packaged/dev differences. *(delegation and CSP verified, S5/S6 TCC behaviour recorded; the signed macOS build and Windows are still to run)*
- [x] Freeze exact capture format, chunk size, sequence/replay rule, ack/backpressure bound, timer, and duration/size policy. *(§5, approved 2026-09-22)*
- [x] Freeze destination/naming/collision/multi-root/no-folder/user-ownership rules. *(§2.1 and §5, approved 2026-09-22)*
- [x] Freeze one-active-session, panel hide/reload, shutdown, recovery, discard, and zero/invalid partial rules. *(§2.3 and §5, approved 2026-09-22)*
- [x] Approve `design.md`, default-on experimental flag, and shell-tier impact. *(approved with the gate; no shell change expected)*
- [x] **Jarmo Phase 0 gate:** authorize implementation. *(2026-09-22: "kinnitan, alusta koodiga")*

## Phase 1: Host session and WAV sink (W1 — R3, R4, R6)

- [x] Add versioned recording types and exact-field protocol/runtime validators. *(`src/speech/recording/types.ts`, `protocol.ts`; storage keys carry `:v1`)*
- [x] Add `recordingPaths.ts` with safe roots, names, collision handling, and managed partial validation.
- [x] Add `WavRecordingSink` with reserved header, serialized append, byte/sample counts, finalize validation, and atomic promotion.
- [x] Add `RecordingController` with one-active-session, sequence/idempotency, ack/backpressure, terminal generations, shutdown checkpoint, and recovery inventory. *(host acks each chunk; the in-flight bound lives in the webview, W2)*
- [x] Test valid/invalid headers, duplicate/gap/stale chunks, disk full, collision, failed rename, crash recovery, and exact cleanup. *(`npm run test:recording`, chained into `npm test`)*

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
