# Sprint 118 QA Evidence

Every ★ scenario in [scenarios.md](./scenarios.md), with the evidence behind it. RunDev means the sprint worktree's dev build (2026-09-22, macOS arm64), driven over CDP with real mouse and keyboard input. The Phase 0 freeze ([research/capture-and-storage-decisions.md](./research/capture-and-storage-decisions.md) §5) and the 2026-09-22 design revisions in [design.md](./design.md) supersede the scenario text where the two differ; those rows say so.

Automated suites: `npm run test:recording` (chained into `npm test`):

- `src/speech/recording/`: `recordingPaths.test.ts`, `protocol.test.ts`, `WavRecordingSink.test.ts`, `RecordingController.test.ts`, `recordingFlag.test.ts`
- `webview/src/components/transcribe/recording/`: `capture.test.ts`, `captureSession.test.ts`

## ★ scenarios

| Scenario | Evidence | Result |
| --- | --- | --- |
| Record produces a pending import (R1) | RunDev, real microphone. Record → Stop and use gave `Recording 2026-09-22 17.29.wav`: 16 kHz mono PCM16, 19.97 s, size equal to the header. It went to the existing pending card with length and both engines, and nothing started. Jarmo repeated this with his own voice (24.6 s, peaks at about −19 dBFS). Controller test "happy path". | Pass |
| macOS permission is denied (R2) | `classifyCaptureError` maps NotAllowedError, and NotFoundError while devices exist (Phase 0 S6), to `os-denied`. `captureSession.test.ts` covers the capture failure. `RecordingController.test.ts` covers the copy and `openMicrophoneSettings`. The error card offers **Microphone Settings** on macOS and Windows. Not reproduced live: the dev build now holds microphone permission. | Pass (automated) |
| Webview delegation is broken (R2) | Permissions-Policy not delegated → `internal-config`, copy "internal configuration error in this build… update Ritemark or report", no System Settings advice (`capture.test.ts`, `captureSession.test.ts`). | Pass (automated) |
| Ordered chunks finalize exactly (R3) | `RecordingController.test.ts`: chunks fired without awaiting are written in order, and the data length equals the accepted PCM. RunDev files: frames × 2 + 44 = size in every recording. | Pass |
| Duplicate chunk is idempotent (R3) | Controller test: a duplicate is acknowledged again, and its different bytes are not appended. | Pass |
| Sequence gap never drops silently (R3) | Controller test: a gap, a length mismatch, a malformed message, or a final-sequence mismatch each ends the session with `ended`, saves what was written, and shows the "stopped unexpectedly… saved" notice. | Pass |
| Backpressure prevents memory growth (R3) | `captureSession.test.ts`: 4 unacknowledged chunks are allowed. The 5th is still sent, then a `too-slow` stop follows. Acknowledgements free the budget (20 s run). | Pass |
| Single workspace destination (R4) | RunDev: `workspace/recordings/Recording 2026-09-22 17.31.wav` shown on the live card. Same-minute collision → `(2)` (RunDev no-folder run and controller test). Name format per §5 freeze (`recordings/`, `HH.MM`), superseding the scenario's `Recordings/…HH-mm-ss`. | Pass |
| Valid WAV is atomically promoted (R4) | `WavRecordingSink.test.ts`: header patched, fsync, read-back validation, then a never-overwrite rename. The `.part` is never shown as a recording: the projection lists only registered partials, as interrupted items. | Pass |
| Local engine choice stays explicit (R5) | RunDev: the recording goes into the unchanged `_stageImport`. The pending card preselects by the existing preference only (On-device), exactly as for an added file. | Pass |
| ElevenLabs upload starts only after consent (R5) | Structural: recording ends at `_stageImport`, and `JobManager` is reached only from **Transcribe** (`_start`). No diff in `JobManager`, `SessionStore`, engines. Not run live with a key: the dev profile has none. | Pass (structural) |
| Panel reload during capture (R6) | RunDev: window reload mid-recording. The shutdown checkpoint patched the `.part` header to 18 s, the recovery card appeared after reload, and Save recording gave a valid 18.0 s WAV into the pending card. Controller test: `detach()` on `transcribe:ready`, late chunks ignored. | Pass |
| Application closes during capture (R6) | RunDev, real crash: `kill -9` of the extension host 50 s into a recording. The `.part` held 1,600,044 bytes with the placeholder header (data size 0), because no checkpoint ran. VS Code restarted the host, the panel offered **Recording interrupted · about 1 min**, and **Save recording** rebuilt a valid 50.0 s WAV (level intact) into the pending card. Controller test: torn `.part` rebuilt; empty and vanished partials forgotten; an unreadable one kept. | Pass |
| One-hour stream stays bounded (R7) | RunDev, 440 Hz synthetic source through the real pipeline, sampled every minute:<br>• **Result:** a valid WAV of 3632.64 s and 116,244,524 bytes, with the header equal to the size. The frame count is exactly 14,190 × 4096 (no ScriptProcessor buffer lost) and the level is intact (RMS 6951 against 6951).<br>• **File growth:** 1.888–1.952 MB a minute (1.920 expected).<br>• **Webview JS heap:** flat at 37–45 MB throughout.<br>• **Extension host RSS:** 61–92 MB for the first 45 minutes and 91–102 MB in the last 15, while a second dev instance was being started beside it. It returned to 63–67 MB after Stop, so no leak. | Pass |
| macOS and Windows real-device capture (R7) | macOS dev build: real microphone, permission, capture, stop, pending import, cancel, recovery. Signed macOS build and Windows: not run. They move to the v1.12.0 release gate. | Partial |
| Flag-off preserves Transcribe (R8) | RunDev: setting `ritemark.features.transcribe-direct-recording: false` hides Record live, and Add recording fills the row. Library, pending card and existing files are unchanged, and Record returns when the flag is back on. `recordingFlag.test.ts`, and the controller test "turned off mid-recording still finishes". | Pass |
| Accessibility matrix passes (R8) | RunDev:<br>• **Keyboard only:** Tab from Add recording to Record shows its tooltip on focus; Enter starts; Tab/Enter on **Stop and use** stops. The polite status region announced "Recording saved". **Keep recording** returns focus to Stop.<br>• **200% zoom** (panel 162 px): found **Add recording** overflowing its button and fixed it. Labels now ellipsize inside the button, with the full name in the tooltip, and every card button stays inside its card. At normal width (299 px) nothing is clipped.<br>• **Reduced motion:** the live dot's pulse and the saving spinner use `motion-reduce:animate-none`.<br>• **Not run:** a screen-reader pass and high contrast. | Partial |
| Sprint closes with existing regressions green (R8) | `npm test` full chain green (exit 0) and `./scripts/validate-qa.sh` passed (Codex QA and fast chrome validation, exit 0) on 2026-09-22. | Pass |

## Other scenarios worth recording

- **No-folder destination** (RunDev, folder closed): Record opened "Where should Ritemark save recordings?" before any capture. The AudioContext created in the click survived the picker. The second recording used the remembered folder without asking. **Change** reopened the picker at the current folder, and the new location showed as `…/spike118/voice2`. A closed picker posts `notStarted`, so the microphone is never requested (controller and capture-session tests).
- **Cancel** (RunDev): with more than 5 s of audio, Cancel asks first. Keep recording returns focus to Stop and use. Discard removed the `.part` from the folder: the trash call reported no fallback, but the Trash itself could not be listed from this session.
- **Clearing the pending card** keeps the WAV (RunDev).
- **Signal level**: a 0.3-amplitude synthetic 440 Hz tone recorded at peak 9830 and RMS 6947, against 9830 and 6951 expected. Capture preserves level.

## Not covered in this sprint

- Signed macOS build (TCC with the real bundle ID) and native Windows capture: v1.12.0 release gate.
- A live ElevenLabs run of a recorded file: covered structurally only.
- A screen-reader pass (VoiceOver) and a high-contrast theme check of the recording cards.
- Multi-root destination pick: controller test only.
