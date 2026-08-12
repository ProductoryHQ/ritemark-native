# Sprint 108 Technical Plan — Transcription Workbench

## Architecture Overview

A new extension-host subsystem, `extensions/ritemark/src/speech/`, owns everything about turning audio into a transcript. Two webview surfaces consume it through the existing bridge.

```
                   ┌─────────────────────────────────────────────┐
  activity bar ───►│ TranscribeViewProvider   (webview view)     │
                   │   webview: data-editor-type=transcribe-panel│
                   └──────────────┬──────────────────────────────┘
                                  │ bridge messages
                   ┌──────────────▼──────────────────────────────┐
                   │ src/speech/                                  │
                   │   TranscriptionEngine (interface)            │
                   │   engineRegistry.ts   ← whisperLocal, scribe │
                   │   JobManager.ts       ← queue, progress      │
                   │   SessionStore.ts     ← globalStorage        │
                   │   transcriptMarkdown.ts                      │
                   └──────────────▲──────────────────────────────┘
                                  │ bridge messages
  editor tab ──────►┌─────────────┴──────────────────────────────┐
                    │ TranscriptWorkbenchProvider (custom editor)│
                    │   webview: data-editor-type=transcript-... │
                    └────────────────────────────────────────────┘
```

### Why a new subsystem and not `ai/modelConfig.ts`

CLAUDE.md locks "all AI model identifiers live in `ai/modelConfig.ts`". That rule is written for **LLM model ids** — the things a chat or flow selects. An STT engine is not a model choice; it is a *runtime* with a process or an HTTP client behind it, its own capability set (`supportsDiarization`, `supportsConfidence`, `isLocal`, `platforms`) and its own failure modes. That is the same shape as `src/runtime/AgentRuntime.ts`, which already established the pattern for Claude Code / Codex / ACP.

So: `TranscriptionEngine` + `engineRegistry` in `src/speech/`, mirroring `src/runtime/`. The LLM used by the insights rail (R10) still comes from `ai/modelConfig.ts` — no model ids are introduced anywhere else. **This is the item for the Sprint Architecture Gate.**

### Bundle-safe host code (Sprint 92 rule)

`src/speech/` is bundled into `out/extension.js` by esbuild. Therefore:
- No `__dirname`-relative depth math. The whisper binary is resolved from `context.extensionPath` exactly as `voiceDictation/whisperCpp.ts` does today.
- No new native dependency. ElevenLabs is called with `https` / `fetch`, multipart assembled by hand or with an already-bundled helper — **no new runtime dep added to `external`**.
- The whisper child process is spawned, not imported; nothing new needs its own entry point.

---

## Phase 0 — Audits — COMPLETE (2026-08-12)

All three ran before any implementation. Results are in `research/`; the plan below is already updated for them. Summary:

- **[A1](research/audio-transfer-audit.md) — the transfer problem does not exist.** whisper-cli reads mp3/wav/flac/ogg natively; only m4a/aac need conversion, and macOS `afconvert` does that host-side in **1.2 s for a 60-minute file**. The webview decode path and the chunked bridge transfer are cancelled.
- **[A2](research/whisper-longrun-audit.md) — the local engine is fast.** 60 min of audio in **154 s (23.5× realtime)**, 2.47 GB peak RSS. `-ojf` gives ms offsets and per-token probability; `-pp` reports progress on stderr in 5 % steps; SIGTERM is clean. **Trap: undecodable audio exits 0** — success must be judged on parsed output, not exit code.
- **[A3](research/webview-audio-audit.md) — playback and seeking work.** Seek to 45:00 in a 42 MB file took **223 ms with two buffered ranges**, so range requests are served. No host-side range-serving fallback. First play requires a real user gesture.
- **[Prior art](research/elevenlabs-prior-art.md)** — a shipped Scribe integration in `productory-videomark`: `xi-api-key` header, `fetch` + `FormData` (no new dependency), majority-vote speaker folding. Its 300 s windowing must **not** be copied.

<details>
<summary>Original audit briefs (kept for the audit trail)</summary>

Per the SDD skill's audit-first rule, three unknowns get written up in `research/` **before** code:

### A1 — Large-file audio transfer (`research/audio-transfer-audit.md`) — blocks R5
The local engine needs 16 kHz mono 16-bit WAV. 60 min ≈ 115 MB. That cannot be one base64 `postMessage`.

Options to measure with `long-meeting.m4a`:
1. **Webview decodes, streams to host in chunks** — `decodeAudioData` on an `OfflineAudioContext({sampleRate: 16000, numberOfChannels: 1})` (decode resamples, so peak memory is ~1/8 of a 44.1 kHz stereo decode), then post fixed-size chunks the host appends to a temp WAV.
2. **Host decodes** — requires a decoder in the host; with no ffmpeg (D6) this means a JS decoder dependency. Measure only if 1 fails.
3. **Reduce scope** — accept `.wav` for on-device and route compressed formats to ElevenLabs. Fallback of last resort; would change R5's acceptance criteria and needs Jarmo.

Record: peak memory, wall-clock, whether the renderer stalls, chunk size chosen.

### A2 — whisper-cli on long files (`research/whisper-longrun-audit.md`) — blocks R3
Run the bundled `binaries/darwin-arm64/whisper-cli` directly on the 60-minute fixture and record: the exact segment/timestamp output format to parse (`--output-json` vs stdout), what progress information is emitted (`--print-progress`), memory and wall-clock on M-series, and whether SIGTERM terminates cleanly with no orphan. Confirms that the 30 s timeout and `--no-timestamps` in `whisperCpp.ts` are the only blockers, and fixes the flag set for the new path.

### A3 — Audio playback in a webview (`research/webview-audio-audit.md`) — blocks R7
`drawioEditorProvider.ts` documents that webview resource serving has sharp edges (iframe navigations bypass the service worker). Verify: an `<audio>` element with `asWebviewUri(<workspace .m4a>)` and `localResourceRoots` including the audio's folder actually plays; seeking works (range requests); large files stream rather than buffer whole; and behaviour when the file is outside the workspace. If it fails, the fallback is a host-side range-serving message channel — measure before designing the player.

**Gate:** if A1 lands on option 3, or A3 has no working path, stop and re-scope with Jarmo before Phase 3.

</details>

**Gate outcome: passed.** No re-scope needed; the sprint got smaller, not larger.

---

## Workstream 1: Engine abstraction and job pipeline (R2, R3, R4)

### Extension host

New files under `extensions/ritemark/src/speech/`:

| File | Responsibility |
|---|---|
| `types.ts` | `TranscriptSegment`, `TranscriptWord`, `Speaker`, `TranscriptSession`, `JobState` |
| `TranscriptionEngine.ts` | The interface: `id`, `label`, `isLocal`, `platforms`, `capabilities {diarization, confidence, wordTimestamps}`, `isReady(ctx)`, `estimateCost(durationSec)`, `transcribe(input, opts, progress, token)` |
| `engineRegistry.ts` | Registration + lookup + "which engines are usable right now on this platform" |
| `engines/whisperLocalEngine.ts` | Spawns `whisper-cli` with the A2 flag set (`-ojf -pp -l auto`, **no timeout**); parses ms offsets + per-token `p` from the JSON sidecar; progress from stderr `/progress\s*=\s*(\d+)%/`; `child.kill()` for cancel. **Success = exit 0 AND parseable JSON AND ≥1 segment** — never exit code alone (A2 trap). `capabilities.diarization = false`, `capabilities.confidence = true` |
| `engines/elevenLabsEngine.ts` | `fetch` + `FormData` + `Blob` (no new dependency), header **`xi-api-key`**, `model_id: scribe_v2`, `diarize: true`, `timestamps_granularity: 'word'`. **One request for the whole file — no windowing** (speaker identity is per-request). Folds `words[]` (`type === 'word'`) into segments with **majority-vote speaker per segment** and a **flush on speaker change**; carries `logprob` for R9; maps `{detail: string \| {message}}` to typed errors, splitting fatal (bad key, rejected file) from retryable |
| `JobManager.ts` | Single-flight queue, state machine, progress events, cancellation, temp-file cleanup, persistence of in-flight jobs to `globalState` for the interrupted-job path |
| `SessionStore.ts` | CRUD over `context.globalStorageUri`; key = audio path + size + mtime fingerprint; size accounting for Settings |
| `transcriptMarkdown.ts` | Session → markdown (front matter, speaker headings, timestamps, insights). Pure and unit-testable |
| `audioPrep.ts` | Format gate → pass-through for mp3/wav/flac/ogg, `afconvert -f WAVE -d LEI16@16000 -c 1` for m4a/aac → temp-file lifecycle → peak extraction (~2000 points from a 16 kHz mono WAV) |

Existing `voiceDictation/` is left alone this sprint (live dictation must not regress, R3). `modelManager.ts` is imported by `whisperLocalEngine` rather than duplicated. A later sprint can collapse both callers onto one Whisper integration — noted in architecture.md TO-BE, not done here.

### Webview side

Bridge messages (all namespaced `transcribe:`):

`transcribe:import`, `transcribe:estimate`, `transcribe:start`, `transcribe:cancel`, `transcribe:jobs`, `transcribe:progress`, `transcribe:session`, `transcribe:renameSpeaker`, `transcribe:export`, `transcribe:insights:*`, `transcribe:enginesStatus`.

(`transcribe:audioChunk` was dropped after A1 — no audio bytes cross the bridge.)

Typed at the module boundary; `bridge.ts` stays stringly-typed as today (#106 is out of scope, but no new untyped sprawl — the message union lives in one file shared by both sides).

### Tests

Unit: `transcriptMarkdown` round-trip; ElevenLabs word→segment folding incl. speaker runs and unassigned words; `JobManager` state machine incl. cancel and restart-recovery; engine registry platform filtering (Windows excludes whisperLocal); cost estimation.
Manual: scenarios.md § Job pipeline, § On-device, § ElevenLabs.

---

## Workstream 2: Settings and key storage (R4, R13)

### Extension host
- `RitemarkSettingsProvider.ts`: add `elevenlabs-api-key` to the SecretStorage key list documented at ~line 500, and to the generic store/test handlers (the store path at ~line 320 is already generic on `message.key`).
- Add a `testApiKey` path for ElevenLabs (a cheap authenticated GET) matching the existing per-provider test buttons.
- `features/flags.ts`: add `transcription-workbench`, `status: 'stable'`, `platforms: ['darwin', 'win32']`.
- Settings surface for session-store size + **Clear transcription data** (R12).

### Webview side
- `components/settings/RitemarkSettings.tsx`: an ElevenLabs card in the existing API Keys section, following the OpenAI/Google/Anthropic/OpenRouter pattern already there — save, masked display, test. **Do not restructure the settings page** (v1.3.0 regression rule).

### Tests
Unit: flag platform gating. Manual: scenarios.md § Platform and failures.

---

## Workstream 3: Transcribe activity-bar app (R1, R13)

### Extension host
- `package.json`: `viewsContainers.activitybar` gets `ritemark-transcribe` (icon `media/transcribe-icon.svg`, a new Lucide-style audio-lines mark); `views` gets `ritemark.transcribeView`.
- `src/views/TranscribeViewProvider.ts` — modelled directly on `AgentLibraryViewProvider`: webview view, `data-editor-type="transcribe-panel"`, subscribes to `JobManager` events, badge updates via `webviewView.badge`.
- `extension.ts`: register behind `isEnabled('transcription-workbench')`.

### Webview side
- `components/transcribe/TranscribePanel.tsx` (+ `RecordingRow`, `EngineStatusCard`, `DropZone`), lazy-loaded from `main.tsx` on `data-editor-type === 'transcribe-panel'`, same pattern as `flows-panel` / `ai-sidebar`.
- Buttons use the shadcn `ui/button` component (variant + size) — no hand-rolled `<button>`, single-line labels.
- Styling from Ritemark tokens; sidebar surfaces use `--r-surface-muted` as `main.tsx` already does for panel types.

### Tests
Manual: scenarios.md § Transcribe app and import, § Platform and failures.

---

## Workstream 4: Workbench editor, playback, speakers, confidence (R6, R7, R8, R9)

### Extension host
- `src/transcriptWorkbenchProvider.ts` implementing `vscode.CustomReadonlyEditorProvider<TranscriptDocument>` — the document is a binary audio file, so this is the `pdfEditorProvider` shape, not `CustomTextEditorProvider`.
- `package.json` `contributes.customEditors`: `ritemark.transcriptWorkbench` for `*.m4a`, `*.mp3`, `*.wav`, `*.flac`, `*.ogg`, `*.aac`, `priority: "default"`.
- `webviewOptions.retainContextWhenHidden: true` (as drawio does); `localResourceRoots` must include the audio file's folder, and the CSP needs `media-src ${cspSource}` (A3).
- **Priority contest:** `vscode.audioPreview` already claims `*.{mp3,wav,ogg,oga}` at `builtin`. `default` should outrank it — verify in the first Phase 4 task; fallbacks are "Reopen Editor With…" or stripping `media-preview` from the build.

### Webview side
`components/transcribe/workbench/`:
- `Workbench.tsx` — layout shell, session loading, scroll restoration
- `PlayerBar.tsx` — plain `<audio>` element with `asWebviewUri`, play/pause, time, speed, seek. No host-side range channel (A3 confirmed range requests are served). **Never auto-play**: the first `play()` must ride a real user gesture
- `Waveform.tsx` — canvas render from the stored peak array (**no waveform library** — bundle budget #107)
- `TranscriptPane.tsx` / `Segment.tsx` — segment list, active highlight, click-to-seek, manual-scroll yield
- `SpeakerBar.tsx` / `RenamePopover.tsx` — chips, stable colour assignment by speaker index, rename with affected-segment count
- `ConfidenceMark.tsx` — amber dotted marking driven by `logprob`, absent when the engine reports none

Speaker colours: a fixed ordered palette derived from Ritemark tokens (indigo first, then a small set that stays inside the design system — no rainbow tagging).

### Tests
Unit: segment→active-index selection from `currentTime`; rename reducer over segments; peaks downsampling. Manual: scenarios.md § Workbench and playback, § Speakers, § Confidence.

---

## Workstream 5: Insights rail (R10)

### Extension host
- `src/speech/insights.ts` — builds prompts from the session and calls the **existing** agent runtime through `src/runtime/`; model ids come from `ai/modelConfig.ts`. Each insight item must carry a `t` (seconds) parsed from the model's cited timestamp; items whose timestamp cannot be resolved to a segment are dropped rather than shown uncitable.
- Results stored on the session (R12), regenerable, cancellable.

### Webview side
- `components/transcribe/workbench/InsightsRail.tsx` — cards per prototype, generated-content label naming the model, timestamps as seek buttons, generating/failed states.

### Tests
Unit: timestamp→segment resolution incl. the unresolvable case. Manual: scenarios.md § Insights.

---

## Workstream 6: Export and session store (R11, R12)

### Extension host
- `transcriptMarkdown.ts` (Workstream 1) plus an export command: resolve target folder (setting, default `Transcripts/` in the workspace root), write, `vscode.window.showTextDocument` in the Ritemark editor.
- Auto-export on job completion — the D5 mitigation. Same writer, no user action.
- Overwrite policy: confirm, or numbered sibling.
- `SessionStore` relink flow for moved audio (R12), delete that never touches audio or exports.

### Tests
Unit: markdown output shape incl. front matter and renamed speakers; target-path resolution incl. no-workspace-open. Manual: scenarios.md § Export, § Sessions.

---

## Files touched (summary)

**New:** `src/speech/**` (10 files), `src/views/TranscribeViewProvider.ts`, `src/transcriptWorkbenchProvider.ts`, `webview/src/components/transcribe/**` (~11 components), `media/transcribe-icon.svg`, `docs/development/sprints/sprint-108-*/research/**`.

**Modified:** `package.json` (viewsContainers, views, customEditors), `src/extension.ts` (3 registrations), `src/features/flags.ts`, `src/settings/RitemarkSettingsProvider.ts`, `webview/src/main.tsx` (2 routes), `webview/src/components/settings/RitemarkSettings.tsx` (one card), `webview/src/bridge.ts`, `docs/development/architecture.md`.

**Deliberately not modified:** `src/voiceDictation/**` — live dictation must not regress.

## Verification

Beyond the unit tests: Phase 5 is a self-driven dev-mode pass (`/rundev`) where every scenario in scenarios.md is exercised by Claude with the real fixtures — including the 60-minute file — before Jarmo is told it is ready to validate. Bundle size after the new surfaces is reported explicitly against the #107 baseline.
