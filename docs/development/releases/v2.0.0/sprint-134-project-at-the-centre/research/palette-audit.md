# Palette audit (Phase 1, R21)

Checked 2026-10-19 on `sprint-134-project-at-the-centre` (`30d7fa3a`). `vscode/` is VS Code 1.117.0 at the pin `10c8e557` with all 18 patches applied. Line numbers are `vscode/src` as it is now, unless a path says otherwise.

How it was read:
- the two `commandsQuickAccess.ts` files and the menu code they use, by hand;
- a scan of every file the desktop workbench loads (the import closure of `vs/workbench/workbench.desktop.main.ts`, 3,709 files) for every `f1: true`, every `MenuId.CommandPalette` item and every editor action, with titles resolved from the source;
- the `package.json` of every built-in extension that ships.

Nothing was launched. Section 8 lists what only a dev build can settle.

## 1. How All commands gets its entries

All commands has two sources. Both are joined in one place.

- **Global commands.** `getGlobalCommandPicks` (`vs/workbench/contrib/quickaccess/browser/commandsQuickAccess.ts:226–268`) reads every item of `MenuId.CommandPalette`, using the active editor's context keys (`:228–229`). It keeps only enabled items (`:232`).
- **The editor's own commands.** `getCodeEditorCommandPicks` (`vs/editor/contrib/quickAccess/browser/commandsQuickAccess.ts:35–60`) lists every editor action of the active *text* editor whose precondition holds (`codeEditorWidget.ts:1094–1100`, `editorAction.ts:22–24`). A Ritemark document is a webview, so it has none. These show only with a plain text editor in front, such as `settings.json`.
- **Where they are joined.** `CommandsQuickAccessProvider.getCommandPicks` (`commandsQuickAccess.ts:119–142`) returns both lists at `:128–131`.

How a command reaches `MenuId.CommandPalette`:
- `registerAction2` with `f1: true` adds a palette item whose `when` is the command's precondition (`vs/platform/actions/common/actions.ts:736–738`).
- `MenuRegistry.appendMenuItem(MenuId.CommandPalette, …)`, or an action's `menu: { id: MenuId.CommandPalette, when }`.
- Every command added with `MenuRegistry.addCommand` that has no palette item of its own is added anyway (`actions.ts:520–543`). This is how extension commands get there.
- An extension hides one with `menus.commandPalette` and `"when": "false"`. Its `enablement` becomes the precondition.

How a `when` hides one:
- The menu keeps an item only when its `when` matches (`vs/platform/actions/common/menuService.ts:285`). `ContextKeyExpr.false()` never matches.
- `getGlobalCommandPicks` then drops disabled items (`:232`). An item is enabled when its precondition matches (`actions.ts:598`).
- So a `when` and a precondition both hide an entry.

**Where the filter goes.** One filter on the array at `commandsQuickAccess.ts:128–131`, before `.map`, covers everything. The base class takes that array as `allCommandPicks` (`vs/platform/quickinput/browser/commandsQuickAccess.ts:80`), and every list reads from it:
- search by label and alias (`:101–117`) and by exact ID (`:120`);
- "similar commands", the tf-idf matches (`:86–97`, `:125–137`);
- the recently used order and its separator (`:168–181`, `:220–225`);
- "commonly used" (`:183–197`; product.json has no `commandPaletteSuggestedCommandIds`, so it is off);
- the AI's related-command picks (`commandsQuickAccess.ts:200–224`, which search `allPicks`).

The history (`CommandsHistory`, platform file `:373–506`) stores IDs only, and it only orders picks that exist. A dropped command already in someone's history is never shown, so the history needs no clean-up.

This is one hunk in one file. W15 says "in `getGlobalCommandPicks` and in the editor's command picks"; the editor's picks live in `vs/editor`, which no patch touches. The single spot covers both. No patch touches either `commandsQuickAccess.ts` today.

Patch 015 is the model to copy. It exports a pure function, `filterRitemarkMenubarActions(applicationName, …)` (`menubarControl.ts:61`), and tests it in `src/vs/workbench/test/browser/parts/titlebar/menubarControl.test.ts`, including "other products are unchanged". The same shape works here: an exported `isHiddenFromRitemarkPalette(applicationName, commandId)` beside the provider, and a new test in `src/vs/workbench/contrib/quickaccess/test/browser/`.

Every way into this list goes through the same provider: ⇧⌘P, F1, and Quick Open with `>` (`quickAccess.contribution.ts:42–45`). The Keyboard Shortcuts editor is not filtered. It still lists every command, so a dropped command can still be bound to a key.

## 2. The debugging family

**No debugger ships.** `builtInExtensions` is empty in `branding/product.json`, which `scripts/apply-patches.sh:336–340` copies over `vscode/product.json`. So js-debug, js-debug-companion and js-profile-table are not in the app. Upstream's `product.json` (at the pin) lists all three. The one shipped extension with `debuggers`, debug-server-ready, has type `*` and no label or program, so it registers no debug type (`extHostDebugService.ts:268–286`, `debugUtils.ts:78–80`). `debuggersAvailable` therefore stays false (`debugAdapterManager.ts:237–246`) until the person installs a debugger from Extensions, for example Python.

Most debug entries are hidden today by their `when`. They appear as soon as a debugger is installed. The filter drops them either way.

Shipped built-in extensions were checked too. The build drops `copilot` and the test extensions (`vscode/build/lib/extensions.ts:314–322`), and `scripts/build-prod.sh:350–356` removes `copilot` and `mermaid-chat-features` from the Mac app. Only debug-auto-launch adds a debug command to the palette. npm's "Debug" (`npm.debugScript`) is hidden by its own `"when": "false"`.

### 2a. Shown today without a debugger

| ID | Title in All commands | Source |
|---|---|---|
| `workbench.debug.viewlet.action.addFunctionBreakpointAction` | Add Function Breakpoint (#456) | `debug/browser/breakpointsView.ts:1941` |
| `workbench.debug.viewlet.action.addDataBreakpointOnAddress` | Add Data Breakpoint at Address (#456) | `breakpointsView.ts:2097` |
| `workbench.debug.viewlet.action.toggleBreakpointsActivatedAction` | Toggle Activate Breakpoints | `breakpointsView.ts:2137` |
| `workbench.debug.viewlet.action.removeAllBreakpoints` | Remove All Breakpoints | `breakpointsView.ts:2193` |
| `workbench.debug.viewlet.action.toggleBreakpointsPresentation` | Toggle Breakpoints View Presentation | `breakpointsView.ts:2313` |
| `workbench.debug.panel.action.clearReplAction` | Clear Console | `debug/browser/repl.ts:1062` |
| `debug.addConfiguration` | Debug: Add Configuration... | `debug/browser/debugCommands.ts:990` |
| `debug.action.toggleDisassemblyViewSourceCode` | Toggle Source Code in Disassembly View | `debug/browser/debugEditorActions.ts:277` |
| `extension.node-debug.toggleAutoAttach` | Debug: Toggle Auto Attach | `vscode/extensions/debug-auto-launch/package.json:29` |

### 2b. Shown depending on the stored debug state

These depend on `debugUx` and on whether the Run place has a view. `debugUx` starts from storage, default `default` (`debug/common/debugStorage.ts:68–70`, `debugService.ts:226`), and turns `simple` when a debugger or a configuration event fires (`debugService.ts:172–176`, `:312–315`). Static reading cannot say which value a fresh profile ends with.

| ID | Title in All commands | Source | Shown when |
|---|---|---|---|
| `workbench.action.debug.configure` | Open 'launch.json' | `debug/browser/debugViewlet.ts:197` | `debugUx` is not `simple` |
| `workbench.view.debug` | View: Show Run and Debug | `debug.contribution.ts:445–451`, made by `views/browser/viewsService.ts:401–425` | the Run place has a view (`viewsService.ts:191`; `hideIfEmpty` from patch 003) |
| `workbench.debug.action.focusVariablesView` | Run and Debug: Focus on Variables View | `debug.contribution.ts:462`, made by `viewsService.ts:557–570` | `debugUx` is `default` |
| `workbench.debug.action.focusWatchView` | Run and Debug: Focus on Watch View | `debug.contribution.ts:463` | the same |
| `workbench.debug.action.focusCallStackView` | Run and Debug: Focus on Call Stack View | `debug.contribution.ts:464` | the same |
| `workbench.debug.action.focusBreakpointsView` | Run and Debug: Focus on Breakpoints View | `debug.contribution.ts:465` | breakpoints exist, or `default`, or has debugged |
| `workbench.debug.loadedScriptsView.focus` | Run and Debug: Focus on Loaded Scripts View | `debug.contribution.ts:467` | a session that supports loaded scripts |
| `workbench.debug.welcome.focus` | Run and Debug: Focus on Run View | `debug.contribution.ts:466` | never (patch 003 sets `never-show`) |

### 2c. Shown only with a debugger or in a debug session

`registerDebugCommandPaletteItem` (`debug.contribution.ts:114–125`) adds `debuggersAvailable` to every item it registers, under the category Debug. Its 29 items (`:127–155`):

| ID | Title in All commands |
|---|---|
| `workbench.action.debug.restart` | Debug: Restart |
| `workbench.action.debug.terminateThread` | Debug: Terminate Thread |
| `workbench.action.debug.stepOver` | Debug: Step Over |
| `workbench.action.debug.stepInto` | Debug: Step Into |
| `workbench.action.debug.stepIntoTarget` | Debug: Step Into Target |
| `workbench.action.debug.stepOut` | Debug: Step Out |
| `workbench.action.debug.pause` | Debug: Pause |
| `workbench.action.debug.disconnect` | Debug: Disconnect |
| `workbench.action.debug.disconnectAndSuspend` | Debug: Disconnect and Suspend |
| `workbench.action.debug.stop` | Debug: Stop |
| `workbench.action.debug.continue` | Debug: Continue |
| `debug.jumpToCursor` | Debug: Jump to Cursor; Debug: Set Next Statement (two items, one ID) |
| `editor.debug.action.runToCursor` | Debug: Run to Cursor |
| `editor.debug.action.selectionToRepl` | Debug: Evaluate in Debug Console |
| `editor.debug.action.selectionToWatch` | Debug: Add to Watch |
| `editor.debug.action.toggleInlineBreakpoint` | Debug: Inline Breakpoint |
| `workbench.action.debug.start` | Debug: Start Debugging |
| `workbench.action.debug.run` | Debug: Start Without Debugging |
| `workbench.action.debug.selectandstart` | Debug: Select and Start Debugging |
| `workbench.action.debug.nextConsole` | Debug: Focus Next Debug Console |
| `workbench.action.debug.prevConsole` | Debug: Focus Previous Debug Console |
| `workbench.action.debug.showLoadedScripts` | Debug: Open Loaded Script... |
| `workbench.action.debug.selectDebugConsole` | Debug: Select Debug Console |
| `workbench.action.debug.selectDebugSession` | Debug: Select Debug Session |
| `workbench.action.debug.callStackTop` | Debug: Navigate to Top of Call Stack |
| `workbench.action.debug.callStackBottom` | Debug: Navigate to Bottom of Call Stack |
| `workbench.action.debug.callStackUp` | Debug: Navigate Up Call Stack |
| `workbench.action.debug.callStackDown` | Debug: Navigate Down Call Stack |

Other entries in this group:

| ID | Title in All commands | Source | Shown when |
|---|---|---|---|
| `workbench.debug.viewlet.action.enableAllBreakpoints` | Enable All Breakpoints | `breakpointsView.ts:2231` | a debugger |
| `workbench.debug.viewlet.action.disableAllBreakpoints` | Disable All Breakpoints | `breakpointsView.ts:2261` | a debugger |
| `workbench.debug.viewlet.action.reapplyBreakpointsAction` | Reapply All Breakpoints | `breakpointsView.ts:2291` | in a session |
| `debug.toggleExceptionBreakpoints` | Debug: Toggle Exception Breakpoints | `debugCommands.ts:1083` | a debugger |
| `editor.debug.action.toggleBreakpoint` | Debug: Toggle Breakpoint | `debugEditorActions.ts:40` | a debugger |
| `debug.action.openDisassemblyView` | Open Disassembly View | `debugEditorActions.ts:237` | a stopped session with disassembly |
| `workbench.debug.action.toggleRepl` | View: Toggle Debug Console | `debug.contribution.ts:436` | the Debug Console view exists, which needs a debugger (`:428–433`) |
| `workbench.panel.repl.view.focus` | Debug Console: Focus on Debug Console View | made from `debug.contribution.ts:428` by `viewsService.ts:557–570` | the same |

### 2d. Editor actions (a text editor in front)

All in `debugEditorActions.ts`. They show only with a plain text editor in front and their precondition true.

| ID | Title in All commands | Line | Shown when |
|---|---|---|---|
| `editor.debug.action.conditionalBreakpoint` | Debug: Add Conditional Breakpoint... | `:104` | a debugger |
| `editor.debug.action.addLogPoint` | Debug: Add Logpoint... | `:131` | a debugger |
| `editor.debug.action.triggerByBreakpoint` | Debug: Add Triggered Breakpoint... | `:160` | a debugger |
| `editor.debug.action.editBreakpoint` | Debug: Edit Breakpoint | `:189` | a debugger |
| `editor.debug.action.goToNextBreakpoint` | Debug: Go to Next Breakpoint | `:597` | a debugger |
| `editor.debug.action.goToPreviousBreakpoint` | Debug: Go to Previous Breakpoint | `:607` | a debugger |
| `editor.debug.action.runToCursor` | Run to Cursor | `:300` | a debugger and editor focus |
| `editor.debug.action.selectionToRepl` | Evaluate in Debug Console | `:346` | in a session |
| `editor.debug.action.selectionToWatch` | Add to Watch | `:389` | in a session |
| `editor.debug.action.showDebugHover` | Debug: Show Hover | `:445` | in a session |
| `editor.debug.action.stepIntoTargets` | Step Into Target | `:470` | a stopped session |
| `editor.debug.action.closeExceptionWidget` | Close Exception Widget | `:618` | the exception widget is open |

### 2e. Registered, but never offered

- `repl.action.acceptInput` and `repl.action.copyAll` (`repl.ts:914`, `:990`): editor actions of the Debug Console's input, which is not an editor tab, so the palette never sees them. They are left off the list.
- `workbench.debug.action.focusRepl` (`repl.ts:1221`) and `debug.installAdditionalDebuggers` (`debugCommands.ts:973`): no palette item.
- Testing's "Test: Debug Test at Cursor" and its siblings belong to the Test family (section 4), not to R21.

## 3. The developer family

Every palette entry with the category Developer (`Categories.Developer`, `vs/platform/action/common/actionCommonCategories.ts:14`, or its own `localize2('developer', …)`), plus the editor actions whose label starts "Developer:". 87 in all: 83 dropped, 4 kept. The merge editor's five "(Dev)" commands sit under their own category and are added at the end.

Unless a row says otherwise, the entry shows today. "Dev build only" means it is registered when VS Code runs from source, but not in the built app.

| ID | Title in All commands | Source (`vs/workbench/…` unless shown) | Shown | Verdict |
|---|---|---|---|---|
| `workbench.action.inspectContextKeys` | Developer: Inspect Context Keys | `browser/actions/developerActions.ts:54` | yes | drop |
| `workbench.action.toggleScreencastMode` | Developer: Toggle Screencast Mode | `browser/actions/developerActions.ts:120` | yes | drop |
| `workbench.action.logStorage` | Developer: Log Storage Database Contents | `browser/actions/developerActions.ts:418` | yes | drop |
| `workbench.action.logWorkingCopies` | Developer: Log Working Copies | `browser/actions/developerActions.ts:439` | yes | drop |
| `workbench.action.removeLargeStorageDatabaseEntries` | Developer: Remove Large Storage Database Entries... | `browser/actions/developerActions.ts:479` | yes | drop |
| `workbench.action.showPolicyDiagnostics` | Developer: Policy Diagnostics | `browser/actions/developerActions.ts:671` | yes | drop |
| `workbench.action.syncAccountPolicy` | Developer: Sync Account Policy | `browser/actions/developerActions.ts:929` | yes | drop |
| `workbench.action.startTrackDisposables` | Developer: Start Tracking Disposables | `browser/actions/developerActions.ts:589` | dev build only (`:963–967`) | drop |
| `workbench.action.snapshotTrackedDisposables` | Developer: Snapshot Tracked Disposables | `browser/actions/developerActions.ts:612` | dev build only | drop |
| `workbench.action.stopTrackDisposables` | Developer: Stop Tracking Disposables | `browser/actions/developerActions.ts:632` | dev build only | drop |
| `workbench.action.reloadWindow` | Developer: Reload Window | `browser/actions/windowActions.ts:365` | yes | **keep** |
| `workbench.action.toggleDevTools` | Developer: Toggle Developer Tools | `electron-browser/actions/developerActions.ts:28` | yes | **keep** |
| `workbench.action.reloadWindowWithExtensionsDisabled` | Developer: Reload with Extensions Disabled | `electron-browser/actions/developerActions.ts:79` | yes | drop |
| `workbench.action.revealUserDataFolder` | Developer: Reveal User Data Folder | `electron-browser/actions/developerActions.ts:95` | yes | drop |
| `workbench.action.showGPUInfo` | Developer: Show GPU Info | `electron-browser/actions/developerActions.ts:114` | yes | drop |
| `workbench.action.showContentTracing` | Developer: Show Content Tracing | `electron-browser/actions/developerActions.ts:131` | yes | drop |
| `workbench.action.startTracing` | Developer: Start Tracing | `electron-browser/actions/developerActions.ts:150` | yes | drop |
| `workbench.action.stopTracing` | Developer: Stop Tracing | `electron-browser/actions/developerActions.ts:197` | yes | drop |
| `editor.action.forceRetokenize` | Developer: Force Retokenize | `vs/editor/contrib/tokenization/browser/tokenization.ts:14` | text editor only | drop |
| `editor.action.debugEditorGpuRenderer` | Developer: Debug Editor GPU Renderer | `vs/editor/contrib/gpu/browser/gpuActions.ts:27` | text editor only | drop |
| `editor.action.inlineSuggest.dev.extractRepro` | Developer: Extract Inline Suggest State | `vs/editor/contrib/inlineCompletions/browser/controller/commands.ts:400` | with an inline suggestion | drop |
| `editor.action.inspectTMScopes` | Developer: Inspect Editor Tokens and Scopes | `contrib/codeEditor/browser/inspectEditorTokens/inspectEditorTokens.ts:121` | text editor only | drop |
| `workbench.action.inspectKeyMappings` | Developer: Inspect Key Mappings | `contrib/codeEditor/browser/inspectKeybindings.ts:18` | yes | drop |
| `workbench.action.inspectKeyMappingsJSON` | Developer: Inspect Key Mappings (JSON) | `contrib/codeEditor/browser/inspectKeybindings.ts:39` | yes | drop |
| `editor.action.startDebugTextMate` | Developer: Start TextMate Syntax Grammar Logging | `contrib/codeEditor/electron-browser/startDebugTextMate.ts:31` | yes | drop |
| `workbench.action.chat.logInputHistory` | Developer: Log Chat Input History | `contrib/chat/browser/actions/chatDeveloperActions.ts:97` | with Copilot Chat | drop |
| `workbench.action.chat.logChatIndex` | Developer: Log Chat Index | `contrib/chat/browser/actions/chatDeveloperActions.ts:117` | with Copilot Chat | drop |
| `workbench.action.chat.inspectChatModel` | Developer: Inspect Chat Model | `contrib/chat/browser/actions/chatDeveloperActions.ts:137` | with Copilot Chat | drop |
| `workbench.action.chat.inspectChatModelReferences` | Developer: Inspect Chat Model References | `contrib/chat/browser/actions/chatDeveloperActions.ts:191` | with Copilot Chat | drop |
| `workbench.action.chat.clearRecentlyUsedLanguageModels` | Developer: Clear Recently Used Language Models | `contrib/chat/browser/actions/chatDeveloperActions.ts:220` | with Copilot Chat | drop |
| `workbench.action.chat.openAgentDebugPanel` | Developer: Open Agent Debug Logs | `contrib/chat/browser/actions/chatOpenAgentDebugPanelAction.ts:38` | with Copilot Chat | drop |
| `workbench.action.chat.exportAgentDebugLog` | Developer: Export Agent Debug Log... | `contrib/chat/browser/actions/chatOpenAgentDebugPanelAction.ts:117` | with Copilot Chat | drop |
| `workbench.action.chat.importAgentDebugLog` | Developer: Import Agent Debug Log... | `contrib/chat/browser/actions/chatOpenAgentDebugPanelAction.ts:182` | with Copilot Chat | drop |
| `aiCustomization.generateDebugReport` | Developer: Generate Customization Debug Report | `contrib/chat/browser/aiCustomization/aiCustomizationManagement.contribution.ts:809` | with Copilot Chat | drop |
| `workbench.action.chat.openStorageFolder` | Developer: Open Chat Storage Folder | `contrib/chat/electron-browser/actions/chatDeveloperActions.ts:19` | with Copilot Chat | drop |
| `workbench.action.chat.resetGrowthSession` | Developer: Reset Growth Session Notification | `contrib/chat/browser/chatSetup/chatSetupGrowthSession.ts:162` | yes | drop |
| `workbench.action.showRuntimeExtensions` | Developer: Show Running Extensions | `contrib/extensions/browser/abstractRuntimeExtensionsEditor.ts:519` | yes | drop |
| `workbench.extensions.action.installExtensionFromLocation` | Developer: Install Extension from Location... | `contrib/extensions/browser/extensions.contribution.ts:941` | yes | drop |
| `workbench.extensions.action.devtoolsExtensionHost` | Developer: Debug Extension Host In Dev Tools | `contrib/extensions/electron-browser/debugExtensionHostAction.ts:69` | yes | drop |
| `workbench.extensions.action.debugExtensionHost` | Developer: Debug Extension Host In New Window | `contrib/extensions/electron-browser/debugExtensionHostAction.ts:116` | yes | drop |
| `workbench.action.debugRenderer` | Developer: Debug Renderer In New Window | `contrib/extensions/electron-browser/debugExtensionHostAction.ts:151` | yes | drop |
| `workbench.action.debugExtensionHostAndRenderer` | Developer: Debug Extension Host and Renderer In New Window | `contrib/extensions/electron-browser/debugExtensionHostAction.ts:179` | yes | drop |
| `workbench.extensions.action.openExtensionsFolder` | Developer: Open Extensions Folder | `contrib/extensions/electron-browser/extensionsActions.ts:21` | yes | drop |
| `_workbench.extensions.action.cleanUpExtensionsFolder` | Developer: Cleanup Extensions Folder | `contrib/extensions/electron-browser/extensionsActions.ts:53` | yes | drop |
| `workbench.action.restartExtensionHost` | Developer: Restart Extension Host | `services/extensions/electron-browser/nativeExtensionService.ts:723` | yes | drop |
| `editor.action.measureExtHostLatency` | Developer: Measure Extension Host Latency | `services/extensions/common/extensionHostManager.ts:629` | yes | drop |
| `workbench.action.toggleKeybindingsLog` | Developer: Toggle Keyboard Shortcuts Troubleshooting | `contrib/keybindings/browser/keybindings.contribution.ts:24` | yes | drop |
| `workbench.action.setLogLevel` | Developer: Set Log Level... | `contrib/logs/common/logs.contribution.ts:28` | yes | drop |
| `workbench.action.showWindowLog` | Developer: Show Window Log | `contrib/logs/common/logs.contribution.ts:186` | yes | drop |
| `workbench.action.openLogsFolder` | Developer: Open Logs Folder | `contrib/logs/electron-browser/logs.contribution.ts:14` | yes | drop |
| `workbench.action.openExtensionLogsFolder` | Developer: Open Extension Logs Folder | `contrib/logs/electron-browser/logs.contribution.ts:28` | yes | drop |
| `workbench.action.showLogs` | Developer: Show Logs... | `contrib/output/browser/output.contribution.ts:534` | yes | drop |
| `workbench.action.openLogFile` | Developer: Open Log... | `contrib/output/browser/output.contribution.ts:577` | yes | drop |
| `workbench.action.exportLogs` | Developer: Export Logs... | `contrib/output/browser/output.contribution.ts:716` | yes | drop |
| `workbench.action.importLog` | Developer: Import Log... | `contrib/output/browser/output.contribution.ts:787` | yes | drop |
| `workbench.action.toggleNotebookClipboardLog` | Developer: Toggle Notebook Clipboard Troubleshooting | `contrib/notebook/browser/contrib/clipboard/notebookClipboard.ts:575` | yes | drop |
| `notebook.toggleLayoutTroubleshoot` | Developer: Toggle Notebook Layout Troubleshoot | `contrib/notebook/browser/contrib/troubleshoot/layout.ts:346` | yes | drop |
| `notebook.inspectLayout` | Developer: Inspect Notebook Layout | `contrib/notebook/browser/contrib/troubleshoot/layout.ts:369` | yes | drop |
| `notebook.clearNotebookEdtitorTypeCache` | Developer: Clear Notebook Editor Type Cache | `contrib/notebook/browser/contrib/troubleshoot/layout.ts:394` (the ID's misspelling is upstream's) | yes | drop |
| `notebook.clearNotebookKernelsMRUCache` | Developer: Clear Notebook Kernels MRU Cache | `contrib/notebook/browser/services/notebookKernelHistoryServiceImpl.ts:140` | yes | drop |
| `workbench.notebook.layout.gettingStarted` | Developer: Reset notebook getting started | `contrib/notebook/browser/contrib/gettingStarted/notebookGettingStarted.ts:88` | only with `notebook.experimental.openGettingStarted` on | drop |
| `notebook.developer.addViewZones` | Developer: Toggle Notebook View Zones | `contrib/notebook/browser/viewParts/notebookViewZones.ts:220` | dev build only (`IsDevelopmentContext`) | drop |
| `perfview.show` | Developer: Startup Performance | `contrib/performance/browser/performance.contribution.ts:51` | yes | drop |
| `perf.insta.printAsyncCycles` | Developer: Print Service Cycles | `contrib/performance/browser/performance.contribution.ts:70` | yes | drop |
| `perf.insta.printTraces` | Developer: Print Service Traces | `contrib/performance/browser/performance.contribution.ts:94` | yes | drop |
| `perf.event.profiling` | Developer: Print Emitter Profiles | `contrib/performance/browser/performance.contribution.ts:118` | yes | drop |
| `workbench.action.openProcessExplorer` | Developer: Open Process Explorer | `contrib/processExplorer/browser/processExplorer.contribution.ts:91` | yes | **keep** (see section 5) |
| `workbench.action.triggerReconnect` | Developer: Connection: Trigger Reconnect | `contrib/remote/common/remote.contribution.ts:160` | yes | drop |
| `workbench.action.pauseSocketWriting` | Developer: Connection: Pause socket writing | `contrib/remote/common/remote.contribution.ts:175` | yes | drop |
| `workbench.action.showTelemetry` | Developer: Show Telemetry | `contrib/telemetry/browser/telemetry.contribution.ts:242` | dev build only: `enableTelemetry` is false in product.json (`vs/platform/telemetry/common/telemetryUtils.ts:96–102`) | drop |
| `workbench.action.generateColorTheme` | Developer: Generate Color Theme From Current Settings | `contrib/themes/browser/themes.contribution.ts:733` | yes | drop |
| `developer.showCurrentFileAsReleaseNotes` | Developer: Open Current File as Release Notes | `contrib/update/browser/update.contribution.ts:84` | yes | drop |
| `update.showUpdateInfo` | Developer: Show Update Info | `contrib/update/browser/update.contribution.ts:252` | yes | drop |
| `_update.applyupdate` | Developer: Apply Update... | `contrib/update/browser/update.contribution.ts:219` | Windows only (`:215`), and only while VS Code's own updater is idle | drop |
| `workbench.action.url.openUrl` | Developer: Open URL | `contrib/url/browser/url.contribution.ts:33` | yes | drop |
| `workbench.profiles.actions.cleanupProfiles` | Developer: Cleanup Profiles | `contrib/userDataProfile/browser/userDataProfileActions.ts:38` | yes | drop |
| `workbench.profiles.actions.resetWorkspaces` | Developer: Reset Workspace Profiles Associations | `contrib/userDataProfile/browser/userDataProfileActions.ts:53` | yes | drop |
| `workbench.action.webview.openDeveloperTools` | Developer: Open Webview Developer Tools | `contrib/webview/electron-browser/webviewCommands.ts:17` | yes | **keep** |
| `workbench.action.webview.reloadWebviewAction` | Developer: Reload Webviews | `contrib/webviewPanel/browser/webviewCommands.ts:106` | yes | drop |
| `resetGettingStartedProgress` | Developer: Reset Welcome Page Walkthrough Progress | `contrib/welcomeGettingStarted/browser/gettingStartedService.ts:731` | yes | drop |
| `workbench.action.welcomeOnboarding2026` | Developer: Welcome Onboarding 2026 | `contrib/welcomeOnboarding/browser/welcomeOnboarding.contribution.ts:22` | yes | drop |
| `workbench.editSessions.actions.resumeFromSerializedPayload` | Developer: Resume Changes from Serialized Data | `contrib/editSessions/browser/editSessions.contribution.ts:440` | not registered: no `editSessions.store` in product.json (`:168`) | drop |
| `workbench.userDataSync.actions.downloadSyncActivity` | Developer: Download Settings Sync Activity | `services/userDataSync/common/userDataSync.ts:102` | only with a Settings Sync account | drop |
| `workbench.action.terminal.showTextureAtlas` | Developer: Show Terminal Texture Atlas | `contrib/terminalContrib/developer/browser/terminal.developer.contribution.ts:33` | with a terminal open | drop |
| `workbench.action.terminal.writeDataToTerminal` | Developer: Write Data to Terminal | `contrib/terminalContrib/developer/browser/terminal.developer.contribution.ts:65` | yes | drop |
| `workbench.action.terminal.recordSession` | Developer: Record Terminal Session | `contrib/terminalContrib/developer/browser/terminal.developer.contribution.ts:100` | yes | drop |
| `workbench.action.terminal.restartPtyHost` | Developer: Restart Pty Host | `contrib/terminalContrib/developer/browser/terminal.developer.contribution.ts:201` | yes | drop |

"With Copilot Chat" means the precondition `chatIsEnabled` (`contrib/chat/common/actions/chatContextKeys.ts:57`), which is true only once Copilot Chat is installed and has an agent. The four terminal commands are registered through `registerTerminalAction`, which turns on `f1` by default (`contrib/terminal/browser/terminalActions.ts:149–151`); the scan missed them, and a hand check found them.

The merge editor's own developer commands, category "Merge Editor (Dev)":

| ID | Title in All commands | Source | Shown | Verdict |
|---|---|---|---|---|
| `merge.dev.copyContentsJson` | Merge Editor (Dev): Copy Merge Editor State as JSON | `contrib/mergeEditor/browser/commands/devCommands.ts:29` | in a merge editor | drop |
| `merge.dev.saveContentsToFolder` | Merge Editor (Dev): Save Merge Editor State to Folder | `devCommands.ts:75` | in a merge editor | drop |
| `merge.dev.loadContentsFromFolder` | Merge Editor (Dev): Load Merge Editor State from Folder | `devCommands.ts:138` | yes | drop |
| `merge.dev.openContentsJson` | Merge Editor (Dev): Open Merge Editor State from JSON | `contrib/mergeEditor/electron-browser/devCommands.ts:30` | yes | drop |
| `merge.dev.openSelectionInTemporaryMergeEditor` | Merge Editor (Dev): Open Selection In Temporary Merge Editor | `contrib/mergeEditor/electron-browser/devCommands.ts:131` | yes | drop |

Checked and not in the app: the web-only developer commands (`logs/browser/logs.contribution.ts`, and "Open Installed Web Extensions Resource" behind `if (isWeb)` in `webExtensionsScannerService.ts:998`) are not in the desktop closure. No shipped built-in extension contributes a Developer command.

## 4. Neighbouring families (candidates only)

R21 drops only the developer and debugging commands. These are for Jarmo's later palette pass (experience 22). The counts are what the static scan found; a family that registers through shared base classes has more, so the dev build gives the real number.

| Family | About how many | Examples | Note |
|---|---|---|---|
| Test | 21 found, more from shared classes | Test: Go to Next Test Failure (`testing.goToNextMessage`); Test: Configure Test Profiles (`testing.configureProfile`); Test: Debug Test at Cursor (`testing.debugAtCursor`) | Most need a test provider (`testExplorerActions.ts:83`), and none ships. Testing's "Debug …" commands are here, not in R21. |
| Notebook | 21 outside Developer, plus 2 from the ipynb extension | Create: New Jupyter Notebook (`ipynb.newUntitledIpynb`, always shown); Notebook: Customize Notebook Layout (`workbench.notebook.layout.configure`); Notebook: Select Notebook Kernel (`_notebook.selectKernel`) | Most need a notebook in front. The notebook's 7 Developer commands are in section 3. |
| Tasks | 15 | Tasks: Run Task (`workbench.action.tasks.runTask`, always shown); Tasks: Run Build Task (`workbench.action.tasks.build`); Tasks: Configure Default Build Task | Ritemark's own "Tasks: Add a Task…" uses the same category name. A later filter must go by ID (`workbench.action.tasks.`), never by category. |
| Interactive window and REPL | 4 | Interactive Window: Focus Input Editor (`interactive.input.focus`); REPL: Focus Input Editor (`repl.input.focus`); REPL: Focus Most Recent REPL Execution | All need an open interactive window. |
| Remote | about 15 | Remote: Show Remote Menu (`workbench.action.remote.showMenu`); Remote: Install Remote Development Extensions (`workbench.action.remote.extensions`); Remote Tunnels: Turn on Remote Tunnel Access... (`workbench.remoteTunnel.actions.turnOn`) | Includes tunnel-forwarding's two "Port Forwarding" commands. The two "Developer: Connection" commands are in section 3. |
| Extension development | 4 outside Developer | Extensions: Install from VSIX... (`workbench.extensions.action.installVSIX`); Help: Start Extension Bisect (`extension.bisect.start`, with Continue and Stop) | "Developer: Install Extension from Location...", "Developer: Show Running Extensions" and the "Debug Extension Host" commands are Developer, so they go now (section 3). |

Other large families the later pass will meet: Chat (84 entries), Search Editor (16), Merge Editor (14), MCP (12), Comments (10), Settings Sync (8), Profiles (8).

## 5. The keep rule (spec R21)

**How it was searched.** Each candidate ID, and each title on its own and with its category ("Developer: …", "Debug: …"), was searched in `extensions/ritemark/src`, `extensions/ritemark/package.json`, `extensions/ritemark/webview/src`, `patches/vscode/*.patch`, `docs/`, `.claude/skills/`, `.claude/agents/`, `scripts/`, `CLAUDE.md`, `AGENTS.md` and `.agents/`. Hits in this sprint's own spec, plan and scenarios, which name commands in order to drop them, were set aside.

**What names a candidate:**
- `workbench.action.reloadWindow` is named by the user troubleshooting page (`docs/user/troubleshooting.md:28`, `:42`, `:150`, `:164`, `:221`), by QA automation (`.claude/skills/ritemark-automation/SKILL.md:150` types "Developer: Reload Window" into the palette), by `.claude/skills/vscode-development/TROUBLESHOOTING.md:220`, and by S58. Ritemark's own code also runs it (`extension.ts`, `welcomeHost.ts`, `updateNotification.ts` and others).
- `workbench.action.toggleDevTools` is the one item in Help ▸ Advanced (patch 015; `electron-browser/actions/developerActions.ts:39`), named in `.claude/skills/vscode-development/SKILL.md:339` and in a QA checklist (`docs/releases/v1.10.0/TEST-CHECKLIST.md:209`).
- `workbench.action.webview.openDeveloperTools` is named in `.claude/agents/webview-expert.md:297` and `.claude/skills/vscode-development/TROUBLESHOOTING.md:336`.
- `workbench.action.openProcessExplorer` is named in `docs/development/releases/v1.10.0/rc-help-menu-regression.md:34`: "Process Explorer remains a Command Menu command but is not a user-facing Help item". That is a decision in a Ritemark doc, so the rule keeps it. **Jarmo may prefer to drop it**: the doc predates R21, and no skill, QA step or user page uses it.
- Nothing names a debugging command. Patch 003's hits for the focus-view IDs (`003-ritemark-menu-cleanup.patch:395–397`) are context lines, not a menu. Older notes that match a title by chance ("Add configuration", "startup performance", "Apply update", the 1.112 audit's "agent debug logs", sprint 69's "Open URL", which is Ritemark's browser command) do not name the command.

**The parity list's palette-only rows.** None is in either family, so none needs an exception. They are listed so the unit test and S58 can check them:
- refreshing the file list: `workbench.files.action.refreshFilesExplorer`, "Refresh Explorer" (`contrib/files/browser/views/explorerView.ts:1085`);
- the AI column's Maximize (G7): `workbench.action.maximizeAuxiliaryBar`, "View: Maximize Secondary Side Bar", and `workbench.action.toggleMaximizedAuxiliaryBar`, "View: Toggle Maximized Secondary Side Bar" (`browser/parts/auxiliarybar/auxiliaryBarActions.ts:181–188`, `:232–238`); `workbench.action.restoreAuxiliaryBar` restores it;
- Send feedback: `ritemark.reactions`, "Send Feedback" (`extensions/ritemark/package.json:202–203`), Ritemark's own.

**Ritemark's own.** All 48 commands in `extensions/ritemark/package.json` start with `ritemark.`. Patch-registered commands start with `ritemark.` or `_ritemark.`. None falls under a dropped ID or prefix.

**Two details for S58.**
- The palette has no "Preferences: Open Settings". `workbench.action.openSettings` has no palette item (`contrib/preferences/browser/preferences.contribution.ts:227`). The palette's entry is "Preferences: Open Settings (UI)", `workbench.action.openSettings2` (`:257`). Neither is touched.
- S58's last step, "View ▸ Debug Console opens as before", cannot run on a stock profile. That View menu item shows only while the Debug Console view exists (`views/browser/viewsService.ts:542–549`), and that view needs a debugger (`debug.contribution.ts:433`). Either install a debugger first, or check the point another way: bind a dropped command, such as "Developer: Inspect Context Keys", in Keyboard Shortcuts and run it by its key.

## 6. Prefixes

Four prefixes take the whole debug contribution. A sweep of every quoted string in `vscode/src` starting with `debug.`, `editor.debug.`, `workbench.debug.` or `workbench.action.debug.` found only debug commands, debug settings and debug message keys. No shipped extension command, no Ritemark command and no parity-kept command starts with any of them. Each prefix keeps its trailing dot, so `workbench.action.debugRenderer`, `editor.action.debugEditorGpuRenderer` and `debugpy.…` do not match; those are matched by their exact ID or not at all.

| Prefix | Every palette ID it drops |
|---|---|
| `workbench.debug.` (16) | `workbench.debug.viewlet.action.addFunctionBreakpointAction`, `…addDataBreakpointOnAddress`, `…toggleBreakpointsActivatedAction`, `…removeAllBreakpoints`, `…enableAllBreakpoints`, `…disableAllBreakpoints`, `…reapplyBreakpointsAction`, `…toggleBreakpointsPresentation`; `workbench.debug.panel.action.clearReplAction`; `workbench.debug.action.toggleRepl`; `workbench.debug.action.focusVariablesView`, `…focusWatchView`, `…focusCallStackView`, `…focusBreakpointsView`; `workbench.debug.welcome.focus`; `workbench.debug.loadedScriptsView.focus` |
| `workbench.action.debug.` (24) | `configure`, `restart`, `terminateThread`, `stepOver`, `stepInto`, `stepIntoTarget`, `stepOut`, `pause`, `disconnect`, `disconnectAndSuspend`, `stop`, `continue`, `start`, `run`, `selectandstart`, `nextConsole`, `prevConsole`, `showLoadedScripts`, `selectDebugConsole`, `selectDebugSession`, `callStackTop`, `callStackBottom`, `callStackUp`, `callStackDown` (each `workbench.action.debug.<name>`) |
| `debug.` (5) | `debug.addConfiguration`, `debug.toggleExceptionBreakpoints`, `debug.jumpToCursor` (both its items), `debug.action.openDisassemblyView`, `debug.action.toggleDisassemblyViewSourceCode` |
| `editor.debug.` (14) | `editor.debug.action.toggleBreakpoint`, `…toggleInlineBreakpoint`, `…runToCursor`, `…selectionToRepl`, `…selectionToWatch`, `…conditionalBreakpoint`, `…addLogPoint`, `…triggerByBreakpoint`, `…editBreakpoint`, `…showDebugHover`, `…stepIntoTargets`, `…goToNextBreakpoint`, `…goToPreviousBreakpoint`, `…closeExceptionWidget` |
| `merge.dev.` (5) | `merge.dev.copyContentsJson`, `…saveContentsToFolder`, `…loadContentsFromFolder`, `…openContentsJson`, `…openSelectionInTemporaryMergeEditor` |

Three debug IDs stay exact, because a prefix would be wider than the family: `workbench.view.debug`, `workbench.panel.repl.view.focus` and `extension.node-debug.toggleAutoAttach`.

The developer commands share no prefix. They are spread over `workbench.action.`, `workbench.extensions.`, `editor.action.`, `notebook.`, `perf.` and more, so they go as 83 exact IDs. A shorter rule is possible: drop a pick whose `commandCategory` equals `Categories.Developer.value` (the base class already compares it, `vs/platform/quickinput/browser/commandsQuickAccess.ts:200–201`), keep an allow-list of the four kept IDs, and list only the 4 editor actions by ID, since editor picks carry no category. That rule would also catch Developer commands a later VS Code adds, and those a Marketplace extension adds. R21 now says "a filter of command IDs", so this is Jarmo's call (see the summary).

## 7. For W15's table

This replaces W15's table. Its first two rows (#456) are inside `workbench.debug.`.

| ID or prefix | Title in All commands | Why it goes |
|---|---|---|
| `workbench.debug.` | Add Function Breakpoint; Add Data Breakpoint at Address; Toggle Activate Breakpoints; Remove All Breakpoints; Enable All Breakpoints; Disable All Breakpoints; Reapply All Breakpoints; Toggle Breakpoints View Presentation; Clear Console; View: Toggle Debug Console; Run and Debug: Focus on Variables, Watch, Call Stack, Breakpoints, Run and Loaded Scripts View (16) | Debugging (#456) |
| `workbench.action.debug.` | Open 'launch.json'; Debug: Start Debugging, Start Without Debugging, Select and Start Debugging, Restart, Stop, Pause, Continue, Step Over/Into/Out, the call stack and console commands (24) | Debugging |
| `debug.` | Debug: Add Configuration...; Debug: Toggle Exception Breakpoints; Debug: Jump to Cursor; Debug: Set Next Statement; Open Disassembly View; Toggle Source Code in Disassembly View | Debugging |
| `editor.debug.` | Debug: Toggle Breakpoint; Debug: Inline Breakpoint; Debug: Run to Cursor; Debug: Add Conditional Breakpoint...; Debug: Add Logpoint...; Debug: Go to Next Breakpoint; and the other editor actions in 2d (14) | Debugging |
| `workbench.view.debug` | View: Show Run and Debug | Debugging (the Run place; parity: left out) |
| `workbench.panel.repl.view.focus` | Debug Console: Focus on Debug Console View | Debugging |
| `extension.node-debug.toggleAutoAttach` | Debug: Toggle Auto Attach | Debugging (built-in debug-auto-launch) |
| `merge.dev.` | Merge Editor (Dev): Copy, Save, Load and Open Merge Editor State, Open Selection In Temporary Merge Editor (5) | Developer |
| `workbench.action.inspectContextKeys` | Developer: Inspect Context Keys | Developer |
| `workbench.action.toggleScreencastMode` | Developer: Toggle Screencast Mode | Developer |
| `workbench.action.logStorage` | Developer: Log Storage Database Contents | Developer |
| `workbench.action.logWorkingCopies` | Developer: Log Working Copies | Developer |
| `workbench.action.removeLargeStorageDatabaseEntries` | Developer: Remove Large Storage Database Entries... | Developer |
| `workbench.action.showPolicyDiagnostics` | Developer: Policy Diagnostics | Developer |
| `workbench.action.syncAccountPolicy` | Developer: Sync Account Policy | Developer |
| `workbench.action.startTrackDisposables` | Developer: Start Tracking Disposables | Developer (dev build only) |
| `workbench.action.snapshotTrackedDisposables` | Developer: Snapshot Tracked Disposables | Developer (dev build only) |
| `workbench.action.stopTrackDisposables` | Developer: Stop Tracking Disposables | Developer (dev build only) |
| `workbench.action.reloadWindowWithExtensionsDisabled` | Developer: Reload with Extensions Disabled | Developer |
| `workbench.action.revealUserDataFolder` | Developer: Reveal User Data Folder | Developer |
| `workbench.action.showGPUInfo` | Developer: Show GPU Info | Developer |
| `workbench.action.showContentTracing` | Developer: Show Content Tracing | Developer |
| `workbench.action.startTracing` | Developer: Start Tracing | Developer |
| `workbench.action.stopTracing` | Developer: Stop Tracing | Developer |
| `editor.action.forceRetokenize` | Developer: Force Retokenize | Developer |
| `editor.action.debugEditorGpuRenderer` | Developer: Debug Editor GPU Renderer | Developer |
| `editor.action.inlineSuggest.dev.extractRepro` | Developer: Extract Inline Suggest State | Developer |
| `editor.action.inspectTMScopes` | Developer: Inspect Editor Tokens and Scopes | Developer |
| `workbench.action.inspectKeyMappings` | Developer: Inspect Key Mappings | Developer |
| `workbench.action.inspectKeyMappingsJSON` | Developer: Inspect Key Mappings (JSON) | Developer |
| `editor.action.startDebugTextMate` | Developer: Start TextMate Syntax Grammar Logging | Developer |
| `workbench.action.chat.logInputHistory` | Developer: Log Chat Input History | Developer |
| `workbench.action.chat.logChatIndex` | Developer: Log Chat Index | Developer |
| `workbench.action.chat.inspectChatModel` | Developer: Inspect Chat Model | Developer |
| `workbench.action.chat.inspectChatModelReferences` | Developer: Inspect Chat Model References | Developer |
| `workbench.action.chat.clearRecentlyUsedLanguageModels` | Developer: Clear Recently Used Language Models | Developer |
| `workbench.action.chat.openAgentDebugPanel` | Developer: Open Agent Debug Logs | Developer |
| `workbench.action.chat.exportAgentDebugLog` | Developer: Export Agent Debug Log... | Developer |
| `workbench.action.chat.importAgentDebugLog` | Developer: Import Agent Debug Log... | Developer |
| `aiCustomization.generateDebugReport` | Developer: Generate Customization Debug Report | Developer |
| `workbench.action.chat.openStorageFolder` | Developer: Open Chat Storage Folder | Developer |
| `workbench.action.chat.resetGrowthSession` | Developer: Reset Growth Session Notification | Developer |
| `workbench.action.showRuntimeExtensions` | Developer: Show Running Extensions | Developer |
| `workbench.extensions.action.installExtensionFromLocation` | Developer: Install Extension from Location... | Developer |
| `workbench.extensions.action.devtoolsExtensionHost` | Developer: Debug Extension Host In Dev Tools | Developer |
| `workbench.extensions.action.debugExtensionHost` | Developer: Debug Extension Host In New Window | Developer |
| `workbench.action.debugRenderer` | Developer: Debug Renderer In New Window | Developer |
| `workbench.action.debugExtensionHostAndRenderer` | Developer: Debug Extension Host and Renderer In New Window | Developer |
| `workbench.extensions.action.openExtensionsFolder` | Developer: Open Extensions Folder | Developer |
| `_workbench.extensions.action.cleanUpExtensionsFolder` | Developer: Cleanup Extensions Folder | Developer |
| `workbench.action.restartExtensionHost` | Developer: Restart Extension Host | Developer |
| `editor.action.measureExtHostLatency` | Developer: Measure Extension Host Latency | Developer |
| `workbench.action.toggleKeybindingsLog` | Developer: Toggle Keyboard Shortcuts Troubleshooting | Developer |
| `workbench.action.setLogLevel` | Developer: Set Log Level... | Developer |
| `workbench.action.showWindowLog` | Developer: Show Window Log | Developer |
| `workbench.action.openLogsFolder` | Developer: Open Logs Folder | Developer |
| `workbench.action.openExtensionLogsFolder` | Developer: Open Extension Logs Folder | Developer |
| `workbench.action.showLogs` | Developer: Show Logs... | Developer |
| `workbench.action.openLogFile` | Developer: Open Log... | Developer |
| `workbench.action.exportLogs` | Developer: Export Logs... | Developer |
| `workbench.action.importLog` | Developer: Import Log... | Developer |
| `workbench.action.toggleNotebookClipboardLog` | Developer: Toggle Notebook Clipboard Troubleshooting | Developer |
| `notebook.toggleLayoutTroubleshoot` | Developer: Toggle Notebook Layout Troubleshoot | Developer |
| `notebook.inspectLayout` | Developer: Inspect Notebook Layout | Developer |
| `notebook.clearNotebookEdtitorTypeCache` | Developer: Clear Notebook Editor Type Cache | Developer |
| `notebook.clearNotebookKernelsMRUCache` | Developer: Clear Notebook Kernels MRU Cache | Developer |
| `workbench.notebook.layout.gettingStarted` | Developer: Reset notebook getting started | Developer |
| `notebook.developer.addViewZones` | Developer: Toggle Notebook View Zones | Developer (dev build only) |
| `perfview.show` | Developer: Startup Performance | Developer |
| `perf.insta.printAsyncCycles` | Developer: Print Service Cycles | Developer |
| `perf.insta.printTraces` | Developer: Print Service Traces | Developer |
| `perf.event.profiling` | Developer: Print Emitter Profiles | Developer |
| `workbench.action.triggerReconnect` | Developer: Connection: Trigger Reconnect | Developer |
| `workbench.action.pauseSocketWriting` | Developer: Connection: Pause socket writing | Developer |
| `workbench.action.showTelemetry` | Developer: Show Telemetry | Developer (dev build only) |
| `workbench.action.generateColorTheme` | Developer: Generate Color Theme From Current Settings | Developer |
| `developer.showCurrentFileAsReleaseNotes` | Developer: Open Current File as Release Notes | Developer |
| `update.showUpdateInfo` | Developer: Show Update Info | Developer |
| `_update.applyupdate` | Developer: Apply Update... | Developer (Windows) |
| `workbench.action.url.openUrl` | Developer: Open URL | Developer (not Ritemark's File ▸ Open URL, `ritemark.browser.openUrl`) |
| `workbench.profiles.actions.cleanupProfiles` | Developer: Cleanup Profiles | Developer |
| `workbench.profiles.actions.resetWorkspaces` | Developer: Reset Workspace Profiles Associations | Developer |
| `workbench.action.webview.reloadWebviewAction` | Developer: Reload Webviews | Developer |
| `resetGettingStartedProgress` | Developer: Reset Welcome Page Walkthrough Progress | Developer |
| `workbench.action.welcomeOnboarding2026` | Developer: Welcome Onboarding 2026 | Developer |
| `workbench.editSessions.actions.resumeFromSerializedPayload` | Developer: Resume Changes from Serialized Data | Developer (not registered today) |
| `workbench.userDataSync.actions.downloadSyncActivity` | Developer: Download Settings Sync Activity | Developer |
| `workbench.action.terminal.showTextureAtlas` | Developer: Show Terminal Texture Atlas | Developer |
| `workbench.action.terminal.writeDataToTerminal` | Developer: Write Data to Terminal | Developer |
| `workbench.action.terminal.recordSession` | Developer: Record Terminal Session | Developer |
| `workbench.action.terminal.restartPtyHost` | Developer: Restart Pty Host | Developer |

Kept:

| ID | Title | Rule that keeps it |
|---|---|---|
| `workbench.action.reloadWindow` | Developer: Reload Window | A doc, a skill and a QA step name it (`docs/user/troubleshooting.md:28`; `ritemark-automation/SKILL.md:150`); S58 |
| `workbench.action.toggleDevTools` | Developer: Toggle Developer Tools | A Ritemark menu names it (Help ▸ Advanced, patch 015); a skill and a QA checklist name it |
| `workbench.action.webview.openDeveloperTools` | Developer: Open Webview Developer Tools | A skill and an agent name it (`vscode-development/TROUBLESHOOTING.md:336`, `webview-expert.md:297`) |
| `workbench.action.openProcessExplorer` | Developer: Open Process Explorer | A Ritemark doc names it (`v1.10.0/rc-help-menu-regression.md:34`); Jarmo to confirm |
| `ritemark.*`, `_ritemark.*` | All of Ritemark's commands, including Send Feedback (`ritemark.reactions`) | Ritemark's own |
| `workbench.files.action.refreshFilesExplorer` | Refresh Explorer | Parity: refreshing the file list is palette-only (outside both families) |
| `workbench.action.maximizeAuxiliaryBar`, `workbench.action.toggleMaximizedAuxiliaryBar` | View: Maximize Secondary Side Bar; View: Toggle Maximized Secondary Side Bar | Parity G7 (outside both families) |

In numbers: 5 prefixes (64 IDs between them), 3 exact debug IDs and 83 exact developer IDs are dropped. That is 62 debugging IDs and 88 developer IDs. 4 developer commands are kept.

## 8. What a dev-build check must confirm

1. On a fresh dev profile, ⇧⌘P with "breakpoint", "debug" and "developer", before the hunk: the entries in 2a show (both #456 examples among them), and the "yes" rows of section 3 show.
2. The stored debug state: whether "Open 'launch.json'", "View: Show Run and Debug" and the four "Run and Debug: Focus on … View" entries show on a fresh profile and on an old one (2b).
3. That `debuggersAvailable` is false without a debugger: "Debug: Start Debugging" is absent. With a debugger installed (Python, say), the 2c entries appear before the hunk and are gone after it.
4. The Copilot Chat entries appear only with Copilot Chat installed and signed in.
5. The dev-build-only entries (Tracking Disposables, Show Telemetry, Toggle Notebook View Zones) show on the dev build. A production build is needed to see them absent without the filter.
6. The editor-only entries (2d, and the four `editor.action.*` Developer rows) appear only with a text editor in front, for example `settings.json`.
7. After the hunk: a profile whose recently used list holds a dropped command (run it first through a key binding) shows it nowhere, and "similar commands" for "breakpoint" offers nothing from the list.
8. After the hunk: the kept list shows, with Refresh Explorer (when Documents is not in find mode) and the AI column's Maximize (when it is not maximised).
9. View ▸ Debug Console appears only with a debugger installed (S58's last step).
10. The real counts of the Test and Notebook families, for experience 22.

Patch 018 reworks the View menu and patch 002 the places. Neither touches the palette, but the dev-build check should confirm that the View menu items named above still appear as described.
