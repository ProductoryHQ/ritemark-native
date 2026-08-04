# Sprint 107 Tasks

Implementation checklist for [technical-plan.md](./technical-plan.md). Tick `[x]` only when the change exists on branch `sprint-107-clean-start` (SDD discrepancy-detection rule — do not pre-tick). Requirement IDs from [spec.md](./spec.md).

> **Gate:** The sprint plan is APPROVED (Jarmo, 2026-08-04, "Sprint accepted") and D1/D2 are decided (Option A; grandfather) — see sprint-plan.md. **However, an explicit EXECUTION HOLD is in effect: no phase below may start, and the branch must not be created, until the v1.8.6 sprint queue reaches Sprint 107** (sprints 102–106 run first; 103 is currently in progress). This is Jarmo's explicit instruction ("ära enne alusta kui järg jõuab kätte 107-le"), not a soft recommendation — see sprint-plan.md's Execution Hold section. Once the hold lifts, Phase 1+ still starts only after `git checkout -b sprint-107-clean-start` exists (verify with `git branch --show-current`) — branch creation remains the IMMEDIATE FIRST ACTION, unchanged. Phase 0's audit is read-only research and is already done (`research/product-json-defaults-audit.md`); the Phase 0 *live spike* requires both the branch and the hold to be lifted.

## Phase 0: R1 live spike (W0)

- [ ] Apply a draft of patch 013 locally; build; launch with a fresh `--user-data-dir` + loose `.md` file argument (analysis doc's exact repro)
- [ ] Confirm first-launch resolves directly to `ritemark.editor` — no text-editor flash, no trust modal, no Restricted Mode badge
- [ ] Confirm `.csv`/`.xlsx`/`.xls`/`.pdf`/`.docx`/`.flow.json` startup-file opens resolve correctly on first launch too
- [ ] Confirm `Reopen With -> Text Editor` is still reachable and functions per-tab
- [ ] Repeat on the win32-x64 shell build
- [ ] If any result contradicts `research/product-json-defaults-audit.md` → STOP, update spec.md/technical-plan.md first (mid-sprint protocol) before continuing

## Phase 1: `product.json` configuration defaults on desktop (W1 — R1)

- [ ] `./scripts/create-patch.sh "ritemark-configuration-defaults"` to scaffold patch 013
- [ ] `vscode/src/vs/base/common/product.ts`: add `readonly configurationDefaults?: Record<string, unknown>;` to `IProductConfiguration`
- [ ] `vscode/src/vs/workbench/services/configuration/browser/configuration.ts`: inject `IProductService`; extend `DefaultConfiguration`'s constructor to additively register `productService.configurationDefaults` alongside the existing `environmentService.options?.configurationDefaults` check
- [ ] Confirm `IProductService` is legally available for injection at the call site (`services/configuration/browser/configurationService.ts:129`); wire it through if not already present
- [ ] `./scripts/apply-patches.sh --dry-run` clean; finalize patch 013 content per `.claude/skills/vscode-development/PATCH-RULES.md`
- [ ] No `branding/product.json` content changes needed (block already correct) — confirm no edits crept in
- [ ] Phase 0 live spike re-run against the finalized patch (not just the draft)

## Phase 2: Daemon consent for schedule-triggered runs (W2 — R2)

> D1 and D2 are decided (2026-08-04: Option A; grandfather — sprint-plan.md Product Decisions). This phase still waits on the sprint-wide Execution Hold (tasks.md top gate) and additionally sequences after Phase 1's spike has confirmed trust-off is actually effective.

- [x] Record Jarmo's D1 decision (Option A) and D2 decision (grandfather) in spec.md's Open Questions / sprint-plan.md Product Decisions — 2026-08-04
- [ ] New module `extensions/ritemark/src/daemon/workspaceConsent.ts` implementing Option A: consent-state read/write over `context.workspaceState`
- [ ] `extensions/ritemark/src/daemon/Scheduler.ts`: gate `register()` calls in `scanWorkspace()` / `reloadFile()` / the file-watcher callback behind consent state
- [ ] `extensions/ritemark/src/daemon/index.ts`: wire the first-seen consent prompt per Option A (Option B's user-level-dir scan is not built)
- [ ] `AgentLibraryViewProvider` (webview or provider side, whichever is the smaller diff): surface current per-workspace consent state with a review/revoke control
- [ ] Apply D2's decision (grandfather) to the consent module's default-state logic: `getConsentState()` defaults to `'granted'` when `DaemonResultStore` already has run history for the workspace, `'undecided'` otherwise
- [ ] Unit tests: consent-state transitions; `Scheduler.scanWorkspace()` parses-but-does-not-register when consent is not granted
- [ ] `docs/development/architecture.md`: new subsection under Scheduled Tasks (Daemon) documenting the consent gate

## Phase 3: Sticky-tab healer (W3 — R3)

- [ ] New module `extensions/ritemark/src/utils/stickyTabHealer.ts`: `findStuckMarkdownTabs()` pure candidate-selection logic
- [ ] `extension.ts` `activate()`: one-shot `globalState`-guarded migration calling `findStuckMarkdownTabs()` + `vscode.commands.executeCommand('vscode.openWith', ..., 'ritemark.editor', ...)` per candidate, following the existing theme-migration pattern in the same function
- [ ] `stickyTabHealer.test.ts`: candidate selection against fabricated `TabGroup[]` fixtures (matches `.md`/`.markdown` text tabs only; ignores diff editors, untitled buffers, non-markdown extensions)
- [ ] Manual QA: pre-seed a profile with a stuck text tab (pre-sprint build, or force one via `Reopen With -> Text Editor` then simulate a fresh activation) and confirm the upgrade-path scenario

## Phase 4: Remove the ready-welcome branch (W4 — R4)

- [ ] `webview/src/components/ai-sidebar/AISidebar.tsx`: change the `ready && (needsSetup || showWelcome)` branch to `ready && needsSetup`, leaving the `OnboardingWizard`/`CodexSetupView`/`OpenCodeSetupView` branches untouched
- [ ] Wire automatic `dismissWelcome()` firing (effect or equivalent) the moment the ready-with-no-conversation condition is met, so `hasSeenWelcome`/`ritemark.ai.hasSeenClaudeWelcome` bookkeeping still happens without the click
- [ ] `SetupWizard.tsx`: remove the now-unreachable `isReady` ("Claude is ready" / "Get Started" / "Technical details") branch
- [ ] Update or add webview component tests covering: ready+no-conversation → composer (not a card); needsSetup / onboarding / Codex / OpenCode paths unaffected

## Phase 5: QA and closeout

- [ ] Run focused unit tests added in Phases 2–4 plus full extension/webview test suites
- [ ] Manual QA: walk every scenario in [scenarios.md](./scenarios.md) on the dev build (`/rundev`) before Jarmo handoff, per the dev-validation-before-handoff house rule — include the win32-x64 shell build for R1's Windows-parity scenario
- [ ] Run `./scripts/validate-qa.sh`
- [ ] Update `docs/CHANGELOG.md` + `docs/releases/v1.8.6/release-notes.md`
- [ ] Update `docs/user/troubleshooting.md` if it currently documents the "opens as code" / trust-modal symptom (check current content first — it shows as already modified in the working tree independent of this sprint)
- [ ] Update `docs/development/architecture.md` (daemon consent subsection from Phase 2, plus a short note on the R1 configuration-defaults mechanism)
- [ ] Update `docs/development/releases/v1.8.6/release-plan.md` Sprint Map / Tracker rows for sprint-107
- [ ] File a GitHub issue for this sprint if Jarmo wants one for release-note/milestone linkage (none was pre-filed — see sprint-plan.md)
- [ ] Commit, push, open PR — requirement IDs in commit messages (`fix(sprint-107): R1 ...`, `feat(sprint-107): R2 ...`, etc.)
