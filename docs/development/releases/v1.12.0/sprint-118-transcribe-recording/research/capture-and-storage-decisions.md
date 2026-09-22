# Sprint 118 Phase 0 — Capture and Storage Decisions

**Status:** **Approved 2026-09-22** by Jarmo ("kinnitan, alusta koodiga"): the §5 freeze, including the 2 h warning and 4 h stop, the remembered no-folder location, the visible `.wav.part` with recovery, and the real-microphone check on a signed build.<br>
**Spec anchors:** R1–R8 and "Phase 0 Decisions" 1–7 in [spec.md](../spec.md)<br>
**Earlier evidence:** [current-state-audit.md](./current-state-audit.md), 2026-09-13

## 0. Is the audit still current?

Checked on 2026-09-22 against main `d8d90ad7`. It is.

- No commit touched the audited code after 2026-09-13. `git log --since=2026-09-13` finds nothing for `src/speech/`, `src/views/TranscribeViewProvider.ts`, `webview/src/components/transcribe/`, `src/voiceDictation/`, or `webview/src/hooks/useVoiceDictation.ts`.
- The seams the plan builds on still exist:
  - `TranscribeViewProvider._stageImport(audioPath)` (line 162) and `_start(engineId, language)` (line 192). The file picker is labelled "Add recording" (line 152).
  - `JobManager.enqueue(request)` (line 114).
  - `TranscribePanel.tsx` has the **Add recording** button (line 117).

## 1. What reading the code settled

| ID | Finding | Consequence for Phase 0 |
|---|---|---|
| D1 | The Transcribe webview's CSP is `default-src 'none'; script-src 'nonce-…'` (`TranscribeViewProvider.ts` line 389). It has no `worker-src`, no `blob:`, and no `${webview.cspSource}` in `script-src`. | `audioWorklet.addModule(url)` would be blocked as it stands. The spike must test the narrowest allowance, `script-src` plus `${webview.cspSource}` for one module in `media/`, against the ScriptProcessor fallback. |
| D2 | Dictation captures with `createScriptProcessor(4096, 1, 1)` and resamples to 16 kHz in JavaScript (`useVoiceDictation.ts` lines 35, 233). | The resampler is reusable as a reference. ScriptProcessor is deprecated but works in this Electron; the spike measures whether it keeps up over an hour. |
| D3 | Patch 004 lists `media` among the webview permissions on every platform. On macOS it asks for OS microphone access through `systemPreferences.askForMediaAccess` when needed. It also delegates the `microphone` Permissions-Policy to webview iframes (GH #116, Electron 39). | The recording path should need **no patch or shell change**. Phase 0 still has to prove this in a packaged app on macOS and Windows (spec decision 6). |
| D4 | Dictation's flag is macOS-only; `transcription-workbench` is cross-platform (`features/flags.ts`). | The new `transcribe-direct-recording` flag must stand alone and be cross-platform (audit F15). |

## 2. Decisions

### 2.1 Destination (spec decision 2): direction decided 2026-09-22

**Jarmo:** "enne funktsiooni lubamist küsi, et kuhu salvestada (kui pole kaustas)". In English: before the feature is used, ask where to save, when no folder is open.

- **With a workspace folder open,** the recording is saved inside the project, so it belongs to that project in the Transcribe library. That fits the library's project scoping.
- **With no folder open,** Ritemark asks where to save **before recording starts** (a folder picker). It never records into a hidden location.

Still to freeze in Phase 0, proposed here:
- **In-project folder:** `recordings/` at the root of the workspace folder, created on first use.
- **Multi-root:** use the folder that contains the active editor's file. If there is none, ask once with a quick pick.
- **File name:** `Recording YYYY-MM-DD HH.MM.wav` in local time, with a ` (2)` suffix on a collision; never overwrite.
- **No-folder location:** remember the chosen folder (global state) and show it in the recording panel with a "Change" action. Or ask every time; this is Jarmo's call.

### 2.2 Capture format and transport (spec decision 1): proposed, to be measured

This is the spec's baseline: 16 kHz, mono, 16-bit little-endian PCM, about 32 KB/s or 115 MB/hour. The webview sends one raw-PCM chunk per second, about 43 KB as base64. Each chunk carries `sessionId` and `sequence`, and the host acknowledges it. At most N chunks may be unacknowledged; N is to be measured and is expected to be around 4.

### 2.3 Session, stop and recovery (spec decisions 3 and 4): to freeze

Per spec R3, R4 and R6: one active session per app, and a non-interruptible Stop. The file grows as `.wav.part` and is renamed to `.wav` only after validation. An interrupted `.part` is offered for recovery the next time the panel opens.

### 2.4 Length (spec decision 5): to decide from measurements

## 3. Spike results so far (RunDev, 2026-09-22)

The experiments ran in the real Transcribe webview, reached over DevTools. No product code was changed. CDP evaluations were marked as user gestures, which a Record click provides in real use. Harness: `spike118/harness.js` in the session scratchpad, not committed.

| # | Experiment | Result | Consequence |
|---|---|---|---|
| S1 | `audioWorklet.addModule()` from a blob URL and from a data URL, under the current CSP | Both `AbortError: Unable to load a worklet's module`. The default `AudioContext` runs at **48,000 Hz** and starts **suspended** until a user gesture. | An AudioWorklet needs a CSP change: `script-src` plus `${webview.cspSource}` for a module shipped in `media/`. Otherwise use ScriptProcessor. The context must be resumed inside the Record click. |
| S2 | ScriptProcessor (4096) on a synthetic 440 Hz source, 10 s | 475,136 of about 480,000 samples, ratio 0.99. Callbacks about every 85 ms, largest gap 151 ms. | ScriptProcessor keeps pace. The shortfall is the one start-up buffer, not drift. |
| S3 | The same capture with Transcribe hidden (Search view shown) for 80 s | Ratio 0.998, no gap over 400 ms, heap steady at 36 MB. | A hidden panel does not pause capture (`retainContextWhenHidden: true`). A retained webview reports `document.hidden === false` even when hidden, so hiddenness can't be detected that way. It isn't needed. |
| S4 | One hour of synthetic capture | Normal for **340 s**. Then the context turned **`suspended` silently**: sample count frozen, no error, while the wall clock ran on for the rest of the hour. Heap steady at 36 MB, so there was **no leak**. The suspension coincided with opening a second `AudioContext` and a pending `getUserMedia` (S5). | **Critical for R6/R7.** (1) Elapsed time shown to the user must come from **samples written**, never the wall clock. (2) The recorder must listen for `statechange` and a track's `ended`/`mute`, try one `resume()`, and otherwise **stop and finalize honestly** with a visible reason. It must never go on "recording" silence. |
| S5 | `getUserMedia({audio: true})` in the Transcribe webview | Pending for more than 15 s, while `permissions.query` already said `granted` and the devices were listed by name. Patch 004's handler waits for the macOS microphone prompt to be answered. | The UI needs a **"Waiting for microphone permission…"** state with **Cancel**, because the request can hang until the user answers the OS dialog. |

| S4b | Reproduce S4: while a capture runs, open, resume and close a second 16 kHz `AudioContext`, then call `getUserMedia` | The running capture stayed `running` throughout, with ratio 0.996 and no state change. | Neither a second context nor a failing `getUserMedia` suspends a capture. S4's likely trigger is OS-level: the pending macOS microphone prompt or input-device activation on a Mac with many virtual audio devices. The design must handle suspension from **any** cause (S4 consequence stands). |
| S6 | `getUserMedia` after S5 | `NotFoundError: Requested device not found`, although inputs had been listed by name moments before. | The dev build shares the bundle ID `ai.productory.ritemark` with the installed signed app but is signed differently, so macOS's microphone permission (TCC) is unreliable for it. **The real-microphone check belongs on a signed candidate.** Map `NotFoundError` to "No microphone available" in the UI. |

Still open: the real-microphone capture on a signed build; host-side transport and the file sink (a Phase 1 prototype with tests); and Windows.

## 5. Proposed freeze, for Jarmo's Phase 0 approval

| Topic | Proposal | Why |
|---|---|---|
| Capture node | ScriptProcessor (4096) in the Transcribe webview. No CSP change. | S2–S3: it keeps pace, including hidden, and the CSP stays as it is. AudioWorklet would widen `script-src` for no measured gain. Revisit if Chromium removes ScriptProcessor. |
| Sample rate | Try `AudioContext({ sampleRate: 16000 })` first, so the browser resamples. Fall back to the device rate plus dictation's JavaScript resampler if the 16 kHz context fails. | A native resampler is better quality than linear interpolation; the fallback is already proven by dictation. Confirm on the signed build. |
| Format and transport | 16 kHz mono 16-bit PCM WAV, sent in 1-second chunks of about 43 KB (base64) with `sessionId` and `sequence`. The host acknowledges each chunk; at most 4 may be unacknowledged, and if more pile up the recording stops and finalizes with a reason. | Small messages. The bound protects memory without dropping audio silently. |
| Elapsed time | Computed from samples written. | S4: the wall clock lies after a suspension. |
| Suspension or device loss | On `statechange` to suspended, a track `ended`, or `NotFoundError`: one `resume()` attempt. If that fails, stop and finalize what was recorded, with a visible reason. | S4 and S6. |
| Permission | Show "Waiting for microphone permission…" with Cancel until `getUserMedia` settles. Show denial and "No microphone available" as distinct states. | S5 and S6. |
| Destination | As decided on 2026-09-22. In the project: `recordings/` in the workspace folder. Multi-root: the active file's folder, otherwise ask once. No folder: ask before recording, remember the choice, and show it in the panel with Change. | Jarmo's direction, plus the proposals in §2.1. |
| Partial file | Write `Recording … .wav.part` in the destination folder, and rename it to `.wav` on a validated Stop. On the next panel open, offer to recover or discard any `.part` left behind. | The rename is atomic on the same volume, so there's no cross-volume copy. The user can see and delete it. Recovery follows R6. |
| Length | Warn at 2 hours (about 230 MB). Stop at 4 hours (about 460 MB), well under WAV's 4 GB limit. | Protects the disk and matches realistic meeting lengths. |
| Flag | `transcribe-direct-recording`: experimental, default on, cross-platform. | Spec R8. |
| Delivery tier | No patch or shell change. Patch 004 already grants webview microphone access on every platform. | D3; the signed build confirms. |

## 4. The spike plan (original)

Run in the sprint worktree's RunDev. Only the microphone test needs a person there, for one macOS permission click. The long runs use a synthetic source.

1. **Worklet or ScriptProcessor:** load an AudioWorklet module under the narrowed CSP; if it's refused, measure ScriptProcessor.
2. **Real device:** the actual input sample rate on this Mac, and the resampled output checked by `durationProbe` and playback.
3. **Transport:** 1-second chunks to the host with acknowledgement; measure latency and behaviour when the host is slow.
4. **One hour with an `OscillatorNode` source:** webview and host memory, file size against the expected 115 MB, and drift between elapsed time and samples written.
5. **Interruption:** reload the panel and quit the app mid-recording; check what the `.part` file holds and whether it can be recovered.
6. **Windows:** the same capture on a Windows machine or the CI runner, later in Phase 0 or at the release gate.
