# Sprint 132 Technical Plan

The plan for [spec.md](spec.md). The research behind it is the release's [feasibility read](../feasibility.md), and the starting code is the proof of concept (branch `poc/2.0-surfaces`, local, at `b9dacaed`, not for release). Code shapes here are proposals: when the code needs something else, this file changes first.

## Architecture overview

| Layer | What changes | Where |
|---|---|---|
| Patch 002 (placement) | **Shrinks.** Its size lines leave: the tab height, the tree's row height and the places bar's 40 px injected CSS. Its terminal guards leave: 4 files go back to upstream, and `terminal.contribution.ts` keeps only its removal of the Toggle Terminal shortcut and View-menu entry. It gains the 2.0 order of the places and the layout toggle's 2.0 condition, in its own lines | `patches/vscode/002-ritemark-ui-layout.patch` |
| Patch 007 (Copilot Chat) | The launcher opens Copilot Chat as a tab and no longer moves Copilot Chat into the AI column | `patches/vscode/007-ritemark-vscode-1117-compat.patch` |
| Patch 018 (new: surfaces and frame) | The frame without a title row on the Mac and Windows; the strips, sheets and gaps; the AI column; the status bar and rows; the left column's head; You; Ritemark's menus; window sizes; the stylesheet | `patches/vscode/018-ritemark-surfaces.patch` |
| Patch 019 (new: editor groups and tab row) | The desks' gaps; the tab row (heights, widths, the +, folding); the rule for Home and Tasks; terminal tabs (the bar, the working dot, terminals kept on the desk) | `patches/vscode/019-ritemark-tab-row.patch` |
| Extension | Defaults; the seven surface colours; both themes; the product icon theme and file icons; the head's menus; the start-up terminal removed; the webviews' surfaces | `extensions/ritemark/` |
| Harness | The stacking check; the drift check; the CDP geometry and screenshot scripts; the docs | `scripts/`, `scripts/qa/`, `.claude/` |

A few files stay in two patches (for example `titlebarPart.ts`, `auxiliaryBarPart.ts` and `explorerviewlet.css` in 002 and 018), but no hunk sits on another patch's lines, apart from the stacked pairs that exist today (009 → 010, 001 → 016 → 017, 003 and 015 in `menubarControl.ts`). The release tier is **shell**: `patches/` and `extensions/ritemark/` files that ship only with the app.

No new webview ↔ host message type crosses a subsystem boundary. The head's menus reach the shell as an extension-contributed menu, a VS Code mechanism, not a Ritemark message.

## Workstream 1: The patch rebuild and fold (E1, E2)

**Starting tree.** VS Code 1.117.0 (`10c8e557`) with patches 001–017, from reset + clean + apply. For the sprint worktree, use the copy-on-write clone recipe (memory: `cow-clone-vscode-for-worktree-dev`).

**Patch 002, before and after.** First record 002's file list and count (31 files, 88 hunks), as `PATCH-RULES.md` §8 requires.

| File | Today in 002 | After |
|---|---|---|
| `browser/parts/editor/editorTabsControl.ts` | Tab height 40 (its only hunk) | Leaves 002; owned by 019 |
| `contrib/files/browser/views/explorerViewer.ts` | Row height 28 (its only hunk) | Leaves 002; owned by 018 |
| `contrib/files/browser/media/explorerviewlet.css` | Row height 28 + the tree's styling | The height lines go to 018's stylesheet; the styling stays |
| `browser/parts/paneCompositePart.ts` | `applyRitemarkTopTabStyles` (a 40 px bar in injected CSS); the AI column starts on the AI | The injected sizes go to 018's stylesheet; the AI default stays; 018 adds the places inset |
| `contrib/terminal/browser/terminalConfigurationService.ts` (+ its test), `terminalEditorSerializer.ts`, `terminalView.ts` | The terminal guards | **Removed from 002**; the files go back to upstream (W7) |
| `contrib/terminal/browser/terminal.contribution.ts` | The view container in the auxiliary bar; `hideIfEmpty: false`; the Toggle Terminal shortcut and View-menu entry removed | The location and `hideIfEmpty` lines go back to upstream; the removal of the shortcut and the menu entry **stays** (R8, revised) |
| `browser/parts/compositeBar.ts` | Tasks and Agent Library order, once, for profiles from before Tasks | Replaced by the 2.0 order, once per profile (W5, W12); always-in-More items |
| `api/browser/viewsExtensionPoint.ts` | Orders: Home −1, Tasks 0.5, Agent Library 1000 | The 2.0 orders: Home, Explorer, Tasks, Browser, Agents, Transcribe |
| `browser/actions/layoutActions.ts` | The layout toggles rewritten | The left toggle's `when` becomes false (the strip holds it) |
| `browser/parts/titlebar/titlebarPart.ts` | The accounts and global activity actions hidden | Unchanged in 002; 018's hunks are regenerated so that none touches these lines |

After this, 002 should have about 22 files. Its header lists what moved where.

**Patch 007.** `chatSetupContributions.ts`: the launcher runs `workbench.action.chat.openInEditor`, and `revealCopilotChatViewState` stops moving the chat container into the auxiliary bar. A container a v1.14.0 profile has there moves back (W4). 007 already fails on 1.119.0 in this file; nothing changes about that here.

**Patches 018 and 019** are built from the proof of concept's patch file by file, not copied:

- **018:**
  - `services/layout/browser/layoutService.ts`, `browser/parts/ritemarkFrameStrip.ts` (new);
  - `parts/sidebar/sidebarPart.ts`, `parts/sidebar/ritemarkProjectHead.ts` (new), `parts/auxiliarybar/auxiliaryBarPart.ts`;
  - `parts/editor/editorPart.ts`, `parts/titlebar/titlebarPart.ts`, `electron-browser/parts/titlebar/titlebarPart.ts`, `platform/windows/electron-main/windowImpl.ts`;
  - `parts/statusbar/statusbarPart.ts` + `media/statusbarpart.css`, `explorerViewer.ts`, the two notifications files;
  - `contrib/webview/browser/overlayWebview.ts`, `browser/style.ts` + `media/ritemarkSurfaces.css` (new);
  - `base/browser/ui/menu/menu.ts`, `platform/theme/browser/defaultStyles.ts`, `electron-browser/desktop.contribution.ts`;
  - `paneCompositePart.ts`, `services/actions/common/menusExtensionPoint.ts` (W8), `browser/parts/ritemarkWindowSizes.ts` (new, W11).
  - Not `paneCompositeBar.ts`: every proof-of-concept hunk there is one of the drops below, so 007's file is left alone.
- **019:**
  - `parts/editor/editorGroupView.ts`, `editorTabsControl.ts`, `multiEditorTabsControl.ts`;
  - `parts/editor/ritemarkNewTab.ts` (new), `parts/editor/ritemarkFoldedTabs.ts` (new);
  - `contrib/terminal/browser/terminalEditor.ts` + `ritemarkTerminalBar.ts` (new), `contrib/terminal/browser/ritemarkTerminalTabs.ts` (new, W7).

**Dropped from the proof of concept** (`feasibility.md` §6):
- `RITEMARK_REPIN_ONCE` and its `ritemark.places.repinned` key;
- the empty `RITEMARK_SECONDARY_PLACES` and the code that reads it;
- the title-row You menu with five items;
- `RITEMARK_PLACE_TABS` (main's #431 already opens the board from the extension);
- `ritemark.poc.addSampleProjects`, the sample project and `poc/run.sh`;
- the proof of concept's overrides of 002's terminal lines, because W7 removes them from 002;
- the committed `media/webview.js`.

**DOM walks out.** `editorGroupView.ts` finds the window's edges by climbing `parentElement` to `.monaco-split-view2`. It asks the editor part instead: `findGroup({ direction }, group)` returns no neighbour at an edge. `overlayWebview.ts` keeps `closest('.part.editor')`, which is one stable class.

**The stacking check.** `scripts/check-patch-stacking.mjs` (new, not shell-tier) does the comparison `feasibility.md` §2.2 used. For each hunk of each patch, it checks the hunk's removed and context lines against the lines earlier patches add to the same file. It fails on any pair that is not on its list of known pairs (009 → 010, 001 → 016, 001 → 017, 016 → 017, 003 ↔ 015). It runs as pre-commit Check 14, and it is fast (text only).

**Tests.** Covered under W13.

## Workstream 2: The frame on the Mac (R1, R3)

**No title row.**
- `layoutService.ts`: `RITEMARK_FRAME_WITHOUT_TITLE_ROW = isNative` (the Mac and Windows; W3 adds Windows). `shouldShowCustomTitleBar()` returns false for the main window; auxiliary windows keep VS Code's title bar.
- `RITEMARK_FRAME_STRIP_HEIGHT = 44` and `RITEMARK_FRAME_CENTRE_LINE = 26` live in one module.

**The strips.**
- `ritemarkFrameStrip.ts` draws a strip in a column: a drag region whose controls are `-webkit-app-region: no-drag`, and which work with the mouse, Enter and Space.
- `sidebarPart.ts` and `auxiliaryBarPart.ts` lay their content out below their strip.
- `editorPart.ts` adds the hidden columns' controls to the desk's strip when a column is hidden.

**The sheets and gaps.**
- `auxiliaryBarPart.ts` is given its full grid size, lays its content out 8 smaller (the Agent Sessions pattern), and keeps the full size for relayout.
- `editorPart.ts` ends the desk 8 above the status bar. `editorGroupView.ts` (019) steps a group in by 8 where it has a neighbour or touches the window's edge.
- `overlayWebview.ts` gives a webview on the desk the desk's corners.

**The traffic lights.**
- `electron-browser/titlebarPart.ts` calls `nativeHostService.updateWindowControls({ height: 52 })` once the lifecycle reaches Restored, and again at Eventually. That is the proof of concept's fix: macOS misplaces the lights for a tall strip while the window is not yet on screen.
- They are placed again on leaving full screen and on a zoom change.
- `windowImpl.ts`: `setSheetOffset(44)`.
- VS Code's macOS 26 sizes (`isTahoeOrNewer`, 32 against 28) go, so their imports go with them. VS Code's strict build fails on any unused import.

**Zoom (R3).** As `NativeTitlebarPart` does with `preventZoom`, the strips divide their height and centre line by `getZoomFactor(window)`. The traffic lights are placed with the scaled height, so the line holds while the documents zoom. *Audit first:* `research/zoom-audit.md` (Phase 1) settles whether CSS `zoom: 1 / factor` on the strip or a computed height is cleaner, and how the overlay webviews behave.

**The status bar and rows.** `StatusbarPart.HEIGHT = 24` with its CSS; `ExplorerDelegate.ITEM_HEIGHT = 32` with its CSS. The remote indicator and the problems counts are hidden through settings where VS Code has them, and otherwise in the stylesheet. Problems stays in the View menu.

## Workstream 3: The frame on Windows (R2)

*Audit first:* `research/windows-frame-audit.md` (Phase 1), a code read of the four points below. The first build from main proves them.

1. **No title row.** As in W2, for the main window. Electron's window controls overlay (WCO) stays on. Its height is set with `updateWindowControls({ height: 44, backgroundColor, foregroundColor })`, with the colours from the theme's ground.
2. **The menu button.**
   - The left strip hosts VS Code's `CustomMenubarControl` in compact mode, the path VS Code already uses when `window.menuBarVisibility` is `compact` (`menubar.ts`: `compactMode`).
   - Alt focus comes with it (`window.customMenuBarAltFocus`).
   - The menus are the menu bar's own: patch 003 already removes Selection, Go, Run and Terminal, and Windows has no Window menu, so File, Edit, View and Help remain. The drawing's File menu entries come from the existing menus; New tab and Switch project join in later steps.
   - File's last item stays VS Code's Exit, as drawn.
3. **The window buttons.** WCO draws them at the window's top right. The AI's strip, or the desk's when the AI is hidden, leaves their width free using the WCO CSS variables (`env(titlebar-area-x)` and `env(titlebar-area-width)`), so the tabs, the + and You stop before them. Snap layouts come from Windows itself on the WCO maximise button.
4. **Drag regions.** The strips are `app-region: drag`. A double-click on them maximises and restores, which Windows does for drag regions.

Shortcut words (Ctrl) come from VS Code's keybinding labels on Windows. The strings this sprint adds use those labels and never hard-code ⌘.

**Testing.** Each Windows round is a merge into main and a build from main (`build-windows.yml` with `source_commit`; the repository's visibility toggle is the Development manager's, per release practice). There are two rounds: after merge 1, and after merge 2 (Delivery plan, below).

## Workstream 4: The AI column (R4)

- `auxiliaryBarPart.ts` (018): `hasTitle: false`, no composite bar (`RITEMARK_AI_SIDE_ALONE`), and the strip, as in the proof of concept.
- **Keeping it the AI's.** A small contribution in 018 listens to `IViewDescriptorService.onDidChangeContainerLocation` and container registration. Any view container other than `workbench.view.extension.ritemark-ai` that lands in the auxiliary bar moves to the sidebar. This covers a person's drag, an extension's contribution and a v1.14.0 profile (R16). The terminal (W7) and Copilot Chat (patch 007) no longer go there in the first place.
- The webview follows its sheet; VS Code 1.117 already anchors it, and the proof of concept checked it.

## Workstream 5: The places row, More and Copilot Chat (R5, R6)

- **The row.**
  - `workbench.activityBar.location: "top"` is a default in the extension's `package.json`.
  - The order comes from `viewsExtensionPoint.ts` and `compositeBar.ts` (002): Home, Explorer, Tasks, Browser, Agent Library, Transcribe, then the rest in their own order.
  - The places are 32 × 32 with radius 6, and the inset is 14 (`RITEMARK_PLACES_INSET`, 018); the sizes and colours are in the stylesheet.
- **More.**
  - VS Code's overflow action, drawn as ⋯, opens Ritemark's menu (W9).
  - `compositeBar.ts` (002) gets a short list of always-in-More items. Today that is only the Copilot Chat launcher; the overflow treats them as not fitting.
  - *Audit:* the overflow keeps them in order after the places that do not fit.
- **Copilot Chat** (patch 007): the launcher's item runs `workbench.action.chat.openInEditor`. It shows only when Copilot Chat is installed, as today.
- **Tasks → board.** Main's [#431](https://github.com/ProductoryHQ/ritemark-native/pull/431) does this in the extension (`TasksViewProvider.ts`), so there is no shell hunk.

## Workstream 6: The tab row and the rule for Home and Tasks (R7, R9)

All of this is patch 019, from the proof of concept:

- **Heights.** `editorTabsControl.ts`: `EDITOR_TAB_HEIGHT.normal` becomes 44 (the strip, with tabs 36 within it). The tooltip uses `Verbosity.MEDIUM`.
- **Widths and folding.**
  - `multiEditorTabsControl.ts`: each tab is as wide as its name, from 120 to 200.
  - When the row is full, the tabs used longest ago fold; never Home, Tasks or the active editor.
  - The fold follows each group's width.
- **New files.**
  - `ritemarkNewTab.ts` is the + at the right end, outside the tabs container, whose children VS Code maps to tab indexes. Its menu offers Text (`ritemark.newDocument`), Table (`ritemark.newTable`), Web page (the browser's new tab command) and Terminal (`workbench.action.createTerminalEditor`).
  - `ritemarkFoldedTabs.ts` is "N ⌄" and its menu.
- **Menus closing.** Both menus close on a click outside, inside webviews too, using the proof of concept's window-blur and focus handling.
- **The rule for Home and Tasks.**
  - In `editorGroupView.ts`, `isRitemarkPermanent(editor)` is true for a sticky editor whose `viewType` is exactly `mainThreadWebview-ritemark.home` or `mainThreadWebview-ritemark.taskBoard`. The proof of concept used `endsWith`; the audit confirms the prefix.
  - The rule guards `doStickEditor`, the move across groups, `doMoveEditorInsideGroup`, `closeEditor` and `doGetEditorsToClose`/`doCloseAllEditors`.
  - Only the extension disposing the webview panel closes them.
- **Package defaults:**
  - `workbench.editor.pinnedTabSizing: "compact"`;
  - the tab sizing the proof of concept settled on, with min 120 and max 200;
  - `breadcrumbs.enabled: false`.

## Workstream 7: The terminal is a tab (R8)

- **The guards go (002).** Four files go back to upstream, and `terminal.contribution.ts` keeps one change:
  - the terminal view container registers in the panel, as upstream does, and hides when empty;
  - VS Code's Toggle Terminal shortcut and its View-menu entry stay removed, as 002 removes them today;
  - `terminal.integrated.defaultLocation` is honoured;
  - terminal editors restore as editors.
- **The default.** `terminal.integrated.defaultLocation: "editor"` in the extension's `package.json` (today `"view"`). Every `createTerminal` call then opens a tab: Claude Login, Install Git, Install Node.js, Install Codex and both Codex Repair entry points.
- **Never in the AI column, never in the panel.** `ritemarkTerminalTabs.ts` (019) is a workbench contribution. After restore, and whenever a terminal instance appears in the panel, it moves the instance to the editor area (`ITerminalService.moveToEditor`). This covers an extension that asks for the panel explicitly, and the terminals a v1.14.0 profile revives (R16).
- **Names.**
  - VS Code has no numbering variable for terminal titles; `${sequence}` is the name the process gives itself.
  - So `ritemarkTerminalTabs.ts` names a new terminal that has no name of its own "Terminal", then "Terminal 2" and so on, with `ITerminalInstance.rename()`, counting the terminal tabs open in the window.
  - Named terminals (Claude Login and the others) keep their names.
- **The bar.**
  - `ritemarkTerminalBar.ts` (019) sits above the terminal in `terminalEditor.ts`, the one hook in that file.
  - It shows Running while the terminal's `CommandDetection` capability reports a command between `onCommandStarted` and `onCommandFinished`.
  - Stop sends an interrupt (Ctrl+C) to the instance.
  - Without shell integration there is no Running chip, and the bar shows nothing.
- **The working dot.** `multiEditorTabsControl.ts` (019) adds a class to a terminal editor's tab while its command runs, and the stylesheet draws the chat rail's dot.
- **The shortcut (R8, revised).** The extension's `package.json` binds Ctrl+` (⌃` on the Mac; the key ``ctrl+` `` on both) to `workbench.action.createTerminalEditor`. The binding sits where VS Code's own Toggle Terminal binding was, so nothing else changes.
- **The start-up terminal goes.** `extension.ts:598-608` is removed, as the proof of concept's `b9dacaed` does.
- *Audit first:* `research/terminal-tabs-audit.md` (Phase 1) covers:
  - shell integration on zsh, bash and PowerShell (Mac and Windows), and what the bar shows without it;
  - the names surviving a restart;
  - how v1.14.0's persistent terminals revive (in the view, then moved), with a v1.14.0 profile.

## Workstream 8: The left column's head (R10)

- `ritemarkProjectHead.ts` (018), from the proof of concept, created by `sidebarPart.ts` when the Explorer is the active container. It shows:
  - the folder's name in full, with a chevron;
  - New and Search as rows;
  - Documents over the tree;
  - with the explorer's own title actions hidden.
- **Its menus come from the extension.**
  - `services/actions/common/menusExtensionPoint.ts` (018) exposes two menus extensions may contribute to: `ritemark/projectHead` and `ritemark/projectHead/new`.
  - The extension's `package.json` contributes their items: Open a folder, Reveal in Finder (VS Code's `revealFileInOS`, which says File Explorer on Windows), All commands, the folder tools, and every kind of new file Ritemark makes today.
  - An extension release can then change the words and entries.
- **Search** runs `workbench.view.search`.
- **`.ritemark` hidden:** `files.exclude: { "**/.ritemark": true }` is a `package.json` default.
- Step 3 adds the project's mark and Switch project through the same menus.

## Workstream 9: You and Ritemark's menus (R11, R12)

- **You** (`ritemarkFrameStrip.ts`) is an outline circle at the AI toggle's weight. Its menu holds Settings (`ritemark.aiSettings`) and Help (`workbench.action.openDocumentationUrl`; `product.json`'s `documentationUrl` is already `https://ritemark.app/en/support/`). Its ARIA role is button with `aria-haspopup="menu"`.
- **Ritemark's menus.**
  - `desktop.contribution.ts`: `window.menuStyle` defaults to `custom`. An extension's `configurationDefaults` cannot set an application-scoped setting, so it is set in the shell.
  - `menu.ts`: the sheet with radius 10, padding 6, rows 32 with radius 6.
  - `defaultStyles.ts`: the chosen row uses `menuSelectionBackground`/`Foreground`, set to the soft indigo in both themes.
  - The macOS menu bar stays native.

## Workstream 10: The theme pass (R13)

- **Themes.**
  - `themes/ritemark-light.json` and `ritemark-dark.json` are changed in place (there is no 1.x to keep): the ground, the AI's sheet and the desk, no lines between parts, and no indigo line on tabs.
  - The seven `ritemark.*` colours go in `package.json`, with Light, Dark and high-contrast values.
- **Icons.**
  - `producticons/ritemark-product-icon-theme.json`: the 50 Phosphor icons for the chrome.
  - `fileicons/`: a dark variant for each of the 12 file icons.
- **The stylesheet.** `ritemarkSurfaces.css` (018) from the proof of concept, cleaned: every colour from a theme variable, and `!important` only where VS Code's own rules force it. Each remaining one is marked with why, since each is a place an upstream change breaks silently.
- **Webviews.** `webview/src/index.css` and the AI sheet's components take the desk's colour from `--vscode-ritemark-desk`.
- **Surface by surface**, against the drawings, in both themes:

  | Surface | Drawing (`ritemark-dev/product/design/experience/`) |
  |---|---|
  | Markdown editor | `comparison/after-write.png` |
  | CSV | `comparison/after-sheet.png` |
  | PDF | `comparison/after-pdf.png` |
  | Word, PowerPoint | `comparison/after-word.png` |
  | Browser | `comparison/after-web.png` |
  | Task board | `experiences/tasks` |
  | Transcribe | `experiences/recording` |
  | Settings page | `experiences/settings` |
  | Notifications | `experiences/bell` |
  | Command palette, quick picks | `experiences/goto` |
  | Menus | `comparison/after-menus.png` |
  | Modal dialogs, Flows, Agent Library | Not drawn yet: they follow when the Experience lead sends them |

- **Contrast.** An extension unit test reads both themes and checks text on the ground and the fine print at 4.5:1.

## Workstream 11: Window sizes (R14)

`ritemarkWindowSizes.ts` (018) is a workbench contribution on the main window's layout:

- It watches the window's width (`ILayoutService.onDidLayoutMainContainer`) and acts when the width **crosses** 1400, 1200 or 960:
  - below 1400, the AI's part is set to 320;
  - below 1200, the sidebar is hidden;
  - below 960, the auxiliary bar is hidden too;
  - crossing back up restores what it changed.
- A column the person opens with its toggle is left alone until the next crossing.
- It never lets the document column go below 560 with one desk, which comes from the same widths.

## Workstream 12: Updating from v1.14.0 (R16)

| What a v1.14.0 profile has | What happens | Where |
|---|---|---|
| The Activity Bar order of v1.14 | The 2.0 order, once (storage key, for example `ritemark.places.order.v2`); after that the person's order is kept | 002 `compositeBar.ts` |
| A terminal in the AI column | Revived in the view and moved to the desk | W7 `ritemarkTerminalTabs.ts` |
| Copilot Chat in the AI column | Moved back by the AI column guard; reachable in More | W4, patch 007 |
| Another view in the AI column | Moved to the left column | W4 |
| Settings the person chose (theme, tab sizing, activity bar location) | Kept: explicit values beat `package.json` defaults | VS Code |

## Workstream 13: Tests, checks, docs and builds (E3–E6)

- **VS Code unit tests**, run with `./scripts/test.sh --grep` in the VS Code tree:
  - `parts/editor/test/browser/ritemarkPermanentTabs.test.ts` (019) for the rule;
  - a test for the terminal guard that moves panel terminals to the desk (019).
  - 002's changes to `terminalConfigurationService.test.ts` go back to upstream along with its guard.
- **Extension tests.** `package.json` carries the 2.0 defaults and the head's menus; both themes carry the surface colours; contrast (W10).
- **CDP geometry.** `scripts/qa/frame-geometry.mjs` (new) uses the `ritemark-automation` skill's CDP helpers on a dev instance (port and isolation rules: memory `dev-instance-cdp-isolation`; launched without focus). It measures:
  - the centre line;
  - the sheets' gaps and corners;
  - the 8 above the status bar;
  - rows;
  - tab widths and folding.
  It writes JSON into the sprint's `qa/` folder.
- **Screenshots.** `scripts/qa/frame-screenshots.mjs` (new) captures fixed scenes: a fresh profile; the sample project; light and dark; one desk and two; each column hidden; many tabs; a terminal tab; the + and ⋯ menus. The set approved at merge 2 is the baseline for the later steps and for `update-vscode.sh`'s checklist.
- **Drift.** `scripts/check-vscode-drift.sh <tag>` (new) makes a shallow, blob-less clone of that VS Code tag in a temporary folder. It dry-applies the stack in a temporary index and prints each patch's failing files, the method `feasibility.md` used. The results go into the release plan's risk register at each merge.
- **Docs.**
  - `references/layout-invariants.md`: the changed rows and the new rules, each with what enforces it.
  - `architecture.md`: the locked decision becomes "Layout invariants owned by patches 002 (placement) and 018/019 (geometry, tab row)", plus a short subsystem note on the frame.
  - `CLAUDE.md`: the patch table and count, 19.
  - `PATCH-RULES.md`: its patch table, which still lists six.
  - The `update-vscode.sh` checklist.
  - `AGENTS.md` follows through the harness sync.
- **Builds.**
  - After each merge: a production build from a clean-room worktree at the merged commit (`create-release-worktree.sh`, then `build-prod.sh`), as a build check only.
  - A Windows build from main.
  - All patches dry-apply and apply on the pin, and a second `apply-patches.sh` run is clean.

## Proof-of-concept map

| Proof-of-concept file | Workstream | Comes over as |
|---|---|---|
| `018-ritemark-surfaces-poc.patch`: frame, strips, sheets, status bar, rows, menus, stylesheet | 2, 4, 9, 10 | 018, rebuilt |
| The same patch: `editorGroupView.ts`, the tabs controls, `ritemarkNewTab.ts`, `ritemarkFoldedTabs.ts` | 6 | 019, rebuilt |
| The same patch: `ritemarkProjectHead.ts` | 8 | 018, with the menus from the extension |
| The same patch: `compositeBar.ts`, `paneCompositeBar.ts`, `layoutActions.ts` | 5, 12 | `compositeBar.ts` and `layoutActions.ts` into 002, as in W1's table; `paneCompositeBar.ts` not at all |
| The same patch: terminal lines (`b9dacaed`) | 7 | Not as overrides: 002's guards are removed instead |
| `extensions/ritemark/package.json` (colours, defaults) | 5, 6, 7, 8, 10 | Yes, plus `terminal.integrated.defaultLocation` and the head's menus |
| `themes/*.json`, `producticons/`, `fileicons/` | 10 | Yes, checked surface by surface |
| `webview/src` (index.css, AI sidebar, rail, headers, button, toolbars) | 10 | Yes, rebuilt from source; not the committed bundle |
| `extension.ts` (start-up terminal removed) | 7 | Yes |
| `views/HomePanel.ts`, `ProjectsViewProvider.ts`, `permanentTabs.ts`, `homeIcons.ts`, `media/home-*` | — | Step 3, not this sprint |
| `taskBoard/BoardStore.ts` fix (an unreadable task file no longer empties the board) | — | Not this sprint: a separate bug-fix PR to main |

## Delivery plan: two merges

A shell change can be seen on Windows only after it merges into main (`feasibility.md` §5), so the sprint merges twice.

1. **Merge 1, the frame.**
   - Contents: W1–W9 and W12, the unit tests, the CDP geometry checks, and the docs for invariants, architecture and the patch tables.
   - Then: a production build check at the merged commit, Windows round 1 from main, and the drift check.
2. **Merge 2, the theme and Windows.**
   - Contents: W10 and W11, the fixes from Windows round 1, the screenshot baseline, and the rest of the docs.
   - Then: a production build check, Windows round 2, and the drift check.

If the drawings for modal dialogs, Flows and the Agent Library come after merge 2 is ready, those three surfaces follow in a small third PR.

## Risks inside the sprint

| Risk | Retirement |
|---|---|
| The Windows menu button and window buttons behave differently from the code read | Audit first; Windows round 1 comes right after merge 1, before the theme pass |
| The traffic lights' placement depends on macOS timing | Placed after Restored and Eventually and on full screen changes; S5 on a fresh start, a restart and a full-screen exit |
| Moving 002's hunks breaks a 1.x layout contract that is still wanted | `PATCH-RULES.md` §8 counts and lists; S44 walks the inventory |
| The Running chip depends on shell integration | Audit first; without it the bar shows nothing rather than something wrong |
| The theme pass is large | Surface by surface against the drawings; merge 2 can leave the three undrawn surfaces to a third PR |
| A production build fails late (strict unused-import errors) | Compile-check the patched tree (`compile-check-ts-native`) before each merge; the build check right after |
