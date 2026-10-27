# Sprint 144 Tasks

Nothing below is ticked until its change is on its branch (or, for a run, its run ID is in `qa-evidence.md`). Part 1 is `sprint-144-release-harness` (shell tier); Part 2 is `sprint-144-release-harness-polish` (extension tier).

## Phase 0: Planning audits (done on `plan/sprint-144-release-harness`)

- [x] A1: the free-runner probe, run 40425970110 on `scratch/sprint-144-free-runner-probe`, unsigned, no secrets: `research/windows-ci-audit.md`
- [x] A2: Electron and Node for 2.1, the cost of a move, the outside-URL paths: `research/electron-node-audit.md`
- [x] A4: P4 reproduced in a headless harness: `research/repro/flow-step-panel/`, `qa/p4-*.png`
- [x] Delete `scratch/sprint-144-free-runner-probe` once the manager has read A1 (Decision 6)

---

**Part 1: the release harness (shell tier)**

## Phase 1: Before W3's check

- [x] A3: where the packaged Electron names its version on win32-x64 and in the darwin-x64 tarball (the Mac's is measured); recorded in `research/electron-node-audit.md`

## Phase 2: The Windows build on the free runner (R1, W1)

- [x] `.github/workflows/build-windows.yml`: `runs-on: windows-latest`
- [x] `.github/workflows/build-windows.yml`: the disk guard (≥ 30 GB free on the work drive) as the first step after Git's config
- [x] `.github/workflows/build-windows.yml`: the two comments that name the 8-core runner
- [x] YAML parse and the `release` skill's pre-push audit (the whole file and `build-macos-x64.yml` read)

## Phase 3: The release path without the toggle (R2, W2)

- [x] `.claude/skills/release/SKILL.md`: *When to use*, Step 5, the Windows gotcha
- [x] `.claude/agents/release-manager.md`: *Windows Build Notes*, *Target Repository*
- [x] `.github/workflows/windows-canary.yml`: the header comment only
- [x] `grep -rn "visibility private" .claude .github docs/development/release-process` returns nothing

## Phase 4: Electron 43.8.x (R3, R4, W3)

- [x] `patches/vscode/020-ritemark-electron-43.patch` (`.npmrc`, `build/checksums/electron.txt`, `cgmanifest.json`), made with `./scripts/create-patch.sh` on a pristine pin with 001–019 applied
- [x] The new `SHASUMS256.txt` cross-checked against GitHub's asset digests for darwin-arm64, darwin-x64 and win32-x64
- [ ] `CLAUDE.md`: *Current patches (19)*, patch 020's row. **Not done by the agent:** CLAUDE.md is the agents' own instructions, which no agent's message can authorise changing; the row is in the PR's description for a person to add
- [x] `scripts/validate-build-output.sh`: the packaged Electron equals `vscode/.npmrc`'s target (A3's locations), with a message naming both
- [ ] `scripts/update-vscode.sh --check` against a newer upstream: say in `qa-evidence.md` what it reports for patch 020. Not run: it needs a newer tag fetched into the shallow submodule; patch 020's header says to delete it at the next update
- [x] Release plan: the #515 risk row (R4) with the Electron the branch ships

## Phase 5: Part 1's QA

- [x] S13: `./scripts/apply-patches.sh --dry-run`, then apply; the pre-commit validator by hand (`CLAUDE_PROJECT_DIR="$PWD"`)
- [x] S10, S14 on scratch copies (never committed)
- [x] S9, S11, S12 on a dev launch here (hidden window, `--use-mock-keychain`, one launch reused): the AI turns not run (`qa-evidence.md`)
- [ ] `qa-validator` review; PR, shell tier; the manager's merge
- [ ] After the merge: S1–S4, S8 on `main` (`build-windows.yml`), and `build-macos-x64.yml` on `main`
- [ ] After the merge: S11, S12 (Windows half) and S17–S19 by the Windows session; S20 here if Decision 4 is yes
- [ ] S15 or S16, whichever happens before the version bump
- [ ] Release plan: #506's done-list line ticked after S1 and S2; the tracker row
- [ ] #506 closed after S1 and S2 on `main`; #515 closed only after S15
- [ ] Memory: the visibility note says the toggle is gone; the Inbound Traffic and Social managers told, through the Development manager

---

**Part 2: polish from the 2.1 smoke test (extension tier)**

## Phase 6: The sign-in card and Settings (P1, P2, W5, W6)

- [ ] `OnboardingWizard.tsx`: every button the shared `Button` with a `Tooltip`; `ActionButton` and `SecondaryButton` deleted
- [ ] `OnboardingWizard.test.tsx` (or the existing test file beside it): each button's callback (S23)
- [ ] `RitemarkSettings.tsx`: the two badges removed, the comment at :631
- [ ] Screenshots S21, S22, S24 in Light and Dark, to the Experience lead

## Phase 7: The status bar's AI item (P3, W7)

- [ ] `src/ai/aiStatusItem.ts`: the item(s) and `describeAiStatus`, with the Experience lead's words
- [ ] `src/ai/connectivity.ts`: no longer owns the item; probing and `connectivityChanged` unchanged
- [ ] `webview/src/components/ai-sidebar/store.ts`: `conversation/active` carries the open chat's `agentId`, sent again when it changes
- [ ] `src/views/UnifiedViewProvider.ts`: `onDidChangeOpenChat` from `_noteActiveConversation`; the last failed turn's `errorKind` readable for the open chat
- [ ] `src/extension.ts`: the item created with its sources and events
- [ ] `src/ai/aiStatusItem.test.ts` (S32) and the host re-derivation test
- [ ] S25–S31 on a dev launch with an isolated profile; screenshots of each reachable state, to the Experience lead

## Phase 8: The Flow step panel (P4, W8)

- [ ] `NodeConfigPanel.tsx`: the Delete row inside the scroll area
- [ ] `FlowEditorProvider.ts:164`: the reply's `modelType` from `message.modelType`, with its test
- [ ] `NodeConfigPanel.tsx`: the picker greyed only with no list; the LLM list through `modelOptionsWithPersistedSelection`
- [ ] The harness against the rebuilt bundle (S33–S35); S36 in a dev launch

## Phase 9: The project switch (P5, W9)

- [ ] `scripts/qa/project-check.mjs --switch-to`: the 50 ms poll and its record
- [ ] S37: ten switches measured, with temporary host stamps (removed before the PR); the record in `qa-evidence.md`
- [ ] Only if S37 shows Ritemark's timers: `src/extension.ts:377–380` and `src/views/permanentTabs.ts:153`; S38, S39
- [ ] Otherwise: #569's RC check written into the release plan's Gate 1 list (S40)

## Phase 10: Part 2's QA and closeout

- [ ] Webview bundle rebuilt; the pre-commit validator by hand; `qa-validator`
- [ ] The smoke test on a dev launch; PR, extension tier; the manager's merge
- [ ] `docs/CHANGELOG.md`: one entry for Parts 1 and 2; release notes at the release's closeout
- [ ] The autosave on step selection: raised with the manager (P4's note)
