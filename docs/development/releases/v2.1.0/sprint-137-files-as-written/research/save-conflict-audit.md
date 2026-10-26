# Save-conflict audit (R10, R11, #454)

26 October 2026, on the Mac, dev build of the worktree (VS Code 1.142.0 at `d956e8a6`, CDP port 9231, isolated profile, auto-save as shipped: after 1 s). Windows was not run here; it is the Development manager's Windows round after the merge (E5).

## 1. The two prompts, reproduced on main's shell

A document open in Ritemark, a word typed at the end of its last paragraph, and 250 ms later a changed copy of the file written from outside (the shell's stand-in for an agent's edit). The probe watched VS Code's notifications and the document's bar for 8 s.

| Seen | At |
|---|---|
| Ritemark's **Review changes** in the document's bar | 0.4 s |
| VS Code's "Failed to save '…': The content of the file is newer. Please compare your version with the file contents or overwrite the content of the file with your changes." with Compare and Overwrite | 0.8 s |

Two questions for one change: #454 as reported from Windows.

A file rewritten from outside with the same text and CRLF line endings, while the person typed, gave VS Code's notification with no Ritemark question, and the tab stayed dirty. A date-only touch (the same bytes, a new modification time) gave nothing at all: the save went through.

## 2. Every path into `FILE_MODIFIED_SINCE`

- `TextFileEditorModel.doSave` hands `mtime` and `etag` to `IFileService.writeFile`, unless `ignoreModifiedSince` is set or `files.saveConflictResolution` is `overwriteFileOnDisk`.
- `FileService.validateWriteFile` refuses with `FILE_MODIFIED_SINCE` when the file on disk is newer **and** its etag differs, where the etag is computed from the model's old `mtime` with the disk's new size; and even then it lets the write through when the disk holds exactly the bytes about to be written. So a change of date alone, with the same size, is never refused, and neither is a disk that already holds the person's exact bytes; a change of size with other bytes is.
- Every save reaches it the same way: auto-save after a delay, on focus change or on window change; an explicit save (⌘S, File ▸ Save, Save All); Ritemark's own saves through `TextDocument.save()`. The model then calls `ITextFileSaveErrorHandler.onSaveError`, which is `TextFileSaveErrorHandler` in the workbench, and it puts the model in conflict mode: from then on an auto save is ignored (`save() - ignoring auto save request for model that is in conflict or error`) until an explicit save or a revert.
- VS Code's own conflict editor saves with `activeConflictResolutionResource` set; that path must keep VS Code's handling.

The hand-over therefore sits at the top of `onSaveError`, one place for every path, and only for `FILE_MODIFIED_SINCE`.

## 3. Which editor holds the document

`IEditorService.findEditors(resource)` returns the open editors of the resource in every group, with their `editorId`:

| Open | `editorId`s | Hand to Ritemark? |
|---|---|---|
| Ritemark only | `ritemark.editor` (`CustomEditorInput`'s `viewType`) | Yes |
| Ritemark and a text editor of the same file, in one group or two | `ritemark.editor`, `workbench.editors.files.textFileEditor` | Yes (S44) |
| A text editor only (Open With ▸ Text Editor, or an editor association) | `workbench.editors.files.textFileEditor` | No (S45) |
| No editor (a save from an extension, a closed tab's model) | none | No |

`shouldHandSaveConflictToRitemark` encodes the table, and `ritemarkSaveConflict.test.ts` pins it.

## 4. `executeCommand` before the extension registers

`ICommandService.executeCommand` first fires the `onCommand:` activation event and waits for registered extensions, then rejects with "command not found" when nothing registered the id. The command is registered in `DocumentSyncCoordinator`'s constructor, which runs when the extension activates; a Ritemark editor cannot exist before that, so a document Ritemark's editor holds always has the command. If the extension host has died, the rejection is caught and VS Code's notification shows (`askRitemark`'s `catch`). The command id starts with `_`, so it is never in the palette, and it is not in `package.json`.

## 5. The decision and each answer's end state

`classifyRefusedSave` compares logical text hashes (one BOM and CRLF/CR normalized away):

| Disk | Decision | Answer | End state, checked in the app |
|---|---|---|---|
| = the person's text | `converged` | `overwrite` | The tab is clean, the file holds the person's text, no question (S49). In S49's run the outside write was byte-identical to the save, so VS Code let the save through itself (§2); the hand-over answers the case where the text is the person's but the bytes differ (line endings, a BOM): run with the person's text written in CRLF, the save was refused, Ritemark answered `overwrite`, no question, the tab clean. |
| = the base the person started from | `disk-unchanged` | `overwrite` (when no conflict is open) | The CRLF rewrite: no question, the file holds the person's text with the model's line endings, the tab is clean (S47). |
| anything else | `conflict` | `handled` | Ritemark's Review changes (S40). **Keep my version:** the file holds the person's text, the tab is clean, the next word auto-saves with no question (S41). **Use disk version:** the file holds the outside text, the tab is clean, the next word auto-saves with no question (S42). |

The overwrite is the shell's own `model.save({ ignoreModifiedSince: true, reason: SaveReason.EXPLICIT })`, as VS Code's Overwrite action does. An auto save's reason is ignored for a model in conflict mode, which the first in-app run of S47 showed: the answer came back, and the tab stayed dirty until the reason was explicit.

The plan's alternative, an extension-side write and revert for the disk-unchanged case, was not used. The shell's save writes the model's exact snapshot with its save participants and the patch's receipt, and clears the conflict mode in the same step; a write and revert from the extension would race the reveal and the revert against the person's typing.

## 6. The disk-unchanged case in synced folders

- **The Mac:** a date-only touch never reaches the handler (§2). The same text with other line endings does, and is answered `overwrite` (S47). An iCloud or Google Drive folder was not run.
- **Windows and OneDrive (#499, S48):** not run here. OneDrive's placeholder and hydration writes are the case R11 is for; it is in the Windows round.

## 7. What is not covered

- The hand-over asks once per refused save. A refused save while a conflict is already open is answered `handled` again; the Ritemark notification shows once per conflict (`notifiedConflictRevision`).
- Between Ritemark's answer and the shell's overwrite, a third writer can still write; the overwrite then replaces it. This is the same last-writer interval as Keep my version (architecture, *Editor–disk synchronization*).
- S46 (Ritemark not running) was not run as its own launch. With no Ritemark editor, the hand-over is never consulted, which is S45's path; the unregistered-command path is the `catch` above, read but not driven.
