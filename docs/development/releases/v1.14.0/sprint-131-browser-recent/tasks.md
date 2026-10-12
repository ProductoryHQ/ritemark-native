# Sprint 131 Tasks

**Parent:** [sprint-plan.md](./sprint-plan.md) · **Spec:** [spec.md](./spec.md) · **Plan:** [technical-plan.md](./technical-plan.md) · **Scenarios:** [scenarios.md](./scenarios.md)

**Gate:** no task below starts until Jarmo approves the sprint plan in the Sprint 131 session, in his own words, and the branch `sprint-131-browser-recent` exists (`git branch --show-current` must print it). T0.1 is not code and may follow the approval immediately. W0 finishes before W2 product code.

Workstreams: W0 dev environment + probes · W1 patch 009 bridge · W2 extension recorder + store · W3 Recent panel · W4 tests + QA · W5 documentation.

## W0: Dev environment and Phase 0 probes

- [x] T0.1 Create the sprint worktree and branch `sprint-131-browser-recent` from `origin/main`. Update the release-plan row (branch, draft PR) and comment on #195 with the plan link.
- [x] T0.2 Re-verify every file:line in the audit and technical plan on the branch base.
- [x] T0.3 Build the dev environment: `df -h`, CoW-clone `vscode/`, `npm ci` in `extensions/ritemark`, reset + clean + `apply-patches.sh`, `npm run transpile-client` in `vscode/`.
- [x] T0.4 Add the W1 contribution with a temporary event trace. Run the patched workbench with the unmodified extension and confirm that browsing shows no error or notification (S27).
- [x] T0.5 Run probes P1–P5 (technical plan W0). Write `research/phase0-findings.md` with the observed event sequences. If P1 or P4 needs a different patch shape, stop and ask Jarmo. *(Done: all five pass; two W2 rule changes, P8 settle 1 s and P9 fallback titles.)*

## W1: Patch 009, the navigation bridge

- [x] T1.1 `RitemarkBrowserHistoryContribution` in `features/ritemarkBrowserContextFeature.ts` (imports `ICommandService`, `ILogService`, `BrowserViewStorageScope`); remove the temporary trace. R1, R2, R8.
- [x] T1.2 Update the header of `009-ritemark-browser-context-bridge.patch` (Purpose, the seventh bridge item, Sprint 131).
- [x] T1.3 Regenerate 009 over its exact four paths. Check: 4 `diff --git` lines with the same paths; `git diff main -- patches/vscode/009-*` touches only the new-file hunk and the header.
- [x] T1.4 From pristine: dry run (read the Can apply / Conflicts counts), real apply, second run on the patched tree. Patch 010 applies on top. S29.
- [x] T1.5 `npm run compile-check-ts-native` in `vscode/` is clean.

## W2: Extension recorder and store

- [x] T2.1 New `src/browser/browserNavigationRecorder.ts`: `parseNavigationEvent`, `normalizeHistoryUrl`, `cleanTitle` (incl. Chromium fallbacks, P9), `sameDocument`, `BrowserNavigationRecorder` with the rules table, the 1 s settle with an injected clock and flush on dispose (P8). R1–R5, R7, R8.
- [x] T2.2 `BrowserHistoryStore.ts`: `title?`, normalized-key dedupe in `record(url, title?)` that keeps an existing title, `setTitle`, `pruneMissingFiles`. R4, R5, R6.
- [x] T2.3 `extension.ts`: create the recorder and register `ritemark.browser.didNavigate` (not in `contributes.commands`); remove the `setBrowserHistoryStore` wiring.
- [x] T2.4 `IntegratedBrowser.ts`: remove `historyStore`, `setBrowserHistoryStore` and the `record` call. Opening is unchanged. R2.

## W3: The Recent panel

- [x] T3.1 `BrowserPanelProvider.ts`: `describe(url, title?)` per the technical plan's table. R5.
- [x] T3.2 Prune on `ready` and on becoming visible, with `fileIsMissing` (true only for `FileNotFound`). R6.

## W4: Tests and QA

- [x] T4.1 `src/browser/browserNavigationRecorder.test.ts`, including the patch-name contract test and a loopback-host case (R7). S3, S10, S12–S18, S21–S23, S26, S28, S30.
- [x] T4.2 `src/browser/BrowserHistoryStore.test.ts`. S19, S20, S24, S25.
- [x] T4.3 Add both to `npm test`. Run `npm test` and `npm run compile` in `extensions/ritemark`; both clean.
- [x] T4.4 Dev-instance QA: run scenarios S1–S26 against the patched build (CDP, local fixture server plus `ritemark.app` / `http://github.com`), collect the Recent rows after each step and screenshot the panel. Evidence in `qa-evidence.md`. Every scenario not run is listed as not run, with the reason. *(30/31 pass; S9 AI agent navigation not run, for Gate 2.)*
- [x] T4.5 `./scripts/validate-qa.sh` from the worktree, and the pre-commit validator run by hand with `CLAUDE_PROJECT_DIR="$PWD"` before each commit.
- [x] T4.6 Ask in the main session for `qa-validator` sign-off for Phase 4. *(PASS 2026-10-12.)*

## Added during QA (2026-10-12)

- [x] T4.7 One entry per page whatever its `#fragment` (`historyKey`, S31, P10), with unit tests and a dev-instance re-run.
- [x] T4.8 The name line shows a non-default port for untitled pages (R5 revised), with a unit test.

## W5: Documentation and closeout

- [x] T5.1 `docs/development/architecture.md`: the workbench→extension push in the browser subsystem, plus an update-log row.
- [x] T5.2 `CLAUDE.md` patch table: 009's row (navigations to Browser Recent; "extension host", not "browser panel").
- [x] T5.3 v1.14.0 release notes draft line; mark the v1.8.6 known issue for #195 as fixed. *(In sprint-plan.md "Release notes (draft)"; no v1.14.0 notes file exists yet, so none was created for one sprint.)*
- [x] T5.4 Release plan: Sprint 131 status, and the Windows check in the release test list (S1, S2, S6, S10 with Ctrl-click, S24 on the signed installer).
- [ ] T5.5 Draft PR to ready. In the "PR ready" message, ask Jarmo for an admin merge, naming the PR number. #195 closes with the v1.14.0 release (post-release issue sweep).
