# Frame audit: patches 018 and 019 on VS Code 1.142.0 (W2a)

Read-only audit, 19 October 2026, before the rebase. Pin: 1.117.0 (`10c8e557`). Target: 1.142.0 (`d956e8a6`). Patches as on main `3c8a7c30` (Steps 1–3 merged). Every upstream claim below names the file and line at the target unless it says otherwise.

## Conclusion

**D3: every mechanism of the frame can be carried to 1.142.0.** No step back to an older release is needed. Every upstream hook that 018 and 019 use still exists at the target:

- No title row: `shouldShowCustomTitleBar` is unchanged (`layoutService.ts:736`), with the same seven callers in `layout.ts` and two in `auxiliaryEditorPart.ts` as at the pin.
- The window controls: upstream's own `windowImpl.ts` still calls `setSheetOffset` (228), `setTitleBarOverlay` (519) and `setWindowButtonPosition` (528) on Electron 43.7.7 (`.npmrc` `target="43.7.7"`). The callers of `updateWindowControls` are the same as at the pin.
- The parts, the tab controls, the dialog, the menus, the splash and the lifecycle reasons are all still there (§1, §2).
- All 128 VS Code classes that `ritemarkSurfaces.css` names are still produced (§3).

**One condition: pin Modern UI off.** 1.142.0 adds the "Modern UI Update", `workbench.experimental.modernUI`, **default `true`** (`workbench.contribution.ts:834–838`, `experiment: { mode: 'auto' }`; Ritemark's `product.json` has no `tasConfig`, so the default stands). When on, it changes a frame number almost everywhere:

| What | Modern UI on | Classic (the frame's base) | Where |
|---|---|---|---|
| Gaps between parts | 4, plus a 1 px border per card | 0 (Ritemark draws its own 8) | `layoutService.ts:85` `FLOATING_PANEL_MARGIN = 4`; `paneCompositePart.ts` `getFloatingInset`; `editorPart.ts:1435` |
| Part title, header, footer | 32 | 35 | `part.ts:222` `AREA_HEIGHT_MODERN_UI = 32` |
| Editor tab row | 29 with the default "connected" tabs, else 32 | `normal` (019: 44) | `editorTabsControl.ts:112`, getter at 626–640 |
| Pinned compact tab | 28 | 38 | `multiEditorTabsControl.ts:103` |
| Notification row | 34 | 42 | `notificationsViewer.ts:45`, `modernUI.contribution.ts:204` |
| Pane header | 28 | 22 | `modernUI.contribution.ts:25` |
| Scrollbar | 8 | 10 | `modernUI.contribution.ts:22` |
| Status bar | 24 + 6 below | 24 (018) | `statusbarPart.ts:131`, 145 |
| Menus | frosted glass, scale motion | 018's sheet | `menu.ts` `getMenuWidgetCSS`; `frostedGlass.contribution.ts:82` needs `MODERN_UI` |

Every one of these branches is gated by `isFloatingPanelsEnabled()` (`layout.ts:635`, a plain read of the setting) or by the `.modern-ui*` / `.floating-panels` classes. A line scan of `floatingPanels.css` and the 16 stylesheets under `contrib/modernUI/browser/media/` found no top-level selector outside those classes. So the classic path is complete at 1.142.0, and the pin is: `"workbench.experimental.modernUI": false` in `branding/product.json` `configurationDefaults` (R6's "pinned back"). Without it, R6 and R7 fail in every scene.

**The re-cuts: six changed mechanisms** (details in §1, decisions in §5):

1. **Modern UI** (new upstream): pin it off, as above.
2. **A part's relayout** (`sidebarPart.ts`, `auxiliaryBarPart.ts`): `Part.relayout()` now asks `getRelayoutDimension()`, and `AbstractPaneCompositePart` answers with the size *it* was given. 018's trick of restoring the full size with `Part.prototype.layout.call(...)` no longer reaches the relayout, so each header or footer change would take the strip (and the sheet gap) off again. Override `getRelayoutDimension()` in both parts to return `this.dimension`, the full size that line restores.
3. **The first placement of the window controls** (`windowImpl.ts`): the gate is now `this.hasWindowControlOverlay` (set from the window's creation options), not the configuration. Put Ritemark's branch inside the new gate, and drop the import of `isTahoeOrNewer`, which 018's sheet-offset line leaves unused.
4. **Overlay webviews** (`overlayWebview.ts`): `layoutWebviewOverElement` is gone. Webviews now follow their anchor through CSS anchor positioning (`overlayLayoutElement.ts:57–62`). Move the `ritemark-desk-webview` toggle into `setAnchorElement`.
5. **The empty desk** (`editorGroupWatermark.ts`): the watermark now sits inside `.editor-group-watermark-wrapper`. The tiles land in the wrapper, and four selectors in `ritemarkSurfaces.css` (lines 216, 1684, 1696, 1704) no longer match. This is the selector audit's only miss.
6. **Pinned tabs' width** (`multiEditorTabsControl.ts`): the width is now a loop that also sets each pinned tab's `left`. Add `RITEMARK_TABS_INSET` after the loop, not before it.

Everything else is **moved lines**. Of 018's 24 rejected hunks, 21 are moved lines (import lines and shifted context); 3 sit on a changed mechanism (`windowImpl.ts`'s controls block, `sidebarPart.ts`'s layout, `overlayWebview.ts`'s method). Of 019's 10, 8 are moved lines; 2 sit on a changed mechanism (the watermark's render target, the pinned width). Two changes apply cleanly and still break: 018's layout hunk in `auxiliaryBarPart.ts` (re-cut 2) and the stylesheet's watermark selectors (re-cut 5).

**Upstream now offers**, not adopted in this sprint because the numbers or the drawing differ: Modern UI's floating cards and "connected" tabs (the desk and the chosen tab's fillets, at 4 and 28–32 instead of 8 and 44/36); `EditorInputCapabilities.CannotClose` (covers closing only); an add-tab `+` (`IEditorGroupMenuIds.tabsBarAddTab`); an empty group toolbar (`MenuId.EditorGroupWatermarkToolbar`). Two small ones fit as they are: `getMacOSWindowControlsPosition` (the same formula, already in effect) and the stable `.monaco-decoration-itemColor` marker class (an optional CSS swap).

**Blockers: none.** What reading cannot prove is listed in §7 for W7's screenshots and geometry.

## How this was measured

- Upstream's change per file: `git -C vscode diff 10c8e557 d956e8a6 -- <file>`, read hunk by hunk against each 018/019 hunk.
- Which hunks fail: a scratch tree in `$TMPDIR` with the target's copies of the 161 patched files; patches 001–016 applied with `--reject`, then 018, then 019. It reproduces `notes/drift.md` exactly: 24 of 018's 106 hunks and 10 of 019's 53 rejected. Nothing was applied to the worktree's `vscode/`.
- Selectors: every rule prelude of `ritemarkSurfaces.css` parsed (248 preludes, 202 distinct classes). Each class looked up in the tokens of `src/vs/**/*.{ts,css}` at both commits (tests and `src/vs/sessions` left out), and in the `+` lines of patches 001–019.
- Moved elements: for each upstream class the stylesheet uses, the pin→target `-U0` diff was searched for lines that add or remove it; each parent–child pair the stylesheet relies on (`a > b`, 67 pairs) was then checked against the code that builds the element.

## 1. Per file

Hunks are counted as in the patch; "rejected" is the scratch-tree result. Upstream +/− is from `notes/upstream-diff.md`.

### Patch 018 (39 modified files; the 13 files it creates are in §3 and §4)

| File | Hunks (rejected) | Upstream +/− | Class | What changed |
|---|---|---|---|---|
| `base/browser/ui/dialog/dialog.ts` | 3 (2) | +49 −4 | moved lines | `IDialogOptions` gained `detailElement` after `detail`. The first-focus loop gained `focusedButton` and a fallback to `footerActionToFocus`; set `focusedButton` where `value.index === focusIndex`. |
| `base/browser/ui/iconLabel/iconLabel.ts` | 4 (0) | 0 | unchanged | |
| `base/browser/ui/menu/menu.ts` | 1 (0) | +133 −7 | moved lines | 018 appends to `getMenuWidgetCSS`. Upstream added menu motion and frosted glass, scoped to `.modern-ui` / `.modern-ui-frosted-glass`, and draws the border with `--vscode-strokeThickness` (a registered size, `baseSizes.ts:116`). Upstream's own menus now track `mousemove`, not `mouseover`; Ritemark's menus are its own DOM. |
| `base/browser/ui/menu/menubar.ts` | 1 (0) | 0 | unchanged | |
| `platform/dialogs/common/dialogs.ts` | 1 (0) | +19 −117 | moved lines | `ICustomDialogOptions` gained `alignment` (default horizontal). |
| `platform/quickinput/browser/quickInputList.ts` | 2 (0) | +10 −3 | moved lines | |
| `platform/quickinput/browser/tree/quickInputDelegate.ts`, `quickInputTreeController.ts` | 1, 1 (0) | 0 | unchanged | |
| `platform/theme/browser/defaultStyles.ts` | 2 (1) | +2 −2 | moved lines | Only the import line (`buttonSecondaryBorder` added). `defaultMenuStyles` is unchanged. |
| `platform/window/common/window.ts` | 3 (2) | +99 −2 | moved lines; upstream offers the Mac helper | The import gained `isTahoeOrNewer`. `getMacOSWindowControlsPosition` (389–393) now sits where 018 puts its constants. `getWindowControlsStyle` is unchanged (that hunk applies). |
| `platform/windows/electron-main/windowImpl.ts` | 2 (2) | +110 −32 | **changed mechanism** | §1.1 |
| `platform/windows/electron-main/windowsStateHandler.ts` and its test | 3, 2 (0) | 0 | unchanged | |
| `workbench/api/browser/mainThreadMessageService.ts` | 1 (0) | +8 −4 | moved lines | |
| `workbench/browser/labels.ts` | 4 (0) | +7 −2 | moved lines | Upstream adds decoration marker classes and a `suffix` option. |
| `workbench/browser/layout.ts` | 3 (0) | +106 −16 | moved lines | The default-size lines are unchanged (3026–3028, 3125–3126). Modern UI classes are added to `getLayoutClasses` (1930–1944). |
| `workbench/browser/parts/auxiliarybar/auxiliaryBarPart.ts` | 6 (1) | +15 −2 | **changed mechanism** (in its base class) | §1.2. Only the import hunk is rejected; the layout hunk applies and then misbehaves. |
| `workbench/browser/parts/compositeBarActions.ts` | 4 (0) | 0 | unchanged | |
| `workbench/browser/parts/dialogs/dialogHandler.ts` | 1 (1) | +20 −6 | moved lines | `detail,` became `detail: typeof detail === 'string' ? …`, plus `detailElement` and `alignment`. |
| `workbench/browser/parts/editor/editorPart.ts` | 4 (2) | +162 −13 | moved lines (a Modern UI branch inserted) | §1.3 |
| `workbench/browser/parts/notifications/notificationsCenter.ts` | 1 (0) | +20 −7 | moved lines | |
| `workbench/browser/parts/notifications/notificationsToasts.ts` | 1 (0) | +54 −16 | moved lines | |
| `workbench/browser/parts/notifications/notificationsViewer.ts` | 3 (2) | +52 −13 | moved lines (a Modern UI branch) | `ROW_HEIGHT` is now a getter over `setNotificationRowHeight` (64): 42, or 34 under Modern UI. In `computePreferredHeight`, `hasProgress` became `hasActiveProgress`. |
| `workbench/browser/parts/paneCompositeBar.ts` | 1 (0) | +22 −19 | moved lines | Still relies on 007's `ICommandService`. |
| `workbench/browser/parts/paneCompositePart.ts` | 1 (0) | +98 −6 | moved lines (its own hunk) | `layoutCompositeBar` is unchanged. The class's `layout` changed: §1.2. |
| `workbench/browser/parts/sidebar/sidebarPart.ts` | 4 (2) | +16 −2 | **changed mechanism** (in its base class) | §1.2. Also: the imports, and `setBoundarySashes` inserted right after `layout`. |
| `workbench/browser/parts/statusbar/media/statusbarpart.css` | 2 (0) | +4 | moved lines | |
| `workbench/browser/parts/statusbar/statusbarPart.ts` | 1 (1) | +106 −7 | moved lines (a Modern UI branch) | `HEIGHT` is now followed by the floating paddings (131). Min and max height are getters, `HEIGHT + floatingBottomPadding` (145), 0 with Modern UI off. |
| `workbench/browser/parts/titlebar/titlebarPart.ts` | 4 (1) | +141 −49 | moved lines | `onConfigurationChanged` now starts with a Modern UI `updateStyles()`; the menu-bar blocks 018 guards are unchanged. 002's hunks in this file fail too: re-cut 002 first. |
| `workbench/browser/style.ts` | 1 (0) | 0 | unchanged | |
| `workbench/contrib/files/browser/fileCommands.ts` | 1 (0) | +67 −35 | moved lines | `IExplorerService.getContext` and `roots` are unchanged (`files.ts:24, 27`). |
| `workbench/contrib/files/browser/views/explorerViewer.ts` | 8 (0) | +1 | moved lines | `ExplorerDelegate.ITEM_HEIGHT` is still the row height (80–83). |
| `workbench/contrib/splash/browser/partsSplash.ts` | 1 (1) | +64 −5 | moved lines | §2 |
| `workbench/contrib/webview/browser/overlayWebview.ts` | 1 (1) | +58 −9 | **changed mechanism** | §1.4 |
| `workbench/electron-browser/desktop.contribution.ts` | 3 (1) | +7 −3 | moved lines | `window.menuStyle` and `window.dialogStyle` gained `agentsWindow: { default: 'custom' }`. The `product` import is still used only by `menuStyle`'s default (284), so 018 can still drop it. |
| `workbench/electron-browser/parts/titlebar/titlebarPart.ts` | 6 (2) | +10 −6 | moved lines | The constructors gained `IActionViewItemService`. `updateStyles` and `layout` are unchanged. |
| `workbench/services/actions/common/menusExtensionPoint.ts` | 1 (1) | +43 −17 | moved lines | `apiMenus` gained agents entries at its end. `IAPIMenu` and `MenuId.MenubarFileMenu` (`actions.ts:128`) are unchanged. |
| `workbench/services/host/electron-browser/nativeHostService.ts` | 2 (0) | 0 | unchanged | §2 |
| `workbench/services/layout/browser/layoutService.ts` | 2 (1) | +372 −3 | moved lines | Only the import line (`mainWindow` added). The +372 are Modern UI helpers. |

### Patch 019 (11 modified files)

| File | Hunks (rejected) | Upstream +/− | Class | What changed |
|---|---|---|---|---|
| `browser/parts/editor/editor.ts` | 1 (0) | +95 −53 | moved lines | `EditorPart.findGroup` is unchanged (`editorPart.ts:360`). |
| `browser/parts/editor/editorCommands.ts` | 2 (0) | +72 −21 | moved lines | |
| `browser/parts/editor/editorGroupView.ts` | 12 (3) | +98 −18 | moved lines; upstream offers `CannotClose` | §1.5 |
| `browser/parts/editor/editorGroupWatermark.ts` | 3 (2) | +20 −5 | **changed mechanism** | §1.6 |
| `browser/parts/editor/editorTabsControl.ts` | 2 (1) | +220 −12 | moved lines (a Modern UI branch) | §1.7 |
| `browser/parts/editor/multiEditorTabsControl.ts` | 12 (4) | +477 −74 | **changed mechanism** (pinned width); the rest moved lines | §1.8 |
| `browser/parts/editor/singleEditorTabsControl.ts` | 1 (0) | +38 −15 | moved lines | |
| `contrib/terminal/browser/terminalEditor.ts`, `terminalEditorInput.ts` | 5, 4 (0) | 0 | unchanged | |
| `contrib/terminal/browser/terminalInstance.ts` | 1 (0) | +140 −43 | moved lines | `_titleSource` and `_staticTitle` are unchanged (2207, 202). |
| `contrib/terminal/browser/terminalMenus.ts` | 2 (0) | +36 | moved lines | Upstream adds Start Dictation to the terminal's own context menus (not the tab's). For audit 2d. |

### 1.1 `windowImpl.ts`: the window controls' first placement

018 relies on: in `BaseWindow.setWin`, `win.setSheetOffset(…)` for the Mac, then a block that places the controls from a cached height, which 018 overrides for the main window (`this instanceof CodeWindow`) with `RITEMARK_FRAME_WINDOW_CONTROLS_HEIGHT` (52 on the Mac, 44 on Windows).

Upstream changed the gate of that block:

```ts
// 1.117.0
if (useCustomTitleStyle && useWindowControlsOverlay(this.configurationService)) {
// 1.142.0 (188, 232)
this.hasWindowControlOverlay = !!options?.titleBarOverlay;
if (this.hasWindowControlOverlay) {
```

For a main window the truth is the same. `defaultBrowserWindowOptions` still sets `titleBarOverlay` exactly when `useWindowControlsOverlay` holds (`windows.ts`: `true` on the Mac, `{ height: 29, … }` on Windows), and `CodeWindow` passes its options to `setWin` (800). Only the new `frameless` override clears it, and the main window does not use it. The Mac placement moved into `getMacOSWindowControlsPosition` (`window.ts:389–393`) with the same formula; for a 52 box it gives x 20, y 19 on Tahoe and x 19, y 18 before, as at the pin.

Re-cut: put Ritemark's `CodeWindow` branch inside `if (this.hasWindowControlOverlay)`, and append the `RITEMARK_*` names to the new import line (which no longer has `useWindowControlsOverlay`). After 018 replaces the sheet-offset line, `isTahoeOrNewer` has no other use in this file at the target (its only other caller moved into `window.ts`), so it must leave the import (PATCH-RULES §9). Keep the `instanceof CodeWindow` test: upstream's new `windowImpl.test.ts` (78–83) builds a `BaseWindow` subclass and expects `{ height: DEFAULT_CUSTOM_TITLEBAR_HEIGHT }`.

Also new: Windows' buttons are dimmed with 50 % black during a modal, not 30 % (`dimColor`). See §7.

### 1.2 `sidebarPart.ts` and `auxiliaryBarPart.ts`: a part's relayout

018 relies on: each part's `layout()` gives `super.layout()` a smaller box (the left column: minus the strip and the head's rows; the AI: minus the 8 gap and the strip), then calls `Part.prototype.layout.call(this, width, height, top, left)`, "so that a relayout starts from" the full grid size. At the pin, `Part.relayout()` re-ran `layout()` with `this.dimension`, which that call had restored.

Upstream changed `Part.relayout()` (`part.ts:163–179`) to ask a new hook, and `AbstractPaneCompositePart` answers it with the box its own `layout()` received:

```ts
// part.ts
const dimension = this.getRelayoutDimension();       // was: this.dimension
// paneCompositePart.ts:607, 664
this.floatingLayoutDimension = new Dimension(width, height);   // set on every layout, Modern UI or not
protected override getRelayoutDimension() { return this.floatingLayoutDimension ?? super.getRelayoutDimension(); }
```

That box is the one 018 already shrank. So a relayout (a header or footer added or removed: `part.ts` `setHeaderArea`, `removeHeaderArea`, `setFooterArea`, `removeFooterArea`) re-runs 018's `layout()` with the shrunk box, and the strip comes off a second time. This follows from reading the code; it is not yet seen on screen.

Re-cut: in both parts, override `getRelayoutDimension()` to return `this.dimension` (`part.ts:37`, public). That is the full size the existing `Part.prototype.layout.call(...)` line restores, so the relayout behaves as at the pin. Keep that line: it also restores the content position the relayout reads.

Also new in the base class, all off with Modern UI off: the floating inset subtracted before `super.layout` (612–619), `element.style.height` cleared to `''`, and `floating-part-outer-*` classes. The AI part also gained a responsive title toolbar (`getToolbarResponsiveBehavior`); its title is off (`hasTitle: false`), and `createTitleArea` still returns early for that (`paneCompositePart.ts:336–340`).

### 1.3 `editorPart.ts`: the desk's bottom gap

018 relies on: `layout()` passing `height - 8` to `super.layoutContents`. That call is unchanged (1469). Upstream inserted a Modern UI block between `this.left = left;` and it (1435–1466), which subtracts margins and a 1 px border on each side when Modern UI is on, and clears `element.style.height` when off. Re-cut: subtract the 8 in the same call, after the block. The import hunk is only the `contextkeys.js` line.

### 1.4 `overlayWebview.ts`: webviews over the desk and the AI's sheet

018 relies on: `layoutWebviewOverElement(anchorElement, dimension, clippingContainer)`, called on every layout, where it toggles `ritemark-desk-webview` (the Markdown editor, CSV, PDF and Word take the desk's rounded corners).

Upstream removed that method. The webview editor and view now call `setAnchorElement(anchor, clippingContainer)` (`webviewEditor.ts:210`, `webviewViewPane.ts:284`). The overlay follows its anchor in CSS, with no layout call (`overlayLayoutElement.ts:57–62`):

```ts
this.content.style.position = 'fixed';
this.content.style.top = 'anchor(top)';
this.content.style.left = 'anchor(left)';
this.content.style.width = 'anchor-size(width)';
```

`setAnchorElement` (`overlayWebview.ts:201–220`) already computes `anchorElement.closest('.part')` and keeps it under a `MutationObserver` for Modern UI's corner classes. Re-cut: toggle `ritemark-desk-webview` there, for example from that `part` (`part?.classList.contains('editor')`). Upstream now also marks the content `webview-overlay-content` and sets its `z-index` one above the nearest positioned ancestor with a z-index (`_updateZIndex`). See §7.

This is also where "overlay webviews following their sheets" stands: upstream now does it. The AI's sheet is moved in by CSS (`.part.auxiliarybar > .content { margin-left: 8px }`), and anchor positioning follows that box by itself.

### 1.5 `editorGroupView.ts`: desks and permanent tabs

Nine of twelve hunks apply. The three rejected ones:

- `doCloseAllEditors` (pin line 1969): upstream put its own filter on the same line (2018), `.filter(editor => options?.force || !editor.hasCapability(EditorInputCapabilities.CannotClose))`. Chain 019's `.filter(editor => !this.isRitemarkPermanent(editor))` after it.
- `layout` (pin 2171) and the new `ritemarkDeskGap` method after it (pin 2186): upstream added a right inset for docked content (`_contentRightInset`, 0 in the workbench window), `const contentWidth = …` (2236), `titleControl.layout(…, contentWidth)` and an inline `editorContainer.style.width`. 019's gap block goes before `contentWidth`; the widths come out the same as at the pin.

Upstream offers part of 019 here: `EditorInputCapabilities.CannotClose` (`common/editor.ts:883`) blocks closing unless `force` (`closeEditor` 1567, `closeEditors` 1906, `closeAllEditors` 2002, 2018), hides the tab's close button (`multiEditorTabsControl.ts:1735`) and the menus' Close (`ActiveEditorCannotCloseContext`). It does not cover unpinning, moving to another group or the tabs' order, which 019 also guards, and only Agents-window inputs set it. Not adopted now (§5).

The webview view type 019 matches (`mainThreadWebview-ritemark.home`) is still built the same way (`mainThreadWebviewPanels.ts:83`).

### 1.6 `editorGroupWatermark.ts`: the empty desk's tiles

019 relies on: `renderRitemarkEmptyDesk(elements.root, …)`, where `elements.root` was `.editor-group-watermark`; 018's stylesheet positions that element over the empty sheet.

Upstream wrapped it (101–111):

```ts
const elements = h('.editor-group-watermark-wrapper', [
	h('.editor-group-watermark-toolbar-container@toolbarContainer'),
	h('.editor-group-watermark', [ h('.watermark-container', [ … ]) ])
]);
```

`elements.root` is now the wrapper (`position: relative; width: 100%; height: 100%`, `editorgroupview.css:83–87`), and the constructor gained `IInstantiationService` as its last parameter. Upstream also added a toolbar for `MenuId.EditorGroupWatermarkToolbar`; only the Agents window contributes to it.

Re-cut: keep rendering into the wrapper (`elements.root`), and move the stylesheet's watermark rules onto the wrapper: hide it on every desk, show and position it on an empty desk, and hide `.editor-group-watermark` (the letterpress) and the toolbar container inside it. The four selectors are listed in §3. The constructor hunk is mechanical (`ritemarkActivateGroup` after `container`, `@ICommandService` after the new `@IInstantiationService`).

### 1.7 `editorTabsControl.ts`: the tab row's 44

019 relies on: `EDITOR_TAB_HEIGHT.normal`, which it sets to 44. Upstream added `modernUI: 32`, `modernUICompact: 28`, `connected: 28`, `connectedCompact: 24` after `compact` (106–116), and the `tabHeight` getter (626–640) now returns those when the title is inside `.modern-ui-tabs`. With Modern UI off it still returns `normal`. Re-cut: the same one-line change. The tooltip hunk (`Verbosity.MEDIUM`) applies.

### 1.8 `multiEditorTabsControl.ts`: folded tabs, the +, pinned tabs

Eight of twelve hunks apply. The rejected ones:

- The new fields (pin 107) and the end of `create()` (pin 190): upstream inserted `stickyTabsBackground`, `connectedTabOverflowEdge` and an optional add-tab control. Moved lines.
- `getHeight()` (pin 1798): the wrap condition gained a connected-tabs case (2002–2005). 019's `else` branch (`tabHeight / getZoomFactor(…)`) is unchanged. Moved lines.
- The pinned tabs' width (pin 2049): **changed mechanism.** At the pin it was `stickyCount * stickyTabWidth`, and 019 added the inset there. Now (2362–2372) it is a loop that also writes each pinned tab's `left`:

```ts
for (let tabIndex = 0; tabIndex < this.tabsModel.stickyCount; tabIndex++) {
	const tab = this.getTabAtIndex(tabIndex);
	if (tab) { tab.style.left = `${stickyTabsWidth}px`; }
	stickyTabsWidth += … stickyTabWidth;
}
```

Re-cut: add `RITEMARK_TABS_INSET` after the loop. Starting the sum at 8 would move Home and Tasks 8 to the right. With `pinnedTabSizing: compact` (the extension's default) and Modern UI off, `getStickyTabWidth` is 38 (`TAB_WIDTH.compact`), so the total stays 8 + 2 × 38 = 84, as at the pin.

Two facts 019's own code relies on still hold. The tabs container's children are the tabs: the add-tab control is created only when `menuIds.tabsBarAddTab` is set (289–293, "which tab layout logic relies on (see #324902)"), and the workbench's editor part sets no menu IDs. The new hidden elements went into the scrollable element, not the tabs container. Upstream also added three hidden children inside each tab (`.tab-fill`, `.tab-connected-edge`, `.tab-divider`, all `display: none` by default) before the existing ones; the stylesheet uses no child-order selector on a tab.

Upstream offers a `+`: `createAddTabControl` (`editorTabsControl.ts`) puts a menu-driven dropdown inside the tabs container. Ritemark's + has a two-line menu and sits outside the container, after "N ⌄". Not adopted.

### 1.9 The title row and the window controls (`window.ts`, `layoutService.ts`, both `titlebarPart.ts`)

- **Deciding there is no title row:** unchanged. `shouldShowCustomTitleBar`'s body and callers are the same; `hasCustomTitlebar`, `getTitleBarStyle` and `TitleBarSetting` are unchanged. The two rejected `layoutService.ts`/`window.ts` hunks are import lines and a moved constants block.
- **Windows' buttons:** unchanged in the renderer. `NativeTitlebarPart.updateStyles` and `layout` still send `updateWindowControls` under `useWindowControlsOverlay`; the main process still turns a height into `setTitleBarOverlay({ height: height - 1 })` (519–523). The title bar's own window-controls width on Windows is still 138 (`titlebarpart.css:350–358`).
- **The traffic lights:** see §1.1. Upstream's new `horizontalInset` parameter is used only by the Agents window's title bar (`sessions/electron-browser/parts/titlebarPart.ts:197`).
- **Upstream offers no hidden title row.** The only new title-bar settings are Modern UI's (`window.density.layout`, `IDensitySettings.layout`), and they act on the Agents window's title bar. The Agents window has its own frameless design in `src/vs/sessions`, not reusable for the workbench window.

## 2. Sprint 134's lean points

From `scripts/update-vscode.sh`'s printed checklist (item 6).

| Lean point | At 1.142.0 | Evidence |
|---|---|---|
| `partsSplash.ts` `_savePartsSplash` still saves the splash | **Holds** | Same method (72) and same triggers: idle after a layout, a theme or full-screen change (53–56), and shutdown (63). It still saves `colorInfo.background` and `editorBackground`, which the main process uses for the window's background (`themeMainServiceImpl.ts:230, 332`). The theme now comes from `getBaseColorTheme()` (73: the theme without window-local overlays); `ritemark.ground` resolves from it the same way. New: Modern UI part bounds, saved only when Modern UI is on. The rejected hunk is moved lines. |
| `nativeHostService.ts` `doOpenWindow` still opens a folder in this window | **Holds** | The file is identical upstream. 018's two hunks apply. |
| `lifecycle.ts` `ShutdownReason`: `LOAD` = another folder in this window; `RELOAD`, `QUIT`, `CLOSE` as named | **Holds** | `common/lifecycle.ts`, `common/lifecycleService.ts` and `electron-browser/lifecycleService.ts` are identical upstream. The main process still unloads with `UnloadReason.LOAD` before opening another folder in a ready window (`windowsMainService.ts:1679`) and with `RELOAD` for Reload Window (`lifecycleMainService.ts:511`). `lifecycleMainService.ts` changed only how it removes its one-time IPC listeners. |

The checklist's other two items: `commandsQuickAccess.ts` (003) is identical upstream; `explorerViewer.ts`'s `FilesFilter` and `getAriaLabel` hunks apply (upstream +1 line elsewhere).

## 3. The selector audit

`ritemarkSurfaces.css` (created by 018; its content is the `+` lines) has 248 rule preludes and 202 distinct classes.

| | Count | At 1.142.0 | At 1.117.0 |
|---|---|---|---|
| VS Code's classes | 128 | all produced | all produced |
| Codicon classes built at run time (`codicon-${id}`) | 2 | both ids registered | both registered |
| Ritemark's own classes | 72 | never upstream | never upstream |

- **No class is missing at the target, and none is gone since 1.117.0.** The two codicon classes are made from ids: `layout-sidebar-right` (`codiconsLibrary.ts:505`) and `panel-right` (`registerIcon` in `layoutActions.ts:44`), at both commits.
- **Ritemark's own 72** come from 018's and 019's created files and hunks: the `ritemark-*` classes, `on-desk` (`ritemarkFrameStrip.ts`) and `label-extension` (018's `iconLabel.ts` hunk).
- **Moved: one element.** `.editor-group-watermark` is now a child of `.editor-group-watermark-wrapper`, not of `.editor-group-container` (§1.6). These selectors no longer match:

| Line | Selector | Its job |
|---|---|---|
| 216 | `… .editor-group-container > .editor-group-watermark` | hide the letterpress on every desk |
| 1684 | `… .editor-group-container.empty > .editor-group-watermark` | show and place the tiles on an empty desk |
| 1696 | `… .editor-group-container > .editor-group-watermark > .watermark-container` | hide the letterpress inside |
| 1704 | `.ritemark-welcome-alone … .editor-group-container.empty > .editor-group-watermark` | hide the tiles while the welcome is alone |

  Unfixed, an empty group shows VS Code's letterpress again, and the tiles sit unplaced in the wrapper.

- **The other 66 parent–child pairs hold.** Checked against the code that builds them: the tab's children (`multiEditorTabsControl.ts` `createTab`: the three new hidden elements come first, the rest in the same order), the title area (`compositePart.ts:404–445`), the dialog (`dialog.ts:144, 179–184, 253`, same order as at the pin), the toasts and the centre (`notificationsToasts.ts:256–282`, `notificationsCenter.ts:208, 307`), the tab row (`.title > .tabs-and-actions-container > .monaco-scrollable-element`, `> .editor-actions`), `.editor-group-container > .title` / `> .editor-container`, and the status bar entries `#status.host` (`remoteIndicator.ts:579`) and `#status.problems` (`markers.contribution.ts:583`).
- **New siblings in the tab row**, both empty in the workbench window: `.editor-actions-separator` and `.editor-layout-actions` after `.editor-actions` (`MenuId.EditorTitleLayout`, contributed only by the Agents window).
- **Upstream offers a cheaper selector.** `[class*="monaco-decoration-itemColor-"]` (lines 1782, 1788, 1789) still matches. Upstream now sets a stable marker, `.monaco-decoration-itemColor` (`decorations.ts:24`, set in `labels.ts`), and its comment asks for it instead of substring matches. Optional swap, same result.

## 4. The DOM reads

Every place in 018 and 019 (created files and hunks) that queries the DOM or walks it, outside the tests:

| Where | Read | At 1.142.0 |
|---|---|---|
| `sidebarPart.ts` (018) | `parent.querySelector(':scope > .composite.title')` | Holds: `compositePart.ts:411–412` |
| `ritemarkProjectHead.ts` | `titleArea.querySelector(':scope > .title-label')`; `titleArea.after(rows)`; `titleArea.offsetHeight` | Holds: `compositePart.ts:443`. The title is 35 high with Modern UI off (32 with it on). |
| `overlayWebview.ts` (018) | `anchorElement.closest('.part.editor')` | The read holds (the webview editor's anchor is inside `.part.editor`), but its host method is gone: re-cut 4. |
| `notificationsViewer.ts` (018) | `offsetHelper.closest('.notification-toast')` | Holds: the helper is in the list container (`notificationsList.ts:86, 94`) inside the toast (`notificationsToasts.ts:277–282`). |
| `ritemarkMenu.ts` | `target.closest('.context-view')`; its own rows | Holds: `contextview.ts:331` `className = 'context-view monaco-component'`. Menu motion there is gated by `.modern-ui`. |
| `ritemarkFrameMenu.ts` | `host.parentElement === slot`; `CustomMenubarControl.create`, `layout`, `onFocusStateChange` | Holds: `menubarControl.ts:325, 760, 772, 783` |
| `multiEditorTabsControl.ts` (019) | `Array.from(tabsContainer.children)` as the tabs; `tabsScrollbar.getDomNode().clientWidth` | Holds (§1.8). The scrollable element also holds `.sticky-tabs-background`, an empty block with an inline width, styled only under Modern UI. |
| `ritemarkFoldedTabs.ts` | `tab.querySelector(':scope > .ritemark-tab-count')` | Ritemark's own element |
| `ritemarkNewTab.ts` | `document.querySelector('.part.editor .editor-group-container.active .ritemark-new-tab')` | Holds: `editor-group-container` and `active` are still set (`editorGroupView.ts:196, 975`). Main window only, as before. |
| `editorGroupWatermark.ts` (019) | renders into `elements.root` | **Changed:** the root is now the wrapper (§1.6). |
| `ritemarkTerminalBar.ts` | `container.prepend(bar)`; CSS `.ritemark-terminal-bar + .terminal-overflow-guard` | Holds: `terminalEditor.ts` is identical upstream. |
| electron `titlebarPart.ts` (018) | `element.style.backgroundColor` / `color` | Holds |

## 5. Decision table

| Mechanism | Decision | Reason |
|---|---|---|
| Modern UI (`workbench.experimental.modernUI`, default on) | **Carry the classic frame; pin the setting off** in `branding/product.json` `configurationDefaults` | Its numbers differ from the frame's at every surface (see Conclusion). The classic path is complete at 1.142.0. |
| A part's relayout (`getRelayoutDimension`) | **Re-cut** in `sidebarPart.ts` and `auxiliaryBarPart.ts`: return `this.dimension` | Upstream's hook is now the only way to make a relayout start from the full size. |
| The controls' first placement (`hasWindowControlOverlay`) | **Re-cut** in `windowImpl.ts`; drop `isTahoeOrNewer` from the import | Same truth for the main window; the Ritemark branch keeps its 52/44. |
| The Mac's button position (`getMacOSWindowControlsPosition`) | **Carry** (already in effect) | Same formula; 018 passes only the height. |
| Overlay webviews (`setAnchorElement`, CSS anchor positioning) | **Re-cut** the class toggle into `setAnchorElement`; **upstream now does** the following | The old method is gone; the browser keeps the overlay on its anchor. |
| The watermark wrapper | **Re-cut** the render target's CSS and the constructor | The tiles must be placed in the new wrapper. |
| Pinned tabs' width loop | **Re-cut**: the inset after the loop | Keeps Home and Tasks at `left` 0 and 38, and the total at 84. |
| `EditorInputCapabilities.CannotClose` | **Carry** 019's guard; consider later | Covers closing only (019 also guards unpin, move, order); using it needs a new hook so the extension's webview inputs report it. |
| Upstream's add-tab `+` (`tabsBarAddTab`) | **Carry** Ritemark's + | Upstream's is a one-line dropdown inside the tabs container; Ritemark's menu is drawn, and "N ⌄" sits before it. |
| Empty group toolbar (`EditorGroupWatermarkToolbar`) | **Carry** the tiles | A row of icon buttons, not tiles. |
| `.monaco-decoration-itemColor` marker | **Adopt** (optional) | Same labels, no substring match. |
| Everything else in §1 | **Carry**, moved lines | The hooked code is unchanged. Re-cut 002 first in the files it shares with 018 (`titlebarPart.ts`, `auxiliaryBarPart.ts`, `paneCompositePart.ts`). |

## 6. D3 assessment

Every mechanism of the frame can be carried to 1.142.0, on the one condition that Modern UI is pinned off. No mechanism 018 or 019 hooks into was removed upstream: the six changed ones each have a direct replacement at the target (§5), and the rest moved. So D3's fallback (stepping back to an older release) is not needed, and no older release was examined.

For later bumps: Modern UI is an experiment that already defaults to on. If upstream removes the classic path (the `isFloatingPanelsEnabled()` false branch in `paneCompositePart.ts`, `editorPart.ts`, `part.ts`, `statusbarPart.ts` and `editorTabsControl.ts`), D3 returns. Worth a line in `update-vscode.sh`'s checklist: check that those branches still exist.

## 7. What reading cannot prove (for W7)

1. **The pin takes effect at first paint.** On a fresh profile, `.monaco-workbench` must not carry `modern-ui`, `floating-panels` or `modern-ui-tabs`. If it does, the `product.json` default is applied too late; set the registered default instead (one line in `workbench.contribution.ts`, in 018).
2. **Webviews on anchor positioning.** The AI's webview on its sheet (8 in by CSS), the Markdown editor's corners, at zoom in and out, while a column is resized, and in a floating window. Check stacking too: the overlay now takes `z-index` one above its nearest positioned ancestor; the desk's strip has `z-index: 10`, the tab row 2.
3. **The empty desk** after the watermark re-cut: tiles under the tab row, no letterpress, no toolbar.
4. **The left column after a relayout.** Change the places row's position or a footer, open Documents' head rows, and check that the tree keeps its height (re-cut 2). The same for the AI's sheet.
5. **Windows:** the window buttons during a dialog (now 50 % black, next to Ritemark's 18 % scrim), and their place on the AI's or the desk's strip.
6. **Dialogs:** secondary buttons now take `button.secondaryBorder` (`defaultStyles.ts`), which the Ritemark themes may not set.
7. **The Agents window,** if it stays reachable (audit 2d): it is a `CodeWindow`, so 018's main-process branch would place its controls at 52 too.
8. **`tsgo` type-check:** 018's and 019's re-cut imports, starting with `windowImpl.ts`'s `isTahoeOrNewer`.
