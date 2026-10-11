# Sprint 129 Tasks

Implementation checklist for [technical-plan.md](./technical-plan.md). Tick `[x]` only with branch diff or evidence.

> **Gate:** nothing here starts before Jarmo approves the plan. The first action after approval is `git checkout -b sprint-129-windows-dictation` from this worktree's tip, after checking that `git log origin/main..HEAD` shows only the plan commit (rebase onto the then-current `origin/main` first). Nothing merges before v1.13.0 is published, and merging then needs Jarmo's admin-merge yes for the PR by number.

## Phase 0: Audits (W0 — R1, R9; A3 for R5 runs in Phase 5)

- [x] Branch `sprint-129-windows-dictation` created; `git branch --show-current` verified. *(2026-10-11, from `542bee6c` + plan commit `31a095b8`)*
- [x] `build-whisper.yml` win32-x64 job builds Config V and Config S from `v1.8.3`; contract test green on `windows-latest`. → [research/windows-build-audit.md](./research/windows-build-audit.md): **Config V chosen**. *(Run 38130971199: S 10/10; V functional checks all pass, its dependency check failed on a test-parser bug, fixed; re-run pending)*
- [x] `scripts/qa/windows-whisper-bench.ps1` written (PowerShell 5.1, ASCII only). It also measures a shorter audio window (`--audio-ctx`), which is not a pre-approved setting, so Jarmo can decide with numbers. *(No CI dry run: the runner's 4 vCPUs are no speed reference, and the script's whisper calls use the same flags the contract test already runs)*
- [ ] **Jarmo:** runs the bench on his Windows machine (one command) and pastes the output. → `research/windows-performance-audit.md` with the lever decision per W6.
- [ ] If W6's stop condition triggers, stop and bring the numbers to Jarmo before Phase 2.

## Phase 1: Binaries and pipeline (W1, R1, R2, R10 tiers)

- [x] `build-whisper.yml`: win32-x64 (V, S), darwin-x64, an Apple silicon candidate, and that candidate re-run on macOS 14; `pull_request` + `workflow_dispatch` triggers; standard runners. *(The committed darwin-arm64 binary was contract-tested locally instead: it fails only the macOS 12 check, audit §12)*
- [x] `scripts/qa/whisper-contract-test.mjs` (jfk transcript, JSON parse, exit 2/3, Unicode folder, dependencies, architecture, minimum macOS), importing the app's own `dictationArgs()`/`transcribeArgs()`.
- [x] `scripts/build-whisper.sh` pinned to `v1.8.3`/`2eeeba56`, with `--target darwin-arm64|darwin-x64`, one static binary, a macOS 12.0 floor enforced at compile time, BLAS off.
- [ ] Artifacts committed to `binaries/win32-x64/` (and `binaries/darwin-x64/`) after the `SHA256SUMS` check; `binaries/whisper-manifest.json` written (darwin-arm64 hashes included).
- [ ] `.gitattributes` `extensions/ritemark/binaries/** binary`; `binaries/README.md` provenance + MIT notice.
- [ ] `validate-build-output.sh` whisper check (unsigned hash, signed presence/architecture, no foreign folder) + test.
- [ ] `copy-extension-for-target.mjs` generic foreign-folder guard + test for all three targets.
- [ ] Tier lists moved to `extensions/ritemark/binaries/` in `CLAUDE.md`, `release-extension-preflight.sh`, `list-unshipped-extension-changes.mjs` (one commit) + `release-tier-paths.test.mjs`; patch 008 line in `CLAUDE.md` corrected.

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

## Phase 3: Webview (W7, R5)

- [ ] `ux-expert` review of the microphone dialog states and the R5/R6 copy before code.
- [ ] `platform` in the editor bootstrap (`ritemarkEditor.ts`, `pdfEditorProvider.ts`, `officePreviewProvider.ts`) → `App.tsx` → `DocumentHeader` → `VoiceDictationButton`.
- [ ] `useVoiceDictation` uses `classifyCaptureError`; `hooks/dictationMicCopy.ts` + tests.
- [ ] Microphone dialog rebuilt on `ui/dialog.tsx` + `Button` + `Tooltip`; **Open Microphone Settings**; opens on `os-denied` (and on `device-busy` on Windows).
- [ ] Webview bundle rebuilt; pre-commit validator passes (`CLAUDE_PROJECT_DIR="$PWD"` in this worktree).

## Phase 4: Validation on macOS (scenarios marked **M** and **U** in [scenarios.md](./scenarios.md))

- [ ] `npm test`, script tests, TypeScript compile, `./scripts/validate-qa.sh`.
- [ ] RunDev on Apple silicon: dictation (Estonian + English, Stop mid-transcription), Transcribe on-device, microphone-denied dialog, with screenshots checked for finish quality (scenarios marked **M**).
- [ ] `qa-validator` review.

## Phase 5: Windows branch test (W8 stage B — R1–R9; scenarios marked **B** in [scenarios.md](./scenarios.md))

- [ ] `scripts/qa/make-windows-test-overlay.sh` and `scripts/qa/windows-branch-test.ps1` written; overlay zip built from the branch.
- [ ] **Jarmo:** runs the branch test on his Windows machine through the scenarios marked **B**. A3 errors recorded in `research/windows-mic-audit.md`; Windows copy adjusted if A3 requires it.
- [x] ~~Intel Mac branch check~~: no Intel Mac available (Jarmo, 2026-10-11). Evidence = CI contract test on `macos-15-intel`.

## Phase 6: Docs, tiers and PR (W9 — R10)

- [ ] `docs/user/features/transcribe.md` (platform table, Windows/Intel timing, m4a note); dictation section in the user docs.
- [ ] `docs/development/architecture.md` (single resolver, readiness states, provenance, no more "macOS only").
- [ ] `docs/CHANGELOG.md` and v1.14.0 release-notes draft; v1.14.0 release plan tracker updated.
- [ ] PR opened (not merged); "PR ready" message names the PR number for Jarmo's admin-merge yes after v1.13.0 publishes.
- [ ] Follow-up issues: on-device m4a/aac on Windows; whisper.cpp upgrade across all targets; GPU acceleration on Windows (only if A2 showed the need).

## Phase 7: QA and Closeout (v1.14.0 Gate 2, stage C)

[scenarios.md](./scenarios.md) is the source matrix; each checkbox here refers back to it.

- [ ] Walk every `[x]` in this file against the branch diff before the PR is marked ready (no pre-ticked items).
- [ ] R10 scenarios in [scenarios.md](./scenarios.md) pass (tier lists, docs).

- [ ] Signed installer: whisper files signed by Productory Services OÜ and timestamped (scenario R1).
- [ ] Scenarios marked **C** on the signed installer; Smart App Control state recorded.
- [ ] Release report states that Intel Mac evidence is the CI contract test only (no hardware).
- [ ] #133 (and #203) closed on publish.
