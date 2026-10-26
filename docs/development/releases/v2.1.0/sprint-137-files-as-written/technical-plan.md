# Sprint 137 Technical Plan

The plan for [spec.md](spec.md). The release is [v2.1.0](../release-plan.md), item 1 of the shape. File references are to `main` at `b1ac84a7` (2.0.1). Code shapes here are proposals: when the code needs something else, this file changes first. The measurements behind the approach are in [research/fidelity-pre-audit.md](research/fidelity-pre-audit.md).

## What exists today

| Part | Today | File |
|---|---|---|
| Opening a Markdown document | The host splits front matter with `gray-matter` and sends the body as its canonical projection (no leading or trailing newlines) | `ritemarkEditor.ts:324–332`, `editorSync/state.ts` (`canonicalMarkdownProjection`) |
| The editor's parse | A scoped `new Marked({ breaks: true, gfm: true })`, then `preprocessTaskListHTML` and `preprocessImageHTML`, then TipTap. Three places do it: the first mount, a host update, and a fallback | `Editor.tsx:68`, `:322–345`, `:765–780`; `utils/taskListRoundTrip.ts` |
| The editor's save | `getHTML()`, then `preprocessTableHTML`, then Turndown. On every change the whole document is serialized and sent as `document:edit` | `Editor.tsx:117–153` (`serializeEditorHTML`), `:458–470` (`onUpdate`); `App.tsx:160–175` |
| Turndown's setup | ATX headings, fenced code, `-` bullets, `*` and `**`, the GFM plugin, and Ritemark's rules for strikethrough, tildes, table cells and images. No `hr` or `br` option. Task-list rules come from `taskListRoundTrip.ts`, comment rules from `commentTurndownRules.ts` | `utils/turndownService.ts:26–88` |
| Lists | Turndown 7.2.4's `listItem` uses a fixed `-` plus three spaces, or a number, a full stop and two spaces. An item ending in a paragraph gets a trailing newline, and every line is indented, the empty one too. TipTap wraps every item in `<p>` | `turndown/lib/turndown.cjs.js:92–118` |
| Task items | `tiptapTaskItem` writes `- [ ]` or `- [x]` and joins the item's lines with spaces | `utils/taskListRoundTrip.ts:81–113` |
| Breaks | `breaks: true` makes every newline a `hardBreak`; Turndown writes `␠␠\n` | `Editor.tsx:68` |
| Writing the file | `serializeSyncEdit` joins the body and front matter: `ensureTrailingNewline` without front matter, `matter.stringify` with it. A task card's page splices its body under the board's front matter. The coordinator writes the bytes with the document's line endings and BOM | `ritemarkEditor.ts:389–401`, `:1304–1315`; `taskBoard/cardFile.ts:452–472` (`splitCardText`, `spliceCardBody`); `editorSync/DocumentSyncCoordinator.ts:1005` (`encodeDocumentBytes`) |
| Links | `CustomLink` extends TipTap's `Link` with click handling. TipTap's `isAllowedUri` refuses `folder/file.md`, both on parse and in `setLink` | `extensions/CustomLink.ts`; `@tiptap/extension-link` 2.27.2 |
| Code | TipTap's `Code` mark, `excludes: '_'` | `@tiptap/extension-code` 2.27.2 |
| Images | `ImageExtension`, block-level, with a React node view. `getHTML()` gives a bare `<img>`, which Turndown writes inline | `extensions/imageExtensions.ts` |
| Tests of the pipeline | Round-trip tests that copy the editor's settings ("Same options as `editorMarked`"): task lists, ordered lists, strikethrough, tildes, image paths, comments | `utils/*RoundTrip.test.ts`, `extensions/orderedListTyping.test.ts`, `extensions/comment/commentRoundTrip.test.ts`; run by `test:editor-sync` and `test` |
| A save conflict | Sprint 115's coordinator finds a two-sided change and shows Review changes. Keep my version writes through `workspace.fs` and does a same-content revert. Use disk version applies one `WorkspaceEdit`, then reverts. Both refresh the text model's etag | `editorSync/DocumentSyncCoordinator.ts:405–515` |
| VS Code's toast | `TextFileSaveErrorHandler.onSaveError` turns `FILE_MODIFIED_SINCE` into "Failed to save '…': The content of the file is newer…" with Compare and Overwrite, for any text-file model, Ritemark's included | `vscode/src/vs/workbench/contrib/files/browser/editors/textFileSaveErrorHandler.ts` |
| Why both show | Auto-save runs 1 s after typing (`files.autoSave: afterDelay`, 1000). When an agent writes while the model is dirty, the next auto-save is refused as newer and VS Code notifies. Meanwhile the coordinator shows Review changes | `extensions/ritemark/package.json:977–978` |
| Patch 014 | Owns saving: the save receipt from the text-file model to the extension host. Seven files | `patches/vscode/014-ritemark-save-receipts.patch` |

## Architecture overview

| Layer | What changes | Where |
|---|---|---|
| Webview: the editor's Markdown pipeline | Moved out of `Editor.tsx` into one module that `Editor.tsx`, the corpus test and the round-trip tests all use. No change in behaviour by itself | `webview/src/utils/editorMarkdown.ts` (new) |
| Webview: how a block was written | `marked` renderer extensions that put `data-md-*` attributes on the HTML; TipTap attributes that carry them; Turndown rules that write by them; the escape changes | `webview/src/utils/markdownAsWritten.ts` (new), `utils/turndownService.ts`, `utils/taskListRoundTrip.ts` |
| Webview: nothing lost | `CustomLink`'s `isAllowedUri`; `Code`'s `excludes`; the block image rule | `extensions/CustomLink.ts`, `utils/editorMarkdown.ts`, `utils/turndownService.ts` |
| Webview: the corpus | Corpus files and their test | `webview/src/utils/fidelity-corpus/` (new), `webview/src/utils/markdownFidelity.test.ts` (new) |
| Host: front matter | The head is kept when the properties are unchanged | `ritemarkEditor.ts` (`serializeFrontMatter`), reusing `splitCardText` |
| Host: save conflicts | A command that answers a refused save for a document it holds | `editorSync/DocumentSyncCoordinator.ts`, `editorSync/state.ts` (the pure decision) |
| Shell: patch 014 | The save-error handler hands a refused save to Ritemark when Ritemark's editor holds the document | `patches/vscode/014-ritemark-save-receipts.patch` (+1 file, +1 test file) |

There are two new webview modules. `editorMarkdown.ts` exists so the tests drive the editor's own code, not a copy of its settings. `markdownAsWritten.ts` keeps the whole "as written" mechanism in one file: the parse side, the node attributes and the rules that read them. Neither changes the protocol: the attributes live inside the webview, and `document:edit` still carries the full Markdown.

The release tier is **shell** (`patches/`). The rest is extension-tier and could ship alone, but 2.1 is one shell release (decision 1).

## Phase 1 audits

Two requirements carry real unknowns. Each gets an audit under `research/` before any code (spec-driven-sprint, "Audit-First"):

1. **`research/fidelity-audit.md` (R1–R9).**
   - **In-app reproduction.** Each of the pre-audit's three losses (a link into a folder, a link or bold around code, images in a row) is reproduced in a dev build, with a screenshot and `cat -A` of the file after one and two saves. Then the same for #270's two cases.
   - **The real-tool captures**, scrubbed:
     - a Google Docs export;
     - an Obsidian note with front matter, `[[wikilinks]]`, a callout and tab-indented nesting;
     - a ChatGPT and a Claude answer;
     - Ritemark 2.0.1's Save as Markdown output and a document 2.0.1 saved;
     - hand-typed meeting notes.

     Each is measured with the pre-audit's harness, and each is sorted into the kept, known or cleanup set.
   - **Frequency checks** for three forms outside the bound: `1. 1. 1.` numbering, `_em_` and a list under a line inside a list item. One moves into the bound only by the scope-change protocol.
   - **The prototype's second-save instability** (81 files): find the form, and add it as a fixture.
   - **Jarmo's own folder,** if he says yes to question 5: numbers per class only.
   - **The webview's paths that parse or serialize Markdown,** each listed so all of them use `editorMarkdown.ts`:
     - the first mount and a host update;
     - paste;
     - `App.tsx:662`'s copy;
     - the Word preview's Save as Markdown (`DOCXViewer.tsx`);
     - comment callouts' tokenizer.
2. **`research/save-conflict-audit.md` (R10, R11).**
   - **The two prompts,** reproduced on the Mac (and on Windows through the Development manager's Windows session). The audit records which save raises the refusal: auto-save, ⌘S, a window or focus change.
   - **Every path into `FILE_MODIFIED_SINCE`** for a text-file model a custom editor holds.
   - **`CustomEditorInput.editorId`** for Ritemark's editor: is it `ritemark.editor`? And `editorService.findEditors(resource)` for a document open in Ritemark, in a text editor, and in both.
   - **What `executeCommand` does when the extension has not registered the command yet,** at start-up and when the extension failed to activate.
   - **The end state after each resolution:**
     - Keep my version;
     - Use disk version;
     - the R11 save.

     For each: the model's conflict mode cleared, its etag fresh, the tab clean, the next auto-save quiet.
   - **R11's disk-unchanged case:** what the coordinator's three-way state says when only the date, size or line endings changed. Plus a OneDrive folder on Windows touching a file it syncs.

## Workstream 1: The editor's Markdown pipeline in one module (R9)

Today the editor's load and save code lives inside `Editor.tsx`, a React component a Node test cannot import. So every round-trip test copies its settings, and could drift from them.

`webview/src/utils/editorMarkdown.ts` takes them over, unchanged:
- `editorMarked`, the scoped `Marked` instance, with `ensureCommentMarkedPipeline` (the lazy comment tokenizer);
- `markdownToEditorHTML(markdown, imageMappings?)`, the three parse places' shared body: `editorMarked.parse`, `preprocessTaskListHTML`, `preprocessImageHTML`, then `applyImageMappings` when given;
- `editorHTMLToMarkdown(html)`, what `serializeEditorHTML` does now;
- `preprocessTableHTML`, still exported for `App.tsx`;
- `createEditorTurndownService()`, the base service plus the task-list and comment rules;
- `markdownSchemaExtensions`, the node and mark extensions whose attributes reach the file:
  - StarterKit as configured;
  - the lists (`BoundedOrderedList` included);
  - the task nodes;
  - the table nodes;
  - the image node without its React node view;
  - the link and code marks.

  `Editor.tsx` adds its UI extensions on top (placeholder, slash commands, drag handle, search, the image's node view, comments).

**The check:** the existing round-trip tests switch to these exports and stay green. And the look baseline (Workstream 2) is equal before and after the move. That is the proof the move changed nothing.

## Workstream 2: The corpus and its test (R7, R9)

- **`webview/src/utils/fidelity-corpus/`** holds:
  - `kept/`, files that must come back byte for byte;
  - `known/`, files with forms outside the bound, each with a `name.expected.md` beside it;
  - `cleanup/`, files 2.0.1 saved, each with its `name.expected.md`;
  - `look-baseline.json`, the editor's document per kept and known file, from `main` before the sprint. It holds the ProseMirror JSON without `data-md-*` attributes, plus `getHTML()` without them.

  Tailwind scans only `*.{js,ts,jsx,tsx}` under `webview/src`, and the files are read with `fs`, never imported, so the bundle is unchanged.
- **`webview/src/utils/markdownFidelity.test.ts`** runs every corpus file through what the app does:
  1. the host's split, `canonicalMarkdownProjection`, and the join, imported from `src/`;
  2. `markdownToEditorHTML`;
  3. a ProseMirror parse with `markdownSchemaExtensions`, as `literalTildeRoundTrip.test.ts` does with `@mixmark-io/domino`;
  4. `DOMSerializer`;
  5. `editorHTMLToMarkdown`.

  It checks:
  - **byte identity,** after one save and after a second;
  - **the one-word edit:** a ProseMirror transaction types a word at the end of the last paragraph, and the line diff has exactly one line;
  - **the known and cleanup outputs,** and their stability;
  - **no loss:** the same text, link targets, marks and image sources after two saves;
  - **the negative fixtures;**
  - **the look baseline,** with R6's exceptions listed by file and node;
  - **no trailing whitespace** outside fenced code (R3).
- **CRLF and the BOM** are host-level. A coordinator-level test writes the CRLF and BOM files through `serializeSyncEdit` and `encodeDocumentBytes`, and expects the original bytes.
- The test joins `test:editor-sync` in `extensions/ritemark/package.json`. `pretest` runs that script, so the full test run covers it too.
- **The measuring harness** that runs the corpus over a folder and counts classes becomes `scripts/qa/markdown-fidelity-measure.mjs`. It is a QA tool, not part of the gate.

## Workstream 3: Lists come back as written (R1)

**The parse.** A `marked` renderer extension named `list` gets the full token. marked 9 passes built-in tokens to extension renderers of the same name, and returning `false` falls back to the default. The extension:
- renders the default HTML once, with a guard on the token so the second call falls through;
- puts these on the `<ul>` or `<ol>`:
  - `data-md-marker`, the bullet's character;
  - `data-md-delim`, `.` or `)`;
  - `data-md-pad`, the spaces after the first item's marker, 1 to 4;
  - `data-md-tight`, from `token.loose`;
  - `data-md-indent`, a nested list's spaces beyond its parent's content column, from the nested token's raw;
  - `data-md-attached`, when the list's previous sibling token is a paragraph with no `space` token between.

The `attached` flag needs sibling context. So the parse becomes `lexer`, then a small walk that marks tokens in every block array (top level, quotes, list items), then `parser`. That is the same output as `parse`.

**Tabs.** `marked` turns a leading tab into four spaces before it tokenizes, so a list's raw cannot show a tab. One document-level check on the source, a list line beginning with a tab, sets `data-md-tabs` on every nested list.

**The task split.** `transformTaskListElements` already clones the list's attributes into each run. It adds `data-md-continues="true"` to every run after the first, so the save joins them back into one list.

**The attributes on TipTap's nodes.**
- `BulletList`, `BoundedOrderedList` and `TaskList` each get these attributes: `mdMarker`, `mdDelim`, `mdPad`, `mdTight`, `mdIndent`, `mdTabs`, `mdAttached`, `mdContinues`.
- Each uses `parseHTML` from its `data-md-*` and `renderHTML` back to it, and `default: null`.
- They are data only. Nothing styles them, so the editor looks the same (R7).
- Each is a pure function of the source, with no counters or ids. So a host update's parse equals the editor's document wherever nothing changed. The structural apply (`Editor.tsx:788–812`) compares attributes through `findDiffStart`.

**The save.** New Turndown rules replace `list`, `listItem`, `tiptapTaskItem` and `tiptapTaskList`. They are added last, so they win:
- **The prefix:**
  - the marker and its padding from the parent list's attributes, or `-` and one space;
  - for an ordered list, `start + index` and the delimiter, or `.`;
  - for a task item, `[ ]` or `[x]` and a space after the marker.
- **The content column** is the marker plus its padding. Nested content is indented by it, plus `mdIndent` spaces, or by a tab under `mdTabs`.
- **Empty lines are never indented** (R3).
- **Tight or loose:**
  - Tight means `mdTight` is not `false` and no item holds two paragraphs.
  - Items are separated by one newline when tight, two when loose.
  - In a tight item, a paragraph rule returns its content with single newlines around it, so a nested list follows its text directly.
- **A task item's line breaks** stay breaks. The space-joining in `tiptapTaskItem` goes.
- **`mdAttached`:** the paragraph before such a list returns `\n\n…\n`, and the list returns `\n…`. Turndown's `join` takes the larger of the two newline counts, so both sides must use one.
- **`mdContinues`:** the earlier run returns a single trailing newline, and the later one a single leading newline.

## Workstream 4: Breaks, whitespace and the other forms (R2, R3, R4)

- **Breaks.**
  - A `br` renderer extension writes `<br data-md-break="soft|spaces|backslash">` from the token's raw (`\n`, `␠␠\n`, `\\\n`).
  - `HardBreak` gets `mdBreak`.
  - The Turndown `br` rule writes `\n` for soft, the raw spaces for `spaces`, `\` and a newline for backslash. With no attribute it writes R8's form: a backslash (pending question 3).
  - Under `mdBreak: soft`, a following line that would change meaning at the start of a line gets the line-start escape below.
- **Quotes.** The blockquote rule prefixes `> ` and writes an empty line as `>`.
- **Thematic breaks.** An `hr` renderer extension keeps the raw marker in `data-md-hr`, and `HorizontalRule` gets `mdHr`. The rule writes it, or `---` when there is none.
  - The one exception: a new break, one with no attribute, that is the first block of a document without front matter is written `***`. A file that starts with `---` can be read as front matter. A break the source wrote keeps its form, because it already opened as a break. Both cases are fixtures.
- **Links written bare.**
  - A `link` renderer extension adds `data-md-link="bare|angle"` when the raw does not start with `[`. `CustomLink` gets `mdLink`.
  - The rule writes the bare address, or `<address>`, only while the text still equals the address, `mailto:` aside. After an edit to the text it writes `[text](href)`.
- **Escapes.** `turndownService.ts`'s `escape` override, which already handles tildes:
  - **Underscores** between letters or digits are not escaped. CommonMark never reads an underscore inside a word as emphasis.
  - **Square brackets** are not escaped in a text run where no `](`, `][` or `]:` follows a `]`. A run at the start of a list item that begins with `[ ]`, `[x]` or `[X]` keeps its escape.
  - **Turndown's line-start escapes** move from every text run to the start of a line. They are a number and full stop, `-`, `+ `, `#`, `>` and `=`. The text-run escape is undone for them, and the paragraph rule escapes them at the start of each of its lines, after soft breaks too. A heading, a table cell, or text after bold never gets them.
  - `*`, backticks, backslashes and `~~~` keep today's escaping. The negative fixtures pin it.
- **Tables.**
  - A `table` renderer extension puts `data-md-delims`, the delimiter row's cells as written as JSON, and `data-md-spacing` (`spaced` or `compact`, from the header row) on the `<table>`.
  - The table node gets them as attributes. `TableHeader` and `TableCell` get `mdAlign` from the cell's `align`, rendered as `data-md-align`, not as an `align` or `style`, so the editor looks the same.
  - New `tableRow` and `tableCell` rules write the delimiter row from `mdDelims` while the column count matches. A changed table gets `---`, or `:---`, `---:` or `:---:` from `mdAlign`.
  - Cells follow the spacing, and an empty cell is `| |`.
  - `tableCellWithPipeEscape`'s pipe escaping stays.

## Workstream 5: Front matter (R5)

`serializeFrontMatter(properties, content)` (`ritemarkEditor.ts:1304`) gets the document's current text:
- **When the current text has front matter** (`splitCardText`) and `canonicalJson(properties)` equals `canonicalJson(matter(current).data)` after the same JSON round trip the webview's copy took, it returns:
  - the head;
  - the original newlines between the head and the body;
  - the body, with one trailing newline.
- **Otherwise** it uses `matter.stringify`, as today.

Dates are the reason for comparing after a JSON round trip. The host parses `2026-10-20` as a `Date`, and the webview sends back a string. The audit confirms this.

`splitCardText` moves from `taskBoard/cardFile.ts` to a shared place, or is imported as it is. It is generic: it splits on the opening and closing `---`.

## Workstream 6: Nothing is lost (R6)

- **Links into folders.**
  - `CustomLink.configure({ isAllowedUri })` uses TipTap's own default first (`ctx.defaultValidate`). It then also accepts a relative path that `isSafeRelativePath` accepts, and refuses what `classifyLinkTarget` calls dangerous.
  - The same option governs parse, render and `setLink`, so the link dialog can set such an address (S28).
  - A unit test pins the accepted and refused addresses.
- **Marks around code.** `Code.extend({ excludes: 'code' })`, so a link, bold, italic or strikethrough can sit on code. The input rule for backticks and the bubble menu's code button are checked in S33.
- **Images in a row.** A Turndown rule for an `<img>` whose parent is the root writes it as a block, with blank lines around it. `preprocessImageHTML` is unchanged; it no longer meets a row of images in one paragraph from Ritemark's own saves.

## Workstream 7: New writing in one plain form (R8)

These are the rules' defaults when an attribute is absent:
- `-` and one space;
- `.` after a number;
- tight;
- nested content at the content column;
- `---` for a break;
- the backslash for a line break.

New items inherit the list node's attributes, because they are list attributes, not item attributes. `createTurndownService()` gets the list, break and thematic-break defaults, so the Word preview's Save as Markdown and `App.tsx`'s copy write the same forms. Their outputs change (S36).

## Workstream 8: One question for a conflict (R10, R11)

**The shell (patch 014, one more file).** In `textFileSaveErrorHandler.ts`:
- **A new hand-over.** `onSaveError` gets an optional fourth parameter, `ritemarkDeclined?: boolean`. Its first line hands over:

  ```ts
  // Ritemark (patch 014): Ritemark's document sync answers save conflicts for documents its editor holds (#454).
  if (!ritemarkDeclined && this.handOverToRitemark(error, model, options)) { return; }
  ```

- **`handOverToRitemark`** returns true only when all of these hold:
  - the error is `FILE_MODIFIED_SINCE`;
  - the save did not come from VS Code's own conflict editor;
  - `editorService.findEditors(model.resource)` holds an editor whose `editorId` is `ritemark.editor`.
- **What it then does:** it runs `_ritemark.editorSync.answerSaveConflict` with the resource.
  - When the command resolves `true`, nothing more.
  - When it resolves anything else, or rejects (not registered, the extension is not running), it calls `this.onSaveError(error, model, options, true)`, so VS Code's notification shows as today.
- **Imports and tests.**
  - `ICommandService` is injected into the constructor. No other upstream line changes.
  - The decision is a small exported function (`shouldHandSaveConflictToRitemark(result, editorIds, fromConflictEditor)`).
  - A test file covers it, `src/vs/workbench/contrib/files/test/browser/ritemarkSaveConflict.test.ts`, as 014 already carries `textFileEditorModel.test.ts`.

**The extension.** `DocumentSyncCoordinator` registers `_ritemark.editorSync.answerSaveConflict(uri)`:
- **No record for the URI:** it returns `false`, and VS Code answers.
- **Otherwise** it reads the disk, runs `reconcile`, and acts on a pure decision `classifyRefusedSave(...)` in `editorSync/state.ts`:
  - **Conflict** (the disk's text differs from the base, and the model's differs from both): Review changes, as today. When no Ritemark view of the document is visible, one `showWarningMessage` names the file, with a Review changes button that reveals the panel. It returns `true`.
  - **Converged** (the disk equals the model): a same-content revert to refresh the etag, as the resolutions do. It returns `true`.
  - **Disk text unchanged** (the disk's logical text equals the base, so only its date, size or bytes moved): the Keep-my-version write, through `workspace.fs` and a same-content revert, with no question (R11). It returns `true`.
  - **Anything the decision can't place:** `false`.
- The decision's table and its tests come from the save-conflict audit.

The command is internal: it is not in `package.json`'s `contributes`, and the palette never shows it. Sprint 115's Keep my version and Use disk version already leave the model clean, and the audit confirms it (S41, S42).

## Interactions

- **Sprint 138 (equations, #481):**
  - It adds a `marked` math extension and a math node to the same pipeline.
  - 137 merges first, so 138 builds on `editorMarkdown.ts` and adds its fixtures to the corpus, where `$` in prose is checked byte for byte.
  - If 138 starts first, its math extension goes into `Editor.tsx`'s `editorMarked` and moves with Workstream 1.
- **Comment callouts:** their tokenizer is registered on the same `editorMarked`, lazily, behind the flag. Workstream 1 keeps that, and the corpus has a comment fixture.
- **TipTap 3 (#243):** node and mark attributes work the same there, so this sprint adds no TipTap 3 rework.
- **Synced folders (#499):** R11 is the save half of that check; S48 runs it.

## Tests

- **Unit tests:**
  - the corpus test (R9);
  - each new rule and attribute in `markdownAsWritten.test.ts`;
  - the escape changes, with the negative fixtures;
  - `CustomLink`'s accepted and refused addresses;
  - the front-matter splice;
  - `classifyRefusedSave`;
  - the VS Code hand-over test.
- **Existing tests:** `taskListRoundTrip`, `orderedListRoundTrip`, `orderedListTyping`, `strikethroughRoundTrip`, `literalTildeRoundTrip`, `imagePathRoundTrip`, `commentRoundTrip`, `editorValueReconciliation`, the `editorSync` tests and `saveAsMarkdown`. They move to the shared module and stay green. An assertion that pinned one of today's rewrites changes only with a corpus fixture that shows why.
- **CDP checks** in `scripts/qa/`:
  - open, edit and save a corpus file in a dev instance;
  - read the bytes;
  - the conflict: write the file from outside while typing, with no VS Code toast in the notification centre and Review changes in the bar.
- **The look,** S32's screenshots of `main` and the branch, light and dark.

## Risks inside the sprint

| Risk | Retirement |
|---|---|
| A list form the bound promises turns out not to round-trip in some nesting (the prototype's second-save instability) | Phase 1 finds the form and adds it to the corpus; R9's second save fails until it is fixed |
| Changing `Code`'s `excludes` changes editing around code | S33 runs the code input rule, the bubble menu and undo; if a behaviour changes, `excludes` lists the marks to allow (`link bold italic strike`) instead of none |
| Accepting more link addresses lets an unsafe one through | The check is TipTap's own default first, plus `isSafeRelativePath`; dangerous protocols stay refused (S31); the unit test pins both lists |
| The line-start escape move unescapes something that then becomes formatting | The negative fixtures, and a fixture per escape character at a line start after a soft break |
| The hand-over hides VS Code's notification when Ritemark can't answer | It hands over only when Ritemark's editor holds the document; any `false` or rejection shows VS Code's notification (S46) |
| `findEditors` misses a Ritemark editor in another window or a hidden group | The audit checks it; a miss falls back to VS Code's notification, never to silence |
| Patch 014 drifts at the next VS Code update | One file, one line at the top of `onSaveError`, one constructor parameter; the drift check at the merge (E5) |
| Old files change once (spaces on empty lines) | Question 4; said in the release notes |
| Save as Markdown's output changes | Intended (R8), and in the notes |
