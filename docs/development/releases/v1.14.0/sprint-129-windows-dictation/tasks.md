# Sprint 129 Tasks

Implementation checklist for [technical-plan.md](./technical-plan.md). Tick `[x]` only with branch diff or evidence.

> **Gate:** nothing here starts before Jarmo approves the plan. The first action after approval is `git checkout -b sprint-129-windows-dictation` from this worktree's tip, after checking that `git log origin/main..HEAD` shows only the plan commit (rebase onto the then-current `origin/main` first). Nothing merges before v1.13.0 is published, and merging then needs Jarmo's admin-merge yes for the PR by number.

## Phase 0: Audits (W0 — R1, R9; A3 for R5 runs in Phase 5)

- [x] Branch `sprint-129-windows-dictation` created; `git branch --show-current` verified. *(2026-10-11, from `542bee6c` + plan commit `31a095b8`)*
- [x] `build-whisper.yml` win32-x64 job builds Config V and Config S from `v1.8.3`; contract test green on `windows-latest`. → [research/windows-build-audit.md](./research/windows-build-audit.md): **Config V chosen**. *(Run 38130971199: S 10/10; V functional checks all pass, its dependency check failed on a test-parser bug, fixed; re-run pending)*
- [x] `scripts/qa/windows-whisper-bench.ps1` written (PowerShell 5.1, ASCII only). It also measures a shorter audio window (`--audio-ctx`), which is not a pre-approved setting, so Jarmo can decide with numbers. *(No CI dry run: the runner's 4 vCPUs are no speed reference, and the script's whisper calls use the same flags the contract test already runs)*
- [x] **Jarmo:** runs the bench on his Windows machine (one command) and pastes the output. → [research/windows-performance-audit.md](./research/windows-performance-audit.md). *(2026-10-11, Ryzen 7 5825U: ~22 s per call; threads adopted, beam and chunk length do nothing)*
- [x] W6's stop condition triggered: numbers and options taken to Jarmo. *(The speed decision is pending; host work that does not depend on it continued)*
- [ ] Bench round 2 (Jarmo 2026-10-12: "mõõda kõiki"; W11): FLEURS-et WER for all candidates on the Mac → `research/asr-candidates-audit.md` *(done)*; CI clip pack *(done)*; run instructions to the Development manager *(done)*. Then Jarmo cut Parakeet and the Zipformer (2026-10-12), so the Windows run is Whisper q8_0 vs f16 *(script trimmed to match)*. Windows results folded in *(2026-10-12: q8_0 ≈ f16 on Estonian, only 1.13× faster on the Ryzen; the shorter window rejected on real speech, 59–73% WER)*. Open: Jarmo's ship-or-hold decision.
- [x] Round 3 (Jarmo 2026-10-12: shorter window + resident model, q8_0 only if quality holds) folded in, with the Mac cross-check on the same chunking. *(2026-10-12: the shorter window doubles errors at 10 s and loops at 5 s on both machines; the resident model saves 1.3–2.4 s per call; q8_0 ≈ f16 in the full window. Continuous-speech check: R8's long calls on slow PCs score near "record, then transcribe")*
- [ ] Vulkan (Jarmo 2026-10-12: "kui saab siis jah"): config VK in `build-whisper.yml` *(added, 100d0e09; green in run 38252509147: 62 MB, imports `vulkan-1.dll`)*; bench on Jarmo's PC *(`windows-whisper-bench.ps1 -Round 3`, sent to the Development manager)*; what it changes (size, driver dependency, fallback) put to Jarmo before shipping; a PC without `vulkan-1.dll` checked before shipping.
- [x] Jarmo's decisions after round 3 recorded (2026-10-12): "speak, then text" on Windows (R12), q8_0 on Windows (R13), VAD separate ([#411](https://github.com/ProductoryHQ/ritemark-native/issues/411)), no GPU in v1.14.0. Config VK built only on request.
- [ ] Jarmo: the "speak, then text" wording, and whether Intel Macs follow Windows (asked through the Development manager, 2026-10-12).
- [x] R11 (added 2026-10-12): the CI-built darwin-arm64 static engine is committed with the other payloads (W10); the `committed` CI job runs it on macOS 14. *(The Apple silicon dictation check is listed under Gate 2)*

## Phase 1: Binaries and pipeline (W1, R1, R2, R10 tiers)

- [x] `build-whisper.yml`: win32-x64 (V, S), darwin-x64, an Apple silicon candidate, and that candidate re-run on macOS 14; `pull_request` + `workflow_dispatch` triggers; standard runners. *(The committed darwin-arm64 binary was contract-tested locally instead: it fails only the macOS 12 check, audit §12)*
- [x] `scripts/qa/whisper-contract-test.mjs` (jfk transcript, JSON parse, exit 2/3, Unicode folder, dependencies, architecture, minimum macOS), importing the app's own `dictationArgs()`/`transcribeArgs()`.
- [x] `scripts/build-whisper.sh` pinned to `v1.8.3`/`2eeeba56`, with `--target darwin-arm64|darwin-x64`, one static binary, a macOS 12.0 floor enforced at compile time, BLAS off.
- [x] Artifacts from run 38225663013 committed after the `SHA256SUMS` check: `binaries/win32-x64/` (config V, 16 files), `binaries/darwin-x64/`, and `binaries/darwin-arm64/` (R11: static, macOS 12+, old dylibs removed). `binaries/whisper-manifest.json` records every file's SHA-256 and the run.
- [x] `.gitattributes` marks the three engine folders binary; `binaries/README.md` covers provenance, rebuilding, and the MIT and VC++ redistributable notices.
- [x] `validate-build-output.sh` whisper check (Check 5b: manifest-driven; hash only while unsigned; PE machine / Mach-O architecture; no foreign folder). *(The script has no test harness of its own; exercised in the Phase 1 build check)*
- [x] `copy-extension-for-target.mjs` generic foreign-folder guard + test for all three targets.
- [x] Tier lists moved to `extensions/ritemark/binaries/` in `CLAUDE.md`, `release-extension-preflight.sh`, `list-unshipped-extension-changes.mjs` (one commit) + `release-tier-paths.test.mjs`; patch 008 line in `CLAUDE.md` corrected.

## Phase 2: Extension host (W2–W6, R3, R4, R6–R9)

- [x] `getWhisperBinaryPath()` without throw, `.exe` on win32; `speech/index.ts` duplicate removed.
- [x] `probeWhisper()` (ready cached; failures remembered 60 s), `describeWhisperFailure()`, `whisperProblemMessage()` (the copy table).
- [x] `handlePrepareDictation()` probes before `ensureModelDownloaded()`.
- [x] `WhisperLocalEngine`: `platforms ['darwin','win32']`, `isReady()` via probe, spawn-error and exit-code failure mapping (+ ElevenLabs hint for `cpu-unsupported`).
- [x] `voice-dictation` flag platforms + description; flag comment on `transcription-workbench`; `package.json` setting description.
- [x] Single `getModelPath()` (in `whisperCpp.ts`, re-exported by `modelManager.ts`, see W4); `withFileRetry()` for the model rename and removal.
- [x] `DictationController` coalescing queue, 28 s cap, 60 s backlog stop, Stop flush, one temp file per call deleted after exit, stop on engine failure. Also fixed: dictated sentences containing "processing" were dropped (audit §12).
- [ ] `cpuOnlyDefaults()` per the A2 decision; `defaultChunkMs` in the editor bootstrap.
- [ ] Unit tests: resolver matrix, failure mapping, probe cache, coalescing (fake transcriber), WAV parse/build, rename retry, CPU defaults, flag platforms, engine registry win32; Intel Mac silent-failure regression test (old behaviour reproduced first, then fixed). Registered in `npm test`. *(Done: `whisperCpp.test.ts`, `controller.test.ts`, `transcriptionFlag.test.ts`; old Intel Mac behaviour reproduced on the v1.13.0 controller, audit §12. Open: CPU defaults (after A2), engine registry win32 case)*

## Phase 2b: "Speak, then text" and the 8-bit model (W13, W14 — R12, R13)

- [x] Host: `dictationModeFor`, `defaultModelFile`, model table in `whisperCpp.ts` with the q8_0 entry; deferred mode in `DictationController` (background pieces, held text, finishing + wait estimate, no backlog stop, failure order); `dictation:getMode`; Stop always answered.
- [x] Webview: `preparing` (cancel) and `finishing` states, placeholder from state, text inserted where the placeholder is, `dictationStateCopy`, settings row per mode, model size in the model-missing dialog.
- [x] Unit tests for both (controller, whisperCpp, modelManager, dictationProblems).
- [x] The dictation note is a decoration (`extensions/DictationPlaceholder.ts` + `dictationPlaceholder.test.ts`): autosave wrote the text placeholder into the file, for the whole recording in deferred mode (found in the Mac check, fixed and re-checked on disk).
- [x] Mac dev instance: deferred mode (QA switch) and live mode, with screenshots → [qa-evidence.md](./qa-evidence.md). *(2026-10-12)*

## Phase 3: Webview (W7, R5)

- [x] `ux-expert` review of the microphone dialog states and the R5/R6 copy before code. *(2026-10-12; adopted, see spec R5/R6 revision)*
- [x] ~~`platform` in the editor bootstrap~~: `webviewPlatform` from `hooks/usePlatform.ts` instead; the editor payload is unchanged.
- [x] `useVoiceDictation` uses `classifyCaptureError`; problem codes from host and microphone; a host problem stops capture without clearing its message. `components/dictationProblems.ts` + `dictationProblems.test.ts`.
- [x] `DictationProblemDialog` on `ui/dialog.tsx` + `Button` + `Tooltip` for every state (microphone, engine, model, host error); the backlog notice is a toast. Split-button `title`s are now `Tooltip`s, and the dialog's X has a tooltip.
- [x] Webview bundle rebuilt; pre-commit validator passes (`CLAUDE_PROJECT_DIR="$PWD"` in this worktree).

## Phase 4: Validation on macOS (scenarios marked **M** and **U** in [scenarios.md](./scenarios.md))

- [x] `npm test`, script tests, TypeScript compile, `./scripts/validate-qa.sh`. *(2026-10-12, qa-validator run on `4aa74cb8`: all green)*
- [x] RunDev on Apple silicon: dictation (injected speech through the webview bridge, Stop mid-transcription), Transcribe on-device, microphone-denied dialog and every host problem state, with screenshots checked → [qa-evidence.md](./qa-evidence.md). *(Estonian dictation by voice is left for Jarmo's checks; Estonian accuracy is in research/asr-candidates-audit.md)*
- [x] `qa-validator` review. *(First run 2026-10-12: BLOCK on B1 (a throwing transcription hung the button) and B2 (one controller shared by all tabs); both fixed with tests and a two-tab check, see qa-evidence.md. Re-review at `d00c6101`: PASS)*

## Phase 5: Windows branch test (W8 stage B — R1–R9; scenarios marked **B** in [scenarios.md](./scenarios.md))

- [ ] `scripts/qa/make-windows-test-overlay.sh` and `scripts/qa/windows-branch-test.ps1` written; overlay zip built from the branch. *(Scripts written 2026-10-12; the zip is built once the Windows speed decision is in, so Jarmo tests the final engine once)*
- [ ] **Jarmo:** runs the branch test on his Windows machine through the scenarios marked **B**. A3 errors recorded in `research/windows-mic-audit.md`; Windows copy adjusted if A3 requires it.
- [x] ~~Intel Mac branch check~~: no Intel Mac available (Jarmo, 2026-10-11). Evidence = CI contract test on `macos-15-intel`.

## Phase 6: Docs, tiers and PR (W9 — R10)

- [x] `docs/user/features/transcribe.md` (platform table, Windows/Intel timing, m4a note); new `docs/user/features/dictation.md` (linked from the features index and Transcribe); README feature line; setting description.
- [x] `docs/development/architecture.md` (single resolver, readiness states, provenance, no more "macOS only"; new "On-device Whisper engine (Sprint 129)" section; debt marked partly paid).
- [x] `docs/CHANGELOG.md` ([1.14.0] — Unreleased) and `docs/releases/v1.14.0/release-notes.md` (draft, Sprint 129's part); v1.14.0 release plan row updated (after merging #410). *(Wording follows the defaults sent to Jarmo; adjust if he changes it)*
- [ ] PR opened (not merged); "PR ready" message names the PR number for Jarmo's admin-merge yes after v1.13.0 publishes.
- [ ] Follow-up issues: on-device m4a/aac on Windows; whisper.cpp upgrade across all targets. *(Filed: cutting at pauses, [#411](https://github.com/ProductoryHQ/ritemark-native/issues/411). GPU on Windows: Jarmo put it aside on 2026-10-12; no issue unless he reopens it)*

## Phase 7: QA and Closeout (v1.14.0 Gate 2, stage C)

[scenarios.md](./scenarios.md) is the source matrix; each checkbox here refers back to it.

- [ ] Walk every `[x]` in this file against the branch diff before the PR is marked ready (no pre-ticked items).
- [ ] R10 scenarios in [scenarios.md](./scenarios.md) pass (tier lists, docs).

- [ ] Signed installer: whisper files signed by Productory Services OÜ and timestamped (scenario R1).
- [ ] Scenarios marked **C** on the signed installer; Smart App Control state recorded.
- [ ] Release report states that Intel Mac evidence is the CI contract test only (no hardware).
- [ ] #133 (and #203) closed on publish.
