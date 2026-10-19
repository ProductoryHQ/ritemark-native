# The rebase (R2)

Per patch: the file list and count before the rebase (`PATCH-RULES.md` §8), the class of every hunk of every failing file (spec R2), the file list after, and the hunk-level comparison of the new patch's `+`/`-` lines with main's.

## How it was done

- **The three-way merge.** Each patch was first applied on the pin (1.117.0, `10c8e557`) as its own commit, in order (`pin-stack`). Each of those commits was then cherry-picked onto 1.142.0 (`d956e8a6`), in order, in a scratch clone of the sprint's `vscode/`. A cherry-pick is a three-way merge with the pin's real trees, so it also follows files upstream moved or renamed, which `git apply --3way` (the plan's first idea) does not. Conflicts were resolved by intent, hunk by hunk, and a fix found later in a patch went back into that patch's own commit (`--fixup` and `--autosquash`).
- **Regenerated, not edited.** Each patch file is `git diff` of its commit against the one before, under its own header. So each patch is a diff on top of the patches before it, and the stacked pairs (009 → 010, 003 → 015, 002/018/019 in the shared files) are right by construction.
- **Proved.** Every patch's `+`/`-` lines were compared with main's, file by file (the hunk-level diff); every difference is below. After each group of patches, `npm run typecheck-client` (tsgo) at 1.142.0: 0 errors after 007, 009, 010, 015, 018, 019 and the last fix. `scripts/check-patch-stacking.mjs` passes. `apply-patches.sh` from a pristine 1.142.0: 18 applied; a second run applies nothing and exits 0; the dry run says 18 can apply (S5). `npm run compile` in `vscode/` (VS Code's own compile, which type-checks the built-in extensions too): no errors.

The classes are spec R2's: **carried**, **re-based**, **re-cut**, **moved**, **dropped, upstream**, **dropped, 2.0**, **cascade**. No hunk was dropped for 2.0: Steps 2 and 3 had already removed what they replaced.

## Per patch

### 001 branding: 12 → 10 files, 21 → 17 hunks
Three-way merge carried 9 files, `build/next/index.ts` included (its `.woff2` loader sits in the esbuild bundle's loader block, next to `.ttf`).
- `build/gulpfile.vscode.ts` (1 hunk, the font resource includes): **dropped, upstream**. At 1.142.0 the gulp packaging takes the whole bundle output (`gulp.src(out + '/**')`, `packageTask`), and the esbuild bundle writes the fonts the CSS references to `media/` (`assetNames: 'media/[name]'`, `build/next/index.ts`). Dev builds copy every non-TS file from `src/` (`copyAllNonTsFiles`). The `vscodeResourceIncludes` list no longer exists.
- `build/lib/optimize.ts` (2 hunks): **dropped, upstream**. The file is gone (core bundling moved to esbuild); its `.woff2` loader was already carried by 001's hunk in `build/next/index.ts`. The second hunk only removed a trailing blank line.
- `src/vs/platform/dialogs/electron-browser/dialog.ts` (2 hunks): **re-based**. Upstream added `@github/copilot` and `@github/copilot-sdk` lines to the About box (`formatCopilotVersion`, `copilotVersions`). 001's About box keeps its 1.117 lines, so the new lines and their helper go with upstream's `localize` call. The resulting file is byte for byte 1.117's patched file.
- Behavioural differences against main's patch: none beyond the above. The fonts reaching the production bundle is checked in the built app (S30).

### 002 placement: 25 → 25 files, 83 → 83 hunks
Conflicts in 9 files; `auxiliaryBarPart.ts`, `paneCompositePart.ts` and `workbench.contribution.ts` merged cleanly with identical `+`/`-` lines.
- `layoutActions.ts`: **re-based**. Upstream added `when: IsSessionsWindowContext.negate()` to the Appearance submenu that 002 comments out; the submenu stays out, View ▸ Advanced as before. Upstream renamed the toggles' group `2_pane_toggles` → `navigation`; 002's hunks carry on the new context.
- `part.ts`: **re-based**. Header and title 40 high as before; upstream renamed `Footer_HEIGHT` → `FOOTER_HEIGHT` and added `AREA_HEIGHT_MODERN_UI` (used only when the Modern UI experiment's floating panels are on).
- `activitybarPart.ts`: **re-based**, one hunk **dropped, upstream**. `ACTION_HEIGHT` 40, `ACTIVITYBAR_WIDTH` 40 and `ICON_SIZE` 16 as before. `compositeSize: 40` is gone: upstream now derives it (`actionHeight + actionGap`), which gives 40 + 0 with Modern UI off. Upstream's compact height (32 → 28) is taken; 002 never changed it.
- `auxiliaryBarActions.ts`, `panelActions.ts`: **re-based**. The LayoutControlMenu toggles stay removed; upstream's new `SecondarySideBarVisibleContext` import kept, `IsAuxiliaryWindowContext` dropped as before.
- `globalCompositeBar.ts`: **re-based**. Accounts never shows; upstream's restructured `toggleAccountsActivity` keeps 002's pull-only body and fires upstream's new `onDidChange`.
- `titlebarpart.css`: **re-based**. 002's left-toolbar rules sit before upstream's changed right rule (now also `.update-toolbar-container`, `position: relative`); 002's Indigo-Editorial block follows upstream's new progress-badge rules.
- `titlebarPart.ts`: **re-based**. The activity actions stay hidden; upstream's new `TitleBarLeadingActionsGroup` import kept on its own line.
- `terminal.contribution.ts`: **re-based**. Upstream renamed `WindowVisibility` → `WindowEnablement`; no Toggle Terminal shortcut or View-menu entry as before.
- `layoutActions.ts`, found by the type-check: the `KeyMod, KeyCode` import goes too. At 1.142.0 its only use is the Cmd+B binding 002 removes (at the pin, other bindings in the file still used it).
- Behavioural differences against main's patch: none (the hunk-level diff shows only upstream's context lines).

### 003 menus: 23 → 25 files, 44 → 44 hunks
Conflicts in 8 files; the other 15 merged cleanly with identical `+`/`-` lines (the palette filter in `commandsQuickAccess.ts` and its test among them).
- `menubarControl.ts` → `menubar.contribution.ts` (2 hunks): **moved**. Upstream moved the main menu's registrations (File, Edit, Selection, View, Go, Terminal, Help, Preferences) into the new `workbench/browser/parts/titlebar/menubar.contribution.ts`. 003's removal of Selection, Go and Terminal goes there, with the same comments. `menubarControl.ts` leaves 003's file list, `menubar.contribution.ts` joins it (net 23).
- `workspaceActions.ts`: **re-based**. The four workspace items stay hidden; upstream had dropped `IsSessionsWindowContext` from one of their `when`s.
- `editor.contribution.ts`: **re-based**. Share and Editor Layout stay out of the menus. 003 no longer removes `IsSessionsWindowContext` from the imports: upstream now uses it for the Agents window's split-editor items.
- `agentSessionsExperiments.contribution.ts`: **re-based**. The Agents and Chat entries stay out of the command center and title bar (upstream added `InEditorZenModeContext.negate()` to one of them; its new import goes with it).
- `chatStatusEntry.ts`: **re-cut**. The Copilot status entry is still disposed on every update. Upstream now reads `this.statusbarService` elsewhere (entry visibility, the promo), so 003 no longer renames it to `_statusbarService` or `getEntryProps` to `_getEntryProps`; `update()` keeps `void this.getEntryProps`. `StatusbarAlignment` import dropped as before; upstream's `ShowTooltipCommand` → `ToggleTooltipCommand` rename comes along.
- `fileActions.contribution.ts`: **re-based**. `ActiveEditorCanRevertContext` import dropped as before (Revert File stays out of the menu); upstream's new imports kept.
- `userDataProfile.ts`: **re-based**. No File ▸ New Window with Profile.
- `extensionEnablementService.ts`: **re-cut**. Upstream moved the built-in chat extension migration into `ensureChatExtensionInitialDisabledState()`, called from the constructor and on each profile's first enablement read. 003 empties that method instead of the constructor block (the same skip: Copilot Chat installed from the Marketplace is never disabled behind the person's back); the `ChatEntitlementService` and `ChatAIDisabledSettingId` imports that only it used go. The `defaultChatAgent?.…?.toLowerCase()` null-safety re-based.
- **New in this sprint, for 1.142's new surfaces** (`research/surfaces-audit.md` §1.1, §5.2; the R8 commit): `chat/common/constants.ts` makes `OPEN_AGENTS_WINDOW_PRECONDITION` false, so no command, button or shortcut opens the Agents window; `platform/windows/electron-main/windowsMainService.ts` opens a normal window when `--agents`, an agent link or a tryout hand-off asks for the Agents window; All commands leaves out the Agents window's two commands and 23 new Developer commands (7 shown without Copilot Chat, 16 with it), and the palette test covers three of them. Two of the 16 were found on the running build: the workbench registers "Export Agent Host Debug Logs..." as `workbench.action.chat.exportAgentHostDebugLogs` and "Open Agent Host State File" as `workbench.action.chat.openCopilotCliStateFile`; the audit's `agentHost.exportDebugLogs` and `agentHost.openSessionEventsFile` are the Agents window's copies (`src/vs/sessions`), kept in the list as well. Two files join 003 (25).
- Behavioural differences against main's patch: none beyond the above.

### 004 build system: 4 → 4 files, 7 → 7 hunks
- `electron-main/app.ts` (1 of 7): **re-based**. The permission handler stays `async` and asks for the microphone on the Mac (dictation); upstream renamed the handler's first parameter `_webContents` → `webContents` (it now checks auxiliary windows) and added `'media'` to the core window's list. 004 still adds `'media'` to the webview list.
- Behavioural differences against main's patch: none.

### 005 Windows and OSS: 3 → 3 files, 5 → 5 hunks
- `build/lib/electron.ts`: **carried** by the three-way merge (Productory as company and copyright).
- `defaultAccount.ts` (1 of 3): **re-based**. `defaultAccountConfig` may be undefined without `defaultChatAgent`, as before; upstream's new managed-settings emitters sit above it. The service's other reads of the config are in `DefaultAccountProvider`, which 005's guard never constructs without `defaultChatAgent`.
- Behavioural differences against main's patch: none (identical `+`/`-` lines).

### 006 dev launch: 4 → 4 files, 4 → 4 hunks
- **carried**: applies as is.

### 007 Copilot Chat compatibility: 4 → 5 files, 13 → 16 hunks
- `chat.contribution.ts` → `chat.shared.contribution.ts` (2 hunks): **moved**. Upstream moved the chat registrations (2,204 lines) into the new `chat.shared.contribution.ts`. 007's two changes go there unchanged: `ChatSetupActionsContribution` registered instead of `ChatSetupContribution`, `ChatTeardownContribution` not registered. In the shared file the two registrations are no longer next to each other, so the second is its own hunk (14 hunks). `chat.contribution.ts` leaves 007's file list, `chat.shared.contribution.ts` joins it.
- `chatSetupContributions.ts`: **re-based**, one line **re-cut**. 007's own `ChatSetupActionsContribution` (the narrow sign-in actions, the Copilot Chat launcher and `ritemark.copilotChat.openAsTab`) carries over. Upstream renamed `ChatConfiguration.AIDisabled` to `ChatAIDisabledSettingId` (same value, `chat.disableAIFeatures`), so 007's one use changes with it (found by the type-check). Upstream now imports `ChatEntitlementContextKeys` itself, so 007 no longer adds it.
- `onboardingVariationA.ts`: **re-based**. Upstream still asserts `defaultChatAgent` at module load, so the soft fallback is still needed; upstream's new `EnterpriseSignInUiState` type sits above it.
- `paneCompositeBar.ts`: **carried**.
- `webviewPanel/browser/webviewEditor.ts` (2 hunks): **new in this sprint**, found in Phase 7 (S23 of this sprint). 1.142 lets a custom editor reveal the selection it is opened with (`CustomEditorInput.applyOptions` reads `options.selection`), and `WebviewEditor.setInput` called it even when the editor was opened with no options, so the document showed "The editor could not be opened". `workbench.action.openEditorAtIndex` opens with none, and Ritemark runs it for the welcome's landing ("Open when you left"), the permanent tabs, Home, Settings and the Task board; core's Open Next Editor does too. Caught with the debugger on a v1.14.0 profile landing on 1.142 (the same profile on 1.117 opens). Upstream main has since fixed it in this file (`options: IEditorOptions | undefined`, navigation only `if (options && …)`); 007 takes that fix as it is, so the next update drops the hunks.
- Behavioural differences against main's patch: none beyond the above. Runtime check: Copilot Chat's launcher in More, the View menu and Ctrl+Alt+I open it as a tab (Phase 7).

### 008 Windows binary strip: 1 → 1 file, 1 → 1 hunk
- `build/.moduleignore`: **re-based**, two lines **dropped, upstream**. Upstream now strips `@github/copilot/**` whole ("Agent Host uses the runtime bundled with @github/copilot-sdk") and re-adds only the target's Copilot SDK platform package during packaging (`build/lib/copilot.ts`), so 008's `@github/copilot/sdk/prebuilds/**` and `@github/copilot/sdk/ripgrep/**` go. The three `@anthropic-ai/claude-agent-sdk/vendor/*` lines stay. At 1.142.0 the SDK ships its binary in per-platform packages (`claude-agent-sdk-<target>`) and has no `vendor/` folder in this install, so they are a guard for now. Windows packaging (`rcedit`) proves it at Windows CI after the merge (R5).

### 009 browser context: 4 → 4 files, 9 → 12 hunks
Re-cut onto upstream's reworked `browserView` as `research/browser-bridge-audit.md` §2 describes. Upstream removed the model's `sharedWithAgent` flag and Playwright's page tracking: a share is now an agent **audience** on the view (`setAudience`), and `sharingState` reads `Unavailable` whenever VS Code's own chat is off.
- workbench `common/browserView.ts`: **re-cut**. A new `ritemarkSharedWithAgent` reads the audiences directly, so the AI's page context does not depend on VS Code's chat. `annotationMode`, `ritemarkSharesWithoutAsking` and `shareWithAgentAnswered` are re-based next to upstream's sharing members. `shareWithAgentAnswered` follows upstream's Allow path: the network-policy notice (the `sharingState` getter's own test), upstream's isolated-copy question when the network filter is on, the stored choice, then `setAudience`. Clearing annotation mode when the share goes moves from `_setSharedWithAgent` (gone) to a listener on upstream's `onDidChangeAudiences` (a new hunk). `setAnnotationMode` treats a share that opened an isolated copy in another tab as not shared here.
- Behavioural difference: at the pin the network-policy notice fired for any blocked address; at 1.142.0 only a tab that is not directly shareable can be blocked (upstream's rule: a tab in `Agent` storage enforces the policy itself). This follows upstream's Allow path, as `update-vscode.sh` step 4 asks.
- `browserView.contribution.ts`: **re-based** (the import after upstream's new features).
- platform `common/browserView.ts`: **carried** (the six command IDs).
- `features/ritemarkBrowserContextFeature.ts` (created): **re-cut**. `BrowserActionCategory` now comes from `browserEditor.ts` (`browserViewActions.ts` is gone); the contribution hooks are renamed (`onModelAttached`, `onModelDetached`); Playwright calls take a session ID, and Ritemark uses one fixed session, `RITEMARK_PLAYWRIGHT_SESSION = 'ritemark'`, for reading and acting, so a summary's `aria-ref`s match the actions (never upstream's `'<default>'`, so no state is shared with VS Code's chat). The screenshot toggle moves to upstream's `BrowserActionGroup.Tools` group, order 3 (the `'actions'` group is gone). The `ritemark.browser.didNavigate` line is unchanged (the extension's test reads it).
- Behavioural difference, a choice: Browser Recent's `ephemeral` flag now covers every in-memory tab (`isInMemoryStorageScope`: private tabs and upstream's new `Agent` storage, used by tabs VS Code's chat opens and by the isolated copies a share opens). At the pin only private tabs existed; recording the new kinds would be new behaviour.
- The extension-facing contract (16 commands, the event and the context key; audit §4) is unchanged; the extension needs no change.

### 010 browser actions: 4 → 7 files, 12 → 18 hunks
- workbench `common/browserView.ts`: **re-based** beside 009's lines, and **re-cut** where it hooked `_setSharedWithAgent`: revoking control when the share goes moves into 009's audience listener; `setSharedWithAgentForControl` uses the same guard as `setAnnotationMode`.
- `browserView.contribution.ts`: the `generateUuid` import is **dropped, upstream** (the file imports it at 1.142.0 for its own `.html` opener; carrying it would import it twice). `IEditorService` and the action feature's import **re-based**; the constructor takes `IEditorService` after upstream's new `ITelemetryService`. The `.html`/`.htm` resolver is **re-cut**: `browserViewWorkbenchService.getOrCreateLazy` instead of `createInstance(BrowserEditorInput, …)` (its constructor changed), and its label key is renamed `ritemark.browser.htmlEditorLabel`, because upstream's own `.html` entry in the same file now uses `browser.htmlEditorLabel` with another message. Upstream's entry (`file:/**/*.{html,htm,mhtml,mht}`, `option` priority, resource-backed) stays; Ritemark's (`default`) wins. "Open With…" may list both.
- `features/ritemarkBrowserActionFeature.ts` (created): **re-cut**. `BrowserActionCategory` from `browserEditor.ts`; `getSummary` and `invokeFunction` take `RITEMARK_PLAYWRIGHT_SESSION` (imported from 009's feature); the snapshot's read-consent gate reads `ritemarkSharedWithAgent`.
- **New in this sprint, the Experience lead's decision on the browser bar (D5, after the screenshot comparison):** `browserEditorChatFeatures.ts`: 1.142's Add Element to Chat split button ("Add to Chat") is left off the bar (`when: ContextKeyExpr.false()`), even with Copilot Chat installed, since it sends to Copilot Chat and not to the AI beside the page; its command and shortcut stay. `browserDevToolsFeature.ts`: Developer tools is hidden by default, which puts it in the bar's ⋯ menu, and its label is in sentence case. `browserWelcomeFeature.ts`: an empty tab always says "Enter a URL above to get started." (the chat subtitle pointed at the hidden button). Three files join 010 (7).
- Behavioural differences against main's patch: none beyond the above. S26 and S55–S57 run twice: with Copilot Chat off and on.

### 011 cloud-file error, 012 shell watchdog, 014 save receipts, 016 store policy
- **carried**: each applies as it is (016 only needed 001's hunks in `gettingStarted.ts`, which Sprint 133 retired). File and hunk counts unchanged: 1/1, 1/5, 7/16, 1/1.

### 013 configuration defaults: 2 → 2 files, 3 → 3 hunks
- `base/common/product.ts`: **re-based** by the three-way merge (upstream inserted `IAgentSdkProductConfig` and `IDictationRuntimeProductConfig` above `IProductConfiguration`). `configuration.ts` **carried**.

### 015 Help menu: 6 → 6 files, 16 → 18 hunks
- `menubarControl.ts`: **re-based**. The Help allowlist (`filterRitemarkMenubarActions`) and Help ▸ Advanced stay in this file; the main menu registrations around them moved upstream to `menubar.contribution.ts` (003 above), so 015 now imports `MenuRegistry` itself (upstream dropped the import with the registrations).
- `test/browser/parts/titlebar/menubarControl.test.ts`: **re-cut**. 015 created this test file at the pin; upstream added its own test file of the same name (Open Recent's labels). 015's "Ritemark menubar policy" suite is appended to upstream's file, and the imports are joined.

### 018 the frame: 52 → 52 files, 106 → 108 hunks
Re-cut per `research/frame-audit.md` (§5). The frame's mechanisms all carry to 1.142.0, so D3's fallback is not needed. Six re-cuts:
- **Modern UI** (new, `workbench.experimental.modernUI`, default on): pinned off in `branding/product.json` (R8 commit). Its branches in `part.ts`, `paneCompositePart.ts`, `editorPart.ts`, `statusbarPart.ts`, `notificationsViewer.ts`, `editorTabsControl.ts` all sit behind `isFloatingPanelsEnabled()`; 018's lines sit beside them.
- `sidebarPart.ts`, `auxiliaryBarPart.ts`: **re-cut**. Upstream's `Part.relayout()` now asks `getRelayoutDimension()`, which `AbstractPaneCompositePart` answers with the box 018 already shrank, so a header or footer change would take the strip off twice. Both parts override it to return `this.dimension`, the full size 018's `Part.prototype.layout.call(...)` restores. (The `auxiliaryBarPart.ts` hunk applied cleanly and would still have broken.)
- `windowImpl.ts`: **re-based** into upstream's new gate. The first placement of the window controls is now gated by `hasWindowControlOverlay`; 018's `CodeWindow` branch (52 on the Mac, 44 on Windows) sits inside it. `isTahoeOrNewer` leaves the import (its only use moved to `window.ts`).
- `overlayWebview.ts`: **re-cut**. `layoutWebviewOverElement` is gone (webviews follow their anchor through CSS anchor positioning); the `ritemark-desk-webview` toggle moves into `setAnchorElement`.
- `ritemarkSurfaces.css` (created): **re-cut**, four selectors. The empty desk's watermark now sits in `.editor-group-watermark-wrapper`; the rules that hid the letterpress and placed the tiles move onto the wrapper, and the letterpress and upstream's new group toolbar inside it are hidden.
- Moved lines, **re-based**: `dialog.ts` (the cancel-first focus inside upstream's new `focusedButton` fallback), `defaultStyles.ts` and `layoutService.ts` (import lines), `window.ts` (018's constants after upstream's `getMacOSWindowControlsPosition`), `notificationsViewer.ts` (`LINE_HEIGHT` 20 beside upstream's `ROW_HEIGHT` getter), `partsSplash.ts` (the ground beside upstream's Modern UI shell colours; the title bar's colours now `makeOpaque`), `menusExtensionPoint.ts` (Ritemark's menus after upstream's agents entries). `editorPart.ts`, `statusbarPart.ts`, `dialogHandler.ts`, `desktop.contribution.ts`, both `titlebarPart.ts` merged cleanly.
- Sprint 134's lean points hold at 1.142.0: `_savePartsSplash`, `doOpenWindow`, `ShutdownReason` (frame audit §2).
- Behavioural differences against main's patch: none beyond the above (the hunk-level diff shows the re-cuts and context only).

### 019 the tab row: 19 → 19 files, 53 → 53 hunks
- `multiEditorTabsControl.ts`: **re-cut** at the pinned tabs' width. Upstream now sums the width in a loop that also sets each pinned tab's `left`; `RITEMARK_TABS_INSET` is added after the loop, so Home and Tasks keep their places and the sum stays 8 + 2 × 38. The rest **re-based** beside upstream's connected-tabs and add-tab fields (no add-tab control is created in the workbench window).
- `editorGroupView.ts`: **re-based**. "Close all" keeps the permanent tabs (019's filter chained after upstream's new `CannotClose` filter); the desk's gaps come before upstream's new `contentWidth`.
- `editorGroupWatermark.ts`: **re-based**. The constructor takes `ICommandService` after upstream's new `IInstantiationService`; the tiles render into `elements.root`, now the wrapper (see 018's stylesheet).
- `editorTabsControl.ts`: **re-based**. `normal: 44` beside upstream's Modern UI heights.
- Behavioural differences against main's patch: none beyond the above.


## File lists after the rebase

At 1.142.0, by `grep '^diff --git'`. Every difference from the lists above is explained in the patch's section.

| Patch | Files before | Files after | Hunks before | Hunks after | Files in and out |
|---|---|---|---|---|---|
| `001-ritemark-branding.patch` | 12 | 10 | 21 | 17 | out: `build/gulpfile.vscode.ts`; out: `build/lib/optimize.ts` |
| `002-ritemark-ui-layout.patch` | 25 | 25 | 83 | 83 | — |
| `003-ritemark-menu-cleanup.patch` | 23 | 25 | 44 | 44 | out: `src/vs/workbench/browser/parts/titlebar/menubarControl.ts`; in: `src/vs/platform/windows/electron-main/windowsMainService.ts`; in: `src/vs/workbench/browser/parts/titlebar/menubar.contribution.ts`; in: `src/vs/workbench/contrib/chat/common/constants.ts` |
| `004-ritemark-build-system.patch` | 4 | 4 | 7 | 7 | — |
| `005-ritemark-windows-and-oss-fixes.patch` | 3 | 3 | 5 | 5 | — |
| `006-ritemark-dev-launch-fallback.patch` | 4 | 4 | 4 | 4 | — |
| `007-ritemark-vscode-1117-compat.patch` | 4 | 5 | 13 | 16 | out: `src/vs/workbench/contrib/chat/browser/chat.contribution.ts`; in: `src/vs/workbench/contrib/chat/browser/chat.shared.contribution.ts`; in: `src/vs/workbench/contrib/webviewPanel/browser/webviewEditor.ts` |
| `008-ritemark-windows-binary-strip.patch` | 1 | 1 | 1 | 1 | — |
| `009-ritemark-browser-context-bridge.patch` | 4 | 4 | 9 | 12 | — |
| `010-ritemark-browser-action-bridge.patch` | 4 | 7 | 12 | 18 | in: `src/vs/workbench/contrib/browserView/electron-browser/features/browserEditorChatFeatures.ts`; in: `src/vs/workbench/contrib/browserView/electron-browser/features/browserDevToolsFeature.ts`; in: `src/vs/workbench/contrib/browserView/electron-browser/features/browserWelcomeFeature.ts` |
| `011-ritemark-cloud-file-error.patch` | 1 | 1 | 1 | 1 | — |
| `012-ritemark-shell-watchdog.patch` | 1 | 1 | 5 | 5 | — |
| `013-ritemark-configuration-defaults.patch` | 2 | 2 | 3 | 3 | — |
| `014-ritemark-save-receipts.patch` | 7 | 7 | 16 | 16 | — |
| `015-ritemark-help-menu-policy.patch` | 6 | 6 | 16 | 18 | — |
| `016-ritemark-store-acquisition-policy.patch` | 1 | 1 | 1 | 1 | — |
| `018-ritemark-surfaces.patch` | 52 | 52 | 106 | 108 | — |
| `019-ritemark-tab-row.patch` | 19 | 19 | 53 | 53 | — |

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

