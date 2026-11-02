# A1: the box and the swap (R7, PR 3)

Checked on 2 November 2026 on a dev instance of `sprint-148-search-words-shell` (CoW `vscode/` at the pin, 19 patches), the frame baseline's sample project with three Markdown files added, an isolated profile.

## The mechanism

- **The Folders view is hidden in place, never removed** (`explorerViewlet.ts`, 002). The results view (`ritemark.searchResults`, the extension's `explorer` view, `when: ritemark.searchOpen`) is added to Documents while the box holds words; the container then hides the Folders pane with SplitView's own `setViewVisible` (reached through `PaneView.setPaneVisible` and `ViewPaneContainer.setPaneVisible`, one small hunk each), and hides the results pane's header. The tree, its `ExplorerService` registration and its context keys stay alive.
- **Round 1 of the review moved it here.** The first build put a `when: !ritemark.searchOpen` on the Folders view's descriptor, which disposed and rebuilt the tree on every search: explorer commands then had no view (New folder from the project menu threw, Show in Documents did nothing), `ExplorerService` held a disposed view, and a quick empty-and-type stored a half-restored tree.
- **Whatever opens the tree clears the search first.** `ViewsService.openView('workbench.explorer.fileView')` reaches the container's `openView`, which runs 018's `_ritemark.projectHead.clearSearch` and shows the tree: Show in Documents, Reveal Active File, New file and New folder (`openExplorerAndCreate`). Measured: with words in the box, Reveal Active File cleared it and selected the file; the project menu's New folder cleared it and opened the tree's name box.
- **Folders and scroll** come back as they were (the tree never went). **Selection** follows the active document, as on any return to Documents on `main`: the view's `selectActiveFile` runs when it becomes visible (`explorer.autoReveal`), so a folder clicked before the search is not selected after it.
- **The key is set by the head** (018), on the window's context key service, only while the box holds words other than spaces; the extension's switch turned off, or the folder closed, clears the words without a search.
- **How the extension knows the box is there:** `_ritemark.projectHead.focusSearch` is registered by the head at the sidebar's creation, before extensions run; `SearchHost.shellHasBox` looks for it (PR 2).

## The field's room

The field takes the Search row's element and its 32: the head's height is the same at rest and focused. While results show, the Documents label (28 with its margin) goes and the results start where it was, as R7 draws ("in place of the Documents label and the tree").

## Checked

| Check | Result |
|---|---|
| Typing shows results as you type | yes (`harbour`: 3 documents) |
| ↓ moves into the results | the results view's iframe has the focus |
| Enter opens the top result | `Harbour visit.md` opened, the caret stays in the box |
| Escape with words | words cleared, caret stays, Folders and the label back |
| Escape in an empty box | the focus goes to the desk |
| × | clears, Folders back |
| ⌘⇧F | Documents shown, caret in the box |
| Words across places | Tasks and back: the words and the results stay |
| New while searching | the words cleared, the tree back, New's menu open |
| Show in Documents / Reveal Active File while searching | the words cleared, the tree back, the file selected |
| The project menu's New folder while searching | the words cleared, the tree's name box open |
| Switch off (`ritemark.features.project-search: false`) with words | box gone, the plain Search row, the tree back; a click and ⌘⇧F open VS Code's Search |
| Light and Dark | `qa/pr3-box/` |
