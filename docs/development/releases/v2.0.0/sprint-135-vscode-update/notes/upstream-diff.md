# Upstream's change to the patched files (W1)

Every file any patch touches on main `3c8a7c30`, with the size of upstream's change from the pin (1.117.0, `10c8e557`) to the target (1.142.0, `d956e8a6`), by `git diff --numstat` in the sprint's `vscode/`, which holds both trees. Sorted by size. The audits start from this list: a file that changed a lot can still apply cleanly and hide a changed mechanism (the stylesheet, the DOM reads).

"Created by the patch" means the file exists in neither tree; the patch adds it.

| File | Patches | Upstream, 1.117.0 → 1.142.0 | + | − |
|---|---|---|---|---|
| `src/vs/workbench/contrib/chat/browser/chat.contribution.ts` | 007 | changed | 10 | 2204 |
| `src/vs/workbench/services/accounts/browser/defaultAccount.ts` | 005 | changed | 832 | 109 |
| `src/vs/workbench/contrib/browserView/common/browserView.ts` | 009, 010 | changed | 648 | 245 |
| `build/next/index.ts` | 001 | changed | 114 | 472 |
| `src/vs/code/electron-main/app.ts` | 004 | changed | 355 | 210 |
| `src/vs/workbench/browser/parts/editor/multiEditorTabsControl.ts` | 019 | changed | 477 | 74 |
| `build/gulpfile.vscode.ts` | 001 | changed | 178 | 362 |
| `src/vs/workbench/contrib/welcomeOnboarding/browser/onboardingVariationA.ts` | 007 | changed | 292 | 212 |
| `src/vs/platform/browserView/common/browserView.ts` | 009, 010 | changed | 457 | 45 |
| `src/vs/workbench/contrib/chat/browser/chatStatus/chatStatusEntry.ts` | 003 | changed | 327 | 79 |
| `src/vs/workbench/services/layout/browser/layoutService.ts` | 018 | changed | 372 | 3 |
| `src/vs/workbench/api/common/extHost.protocol.ts` | 014 | changed | 288 | 25 |
| `build/lib/optimize.ts` | 001 | **gone upstream** | 0 | 287 |
| `src/vs/code/electron-browser/workbench/workbench.ts` | 001 | changed | 245 | 36 |
| `src/vs/workbench/contrib/webview/browser/webviewElement.ts` | 004 | changed | 212 | 41 |
| `src/vs/workbench/browser/parts/activitybar/activitybarPart.ts` | 002 | changed | 214 | 25 |
| `src/vs/workbench/browser/parts/editor/editorTabsControl.ts` | 019 | changed | 220 | 12 |
| `src/vs/workbench/browser/workbench.contribution.ts` | 002 | changed | 153 | 76 |
| `src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupContributions.ts` | 007 | changed | 149 | 69 |
| `src/vs/workbench/browser/parts/editor/breadcrumbsControl.ts` | 001 | changed | 171 | 25 |
| `src/vs/workbench/browser/parts/titlebar/titlebarPart.ts` | 002, 018 | changed | 141 | 49 |
| `src/vs/workbench/contrib/terminal/browser/terminalInstance.ts` | 019 | changed | 140 | 43 |
| `src/vs/workbench/browser/parts/editor/editorPart.ts` | 018 | changed | 162 | 13 |
| `src/vs/workbench/browser/parts/globalCompositeBar.ts` | 002 | changed | 140 | 22 |
| `src/vs/workbench/browser/actions/layoutActions.ts` | 002 | changed | 79 | 80 |
| `src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts` | 003 | changed | 124 | 30 |
| `src/vs/workbench/services/extensionManagement/browser/extensionEnablementService.ts` | 003 | changed | 116 | 38 |
| `src/vs/workbench/browser/parts/editor/editor.ts` | 019 | changed | 95 | 53 |
| `src/vs/workbench/contrib/files/browser/views/explorerView.ts` | 002 | changed | 118 | 28 |
| `src/vs/platform/windows/electron-main/windowImpl.ts` | 018 | changed | 110 | 32 |
| `src/vs/base/browser/ui/menu/menu.ts` | 018 | changed | 133 | 7 |
| `src/vs/platform/dialogs/common/dialogs.ts` | 018 | changed | 19 | 117 |
| `src/vs/workbench/browser/parts/editor/editor.contribution.ts` | 003 | changed | 119 | 15 |
| `src/vs/workbench/browser/layout.ts` | 018 | changed | 106 | 16 |
| `src/vs/workbench/browser/parts/editor/editorGroupView.ts` | 019 | changed | 98 | 18 |
| `src/vs/workbench/browser/parts/statusbar/statusbarPart.ts` | 018 | changed | 106 | 7 |
| `src/vs/workbench/test/browser/parts/titlebar/menubarControl.test.ts` | 015 | changed | 108 | 0 |
| `src/vs/workbench/browser/parts/paneCompositePart.ts` | 002, 018 | changed | 98 | 6 |
| `src/vs/workbench/contrib/files/browser/fileCommands.ts` | 018 | changed | 67 | 35 |
| `src/vs/platform/window/common/window.ts` | 018 | changed | 99 | 2 |
| `src/vs/workbench/browser/parts/editor/editorCommands.ts` | 019 | changed | 72 | 21 |
| `src/vs/workbench/browser/parts/titlebar/menubarControl.ts` | 003, 015 | changed | 8 | 84 |
| `src/vs/base/common/product.ts` | 013 | changed | 63 | 27 |
| `extensions/git/package.json` | 003 | changed | 67 | 20 |
| `src/vs/workbench/electron-browser/actions/developerActions.ts` | 015 | changed | 57 | 30 |
| `src/vs/workbench/browser/parts/titlebar/media/titlebarpart.css` | 002 | changed | 59 | 15 |
| `src/vs/workbench/contrib/browserView/electron-browser/browserView.contribution.ts` | 009, 010 | changed | 63 | 8 |
| `src/vs/workbench/browser/parts/notifications/notificationsToasts.ts` | 018 | changed | 54 | 16 |
| `src/vs/platform/extensionManagement/common/abstractExtensionManagementService.ts` | 003 | changed | 50 | 19 |
| `src/vs/workbench/contrib/splash/browser/partsSplash.ts` | 018 | changed | 64 | 5 |
| `src/vs/workbench/contrib/webview/browser/overlayWebview.ts` | 018 | changed | 58 | 9 |
| `src/vs/workbench/browser/parts/notifications/notificationsViewer.ts` | 018 | changed | 52 | 13 |
| `src/vs/workbench/services/actions/common/menusExtensionPoint.ts` | 018 | changed | 43 | 17 |
| `src/vs/workbench/browser/parts/editor/media/editorgroupview.css` | 002 | changed | 42 | 16 |
| `build/.moduleignore` | 004, 008 | changed | 46 | 8 |
| `src/vs/base/browser/ui/dialog/dialog.ts` | 018 | changed | 49 | 4 |
| `src/vs/workbench/browser/parts/editor/singleEditorTabsControl.ts` | 019 | changed | 38 | 15 |
| `build/lib/electron.ts` | 005 | changed | 42 | 6 |
| `src/vs/platform/files/node/diskFileSystemProvider.ts` | 011 | changed | 35 | 8 |
| `src/vs/workbench/browser/part.ts` | 002 | changed | 32 | 10 |
| `src/vs/workbench/browser/parts/paneCompositeBar.ts` | 007, 018 | changed | 22 | 19 |
| `src/vs/platform/extensionManagement/common/extensionGalleryService.ts` | 003 | changed | 6 | 34 |
| `src/vs/workbench/contrib/chat/browser/chatParticipant.contribution.ts` | 003 | changed | 31 | 7 |
| `src/vs/workbench/contrib/terminal/browser/terminalMenus.ts` | 019 | changed | 36 | 0 |
| `src/vs/workbench/contrib/userDataProfile/browser/userDataProfile.ts` | 003 | changed | 17 | 16 |
| `src/vs/platform/actions/common/actions.ts` | 003, 015 | changed | 24 | 4 |
| `src/vs/workbench/browser/parts/notifications/notificationsCenter.ts` | 018 | changed | 20 | 7 |
| `src/vs/workbench/browser/parts/dialogs/dialogHandler.ts` | 018 | changed | 20 | 6 |
| `src/vs/workbench/browser/parts/editor/editorGroupWatermark.ts` | 019 | changed | 20 | 5 |
| `src/vs/workbench/contrib/files/browser/fileActions.contribution.ts` | 003 | changed | 12 | 10 |
| `src/vs/workbench/browser/actions/workspaceActions.ts` | 003 | changed | 10 | 10 |
| `src/vs/workbench/browser/parts/auxiliarybar/auxiliaryBarActions.ts` | 002 | changed | 5 | 15 |
| `src/vs/workbench/browser/parts/sidebar/sidebarPart.ts` | 018 | changed | 16 | 2 |
| `src/vs/workbench/browser/parts/auxiliarybar/auxiliaryBarPart.ts` | 002, 018 | changed | 15 | 2 |
| `src/vs/workbench/contrib/debug/browser/debug.contribution.ts` | 003 | changed | 8 | 9 |
| `src/vs/workbench/electron-browser/parts/titlebar/titlebarPart.ts` | 018 | changed | 10 | 6 |
| `src/vs/workbench/browser/media/style.css` | 001 | changed | 10 | 5 |
| `src/vs/platform/dialogs/electron-browser/dialog.ts` | 001 | changed | 11 | 2 |
| `src/vs/platform/quickinput/browser/quickInputList.ts` | 018 | changed | 10 | 3 |
| `src/vs/workbench/api/browser/mainThreadMessageService.ts` | 018 | changed | 8 | 4 |
| `src/vs/workbench/browser/parts/media/paneCompositePart.css` | 002 | changed | 12 | 0 |
| `src/vs/workbench/contrib/files/browser/media/explorerviewlet.css` | 002 | changed | 12 | 0 |
| `src/vs/workbench/contrib/chat/browser/agentSessions/experiments/agentSessionsExperiments.contribution.ts` | 003 | changed | 9 | 1 |
| `src/vs/workbench/electron-browser/desktop.contribution.ts` | 018 | changed | 7 | 3 |
| `src/vs/workbench/browser/labels.ts` | 018 | changed | 7 | 2 |
| `src/vs/workbench/contrib/terminal/browser/terminal.contribution.ts` | 002 | changed | 3 | 5 |
| `scripts/test.sh` | 006 | changed | 6 | 1 |
| `src/vs/platform/theme/electron-main/themeMainServiceImpl.ts` | 001 | changed | 6 | 1 |
| `src/vs/workbench/browser/parts/auxiliarybar/media/auxiliaryBarPart.css` | 002 | changed | 6 | 1 |
| `src/vs/workbench/contrib/timeline/browser/timeline.contribution.ts` | 003 | changed | 1 | 4 |
| `src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.contribution.ts` | 001 | changed | 3 | 2 |
| `src/vs/platform/theme/browser/defaultStyles.ts` | 018 | changed | 2 | 2 |
| `src/vs/workbench/browser/parts/activitybar/media/activityaction.css` | 002 | changed | 2 | 2 |
| `src/vs/workbench/browser/parts/statusbar/media/statusbarpart.css` | 018 | changed | 4 | 0 |
| `src/vs/workbench/services/configuration/browser/configuration.ts` | 013 | changed | 2 | 2 |
| `extensions/git/package.nls.json` | 016 | changed | 2 | 1 |
| `scripts/code.sh` | 006 | changed | 1 | 1 |
| `src/vs/workbench/browser/parts/panel/panelActions.ts` | 002 | changed | 1 | 1 |
| `src/vs/workbench/browser/media/part.css` | 002 | changed | 1 | 0 |
| `src/vs/workbench/contrib/files/browser/explorerViewlet.ts` | 002 | changed | 1 | 0 |
| `src/vs/workbench/contrib/files/browser/views/explorerViewer.ts` | 018 | changed | 1 | 0 |
| `src/vs/workbench/services/inlineCompletions/common/inlineCompletionsUnification.ts` | 003 | changed | 1 | 0 |
| `resources/server/manifest.json` | 005 | unchanged | 0 | 0 |
| `scripts/code-cli.sh` | 006 | unchanged | 0 | 0 |
| `scripts/node-electron.sh` | 006 | unchanged | 0 | 0 |
| `src/vs/base/browser/ui/codicons/codicon/codicon.css` | 001 | unchanged | 0 | 0 |
| `src/vs/base/browser/ui/iconLabel/iconLabel.ts` | 018 | unchanged | 0 | 0 |
| `src/vs/base/browser/ui/menu/menubar.ts` | 018 | unchanged | 0 | 0 |
| `src/vs/editor/contrib/comment/browser/comment.ts` | 003 | unchanged | 0 | 0 |
| `src/vs/platform/quickinput/browser/tree/quickInputDelegate.ts` | 018 | unchanged | 0 | 0 |
| `src/vs/platform/quickinput/browser/tree/quickInputTreeController.ts` | 018 | unchanged | 0 | 0 |
| `src/vs/platform/theme/common/iconRegistry.ts` | 001 | unchanged | 0 | 0 |
| `src/vs/platform/windows/electron-main/windowsStateHandler.ts` | 018 | unchanged | 0 | 0 |
| `src/vs/platform/windows/test/electron-main/windowsStateHandler.test.ts` | 018 | unchanged | 0 | 0 |
| `src/vs/workbench/api/browser/mainThreadDocuments.ts` | 014 | unchanged | 0 | 0 |
| `src/vs/workbench/api/browser/mainThreadExtensionService.ts` | 012 | unchanged | 0 | 0 |
| `src/vs/workbench/api/browser/viewsExtensionPoint.ts` | 002 | unchanged | 0 | 0 |
| `src/vs/workbench/api/common/extHostDocumentData.ts` | 014 | unchanged | 0 | 0 |
| `src/vs/workbench/api/common/extHostDocuments.ts` | 014 | unchanged | 0 | 0 |
| `src/vs/workbench/browser/actions/helpActions.ts` | 015 | unchanged | 0 | 0 |
| `src/vs/workbench/browser/parts/activitybar/media/activitybarpart.css` | 002 | unchanged | 0 | 0 |
| `src/vs/workbench/browser/parts/compositeBar.ts` | 002 | unchanged | 0 | 0 |
| `src/vs/workbench/browser/parts/compositeBarActions.ts` | 018 | unchanged | 0 | 0 |
| `src/vs/workbench/browser/parts/editor/media/editortitlecontrol.css` | 001 | unchanged | 0 | 0 |
| `src/vs/workbench/browser/parts/sidebar/media/sidebarpart.css` | 002 | unchanged | 0 | 0 |
| `src/vs/workbench/browser/style.ts` | 018 | unchanged | 0 | 0 |
| `src/vs/workbench/contrib/emmet/browser/actions/expandAbbreviation.ts` | 003 | unchanged | 0 | 0 |
| `src/vs/workbench/contrib/outline/browser/outline.contribution.ts` | 003 | unchanged | 0 | 0 |
| `src/vs/workbench/contrib/quickaccess/browser/commandsQuickAccess.ts` | 003 | unchanged | 0 | 0 |
| `src/vs/workbench/contrib/terminal/browser/terminalEditor.ts` | 019 | unchanged | 0 | 0 |
| `src/vs/workbench/contrib/terminal/browser/terminalEditorInput.ts` | 019 | unchanged | 0 | 0 |
| `src/vs/workbench/contrib/welcomeViews/common/newFile.contribution.ts` | 003 | unchanged | 0 | 0 |
| `src/vs/workbench/electron-browser/parts/titlebar/menubarControl.ts` | 015 | unchanged | 0 | 0 |
| `src/vs/workbench/services/host/electron-browser/nativeHostService.ts` | 018 | unchanged | 0 | 0 |
| `src/vs/workbench/services/integrity/electron-browser/integrityService.ts` | 004 | unchanged | 0 | 0 |
| `src/vs/workbench/services/textfile/common/textFileEditorModel.ts` | 014 | unchanged | 0 | 0 |
| `src/vs/workbench/services/textfile/common/textfiles.ts` | 014 | unchanged | 0 | 0 |
| `src/vs/workbench/services/textfile/test/browser/textFileEditorModel.test.ts` | 014 | unchanged | 0 | 0 |
| `src/vs/workbench/services/userDataProfile/common/userDataProfileIcons.ts` | 002 | unchanged | 0 | 0 |
| `src/vs/base/test/browser/iconLabel.test.ts` | 018 | created by the patch | – | – |
| `src/vs/base/test/browser/ui/dialog/ritemarkDialogFocus.test.ts` | 018 | created by the patch | – | – |
| `src/vs/workbench/browser/media/ritemarkSurfaces.css` | 018 | created by the patch | – | – |
| `src/vs/workbench/browser/parts/editor/ritemarkEmptyDesk.ts` | 019 | created by the patch | – | – |
| `src/vs/workbench/browser/parts/editor/ritemarkFoldedTabs.ts` | 019 | created by the patch | – | – |
| `src/vs/workbench/browser/parts/editor/ritemarkNewTab.ts` | 019 | created by the patch | – | – |
| `src/vs/workbench/browser/parts/ritemarkFrameMenu.ts` | 018 | created by the patch | – | – |
| `src/vs/workbench/browser/parts/ritemarkFrameStrip.ts` | 018 | created by the patch | – | – |
| `src/vs/workbench/browser/parts/ritemarkMenu.ts` | 018 | created by the patch | – | – |
| `src/vs/workbench/browser/parts/ritemarkSwitchGuard.ts` | 018 | created by the patch | – | – |
| `src/vs/workbench/browser/parts/ritemarkWelcomeAlone.ts` | 018 | created by the patch | – | – |
| `src/vs/workbench/browser/parts/ritemarkWindowSizes.ts` | 018 | created by the patch | – | – |
| `src/vs/workbench/browser/parts/sidebar/ritemarkProjectHead.ts` | 018 | created by the patch | – | – |
| `src/vs/workbench/contrib/browserView/electron-browser/features/ritemarkBrowserActionFeature.ts` | 010 | created by the patch | – | – |
| `src/vs/workbench/contrib/browserView/electron-browser/features/ritemarkBrowserContextFeature.ts` | 009 | created by the patch | – | – |
| `src/vs/workbench/contrib/quickaccess/test/browser/ritemarkPalettePolicy.test.ts` | 003 | created by the patch | – | – |
| `src/vs/workbench/contrib/terminal/browser/ritemarkTerminalBar.ts` | 019 | created by the patch | – | – |
| `src/vs/workbench/contrib/terminal/browser/ritemarkTerminalTabs.ts` | 019 | created by the patch | – | – |
| `src/vs/workbench/contrib/terminal/test/browser/ritemarkTerminalTabs.test.ts` | 019 | created by the patch | – | – |
| `src/vs/workbench/services/editor/test/browser/ritemarkPermanentTabs.test.ts` | 019 | created by the patch | – | – |
| `src/vs/workbench/test/browser/parts/editor/ritemarkTabCount.test.ts` | 019 | created by the patch | – | – |
| `src/vs/workbench/test/browser/parts/ritemarkMenu.test.ts` | 018 | created by the patch | – | – |
| `src/vs/workbench/test/browser/parts/ritemarkSwitchGuard.test.ts` | 018 | created by the patch | – | – |
| `src/vs/workbench/test/browser/parts/ritemarkWindowSizes.test.ts` | 018 | created by the patch | – | – |

163 files: 101 changed, 1 **gone upstream**, 37 unchanged, 24 created by the patch
