# Sprint 131 Tasks

**Parent:** [sprint-plan.md](./sprint-plan.md) · **Spec:** [spec.md](./spec.md) · **Plan:** [technical-plan.md](./technical-plan.md) · **Scenarios:** [scenarios.md](./scenarios.md)

**Gate:** no task below starts until Jarmo approves the sprint plan in the Sprint 131 session, in his own words, and the branch `sprint-131-browser-recent` exists (`git branch --show-current` must print it). T0.1 is not code and may follow the approval immediately. W0 finishes before W2 product code.

Workstreams: W0 dev environment + probes · W1 patch 009 bridge · W2 extension recorder + store · W3 Recent panel · W4 tests + QA · W5 documentation.

## W0: Dev environment and Phase 0 probes

- [ ] T0.1 Create the sprint worktree and branch `sprint-131-browser-recent` from `origin/main`. Update the release-plan row (branch, draft PR) and comment on #195 with the plan link.
- [ ] T0.2 Re-verify every file:line in the audit and technical plan on the branch base.
- [ ] T0.3 Build the dev environment: `df -h`, CoW-clone `vscode/`, `npm ci` in `extensions/ritemark`, reset + clean + `apply-patches.sh`, `npm run transpile-client` in `vscode/`.
- [ ] T0.4 Add the W1 contribution with a temporary event trace. Run the patched workbench with the unmodified extension and confirm that browsing shows no error or notification (S27).
- [ ] T0.5 Run probes P1–P5 (technical plan W0). Write `research/phase0-findings.md` with the observed event sequences. If P1 or P4 needs a different patch shape, stop and ask Jarmo.

## W1: Patch 009, the navigation bridge

- [ ] T1.1 `RitemarkBrowserHistoryContribution` in `features/ritemarkBrowserContextFeature.ts` (imports `ICommandService`, `ILogService`, `BrowserViewStorageScope`); remove the temporary trace. R1, R2, R8.
- [ ] T1.2 Update the header of `009-ritemark-browser-context-bridge.patch` (Purpose, the seventh bridge item, Sprint 131).
- [ ] T1.3 Regenerate 009 over its exact four paths. Check: 4 `diff --git` lines with the same paths; `git diff main -- patches/vscode/009-*` touches only the new-file hunk and the header.
- [ ] T1.4 From pristine: dry run (read the Can apply / Conflicts counts), real apply, second run on the patched tree. Patch 010 applies on top. S29.
- [ ] T1.5 `npm run compile-check-ts-native` in `vscode/` is clean.

## W2: Extension recorder and store

- [ ] T2.1 New `src/browser/browserNavigationRecorder.ts`: `parseNavigationEvent`, `normalizeHistoryUrl`, `cleanTitle`, `sameDocument`, `BrowserNavigationRecorder` with the rules table. R1–R5, R7, R8.
- [ ] T2.2 `BrowserHistoryStore.ts`: `title?`, normalized-key dedupe in `record(url, title?)` that keeps an existing title, `setTitle`, `pruneMissingFiles`. R4, R5, R6.
- [ ] T2.3 `extension.ts`: create the recorder and register `ritemark.browser.didNavigate` (not in `contributes.commands`); remove the `setBrowserHistoryStore` wiring.
- [ ] T2.4 `IntegratedBrowser.ts`: remove `historyStore`, `setBrowserHistoryStore` and the `record` call. Opening is unchanged. R2.

## W3: The Recent panel

- [ ] T3.1 `BrowserPanelProvider.ts`: `describe(url, title?)` per the technical plan's table. R5.
- [ ] T3.2 Prune on `ready` and on becoming visible, with `fileIsMissing` (true only for `FileNotFound`). R6.

## W4: Tests and QA

- [ ] T4.1 `src/browser/browserNavigationRecorder.test.ts`, including the patch-name contract test. S3, S10, S12–S18, S21–S23, S28.
- [ ] T4.2 `src/browser/BrowserHistoryStore.test.ts`. S19, S20, S24, S25.
- [ ] T4.3 Add both to `npm test`. Run `npm test` and `npm run compile` in `extensions/ritemark`; both clean.
- [ ] T4.4 Dev-instance QA: run scenarios S1–S26 against the patched build (CDP, local fixture server plus `ritemark.app` / `http://github.com`), collect the Recent rows after each step and screenshot the panel. Evidence in `qa-evidence.md`. Every scenario not run is listed as not run, with the reason.
- [ ] T4.5 `./scripts/validate-qa.sh` from the worktree, and the pre-commit validator run by hand with `CLAUDE_PROJECT_DIR="$PWD"` before each commit.
- [ ] T4.6 Ask in the main session for `qa-validator` sign-off for Phase 4.

## W5: Documentation and closeout

- [ ] T5.1 `docs/development/architecture.md`: the workbench→extension push in the browser subsystem, plus an update-log row.
- [ ] T5.2 `CLAUDE.md` patch table: 009's row (navigations to Browser Recent; "extension host", not "browser panel").
- [ ] T5.3 v1.14.0 release notes draft line; mark the v1.8.6 known issue for #195 as fixed.
- [ ] T5.4 Release plan: Sprint 131 status, and the Windows check in the release test list (S1, S2, S6, S10 with Ctrl-click, S24 on the signed installer).
- [ ] T5.5 Draft PR to ready. In the "PR ready" message, ask Jarmo for an admin merge, naming the PR number. #195 closes with the v1.14.0 release (post-release issue sweep).
