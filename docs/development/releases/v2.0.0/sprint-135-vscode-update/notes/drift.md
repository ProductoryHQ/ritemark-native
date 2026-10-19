# Drift at planning time

Measured on 2026-10-18 for this plan, on `origin/main` `d781a0e1` (Sprint 132 merge 1, patches 001–019), against VS Code 1.142.0 (commit `d956e8a6ac5d904486557eea07e1d6bd62a4d36f`, released 14 October; still the newest stable release on 18 October). Phase 0 measures again at the frozen target, on main after Step 3, and adds the result below.

## By file: `./scripts/check-vscode-drift.sh 1.142.0`

A temporary index; each failing file excluded and the patch retried, so every conflicting file is listed. A file counts as failing when any hunk in it fails, and a stacked patch fails when its base patch's file was excluded (016 and 017 below).

```
FAIL  001-ritemark-branding.patch (7)
        build/gulpfile.vscode.ts
        build/lib/optimize.ts
        build/next/index.ts
        src/vs/platform/dialogs/electron-browser/dialog.ts
        src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.contribution.ts
        src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts
        src/vs/workbench/contrib/welcomeGettingStarted/browser/media/gettingStarted.css
FAIL  002-ritemark-ui-layout.patch (12)
        src/vs/workbench/browser/actions/layoutActions.ts
        src/vs/workbench/browser/part.ts
        src/vs/workbench/browser/parts/activitybar/activitybarPart.ts
        src/vs/workbench/browser/parts/auxiliarybar/auxiliaryBarActions.ts
        src/vs/workbench/browser/parts/auxiliarybar/auxiliaryBarPart.ts
        src/vs/workbench/browser/parts/globalCompositeBar.ts
        src/vs/workbench/browser/parts/paneCompositePart.ts
        src/vs/workbench/browser/parts/panel/panelActions.ts
        src/vs/workbench/browser/parts/titlebar/media/titlebarpart.css
        src/vs/workbench/browser/parts/titlebar/titlebarPart.ts
        src/vs/workbench/browser/workbench.contribution.ts
        src/vs/workbench/contrib/terminal/browser/terminal.contribution.ts
FAIL  003-ritemark-menu-cleanup.patch (8)
        src/vs/workbench/browser/parts/editor/editor.contribution.ts
        src/vs/workbench/browser/parts/titlebar/menubarControl.ts
        src/vs/workbench/contrib/chat/browser/agentSessions/experiments/agentSessionsExperiments.contribution.ts
        src/vs/workbench/contrib/chat/browser/chatStatus/chatStatusEntry.ts
        src/vs/workbench/services/extensionManagement/browser/extensionEnablementService.ts
        src/vs/workbench/contrib/files/browser/fileActions.contribution.ts
        src/vs/workbench/browser/actions/workspaceActions.ts
        src/vs/workbench/contrib/userDataProfile/browser/userDataProfile.ts
FAIL  004-ritemark-build-system.patch (1)
        src/vs/code/electron-main/app.ts
FAIL  005-ritemark-windows-and-oss-fixes.patch (2)
        build/lib/electron.ts
        src/vs/workbench/services/accounts/browser/defaultAccount.ts
OK    006-ritemark-dev-launch-fallback.patch
FAIL  007-ritemark-vscode-1117-compat.patch (3)
        src/vs/workbench/contrib/chat/browser/chat.contribution.ts
        src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupContributions.ts
        src/vs/workbench/contrib/welcomeOnboarding/browser/onboardingVariationA.ts
FAIL  008-ritemark-windows-binary-strip.patch (1)
        build/.moduleignore
FAIL  009-ritemark-browser-context-bridge.patch (2)
        src/vs/workbench/contrib/browserView/common/browserView.ts
        src/vs/workbench/contrib/browserView/electron-browser/browserView.contribution.ts
FAIL  010-ritemark-browser-action-bridge.patch (2)
        src/vs/workbench/contrib/browserView/common/browserView.ts
        src/vs/workbench/contrib/browserView/electron-browser/browserView.contribution.ts
OK    011-ritemark-cloud-file-error.patch
OK    012-ritemark-shell-watchdog.patch
FAIL  013-ritemark-configuration-defaults.patch (1)
        src/vs/base/common/product.ts
OK    014-ritemark-save-receipts.patch
FAIL  015-ritemark-help-menu-policy.patch (2)
        src/vs/workbench/browser/parts/titlebar/menubarControl.ts
        src/vs/workbench/test/browser/parts/titlebar/menubarControl.test.ts
FAIL  016-ritemark-store-acquisition-policy.patch (1)
        src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts
FAIL  017-ritemark-launch-check-node.patch (1)
        src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts
FAIL  018-ritemark-surfaces.patch (12)
        src/vs/platform/theme/browser/defaultStyles.ts
        src/vs/platform/window/common/window.ts
        src/vs/platform/windows/electron-main/windowImpl.ts
        src/vs/workbench/browser/parts/auxiliarybar/auxiliaryBarPart.ts
        src/vs/workbench/browser/parts/editor/editorPart.ts
        src/vs/workbench/browser/parts/sidebar/sidebarPart.ts
        src/vs/workbench/browser/parts/statusbar/statusbarPart.ts
        src/vs/workbench/browser/parts/titlebar/titlebarPart.ts
        src/vs/workbench/contrib/webview/browser/overlayWebview.ts
        src/vs/workbench/electron-browser/parts/titlebar/titlebarPart.ts
        src/vs/workbench/services/actions/common/menusExtensionPoint.ts
        src/vs/workbench/services/layout/browser/layoutService.ts
FAIL  019-ritemark-tab-row.patch (3)
        src/vs/workbench/browser/parts/editor/editorGroupView.ts
        src/vs/workbench/browser/parts/editor/editorTabsControl.ts
        src/vs/workbench/browser/parts/editor/multiEditorTabsControl.ts

VS Code 1.142.0: 15 of 19 patches fail in 58 file patches
```

## By hunk

Each patch applied in order with `git apply --reject --whitespace=nowarn` to a sparse checkout of 1.142.0 (only the files the patches touch). Hunks that apply stay applied, so each later patch sees its base, as it will during the rebase.

| Patch | Files | Hunks | Rejected hunks |
|---|---|---|---|
| 001 | 15 | 32 | 10 |
| 002 | 25 | 83 | 22 |
| 003 | 21 | 39 | 12 |
| 004 | 4 | 7 | 1 |
| 005 | 3 | 5 | 2 |
| 006 | 4 | 4 | 0 |
| 007 | 4 | 13 | 7 |
| 008 | 1 | 1 | 1 |
| 009 | 4 | 8 | 6 |
| 010 | 4 | 12 | 9 |
| 011 | 1 | 1 | 0 |
| 012 | 1 | 5 | 0 |
| 013 | 2 | 3 | 1 |
| 014 | 7 | 16 | 0 |
| 015 | 6 | 14 | 2 |
| 016 | 1 | 2 | 0 |
| 017 | 1 | 3 | 0 |
| 018 | 29 | 61 | 17 |
| 019 | 13 | 38 | 8 |
| **Total** | | **347** | **98** |

- 016 and 017 reject nothing here: they fail in the file check only because 001's `gettingStarted.ts` was excluded there. With 001's applicable hunks in place they apply as they are.
- One patched file no longer exists upstream: `build/lib/optimize.ts` (001's `.woff2` loader). 1.142.0 bundles the core with esbuild (`build/lib/esbuild.ts`) and type-checks with `tsgo` in `core-ci`.

## Toolchain at the two versions

| | 1.117.0 (pin, `10c8e557`) | 1.142.0 |
|---|---|---|
| `.nvmrc` | 22.22.1 | 24.18.0 |
| `.npmrc` Electron target | 39.8.7 | 43.7.7 |
| `remote/.npmrc` Node target | 22.22.1 | 24.21.0 |
| `build/npm/preinstall.ts` | VS 2022 / 2019 folders | VS 2026 (folder `18`), 2022, 2019; `vs2026_install` |
| Built-in extensions added | | `mermaid-markdown-features`, `theme-modern-icons` |
| Built-in extensions removed | | `mermaid-chat-features` |

## At the freeze (Phase 0)

Measured on 2026-10-19 on `origin/main` `3c8a7c30` (Steps 1–3 merged: patches 001–016, 018, 019; 017 retired in Sprint 133), against the frozen target 1.142.0 (`d956e8a6`).

### By file: `./scripts/check-vscode-drift.sh 1.142.0`

```
FAIL  001-ritemark-branding.patch (4)
        build/gulpfile.vscode.ts
        build/lib/optimize.ts
        build/next/index.ts
        src/vs/platform/dialogs/electron-browser/dialog.ts
FAIL  002-ritemark-ui-layout.patch (12)
        src/vs/workbench/browser/actions/layoutActions.ts
        src/vs/workbench/browser/part.ts
        src/vs/workbench/browser/parts/activitybar/activitybarPart.ts
        src/vs/workbench/browser/parts/auxiliarybar/auxiliaryBarActions.ts
        src/vs/workbench/browser/parts/auxiliarybar/auxiliaryBarPart.ts
        src/vs/workbench/browser/parts/globalCompositeBar.ts
        src/vs/workbench/browser/parts/paneCompositePart.ts
        src/vs/workbench/browser/parts/panel/panelActions.ts
        src/vs/workbench/browser/parts/titlebar/media/titlebarpart.css
        src/vs/workbench/browser/parts/titlebar/titlebarPart.ts
        src/vs/workbench/browser/workbench.contribution.ts
        src/vs/workbench/contrib/terminal/browser/terminal.contribution.ts
FAIL  003-ritemark-menu-cleanup.patch (8)
        src/vs/workbench/browser/parts/editor/editor.contribution.ts
        src/vs/workbench/browser/parts/titlebar/menubarControl.ts
        src/vs/workbench/contrib/chat/browser/agentSessions/experiments/agentSessionsExperiments.contribution.ts
        src/vs/workbench/contrib/chat/browser/chatStatus/chatStatusEntry.ts
        src/vs/workbench/services/extensionManagement/browser/extensionEnablementService.ts
        src/vs/workbench/contrib/files/browser/fileActions.contribution.ts
        src/vs/workbench/browser/actions/workspaceActions.ts
        src/vs/workbench/contrib/userDataProfile/browser/userDataProfile.ts
FAIL  004-ritemark-build-system.patch (1)
        src/vs/code/electron-main/app.ts
FAIL  005-ritemark-windows-and-oss-fixes.patch (2)
        build/lib/electron.ts
        src/vs/workbench/services/accounts/browser/defaultAccount.ts
OK    006-ritemark-dev-launch-fallback.patch
FAIL  007-ritemark-vscode-1117-compat.patch (3)
        src/vs/workbench/contrib/chat/browser/chat.contribution.ts
        src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupContributions.ts
        src/vs/workbench/contrib/welcomeOnboarding/browser/onboardingVariationA.ts
FAIL  008-ritemark-windows-binary-strip.patch (1)
        build/.moduleignore
FAIL  009-ritemark-browser-context-bridge.patch (2)
        src/vs/workbench/contrib/browserView/common/browserView.ts
        src/vs/workbench/contrib/browserView/electron-browser/browserView.contribution.ts
FAIL  010-ritemark-browser-action-bridge.patch (2)
        src/vs/workbench/contrib/browserView/common/browserView.ts
        src/vs/workbench/contrib/browserView/electron-browser/browserView.contribution.ts
OK    011-ritemark-cloud-file-error.patch
OK    012-ritemark-shell-watchdog.patch
FAIL  013-ritemark-configuration-defaults.patch (1)
        src/vs/base/common/product.ts
OK    014-ritemark-save-receipts.patch
FAIL  015-ritemark-help-menu-policy.patch (2)
        src/vs/workbench/browser/parts/titlebar/menubarControl.ts
        src/vs/workbench/test/browser/parts/titlebar/menubarControl.test.ts
OK    016-ritemark-store-acquisition-policy.patch
FAIL  018-ritemark-surfaces.patch (17)
        src/vs/base/browser/ui/dialog/dialog.ts
        src/vs/platform/theme/browser/defaultStyles.ts
        src/vs/platform/window/common/window.ts
        src/vs/platform/windows/electron-main/windowImpl.ts
        src/vs/workbench/browser/parts/auxiliarybar/auxiliaryBarPart.ts
        src/vs/workbench/browser/parts/dialogs/dialogHandler.ts
        src/vs/workbench/browser/parts/editor/editorPart.ts
        src/vs/workbench/browser/parts/notifications/notificationsViewer.ts
        src/vs/workbench/browser/parts/sidebar/sidebarPart.ts
        src/vs/workbench/browser/parts/statusbar/statusbarPart.ts
        src/vs/workbench/browser/parts/titlebar/titlebarPart.ts
        src/vs/workbench/contrib/splash/browser/partsSplash.ts
        src/vs/workbench/contrib/webview/browser/overlayWebview.ts
        src/vs/workbench/electron-browser/desktop.contribution.ts
        src/vs/workbench/electron-browser/parts/titlebar/titlebarPart.ts
        src/vs/workbench/services/actions/common/menusExtensionPoint.ts
        src/vs/workbench/services/layout/browser/layoutService.ts
FAIL  019-ritemark-tab-row.patch (4)
        src/vs/workbench/browser/parts/editor/editorGroupView.ts
        src/vs/workbench/browser/parts/editor/editorGroupWatermark.ts
        src/vs/workbench/browser/parts/editor/editorTabsControl.ts
        src/vs/workbench/browser/parts/editor/multiEditorTabsControl.ts

VS Code 1.142.0: 13 of 18 patches fail in 59 file patches
```

### By hunk

As at planning time: each patch applied in order with `git apply --reject --whitespace=nowarn` to the drift script's sparse checkout of 1.142.0; hunks that apply stay applied. The 2 hunks for `build/lib/optimize.ts`, which is gone upstream, count as rejected.

| Patch | Files | Hunks | Rejected hunks | Failing files |
|---|---|---|---|---|
| 001 | 12 | 21 | 6 | 4 |
| 002 | 25 | 83 | 22 | 12 |
| 003 | 23 | 44 | 12 | 8 |
| 004 | 4 | 7 | 1 | 1 |
| 005 | 3 | 5 | 2 | 2 |
| 006 | 4 | 4 | 0 | 0 |
| 007 | 4 | 13 | 7 | 3 |
| 008 | 1 | 1 | 1 | 1 |
| 009 | 4 | 9 | 7 | 2 |
| 010 | 4 | 12 | 9 | 2 |
| 011 | 1 | 1 | 0 | 0 |
| 012 | 1 | 5 | 0 | 0 |
| 013 | 2 | 3 | 1 | 1 |
| 014 | 7 | 16 | 0 | 0 |
| 015 | 6 | 16 | 2 | 2 |
| 016 | 1 | 1 | 0 | 0 |
| 018 | 52 | 106 | 24 | 17 |
| 019 | 19 | 53 | 10 | 4 |
| **Total** | | **400** | **104** | **59** |

### What changed since planning

- **001 and 016:** Sprint 133 retired the Getting Started hunks and patch 017, so 001 fails only in its build files and the dialog, and 016 applies.
- **018** grew from 29 to 52 files with Steps 2 and 3, and fails in 17. New since planning: `base/browser/ui/dialog/dialog.ts`, `parts/dialogs/dialogHandler.ts`, `notificationsViewer.ts`, `splash/browser/partsSplash.ts`, `electron-browser/desktop.contribution.ts`.
- **019** grew from 13 to 19 files, and fails in 4. New: `editorGroupWatermark.ts` (the empty desk's tiles).
- **003** grew from 21 to 23 files (the palette filter, Sprint 134); it still fails in the same 8.

Upstream's change to every patched file is in [upstream-diff.md](upstream-diff.md): 101 of the 163 files changed, one is gone (`build/lib/optimize.ts`), 37 are unchanged and 24 are created by the patches.
