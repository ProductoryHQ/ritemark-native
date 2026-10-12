# Sprint 129 Spec — On-device Whisper on Windows

## Purpose

Windows users have no on-device dictation at all, and Transcribe on Windows works only through ElevenLabs. This sprint ships whisper.cpp for Windows so that dictation and Transcribe's private on-device engine work there as they do on an Apple silicon Mac. Every failure is explained in words a non-technical user can act on. The same pipeline also produces the Intel Mac binary (#203).

## Principles

- **One binary, two callers.** Dictation and Transcribe resolve and check the same bundled `whisper-cli` through one function.
- **Ask before the 1.5 GB download only when it can work.** Ritemark never offers the model on a machine where the engine cannot start.
- **Never lose speech silently.** If transcription is slower than speech, words arrive later; they are never dropped.
- **Product bytes come from the source commit (D1).** Binaries are built in CI from a pinned whisper.cpp tag, recorded with SHA-256 in a tracked manifest, and committed. Release builds only stage, sign and verify them.
- **Apple silicon stays as it is.** Same binary, same flags. The only behaviour change there is that busy audio is no longer dropped (R8).
- **Features stay on (HARD RULE #2).** Windows is added to the existing flag's platform list; no code is deleted or stubbed.

## Requirements

### R1: Windows whisper engine is built, bundled and signed

As a Windows user, I want Ritemark to include a speech engine built for my computer, so that dictation and on-device transcription work without installing anything else.

Acceptance criteria:
- `extensions/ritemark/binaries/win32-x64/` contains `whisper-cli.exe` and the DLLs it loads, built by `.github/workflows/build-whisper.yml` from whisper.cpp tag `v1.8.3` (commit `2eeeba56`), the version already shipped on Apple silicon.
- The build does not depend on the build machine's CPU: `GGML_NATIVE=OFF`, and either runtime CPU variants (`GGML_BACKEND_DL` + `GGML_CPU_ALL_VARIANTS`) or a fixed AVX2 baseline, chosen in A1.
- It needs no Visual C++ Redistributable on the user's machine: either the CRT is statically linked, or the Microsoft-signed VC++ runtime DLLs sit beside the exe. `dumpbin /dependents` shows only Windows system DLLs and files in the same folder.
- It embeds an application manifest with the UTF-8 active code page, so model, audio and output paths with any Unicode characters work.
- `extensions/ritemark/binaries/whisper-manifest.json` records, per target: whisper.cpp tag and commit, build workflow run URL, build flags, and every file's path and SHA-256.
- The Windows release build signs every whisper PE through the existing content-based signing step, and `verify-windows-signatures.ps1 -Mode Verify` passes (Productory Services OÜ, timestamped). No signing script change.
- `scripts/validate-build-output.sh <target>` fails when the target's whisper files are missing, differ from the manifest, or have the wrong architecture, or when another target's whisper folder is present.
- No change to `patches/vscode/`, the `vscode` submodule, or patch 008.

### R2: Intel Mac engine from the same pipeline (#203, if Jarmo approves the ride-along)

As an Intel Mac user, I want on-device dictation and transcription too, so that I am not limited to ElevenLabs.

Acceptance criteria:
- `binaries/darwin-x64/` is built by the same workflow on the `macos-15-intel` runner from the same tag: CPU with Accelerate, no Metal, AVX2 baseline (every Intel Mac that runs a supported macOS has AVX2).
- `codesign-app.sh` signs it with the existing `whisper-cli` and `.dylib` rules, and notarization accepts it.
- The CI contract test (R1) passes natively on `macos-15-intel`.
- If Jarmo declines the ride-along, R3 still makes Intel Macs say plainly that on-device speech needs Apple silicon, and no download is offered.

### R3: One resolver and a readiness check before the download

As a user, I want Ritemark to know whether the speech engine can run before it asks me to download 1.5 GB.

Acceptance criteria:
- `getWhisperBinaryPath()` returns `binaries/<platform>-<arch>/whisper-cli` (`whisper-cli.exe` on win32) and never throws. `speech/index.ts` uses it, and its duplicate resolver is removed.
- A readiness probe runs the binary once per session (cached) and returns one of `ready | missing | blocked | cpu-unsupported | failed`. Dictation's prepare step and `WhisperLocalEngine.isReady()` both use it.
- Dictation's prepare step checks readiness **before** the model. When the engine is not ready, no download is offered and the user sees the R6 message.
- When the engine is ready but the model is absent, both callers behave as today (dictation offers the download; Transcribe shows "Model not downloaded — 1.5 GB, one time").

### R4: Flag and engine platforms

As a Windows user, I want the dictation button and the on-device Transcribe engine to appear.

Acceptance criteria:
- `voice-dictation`: `platforms: ['darwin', 'win32']`, `status: 'stable'`, description no longer says "macOS only".
- `WhisperLocalEngine.platforms` is `['darwin', 'win32']`. The hard-coded "not available on Windows yet" branch is replaced by the R3 readiness result.
- The stale `ritemark.features.voice-dictation` setting description in `package.json` ("experimental, macOS only … ~75MB") is corrected.
- Linux stays excluded (not a build target).
- Kill switch: removing `'win32'` from the platform list turns Windows off. `status: 'disabled'` turns dictation off everywhere. No code is deleted either way.

### R5: Windows microphone problems in plain words

As a non-technical Windows user, I want to be told exactly what to change when Windows blocks the microphone, and to get there in one click.

Acceptance criteria:
- Dictation classifies `getUserMedia` failures with the shared `classifyCaptureError` (the one Transcribe Record uses) instead of its own string matching.
- Every message names the platform's own settings. On Windows: **Settings → Privacy & security → Microphone**, turn on **Microphone access** and **Let desktop apps access your microphone**. On macOS: unchanged (System Settings → Privacy & Security → Microphone → Ritemark).
- The microphone dialog is rebuilt on `ui/dialog.tsx` with shadcn `Button`s and tooltips. The primary button reads **Open Microphone Settings** and opens `ms-settings:privacy-microphone` on Windows.
- Copy for each state (`os-denied`, `no-device`, `device-busy`, `internal-config`) matches what A3 observes on Windows. If Windows reports a privacy block as `NotReadableError` (busy), the busy message also mentions the privacy setting and offers the settings button.
- No message shows a raw error name or exception text.

### R6: Engine problems in plain words

As a user whose computer cannot run the engine, I want a reason and an alternative instead of a button that does nothing.

Acceptance criteria (draft copy; final wording reviewed with `ux-expert` in Phase 3):
- `missing`: "Ritemark's speech engine is missing from this installation. Reinstall Ritemark to restore it."
- `blocked` (the operating system refused to start it): "Your computer's security settings stopped Ritemark's speech engine from starting."
- `cpu-unsupported` (Windows `0xC000001D`, illegal instruction): "On-device speech recognition needs a newer processor than this computer has." Transcribe adds: "You can transcribe with ElevenLabs instead."
- `failed` (any other crash or non-zero exit): "On-device speech recognition stopped unexpectedly. Please try again. If it keeps happening, please report the problem."
- Intel Mac without a binary (R2 declined): "On-device speech recognition needs a Mac with Apple silicon." Transcribe adds the ElevenLabs alternative.
- Dictation stops listening and shows the message on `missing`, `blocked`, `cpu-unsupported` and `failed`. It no longer keeps "listening" while every chunk fails.
- The technical cause (exit code, errno, stderr tail) goes to the log only.

**R5/R6 (revised 2026-10-12, after the ux-expert review):**
- The host sends a problem code (`dictation:problem`), not a sentence. The webview words every state per platform in `webview/src/components/dictationProblems.ts`, and `DictationProblemDialog` shows it. Titles are Title Case, as other dialogs. "Try Again" appears wherever the user can fix the problem.
- Windows names the two switches (**Microphone access**, **Let desktop apps access your microphone**) instead of a menu path, because Windows 10 and 11 word the path differently and the button opens the page directly.
- The jargon is gone ("speech engine", "installation", "configuration"). A blocked start names "Windows Security or your antivirus". The dictation dialog promises no ElevenLabs fallback; that line belongs to Transcribe only.
- The R8 backlog notice is a VS Code toast, not the dialog: the user is watching their words still arrive. The webview is told to stop the microphone (`dictation:stop-capture`).
- Transcribe's on-device messages (`transcribeProblemMessage` in `whisperLocalEngine.ts`) follow the same wording rules.

### R7: Model storage on Windows

As a Windows user, I want the 1.5 GB model to download, resume and remove reliably.

Acceptance criteria:
- The model stays at `~/.ritemark/models/` on every platform (`C:\Users\<name>\.ritemark\models\` on Windows), through one `getModelPath()`. The duplicate in `whisperCpp.ts` is removed.
- The final `.partial` → `.bin` rename retries for up to 10 s on `EPERM`/`EBUSY`/`EACCES` before reporting failure.
- Download, resume after interruption, and **Remove model** work on Windows.
- Paths under a user folder with non-ASCII characters work (R1 manifest; covered by the CI contract test).

**R7 (revised 2026-10-11, after A2):** the Hugging Face CDN dropped the 1.6 GB download twice on Jarmo's Windows network, and the old size check (≥ 90%) would have installed a file cut short. Added acceptance criteria:
- A dropped or stalled connection (no data for 60 s) resumes on its own from where it stopped, up to five times with growing waits, before asking the user to click Download again.
- The model is installed only at its exact size and SHA-256. The download URL is pinned to the Hugging Face revision those values come from, and a damaged download is deleted with "The download was damaged. Click Download to try again."
- `isModelDownloaded()` requires the exact size.

### R8: Dictation keeps every word when the computer is slower than speech

As a dictating user on a slower computer, I want every word I say to end up in the document, even if it appears a little later.

Acceptance criteria:
- An audio chunk that arrives while a transcription is running is held. When the running call finishes, the held audio is transcribed next, joined into one call of up to 28 s (below Whisper's 30 s window).
- Audio beyond 28 s waits as a further segment. Nothing is dropped.
- If the waiting audio exceeds 60 s, dictation stops listening (live dictation only; R12 has no such stop). The transcription of everything already captured still finishes and is inserted, and the user sees: "Dictation can't keep up on this computer, so it stopped listening. The rest of what you said will appear in a moment." *(Wording revised 2026-10-12: the old "has been added" was shown while the words were still on their way.)*
- On **Stop**, audio already captured, including the final chunk, is transcribed and inserted before the button returns to idle. Meanwhile the button is disabled and says the last words are being added (added 2026-10-12; before, it looked idle while text was still coming).
- Text is inserted in the order it was spoken.
- Temporary WAV files are deleted only after their process has exited (Windows cannot delete a file another process holds open).

### R9: Speed settings for computers without Apple GPU acceleration

As a Windows or Intel Mac user, I want dictation tuned to my computer, so that text keeps up with my speech where the hardware allows it.

Acceptance criteria:
- A2 measures, on Jarmo's Windows machine: model load, per-call time for 5 s and 10 s chunks, thread counts, beam sizes, and a 10-minute file in Transcribe. The numbers are recorded in `research/windows-performance-audit.md`.
- Settings are chosen by the rule in [technical-plan.md](./technical-plan.md#w6-speed-settings-for-cpu-only-targets-r9) and apply only to win32 and darwin-x64. Apple silicon arguments stay as they are.
- If the pre-approved levers cannot reach the target, work stops and the numbers go to Jarmo with the options (GPU build, or shipping with a "slower on this computer" note). No GPU backend is added without his decision.
- `docs/user` states what to expect on Windows (dictation delay, minutes per hour of audio).

### R10: Docs, tiers and release notes

Acceptance criteria:
- `docs/user/features/transcribe.md` platform table and timings cover Windows (and Intel Macs if R2). A dictation section covering macOS and Windows, including the microphone settings, is added to the user docs (none exists today).
- `docs/development/architecture.md` describes the single resolver, the readiness states, binary provenance (manifest + workflow), and removes "macOS only" for on-device Whisper.
- The shell-tier list (`CLAUDE.md`), `scripts/release-extension-preflight.sh` and `scripts/list-unshipped-extension-changes.mjs` treat `extensions/ritemark/binaries/` as shell-tier (all three edited in one commit, with `release-tier-paths.test.mjs`). The patch 008 description in `CLAUDE.md` is corrected.
- `docs/CHANGELOG.md` and the v1.14.0 release notes are drafted. #133 (and #203) close when v1.14.0 publishes.

### R11: Apple silicon engine runs on macOS 12 and later (added 2026-10-12)

Jarmo's scope decision of 2026-10-12, relayed by the Development manager. The engine shipped since v1.0.3 asks for macOS 15.0 (audit §12), while Ritemark supports macOS 12.

As a user on an Apple silicon Mac with macOS 12, 13 or 14, I want dictation and on-device Transcribe to work, so that I get what Ritemark promises for my Mac.

Acceptance criteria:
- `extensions/ritemark/binaries/darwin-arm64/` holds the `build-whisper.yml` build: one static `whisper-cli` from whisper.cpp v1.8.3 (`2eeeba56`), minimum macOS 12.0, Metal embedded, BLAS off. The old dylibs are removed, and `whisper-manifest.json` records it like the other targets.
- The contract test passes on the `macos-15` and `macos-14` runners, including the macOS 12.0 check. GitHub has no macOS 12 or 13 runner, so hands-on use on 12 and 13 is intentionally untested.
- On Jarmo's Mac, dictation and on-device Transcribe behave as in v1.13.0 (same speed in the local check: 0.58 s vs 0.57 s per dictation call).
- `codesign-app.sh` signs it with the existing `whisper-cli` rule and notarization accepts it. Gate 2 includes an Apple silicon dictation check.

### R12: "Speak, then text" on computers without GPU acceleration (added 2026-10-12)

Jarmo's decision of 2026-10-12, after round 3: on a CPU-only Windows laptop each transcription call takes ~20 s, so live text is not possible without losing accuracy. Supersedes R9's speed target for these computers.

As a Windows user, I want to say what I mean, press Stop, and get accurate text, without the app pretending to type along.

Acceptance criteria:
- **Where:** win32. Intel Macs (darwin-x64) follow Windows until Jarmo decides otherwise (asked 2026-10-12). Apple silicon keeps live dictation.
- **While recording:** no text is inserted. The in-editor indicator and the button's tooltip say that the text comes after Stop (wording from the `ux-expert` review, confirmed by Jarmo). Nothing flips to "Processing" while the user talks.
- **In the background:** captured audio is transcribed in pieces of up to 28 s while the user is still talking, each with the full 30 s window. The text is held, in order.
- **After Stop:** the indicator and the button show that Ritemark is transcribing until the text is in. All text is then inserted at once at the cursor, in the order it was spoken.
- **Wait:** about 20 s after Stop on Jarmo's laptop, for a short phrase and a long dictation alike; longer on slower computers. Nothing is ever dropped.
- **No backlog stop:** nothing is live, so R8's 60-second stop applies to live dictation only. A slow computer only makes the wait after Stop longer.
- **Failure:** if the engine fails part-way, the text already transcribed is inserted first, then the problem dialog (R6) explains.
- **The note is not text:** the recording and processing notes at the cursor are never part of the document, so autosave never writes them into the file. The same applies in live mode.
- **Settings:** the dictation settings say nothing that implies live text in this mode (chunk length has no visible effect here).

### R13: The 8-bit model on Windows (added 2026-10-12)

As a Windows user, I want the smaller download when it costs no accuracy.

Acceptance criteria:
- On win32 (and darwin-x64 until Jarmo decides otherwise), dictation, Transcribe on-device and Settings use `ggml-large-v3-turbo-q8_0.bin`: 874,188,075 bytes, SHA-256 `317eb69c11673c9de1e1f0d459b253999804ec71ac4c23c17ecf5fbe24e259a1`, from the same pinned Hugging Face revision as the f16 model. The download is resumed and checked as in R7.
- Every place that names the download size shows this model's size (about 834 MB), not 1.5 GB.
- Apple silicon keeps `ggml-large-v3-turbo.bin`. A model already downloaded for one platform is never deleted by the other's logic.
- Evidence: FLEURS Estonian WER 14.8% against 14.2% for f16 on the Windows PC, 19.5% against 19.2% on 100 clips on the Mac; half the download; 1.13× faster on the Ryzen.

## Non-Requirements

- No GPU acceleration on Windows (Vulkan/CUDA). Measured as far as a build (config VK); Jarmo took it out of v1.14.0 on 2026-10-12.
- No on-device m4a/aac on Windows. It needs a converter; the existing honest message stays and ElevenLabs handles those files. Follow-up issue.
- No persistent whisper process, VAD, AudioWorklet or binary transport (#117 items), apart from R8. Cutting at pauses (VAD) is separate work for every platform (Jarmo, 2026-10-12).
- No shorter audio window (`--audio-ctx`) anywhere: it doubles the errors at 10 s and loops at 5 s in Estonian.
- No whisper.cpp upgrade. (The Apple silicon binary *is* rebuilt from the same version: R11, added 2026-10-12.)
- No Windows on ARM native build. On ARM, Windows runs the x64 build under emulation (not tested). No Linux binary.
- No change to the model location or the language list. The model changes on Windows only (R13).
- No VS Code patch or submodule change.

## Resolved Questions

- **Where the binary comes from:** our own CI build from a pinned tag, not upstream's prebuilt zip. Upstream's zip is built with defaults we do not control (CPU baseline, C runtime) and has no Unicode-path manifest. Not fetched at build time either: committing the output, as with darwin-arm64, keeps release pipelines unchanged and product bytes in the source commit.
- **Which version:** v1.8.3 on every target, so all platforms share the CLI contract that Sprint 108 measured (flags, exit codes, JSON shape).
- **Model location:** unchanged (`~/.ritemark/models`). It is where Ritemark already keeps per-user data on Windows, and it needs no migration. Known limitation: on Windows domain accounts with roaming profiles, the 1.5 GB file would roam.
- **Patch 008:** not involved (see the audit, §9).

## Open Questions

- **A1:** runtime CPU variants with app-local VC++ runtime, or a single static AVX2 exe? The rule is in the technical plan.
- **A3:** which `getUserMedia` error does Windows raise for each microphone state?
- ~~For Jarmo: Intel Mac ride-along yes/no; is an Intel Mac available for Gate 2?~~ Yes; no Intel Mac (2026-10-11).
- **For Jarmo (2026-10-12):** do Intel Macs follow Windows in R12 and R13?
