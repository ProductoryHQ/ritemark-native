# Windows frame audit (R2, Workstream 3)

Sprint 132, Phase 1. A code read of VS Code 1.117.0 with patches 001–017, Electron 39.8.7
(`vscode/.npmrc`), and the proof of concept's patch 018. Nothing here was run on Windows.

Paths are relative to `vscode/src/vs/`. "018:N" means line N of the proof of concept's
`patches/vscode/018-ritemark-surfaces-poc.patch`.

## Short answer

All four points can be built from parts VS Code already has. Three things in the plan need to change:
- The menu should not use VS Code's compact setting (see 2).
- The proof of concept's call that places the traffic lights would make the Windows buttons 51 high (see 1).
- Several tab-row rules in the proof of concept only apply on the Mac (see 4).

## 1. No title row for the main window

**How VS Code decides today.**
- The title style is `custom` on every system unless a person sets `native` (`platform/window/common/window.ts:256-280`). So `hasNativeTitlebar()` is false on Windows (`window.ts:248-254`).
- With a custom style, the window controls overlay (WCO) is on. Only `window.controlsStyle: custom|hidden` turns it off (`window.ts:282-294`, `298-315`).
- The window is then made with `frame: false`, `titleBarStyle: 'hidden'` and `titleBarOverlay` 29 high in a guessed colour (`platform/windows/electron-main/windows.ts:210-233`).
- `shouldShowCustomTitleBar()` returns true on Windows in every case outside full screen: when the row has content (`services/layout/browser/layoutService.ts:382-384`), for any native window (`396-399`), and whenever WCO is on (`401-404`, "if WCO is visible, we have to show the title bar").
- The grid shows or hides the part from that answer (`browser/layout.ts:1325-1328`, `2598-2600`).

**What happens to WCO if the title bar part is hidden.** The overlay keeps drawing:
- Electron owns it. It is created with the window (`windows.ts:217-233`) and only ever restyled, never removed.
- Nothing in the renderer turns it off when the title bar part hides.
- VS Code's own rule (`layoutService.ts:401-404`) exists precisely so that content never sits under the buttons. With no title row, Ritemark's strips take over that job.

**Who calls `updateWindowControls`, with what.**
- Path: `platform/native/common/native.ts:158` → `platform/native/electron-main/nativeHostMainService.ts:396-399` → `platform/windows/electron-main/windowImpl.ts:411-447`. On Windows the last step is `win.setTitleBarOverlay({ color, symbolColor, height: height - 1 })` (`windowImpl.ts:440-444`).
- The `- 1` leaves room for the window's border, so passing 44 gives buttons that fill a 44 strip. This is VS Code's own convention with its 35 title bar.
- At window creation the main process uses the cached height, or 35 (`windowImpl.ts:191-198`).
  - The cache is one value for the whole app. Auxiliary windows write 35 into it too (`windowImpl.ts:416-419`).
- The title bar part sends its colours on every `updateStyles()` (`workbench/electron-browser/parts/titlebar/titlebarPart.ts:250-269`).
  - That runs on theme change and on window focus and blur (`browser/parts/titlebar/titlebarPart.ts:336-353`), even while the part is hidden. The part is always created (`browser/workbench.ts:347`).
  - It also never stores `cachedWindowControlStyles`, so it sends every time (`electron-browser/.../titlebarPart.ts:256-266`).
- The title bar part sends its height from `layout()` as height × zoom (`electron-browser/.../titlebarPart.ts:271-284`).
  - A hidden grid view is laid out with size 0 (`base/browser/ui/splitview/splitview.ts:236-239`, `281-285`), so it sends height 0.
  - `windowImpl` ignores 0 (`windowImpl.ts:417`, `443`). The overlay stays at its startup height until someone sends 44.
- Dialogs and the modal editor dim the buttons (`services/host/electron-browser/nativeHostService.ts:176-178`, `browser/parts/dialogs/dialog.ts:43`).

**Can it be called with 44 and the ground colour?** Yes:
- Any renderer code with `INativeHostService` can call `updateWindowControls({ targetWindowId, height: 44, backgroundColor, foregroundColor })`.
- The colour is any CSS colour (`vscode/node_modules/electron/electron.d.ts:22689-22703`).
- Send it opaque, as VS Code does (`browser/parts/titlebar/titlebarPart.ts:784-790`).
- The catch: the hidden title bar part sends its own `titleBar.*` colours on every focus change. If Ritemark sends the ground from somewhere else, the two race. There must be one sender.

**Proof of concept on Windows.** It sends `height: RITEMARK_FRAME_CENTRE_LINE * 2` = 52 (018:3016). That is right for the Mac's traffic lights. On Windows it would make the buttons 51 high, hanging 7 below the strip.

## 2. The compact menu button

**Hosting outside the title bar works.** VS Code already does it:
- `ActivityBarCompositeBar` makes a `.menubar` div, then calls `instantiationService.createInstance(CustomMenubarControl)` and `create(div)` (`browser/parts/activitybar/activitybarPart.ts:330-344`).
- All the constructor's services are ordinary workbench services (`browser/parts/titlebar/menubarControl.ts:452-467`).

**What a host needs:**
- `create(parent)` (`menubarControl.ts:876-885`).
- `layout(dim)`, which only re-runs `menubar.update()` (`887-889`). `update()` re-measures on the next frame (`base/browser/ui/menu/menubar.ts:613-639`). Call it after `create` and whenever the slot changes.
- `onFocusStateChange` (`864-866`). The title bar uses it to switch its drag region off while the menu has focus (see 4).
- `toggleFocus()` (`891-893`).
- ARIA comes built in:
  - `role="menubar"` on the container (`menubar.ts:96`).
  - The button is `role="menuitem"` with `aria-haspopup` (`menubar.ts:318`).
  - Mnemonics get `aria-keyshortcuts` (`menubar.ts:606`).

**How compact mode works, and why not to use it here.**
- `compactMode` exists only when the setting `window.menuBarVisibility` is `compact` (`platform/window/common/window.ts:178-186`, `menubarControl.ts:583-597`).
- In that mode:
  - All menus fold into one "Application Menu" button (`menubar.ts:317-318`, `522-535`).
  - It opens beside the button, top-aligned, as a fly-out for a vertical activity bar (`menubar.ts:1016-1030`). In a 44 strip, the fly-out covers the strip.
  - Setting `compact` also makes every `ActivityBarCompositeBar` install its own menu (`activitybarPart.ts:383-388`). That includes the left column's places row, which uses that class when the bar is on top (`browser/parts/sidebar/sidebarPart.ts:192-194`). The result is a second menu button and a second Alt listener.
- View → Appearance → Menu Bar flips the setting between `classic` and `compact` (`browser/actions/layoutActions.ts:793-812`, `browser/layout.ts:2310-2324`).
- The better fit is VS Code's narrow-window case:
  - A non-compact `MenuBar` in a container too narrow for "File" shows only its overflow button. It opens downward under the button, with File, Edit, View and Help as submenus (`menubar.ts:511-519`, `536-563`, `1023`, `1032`).

**Alt focus does not depend on the title bar.**
- `MenuBar` listens to the global `ModifierKeyEmitter` (`menubar.ts:118`). That emitter listens on every window (`base/browser/dom.ts:1811-1841`).
- A clean Alt press and release focuses the first visible menu, or the overflow button when none shows (`menubar.ts:949-958`). Down or Enter opens it (`329-331`). The arrow keys move through it, and Alt+F opens File inside the overflow (`menubar.ts:183-198`, `1051-1052`).
- Off when `window.customMenuBarAltFocus` is false (`menubarControl.ts:540-549`, `menubar.ts:888-900`) or the menu bar is `hidden` (`menubar.ts:930-932`).
- Keys typed inside webviews are forwarded to the window (`workbench/contrib/webview/browser/webviewElement.ts:238-246`, `700-708`). So Alt works from the editor and the AI too.
- Each `MenuBar` instance reacts to Alt. Two instances would both try to take focus, so exactly one may exist.
  - In `classic` mode the hidden title bar still installs one (`browser/parts/titlebar/titlebarPart.ts:476-483`).

**Menus on Windows after 003 and 015.**
- File, Edit, View and Help (`menubarControl.ts:91-133`).
  - Selection is gone (`111-112`). Go and Terminal are gone (`124`). Run is gone (patch 003, `debug.contribution.ts` hunk).
  - Preferences is Mac-only (`136-145`).
- There is no Window menu: the only top-level entries are those in `menubarControl.ts`, and the Mac's Window menu is built by the native main-process menu (`platform/menubar/electron-main/menubar.ts:352-357`), which Windows does not use (`menubar.ts:93`).
- Help is filtered by 015 (`menubarControl.ts:49-53`, `255`). On Windows it also gets "Check for Updates" before About (`menubarControl.ts:551-566`).
- File's last item is Exit, group `z_Exit`, not on the Mac (`workbench/electron-browser/desktop.contribution.ts:126-135`).
  - Groups sort by name (`platform/actions/common/menuService.ts:317-340`). The only other `z_` group is web-only (`browser/actions/windowActions.ts:507-516`).

## 3. The window buttons

**How VS Code reserves the space.**
- `.window-controls-container` in the title bar (`browser/parts/titlebar/titlebarPart.ts:520-543`) is a fixed **138 px** on Windows desktop, divided by the zoom factor (`workbench/browser/parts/titlebar/media/titlebarpart.css:343-350`). That is three 46 px buttons.
- VS Code does **not** use the `env()` variables on Windows. It uses them only on the web (`titlebarpart.css:324-333`) and on Linux (`352-354`).
- The variables exist in Electron whenever `titleBarOverlay` is set (`electron.d.ts:3889-3895`):
  - `titlebar-area-x` and `titlebar-area-width` describe the free area beside the buttons;
  - `titlebar-area-height` is the overlay's height.
- On Windows, the space to reserve is `100vw - env(titlebar-area-width) - env(titlebar-area-x)`.
- From script, the same rectangle is `getWCOTitlebarAreaRect()` (`base/browser/browser.ts:139-141`). Its `geometrychange` listener is wired only for the web (`browser/layout.ts:470-473`).
- `--zoom-factor` is set only on the title bar element (`titlebarPart.ts:886`). A strip must set its own.

**What the strips must do.** The AI's part ends at the window's right edge, so its strip ends there too:
- **AI strip.** Pad its right end by the reserve.
- **AI hidden.** The desk's right-hand strip and the top-right group's tab row must stop the reserve short of the edge. The proof of concept already marks that group with `ritemark-right-edge ritemark-top-edge` (018:1494-1496), but its padding rule is Mac-only (018:554).
- **Minimum width.** The AI column can shrink to 170 (`browser/parts/auxiliarybar/auxiliaryBarPart.ts:87`). That is less than the toggle, You and 138 together (about 230). The buttons would cover You.

**Snap layouts.** No VS Code code draws them. They belong to Electron's own maximise button in the overlay. VS Code on Windows 11 gets them from this same setup, so Ritemark should too.

## 4. Drag regions

**How VS Code's title bar does it.**
- A full-size `div.titlebar-drag-region` with `-webkit-app-region: drag` (`browser/parts/titlebar/titlebarPart.ts:472-473`, `titlebarpart.css:57-64`).
- Every control is `no-drag` (for example `base/browser/ui/menu/menubar.css:30`, `titlebarpart.css:314`).
- Floating menus are `no-drag`: `.context-view` (`browser/media/style.css:221-223`), context menus (`base/browser/ui/menu/menu.ts:1238-1243`), quick input (`platform/quickinput/browser/media/quickInput.css:11`).
- The menu bar's own drop-down holder has **no** `app-region` rule (`menubar.css:59-68`). Instead, on Windows and Linux, VS Code hides the drag region while the menu bar has focus (`electron-browser/.../titlebarPart.ts:100-113`, `141-154`). The comment calls this a fix for "layered webkit-app-region elements". VS Code skips it in compact mode, where no drag region is near.

**Double-click and right-click.** VS Code has no double-click code for the Windows title bar:
- The only `DBLCLICK` is on the app icon, which closes the window (`electron-browser/.../titlebarPart.ts:166-173`).
- Maximise and restore on double-click therefore come from Windows: a drag region acts as the window's caption.
- Right-click on a drag region opens Windows' own system menu. VS Code replaces it only on Linux (`windowImpl.ts:200-218`).

**Proof of concept.** The tab row is a drag region with tabs `no-drag` only under `.monaco-workbench.mac` (018:507-520). The tab heights, centre line, padding for hidden columns and the + placement are Mac-only too (018:550-561, 671, 824, 950).

## 5. Shortcut labels

- Menu items get their shortcuts from `keybindingService.lookupKeybinding(action.id)` (`menubarControl.ts:785`). `getLabel()` goes through `UILabelProvider` with the running system (`platform/keybinding/common/baseResolvedKeybinding.ts:25-27`). The Windows words are "Ctrl", "Shift", "Alt" (`base/common/keybindingLabels.ts:55-69`).
- For a tooltip, `keybindingService.appendKeybinding(label, commandId)` gives "Label (Ctrl+B)" on Windows (`platform/keybinding/common/abstractKeybindingService.ts:404-412`).
- A hard-coded ⌘ would show on Windows as it is. That is wrong.
- The proof of concept's new files (`ritemarkNewTab.ts`, `ritemarkFoldedTabs.ts`, `ritemarkFrameStrip.ts`, `ritemarkProjectHead.ts`) contain **no** ⌘, ⇧ or ⌥ and no `isMacintosh` (searched the whole patch). They show no shortcuts at all.
- Their Mac assumptions are elsewhere:
  - the 84 px left gap for the traffic lights (018:455) and the 124 and 84 desk strips (018:540, 546);
  - the `.mac` CSS listed in 4;
  - the 52 height in 1;
  - the constant itself, Mac only (018:3038).

## Recommendation

**1. No title row.**
- **`layoutService.ts` (018).** Set `RITEMARK_FRAME_WITHOUT_TITLE_ROW = isNative && (isMacintosh || isWindows)`. Keep the main-window-only guard (018:3047-3050).
- **WCO stays on.** Leave `windows.ts` alone.
- **`electron-browser/parts/titlebar/titlebarPart.ts` (018).** Make it the one sender:
  - In frame mode on Windows, `updateStyles()` sends `{ height: 44, backgroundColor: ground, foregroundColor }`.
    - The ground is `theme.getColor('ritemark.ground')`, falling back to `WORKBENCH_BACKGROUND`, made opaque.
    - It already runs on theme change and on focus and blur.
  - Send nothing from `layout()` while the part is hidden.
  - Branch the POC's call: 52 on the Mac, 44 on Windows.
  - Store `cachedWindowControlStyles` (VS Code's missing line, an adjacent fix).
- **`windowImpl.ts`.** In frame mode, start the main window at 44 instead of the shared cache or 35 (`windowImpl.ts:191-198`). Put the constant in `platform/window/common/window.ts`, because electron-main cannot import the workbench.
- **Settings.**
  - With `window.controlsStyle` `custom` or `hidden`, Windows would show **no buttons at all**: VS Code's own buttons live in the hidden title bar (`electron-browser/.../titlebarPart.ts:175-212`). In frame mode, ignore that setting (treat it as `native`).
  - With `titleBarStyle: native`, Windows draws its own title row. Skip the reserve then.
  - Add a workbench class `ritemark-wco` only when `useWindowControlsOverlay()` is true.

**2. The menu button.**
- In 018, a small `ritemarkFrameMenu.ts` owns **one** `CustomMenubarControl` in a `MutableDisposable`, as `titlebarPart.ts:417-437` does.
  - It installs it at the start of the left strip, before the toggle.
  - When the left column is hidden, it moves it to the desk's left strip. Listen to `onDidChangePartVisibility` for the sidebar, uninstall, reinstall, then call `layout()`.
- Use the non-compact control in a 28 px slot, so it shows the overflow button only and opens downward. Do not set `menuBarVisibility: compact`.
- `browser/parts/titlebar/titlebarPart.ts` (018): skip `installMenubar()` in frame mode (`476-483`, `368-378`). That keeps the Alt listener to one.
- `menubar.ts` (018, two lines): in overflow-only mode, label the button "Application Menu" and give it `tabindex 0` (`menubar.ts:317-318`). This makes it reachable with Tab and named properly for screen readers.
- Hide View → Appearance → Menu Bar in frame mode (`layoutActions.ts:793-812`, `when: false`). Its toggle would switch the menu to compact.
- If the team keeps compact anyway, it must also:
  - stop the places row's copy (`activitybarPart.ts:383-388`);
  - accept or patch the sideways fly-out (`menubar.ts:1016-1030`).

**3. The window buttons.**
- In `ritemarkSurfaces.css`, define `--ritemark-wco: calc(138px / var(--zoom-factor, 1))` under `.monaco-workbench.windows.ritemark-wco:not(.fullscreen)`. This is VS Code's proven Windows rule.
  - If the zoom audit chooses counter-zoomed strips, use plain 138px (`titlebarpart.css:348-350`).
  - Set `--zoom-factor` on the workbench in TS.
- Add the reserve to:
  - the AI strip's right padding;
  - the desk's right strip offset;
  - the top-right group's tab row padding. Turn 018:554 into a non-Mac rule.
- In a dev build, log once if `getWCOTitlebarAreaRect()` disagrees with 138 at 44 high. Keep `env()` as that cross-check, not the rule.
- Raise the AI column's minimum width on Windows (`auxiliaryBarPart.ts:87`) to fit the toggle, You and 138.
- Snap layouts need no code.

**4. Drag regions.**
- Keep the POC's strip (`drag`, controls `no-drag`).
- Rescope the 018 tab-row rules from `.mac` to a frame class set on both systems (018:507-520, 550-561, 671, 824, 950).
- Write no double-click code.
- While the menu has focus (`onFocusStateChange`), switch the strips to `no-drag`, as VS Code does (`titlebarPart.ts:146-154`).
- Give `.menubar-menu-items-holder` and the +, folded-tabs and You menus an explicit `no-drag`.

**Shortcut words.** Every new tooltip that names a shortcut uses `appendKeybinding()`. Never write a modifier by hand.

## Not knowable without a Windows PC

1. Whether the overlay is still 138 wide at 44 high, at 100, 150 and 200 % display scaling.
2. Whether `env(titlebar-area-*)` and `getTitlebarAreaRect()` follow page zoom on Windows. This is why VS Code uses 138 there.
3. Whether the buttons fill the 44 strip exactly with height 44 (the `- 1` border), with no line above or below, maximised and not.
4. Whether snap layouts appear on hovering maximise with a 44 overlay (Windows 11 only; Windows 10 has none).
5. Whether double-click on the strip maximises and restores, dragging to the screen's top edge snaps, and right-click shows the system menu.
6. Whether drag regions keep the right shape when the strip uses CSS `zoom` (R3).
7. Whether a menu that overlaps a drag region loses clicks there, even with `no-drag`.
8. Whether dragging a tab to the empty end of the tab row, or dropping a file there, still works, since that area is now a drag region.
9. Whether the overlay hides in F11 full screen. The reserve must follow it.
10. How visible the start-up jump is: 29 at creation (`windows.ts:229`), then the cached height, then 44 on first launch and after an auxiliary window wrote 35.
11. Whether the overlay's colour matches the strip exactly in Ritemark Light and Dark, in an unfocused window, under a dialog's dimming, and in high contrast.
12. Whether Alt behaves well on Estonian and other AltGr keyboards, and with the focus in the editor's or the AI's webview.
13. How the overlay behaves when the window moves between monitors with different scaling.
