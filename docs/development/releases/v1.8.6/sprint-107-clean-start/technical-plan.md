# Sprint 107 Technical Plan

Architecture and implementation approach for [spec.md](./spec.md). Grounded in [research/product-json-defaults-audit.md](./research/product-json-defaults-audit.md) — reread it before touching `vscode/` or `patches/`.

## Architecture Overview

Components touched, by requirement:

```
R1                    VS Code core (patches/013)              branding/product.json
──                    ──────────────────────────              ─────────────────────
(no runtime code)     configuration.ts DefaultConfiguration ◀── configurationDefaults (already present)
                       product.ts IProductConfiguration (+field)

R2                    extension host                          webview / Agent Library
──                    ──────────────────                      ──────────────────────
                       daemon/Scheduler.ts (gate register())  AgentLibraryViewProvider (consent UI + review/revoke)
                       daemon/index.ts (wiring)                new small consent-state module

R3                    extension host
──                    ──────────────────
                       extension.ts activate() (one-shot, globalState-guarded)
                       new small pure-logic helper (unit-testable candidate-tab selection)

R4                    webview (React)
──                    ──────────────────
                       AISidebar.tsx (remove one ternary branch)
                       store.ts (dismissWelcome — call site changes, logic unchanged)
```

No new subsystems, no changes to locked architecture decisions (`AgentRuntime` interface, unified approval gate, patch system, VS Code-as-submodule). R1 is the only requirement that touches `vscode/` (via a new numbered patch) or `branding/product.json` (no changes needed there — the block already has the right values; only the consumption side changes).

## Workstream 0: R1 audit spike (Phase 0 — before patch code)

Already partially discharged by static reading (`research/product-json-defaults-audit.md`). The remaining live-verification step, to run once the sprint branch exists and before Phase 1 is considered done:

1. Apply the draft patch to a local build; launch with a fresh `--user-data-dir` + loose `.md` file argument (the analysis doc's exact repro).
2. Confirm first-launch resolves directly to `ritemark.editor`, no text-editor flash, no trust modal, no Restricted Mode badge.
3. Confirm the other five mapped extensions resolve correctly on first launch too.
4. Confirm `Reopen With -> Text Editor` is still reachable and works per-tab.
5. Repeat on the win32-x64 shell build.

If any spike result contradicts the audit's conclusions, STOP and update spec.md/this document before writing further code (mid-sprint protocol), rather than patching around a surprise.

## Workstream 1: `product.json` configuration defaults on desktop (R1)

### VS Code core — `vscode/src/vs/base/common/product.ts`

Add one field to `IProductConfiguration` (style-matched to the file's existing optional-readonly fields, e.g. near other workbench-level product config):

```typescript
export interface IProductConfiguration {
  // ... existing fields ...

  /**
   * Default configuration overrides contributed by the product, applied the
   * same way extension-contributed `configurationDefaults` are, but sourced
   * from product.json instead of an extension manifest. Desktop-only path —
   * the web workbench already reads the equivalent value from
   * `IWorkbenchConstructionOptions.configurationDefaults`.
   */
  readonly configurationDefaults?: Record<string, unknown>;
}
```

### VS Code core — `vscode/src/vs/workbench/services/configuration/browser/configuration.ts`

Extend `DefaultConfiguration`'s constructor to ALSO register `productService.configurationDefaults`, additively — the existing `environmentService.options?.configurationDefaults` check (the web mechanism) is untouched:

```typescript
constructor(
  cacheScope: string,
  private readonly configurationCache: IConfigurationCache,
  environmentService: IBrowserWorkbenchEnvironmentService,
  logService: ILogService,
  @IProductService productService: IProductService,   // NEW
) {
  super(logService);
  this.cacheKey = { type: 'defaults', key: `${cacheScope}-configurationDefaultsOverrides` };
  if (environmentService.options?.configurationDefaults) {
    this.configurationRegistry.registerDefaultConfigurations([{ overrides: environmentService.options.configurationDefaults as IStringDictionary<IStringDictionary<unknown>> }]);
  }
  if (productService.configurationDefaults) {          // NEW
    this.configurationRegistry.registerDefaultConfigurations([{ overrides: productService.configurationDefaults as IStringDictionary<IStringDictionary<unknown>> }]);
  }
}
```

Requires confirming `IProductService` is legally injectable at the one call site (`services/configuration/browser/configurationService.ts:129`) — if the constructor argument list there needs updating too (it currently passes `userDataProfileService.currentProfile.id, configurationCache, environmentService, logService` positionally; DI-decorated params are typically appended and resolved by the injector, not positionally passed by the caller, but this must be confirmed against how `WorkspaceService`/`ConfigurationService` itself receives `IProductService` — if it doesn't already have it, that constructor also needs the service added).

Both blocks are independent and additive: on web, both may fire (harmless — `registerDefaultConfigurations` merges); on desktop, only the new block fires (the `environmentService.options` branch is always falsy there, per the audit).

### Patch mechanics

- `./scripts/create-patch.sh "ritemark-configuration-defaults"` → produces `patches/vscode/013-ritemark-configuration-defaults.patch`.
- Follow `.claude/skills/vscode-development/PATCH-RULES.md` (unused-imports gotcha: importing `IProductService`/its decorator in `configuration.ts` needs the import added correctly, not left dangling if a later edit removes usage).
- No change to `branding/product.json` itself — the `configurationDefaults` block already has the correct content; this workstream only changes who reads it.

### Tests

- No existing unit test suite covers `configuration.ts` today inside this repo (it's upstream VS Code code, not `extensions/ritemark/`); verification is the Phase 0 live spike plus the scenarios in scenarios.md (manual QA), not a new automated unit test. Do not invent a synthetic unit test harness for upstream VS Code internals this sprint — out of proportion to the fix.

## Workstream 2: Per-workspace daemon consent (R2)

### Product decision — resolved

**D1 decided 2026-08-04 (Jarmo): Option A.** Full comparison kept below — Option A is the implementation target; Option B is documented as the rejected alternative for the record, not a live choice. Do not build Option B.

### Option A — SELECTED (decided 2026-08-04) — per-workspace opt-in toast

- New small module, e.g. `extensions/ritemark/src/daemon/workspaceConsent.ts`: reads/writes a per-workspace consent flag via `context.workspaceState` (already the correct scope — `DaemonResultStore` already uses `context.workspaceState` for run history, same pattern). Shape: `getConsentState(): 'granted' | 'declined' | 'undecided'`, `setConsentState(state)`.
- `daemon/index.ts` — after `scanWorkspace()` discovers at least one schedule-eligible file and consent is `'undecided'`, show a non-blocking `vscode.window.showInformationMessage` with actions (e.g. "Allow" / "Not now"), naming the count of scheduled agents found. On "Allow", call `setConsentState('granted')` and register the discovered entries. On "Not now", call `setConsentState('declined')` (or leave `'undecided'` with a defined re-prompt cadence — implementation detail, not a spec-level requirement) and do not register.
- `daemon/Scheduler.ts` — `scanWorkspace()`/`reloadFile()`/the file-watcher callback check consent before calling `register()`; when consent is not `'granted'`, entries are parsed (so Agent Library can still show "N scheduled agents defined here") but not armed.
- `AgentLibraryViewProvider` (or its webview) — surfaces current consent state with an explicit toggle so the user can grant/revoke after the fact without waiting for the one-shot toast.

### Option B — rejected alternative, kept for the record — user-level dirs only by default, per-workspace enable in Agent Library

- `Scheduler.ts`'s `AGENT_DIRS` (currently `['.claude/agents', '.agents']`, both workspace-relative) would need a THIRD, user-level location (e.g. a Ritemark-global agents directory outside any workspace) that is scanned unconditionally, while the two existing workspace-relative dirs scan but do not auto-register without an explicit per-workspace enable flag set in Agent Library.
- This is more net-new surface than Option A: there is no existing user-level/global agents directory concept anywhere in the current daemon code (`AGENT_DIRS` is 100% workspace-relative today), so Option B requires inventing that location, its discovery UX, and a migration story for anyone currently relying on workspace-relative scheduling — on top of the same Agent Library toggle Option A also needs.
- Tradeoff, for the record in sprint-plan.md: Option B is default-safe with zero prompts ever, at the cost of requiring every user (including ones who wrote their own trusted per-project scheduled agent) to take a proactive extra step in a different panel before their own file ever fires — friction on the common case to protect against the rare one.

### Either option — shared pieces

- `docs/development/architecture.md`'s Scheduled Tasks (Daemon) section gains a subsection documenting the consent gate (architecture-level change per CLAUDE.md's update rule).
- **D2 decided 2026-08-04 (Jarmo): grandfather.** Wire this directly into the consent module's initial-state logic: `getConsentState()` defaults to `'granted'` for a workspace where `DaemonResultStore` already has run history, `'undecided'` otherwise. No longer a pending call — this is now the specified default.

### Tests

- Unit tests for the consent-state module (`granted`/`declined`/`undecided` transitions, default-state logic per D2).
- Unit test (or targeted integration test) asserting `Scheduler.scanWorkspace()` parses but does not `register()` entries when consent is not granted.
- Manual QA: scenarios.md's R2 scenarios, walked on `/rundev` before handoff.

## Workstream 3: Sticky-tab healer (R3)

### Extension host — `extension.ts` `activate()`

Follows the existing one-shot-migration pattern already in this function (the Sprint 52 theme migration uses a `context.globalState` marker + `setTimeout`) rather than introducing a new pattern:

```typescript
const stickyTabHealerVersion = 'sprint-107-v1';
const lastStickyTabHealerVersion = context.globalState.get<string>('ritemark.stickyTabHealerVersion');
if (lastStickyTabHealerVersion !== stickyTabHealerVersion) {
  setTimeout(async () => {
    const candidates = findStuckMarkdownTabs(vscode.window.tabGroups.all);
    for (const candidate of candidates) {
      await vscode.commands.executeCommand('vscode.openWith', candidate.uri, 'ritemark.editor', {
        preview: false,
        preserveFocus: !candidate.isActive,
        viewColumn: candidate.viewColumn,
      });
    }
    context.globalState.update('ritemark.stickyTabHealerVersion', stickyTabHealerVersion);
  }, /* after editor-group restore settles */ 1500);
}
```

### New small module — `extensions/ritemark/src/utils/stickyTabHealer.ts`

Pure, unit-testable candidate-selection logic, separated from the `vscode.commands.executeCommand` orchestration so it can be tested without mocking the full VS Code tab API surface:

```typescript
export interface StuckTabCandidate {
  uri: vscode.Uri;
  isActive: boolean;
  isPinned: boolean;
  viewColumn: vscode.ViewColumn;
}

export function findStuckMarkdownTabs(tabGroups: readonly vscode.TabGroup[]): StuckTabCandidate[] {
  // filter: tab.input instanceof vscode.TabInputText, uri.scheme === 'file',
  // /\.(md|markdown)$/i.test(uri.path); map to StuckTabCandidate.
}
```

### Tests

- `stickyTabHealer.test.ts`: candidate selection against a fabricated `TabGroup[]` fixture — matches `.md`/`.markdown` text tabs only, ignores diff editors, untitled buffers, non-text inputs, and non-markdown extensions.
- Manual QA: scenarios.md's R3 upgrade-path scenario, exercised against a profile pre-seeded with a stuck tab (pre-sprint build or a manually-forced text-editor tab).

## Workstream 4: Remove the ready-welcome branch (R4)

### Webview — `webview/src/components/ai-sidebar/AISidebar.tsx`

Change the ternary at (current) lines 157-178 so the `showWelcome`-only case no longer routes to `<SetupWizard />`:

```typescript
{ready && onboardingStatus && !onboardingStatus.anyAgentReady && !onboardingDismissed ? (
  <OnboardingWizard />
) : ready && needsSetup ? (              // was: ready && (needsSetup || showWelcome)
  <>
    <SelectionIndicator />
    <SetupWizard />
  </>
) : ready && showCodexSetup ? (
  /* unchanged */
) : ready && showOpenCodeSetup ? (
  /* unchanged */
) : (
  /* normal chat surface, unchanged */
)}
```

### Webview — `webview/src/components/ai-sidebar/store.ts`

`showWelcome`'s derivation (currently `AISidebar.tsx:125-126`) becomes dead as a render-gating condition once the ternary above stops reading it, but the bookkeeping it used to trigger on click must still fire automatically. Add a side effect (e.g. inside the same selector/computation, or a small `useEffect` in `AISidebar.tsx`) that calls the existing `dismissWelcome()` once, the first time `isClaudeCode && setupStatus?.state === 'ready' && !hasSeenWelcome && !hasAnyRuntimeConversation` becomes true — i.e., fire the exact same store action and host message that "Get Started" used to fire, just automatically instead of on click. This keeps `hasSeenWelcome`/`ritemark.ai.hasSeenClaudeWelcome` consistent for any other code that may read them, without requiring an audit of every future reader to prove safety.

`SetupWizard.tsx`'s `isReady` branch (the "Claude is ready" / "Get Started" / "Technical details" markup, lines ~44-45, 156-161) becomes unreachable once `AISidebar.tsx` stops passing that case in — it can be deleted from `SetupWizard.tsx` in the same change (the `isReady` branch there is otherwise dead code once its only caller-side condition is removed), or left as inert dead code if a future requirement resurrects a ready-state message. Recommendation: delete it — CLAUDE.md's feature-preservation rule is explicitly waived for this exact card by Jarmo's order, and leaving dead branches around invites confusion later about whether the card still shows under some path.

### Tests

- Existing webview component tests for `AISidebar`/`SetupWizard`, if any assert on the `showWelcome`-only rendering path, are updated to assert the new behavior (ready + no conversation → composer, not a card).
- Manual QA: scenarios.md's R4 scenarios (ready state, and all three negative/unaffected states) walked on `/rundev`.

## Order of implementation

W0 (spike, confirms R1 mechanism live) → W1 (patch 013) → W3 (healer — independent of W1/W2, can proceed in parallel) → W4 (welcome-card removal — independent, can proceed in parallel) → W2 (daemon consent, Option A — D1/D2 are decided, so W2 can be built directly against Option A without a design gate). This describes ORDER once execution starts; it does not override the sprint-wide Execution Hold in sprint-plan.md — no workstream begins until the v1.8.6 sprint queue reaches Sprint 107. W1 should still land and be spike-verified before W2 begins in earnest, since R2's spec explicitly depends on R1 shipping trust-off as a real default first (R2's acceptance criteria assume `security.workspace.trust.enabled: false` is already effective). Commits per workstream, requirement IDs in messages (e.g. `fix(sprint-107): R1 wire product.json configurationDefaults into desktop bootstrap`).

## Documentation updates required

- `docs/development/architecture.md` — new subsection under Scheduled Tasks (Daemon) documenting the R2 consent gate; a short note near the workbench/patch overview if one exists for the R1 mechanism (patch 013 is a bootstrap-level change worth a one-paragraph mention given how central `DefaultConfiguration` is).
- `docs/user/troubleshooting.md` — the "opens as code" / trust-modal complaint this sprint fixes is exactly the kind of thing worth a before/after mention if that doc already discusses first-open behavior (check current content before adding).
- `docs/CHANGELOG.md` + `docs/releases/v1.8.6/release-notes.md` — user-visible fix, needs an entry.
