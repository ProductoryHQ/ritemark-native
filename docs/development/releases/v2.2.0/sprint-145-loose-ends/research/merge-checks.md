# R1's revision: the two checks behind a paragraph merge (#588)

Written on 1 November 2026, after Jarmo's decision (ritemark-dev decision log `735b186`; [#588's comment](https://github.com/ProductoryHQ/ritemark-native/issues/588#issuecomment-6556475375)): both changes stay. When a writer saves a copy made from an older version, Ritemark finds the version the copy started from (the **base**) and merges by paragraph; a shell hook next to patch 014 lets Ritemark answer before VS Code reloads a clean document its editor holds. The experience is the Experience lead's experience 44, *Editing alongside the AI* (ritemark-dev `product/design/experience/experiences/alongside/README.md`, `ec25356`).

Two things had to be true. Both were checked; neither is assumed.

## 1. The base: does the writer's copy match an older remembered save outside its own changes?

**Yes, in every run of the S1 reproduction (5 of 5).** Measured on 1 November on the Mac, in one hidden dev instance of the branch at `d6015a93` (same setup as [stale-write-repro.md](stale-write-repro.md)).

[`repro/base-versions.mjs`](repro/base-versions.mjs) recorded every version of each test file that appeared on disk while `scripts/qa/stale-write-check.mjs --attach` ran S1 three times and S7 on a front-matter file and a CRLF file, then compared the writer's copy with each earlier version block by block (a block is the text between blank lines, compared as logical text: line endings and a byte order mark aren't content).

| File | Versions before the write | Writer's copy vs. the check's own first text | vs. **Ritemark's first save** (what the writer read) | vs. Ritemark's second save (the person's newest) |
|---|---|---|---|---|
| S1, run 1 | 3 | blocks 1 and 3 differ | **block 1 only** (the writer's change) | blocks 1 and 3 |
| S1, run 2 | 3 | 1 and 3 | **1 only** | 1 and 3 |
| S1, run 3 | 3 | 1 and 3 | **1 only** | 1 and 3 |
| S7, front matter | 3 | 2 and 4 | **2 only** (block 1 is the front matter) | 2 and 4 |
| S7, CRLF endings | 3 | 1 and 3 | **1 only** | 1 and 3 |

So the base is the remembered save with which the copy differs least, here uniquely: the writer's copy is that save plus the writer's own change, and the person's later words (block 3) are the difference from the newest save.

**Is "Ritemark's first save" what the coordinator remembers?** Yes: the sync log shows the save's receipt matching the file's logical text (`model-change:local-save-echo`) for 9 of the 10 saves in these runs; the tenth was seen on disk before its receipt arrived (`model-change:converged`), the race #605 already handles (`convergedBeforeReceipt`), and the remembered text is the document's own text at the save either way.

**What this doesn't show** (and why the fallback stays):
- The writer here is a script that changes one line of what it read. The AIs' own tools were not run (A2, [ai-edit-tools.md](ai-edit-tools.md)). A targeted edit tool (Claude Code's Edit, Codex's patch) rewrites only its own lines, as the script does. A tool that writes the whole file anew (a Write, a formatter) may also normalise Markdown elsewhere: list markers, emphasis, escapes, trailing spaces, table padding. Then no remembered save matches outside the change, and the copy falls to the fallback question.
- The base must still be in memory. #605 keeps saves for 30 s; a merge needs a longer memory (it asks nothing, so an older base is no risk), bounded by size.

## 2. The hook: where VS Code reloads a clean text model, and whether a patch can ask Ritemark there

**Yes.** Read in the VS Code 1.142 source of the dev tree used for A1 (a copy-on-write clone whose patch stack is byte-identical to `main`'s), not built or run:

1. `TextFileEditorModelManager.onDidFilesChange` (`src/vs/workbench/services/textfile/common/textFileEditorModelManager.ts:122`) skips dirty models ("never reload dirty models") and, for an UPDATED or ADDED event on a clean one, calls `queueModelReload(model)` (`:170`), which queues `reload(model)` (`:338`).
2. `reload` waits for pending resolves, returns if the model turned dirty or was disposed, and calls `doResolve(model, { reload: { async: false } })`, which passes the options to `TextFileEditorModel.resolve`.
3. `TextFileEditorModel.resolve` (`textFileEditorModel.ts:300`) returns early when the model is dirty or saving; otherwise `doResolve` → `resolveFromFile` (`:447`) reads the file with `textFileService.readStream` (the stat and etag come with it), returns if the model's version changed meanwhile, and calls `resolveFromContent(content, false /* not dirty */)` (`:485`).
4. `resolveFromContent` (`:516`) updates the last resolved stat (etag, mtime, size), then `doUpdateTextModel(content.value, EditSources.reloadFromDisk())`, then `setDirty(false)`.
5. `doUpdateTextModel` calls `updateTextEditorModel` → `modelService.updateModel` (`src/vs/editor/common/services/modelService.ts:365`), which does `pushStackElement`, `pushEditOperations(minimal edits)`, `pushStackElement`: **one undo stop in VS Code's text model.**

**The place for the hook** is in `resolveFromFile`, between the read and `resolveFromContent`, only when the model is already resolved and the read isn't forced (`forceReadFromFile` is how Revert reads, and Ritemark's own Keep my version and Use disk version use Revert). There it can ask Ritemark with the text just read and, when the answer is a different text, call `resolveFromContent({ ...content, value: createTextBufferFactory(merged) }, true /* dirty */)`. That is an existing path (`resolveFromBuffer` and backups resolve dirty the same way), and it keeps the stat of the version read: VS Code's auto-save then writes the merged text with that etag, and if the file changed again in between, the save is refused as newer and goes to patch 014's existing route.

**How the patch reaches Ritemark** is patch 014's own pattern: `textFileSaveErrorHandler.ts` (a workbench contribution with `IEditorService` and `ICommandService`) registers itself in the manager's slot (`this.textFileService.files.saveErrorHandler = this`, `:86`), checks `editorService.findEditors(resource)` for `ritemark.editor`, and calls `commandService.executeCommand('_ritemark.editorSync.answerSaveConflict', resource)` under `raceTimeout(…, 3000)`; no answer means VS Code's own behaviour. A reload participant can sit in a second slot on `ITextFileEditorModelManager` beside `saveErrorHandler`, registered by the same contribution, calling an internal `_ritemark.editorSync.answerReload` command with the resource and the text read. No answer within the budget means VS Code's own reload, as today.

## What makes the merge doubtful (for the plan and for Jarmo)

- **The undo step the person uses is not VS Code's.** Ritemark's editor applies every host update with `addToHistory: false` (`webview/src/components/Editor.tsx:610–626`): today neither a reload nor an import can be undone with ⌘Z in the editor, which is also why A1's ⌘Z brought nothing back. "The merge is one undo step" holds in VS Code's model by itself (step 5 above); in the editor it is new work: the merge's update has to enter TipTap's history as one step, and undoing it then changes the document, which auto-save writes.
- **Blocks, not blank lines.** A Markdown paragraph merge needs Markdown's blocks: a list or a table has no blank lines inside, a fenced code block can have them, and front matter is one block. The host has `marked`, whose lexer gives top-level blocks; CSV's unit is a row.
- **Three-way alignment.** Blocks inserted, deleted, split or merged on either side need a three-way alignment of the block sequences (base against each side). A moved block is a delete plus an insert; if one side moved it and the other edited it, that is "both changed".
- **Base not found** (a whole-file rewrite, a reformat, a base older than the memory) falls to today's whole-document question, which therefore stays, with the Experience lead's three changes from #605.
- **Who wrote it.** Experience 44 names the AI ("Claude", "ChatGPT", "OpenCode") only when Ritemark knows that AI made the write in that turn; whether the host can tell is not checked yet (a new audit, A10).
- **Nothing moves under the person.** The editor maps the caret and selection through a host update today; keeping the view still when text above it grows or shrinks (scroll anchoring on the caret's block) is not checked yet.
- **Windows.** A shell-tier change can't be carried by the Windows test overlay; its Windows proof is 2.2's candidate at Gate 2.
