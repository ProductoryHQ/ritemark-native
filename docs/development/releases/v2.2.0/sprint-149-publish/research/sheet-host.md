# The Publish sheet over the whole window: can the extension host it?

Sprint 149, PR 3 round 2, 5 November 2026. Analysis only: no shell file is changed by PR 3. The Development manager builds the answer as a separate shell PR.

## The answer in one line

**No, not today.** The feedback sheet is drawn by the workbench itself and holds no webview, and an extension has no way to put a webview outside an editor group or a view. **Patch 018 needs one new general command**: a whole-window sheet that hosts an extension's *webview view* over the dimmed window. It is about 150 lines in one new file, built from the feedback sheet's frame and VS Code's own webview-view plumbing, with no change to VS Code's webview code.

## What the lead asks for

`publish.html` frame 3: `.scrim` (the whole window dimmed) and `.pub` (centred, 440 wide, radius 12, the desk's colour, a hairline and a shadow). It is never a tab and never inside the desk. Focus moves in when it opens, and Esc or Cancel close it with focus back on the bar's Publish. The framework says the same: "Everything that floats is one sheet … A dialog dims the window behind it."

## What exists

**The feedback sheet** (patch 018, `src/vs/workbench/browser/parts/ritemarkFeedbackSheet.ts`, patch lines 3856–4245):
- The frame: `showRitemarkFeedbackSheet` appends `.monaco-dialog-modal-block.dimmed.ritemark-feedback-block` to `layoutService.activeContainer` and puts a 440-wide `.ritemark-feedback-sheet` inside it (patch lines 4009–4016). Its CSS (patch lines 3475–3501) is `position: fixed; inset: 0; z-index: 2575`, centred, 440 wide, radius 12, the desk's colour, the hairline and the shadow. That is frame 3's `.scrim` and `.pub`.
- The behaviour: it remembers `previouslyFocused` and gives the focus back on close (lines 4012 and 4026), Esc closes it, Tab stays inside, and a press on the dimmed window does nothing (lines 4171–4218).
- The way in: `CommandsRegistry.registerCommand('_ritemark.feedbackSheet', …)` (line 4229). The extension passes the words, and the sheet calls `_ritemark.feedback.submit` back. It is loaded by `desktop.contribution.ts` (patch line 6418).
- **Every element of it is workbench DOM.** It can't show an extension's React page: the words travel, the page doesn't.

**Webviews in VS Code 1.142:**
- An extension's webview lives in a **panel**, which is an editor tab in a group (`createWebviewPanel`, `extHostWebviewPanels.ts:202`), or in a **view** (`registerWebviewViewProvider`, `extHostWebviewView.ts:155`). `ViewColumn` maps only to a group or to Beside (`extHostTypeConverters.ts:336–347`). Today's harness is a panel in the active group, a tab with a dimmed backdrop drawn inside the desk.
- VS Code's **modal editor part** (`modalEditorPart.ts`, `MODAL_GROUP = -4` in `editorService.ts:40`) floats an editor group over the window. The extension API can't reach it (no `ViewColumn` for it), and it is an editor's frame: a header with the tab's title, sashes, about 80% of the window by default, up to 1400 wide (`modalEditorPart.ts:47`, `666–676`). Bending it into a 440 sheet would mean restyling and patching a large upstream file. **Not the way.**
- **Overlay webviews float anywhere.** Every webview is an `OverlayWebview` mounted near the window's root (`overlayWebview.ts:125`) and laid over an anchor element by CSS anchor positioning (`setAnchorElement`, `overlayWebview.ts:201`). `OverlayLayoutElement._updateZIndex` (`overlayLayoutElement.ts:112`) sets the webview's z-index one above the anchor's nearest z-indexed ancestor. **An anchor inside the feedback sheet's block (z 2575) gets a webview at 2576, over the dimmed window.** The size follows the anchor by CSS (`anchor-size`).
- **A webview view can be resolved by anyone in the workbench.** `WebviewViewPane` does it with `webviewService.createWebviewOverlay({ providedViewType, options: { purpose: WebviewView } })` (`webviewViewPane.ts:187`), then `webviewViewService.resolve(viewType, webviewView, token)` (`webviewViewPane.ts:255`). The main thread's resolver (`mainThreadWebviewViews.ts:56–124`) hands it to the extension's `resolveWebviewView`. **No `views` contribution is needed:** `registerWebviewViewProvider` only registers the provider by its view type (`extHostWebviewView.ts:155–176`, `mainThreadWebviewViews.ts:61–67`).

## What's missing

One thing: **a workbench command that opens a webview view of the extension in a sheet over the window.** Nothing in 018 or upstream creates an overlay webview outside a view pane or an editor.

## The smallest change (for the shell PR)

**Patch 018: one new file**, `src/vs/workbench/browser/parts/ritemarkWebviewSheet.ts` (about 150 lines). It is imported beside the feedback sheet in `desktop.contribution.ts` and reuses the feedback sheet's frame CSS (`.ritemark-feedback-block`), plus a `.ritemark-webview-sheet` rule (440 wide, radius 12, the shadow, `overflow: hidden`, `max-height: calc(100vh - 64px)`).

`_ritemark.webviewSheet.open({ viewType, title, height })`:
1. Remember `activeElement`. Append the dimmed block to `layoutService.activeContainer`, with an empty, centred anchor `div.ritemark-webview-sheet` inside it, 440 wide and `height` tall.
2. `webviewService.createWebviewOverlay({ providedViewType: viewType, title, options: { purpose: WebviewContentPurpose.WebviewView }, contentOptions: {}, extension: { id: 'ritemark.ritemark' } })`, then `claim(sheet, window)` and `setAnchorElement(anchor)`. The webview lands over the anchor, above the dim.
3. Build a `WebviewView` (`webview`, `onDidChangeVisibility`, `onDispose`, title and badge no-ops; `show` focuses it). Call `webviewViewService.resolve(viewType, view, token)`, then `webview.focus()`.
4. Resolve with `'closed'` when the sheet closes.

`_ritemark.webviewSheet.layout({ viewType, height })` sets the anchor's height. The page posts its height when it changes (a `ResizeObserver` on the sheet's root), and the webview follows by CSS.

`_ritemark.webviewSheet.close({ viewType })`, or Esc: fire `onDispose` (the extension's `onDidDispose`), `release` and dispose the webview, remove the block, and give the focus back to the remembered element. Esc is caught on the block too, so it also works while the focus is outside the webview. A press on the dim does nothing, as on the feedback sheet.

**The extension side then changes very little.** `PublishSheetPanel.ts` registers one `WebviewViewProvider` for `ritemark.publishSheet` at activation. `showPublishSheet` runs `_ritemark.webviewSheet.open` and keeps today's message protocol (`sheetProtocol.ts`) on `webviewView.webview`. Its `answer` runs `_ritemark.webviewSheet.close`. The React sheet drops `Dialog`'s own overlay and centring (the workbench draws them) and keeps its content, buttons, focus and Esc. Open on a hit opens the file in `ViewColumn.Active`, which is the page's desk, since the sheet takes no group.

**It stays general:** any later extension sheet (Unpublish's question, Disconnect) can use the same command with its own view type. The command opens only a view type the Ritemark extension registered: the resolver looks the provider up by type, and the shell checks `extension.id`.

## Risks to check in the shell PR

- **Focus back to the bar's Publish.** The bar is part of the browser tab (patch 010). The remembered element is the workbench's own Publish button only if the press came from the workbench DOM. If the bar is in a separate view, the extension should pass a `returnFocus` command instead.
- **Height.** The first paint is at the `height` passed in. The page's first `layout` message comes before it shows (the sheet waits for `publish:sheetReady` anyway).
- **Two windows.** Use `layoutService.activeContainer` and claim on that window, as the feedback sheet does.
- **Tests.** Follow `ritemarkFeedbackSheet.test.ts` (patch line 6664): the block and anchor appear, Esc and close remove them and give the focus back, and a second open while one is showing is refused.
