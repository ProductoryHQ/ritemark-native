# A1: the box and the swap (R7, PR 3)

Checked on 2 November 2026 on a dev instance of `sprint-148-search-words-shell` (CoW `vscode/` at the pin, 19 patches), the frame baseline's sample project with three Markdown files added, an isolated profile.

## The mechanism

- **The swap is a `when` on the Folders view's descriptor** (`explorerViewlet.ts`, 002): `!ritemark.searchOpen`. The results view (`ritemark.searchResults`, the extension's `explorer` view) has the opposite `when`, so Documents holds exactly one view either way. With one view the container stays merged: no pane headers, the results fill the column under the head.
- **The tree is disposed and made again.** VS Code does the same when a view moves between containers. To come back as it was, `ExplorerView.dispose` stores the tree's view state (expanded folders, focus, selection, scroll), which the new view reads in `setTreeInput`. Measured: Modules and Research expanded and a 50 px scroll came back unchanged after a search and Escape.
- **Selection** follows the active document, as on any return to Documents: the view's `selectActiveFile` runs when it becomes visible (`explorer.autoReveal`). A folder clicked before the search is not selected after it, which is also what switching to another place and back does on `main`.
- **The key is set by the head** (018), on the window's context key service, only while the box holds words other than spaces; the extension's switch turned off clears the words without a search.
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
| Switch off (`ritemark.features.project-search: false`) with words | box gone, the plain Search row, the tree back; a click and ⌘⇧F open VS Code's Search |
| Light and Dark | `qa/pr3-box/` |
