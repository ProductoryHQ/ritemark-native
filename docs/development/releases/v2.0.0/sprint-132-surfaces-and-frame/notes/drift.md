# Drift: the patch stack on the newest VS Code

E6 asks for the whole stack to be dry-applied on the newest VS Code release at each merge, so the VS Code update sprint starts from known numbers. Measured with `./scripts/check-vscode-drift.sh <tag>` (new in this sprint): a shallow, blob-less clone of the tag, a temporary Git index, and every failing file excluded and retried so each conflict is listed. Nothing in the repository or its `vscode/` submodule is touched.

## Phase 0 baseline (2026-10-17, `origin/main` `17de26dc`, patches 001–017)

| VS Code | Result |
|---|---|
| 1.117.0 (the pin) | 0 of 17 patches fail |
| 1.142.0 (newest, 14 October) | **13 of 17 patches fail, in 46 file patches** |

The plan's figure (46 file patches) is confirmed. The plan's "16 of the 17 patches" is not: 006, 011, 012 and 014 apply on 1.142.0, so 13 patches fail.

Which of these the sprint removes is measured at merge 1, not guessed: 002's terminal guards leave the stack (`terminalConfigurationService.ts` and its test go back to upstream; `terminal.contribution.ts` keeps its shortcut removal), `editorTabsControl.ts` moves from 002 to 019, and step 2's welcome later removes the Getting Started rows (001 ×3, 016, 017).

```
Cloning microsoft/vscode at 1.142.0 (shallow, blob-less)...
FAIL  001-ritemark-branding.patch (7)
        build/gulpfile.vscode.ts
        build/lib/optimize.ts
        build/next/index.ts
        src/vs/platform/dialogs/electron-browser/dialog.ts
        src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.contribution.ts
        src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts
        src/vs/workbench/contrib/welcomeGettingStarted/browser/media/gettingStarted.css
FAIL  002-ritemark-ui-layout.patch (15)
        src/vs/workbench/browser/parts/auxiliarybar/auxiliaryBarPart.ts
        src/vs/workbench/browser/actions/layoutActions.ts
        src/vs/workbench/browser/part.ts
        src/vs/workbench/browser/parts/activitybar/activitybarPart.ts
        src/vs/workbench/browser/parts/auxiliarybar/auxiliaryBarActions.ts
        src/vs/workbench/browser/parts/editor/editorTabsControl.ts
        src/vs/workbench/browser/parts/globalCompositeBar.ts
        src/vs/workbench/browser/parts/paneCompositePart.ts
        src/vs/workbench/browser/parts/panel/panelActions.ts
        src/vs/workbench/browser/parts/titlebar/media/titlebarpart.css
        src/vs/workbench/browser/parts/titlebar/titlebarPart.ts
        src/vs/workbench/browser/workbench.contribution.ts
        src/vs/workbench/contrib/terminal/browser/terminal.contribution.ts
        src/vs/workbench/contrib/terminal/browser/terminalConfigurationService.ts
        src/vs/workbench/contrib/terminal/test/browser/terminalConfigurationService.test.ts
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

VS Code 1.142.0: 13 of 17 patches fail in 46 file patches
```

## Merge 1 (2026-10-17, `origin/main` `d781a0e1`, patches 001–019)

| VS Code | Result |
|---|---|
| 1.117.0 (the pin) | 0 of 19 patches fail (the pristine apply in Phase 6) |
| 1.142.0 (newest, 14 October) | **15 of 19 patches fail, in 58 file patches** |

Against Phase 0 (13 of 17, 46 file patches): the stack is two patches and 12 file patches bigger, because 018 (12 files fail) and 019 (3) are new. 002 fails in 12 files rather than 15: the terminal guards left it (`terminalConfigurationService.ts` and its test, `terminalEditorSerializer.ts`, `terminalView.ts`), and `editorTabsControl.ts` moved to 019. Most of 018's failures are files VS Code changed around the title bar and the window (`window.ts`, `windowImpl.ts`, `defaultStyles.ts`, the title bar parts), which the VS Code update sprint after step 3 re-cuts with the frame's screenshots as the check.


## Merge 2 (2026-10-18, `origin/main` `f492948b`, patches 001–019, #447 and #450 merged)

| VS Code | Result |
|---|---|
| 1.117.0 (the pin) | 0 of 19 patches fail (E5's preflight: 19 of 19 apply on vanilla 1.117.0) |
| 1.142.0 (newest, 14 October; still the newest on 18 October) | **15 of 19 patches fail, in 60 file patches** |

Against merge 1 (15 of 19, 58 file patches), the stack is two file patches bigger. Both are in 018, from merge 2's work:
- `notificationsViewer.ts`, for the notifications' 20 line;
- `desktop.contribution.ts`, which loads the window sizes contribution.

Every other patch fails in the same files as at merge 1:
- 001: 7; 002: 12; 003: 8; 004: 1; 005: 2; 007: 3; 008: 1;
- 009: 2; 010: 2; 013: 1; 015: 2; 016: 1; 017: 1;
- 018: 14; 019: 3.

006, 011, 012 and 014 apply.

Measured again on the closeout branch, with #451 (`fileCommands.ts` in 018) and the closeout's change to 007 (`paneCompositeBar.ts`, `chatSetupContributions.ts`): the same 15 of 19, in 60 file patches, with the same per-patch counts. `fileCommands.ts` and 007's `paneCompositeBar.ts` hunks apply on 1.142.0.
