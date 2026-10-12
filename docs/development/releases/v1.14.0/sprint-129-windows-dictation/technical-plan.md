# Sprint 129 Technical Plan

Proposed shapes, not final code. When code diverges, update this file first.

## Architecture Overview

```
CI (pinned whisper.cpp v1.8.3)            repo (source commit = product bytes)
build-whisper.yml ──artifacts──▶  extensions/ritemark/binaries/<target>/  + binaries/whisper-manifest.json
  win32-x64   (windows-latest)          │
  darwin-x64  (macos-15-intel)          │  copy-extension-for-target.mjs (already per-target)
  contract test incl. darwin-arm64      ▼
                                  release builds ── validate-build-output.sh (new whisper check)
                                        ├─ Windows: verify-windows-signatures.ps1 signs every unsigned PE (unchanged)
                                        └─ macOS:   codesign-app.sh signs whisper-cli + .dylib (unchanged)

extension host
  voiceDictation/whisperCpp.ts   getWhisperBinaryPath() (no throw, .exe on win32)
                                 probeWhisper() → ready | missing | blocked | cpu-unsupported | failed  (cached)
                                 describeWhisperFailure(exit code / spawn error) → same codes
      ├── ritemarkEditor.handlePrepareDictation: probe ▶ model ▶ ready
      ├── DictationController: coalescing queue (R8), stops on engine failure (R6)
      └── speech/index.ts → WhisperLocalEngine.isReady(): probe ▶ model
webview
  useVoiceDictation → classifyCaptureError (shared with Transcribe Record) → platform copy
  VoiceDictationButton microphone dialog → ui/dialog + Button + Tooltip
```

No new top-level module. Shared logic goes into the existing `voiceDictation/whisperCpp.ts`; the readiness probe and failure mapping live beside `getWhisperBinaryPath()`.

## W0 — Phase 0 audits (A1–A3; R1, R5, R9)

**A1 — Windows build spike** (`research/windows-build-audit.md`). Runs in `build-whisper.yml` on the sprint PR. Two configurations, both from tag `v1.8.3`:

| | Config V (preferred) | Config S (fallback) |
|---|---|---|
| CPU | `GGML_NATIVE=OFF GGML_BACKEND_DL=ON GGML_CPU_ALL_VARIANTS=ON` | `GGML_NATIVE=OFF GGML_AVX2=ON GGML_FMA=ON GGML_F16C=ON` |
| Libraries | `BUILD_SHARED_LIBS=ON` (whisper, ggml, ggml-base, ggml-cpu-* DLLs) | `BUILD_SHARED_LIBS=OFF`, one exe |
| C runtime | `/MD` + `vcruntime140.dll`, `vcruntime140_1.dll`, `msvcp140.dll` copied from the runner's VS redist folder (Microsoft-signed; the signing step preserves them) | static `/MT` (`CMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded`) |
| Always | `WHISPER_SDL2=OFF`, `WHISPER_BUILD_TESTS=OFF`, Release, UTF-8 active-code-page manifest embedded in `whisper-cli.exe` | same |

**Rule:** ship V if it builds and passes the contract test. Otherwise ship S, which raises `0xC000001D` on CPUs without AVX2; R6 maps that to `cpu-unsupported`. Record file list, sizes, `dumpbin /dependents`, and the `system_info` line.

**A2 — Windows speed on Jarmo's machine** (`research/windows-performance-audit.md`). One command on his Windows machine: `scripts/qa/windows-whisper-bench.ps1` downloads the A1 artifact, verifies its SHA-256, reuses `~/.ritemark/models/ggml-large-v3-turbo.bin` (or downloads it once), and runs fixed configurations on `samples/jfk.wav` (11 s, from the whisper.cpp repo) plus an optional `-Audio <path>` for an Estonian recording of his choice. It prints one table: load ms, encode ms, decode ms, total ms per configuration (from whisper's own timing lines), CPU name, core and thread counts. Configurations: threads {4, logical÷2, logical} × beam {8, 5, 1} at 5 s and 10 s of audio, plus one 10-minute file through the Transcribe flags. He pastes the output back.

**A3 — Windows microphone and security behaviour** (`research/windows-mic-audit.md`). Done on Jarmo's machine during the branch test (W8, stage B). Record the `getUserMedia` error name and message for: privacy master switch off; "Let desktop apps access your microphone" off; no input device; microphone held by another app. Also record whether Smart App Control is On / Evaluation / Off on that machine. If no machine has it On, the SAC behaviour is marked **intentionally untested**, and spawn errors (`EACCES`/`EPERM`/`UNKNOWN`) map to `blocked` by reasoning only.

## W1 — Build workflow and binaries (R1, R2)

- `.github/workflows/build-whisper.yml` (shell-tier by its `build-` prefix). Triggers: `workflow_dispatch` plus `pull_request` with a paths filter (the workflow file, `scripts/build-whisper*`, `scripts/qa/whisper-contract-test.*`). `workflow_dispatch` needs the file on `main`, which is frozen until v1.13.0 ships. Standard free runners only, so no repo visibility toggle. No secrets, so it is safe on PRs.
  - Job `win32-x64` (`windows-latest`): checkout whisper.cpp at the pinned commit, configure per A1, build, collect `build/bin/Release/*`, plus VC++ runtime DLLs for Config V.
  - Job `darwin-x64` (`macos-15-intel`): `-DGGML_METAL=OFF -DGGML_NATIVE=OFF -DGGML_AVX2=ON -DGGML_FMA=ON -DGGML_F16C=ON -DBUILD_SHARED_LIBS=OFF` (one static `whisper-cli`; Accelerate BLAS stays on by default). R2 only.
  - Job `contract` (matrix `windows-latest`, `macos-15-intel`, `macos-15` arm64 using the **committed** darwin-arm64 binary): runs `scripts/qa/whisper-contract-test.mjs` against the job's binary and `ggml-tiny.bin` (downloaded from Hugging Face, pinned by SHA-256, cached).
  - Each build job uploads `whisper-<target>.zip` plus `SHA256SUMS`.
- `scripts/qa/whisper-contract-test.mjs` (Node, so it runs on all three runners). Checks: `jfk.wav` transcript contains "ask not what your country"; `-ojf` JSON parses through the same `parseWhisperJson` as the engine; missing audio → exit 2; corrupt model → exit 3; model, audio and output under a folder named `Tõõ-äöü Тест` work; dependency check (`dumpbin /dependents` on Windows, `otool -L` on macOS shows only system libraries and files in the same folder); architecture check (PE machine `x64` / Mach-O `x86_64`).
- `scripts/build-whisper.sh`: pin `WHISPER_CPP_TAG=v1.8.3` and the commit (fail when HEAD differs), and take `--target darwin-arm64|darwin-x64` so local builds match CI. Windows build steps live in the workflow and are not duplicated locally.
- Commit the downloaded artifacts into `extensions/ritemark/binaries/win32-x64/` (and `darwin-x64/`), after checking `SHA256SUMS`. Write `extensions/ritemark/binaries/whisper-manifest.json`:
  ```json
  { "schema": 1, "whisperCpp": { "tag": "v1.8.3", "commit": "2eeeba56…" },
    "targets": {
      "darwin-arm64": { "origin": "local build 2026-01-21 (c42e6b97), upstream commit unrecorded", "files": [{ "path": "whisper-cli", "sha256": "…" }] },
      "win32-x64":   { "origin": "build-whisper.yml run <url>", "config": "V|S", "files": [ … ] },
      "darwin-x64":  { "origin": "build-whisper.yml run <url>", "files": [ … ] } } }
  ```
- `.gitattributes`: `extensions/ritemark/binaries/** binary`, so Git for Windows never rewrites them.
- Fill the empty `extensions/ritemark/binaries/README.md` with provenance, the rebuild procedure, and the MIT notice for whisper.cpp/ggml.
- `scripts/validate-build-output.sh`: new check for the target's whisper folder (files present, architecture right, no other target's whisper folder; SHA-256 equals the manifest **only while unsigned**). Signing rewrites PE and Mach-O files, so hashes are compared only before signing: on macOS in `build-prod.sh:479`, which runs before `codesign-app.sh`, and on Windows in the "Validate unsigned runtime payload" step. The post-signing "Validate build" step sets `RITEMARK_RUNTIME_FILES_SIGNED=1` and gets presence, architecture and signature checks instead. Any Windows tool called with slash flags gets `MSYS_NO_PATHCONV=1` (release skill, v1.11.0 lesson).
- `scripts/copy-extension-for-target.mjs`: replace the darwin-arm64-only post-copy guard with "no foreign `<platform>-<arch>` folder under `binaries/`". Extend its test for all three targets.
- Tier list changes: see W9.

## W2 — Resolver, readiness and failure mapping (R3, R6)

In `voiceDictation/whisperCpp.ts`:

```ts
export function getWhisperBinaryPath(ctx: { extensionPath: string },
  platform = process.platform, arch = process.arch): string {
  const name = platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli';
  return path.join(ctx.extensionPath, 'binaries', `${platform}-${arch}`, name);
}

export type WhisperReadiness = 'ready' | 'missing' | 'blocked' | 'cpu-unsupported' | 'failed';

/** Runs `whisper-cli --help` once per binary path per session (cached promise). */
export function probeWhisper(binaryPath: string): Promise<WhisperReadiness>;

/** Pure: maps spawn errors and exit codes; unit-tested per platform. */
export function describeWhisperFailure(input:
  { spawnErrorCode?: string; exitCode?: number | null; platform: NodeJS.Platform }): WhisperReadiness;
```

- Windows exit codes arrive as unsigned 32-bit values: `3221225501` (`0xC000001D`, illegal instruction) → `cpu-unsupported`; `3221225781` (`0xC0000135`, DLL not found) and `3221225477` (`0xC0000005`) → `failed`. On macOS, signal `SIGILL` → `cpu-unsupported`. Spawn `ENOENT` → `missing`; `EACCES`/`EPERM` → `blocked`; anything else → `failed`. The `--help` exit code (0 or 1 today) counts as `ready`.
- `--help` alone may not execute AVX2 code. With Config V that does not matter. With Config S, `cpu-unsupported` can first appear on the first real call, so both callers map real-call exit codes through the same function (R6).
- The darwin-x64 case without a binary (R2 declined) resolves to `missing`; the caller shows the Apple silicon wording when `platform === 'darwin' && arch === 'x64'`.
- `speech/index.ts`: delete `whisperBinaryPath()`, call `getWhisperBinaryPath()`.
- `WhisperLocalEngine.isReady()`: `probeWhisper()` → R6 reason (`action: 'none'`) → model check (unchanged). Exit-code handling in `runWhisper()` passes non-0/2/3 codes through `describeWhisperFailure()` for its message.
- `ritemarkEditor.handlePrepareDictation()`: `probeWhisper()` first. If not ready, post `dictation:error` with the R6 message and do not call `ensureModelDownloaded()`.
- Copy lives in one table in `whisperCpp.ts` (`WHISPER_READINESS_COPY`), with a Transcribe-only suffix for the ElevenLabs alternative. Final wording is reviewed with `ux-expert`.

## W3 — Flag and engine platforms (R4)

- `features/flags.ts`: `voice-dictation.platforms = ['darwin', 'win32']`, description "Speech-to-text on this computer with Whisper". Update the comment on `transcription-workbench` that says the engine is macOS-only.
- `WhisperLocalEngine.platforms = ['darwin', 'win32']`; remove the `process.platform !== 'darwin'` branch (replaced by W2).
- `package.json`: correct the `ritemark.features.voice-dictation` description. Do not delete the key (HARD RULE #1; stable flags ignore it).
- Tests: add `voice-dictation` platform assertions alongside `src/speech/transcriptionFlag.test.ts`, and add a win32 readiness case to `engineRegistry.test.ts`.

## W4 — Model storage (R7)

- One `getModelDirectory()`/`getModelPath()`, in `voiceDictation/whisperCpp.ts` (it must stay free of `vscode` imports for the contract and unit tests); `modelManager.ts` re-exports them for its existing callers. *(Revised 2026-10-11: the plan first put the single copy in `modelManager.ts`, which imports `vscode`.)*
- Replace `fs.renameSync(partial, final)` with `renameWithRetry()`: on `EPERM`/`EBUSY`/`EACCES`, retry with back-off up to 10 s total, then fail with the existing "Download failed" message. The same helper serves the model-removal unlink. Unit test with an injected `fs`.

## W5 — Dictation coalescing (R8)

`DictationController` (extension host):

```ts
private pending: Buffer[] = [];        // PCM s16le 16 kHz mono, header stripped
private pendingSamples = 0;
private running: Promise<void> | null = null;

handleAudioChunk(wav) → append PCM to pending; if (!running) running = drain();
drain(): while (pending has audio) {
  take up to 28 s → wrap in one WAV header → transcribeAudio → post text in order
}
stopDictation(): mark stopping; await running (which also drains the final chunk); post idle.
backlog > 60 s → stop listening, finish current + pending, post the R8 notice.
```

- WAV in: the webview's `float32ToWav` writes a 44-byte PCM header. Parse defensively (check `RIFF`/`WAVE`/`fmt `/`data`, 16 kHz mono 16-bit), and reject anything else with a log line.
- Temp files: one write per call (the controller's own temp file and `transcribeWav`'s second copy collapse into one; `transcribeWav` already accepts a buffer). Delete it after the child process `exit` event, not on timeout.
- Pure helpers (`splitPending`, WAV header parse/build) are exported for tests. The controller test uses an injected fake transcriber that takes longer than a chunk.
- Webview: no change to chunking. It already sends the remaining audio on Stop; the host now keeps it.

## W6 — Speed settings for CPU-only targets (R9)

Applies when `platform === 'win32' || arch === 'x64'`. Apple silicon arguments stay untouched.

Target on Jarmo's Windows machine: the **median dictation call on 5 s of speech finishes in under 5 s** after the first call, which means the call keeps up and R8 rarely needs to join chunks. Pre-approved levers, applied in order until the target is met, each kept only if A2 shows it helps:

1. **Threads:** the A2-best rule (expected: physical cores, approximated as `max(4, availableParallelism() / 2)`, capped at 8). Applies to dictation and Transcribe.
2. **Beam size for dictation:** 8 → 5 → 1. A lower beam is kept only if the Estonian sample's text does not get visibly worse (A2 prints the outputs side by side for Jarmo to judge).
3. **Default chunk length 10 s** on CPU-only targets (one of the three existing choices; a saved user choice still wins). Whisper's cost per call is nearly flat up to 30 s, so longer chunks halve the work per second of speech.

If the median call is still above 10 s on 5 s of speech after levers 1–3, stop and bring the A2 table to Jarmo with two options: a Vulkan GPU build (larger download, more testing, new CI dependency), or shipping as is with a "may lag on slower computers" note. Transcribe has no speed target; A2's 10-minute time goes into the user docs.

Implementation: `whisperCpp.ts` exports `cpuOnlyDefaults(platform, arch)` → `{ threads, beamSize }`, used by dictation and (threads only) the Transcribe engine. The webview gets `defaultChunkMs` in the editor bootstrap next to `features.voiceDictation`, and `getChunkDuration()` falls back to it.

## W7 — Microphone errors in the webview (R5)

- Editor bootstrap (`ritemarkEditor.ts`, `pdfEditorProvider.ts`, `officePreviewProvider.ts`, all of which already send `features.voiceDictation`) adds `platform: process.platform`. `App.tsx` passes it to `DocumentHeader` → `VoiceDictationButton`.
- `useVoiceDictation.startMicCapture` catch: `classifyCaptureError(err.name, { delegated: isMicrophoneDelegated(), audioInputs: await countAudioInputs() })`. Import from `components/transcribe/recording/capture.ts`; the duplicate `isMicrophoneDelegated`/`countAudioInputs` move there only if the import graph requires it. Hold the code in state, not a string.
- Copy table `dictationMicCopy(code, platform)` in a small pure module beside the hook (`hooks/dictationMicCopy.ts`), unit-tested per platform. After A3, Windows `device-busy` copy says: "Ritemark couldn't start the microphone. Another app may be using it, or Windows may be blocking access."
- Rebuild the permission modal in `VoiceDictationButton.tsx` on `DialogContent`/`DialogHeader`/`DialogBody`/`DialogFooter`, with `Button` + `Tooltip` (house rules: shadcn buttons, single-line labels, tooltips, no native `title`). Primary: **Open Microphone Settings** (posts the existing `system:openMicSettings`). Secondary: **Close**. The dialog opens on `os-denied`, and on Windows also on `device-busy`.
- `ux-expert` reviews the dialog states before code (Phase 3 entry).
- *(Added 2026-10-11, audit §12)* The same dialog shows host-side problems: R6 engine messages, model missing, and the R8 backlog notice. `useVoiceDictation` must stop capture on `dictation:error` **without** clearing the error; today `stopDictation()` clears it at once, so host errors never show.

## W8 — Verification path, no full Windows build before merge (R1–R9)

`build-windows.yml` only builds the exact canonical `origin/main` commit, so the sprint branch cannot produce a Windows installer. Verification has three stages:

- **Stage A — A2 bench** (Phase 0): `windows-whisper-bench.ps1`, the CI binary only, no Ritemark change.
- **Stage B — branch test in the installed app** (Phase 5): `scripts/qa/windows-branch-test.ps1 -Overlay <zip>`. The zip is built on macOS by `scripts/qa/make-windows-test-overlay.sh`: compiled `out/`, `media/webview.js`, `package.json` with a bumped test version, and `binaries/win32-x64/`. The script copies the **installed** app's bundled `extensions\ritemark` into `%TEMP%\rm-s129\ext\ritemark`, lays the overlay over it, and launches the installed `Ritemark.exe` with `--extensions-dir %TEMP%\rm-s129\ext --user-data-dir %TEMP%\rm-s129\ud`. The installed app is not modified. This is the same method as the proven macOS "production shell with branch code" recipe. The whisper binary here is still unsigned.
- **Stage C — Gate 2 on the signed v1.14.0 RC installer**: the whisper files show the Productory signature (Properties → Digital Signatures, or `verify-windows-signatures.ps1 -Mode Verify` on the install folder). The core scenarios are repeated quickly, and the Smart App Control state is recorded.
- **macOS:** RunDev regression on Apple silicon for dictation (R8 change) and Transcribe on-device, then Gate 2 on the arm64 and x64 RCs. Intel Mac hands-on only if Jarmo has one; otherwise the CI contract test on `macos-15-intel` is the evidence, and the gap is stated in the release report.

## W10 — Apple silicon engine for macOS 12+ (R11, added 2026-10-12)

- Replace `binaries/darwin-arm64/` (whisper-cli + 6 dylibs + version symlinks) with the static `whisper-cli` from the `darwin-arm64` job of `build-whisper.yml`, after the `SHA256SUMS` check, in the same commit as the win32-x64 and darwin-x64 payloads. Record it in `whisper-manifest.json` as built by the workflow, not "local build".
- The `DYLD_LIBRARY_PATH` set by both callers stays; it is harmless without dylibs.
- `codesign-app.sh` already signs files named `whisper-cli`; the `.dylib` loop simply finds no whisper dylibs any more.
- The contract test job for the committed binaries (Phase 1) then covers darwin-arm64 on macOS 15 and 14.

## W11 — Bench round 2: every speed candidate (added 2026-10-12)

- **Accuracy on the Mac:** a FLEURS Estonian test sample (CC-BY-4.0; references are FLEURS' normalized transcriptions), scored by WER for whisper large-v3-turbo f16 and q8_0, TalTech et-verbatim-2604 (official GGML, f16 and our q8_0), Parakeet TDT 0.6B v3 int8 (sherpa-onnx `sherpa-onnx-offline`) and TalTech streaming Zipformer et-en int8 (sherpa-onnx online). Script: `scripts/qa/asr-wer.mjs`; result in `research/asr-candidates-audit.md`.
- **Speed on Windows:** bench round 2 runs the Windows candidates on a small FLEURS clip pack (built in CI as artifact `whisper-bench-audio-et`, with references), using official binaries only (whisper-cli from our CI; sherpa-onnx v1.13.8 `win-x64-shared-MD-Release-no-tts`). It reports load and per-clip time, plus WER as a cross-check. Downloads resume and are cached between runs.
- A non-Whisper engine would be a new runtime (ONNX Runtime via sherpa-onnx); adopting one is Jarmo's separate decision after the numbers.

## W9 — Docs, tiers and release notes (R10)

- Tiers: the `CLAUDE.md` shell-tier list, the `scripts/release-extension-preflight.sh` denylist and `SHELL_TIER` in `scripts/list-unshipped-extension-changes.mjs` move from `extensions/ritemark/binaries/agents/` to `extensions/ritemark/binaries/`, in one commit, with `release-tier-paths.test.mjs` and `list-unshipped-extension-changes.test.mjs` updated. The patch 008 line in `CLAUDE.md` is corrected.
- `docs/user/features/transcribe.md`: platform table (Windows, Intel Macs if R2), Windows timing from A2, m4a note. Dictation section in the user docs (macOS + Windows microphone settings, model download, what to expect on slower computers).
- `docs/development/architecture.md`: single resolver, readiness states, binary provenance (manifest + `build-whisper.yml`), remove "macOS only" for on-device Whisper; mark the "two whisper integrations" debt as partly paid (shared resolver/readiness, separate call paths remain).
- `docs/CHANGELOG.md`, v1.14.0 release-notes draft, v1.14.0 release-plan tracker.

## Tests

| Kind | What |
|---|---|
| Unit (host) | `getWhisperBinaryPath` platform/arch matrix; `describeWhisperFailure` codes per platform; `probeWhisper` caching; coalescing order, cap, backlog stop, Stop flush; WAV parse/build; `renameWithRetry`; `cpuOnlyDefaults`; flag platforms; engine registry on win32 |
| Unit (webview) | `dictationMicCopy` per code × platform; hook classification with fake errors |
| Script | `copy-extension-for-target.test.mjs` (foreign folders, all targets); validate-build-output whisper check; `release-tier-paths.test.mjs` and `list-unshipped-extension-changes.test.mjs` (R10) |
| CI | `build-whisper.yml` contract test on three runners |
| Manual | `scenarios.md` matrix in stages B and C |

New test files go into the `npm test` chain in `extensions/ritemark/package.json` (or `test:speech` if Phase 2 splits it, as `test:recording` did).
