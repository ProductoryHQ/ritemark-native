# Sprint 148 Technical Plan

The plan for [spec.md](spec.md). The release is 2.2.0 ([release-plan.md](../release-plan.md)). Code shapes here are proposals; when the code needs something else, this file changes first. File references are to `origin/main` at f84f4513 (1 November 2026). Paths are under `extensions/ritemark/` unless they say otherwise; `webview/…` is `extensions/ritemark/webview/src/…`. VS Code's own files were read in the main checkout's `vscode/` (this worktree has no submodule checked out). **The code was read for this plan, not run:** no dev instance, build or test was started, and no measurement was made.

## What exists today

| Part | Today | File |
|---|---|---|
| The Documents head | The project's name, then New and Search as rows, then the Documents label over the tree; each row is an extension command whose title and icon the shell draws; a row whose command isn't registered yet keeps its room (#569) | `patches/vscode/018-ritemark-surfaces.patch:5037` (`HEAD_PLACES`), `:5249` (the waiting row), `:2254` (its CSS) |
| What Search runs | VS Code's Search view | `src/views/projectHeadCommands.ts:60`; `package.json` (`ritemark.projectHead.search`, "Search", `$(search)`) |
| The tree | VS Code's Folders view: no `when`, `canToggleVisibility: false`; Documents is always a place (`hideIfEmpty: false`) | `vscode/src/vs/workbench/contrib/files/browser/explorerViewlet.ts:139–151`; `002-ritemark-ui-layout.patch:1402` |
| Views in Documents | None of Ritemark's: every Ritemark view lives in its own container | `package.json` `contributes.views` |
| The frame's manifest (approved, not built) | Sprint 152's PR 2 moves `HEAD_PLACES` into `branding/product.json`'s `ritemarkFrame`; the extension release check refuses views and head-row commands the manifest doesn't name | `docs/development/releases/v2.2.0/sprint-152-startup-contract/technical-plan.md` (Workstreams 4, 5, 7) |
| Listing files | `findFiles` passes `useIgnoreFiles: { local: false }`: no `.gitignore`. Home's recent files use it with `**/.*/**` and `node_modules` left out and a cap of 5,000 | `vscode/src/vs/workbench/api/common/extHostWorkspace.ts:478–485`; `src/views/HomePanel.ts:513–517`, `:33` |
| What Documents leaves out | `files.exclude`: `**/.ritemark`, `**/.claude/worktrees`; 018's filter hides a pointer-only root `CLAUDE.md` | `package.json:990–993`; `018-ritemark-surfaces.patch` (`FilesFilter`, `ritemarkIsPointer`) |
| Word on the host | A zip reader with capped inflate and the preview's limits (50 MB, 10,000 entries, 400 MB unpacked, bomb ratio), encryption and legacy-format checks | `src/officePreview/officePackageCheck.ts:18`, `:78`, `:154`, `:192` |
| PDF | pdf.js 5.4.296 (Apache-2.0) in the webview through `react-pdf` 10.4; a pure index over `getTextContent()` per page; the scanned threshold | `webview/package-lock.json:6431`; `webview/components/viewers/pdfSearchIndex.ts:55`; `webview/conversion/pdfToMarkdown.ts:62` |
| Matching text | Case folding that keeps offsets, used by the previews' find bars | `webview/utils/textSearch.ts` (`foldCase`, `normalizeQuery`, `findAll`); `webview/components/viewers/documentSearch.ts:30` |
| CSV, Markdown | `papaparse` and `marked` are host dependencies | `package.json` `dependencies` |
| Chats | One JSON record per chat under `<globalStorage>/conversations/v1/records`, an `index.json` beside them; events are `user-message`, `assistant-message`, `activity`, `attention`, `boundary`, `dispatch-receipt`; scoped by `projectScopeId` | `src/conversations/ConversationStore.ts:177`, `:211` (`list`), `:222` (`get`); `types.ts:77–152`, `:184`; `projectScope.ts:43` |
| Following chats | Home watches `index.json` and refreshes after 300 ms | `src/projects/projectsHost.ts:283–292` |
| Opening a chat | `openConversation(conversationId)` | `src/views/HomePanel.ts:46`; `src/projects/projectsHost.ts:38` |
| Tasks | A card is `.ritemark/tasks/<id>-<slug>.md`; the controller sends snapshots (title, Done when, stage, description, files, history) to subscribers | `src/taskBoard/cardFile.ts`; `BoardController.ts:266`; `protocol.ts:81–114` |
| Opening a card | `openCard({ cardId })` | `src/taskBoard/boardSurface.ts:33`, `:139–141` |
| The editor's find bar | Opened by ⌘F inside the Markdown page only; the previews have their own (`FindBarShell`) | `webview/App.tsx:377–395`, `:918`; `webview/components/viewers/PDFViewer.tsx:548`, `DOCXViewer.tsx` |
| One bundle, many pages | `main.tsx` reads `data-editor-type` and renders one page | `webview/main.tsx:73`, `:109–150` |
| Webview views kept alive | `retainContextWhenHidden` on the side views | `src/extension.ts:425`, `:597`, `:614` |
| The host's bundles | Two entries (`extension`, `browser/browserMcpAdapter`), CJS, `node20`; `external` lists native, runtime-asset and ESM-only packages | `esbuild.config.mjs:30–40`, `:65–80` |
| Kill switches | A boolean setting per flag, default on | `src/features/flags.ts:85` (`powerpoint-preview`); `package.json` (`ritemark.features.powerpoint-preview`) |
| VS Code's search | A place in More (order 1 among the other places) | `002-ritemark-ui-layout.patch:74` |

## Architecture overview

One new subsystem, `src/search/`, and one shell change. Nothing in the existing stores changes shape.

```
shell (018)                     extension host                               worker thread (out/search/searchWorker.js)
─────────────                   ──────────────                               ──────────────────────────────────────────
Documents head                  SearchHost                                   walk ─ ignore rules, dot folders, limits,
  └ Search row = field ──text──►  ├ the row's command                          │    cloud files
     ritemark.searchOpen          ├ watcher (**/*) ──batched events────────►   readers ─ Markdown (marked), CSV (papaparse),
  └ Folders view hidden            ├ chats feed (ConversationStore,              │         Word (zip reader), PDF (pdfjs-dist)
    while searchOpen               │   index.json) ──upsert───────────────►    word index ─ word starts → passages
explorer container                 ├ tasks feed (BoardController) ──upsert──►    │            query, ranking, passages, map
  └ ritemark.searchResults ◄───────┤ SearchViewProvider (webview view)  ◄──results── 
    (webview view, when            └ opens: editor, openConversation,           text cache ─ storageUri/search/v1 (Word, PDF)
     ritemark.searchOpen)              openCard; PR 4: find bar at the match
```

| Layer | Requirement | Where |
|---|---|---|
| The worker and the walker | R1, R4 | `src/search/worker/searchWorker.ts` (entry), `walk.ts`, `cloudFiles.ts`; `esbuild.config.mjs` (one entry) |
| The readers | R2 | `src/search/worker/readers/{markdown,csv,docx,pdf}.ts`; `src/officePreview/officePackageCheck.ts` (its zip reader exported as it is); `webview/components/viewers/pdfSearchIndex.ts` (imported) |
| The word index | R5, R10 | `src/search/worker/wordIndex.ts`, `textCache.ts`; `webview/utils/textSearch.ts` (`foldCase`, imported) |
| The sources | R3 | `src/search/sources/chats.ts`, `tasks.ts` |
| The host | R4, R8, E3 | `src/search/SearchHost.ts`, `searchWorkerClient.ts`; `src/extension.ts` (one call) |
| The protocol | R10 | `src/search/protocol.ts` (types the webview imports, as the board's) |
| The view | R6, R8 | `src/search/SearchViewProvider.ts`; `webview/components/search/` (`SearchPanel.tsx`, `ResultRow.tsx`, `MoreOptions.tsx`, `searchStore.ts`); `webview/main.tsx` (one route) |
| The Search row and ⌘⇧F | R7, E3 | `src/views/projectHeadCommands.ts`; `package.json` (the view, its `when`, the keybinding, the setting); `src/features/flags.ts` |
| The box and the swap | R7 | patch 018: `ritemarkProjectHead.ts`, the Folders view's descriptor (by A1), `ritemarkSurfaces.css` |
| At the passage | R9 | `src/ritemarkEditor.ts` (one message), `webview/App.tsx` (the find bar opened with words), `src/pdfEditorProvider.ts` + `PDFViewer.tsx`, `src/officePreview/officePreviewProvider.ts` + `DOCXViewer.tsx` |

**Release tier: shell**, by patch 018 (PR 3). The per-PR tiers are in the sprint plan.

## Phase 1: audits

Nothing here is code. Each audit is one file in `research/` and comes before the workstream it gates. A requirement whose audit changes it changes in `spec.md` first.

1. **A1, `research/head-swap.md` (R7; before W7).** On a CoW-cloned, patched `vscode/`: (a) with a `when` on the Folders view's descriptor, whether the tree comes back with the same folders open, the same scroll and the same selection after it's hidden and shown (the view's state is saved on dispose), whether New ▸ File and New ▸ Folder, Reveal in Finder and the explorer's auto-reveal of the open document still work after, and whether any other view (Open Editors, Outline, Timeline) is visible in Documents, which would bring back pane headers; if the state is lost, the other mechanism (the tree kept mounted and its pane hidden by the head while results show) is tried and the audit says which is taken. (b) A webview view contributed to the `explorer` container with a `when` shows merged with the container (no header) when it's the only visible view. (c) Where VS Code's search is reached once the Search row changes: More's Search place, ⌘⇧F today, All commands (patch 003's filter). (d) What a field in the head needs from 018's CSS (height 32, padding, the focus look) so the row's room doesn't change.
2. **A2, `research/pdf-in-worker.md` (R2; before W2's PDF reader).** Whether `pdfjs-dist` 5.4.296's Node build (`legacy/build/pdf.mjs`) can be inlined by esbuild into a CJS worker bundle (top-level `await`, its fake worker loaded through a static import of `pdf.worker.mjs`, no dynamic path left); whether text extraction runs with no canvas package (`DOMMatrix` and `Path2D` stubs if it asks); `buildPdfSearchIndex` on the fixture PDFs (text, a scanned one, Estonian letters, 500 pages, a damaged one); the bundle's size. If it can't be inlined: `pdfjs-dist` as an esbuild external loaded through `new Function('return import(...)')`, as the agent SDKs are, which ships only with a shell release.
3. **A3, `research/word-text.md` (R2; before W2's Word reader).** `word/document.xml` through `readZipDirectory` and the capped inflate on fixtures: runs split by formatting, tabs, breaks, tables, fields (a page number is no word), text boxes; whether footnotes and comments matter (proposed: not in 148); the encrypted and legacy cases through `checkOfficePackage`.
4. **A4, `research/walk-and-cloud.md` (R1; before W1's merge).** `ignore` on a fixture of nested `.gitignore` files, negations, a folder rule, `.git/info/exclude` and Windows paths; symbolic links; `files.exclude` read and applied. Cloud files: on the Mac, an iCloud Drive or OneDrive file evicted to the cloud has `size > 0` and `blocks === 0`, and reading only its `stat` doesn't download it. On Windows, how an online-only OneDrive file is known without reading it (its attributes through one listing per walk, or the folder's place under the `OneDrive*` environment variables), checked through the overlay with a file set to online-only; until one is proven, nothing under those folders is read on Windows (R1).
5. **A5, `research/chats-and-tasks.md` (R3, R8; before W4).** Which fields of `user-message` and `assistant-message` hold the words, and how big the largest records are on a test profile; the project's scope id from the host; whether the AI view can scroll to a message today, or what one optional field on its open message needs (the chat-at-message cut is second in the cut order); which card fields the snapshot carries for archived cards.

## Workstream 1: the worker and the walker (R1, R4, PR 1)

After A4.

- **One worker per window,** started by `SearchHost` with `new Worker(path.join(context.extensionPath, 'out', 'search', 'searchWorker.js'), { resourceLimits: { maxOldGenerationSizeMb: 512 } })`. Started on the box's first focus or 5 s after activation (R4). A crash or a memory stop: one restart with half the limits, then the not-available state.
- **The walk:** `fs.readdir` with file types from each project folder; skip names starting with a dot, `node_modules`, symbolic links to folders, `files.exclude` (read in the host, passed in as globs), and what the `.gitignore` files and `.git/info/exclude` ignore (`ignore`, each file's rules relative to its folder). Keep the four extensions; Office lock files out; the pointer-only root `CLAUDE.md` out (the same test 018 uses: its only content is `@AGENTS.md`).
- **Cloud files** (`cloudFiles.ts`): the Mac's dataless test on `stat`; Windows' by A4.
- **Order and limits:** documents sorted newest first; the text budget (2 MB each, 200 MB in all) spent in that order; past 20,000 documents or the budget, the rest are names only and the index reports `limited`.
- **Events:** `SearchHost` watches `**/*` in each folder (`createFileSystemWatcher`, as `taskBoardHost.ts:193` does) and forwards batched creates, changes and deletes every 300 ms; the worker filters them by the walk's rules, re-reads a changed file once its size has held for 500 ms, and walks again when a `.gitignore` changes.
- **Tests:** `walk.test.ts` on the checked-in fixture tree (what's in, what's out, limits, the pointer file), `freshness.test.ts` with a fake clock and fake events.

## Workstream 2: the readers (R2, PR 1)

After A2 and A3. Each reader is pure over bytes and returns `{ passages: { text, at }[] }`, `at` being a block index, a page or a row.

- **Markdown:** `marked.lexer`, walked for text tokens; headings, paragraphs, list items, table rows, quotes as passages; front matter, link targets, image paths and HTML left out; a comment's words kept (its mark is HTML-like in the file, so the reader keeps its body text).
- **CSV:** `papaparse` with quotes; each row a passage, its cells joined with " · ".
- **Word:** `readZipDirectory` and the capped inflate, exported from `officePackageCheck.ts` as they are (no behaviour change for the preview); `checkOfficePackage` first, with the preview's limits; `word/document.xml` scanned for `w:p`, `w:t`, `w:tab`, `w:br`, `w:tc`.
- **PDF:** `pdfjs-dist` by A2's route; `buildPdfSearchIndex` imported from the webview's module (it is pure and DOM-free) so the passages are the preview's chunks; a passage per run of chunks within a block, with its page; scanned PDFs name only.
- **Tests:** `readers.test.ts` on the fixtures, one case per kind and per refusal.

## Workstream 3: the word index and the query (R5, R10, PR 1)

- **Terms:** each passage's text split at every character that is not a letter or a digit (`\p{L}\p{N}`), each word case-folded with `foldCase` (imported from `webview/utils/textSearch.ts`, so the list and the find bar fold the same way), letters with marks kept. A term table maps a term to its postings (document, passage); a sorted array of terms finds every term with a prefix by binary search.
- **A query:** its words, each looked up by prefix (or exactly, with Whole words only); the documents that have every word; Match capital letters checks the hits in the passage's own text. Ranking as R5. The first passage with a hit, cut to about 160 characters around it, with the marks.
- **Names** are passages too, with a `name` flag and the highest rank.
- **150's two questions:** `passages(words, limit = 20)` returns the best passages for a list of words; `map()` returns each document's path, name and first line. Both covered by tests; no screen.
- **The text cache** (decision 3, `textCache.ts`): one file per Word or PDF document under `context.storageUri/search/v1/`, named by a hash of its path, holding its size, change time, reader version and passages; read when all three match; an entry dropped at once when the watcher reports its document deleted, or renamed away (a rename writes the new path's entry when it's read again); the oldest dropped past 200 MB; the folder dropped when the reader version changes. A sweep at index start drops entries whose document is gone, for deletions made while Ritemark was closed. (Codex's review of #628: decision 3 promises the copy goes with the file.)
- **Tests:** `wordIndex.test.ts` (prefix, all words, whole words, capitals, marks, ranking, the passage cut, a newer query, `passages`, `map`), `textCache.test.ts` (including: a deleted document's entry goes; a renamed one's old entry goes; the start sweep drops an orphan).

## Workstream 4: chats and tasks (R3, PR 1)

After A5.

- **Chats:** the host lists the project's chats (`ConversationStore.list(scopeId)`), reads each record, and sends the worker one entry per chat: its id, title, last activity and its messages' words (person and AI; 1 MB at most). It watches `index.json` as Home does and re-sends a chat whose revision moved; a deleted chat is removed.
- **Tasks:** the host subscribes to `BoardController` and sends the cards (id, title, Done when, description, state) on each snapshot, as a replacement of the set.
- **Tests:** `sources.test.ts` with a fake store and a fake board.

## Workstream 5: the results view and the protocol (R6, R8, R10, PR 2)

- **The view:** `ritemark.searchResults`, a webview view in the `explorer` container, `when: ritemark.searchOpen`, `retainContextWhenHidden`, built as the other side views build their HTML (the same CSP and nonce); `data-editor-type="search"` routes `main.tsx` to `SearchPanel`.
- **The protocol** (`src/search/protocol.ts`), a proposal:

```ts
type SearchKind = 'document' | 'chat' | 'task';
type SearchLayer = 'words' | 'meaning';            // 'meaning' is Sprint 150's
interface SearchResult {
  key: string;                                      // the kind and the document's URI, chat id or card id
  kind: SearchKind; layer: SearchLayer;
  name: string; where: string | null; changedAt: string;
  passage: { text: string; marks: [number, number][]; at: { block?: number; page?: number; row?: number; eventId?: string } } | null;
  matchIndex: number | null;                        // which match in the document, for R9
  why?: string;                                     // Sprint 150
}
// host → view
{ type: 'search/results'; queryId: number; layer: SearchLayer; groups: { kind: SearchKind; total: number; results: SearchResult[] }[];
  reading: { done: number; total: number } | null; limited: boolean; unavailable?: true; answer?: unknown /* Sprint 150 */ }
{ type: 'search/focus-first' }
// view → host
{ type: 'search/open'; key: string } | { type: 'search/options'; matchCase: boolean; wholeWords: boolean; kinds: SearchKind[] }
| { type: 'search/more'; kind: SearchKind } | { type: 'search/back-to-box' }
```

- **The panel:** the count line and More (frame 1); More's options and the kinds with their counts (frame 5, without Replace); the groups and rows (the lead's answers to questions 4 and 5); the states (questions 1 and 2); the keyboard of R8 inside the list, with `search/back-to-box` for ↑ on the first row and Esc. Built from `components/ui/` (Sprint 146's controls and their focus rule), no local restyle.
- **Opening:** a document through `vscode.commands.executeCommand('vscode.open', uri)` (its usual editor); a chat through the same `openConversation` Home uses, with the message in view by A5's route; a task through `openCard({ cardId })`.
- **Tests:** render tests of the panel (groups, counts, states, marks), the store (a newer query wins), and the protocol's validation.

## Workstream 6: the Search row, ⌘⇧F and the kill switch (R7, E3, PR 2)

- **The row's command** (`projectHeadCommands.ts`): `ritemark.projectHead.search` takes an optional argument from the shell's field: `{ text }` runs a query (an empty text clears), `{ key: 'down' }` sends `search/focus-first`, `{ key: 'enter' }` opens the top result. Called with no argument (an older shell, a key binding): with the kill switch on and a shell that has the field, it focuses the box (`_ritemark.projectHead.focusSearch`); otherwise it runs `workbench.view.search`, as today.
- **⌘⇧F** (Ctrl+Shift+F on Windows): a key binding to `ritemark.projectHead.search` while the kill switch is on (decision 1); VS Code's own stays registered and reachable from More's Search place.
- **The kill switch:** the `project-search` flag and its setting, as `powerpoint-preview`; off, the index isn't started and the command runs VS Code's search, whatever its argument (a click, `{ text }`, a key).
- **The kill switch and the shell's field (with PR 3):** the extension sets a context key, `ritemark.projectSearch.enabled`, from the flag at start and on change. The shell draws the field only while it is true; while it is false, the Search row is the plain row it is today and opens VS Code's search, and the shell never sets `ritemark.searchOpen` or hides the tree. A test with PR 3 applied covers the flag off: a click, typed text and ⌘⇧F all reach VS Code's search, and the tree stays. (Codex's review of #628.)
- **Tests:** `projectHeadCommands.test.ts` grows the argument cases and the fallback.

## Workstream 7: the box and the swap (R7, PR 3)

After A1, on a CoW-cloned, patched `vscode/`.

- **A field row** in `ritemarkProjectHead.ts`: `IRitemarkHeadRow` gains `field: true`, and Documents' Search row sets it. The row draws an `input` with the command's icon, its title as the placeholder and the accessible name, and a clear button (tooltip through the hover service) once it holds text. On input it runs the command with `{ text }`; ↓ and Enter run it with `{ key }`; Esc clears and runs it with `{ text: '' }`, or, when already empty, gives the focus back to the desk. The text stays in the head while the person goes to another place.
- **`_ritemark.projectHead.focusSearch`**, registered by the head: shows Documents, focuses the field, and sets its text when given one.
- **The context key `ritemark.searchOpen`,** set by the head while the field holds text.
- **The swap,** by A1's mechanism: the Folders view hidden while `ritemark.searchOpen` (proposed: a `when` on its descriptor in `explorerViewlet.ts`), and the Documents label hidden; the extension's view shows in their place. New while searching clears the field first.
- **The room:** the field is 32 high in the row's place, so the rows' height and the content's top don't change; a field whose command isn't registered yet keeps its room as a row does (#569).
- **The manifest:** if Sprint 152's PR 2 is on `main` first, the Documents head's Search entry becomes a field row in `ritemarkFrame`, and `ritemark.searchResults` is listed among its views, so the extension release check accepts it.
- **Tests:** a unit test of the field's command arguments and the context key (`./scripts/test.sh --grep Ritemark`); `./scripts/apply-patches.sh --dry-run`; the frame check with JOINS ok; the swap and back on a dev instance, Light and Dark.
- **Docs:** `CLAUDE.md`'s patch table (018), `layout-invariants.md` (the Documents head's box).

## Workstream 8: at the passage (R9, PR 4)

- **What is passed:** not the person's words. The word index's prefix-and-AND match can't be found again by a find bar that looks for one literal run of text (`SearchExtension`, `findDocumentMatches`). So the result carries the concrete match from the index: the first hit's exact text as it stands in the document (the matched word, at its full length) and which occurrence of that text it is. The message carries those, and the find bar searches that literal and steps to that occurrence. A test for `rep ann` matching "Annual report" lands on the shown passage. (Codex's review of #628.)
- **Markdown:** one host-to-page message, `find:open { text, occurrence }`, posted by `ritemarkEditor.ts` to the document's page after `vscode.open` resolves; `App.tsx` opens its find bar with that text and steps to that occurrence, as ⌘F and Enter do. No document state is read or sent.
- **Word and PDF:** the same message through `officePreviewProvider.ts` and `pdfEditorProvider.ts` to `FindBarShell` in `DOCXViewer.tsx` and `PDFViewer.tsx`; a PDF match carries its page.
- **Tests:** a unit test of each page's handler (opens, steps, no edit); a dev instance on the fixtures; Windows through the overlay.

## Measurements

Named here and made in the sprint; the results go in `research/measurements.md`.

- **The large folder:** `scripts/qa/search-fixture.mjs` writes it under `/private/tmp`: 10,000 Markdown files of public-domain text in nested folders, 300 Word files and 300 PDFs made with the extension's own `docx` and `pdfkit`, 200 CSV files, 20 scanned-style PDFs, a `node_modules`, dot folders, an ignored folder. No client material.
- **M1, the index's time** on the large folder: cold (no cache) and warm (cache), by kind, and the worker's memory peak; on the Mac and on Windows (with Defender).
- **M2, a key to results drawn:** in a dev instance, CDP key events into the box, the time to the results' paint (the page posts a mark back), median and 95th percentile over 200 keys; the worker's query time alone.
- **M3, the host during a cold index:** `perf_hooks.monitorEventLoopDelay` in the extension host, logged as counts to the output channel, 95th percentile.
- **M4, the start:** Sprint 152's first-frame check if merged, else `project-check.mjs --measure 10`, with the kill switch on and off.
- **M5, the first results in a new window:** from the box's first key to the first paint.
- **M6, freshness:** a saved Markdown change to its result.

## Coordination

- **Sprint 146's shell PR (its PR 4)** changes 018 (and 016, 019): PR 3 starts its code after A1 and merges after it.
- **Sprint 152's PR 2** changes `ritemarkProjectHead.ts` and adds the manifest: PR 3 and it are never in review at once. If 152's is first, PR 3 adds the field row and the view to the manifest; if PR 3 is first, 152's carries them in. If 152's PR 2 moves to 2.3 (its cut order), PR 3 changes `HEAD_PLACES` directly.
- **Sprint 147** doesn't touch the head or the explorer.
- **Sprint 150** builds on R10's protocol and the index's `passages` and `map`.

## Risks inside the sprint

| Risk | Retirement |
|---|---|
| pdf.js won't inline into a CJS worker bundle | A2 first; the external route as the fallback (shell release only); PDF text is fourth in the cut order |
| pdf.js in Node asks for a canvas package (native) | Text extraction needs no drawing: stubs for what it asks, by A2; never `@napi-rs/canvas` |
| The index downloads a cloud folder | R1's rule; A4 on both systems; nothing read under OneDrive on Windows until A4 proves a test |
| A big folder stalls the host or fills memory | The worker; the 512 MB cap and the restart with half limits; the text budget; M1, M3 |
| Hiding the Folders view loses its state | A1 decides the mechanism before W7's code |
| The swap moves the head or the tree | The field takes the row's room; the frame check; Sprint 145's waiting row |
| `.gitignore` rules differ from Git's in an edge case | `ignore` follows Git's rules; A4's fixture; a miss shows a file Git ignores, never hides a document |
| Two results models by the time 150 starts | R10's protocol carries the layer and the room now; 150 adds, doesn't replace |
| PR 3 meets 146's and 152's shell PRs | *Coordination* above |
| The webview bundle grows | The panel is small; the readers are in the worker's bundle, not the webview's; E4 measures |
| Chat records are large | 1 MB of message text per chat; activity left out; A5 measures the largest |
| Disk is tight | The large folder under `/private/tmp`, removed after; a CoW-cloned `vscode/` for PR 3; the hygiene report first |
