# Sprint 107 Spec — Clean Start (Trustworthy First Open)

**Parent:** [sprint-plan.md](./sprint-plan.md) · **Issues:** none pre-filed — this sprint originates directly from a root-cause analysis Jarmo commissioned, not a queued GitHub issue (see sprint-plan.md) · **Evidence base:** [docs/development/analysis/2026-08-04-md-opens-as-code-trust-ux.md](../../../analysis/2026-08-04-md-opens-as-code-trust-ux.md) (empirical reproduction on the installed v1.8.5 production app) + [research/product-json-defaults-audit.md](./research/product-json-defaults-audit.md) (source-level verification of the R1 mechanism, this sprint)

## Purpose

A user who double-clicks a `.md` file from Finder or Explorer — the single most ordinary way to open Ritemark's core file type — currently gets the plain-text editor, a Restricted Mode badge, and a "do you trust the authors of this workspace" terminal-trust modal, on every launch, forever, because the tab that resulted from the first bad resolution never un-sticks itself. The root cause is one dead configuration key: `branding/product.json`'s `configurationDefaults` block has shipped since Sprint 57 but has never actually been read by desktop VS Code. This sprint activates that key for real (R1), makes a deliberate, hardened decision about the resulting trust posture (R2), heals users who are already stuck (R3), and — under an explicit Jarmo order issued while scoping this sprint — removes an unrelated but adjacent piece of onboarding friction in the same surface area (R4).

## Principles

- **Fix the root cause, not the symptom.** R1 activates the exact mechanism VS Code's own web workbench already trusts (`configurationRegistry.registerDefaultConfigurations`), rather than patching around cold-cache and trust side effects individually.
- **Consumer-app trust defaults, not developer-tool defaults.** Ritemark users are not reviewing untrusted git checkouts for code execution before opening them; the workspace-trust prompt is IDE-context noise for them. This was Sprint 57's original intent — this sprint is the first time it actually ships.
- **Closing one gap must not silently open another.** Disabling workspace trust removes a speed bump the daemon scheduler was informally (and unintentionally) leaning on. R2 replaces it with a purpose-built consent gate rather than leaving a hole.
- **Heal, don't just fix forward.** Users already bitten by the bug have a permanently-stuck text tab. They should not need tribal knowledge ("close the tab and reopen it") to recover once the fix ships.
- **Removal needs authorization, not just good taste.** R4 is sanctioned by an explicit Jarmo order (2026-08-04: "korja ära ka see veider Claude'i tervitus box! Seda pole enam vaja") despite CLAUDE.md's default feature-preservation rule. Every OTHER setup-flow surface (`OnboardingWizard`, `CodexSetupView`, `OpenCodeSetupView`, the genuine `needsSetup` states) stays exactly as it is.

## Requirements

### R1: Wire `product.json` `configurationDefaults` into the desktop configuration bootstrap

As a user who double-clicks a `.md` (or `.csv` / `.pdf` / `.docx` / `.xlsx` / `.xls` / `.flow.json`) file from Finder/Explorer, I want it to open in Ritemark's own editor on the very first launch of a profile, so the app behaves like the file-type-aware editor it is branded as, instead of a generic code editor.

Acceptance criteria:
- New VS Code patch `013-ritemark-configuration-defaults.patch` (next free number — patches 001–012 exist) makes `branding/product.json`'s `configurationDefaults` block effective on desktop, using the same `configurationRegistry.registerDefaultConfigurations([{ overrides: ... }])` primitive the web workbench already calls (`vscode/src/vs/workbench/services/configuration/browser/configuration.ts:48-50`).
- `IProductConfiguration` (`vscode/src/vs/base/common/product.ts`) gains a typed, optional `configurationDefaults` field so `productService.configurationDefaults` compiles; `IProductService` inherits it automatically (`platform/product/common/productService.ts` — `Readonly<IProductConfiguration>`).
- On a fresh profile with an empty `editorOverrideService.cache` (profile-scoped storage), opening a `.md` file as a startup file resolves directly to `ritemark.editor` — no intermediate flash of the plain-text editor. Mechanism (verified by source reading, see the audit): the product-sourced default populates `configurationService.inspect('workbench.editorAssociations').defaultValue`; `EditorResolverService.getAllUserAssociations()` already merges default-scope values in; `resourceMatchesUserAssociation()` then returns `true` and the resolver awaits `whenInstalledExtensionsRegistered()` before resolving — the exact upstream #244597 hatch, engaged for the first time.
- Same result for `.markdown`, `.csv`, `.xlsx`, `.xls`, `.pdf`, `.docx`, `.flow.json` per the existing product.json mapping — this requirement does not change which viewType maps to which extension, only makes the mapping real.
- Registration happens synchronously during `DefaultConfiguration` construction, which runs before `initialize()`/`reload()` are ever awaited by any caller. This ordering argument is documented in [technical-plan.md](./technical-plan.md) and re-verified with a live Phase 0 spike (not taken purely on static inspection).
- No behavior change to the theme/layout keys already in the same `configurationDefaults` block — `extension.ts`'s independent writes of those same values continue unchanged (a now-harmless redundancy, not removed this sprint — see Non-Requirements).
- Ships for both darwin-arm64 and win32-x64 — shell-tier patch, both platforms build from the same submodule + patch set, both must be verified.

### R2: Trust posture stays off; add consent for schedule-triggered autonomous runs

As a consumer user, I want Ritemark to stay out of my way with developer-tool trust prompts. As a user who opens someone else's folder, I want Ritemark to ask before it starts running AI agents in it on a timer I never set up.

Acceptance criteria:
- `security.workspace.trust.enabled: false` ships as an effective default (via R1's wiring) — Sprint 57's original intent, now real. No workspace, empty-window, or loose-file launch shows the trust modal or a Restricted Mode badge.
- A per-workspace consent gate ships for the daemon scheduler (`extensions/ritemark/src/daemon/Scheduler.ts`) such that `.claude/agents`/`.agents` files with a `schedule:` block found inside a WORKSPACE do not arm a cron timer (`Scheduler.register()`) until the user has affirmatively allowed scheduled automation for that specific workspace. The consent mechanism is **Option A (decided 2026-08-04, D1)**: a per-workspace opt-in toast shown the first time a schedule-eligible agent file is found, with the decision reviewable/revocable later in Agent Library. Option B (user-level-dirs-only default) was considered and not selected — see Open Questions and sprint-plan.md's Product Decisions for the full comparison, kept for the record.
- The consent gate applies only to schedule-triggered autonomous firing. It does not add a new gate to interactive agent conversations (already covered by the unified approval gate) and does not change the existing per-action modal for blocked writes/shell commands (`ritemark.daemon.approveScheduledAction`, `extensions/ritemark/src/daemon/index.ts:65-137`) — that gate is unmodified.
- Consent state is reviewable and revocable after the fact, not just a one-shot decision at first sight — surfaced in the Agent Library view (`AgentLibraryViewProvider`), which already surfaces daemon status.
- The `scheduled-tasks-daemon` feature flag (`status: 'stable'` since Sprint 80) is unchanged by this requirement. R2 adds a per-workspace layer underneath it, not a new global kill-switch, and does not touch `src/features/flags.ts`.
- Existing workspaces where the daemon is already actively scheduling tasks today do not silently and permanently lose that behavior the moment this sprint ships: **decided 2026-08-04 (D2), grandfathered** — a workspace with existing run history is treated as already consented; only new workspaces (no run history) go through the Option A toast.

### R3: Heal existing stuck text tabs on activation

As a user who was already bitten by the bug — a `.md` file permanently pinned open in the plain-text editor from before this fix shipped — I want Ritemark to notice and fix that for me, so I don't need to know the "close the tab and reopen" workaround.

Acceptance criteria:
- On activation, once per profile (guarded by a `context.globalState` marker, following the existing pattern already used for the theme migration in `extension.ts`), Ritemark enumerates `vscode.window.tabGroups.all`, finds file-scheme tabs whose input is `vscode.TabInputText` with a `.md`/`.markdown` URI, and reopens each via `vscode.commands.executeCommand('vscode.openWith', uri, 'ritemark.editor', ...)`, best-effort preserving the tab's active/pinned state and its original group/column.
- The migration runs exactly once per profile. A second activation does not re-scan or re-open already-healed tabs, and does not touch text tabs a user opens intentionally AFTER the one-shot marker is set.
- A user who had deliberately chosen "Reopen With -> Text Editor" for a specific `.md` file loses that per-tab choice once, silently, the first time this migration runs. This is a named, accepted tradeoff (documented here and in scenarios.md), not a bug to chase later.
- The healer does not touch non-`.md`/`.markdown` text tabs, diff editors, untitled files, or any file already open in a non-text editor.
- The healer is inert — no-op, no error, no user-visible noise — when there are zero stuck tabs, when `ritemark.editor` cannot resolve for a candidate URI (e.g., the file no longer exists on disk), or when R1 has already prevented the tab from ever getting stuck (a profile created fresh after this ships has nothing to heal).

### R4: Remove the "Claude is ready" welcome card

As a returning user whose agent is already set up, I want the AI sidebar to go straight to a usable chat, so I don't see a "Claude is ready — Get Started" card that adds a click for no reason.

Acceptance criteria:
- `AISidebar.tsx`'s render branch keyed on `ready && (needsSetup || showWelcome)` (currently lines 159-163) no longer takes the `showWelcome`-only path to `<SetupWizard />`. The `needsSetup` path (binary missing/broken, auth needed — `needsSetup = isClaudeCode && setupStatus !== null && setupStatus.state !== 'ready'`) is untouched and still renders `<SetupWizard />` exactly as before.
- The `ready && onboardingStatus && !onboardingStatus.anyAgentReady && !onboardingDismissed` path to `<OnboardingWizard />` (first run, no agent ready yet — currently lines 157-158) is untouched.
- `showCodexSetup -> <CodexSetupView />` and `showOpenCodeSetup -> <OpenCodeSetupView />` branches (currently lines 164-177) are untouched.
- The bookkeeping `dismissWelcome()` currently performs on click (`store.ts:1303-1306`: sets `hasSeenWelcome: true` locally, posts `agent-setup:dismiss-welcome` which `UnifiedViewProvider.ts:518-520` persists as `ritemark.ai.hasSeenClaudeWelcome = true`, global config target) still happens automatically, the moment the ready-with-no-conversation state is reached, so no other code that may read `hasSeenWelcome`/`hasSeenClaudeWelcome` observes a different value than it would have after a manual click.
- Net user-visible effect: a Claude-ready sidebar with no conversation yet shows the normal empty-chat composer directly — no intermediate card, no extra click.

## Non-Requirements

- No change to the T-tame alternative (S2 in the analysis doc). Jarmo's approved scope keeps trust OFF (T-off); T-tame is not built this sprint.
- No OS-level file-type-association change (macOS Launch Services, Windows registry `ProgID`, `installer/windows/ritemark.iss`). The app already receives the double-click and launches; this sprint only changes which INTERNAL editor the received file opens in.
- No removal of the redundant theme/layout writes in `extension.ts`'s `activate()` — they become harmless once R1 ships (both paths write the same values) but are not deleted this sprint.
- No general redesign of the daemon's auto-approval policy for writes/shell commands (`AgentTaskHandler`'s existing block-and-modal-approve flow). R2 only adds a gate on SCHEDULING/FIRING eligibility, not on what an already-firing run is allowed to do.
- No new user-level (non-workspace) scheduled-agents directory. That is one of the two options under discussion for R2 (Open Questions D1), not committed scope.
- No change to `OnboardingWizard`, `CodexSetupView`, or `OpenCodeSetupView` beyond leaving them exactly as they render today — R4 touches only the `showWelcome`-only branch.
- No change to the terminal-view-auto-create mechanism (`terminalView.ts` `focus()` → `createTerminal`) or to patch 002's `hideIfEmpty`/`AuxiliaryBar` placement. Disabling trust (R2) removes the modal regardless of whether a terminal still gets created in the background; that mechanism itself is not this sprint's problem to solve.

## Resolved Questions

- **Does clicking "Get Started" perform any setup step beyond dismissing the card?** No. Traced end-to-end: `SetupWizard.tsx:156-160` (`onClick={dismissWelcome}`) → `store.ts:1303-1306` (`set({ hasSeenWelcome: true })` + `agent-setup:dismiss-welcome` message) → `UnifiedViewProvider.ts:518-520` (`ritemark.ai.hasSeenClaudeWelcome` global config write). No other side effect exists anywhere in that chain. R4 is a safe, side-effect-preserving removal as long as this bookkeeping still fires automatically once the ready-with-no-conversation state is reached.
- **Is `workbench.editorAssociations` read from configuration DEFAULTS, or only from explicit user settings, by the mechanism R1 depends on?** Read directly, not assumed: `EditorResolverService.getAllUserAssociations()` (`editorResolverService.ts:274-294`) calls `configurationService.inspect(...)` and explicitly merges in `inspectedEditorAssociations.defaultValue` alongside `workspaceValue`/`userValue`. A product-sourced DEFAULT is sufficient to satisfy `resourceMatchesUserAssociation()`.
- **Does the daemon's existing auto-approval policy already block dangerous scheduled-agent actions?** Yes, partially. `extensions/ritemark/src/daemon/index.ts` shows file-writes and shell commands are already blocked pending an explicit modal (`ritemark.daemon.approveScheduledAction`) that names the exact write target or command before re-running. What is NOT gated at all today is (a) whether a workspace gets scanned and a cron timer armed in the first place, and (b) file READS, which `docs/development/architecture.md`'s Scheduled Tasks (Daemon) section confirms are auto-approved for agent tasks — and can therefore reach an LLM provider — with no consent step. R2's scope is precisely this narrower gap, not a claim that scheduled agents can currently write files or run shell commands with no gate.
- **Was a confirmation dialog considered for the R3 tab healer?** Considered and rejected. The migration only ever moves a `.md` tab TOWARD the state R1 would have produced on a fresh profile; it is a pure bug-fix correction, not a new capability, so a confirmation prompt would be ceremony without a real decision behind it. The one-time, silent, `globalState`-guarded pattern already used for the theme migration in `extension.ts` is reused instead.

## Open Questions (product decisions — tracked in sprint-plan.md)

- **D1 (R2): Decided 2026-08-04 (Jarmo) — Option A.** Per-workspace opt-in toast (consent requested the first time a schedule-eligible agent file is found in a workspace, reviewable/revocable later in Agent Library). Option B (user-level-dirs-only default; workspace-relative `.claude/agents`/`.agents` scanning off by default with a new global/user-level agents directory scanned unconditionally) was not selected. Full tradeoff writeup, kept for the record: sprint-plan.md Product Decisions.
- **D2 (R2): Decided 2026-08-04 (Jarmo) — grandfather.** A workspace where the daemon is already actively scheduling tasks today (pre-sprint) is treated as implicit legacy consent — no prompt, no gap in service. New workspaces (no run history) go through the D1/Option A flow.

Both decisions were made together with sprint plan approval; implementation of R2 still waits on the sprint-wide Execution Hold in sprint-plan.md (the v1.8.6 sprint queue must reach Sprint 107 first).
