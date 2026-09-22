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

- [x] Add bounded capture hook with approved AudioWorklet/contained fallback and 16 kHz mono PCM output. *(ScriptProcessor per §5; 16 kHz context first, device rate + streaming box-filter resampler as the fallback. `recording/captureSession.ts`, `useTranscribeRecording.ts`)*
- [x] Add sequence/chunk metadata, bounded base64 transport, acknowledgment/backpressure, and final-count Stop.
- [x] Add permission-policy, denied, no-device, busy/unreadable, track-ended, suspended-context, and teardown handling.
- [x] Add fake MediaStream/AudioContext/resampler/chunking/cleanup tests. *(`capture.test.ts`, `captureSession.test.ts`)*

## Phase 3: Destination, recovery, and pipeline (W3 — R4–R6)

- [x] Implement single/multi-root/no-folder destination flow and visible safe final name. *(single folder and no folder verified in RunDev 2026-09-22: ask before the first recording, remembered location, `(2)` on a same-minute collision, Change; multi-root covered by controller tests)*
- [x] Route only validated final files through existing `_stageImport` and PendingImportCard. *(RunDev 2026-09-22: Stop → pending card; recovered part → pending card)*
- [x] Add interrupted recording recovery/save/discard with valid-WAV reconstruction. *(RunDev: window reload mid-recording → header checkpointed at shutdown → recovery card → valid 18.0 s WAV)*
- [x] Verify clear pending/transcription failure/cancel preserve finalized audio. *(RunDev: clearing the card and Cancel keep the WAV; `JobManager` removes only its own `isTemp`/peaks files in the work dir, never the source, on success or failure)*
- [x] Verify SessionStore/JobManager/Workbench require no recording-specific branch. *(no diff in those files; a recorded file was transcribed on-device through the unchanged job path in RunDev)*

## Phase 4: UI, flag, and accessibility (W4 — R1, R2, R5, R6, R8)

- [x] Implement idle/recording/saving/error/conflict/recovery states from `design.md`. *(with the 2026-09-22 one-line button revision)*
- [x] Add experimental/default-true `transcribe-direct-recording` to registry/settings and gate UI/host coherently. *(gates new starts only; a session in progress always finishes)*
- [x] Verify flag-off preserves every existing Transcribe behavior and finalized file. *(RunDev 2026-09-22: setting off hides Record live; library, pending card and files unchanged)*
- [ ] Verify keyboard, screen reader, polite live status, focus, narrow width, 200% zoom, high contrast, and reduced motion. *(keyboard, live status, focus, narrow width, 200% zoom (a label overflow found and fixed) and reduced motion done; screen reader and high contrast not run)*

## Phase 5: Long-run and native validation (W5 — R7)

- [x] Run one-hour deterministic stream with measured memory, queue depth, size, duration, and content integrity. *(RunDev 2026-09-22, see qa-evidence.md: valid 3632.64 s WAV, no buffer lost, webview heap flat, host RSS back to baseline after Stop)*
- [ ] Run real-device RUNDEV/macOS packaged capture, playback, probe, pending import, local engine, and ElevenLabs consent path.
- [ ] Run native Windows capture/playback/probe/pending-import matrix.
- [ ] Confirm shell/permission manifest impact and record any release-tier consequence.

## Phase 6: QA and closeout (W6 — R8)

- [x] Run focused recording/speech/dictation/feature/webview/extension tests and builds. *(`npm test` full chain, both type-checks, webview build)*
- [x] Walk every ★ scenario and link evidence. *([qa-evidence.md](./qa-evidence.md); the signed build, Windows, the screen reader and high contrast are open and named there)*
- [x] Run `./scripts/validate-qa.sh` through repository QA. *(exit 0, 2026-09-22)*
- [ ] Update architecture, Transcribe/privacy user docs, changelog, v1.12.0 release notes (was v1.11 before the 2026-09-15 move), parent tracker, issue, and PR. *(architecture, `docs/user/features/transcribe.md`, `docs/CHANGELOG.md` v1.12.0 section, release notes done; tracker, issue and PR at closeout)*
- [ ] Verify every checked task against branch diff/evidence before readiness handoff.
