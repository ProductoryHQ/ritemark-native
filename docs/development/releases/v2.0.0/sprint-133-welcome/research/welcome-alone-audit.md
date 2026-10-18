# Audit: the welcome alone, and an empty desk's tiles (R1, R6)

Done 2026-10-18 on `sprint-133-welcome`, VS Code 1.117.0 at `10c8e557` with patches 001–019. `V` = `vscode/src/vs`.

## How the frame is drawn today (018, 019)

- **Strips.** `createRitemarkFrameStrip()` (`V/workbench/browser/parts/ritemarkFrameStrip.ts:54–106`) makes `div.ritemark-frame-strip.{left|right}`: the left column's (`sidebarPart.ts:205–209`), the AI column's (`auxiliaryBarPart.ts:351–355`) and two `.on-desk` copies on the desk (`editorPart.ts:1036–1041`), which show only when a column is hidden (`ritemarkSurfaces.css:393–428`).
- **The desk's strip is the tab row:** the group's `.title`, 44 high (`editorTabsControl.ts:103`), shown even on an empty desk (`multiEditorTabsControl.ts:2250`), with the + and "N ⌄" (`:202–204`). Its empty space drags the window (`ritemarkSurfaces.css:358–360`).
- **The desk sheet** is the paint on `.editor-group-container > .editor-container` (`ritemarkSurfaces.css:188–193`). A webview editor is positioned over that element's box (`V/base/browser/overlayLayoutElement.ts:120–132`, `webviewEditor.ts:209`), so the element must keep its box.
- **The status bar** is an ordinary grid part, 24 high (`statusbarPart.ts:121`).
- **The traffic lights and Windows' buttons are native**, not DOM: the lights are placed with `updateWindowControls({ height: 52 })` (`electron-browser/parts/titlebar/titlebarPart.ts:79–105`, `windowImpl.ts:450–460`), the buttons by the Window Controls Overlay (`windowImpl.ts:425–447`). The DOM only leaves room for them (`--rm-lights: 84px`, `--rm-buttons: 138px`). CSS cannot hide either, and hiding a strip does not remove the Windows buttons.
- **Windows' menu button** is VS Code's `CustomMenubarControl`, placed into a strip slot by `RitemarkFrameMenu.place()` (`ritemarkFrameMenu.ts:42–87`).

## The decision

1. **The extension closes both columns** through VS Code's own commands (`workbench.action.closeSidebar`, `workbench.action.closeAuxiliaryBar`) when it opens the welcome in a window with no folder, and sets the context key `ritemark.welcomeAlone` to `true`. Columns must close through the layout (`setPartHidden`), not CSS: CSS would leave their grid space empty. This is written to the **empty window's** workspace storage only (`workbench.sideBar.hidden`, `workbench.auxiliaryBar.hidden`, `layout.ts:2823–2828`); opening a folder loads that folder's own storage, so nothing carries over. The extension never calls `updateWorkspaceFolders` from an empty window (that would migrate the empty window's storage into an untitled workspace, `abstractWorkspaceEditingService.ts:206–216`).
2. **A small 018 contribution, `ritemarkWelcomeAlone.ts`** (`registerWorkbenchContribution2`, `WorkbenchPhase.BlockRestore`, as `ritemarkFrameMenu.ts` is), toggles the class `ritemark-welcome-alone` on `layoutService.mainContainer` while **both** hold:
   - `contextKeyService.getContextKeyValue('ritemark.welcomeAlone') === true` (the extension's `setContext` reaches the root context key service, `contextKeyService.ts:641–658`; observed with `onDidChangeContext` + `affectsSome`, the pattern of 007's `paneCompositeBar.ts:232–238`);
   - the main editor part holds exactly one editor and it is the welcome (`typeId` webview, `viewType` `mainThreadWebview-ritemark.welcome`, the prefix 019 already checks at `editorGroupView.ts:1569–1572`), observed through `IEditorService.onDidEditorsChange`.
   The class goes the moment either stops holding, so anything else that opens brings the frame back at once.
3. **CSS in `ritemarkSurfaces.css` (018) under `.monaco-workbench.ritemark-welcome-alone`:**
   - the desk strips' controls (`.ritemark-frame-strip.on-desk > *`) and the tab row's contents (`.tabs-and-actions-container`, the + and "N ⌄") get `visibility: hidden`; their containers stay, so the window can still be dragged by its top;
   - the desk sheet loses its paint (background, radius, shadow) but keeps its box;
   - `.part.statusbar` gets `visibility: hidden`. Nothing is written: `workbench.statusBar.visible` and zen mode both persist, so neither is used. The grid keeps the status bar's 24 as flat ground.
   - The welcome's page draws its own raised sheet, 640 wide, centred, on the ground colour (`--vscode-ritemark-surfaceSoft` / the editor's background is set to the ground for this page).
4. **Windows' menu button:** `RitemarkFrameMenu.place()` does not mount while the class is on (a CSS-hidden menu bar may still answer Alt). The window buttons stay at the top right.
5. **Nothing else moves the frame while the welcome is alone:**
   - the AI sheet's 4 s focus (`extension.ts:346–349`, `ritemark.unifiedView.focus`) is skipped in a window with no folder: it would reopen the AI column 4 s into the welcome and save it as shown;
   - `RitemarkWindowSizes` (`ritemarkWindowSizes.ts:146–176`) does not show a column again on a size crossing while the class is on;
   - the start-up layout writes (`workbench.layoutControl.*`, `extension.ts:332–344`) are global settings with no visible effect while the columns are closed; they stay.
6. **No jump at the landing.** The landing is a reload into the folder's own storage, so the welcome's closed columns and hidden strip never reach the project window. The CDP check measures the frame before and after (E3).

## An empty desk's tiles (R6, S49)

- An empty group draws `EditorGroupWatermark` (`editorGroupView.ts:200`, `.editor-group-watermark`), which 018 hides entirely (`ritemarkSurfaces.css:206–218`) and keeps the tab row and the sheet on an empty desk.
- The + menu's kinds are `KINDS` in `ritemarkNewTab.ts:36–41` (019): Text → `ritemark.newDocument`, Table → `ritemark.newTable`, Web page → `ritemark.browser.newTab`, Terminal → `workbench.action.createTerminalEditor`, run after `groupsView.activateGroup(groupView)` (`multiEditorTabsControl.ts:204`).
- **The decision:** a hunk in **019** (the tab row's patch, which owns `ritemarkNewTab.ts`) exports the first three kinds and adds a small `ritemarkEmptyDesk.ts` that the watermark renders in place of its letterpress and shortcuts: three tiles (icon, name, one line), each activating its group and running the kind's command, with clicks kept from the group's double-click (`editorGroupView.ts:386–398`, which would open an untitled editor). The CSS goes in 018's `ritemarkSurfaces.css`, which owns drawing: the watermark shows again on an empty desk, laid over the sheet, centred, as `.tiles` in the kit (three columns, 12 apart, radius 10, the strong hairline, a 32 icon box on the ground colour, 14/600 name in ink, 12 line in muted ink).
- The words are the +'s: "Text" / "A new document", "Table" / "CSV data", "Web page" / "Open a site" (experience 2, frame 4; the kit's `.tile`).
- An inactive empty group is dimmed to 0.5 upstream (`editorgroupview.css:63–70`); with two desks, the empty one's tiles stay readable (018 sets the opacity back to 1 for the tiles).

## Not verified here, checked in the build

- That `visibility: hidden` on a strip's children keeps the strip a drag region (the container keeps `-webkit-app-region: drag`; checked by dragging the window in S1).
- That a tile click activates its own group when there are two desks (the tile passes its group explicitly instead of relying on focus).
