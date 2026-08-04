# Audit: wiring `product.json` `configurationDefaults` into desktop (R1)

**Status:** Static code-reading audit completed 2026-08-04, pre-approval, pre-branch (read-only research — Sprint 103 precedent for "Phase 0 spikes are read-only research permitted pre-branch"). A live CDP/dev-mode spike is still listed as a Phase 0 task in `tasks.md` and must run before R1 is marked done — this document is the evidence base for that spike, not a substitute for it.

**Why this needed an audit before implementation:** R1 patches a VS Code core bootstrap path (`patches/vscode/`) that runs on every startup, before almost everything else. Getting the injection point or the initialization ordering wrong risks a much worse failure mode than the bug it fixes (e.g., default overrides that never apply, or that apply too late and race the editor resolver / workspace trust computation). Per the `spec-driven-sprint` skill's audit-first rule, this was worth verifying by reading the actual source before writing a spec that assumes the mechanism works.

## What was inspected

All paths are relative to the repo root as of 2026-08-04, `sprint-103-agent-truth` branch (pre-sprint-107 baseline).

1. `branding/product.json` — confirmed the `configurationDefaults` block exists exactly as the analysis doc describes (lines 187–205): theme/layout keys, `security.workspace.trust.enabled: false`, and `workbench.editorAssociations` for `*.md`, `*.markdown`, `*.csv`, `*.xlsx`, `*.xls`, `*.pdf`, `*.docx`, `*.flow.json`.

2. `vscode/src/vs/workbench/services/configuration/browser/configuration.ts` (lines 32–90) — the `DefaultConfiguration` class used by the web workbench. Its constructor:

   ```ts
   constructor(
     cacheScope: string,
     private readonly configurationCache: IConfigurationCache,
     environmentService: IBrowserWorkbenchEnvironmentService,
     logService: ILogService,
   ) {
     super(logService);
     this.cacheKey = { type: 'defaults', key: `${cacheScope}-configurationDefaultsOverrides` };
     if (environmentService.options?.configurationDefaults) {
       this.configurationRegistry.registerDefaultConfigurations([{ overrides: environmentService.options.configurationDefaults as IStringDictionary<IStringDictionary<unknown>> }]);
     }
   }
   ```

   This is the exact mechanism the analysis doc cites. The registration call is synchronous, inside the constructor — it runs before `initialize()`/`reload()` (both `async`) are ever awaited by any caller, because a JS constructor always finishes before the object it returns can be used.

3. **Where this class is instantiated — the key finding that refines the analysis doc.** Only one call site constructs this specific `DefaultConfiguration` subclass:

   ```
   vscode/src/vs/workbench/services/configuration/browser/configurationService.ts:129
   this.defaultConfiguration = this._register(new DefaultConfiguration(userDataProfileService.currentProfile.id, configurationCache, environmentService, logService));
   ```

   `services/configuration/browser/` is **not** web-only — it is the shared workbench-layer configuration service. There is no `services/configuration/electron-sandbox/` override (confirmed: the glob for that path returned nothing). **This same class already runs on desktop today.** The analysis doc's framing ("desktop's environment service has no `options`") is correct in effect but the more precise mechanism is:

   - `IBrowserWorkbenchEnvironmentService` declares `readonly options?: IWorkbenchConstructionOptions` (optional).
   - Desktop's concrete environment service is `NativeWorkbenchEnvironmentService` (`services/environment/electron-browser/environmentService.ts:59`), which `implements INativeWorkbenchEnvironmentService extends IBrowserWorkbenchEnvironmentService` — but **never defines an `options` getter anywhere in the class**. Because the interface field is optional, this type-checks fine.
   - At runtime, `environmentService.options` on a live `NativeWorkbenchEnvironmentService` instance is simply `undefined` — no code path ever assigns it. So `environmentService.options?.configurationDefaults` evaluates to `undefined` on desktop, and the `if` guard never fires. It is not that desktop skips this class; desktop runs the identical class and the identical constructor, but the one signal it checks is structurally always absent.

   **Implication for the patch:** the fix does not need a new registration call site — it needs the *existing* constructor (or the class immediately around it) to also consult a signal that IS present on desktop: `productService.configurationDefaults`.

4. **`IProductConfiguration` does not declare `configurationDefaults` today.** Grepped `vscode/src/vs/base/common/product.ts` (where `IProductConfiguration` is defined, starting line 67, all fields `readonly ... ?:` style) and `vscode/src/vs/platform/product/common/productService.ts` (`IProductService extends Readonly<IProductConfiguration>`) — zero matches for `configurationDefaults` in either file. `branding/product.json` already ships the key as loose JSON (nothing validates/rejects unknown top-level keys at build time, which is why it's been silently inert rather than silently erroring), but `productService.configurationDefaults` will not compile in patched TypeScript until the interface gains the field. **This is a required, not optional, part of the patch's diff.**

5. **Ordering concern the sprint explicitly asked to verify: does the registration land before editor resolution and trust computation read config?**

   - `EditorResolverService.resolveEditor()` (`services/editor/browser/editorResolverService.ts:97`) calls `resourceMatchesCache()` and `resourceMatchesUserAssociation()` (line 128) to decide whether to await `extensionService.whenInstalledExtensionsRegistered()`. `resourceMatchesUserAssociation()` (line 834) calls `getAllUserAssociations()` (line 274), which calls `this.configurationService.inspect(editorsAssociationsSettingId)` and explicitly merges in `inspectedEditorAssociations.defaultValue` (line 276, merged at line 281) alongside `workspaceValue`/`userValue`. **This was the one genuinely open question**: does the upstream #244597 hatch key off DEFAULT-scope config, or only explicit user-set config? Confirmed by reading: it reads default-scope too. A product-sourced default is therefore sufficient to make `resourceMatchesUserAssociation()` return `true` for `.md` — the resolver will wait for extension registration even on a stone-cold profile with an empty `editorOverrideService.cache`.
   - `EditorResolverService` is constructed and used during workbench layout / editor-group restore, which happens well after the configuration service's own construction and `initialize()` resolution in the standard VS Code startup sequence (services init → `Ready`/`Restored` lifecycle phases). Since `DefaultConfiguration`'s registration is synchronous inside its constructor (step 2 above), and the configuration service's constructor runs before its own `initialize()` can be awaited, the override is present in the configuration registry (`Registry.as<IConfigurationRegistry>(Extensions.Configuration)`) long before any editor-group restore logic executes.
   - `WorkspaceTrustManagementService.calculateWorkspaceTrust()` (`services/workspaces/common/workspaceTrust.ts:294–327`) reads `this.workspaceTrustEnablementService.isWorkspaceTrustEnabled()` (backed by `security.workspace.trust.enabled`) and, for the empty/loose-file-window path, `this.configurationService.getValue(WORKSPACE_TRUST_EMPTY_WINDOW)` (line 323) — both live `getValue`/config reads, same registry-backed mechanism, same ordering argument applies.
   - Residual risk kept explicit rather than hand-waved: `BaseDefaultConfiguration` (`platform/configuration/common/configurations.ts`) is the shared engine that turns registered default-config contributions into the actual `ConfigurationModel` snapshot backing `inspect()`/`getValue()`. This audit did not trace that class's internals line-by-line to confirm the merge-and-notify path fires synchronously with registration vs. on a subsequent microtask/event tick. This is precisely what the Phase 0 live spike (tasks.md) must confirm empirically rather than the audit asserting it from inspection alone.

6. **Confirmed, not assumed: workspace trust does not block the custom editor.** `extensions/ritemark/package.json` declares `capabilities.untrustedWorkspaces.supported: true` (line 13). No code in `extensions/ritemark/src` calls `vscode.workspace.isTrusted` at all (repo-wide grep, zero matches). This means R1/R2 do not need to touch anything related to the custom editor's own trust gating — there isn't any.

7. **Terminal auto-create mechanism (mechanism 3, trust-modal-on-every-launch) confirmed at the code level**, for scoping only — R1/R2 do not patch this directly; disabling trust (R2) removes the modal regardless of whether the terminal still auto-creates:
   - `patches/vscode/002-ritemark-ui-layout.patch` moves the terminal `ViewContainer` to `ViewContainerLocation.AuxiliaryBar` with `hideIfEmpty: false` (kept visible even with zero terminal instances) and `isDefault: false` (AI panel is the aux-bar default).
   - `terminalView.ts:321–327` — `override focus()` calls `this._terminalService.createTerminal(...)` whenever `this._terminalGroupService.instances.length === 0`. This audit did not trace the exact startup call chain that invokes `focus()` on a fresh profile (out of scope for R1/R2 — the trust modal disappears once `security.workspace.trust.enabled` is actually `false`, regardless of whether a terminal still gets created; a false/true terminal-auto-create is not itself a new problem this sprint introduces or needs to solve).

## Decision

**Ship.** No blocker was found. The mechanism reads correctly end-to-end from `branding/product.json` through to `EditorResolverService`'s cold-cache hatch and `WorkspaceTrustManagementService`'s config reads. The patch's minimum viable diff is:

1. `vscode/src/vs/base/common/product.ts` — add `readonly configurationDefaults?: IStringDictionary<unknown>;` (or equivalent) to `IProductConfiguration`.
2. `vscode/src/vs/workbench/services/configuration/browser/configuration.ts` — extend `DefaultConfiguration`'s constructor to also register `productService.configurationDefaults` (in addition to, not instead of, the existing `environmentService.options?.configurationDefaults` check — preserves the web mechanism unmodified, additive for desktop). Requires injecting `IProductService` into this class and confirming it's available for injection at the one call site (`configurationService.ts:129`).

## Blockers / carry-forward if this had been deferred

None — recorded per the audit template's required section even though the decision is Ship, for symmetry with future audits that may defer.

## Phase 0 live-spike checklist (to run under the sprint branch, before Phase 1 code)

- [ ] Build with the draft patch applied; launch with a fresh `--user-data-dir` and a loose `.md` file argument (the exact repro from the analysis doc).
- [ ] Confirm first launch opens directly in `ritemark.editor` — no flash of the text editor.
- [ ] Confirm no trust modal, no Restricted Mode badge.
- [ ] Confirm `.csv`/`.pdf`/`.docx`/`.xlsx`/`.flow.json` startup-file opens resolve to their respective viewers on first launch too.
- [ ] Confirm a deliberate `Reopen With -> Text Editor` still works (per-instance override still reachable — R1 must not make the text editor unreachable, only change the *default*).
- [ ] Repeat on the Windows shell build (win32-x64) — same product.json, same patch, must hold there too.
