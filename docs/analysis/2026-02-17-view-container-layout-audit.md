# View Container Layout Audit

**Date:** 2026-02-17  
**Issue:** `Ritemark AI` container renders in the left sidebar instead of the right auxiliary bar  
**Status:** Root cause confirmed in code, core fix present in source, runtime verification still required after rebuild

* * *

## Executive Summary

The manifest is correct (`auxiliarybar`), but persisted view customizations can override default placement.  
The effective fix is to remove the cached location override for the fully-prefixed container ID during `ViewDescriptorService` initialization:

```ts
this.viewContainersCustomLocations.delete('workbench.view.extension.ritemark-ai');
```

This must happen in core startup code, not extension activation code.

* * *

## Evidence Trail (Manifest -> Runtime Placement)

### 1\. Extension declares the container in auxiliary bar

**File:** `extensions/ritemark/package.json:184`  
`ritemark-ai` is declared under `contributes.viewsContainers.auxiliarybar`, and `ritemark.unifiedView` is contributed under `views.ritemark-ai`.

Verdict: Declaration is correct.

### 2\. Core maps `auxiliarybar` to `ViewContainerLocation.AuxiliaryBar`

**File:** `vscode/src/vs/workbench/api/browser/viewsExtensionPoint.ts:315`  
`addCustomViewContainers()` now includes:

```ts
case 'auxiliarybar':
  this.registerCustomViewContainers(value, description, 1, existingViewContainers, ViewContainerLocation.AuxiliaryBar);
```

Verdict: Contribution point handling exists in TS source.

### 3\. Extension container IDs are prefixed before registration

**File:** `vscode/src/vs/workbench/api/browser/viewsExtensionPoint.ts:375`

```ts
const id = `workbench.view.extension.${descriptor.id}`;
```

Therefore `ritemark-ai` becomes `workbench.view.extension.ritemark-ai`.

Verdict: This prefix is critical for any storage lookup/delete logic.

### 4\. Persisted customizations override default location

**File:** `vscode/src/vs/workbench/services/views/browser/viewDescriptorService.ts:92`  
On startup, `viewContainersCustomLocations` is populated from persisted customizations (`views.customizations`).

If persisted data contains:

```json
{ "workbench.view.extension.ritemark-ai": 0 }
```

then location `0` (`Sidebar`) wins over the manifest default.

Verdict: Behavior explains why package.json alone is not enough.

### 5\. Effective fix is now in constructor

**File:** `vscode/src/vs/workbench/services/views/browser/viewDescriptorService.ts:99`

```ts
this.viewContainersCustomLocations.delete('workbench.view.extension.ritemark-ai');
```

This clears stale customization before normal container registration and layout usage.

Verdict: Correct location key and correct timing.

* * *

## Root Causes

1.  Wrong key in earlier cleanup attempts  
    Previous delete used raw ID (`ritemark-ai`) instead of prefixed ID (`workbench.view.extension.ritemark-ai`).
    
2.  Fix applied too late when done in extension activation  
    Extension-level commands run after workbench initialization; layout may already be materialized.
    
3.  Historical missing `auxiliarybar` switch support  
    Without the switch branch, auxiliary-bar container contributions are not registered as intended.
    

* * *

## Additional Findings

### TS/JS divergence exists in `viewsExtensionPoint`

Current `out` JS has additional changes not mirrored in TS source:

1.  `auxiliarybar` JSON schema entry exists in `vscode/out/vs/workbench/api/browser/viewsExtensionPoint.js:72`, but not in TS (`viewsContainersContribution`).
    
2.  JS uses dynamic `auxiliaryBarOrder`, TS currently hardcodes `1`.
    
3.  JS captures and reuses auxiliary order return value; TS branch does not.
    

Impact: Not the primary cause of left-vs-right placement, but this should be synced to keep build outputs deterministic.

### Constructor delete protects startup path, not all live-storage updates

Storage change handling can repopulate custom locations during runtime in edge flows (multi-window/profile sync).  
For current desktop single-window use this is low risk, but worth noting.

* * *

## What Was Changed

1.  `vscode/src/vs/workbench/services/views/browser/viewDescriptorService.ts`  
    Added startup cleanup for `workbench.view.extension.ritemark-ai`.
    
2.  `vscode/src/vs/workbench/api/browser/viewsExtensionPoint.ts`  
    Added `case 'auxiliarybar'` and auxiliary-bar-friendly visibility behavior.
    
3.  `extensions/ritemark/src/extension.ts`  
    Removed ineffective extension-side location reset logic (core now enforces placement).
    
4.  `patches/vscode/002-ritemark-ui-layout.patch`  
    Consolidates and carries the relevant core changes.
    

* * *

## Verification Checklist

1.  Build and launch patched product.
    
2.  Open a clean profile and confirm `Ritemark AI` starts in the right auxiliary bar.
    
3.  Move `Ritemark AI` to left sidebar, restart, confirm it returns to right.
    
4.  Confirm no regression for `ritemark-flows` activity bar container.
    
5.  Rebuild from TS source and verify behavior still matches (detect TS/JS drift issues early).
    

* * *

## Edge Case Matrix (User Settings and Runtime State)

| Edge case | Current coverage | Risk | Recommended validation |
| --- | --- | --- | --- |
| User previously moved `Ritemark AI` to left sidebar (same profile) | Covered by constructor `delete(...)` | Low | Move left -> restart -> verify it returns right |
| Multiple VS Code profiles | Partially covered (per-profile startup only) | Medium | Test at least 2 profiles, both with different previous positions |
| Settings Sync re-applies old `views.customizations` after startup | Partially covered (startup only) | Medium | Enable sync, trigger incoming settings change, confirm panel stays right |
| Runtime manual move during session | Expected (user action allowed), enforced on next startup | Low | Move during session, restart, verify startup correction |
| `workbench.sideBar.location` left/right setting changes | Not explicitly audited | Low | Toggle left/right primary sidebar location and verify AI stays in auxiliary bar |
| `workbench.layoutControl.*` visibility/toggle settings | Not explicitly audited | Low | Test with `menu`, `toggles`, `both` to ensure no placement regression |
| Corrupt or partial `views.customizations` payload | Not audited | Medium | Inject invalid JSON / partial keys and verify safe fallback behavior |
| Multi-window same profile | Partially covered | Medium | Open two windows, move in one, restart both, verify consistent correction |
| Remote/WSL/Codespaces window | Not audited | Medium | If supported, run same placement checks in remote window type |

Notes:

-   The current fix guarantees startup correction for the known key in the active profile.
    
-   It does not currently enforce "always right" at runtime after every storage mutation event.
    

* * *

## Lessons

1.  Track runtime IDs, not manifest IDs, when touching persisted workbench state.
    
2.  For startup layout guarantees, enforce behavior in core initialization paths.
    
3.  Treat package.json view location as a default, not an absolute placement rule.
    
4.  Keep TS and generated JS in sync to avoid “works now, breaks on rebuild” regressions.