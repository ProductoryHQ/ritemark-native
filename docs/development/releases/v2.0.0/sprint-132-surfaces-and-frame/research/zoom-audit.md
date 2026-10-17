# Zoom audit (R3) — Sprint 132, Phase 1

Read-only audit of VS Code OSS 1.117.0 (Electron 39.8.7) with Ritemark patches 001–017, and of the
proof of concept's patch 018. Paths are relative to `vscode/src/vs/`. "Patch 018:N" is a line in
`ritemark-2.0-poc/patches/vscode/018-ritemark-surfaces-poc.patch`. Nothing here was run.

Two units matter. **Screen px** (points, DIP) is what a ruler on the screen measures; window buttons
live there. **CSS px** is what the page lays out in. Screen px = CSS px × f, where f = 1.2^zoomLevel
(`platform/window/common/window.ts:476-477`) and the level runs from −8 to +8
(`platform/window/electron-browser/window.ts:18-19, 26`), so f runs from 0.23 to 4.3.

## 1. How VS Code's title bar keeps its height through zoom

- The title bar's height is its `minimumHeight`, and `maximumHeight` is the same number
  (`workbench/browser/parts/titlebar/titlebarPart.ts:229-239`). On the Mac desktop it is 28, 32 on
  Tahoe, or 35 with the command center, divided by f when `preventZoom` is on
  (`workbench/electron-browser/parts/titlebar/titlebarPart.ts:36-43`).
- `preventZoom` is on only when f < 1 or the bar holds nothing zoomable (`titlebarPart.ts:856-869`).
  So VS Code lets its bar grow when you zoom in, and stops it shrinking when you zoom out.
  Ritemark needs both directions.
- It does two things together. In TS, the grid gets `value / f` CSS px, so the bar stays `value`
  screen px. In CSS, layout writes `--zoom-factor` on the bar and toggles `.counter-zoom`
  (`titlebarPart.ts:871-887`), which sets `zoom: calc(1.0 / var(--zoom-factor))` on the bar's content
  (`browser/parts/titlebar/media/titlebarpart.css:32-35`). Text, icons and gaps inside keep their
  screen size. Menus opened from it are zoomed back (`titlebarpart.css:262-265`), and the Windows
  buttons' width is `calc(138px / zoom)` (`titlebarpart.css:343-358`).
- Neither title bar file listens to zoom. A zoom changes the page's CSS size, the window fires
  `resize`, and that relayouts the workbench (`workbench/electron-browser/window.ts:145`).
  `applyZoom` sets the factor before it fires `onDidChangeZoomLevel`
  (`platform/window/electron-browser/window.ts:37-41`; `base/browser/browser.ts:20-42, 83-90`), so
  layout code reads the new f.
- The grid works in CSS px. `layout()` measures the page and lays the grid out
  (`workbench/browser/layout.ts:1699-1711`). The title bar Part is itself a grid view
  (`layout.ts:1599-1621`), and the split view reads its min and max live on every layout
  (`base/browser/ui/splitview/splitview.ts:251-255`). `layout.ts` also uses the bar's height for the
  container offset (`layout.ts:246-250`) and the minimum window size (`layout.ts:1383-1395`).
- **So yes:** a strip that must be 44 screen px is 44/f CSS px to the grid and to every part.

## 2. How the Mac traffic lights are placed

- The renderer calls `nativeHostService.updateWindowControls({ height })`, passed on by
  `platform/native/electron-main/nativeHostMainService.ts:396-399`. On the Mac the main process computes
  `offset = floor((height − button) / 2)` (button 14 on Tahoe, 16 before) and calls
  `setWindowButtonPosition({ x: offset + 1, y: offset })`, or `null` for an offset of 0
  (`platform/windows/electron-main/windowImpl.ts:447-459`). A height of 52 puts the centre at 26 on both.
- **The height is in screen px, and zoom does not move the lights.** VS Code multiplies its CSS height by
  f before sending it (`electron-browser/parts/titlebar/titlebarPart.ts:274-283`), and the main process
  uses no zoom at all. The sheet offset is in screen px too (`windowImpl.ts:185-189`), so dialogs hang
  from the same 44 at every zoom.
- **Does VS Code re-place them on zoom?** Only indirectly. The title bar sends `round(height × f)`
  whenever that number changes on layout (`titlebarPart.ts:271-284`). A counter-zoomed bar keeps the
  same number, so no call is made.
- The main process places them before the page loads, from the last height sent (one cache key for all
  windows) or 35 (`windowImpl.ts:191-199, 406, 417-420`). This runs on the Mac too, since
  `useWindowControlsOverlay` is true there (`platform/window/common/window.ts:298-315`). Auxiliary
  windows share the code and the key (`windowImpl.ts:147`; `platform/auxiliaryWindow/electron-main/auxiliaryWindow.ts:21`).
- **Full screen:** the main process tells the page (`windowImpl.ts:181-182, 846-852`;
  `workbench/electron-browser/window.ts:284-286`). The layout then shows or hides the title bar
  (`layout.ts:524-555`); the Mac hides it in full screen (`services/layout/browser/layoutService.ts:391-394`).
  The bar's next layout sends its new height, and that is what puts the lights back on leaving.
- **A trap:** a hidden title bar is still laid out, with height 0 (`splitview.ts:228-239, 281-290`;
  `base/browser/ui/grid/gridview.ts:898-930`). Its layout then sends `{ height: 0 }`, and the Mac branch
  computes a negative offset and passes it on (`windowImpl.ts:453-457`). In the proof of concept the
  title bar is always hidden, so this happens once at every start (section 5).

## 3. The two approaches for the strips

Where each strip lives (proof of concept):
- **Left column and AI:** a `.ritemark-frame-strip` appended to the sidebar or auxiliary bar Part. The
  Part's content is laid out below it (patch 018:2665, 1291; CSS 436-445).
- **Desk:** the tab row, `.tabs-and-actions-container` in each editor group's `.title`
  (`browser/parts/editor/editorGroupView.ts:211-215`). `EDITOR_TAB_HEIGHT` (`editorTabsControl.ts:102-105, 449-451`)
  feeds both the CSS variable `--editor-group-tab-height` (`:466-468`) and `computeHeight()`
  (`multiEditorTabsControl.ts:1778-1805`). Breadcrumbs go below it (`editorTitleControl.ts:201-227`), and
  the editor pane gets what is left (`editorGroupView.ts:2170-2187`). All of it is CSS px.
- **Desk, side column hidden:** extra strips appended to the editor Part (patch 018, `editorPart.ts`).
- None of them is a grid view. The grid only sizes the Parts and needs no change in either approach.
  Each Part subtracts its strip inside its own `layout()`.

**(a) CSS `zoom: calc(1 / f)` on each strip, plus a 44/f layout height in TS.** This is exactly what
VS Code does for its own title bar (section 1). Every number inside the strip stays in screen px:
44, 26, 36, the 8 above the tabs, the 84 after the traffic lights, the 116/124 of the desk's
hidden-column strip. Labels and icons in the strip keep their size, as in a browser's tab strip. TS
must still give the Parts and the editor group the CSS height: 44/f. The cost is that measuring code
inside a counter-zoomed row can mix units. VS Code multiplies a rect inside a CSS-zoomed element by
that element's zoom before it anchors a menu or hover (`base/browser/ui/contextview/contextview.ts:66-81`;
`platform/hover/browser/hoverWidget.ts:347-354`;
`services/contextmenu/electron-browser/contextmenuService.ts:140-144`; helper `base/browser/dom.ts:843-857`).
Places that mix units:
- the tab drag-over half, which compares `clientX` with a rect (`multiEditorTabsControl.ts:1274-1279`);
- wrapped tabs, which compare `offsetWidth` with the group's width (`multiEditorTabsControl.ts:1909-1944`);
- the proof of concept's More and + menus, which anchor at `{x, y}` taken from a rect and so skip
  VS Code's correction (patch 018:1925-1929, 2132-2136).

The non-wrapping tab layout only uses widths from inside the row (`multiEditorTabsControl.ts:2033-2088`).

**(b) Strip height 44/f in TS and CSS, content zooming.** The strip keeps its height, but its content
grows. At +3 (f = 1.73) a 28 button is 48 screen px, which does not fit a 44 strip. To hold the line,
every inner size must be divided by f by hand: the 36 tabs, the 8 margins, the 84 after the lights,
fonts, icons, fillets and close buttons. That is dozens of `calc(N / var(--f))` rules in
`ritemarkSurfaces.css`, plus TS for each measured size. Every new upstream tab rule would zoom again
without anyone noticing.

**Verdict:** (a) is cleaner and safer at an update. It follows a pattern upstream keeps working: CSS
zoom on the title bar, and menu and hover code that corrects for it. It keeps the drawing's numbers
as written. The new code is small and sits in Ritemark's own files, plus one line in
`computeHeight()`. One difference is new: VS Code mostly counter-zooms when zooming out. Ritemark also
counter-zooms when zooming in, and the tab row was never counter-zoomed upstream (see "Checked only at
runtime").

## 4. Overlay webviews

- An overlay webview is mounted at the workbench container (`contrib/webview/browser/overlayWebview.ts:107-115`).
  `layoutWebviewOverElement` hands the anchor to `OverlayLayoutElement` (`overlayWebview.ts:185-191`).
- In 1.117 `OverlayLayoutElement` uses CSS anchor positioning when the browser supports it:
  `position: fixed; top: anchor(top); width: anchor-size(width)` (`base/browser/overlayLayoutElement.ts:14, 62-70, 106-112`).
  The browser keeps the webview on its anchor, and no JS rect maths runs. Clipping is anchored the same
  way (`overlayLayoutElement.ts:138-163`). The `getBoundingClientRect` path is only a fallback (`:113-133`).
- The anchors sit below the strips, never inside them. For the AI sheet the anchor is the view's body and
  the clip is the nearest scrollable element (`contrib/webviewView/browser/webviewViewPane.ts:279-302`).
  For an editor webview, such as Ritemark's editor, the anchor is the pane's element and the clip is the
  editor Part (`contrib/webviewPanel/browser/webviewEditor.ts:186, 204-210`). So counter-zoomed strips
  do not move the webviews. **Rule:** put `zoom` on the strip or tab row only, never on a Part, group
  or `.title` that contains a webview anchor.
- There is no zoom code in `overlayWebview.ts` or `webviewElement.ts`. `pre/index.html:10` only turns
  off pinch zoom. The webview's content zooms because the page zoom applies to it.
- A related case is the integrated browser. It is a native view, placed from its container's rect × f
  (`contrib/browserView/electron-browser/browserEditor.ts:1030-1045`), with its own `--zoom-factor`
  (`:440, 631-635`). It lines up as long as its container is not inside a counter-zoomed element.

## 5. What the proof of concept does for zoom today, and where it breaks

- Nothing for the strips. Every size is in CSS px: the strip's 44 and the Part's padding (patch 018:436, 445),
  the 84 after the lights (:455), the tabs' 36 and 8 (:512-514), the desk's 124/116 (:540, 551), the
  layout offsets (:1291, 2665) and `EDITOR_TAB_HEIGHT.normal = 44` (:1634). So the strips zoom with
  the documents.
- The only zoom code is the title bar's `minimumHeight / f` (:2979). The main window's title bar is
  hidden, so that only affects auxiliary windows.
- The lights are placed at 52 screen px at Restored and Eventually (:3016-3019). Nothing places them
  again on full screen or zoom. They stay at 26, which is right, but the strip moves away from them:
  - +1: strip 52.8, line 31.2, 5 px below the lights. +2: strip 63.4, line 37.4.
  - −2: strip 30.6. The lights (18–34) hang 3 px into the places row. The toggle after the lights moves
    from 84 to 58 screen px and overlaps the green light (the lights end about 71 from the left).
  - The sheet offset is 44 screen px (:156), so dialogs no longer hang from the strip's edge.
- On startup the hidden title bar sends `{ height: 0 }` before Restored (section 2). That is a likely
  code-level cause of "macOS misplaces the lights while the window is not yet on screen". It is not
  proven. With a cached 52, a restart can show the lights right, then misplaced, then right again.

## 6. Restart

- The window is created at the saved zoom (`platform/windows/electron-main/windows.ts:151`). Cmd+= with
  `window.zoomPerWindow` on (the default) is reported to the main process
  (`workbench/electron-browser/window.ts:1098-1113`), saved with the window state
  (`windowImpl.ts:1432, 1444, 1541-1542`) and handed to the page (`windowImpl.ts:1282-1285`). With it
  off, Cmd+= writes `window.zoomLevel` (`electron-browser/actions/windowActions.ts:99-138`).
- The page applies the zoom before the Workbench exists (`electron-browser/desktop.main.ts:119-153`).
  The first layout comes later (`browser/workbench.ts:171-178`). So `getZoomFactor()` is right in the
  first layout, and a strip height computed there is right on first paint.
- The splash also applies the zoom (`code/electron-browser/workbench/workbench.ts:90-91`). Its title
  height is the last layout's, which is 0 with no title row (`contrib/splash/browser/partsSplash.ts:95`).
- The lights are placed before the first paint from the cache (`windowImpl.ts:191-199`). They are right
  only if the cache holds 52 and no 0 or auxiliary-window height follows.

## Recommendation

Use approach (a), VS Code's own title-bar pattern: CSS counter-zoom on each strip, and 44/f in TS layout.

1. **Constants** (the module that holds them; layoutService.ts in the plan): keep
   `RITEMARK_FRAME_STRIP_HEIGHT = 44` and `RITEMARK_FRAME_CENTRE_LINE = 26` in screen px. Add
   `ritemarkStripLayoutHeight(win) = RITEMARK_FRAME_STRIP_HEIGHT / getZoomFactor(win)` for layout code.
2. **Zoom variable** (`browser/parts/ritemarkFrameStrip.ts`): add `trackRitemarkZoom(element): IDisposable`.
   It writes `--ritemark-zoom-factor` from `getZoomFactor(getWindow(element))` and rewrites it on
   `onDidChangeZoomLevel` for that window. Use a Ritemark name, not VS Code's `--zoom-factor`, so the two
   never interact. Call it on the sidebar, AI and editor Parts; strips and tab rows inherit it.
   Always use `getWindow(element)`, never `mainWindow`: floating windows have their own zoom.
3. **CSS** (`ritemarkSurfaces.css`): one rule sets `zoom: calc(1 / var(--ritemark-zoom-factor, 1))` on
   `.ritemark-frame-strip` and on the desk's `.title > .tabs-and-actions-container`. Leave every
   number inside in screen px. Breadcrumbs stay outside the rule and keep zooming. The Part's
   `padding-top` becomes `calc(44px / var(--ritemark-zoom-factor, 1))`.
4. **Parts**: in `sidebarPart.ts` and `auxiliaryBarPart.ts` `layout()`, the strip is
   `ritemarkStripLayoutHeight(getWindow(this.element))`, not 44.
5. **Tab row** (`multiEditorTabsControl.ts`): in `computeHeight()`, the non-wrapping branch returns
   `this.tabHeight / getZoomFactor(getWindow(this.parent))` when the frame is on. Keep
   `EDITOR_TAB_HEIGHT.normal = 44`, because it also feeds the CSS variable inside the counter-zoomed row.
   Anchor the More and + menus to their button element, not to `{x, y}`, so `contextview.ts:66-81`
   corrects for the zoom. Keep tab wrapping off.
6. **Relayout**: rely on the `resize` that every zoom causes (`electron-browser/window.ts:145`), as
   VS Code's title bar does. Add an explicit relayout only if the runtime check finds a miss.
7. **Traffic lights** (`electron-browser/parts/titlebar/titlebarPart.ts`):
   - In `layout()` (`:271-284`), do not send the hidden title bar's height for a main window with the frame.
   - One function sends `{ height: RITEMARK_FRAME_CENTRE_LINE * 2 }` = 52. It is never divided by f.
   - Call it at Restored and Eventually (as the POC does) and on leaving full screen
     (`onDidChangeFullscreen`, `base/browser/browser.ts:46-47`). A zoom needs no call.
   - In `windowImpl.ts:191-199`, place a main window with the frame at 52 at creation, not from the
     shared cache.
   - Windows (Workstream 3) sends `{ height: 44 }`, also never scaled.
8. **Fix the technical plan** (Workstream 2): dividing by `getZoomFactor` is right for the layout
   height only; the centre line needs no division under CSS zoom. "The traffic lights are placed with
   the scaled height" is wrong: they take the unscaled 52.

## Checked only at runtime

1. The lights stay on the 26 line at zoom −3…+3 and ±8 with no re-placement, on Tahoe and earlier.
   Dialogs hang from 44 at every zoom.
2. Whether the hidden title bar's `{ height: 0 }` moves the lights at startup. This decides whether
   the guard in step 7 is the real fix for the POC's startup misplacement.
3. After leaving full screen, the lights come back to 26, with or without step 7's call.
4. The units inside a counter-zoomed row in Electron 39: tab drag-over left and right halves, the +
   and More menus, You's menu, and hovers on strip controls, at zoom ±2.
5. Drag regions at ±3: the empty strip drags, controls don't, a double-click follows the system setting.
6. Seams or a blurry hairline where the strip meets the desk or sheet when 44/f is fractional (e.g.
   +1: 36.67): the active tab's fillets and the cover under it, on 1× and 2× screens.
7. `CSS.supports('(top: anchor(top))')` is true. The AI sheet, Ritemark's editor and the integrated
   browser stay on their places after a zoom, and their content zooms.
8. Every zoom step relayouts the columns and the editor groups (step 6), floating windows included.
9. A restart at +2 and at −2 paints the line and the lights at 26 with no jump, with
   `zoomPerWindow` on and off. A floating window's title bar does not overwrite the cached 52.
10. On Windows the WCO buttons stay 44 high at every zoom, and snap layouts still show.
