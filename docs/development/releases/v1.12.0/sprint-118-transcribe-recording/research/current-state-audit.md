# Sprint 118 Research — Current Capture and Transcribe Audit

**Date:** 2026-09-13<br>
**Decision:** Reuse Web Audio format/resampling and the path-driven Transcribe pipeline as reference seams, but build a separate host-owned recording sink. The dictation controller is unsafe for archival recording.

## What Was Inspected

- `webview/src/hooks/useVoiceDictation.ts`
- `src/voiceDictation/controller.ts`
- `src/views/TranscribeViewProvider.ts`
- `webview/src/components/transcribe/TranscribePanel.tsx` and `types.ts`
- `src/speech/JobManager.ts`, `SessionStore.ts`, `audioPrep.ts`, `durationProbe.ts`, `paths.ts`
- Extension activation/disposal, feature flags, microphone permission helpers, and prior Sprint 108 audits

## Findings

| ID | Finding | Consequence |
|---|---|---|
| F1 | Dictation already requests `getUserMedia`, captures mono PCM, resamples to 16 kHz, and produces WAV chunks. | Capture math/permission classification is reusable as tested reference. |
| F2 | Dictation uses deprecated `ScriptProcessorNode` and buffers until a timer. | Phase 0 must measure AudioWorklet viability and bounded fallback behavior. |
| F3 | Each dictation chunk is a complete base64 WAV. | Archival recording should send ordered raw PCM or safely strip headers; appending WAV files would corrupt output. |
| F4 | Dictation controller drops every chunk received while transcription is busy. | It cannot be reused: recording may never drop audio silently. |
| F5 | Dictation writes temp chunks synchronously, transcribes immediately, then deletes them. | Recording needs async serialized append, durable partials, final validation, and recovery. |
| F6 | Dictation stop has no final host acknowledgment. | Recording requires stop/finalize result before UI can claim Saved. |
| F7 | Dictation permission logic distinguishes webview delegation, OS denial, and missing devices. | Preserve that truth model and add track-ended/busy/storage states. |
| F8 | Transcribe panel currently has Add recording only and treats the chosen file as `_pending`. | Direct recording should end by calling the same staging path. |
| F9 | `_stageImport` already validates type, probes duration, and computes per-engine estimates. | Do not duplicate duration/privacy/cost logic. |
| F10 | `_start` alone persists engine preference and calls `JobManager.enqueue`. | Capture must not call it or select an engine automatically. |
| F11 | Jobs outlive the panel, persist in-flight state, and are single-flight. | Recording lifecycle must be independent but follow the same honesty pattern. |
| F12 | Session identity is derived from finalized audio path; sessions store transcript metadata globally and remain project-filtered. | Final path must be stable before enqueue; recovery/rename semantics matter. |
| F13 | Existing imported recordings remain user files; removing transcript never deletes audio. | Direct recordings should follow the same ownership rule after finalization. |
| F14 | Speech scratch space is system temp and intentionally deleted after jobs. | Interrupted capture needs its own explicit managed-partial policy, not generic job scratch cleanup. |
| F15 | Current feature flags separate macOS-only dictation from cross-platform Transcribe. | Direct recording should gate independently and must not inherit dictation's darwin-only flag. |
| F16 | Release plan evidence says microphone delegation and macOS usage description already apply broadly, but this is not yet packaged proof for the Transcribe panel. | Phase 0 must verify, not assume, shell-tier neutrality. |

## Selected Direction to Validate in Phase 0

Create `speech/recording` with typed sequence/ack protocol, one host session, raw PCM `.wav.part` sink, valid-WAV finalization, user destination, interrupted recovery, and successful-path reuse of `_stageImport`. Keep dictation and JobManager unchanged except shared pure helpers when safe.

## Phase 0 Evidence Still Required

- AudioWorklet/CSP/bundle support versus contained ScriptProcessor fallback.
- Real device sample rates, resampling quality, chunk bound, backpressure, and message-channel behavior.
- One-hour memory/size/drift and slow/disk-full failure behavior.
- Multi-root/no-folder destination and user-ownership choice.
- Panel hide/reload, app shutdown, partial recovery/discard, and active-session ownership.
- Packaged macOS/Windows permission behavior and shell manifest impact.

No capture implementation is authorized by this audit alone.
