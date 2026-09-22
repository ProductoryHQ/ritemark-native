# Sprint 118 — Direct Transcribe Recording

**Track:** Full SDD<br>
**Status:** Implementation (Phase 1+). Phase 0 was approved on 2026-09-22.<br>
**Branch after approval:** `sprint-118-transcribe-recording`<br>
**Issue:** [#328](https://github.com/ProductoryHQ/ritemark-native/issues/328)<br>
**Worktree:** `.claude/worktrees/sprint-118-transcribe-recording`, branched from main `d8d90ad7`<br>
**Release:** [v1.12.0](../release-plan.md)

## Goal

Let a user record audio directly in Transcribe and turn the saved recording into a normal library item that follows the existing consent, engine, job, transcript, and Insights pipeline.

## Release Outcome

After Sprint 118, a user can start and stop a microphone recording from the Transcribe panel, see elapsed time and storage state, and receive a valid user-owned WAV file staged through the same engine/privacy choice as an imported recording. Panel reloads and app interruption never turn a partial file into a successful library item or silently discard recoverable audio.

## SDD Artifacts

- [spec.md](./spec.md) — capture, storage, recovery, and pipeline contract R1–R8.
- [scenarios.md](./scenarios.md) — BDD, permission, crash, long-run, and platform matrix.
- [technical-plan.md](./technical-plan.md) — recording session/sink architecture and workstreams W0–W6.
- [design.md](./design.md) — idle, permission, recording, stopping, saved, and error states.
- [tasks.md](./tasks.md) — audit, implementation, validation, and closeout phases.
- [research/current-state-audit.md](./research/current-state-audit.md) — reusable capture/pipeline seams and unsafe reuse findings.
- `research/capture-and-storage-decisions.md` — Phase 0 freeze artifact to be completed after kickoff.

## Scope

- Add a **Record** entry beside **Add recording** in the Transcribe panel.
- Capture cross-platform microphone audio in the webview with clear idle, recording, paused/stopping, saving, and failure states.
- Define a typed, bounded webview→host recording protocol with session IDs, ordered chunks, cancellation, finalization, and stale-message rejection.
- Accumulate audio host-side into a real file without loading an unbounded recording into memory.
- Save to an explicit workspace recording location, or use a clear no-workspace fallback beside other Transcribe-managed data.
- Hand the finalized path to the unchanged `JobManager.enqueue({ audioPath, ... })` consent/engine flow.
- Recover safely from view disposal, app shutdown, permission denial, disk-full, write failure, and interrupted finalization.
- Preserve uploaded-file behavior and existing platform engine availability.

## Deliverables

1. Approved capture/file-lifecycle spec, scenarios, technical plan, and task checklist.
2. Typed recording protocol and host-owned streaming file sink.
3. Accessible Transcribe recording controls and permission/error guidance.
4. Normal library/session integration through the existing path-driven pipeline.
5. Automated lifecycle tests and real-device macOS/Windows capture evidence.
6. Architecture, Transcribe user guide, changelog, and v1.12.0 release-note updates.

## Definition of Done

- [ ] Record, pause/resume if retained by design, stop, cancel, and permission-denied states are deterministic and keyboard accessible.
- [ ] Finalized recordings are valid playable files with unique, collision-safe names.
- [ ] Chunk ordering, duplicate delivery, stale sessions, and late finalization cannot corrupt another recording.
- [ ] Memory use stays bounded for long recordings; partial files have an explicit cleanup/recovery policy.
- [ ] A successful recording becomes the same kind of library item as an imported file and uses the existing consent and engine choice.
- [ ] The capture path works on supported macOS and Windows targets; on-device Whisper availability remains unchanged.
- [ ] Existing upload, transcription, transcript, relink, rename, and Insights regressions pass.
- [ ] Webview bundle, typed boundary tests, architecture gate, user docs, release notes, and repository QA pass.

## Dependencies and Gates

- v1.12.0 must be mapped and the sprint approved before branch creation.
- Phase 0 must decide file format, chunk size, duration/storage warnings, pause semantics, destination/fallback path, and interrupted-file policy before implementation.
- Microphone permission behavior must be verified in dev and packaged app contexts; no shell/patch assumption is accepted without evidence.
- The existing dictation controller is reference code only. Its transcribe-and-delete/drop-while-busy behavior must not be reused as a recording sink.

## Feature Flag Decision

Add an experimental, default-on `transcribe-direct-recording` flag as a code-level kill switch during rollout. Gate both the Transcribe UI and host message handling; do not gate or alter the stable `transcription-workbench` feature itself. Phase 0 may remove the new flag only if the implementation is proven to be a small, low-risk extension of the stable workbench.

## Requirement Traceability

| Requirement | Outcome | Workstream |
|---|---|---|
| R1 | Clear direct-recording interaction | W4 |
| R2 | Truthful permission/device handling | W2, W4 |
| R3 | Typed ordered capture session | W1–W2 |
| R4 | Crash-safe user-owned audio file | W1, W3 |
| R5 | Existing consent/engine/job pipeline | W3–W4 |
| R6 | Cancel/interruption/recovery honesty | W1, W3 |
| R7 | Cross-platform/long-run bounds | W2, W5 |
| R8 | Flag, accessibility, docs, QA | W4–W6 |

## Product Decisions

| Date | Decision | Consequence |
|---|---|---|
| 2026-09-07 | Direct recording feeds the existing path-driven Transcribe pipeline | No second transcription/session implementation. |
| 2026-09-13 | Recommend 16 kHz mono 16-bit PCM WAV as v1 capture baseline | Cross-platform, transcription-ready, deterministic, and approximately 115 MB/hour. Phase 0 validates real-device quality. |
| 2026-09-13 | Start/Stop/Cancel only; Pause is out of scope | Keeps lifecycle and crash recovery small and testable for first release. |
| 2026-09-13 | User owns finalized audio; partial capture is host-managed until finalization | Successful recordings are normal files, while cancelled/invalid partials do not pollute the library. |
| 2026-09-22 | Kickoff approved: scope as packaged, audit-first Phase 0. Implementation waits for the Phase 0 gate. | Issue #328, branch `sprint-118-transcribe-recording` from main `d8d90ad7`. Jarmo: "118, alusta". |
| 2026-09-22 | Phase 0 approved: the freeze in `research/capture-and-storage-decisions.md` §5. ScriptProcessor with no CSP change; 16 kHz WAV in 1 s chunks with at most 4 unacked; elapsed time from samples; an honest stop on suspension; a 2 h warning and 4 h stop; the no-folder location remembered and shown with Change; a visible `.wav.part` with recovery; the real-microphone check on a signed build. | Jarmo: "kinnitan, alusta koodiga" |
| 2026-09-22 | Destination: with a workspace folder open, a recording is saved into the project. With no folder open, Ritemark asks where to save before recording starts. | Jarmo: "enne funktsiooni lubamist küsi, et kuhu salvestada (kui pole kaustas)". Phase 0 still freezes the in-project folder name, multi-root choice, naming and collisions, and whether the chosen no-folder location is remembered. |

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Long recordings exhaust memory or disk | High | Stream chunks to disk, expose size/duration, and test long-run bounds. |
| View reload leaves corrupt or invisible partial files | High | Host-owned session lifecycle, atomic finalize, explicit partial recovery/cleanup. |
| Webview capture format differs by platform | High | Fix one supported PCM/WAV baseline and test actual target browsers. |
| Permission UI differs between dev and packaged apps | Medium | Verify both contexts and document recovery. |
| Feature accidentally changes engine availability promises | Medium | Keep capture separate from transcription-engine selection. |

## Out of Scope

- Windows or Intel local Whisper support (#133, #203).
- Background/system-audio capture, multi-input mixing, or meeting-bot recording.
- Audio editing, trimming, noise removal, or automatic segmentation.
- Changing ElevenLabs long-upload behavior beyond clear inherited limits.

## Planning Approval

- [x] Jarmo approves scope and Phase 0 questions. *(2026-09-22)*
- [x] GitHub issue is created and assigned to milestone `v1.12.0`. *([#328](https://github.com/ProductoryHQ/ritemark-native/issues/328))*
- [ ] SDD artifacts and feature-flag decision are approved. *(Phase 0 gate)*
- [x] Dedicated branch is created after approval. *(`sprint-118-transcribe-recording`, 2026-09-22)*
