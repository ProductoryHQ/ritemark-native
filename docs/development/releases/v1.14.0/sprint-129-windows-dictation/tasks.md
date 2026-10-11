# Sprint 129 Tasks

Implementation checklist for [technical-plan.md](./technical-plan.md). Tick `[x]` only with branch diff or evidence.

> **Gate:** nothing here starts before Jarmo approves the plan. The first action after approval is `git checkout -b sprint-129-windows-dictation` from this worktree's tip, after checking that `git log origin/main..HEAD` shows only the plan commit (rebase onto the then-current `origin/main` first). Nothing merges before v1.13.0 is published, and merging then needs Jarmo's admin-merge yes for the PR by number.

## Phase 0: Audits (W0 — R1, R9; A3 for R5 runs in Phase 5)

- [ ] Branch `sprint-129-windows-dictation` created; `git branch --show-current` verified.
- [ ] `build-whisper.yml` win32-x64 job builds Config V and Config S from `v1.8.3`; contract test green on `windows-latest`. → `research/windows-build-audit.md` (files, sizes, dependencies, `system_info`, chosen config per the rule).
- [ ] `scripts/qa/windows-whisper-bench.ps1` written and dry-run on the CI runner.
- [ ] **Jarmo:** runs the bench on his Windows machine (one command) and pastes the output. → `research/windows-performance-audit.md` with the lever decision per W6.
- [ ] If W6's stop condition triggers, stop and bring the numbers to Jarmo before Phase 2.

## Phase 1: Binaries and pipeline (W1, R1, R2, R10 tiers)

- [ ] `build-whisper.yml`: win32-x64, darwin-x64 (if R2), contract matrix incl. committed darwin-arm64; `pull_request` + `workflow_dispatch` triggers; standard runners.
- [ ] `scripts/qa/whisper-contract-test.mjs` (jfk transcript, JSON parse, exit 2/3, Unicode folder, dependencies, architecture).
- [ ] `scripts/build-whisper.sh` pinned to `v1.8.3`/`2eeeba56`, with `--target darwin-arm64|darwin-x64`.
- [ ] Artifacts committed to `binaries/win32-x64/` (and `binaries/darwin-x64/`) after the `SHA256SUMS` check; `binaries/whisper-manifest.json` written (darwin-arm64 hashes included).
- [ ] `.gitattributes` `extensions/ritemark/binaries/** binary`; `binaries/README.md` provenance + MIT notice.
- [ ] `validate-build-output.sh` whisper check (unsigned hash, signed presence/architecture, no foreign folder) + test.
- [ ] `copy-extension-for-target.mjs` generic foreign-folder guard + test for all three targets.
- [ ] Tier lists moved to `extensions/ritemark/binaries/` in `CLAUDE.md`, `release-extension-preflight.sh`, `list-unshipped-extension-changes.mjs` (one commit) + `release-tier-paths.test.mjs`; patch 008 line in `CLAUDE.md` corrected.

## Phase 2: Extension host (W2–W6, R3, R4, R6–R9)

- [ ] `getWhisperBinaryPath()` without throw, `.exe` on win32; `speech/index.ts` duplicate removed.
- [ ] `probeWhisper()` (cached) and `describeWhisperFailure()`; `WHISPER_READINESS_COPY` table.
- [ ] `handlePrepareDictation()` probes before `ensureModelDownloaded()`.
- [ ] `WhisperLocalEngine`: `platforms ['darwin','win32']`, `isReady()` via probe, `runWhisper()` failure mapping.
- [ ] `voice-dictation` flag platforms + description; flag comment on `transcription-workbench`; `package.json` setting description.
- [ ] Single `getModelPath()` in `modelManager.ts`; `renameWithRetry()` for the model rename and removal.
- [ ] `DictationController` coalescing queue, 28 s cap, 60 s backlog stop, Stop flush, one temp file per call deleted after exit, stop on engine failure.
- [ ] `cpuOnlyDefaults()` per the A2 decision; `defaultChunkMs` in the editor bootstrap.
- [ ] Unit tests: resolver matrix, failure mapping, probe cache, coalescing (fake transcriber), WAV parse/build, rename retry, CPU defaults, flag platforms, engine registry win32; Intel Mac silent-failure regression test (old behaviour reproduced first, then fixed). Registered in `npm test`.

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
- [ ] Intel Mac branch check, if Jarmo has an Intel Mac.

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
- [ ] Intel Mac RC (if R2 and hardware available), otherwise the gap is stated in the release report.
- [ ] #133 (and #203) closed on publish.
