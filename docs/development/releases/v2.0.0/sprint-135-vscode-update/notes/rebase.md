# The rebase (R2)

Per patch: the file list and count before the rebase (`PATCH-RULES.md` §8), the class of every hunk of every failing file (spec R2), the file list after, and the hunk-level comparison of the new patch's `+`/`-` lines with main's.

## File lists before the rebase

On main `3c8a7c30`, by `grep '^diff --git'`.

| Patch | Files | Hunks |
|---|---|---|
| `001-ritemark-branding.patch` | 12 | 21 |
| `002-ritemark-ui-layout.patch` | 25 | 83 |
| `003-ritemark-menu-cleanup.patch` | 23 | 44 |
| `004-ritemark-build-system.patch` | 4 | 7 |
| `005-ritemark-windows-and-oss-fixes.patch` | 3 | 5 |
| `006-ritemark-dev-launch-fallback.patch` | 4 | 4 |
| `007-ritemark-vscode-1117-compat.patch` | 4 | 13 |
| `008-ritemark-windows-binary-strip.patch` | 1 | 1 |
| `009-ritemark-browser-context-bridge.patch` | 4 | 9 |
| `010-ritemark-browser-action-bridge.patch` | 4 | 12 |
| `011-ritemark-cloud-file-error.patch` | 1 | 1 |
| `012-ritemark-shell-watchdog.patch` | 1 | 5 |
| `013-ritemark-configuration-defaults.patch` | 2 | 3 |
| `014-ritemark-save-receipts.patch` | 7 | 16 |
| `015-ritemark-help-menu-policy.patch` | 6 | 16 |
| `016-ritemark-store-acquisition-policy.patch` | 1 | 1 |
| `018-ritemark-surfaces.patch` | 52 | 106 |
| `019-ritemark-tab-row.patch` | 19 | 53 |

### 001-ritemark-branding (12 files)

```
build/gulpfile.vscode.ts
build/lib/optimize.ts
build/next/index.ts
src/vs/base/browser/ui/codicons/codicon/codicon.css
src/vs/code/electron-browser/workbench/workbench.ts
src/vs/platform/dialogs/electron-browser/dialog.ts
src/vs/platform/theme/common/iconRegistry.ts
src/vs/platform/theme/electron-main/themeMainServiceImpl.ts
src/vs/workbench/browser/media/style.css
src/vs/workbench/browser/parts/editor/breadcrumbsControl.ts
src/vs/workbench/browser/parts/editor/media/editortitlecontrol.css
src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.contribution.ts
```

### 002-ritemark-ui-layout (25 files)

```
src/vs/workbench/api/browser/viewsExtensionPoint.ts
src/vs/workbench/browser/actions/layoutActions.ts
src/vs/workbench/browser/media/part.css
src/vs/workbench/browser/part.ts
src/vs/workbench/browser/parts/activitybar/activitybarPart.ts
src/vs/workbench/browser/parts/activitybar/media/activityaction.css
src/vs/workbench/browser/parts/activitybar/media/activitybarpart.css
src/vs/workbench/browser/parts/auxiliarybar/auxiliaryBarActions.ts
src/vs/workbench/browser/parts/auxiliarybar/auxiliaryBarPart.ts
src/vs/workbench/browser/parts/auxiliarybar/media/auxiliaryBarPart.css
src/vs/workbench/browser/parts/compositeBar.ts
src/vs/workbench/browser/parts/editor/media/editorgroupview.css
src/vs/workbench/browser/parts/globalCompositeBar.ts
src/vs/workbench/browser/parts/media/paneCompositePart.css
src/vs/workbench/browser/parts/paneCompositePart.ts
src/vs/workbench/browser/parts/panel/panelActions.ts
src/vs/workbench/browser/parts/sidebar/media/sidebarpart.css
src/vs/workbench/browser/parts/titlebar/media/titlebarpart.css
src/vs/workbench/browser/parts/titlebar/titlebarPart.ts
src/vs/workbench/browser/workbench.contribution.ts
src/vs/workbench/contrib/files/browser/explorerViewlet.ts
src/vs/workbench/contrib/files/browser/media/explorerviewlet.css
src/vs/workbench/contrib/files/browser/views/explorerView.ts
src/vs/workbench/contrib/terminal/browser/terminal.contribution.ts
src/vs/workbench/services/userDataProfile/common/userDataProfileIcons.ts
```

### 003-ritemark-menu-cleanup (23 files)

```
src/vs/editor/contrib/comment/browser/comment.ts
src/vs/platform/actions/common/actions.ts
src/vs/platform/extensionManagement/common/abstractExtensionManagementService.ts
src/vs/platform/extensionManagement/common/extensionGalleryService.ts
src/vs/workbench/browser/parts/editor/editor.contribution.ts
src/vs/workbench/browser/parts/titlebar/menubarControl.ts
src/vs/workbench/contrib/chat/browser/agentSessions/experiments/agentSessionsExperiments.contribution.ts
src/vs/workbench/contrib/chat/browser/chatParticipant.contribution.ts
src/vs/workbench/contrib/chat/browser/chatStatus/chatStatusEntry.ts
src/vs/workbench/contrib/debug/browser/debug.contribution.ts
src/vs/workbench/contrib/emmet/browser/actions/expandAbbreviation.ts
src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts
src/vs/workbench/services/extensionManagement/browser/extensionEnablementService.ts
src/vs/workbench/services/inlineCompletions/common/inlineCompletionsUnification.ts
extensions/git/package.json
src/vs/workbench/contrib/files/browser/fileActions.contribution.ts
src/vs/workbench/browser/actions/workspaceActions.ts
src/vs/workbench/contrib/welcomeViews/common/newFile.contribution.ts
src/vs/workbench/contrib/userDataProfile/browser/userDataProfile.ts
src/vs/workbench/contrib/outline/browser/outline.contribution.ts
src/vs/workbench/contrib/timeline/browser/timeline.contribution.ts
src/vs/workbench/contrib/quickaccess/browser/commandsQuickAccess.ts
src/vs/workbench/contrib/quickaccess/test/browser/ritemarkPalettePolicy.test.ts
```

### 004-ritemark-build-system (4 files)

```
build/.moduleignore
src/vs/code/electron-main/app.ts
src/vs/workbench/services/integrity/electron-browser/integrityService.ts
src/vs/workbench/contrib/webview/browser/webviewElement.ts
```

### 005-ritemark-windows-and-oss-fixes (3 files)

```
build/lib/electron.ts
resources/server/manifest.json
src/vs/workbench/services/accounts/browser/defaultAccount.ts
```

### 006-ritemark-dev-launch-fallback (4 files)

```
scripts/code-cli.sh
scripts/code.sh
scripts/node-electron.sh
scripts/test.sh
```

### 007-ritemark-vscode-1117-compat (4 files)

```
src/vs/workbench/browser/parts/paneCompositeBar.ts
src/vs/workbench/contrib/chat/browser/chat.contribution.ts
src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupContributions.ts
src/vs/workbench/contrib/welcomeOnboarding/browser/onboardingVariationA.ts
```

### 008-ritemark-windows-binary-strip (1 files)

```
build/.moduleignore
```

### 009-ritemark-browser-context-bridge (4 files)

```
src/vs/platform/browserView/common/browserView.ts
src/vs/workbench/contrib/browserView/common/browserView.ts
src/vs/workbench/contrib/browserView/electron-browser/browserView.contribution.ts
src/vs/workbench/contrib/browserView/electron-browser/features/ritemarkBrowserContextFeature.ts
```

### 010-ritemark-browser-action-bridge (4 files)

```
src/vs/platform/browserView/common/browserView.ts
src/vs/workbench/contrib/browserView/common/browserView.ts
src/vs/workbench/contrib/browserView/electron-browser/browserView.contribution.ts
src/vs/workbench/contrib/browserView/electron-browser/features/ritemarkBrowserActionFeature.ts
```

### 011-ritemark-cloud-file-error (1 files)

```
src/vs/platform/files/node/diskFileSystemProvider.ts
```

### 012-ritemark-shell-watchdog (1 files)

```
src/vs/workbench/api/browser/mainThreadExtensionService.ts
```

### 013-ritemark-configuration-defaults (2 files)

```
src/vs/base/common/product.ts
src/vs/workbench/services/configuration/browser/configuration.ts
```

### 014-ritemark-save-receipts (7 files)

```
src/vs/workbench/api/browser/mainThreadDocuments.ts
src/vs/workbench/api/common/extHost.protocol.ts
src/vs/workbench/api/common/extHostDocumentData.ts
src/vs/workbench/api/common/extHostDocuments.ts
src/vs/workbench/services/textfile/common/textFileEditorModel.ts
src/vs/workbench/services/textfile/common/textfiles.ts
src/vs/workbench/services/textfile/test/browser/textFileEditorModel.test.ts
```

### 015-ritemark-help-menu-policy (6 files)

```
src/vs/platform/actions/common/actions.ts
src/vs/workbench/browser/actions/helpActions.ts
src/vs/workbench/browser/parts/titlebar/menubarControl.ts
src/vs/workbench/electron-browser/actions/developerActions.ts
src/vs/workbench/electron-browser/parts/titlebar/menubarControl.ts
src/vs/workbench/test/browser/parts/titlebar/menubarControl.test.ts
```

### 016-ritemark-store-acquisition-policy (1 files)

```
extensions/git/package.nls.json
```

### 018-ritemark-surfaces (52 files)

```
src/vs/base/browser/ui/dialog/dialog.ts
src/vs/base/browser/ui/iconLabel/iconLabel.ts
src/vs/base/browser/ui/menu/menu.ts
src/vs/base/browser/ui/menu/menubar.ts
src/vs/base/test/browser/iconLabel.test.ts
src/vs/base/test/browser/ui/dialog/ritemarkDialogFocus.test.ts
src/vs/platform/dialogs/common/dialogs.ts
src/vs/platform/quickinput/browser/quickInputList.ts
src/vs/platform/quickinput/browser/tree/quickInputDelegate.ts
src/vs/platform/quickinput/browser/tree/quickInputTreeController.ts
src/vs/platform/theme/browser/defaultStyles.ts
src/vs/platform/window/common/window.ts
src/vs/platform/windows/electron-main/windowImpl.ts
src/vs/platform/windows/electron-main/windowsStateHandler.ts
src/vs/platform/windows/test/electron-main/windowsStateHandler.test.ts
src/vs/workbench/api/browser/mainThreadMessageService.ts
src/vs/workbench/browser/labels.ts
src/vs/workbench/browser/layout.ts
src/vs/workbench/browser/media/ritemarkSurfaces.css
src/vs/workbench/browser/parts/auxiliarybar/auxiliaryBarPart.ts
src/vs/workbench/browser/parts/compositeBarActions.ts
src/vs/workbench/browser/parts/dialogs/dialogHandler.ts
src/vs/workbench/browser/parts/editor/editorPart.ts
src/vs/workbench/browser/parts/notifications/notificationsCenter.ts
src/vs/workbench/browser/parts/notifications/notificationsToasts.ts
src/vs/workbench/browser/parts/notifications/notificationsViewer.ts
src/vs/workbench/browser/parts/paneCompositeBar.ts
src/vs/workbench/browser/parts/paneCompositePart.ts
src/vs/workbench/browser/parts/ritemarkFrameMenu.ts
src/vs/workbench/browser/parts/ritemarkFrameStrip.ts
src/vs/workbench/browser/parts/ritemarkMenu.ts
src/vs/workbench/browser/parts/ritemarkSwitchGuard.ts
src/vs/workbench/browser/parts/ritemarkWelcomeAlone.ts
src/vs/workbench/browser/parts/ritemarkWindowSizes.ts
src/vs/workbench/browser/parts/sidebar/ritemarkProjectHead.ts
src/vs/workbench/browser/parts/sidebar/sidebarPart.ts
src/vs/workbench/browser/parts/statusbar/media/statusbarpart.css
src/vs/workbench/browser/parts/statusbar/statusbarPart.ts
src/vs/workbench/browser/parts/titlebar/titlebarPart.ts
src/vs/workbench/browser/style.ts
src/vs/workbench/contrib/files/browser/fileCommands.ts
src/vs/workbench/contrib/files/browser/views/explorerViewer.ts
src/vs/workbench/contrib/splash/browser/partsSplash.ts
src/vs/workbench/contrib/webview/browser/overlayWebview.ts
src/vs/workbench/electron-browser/desktop.contribution.ts
src/vs/workbench/electron-browser/parts/titlebar/titlebarPart.ts
src/vs/workbench/services/actions/common/menusExtensionPoint.ts
src/vs/workbench/services/host/electron-browser/nativeHostService.ts
src/vs/workbench/services/layout/browser/layoutService.ts
src/vs/workbench/test/browser/parts/ritemarkSwitchGuard.test.ts
src/vs/workbench/test/browser/parts/ritemarkWindowSizes.test.ts
src/vs/workbench/test/browser/parts/ritemarkMenu.test.ts
```

### 019-ritemark-tab-row (19 files)

```
src/vs/workbench/browser/parts/editor/editor.ts
src/vs/workbench/browser/parts/editor/editorCommands.ts
src/vs/workbench/browser/parts/editor/editorGroupView.ts
src/vs/workbench/browser/parts/editor/editorGroupWatermark.ts
src/vs/workbench/browser/parts/editor/editorTabsControl.ts
src/vs/workbench/browser/parts/editor/multiEditorTabsControl.ts
src/vs/workbench/browser/parts/editor/ritemarkEmptyDesk.ts
src/vs/workbench/browser/parts/editor/ritemarkFoldedTabs.ts
src/vs/workbench/browser/parts/editor/ritemarkNewTab.ts
src/vs/workbench/browser/parts/editor/singleEditorTabsControl.ts
src/vs/workbench/contrib/terminal/browser/ritemarkTerminalBar.ts
src/vs/workbench/contrib/terminal/browser/ritemarkTerminalTabs.ts
src/vs/workbench/contrib/terminal/browser/terminalEditor.ts
src/vs/workbench/contrib/terminal/browser/terminalEditorInput.ts
src/vs/workbench/contrib/terminal/browser/terminalInstance.ts
src/vs/workbench/contrib/terminal/browser/terminalMenus.ts
src/vs/workbench/contrib/terminal/test/browser/ritemarkTerminalTabs.test.ts
src/vs/workbench/services/editor/test/browser/ritemarkPermanentTabs.test.ts
src/vs/workbench/test/browser/parts/editor/ritemarkTabCount.test.ts
```

