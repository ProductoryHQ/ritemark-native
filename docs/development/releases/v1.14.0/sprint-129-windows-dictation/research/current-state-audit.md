# Sprint 129 — Current-State Audit (Phase 1 research)

**Date:** 2026-10-11 · **Base:** `main` at `542bee6c` · **Method:** code reading in this worktree, plus GitHub API reads of `ggml-org/whisper.cpp`. Nothing here was run on Windows. Every claim about Windows runtime behaviour is marked as **to be observed** in Phase 0.

## 1. What ships today

| Target | Whisper payload | Source |
|---|---|---|
| darwin-arm64 | `extensions/ritemark/binaries/darwin-arm64/` — `whisper-cli` + 6 dylibs (+ version symlinks), ~3.4 MB, **committed to git** | Built by `scripts/build-whisper.sh` on 2026-01-21 (commit `c42e6b97`). The script clones whisper.cpp HEAD (`build-whisper.sh:52`), so the exact upstream commit is not recorded. `libwhisper.dylib` contains the version string `1.8.3`. Metal on |
| darwin-x64 | none | #203 |
| win32-x64 | none | #133 |

## 2. Two callers, one binary

- **Dictation:** `voiceDictation/whisperCpp.ts`. `getWhisperBinaryPath()` (`:233`) resolves only `darwin-arm64` and **throws** `Unsupported platform: …` (`:242`) for anything else. Flags: `--threads 4`, `--beam-size 8`, entropy/logprob thresholds, `--no-timestamps`, 30 s timeout (`:183`). A new process loads the 1.5 GB model for every chunk.
- **Transcribe on-device engine:** `speech/engines/whisperLocalEngine.ts`. Its path comes from a second resolver, `speech/index.ts:33`, which never throws and does not add `.exe`. `platforms = ['darwin']` (`:159`); `isReady()` returns "not available on Windows yet" for any non-darwin platform (`:173`) and "missing from this build" when the file is absent (`:181`). That is the message Intel Mac users see today (#203).
- Both set `DYLD_LIBRARY_PATH`, which is harmless on Windows. Windows finds DLLs beside the `.exe` on its own.
- **Gap for Windows:** neither resolver appends `.exe`. libuv's spawn would find `whisper-cli.exe` from the bare name, but `fs.existsSync()` would not, so readiness would report the engine as missing.

## 3. Feature gate

- `voice-dictation` (`features/flags.ts:154`): `status: 'stable'`, `platforms: ['darwin']`, description "Speech-to-text using Whisper (macOS only)".
- `isEnabled()` checks the **OS only, not the CPU architecture** (`features/featureGate.ts`). Intel Macs therefore see the dictation button.
- `package.json` still has a setting `ritemark.features.voice-dictation` described as "experimental, macOS only … ~75MB". Stable flags ignore their setting, so the text is stale but has no effect.
- `transcription-workbench` already ships on all three platforms; only its on-device engine is darwin-only.

## 4. Intel Mac dictation fails silently today (from reading the code; Phase 2 adds a unit test to confirm it)

1. The flag passes on darwin, so the mic button is shown.
2. `handlePrepareDictation` (`ritemarkEditor.ts:1526`) checks only the model and offers the **1.5 GB download** without checking whether a binary exists.
3. Every audio chunk calls `getWhisperBinaryPath()`, which throws `Unsupported platform: darwin-x64`.
4. `DictationController.handleAudioChunk` stops dictation only on `binary not found` / `Model not found` (`controller.ts:124`). Every other error is swallowed: the button keeps "listening" and no text ever appears.

Windows would hit the same class of failure for any error that is not "binary not found" (blocked executable, missing DLL, unsupported CPU). Readiness has to be decided **before** the download, and engine failures have to stop dictation with a reason.

## 5. Dictation drops audio while busy

`controller.ts:50` returns early when the previous chunk is still transcribing, and that chunk's audio is gone. On Apple silicon one call takes roughly 1–3 s against a 5 s chunk, so drops are rare. On a CPU-only Windows machine one call may well take longer than the chunk (to be measured in A2), and then words would be lost routinely. The same early return drops the final chunk that the webview sends on Stop whenever a transcription is still running. Whisper pads every call to a 30 s window, so the cost of a call is roughly constant: joining the waiting audio onto the next call keeps up without falling further behind.

## 6. Microphone errors

- Dictation (`webview/src/hooks/useVoiceDictation.ts:286–302`) has its own mapping with macOS-specific wording ("macOS blocked access to it"). Its modal (`VoiceDictationButton.tsx`) is hand-rolled HTML/CSS with native `<button>`s, gives only the System Settings path, and is labelled "Open System Settings".
- Transcribe Record already has a shared classifier `classifyCaptureError` (`webview/src/components/transcribe/recording/capture.ts:173`) with codes `os-denied | no-device | device-busy | internal-config | unexpected`, host copy in `speech/recording/types.ts`, and a Windows-aware settings button (`RecordingCards.tsx`, `TranscribeViewProvider.ts`: `ms-settings:privacy-microphone`).
- `utils/openExternal.ts` `openMicrophoneSettings()` already opens `ms-settings:privacy-microphone` on win32, so the dictation host side needs no new code for this.
- **To be observed (A3):** which `getUserMedia` error Ritemark's Electron raises on Windows when "Let desktop apps access your microphone" is off, when there is no microphone, and when another app holds it.

## 7. Model storage

- Model: `~/.ritemark/models/ggml-large-v3-turbo.bin` (`modelManager.ts:48`). A second copy of `getModelPath()` sits in `whisperCpp.ts:248`.
- On Windows `os.homedir()` is `C:\Users\<name>`, so the model lands in `C:\Users\<name>\.ritemark\models\`. Ritemark already keeps per-user state in `~/.ritemark` on Windows (`update/userExtensionInstaller.ts`: `~/.ritemark/extensions/`, plus the starter-pack marker), and VS Code uses `~/.vscode`. The issue text assumed macOS uses `~/Library`; it does not.
- `fs.renameSync(partial → final)` (`modelManager.ts:281`) has no retry. On Windows, antivirus scanning a freshly written file commonly fails the rename with `EPERM`/`EBUSY` for a short while. This is a known Windows pattern (graceful-fs retries renames for this reason), not yet observed for Ritemark.

## 8. Transcribe audio formats on Windows

`speech/audioPrep.ts:60`: m4a/aac conversion relies on macOS `/usr/bin/afconvert`. On Windows the on-device engine can read mp3/wav/flac/ogg and Ritemark's own Record files (WAV). m4a/aac get the existing message "Use .mp3 or .wav, or transcribe with ElevenLabs". There is no waveform for on-device files on Windows; the player already falls back to a seek bar.

## 9. Build, bundling and signing pipeline

- **Staging:** `scripts/copy-extension-for-target.mjs:30` already copies `binaries/<platform>-<arch>/` only into the matching target. A `binaries/win32-x64/` or `binaries/darwin-x64/` folder flows into the right build with no change. The post-copy guard (`:80`) checks only for a stray `darwin-arm64` folder.
- **Windows signing:** `scripts/verify-windows-signatures.ps1 -Mode PrepareSigning` finds **every PE by content** and catalogues every unsigned one for Azure Artifact Signing. Vendor-signed files keep their signature. `Verify` then requires a valid, timestamped signature on every PE. New whisper `.exe`/`.dll` files are signed by the existing step, with no script change. `scripts/codesign-windows.sh` (agents-only list) is not what CI uses.
- **macOS signing:** `scripts/codesign-app.sh` signs every `.dylib` (5b) and every file named `whisper-cli` (`:398–407`). darwin-x64 whisper files are covered without change.
- **Patch 008** (`008-ritemark-windows-binary-strip.patch`) adds `build/.moduleignore` rules that strip cross-platform native binaries from the bundled Copilot and Agent SDK packages so `rcedit` does not choke. It does **not** touch `extensions/ritemark/binaries/`. MSVC Release builds keep debug info in separate `.pdb` files, which we do not ship. **No patch and no submodule change is needed.** The `CLAUDE.md` patch-table line ("Strip debug symbols from Windows agent binaries") misdescribes 008.
- **Validation:** `scripts/validate-build-output.sh` checks agent runtimes but has **no whisper check** on any target. A missing binary would ship silently.
- **Release tiers:** the shell-tier list names `extensions/ritemark/binaries/agents/` only. `scripts/list-unshipped-extension-changes.mjs` classifies `binaries/<platform>/` changes as "unshipped", so an extension release stops on them, which is correct. They are not formally shell-tier, though.
- **Windows app builds** (`build-windows.yml`) accept only the exact canonical `origin/main` commit (`verify-release-source.sh`). A sprint branch cannot produce a Windows installer. Pre-merge Windows testing therefore has to layer branch code onto an installed release.
- **`workflow_dispatch`** only works for workflow files that exist on the default branch. While `main` is frozen, a new whisper build workflow must also trigger on `pull_request` so that it can run from the sprint PR.

## 10. Upstream whisper.cpp facts (GitHub API, 2026-10-11)

- Latest release: v1.9.5 (2026-10-06). The bundled macOS binary is 1.8.3. Tag `v1.8.3` → commit `2eeeba56e9edd762b4b38467bab96c2517163158`.
- v1.8.3 publishes `whisper-bin-x64.zip` (3,968,674 bytes, sha256 `d824b1e3…321d`). Upstream's Windows CI job configures with `-DBUILD_SHARED_LIBS=ON -DWHISPER_SDL2=ON` and otherwise upstream defaults. Its CPU baseline and C runtime dependency are not under our control, so we build our own instead of redistributing that zip.
- v1.8.3's ggml supports `GGML_BACKEND_DL=ON` + `GGML_CPU_ALL_VARIANTS=ON` on x86 **including MSVC** (MSVC gets fewer variants: x64, sse42, sandybridge, haswell, skylakex, …). The library picks the best CPU variant at runtime, so an older CPU does not crash on an AVX2 instruction. `whisper-cli` calls `ggml_backend_load_all()` at start.
- v1.8.3 `whisper-cli` on Windows reads command-line arguments **in the system code page** (comment in `examples/cli/cli.cpp`). A model, audio or output path containing characters outside that code page (for example a Cyrillic user name on an English-locale Windows) would not open. An application manifest that sets the UTF-8 active code page (Windows 10 1903+) fixes this without patching whisper.cpp.
- Exit codes match Sprint 108's contract: `2` when the audio cannot be read, `3` when the model cannot be loaded (`cli.cpp`). It still exits 0 for undecodable audio; Sprint 108 handles that by requiring a non-empty JSON sidecar.

## 11. Performance

There is no Windows data. Apple silicon reference (Sprint 108 A2): 60 min of audio in ~154 s (23.5× realtime), ~2.5 GB peak RSS, with Metal. Windows and Intel Macs run on the CPU only (Accelerate BLAS on Intel Macs). A2 measures before any speed setting is chosen.
