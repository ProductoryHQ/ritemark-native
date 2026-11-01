# A11: One host update in the editor's history; the view's place by the caret's block (R1 revised: S61, S62)

1 November 2026, on `sprint-145-loose-ends` (#605): the code read first, then a hidden dev instance of the branch (`scripts/qa/stale-write-check.mjs --undo`).

## Undo

**Before.** Every host update enters Ritemark's editor with `addToHistory: false` (`webview/src/components/Editor.tsx`, the structural replace and its full-replacement fallback), so ⌘Z never undoes an import, and a writer's change can't be taken back from the editor.

**The change.** A host update whose reason is `merge` (the protocol's new update reason; the webview's apply target carries `undoable`) is added to the history; every other host update stays out of it. ProseMirror's history groups a transaction with the previous one when it comes within 500 ms and touches the previous change's range (`prosemirror-history`'s `applyTransaction`: `newGroupDelay`, `isAdjacentTo`). So that the merge is always its own step:
- the merge's transaction carries `closeHistory`, which starts a new event (it never joins the person's typing before it);
- an empty transaction with `closeHistory` follows it, which closes the event without a step (the next keystroke starts a new one).

The custom editor's ⌘Z is the webview's (since v1.10.1 a keybinding, `ritemark.editor.undoHandledByEditor` when `activeCustomEditorId == ritemark.editor && !inputFocus`, keeps VS Code's own undo of the text document from running too), so VS Code's undo is not involved; the editor's undo sends the undone text as an ordinary edit, which the auto-save writes.

**In the app** (`--undo`, 12 merges: S1 ×3, S3 ×3, S7 front matter ×3, S7 CRLF ×3, 1 November): one ⌘Z removed the writer's change (line 1) in every run and kept both of the person's sentences; 4 s later the file had followed (the writer's change gone, both sentences there) in every run.

## The view's place

**Before.** A host update kept the caret and the selection (mapped through the replacement) and restored `scrollTop` in the next frame, so text added or removed above the view moved what the person was looking at.

**The change.** Before the update, if the caret is inside the scroll container's visible rectangle, its top (`coordsAtPos(anchor).top`) is kept; in the next frame `scrollTop` is restored and then moved by how far the caret's mapped position moved. When the caret is out of view, or its position can't be measured, the old behaviour stays (the scroll position kept). Nothing marks where the writer's change landed.

**In the app:** not measured by a script. S61 (a long file, three blocks added above the view and one removed) is a manual check for Gate 2.
