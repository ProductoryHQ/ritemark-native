# Sprint 148 Spec: Search, the words layer

## Purpose

Project search today is VS Code's: a field with toggles and glob patterns, results as lines of files, nothing from chats or tasks, and since 2.1 it lists what's in `.claude` too. For the people Ritemark is for, it finds little they can use. This sprint builds the first layer of Ritemark's own search (#591, experience 8): one box under New that finds what has your words as you type, in documents, chats and tasks, grouped by kind, with no AI and nothing sent anywhere. Sprint 150 adds the meaning layer on Enter; this layer works alone, and its results stay when there's no AI.

## Principles

- **Words, not lines.** A result is a document, a chat or a task, with the words around its first match.
- **At once.** Each key shows results; nothing waits for a button or a model.
- **On this computer.** No network, no AI, nothing written into the project.
- **The person's documents only.** Ritemark's own folders, the AIs' folders, other dot folders, `node_modules` and what Git ignores stay out.
- **Off the host's main thread.** Reading and searching never stall a chat.
- **The shell draws the frame, the extension draws inside it** (Sprint 152's rule): the box and the swap are 018's; the results are the extension's.
- **Room for the meaning layer** without a second walk or a second result model.

## Requirements

### R1: What the index covers, and what it leaves out

As someone with a project folder, I want search to look at my documents and nothing that isn't mine.

Acceptance criteria:
- **It covers each folder of the window's project.**
- **Documents** are `.md`, `.markdown`, `.docx`, `.pdf` and `.csv` files, found by their names and their text (R2). A document's name is its file name without the extension, as the tree shows it; the root `AGENTS.md` is About this project, as patch 018 names it.
- **It leaves out:** every file and folder whose name starts with a dot (`.ritemark`, `.claude`, `.git`, `.github` and the rest); `node_modules`; what the project's `.gitignore` files and `.git/info/exclude` ignore, whether or not Git is installed; the person's `files.exclude` (which already holds `**/.ritemark` and `**/.claude/worktrees`); folders reached through a symbolic link; Office's lock files (`~$name.docx`); and the root `CLAUDE.md` while it is only Ritemark's pointer line, as Documents hides it.
- **Limits** (M1 confirmed them and changed one, 1 November; `research/measurements.md`): at most 20,000 documents read inside, the most recently changed first whatever their kind; Markdown and CSV read up to 10 MB, Word up to the preview's 50 MB and its package checks (`OFFICE_PREVIEW_LIMITS`), PDF up to 50 MB; at most 2 MB of text kept per document and 80 MB in all (proposed 200 MB: the worker's heap grows about 3.2 MB for each MB of text above ~175 MB, and its cap is 512 MB). A file past a limit is found by its name, and the line of R6 says the project is past them.
- **A file kept only online is never downloaded.** On the Mac, a file with a size and no blocks on disk (iCloud Drive's and OneDrive's dataless files) is found by its name. On Windows, OneDrive's online-only files are found by their names by the mechanism A4 proves; until A4 has one, the index reads no file under a OneDrive folder on Windows and finds them by name.
- **Nothing is written into the project's folder.**

### R2: Text from Markdown, Word, PDF and CSV

As someone whose documents come in four kinds, I want the words inside each found.

Acceptance criteria:
- **Markdown:** the text a reader sees (headings, paragraphs, list items, table cells, quotes, a comment's words), through `marked`'s lexer; front matter, link targets, image paths and HTML tags are left out. A passage is a heading, a paragraph, a list item or a table row.
- **Word:** the body's text, from `word/document.xml` through the Office preview's zip reader and its limits (`src/officePreview/officePackageCheck.ts`): runs, tabs and line breaks, one passage per paragraph and per table cell. A password-protected file, a damaged one and a legacy `.doc` are found by name.
- **PDF:** each page's text through pdf.js (`pdfjs-dist`, the webview's version), with the PDF preview's own index (`buildPdfSearchIndex`), so the text the list searches is the text the preview's find bar searches. A passage is a line run of a page and carries its page number. A PDF with less text than the preview's scanned threshold (`SCANNED_PDF_TEXT_THRESHOLD`) is found by name.
- **CSV:** rows through `papaparse` (quotes and line breaks inside quotes kept); a passage is a row, shown as its cells with " · " between.
- **Reading never runs on the extension host's main thread** (E1).
- A file that fails to read is found by name, and the failure is counted, not shown one by one.

### R3: Chats and tasks

As someone whose decisions often live in a chat or on a card, I want those found too.

Acceptance criteria:
- **Chats:** this project's chats from the conversation store (filtered by the project's scope), by their titles and the words of the person's and the AI's messages; tool activity, approvals and receipts are left out. A passage is one message. A deleted chat never shows. At most 1 MB of message text per chat (proposed).
- **Tasks:** this project's cards from the Task board's snapshots, by their title, Done when and description; archived cards too, with their state. The card files in `.ritemark/tasks/` are not read as documents.
- **Comment tasks are not a source of their own:** a comment's words are found in its document, and an agent's run on it in its chat.

### R4: Fresh, from the start and after every change

As someone who just saved a document, I want search to find what I wrote.

Acceptance criteria:
- **It starts after the window has settled:** on the first focus of the box, or 5 s after the extension starts, whichever comes first, so it adds nothing to the start (E1).
- **A saved change, a new file, a removed one or a rename** shows in the results within 2 s for Markdown and CSV, and once read for Word and PDF.
- **A changed `.gitignore`** walks the folder again.
- **Chats** follow the store's index file, as Home does; **tasks** follow the board's snapshots.
- **After a restart,** Markdown and CSV are read again; Word and PDF text comes from the copy kept on this computer when the file's size and change time still match (decision 3).
- **If the worker stops** (its memory cap, a crash), it starts once more with half the limits; if it stops again, the box says search isn't available in this project and the Search row's other way, VS Code's search, stays in More.

### R5: Words from their start, as you type

As someone looking for something, I want each key to narrow what I see.

Acceptance criteria:
- **From two characters.** With one, nothing shows yet and no line says nothing was found.
- **Each word of the box starts a word** in the document's name or text, in any order: "report" finds "reports" and "reporting", not "unreported". All words must be found.
- **Capitals don't matter,** unless Match capital letters is on.
- **A letter typed without its mark finds it with one; a mark typed finds only itself** (the Experience lead, question 7, 1 November): "kasi" finds "kasi" and "käsi", and "käsi" finds only "käsi". Š, ž and the marks of other languages follow the same rule ("Muller" finds "Müller", "Jose" finds "José"). No option is added for it; More keeps its two.
- **Whole words only:** each word must be a whole word.
- **Order within a kind:** a hit in the name first; then a hit with the exact letters typed before one found without its marks ("kasi" puts "kasi" before "käsi"); then the words together as typed; then more hits; then the most recently changed.
- **A result** shows its name, one muted word for where it lives (the folder's name, nothing at the project's root; a task's state; a chat's age), and its first matching passage, about two lines, with each matching part marked. A hit in the name alone shows no passage.
- **A newer query replaces an older one;** results for an older query are never drawn over newer ones.

### R6: Grouped by kind, and the states

As someone reading the results, I want to see at once what kind each thing is, and why the list is short when it is.

Acceptance criteria:
- **Groups in this order:** Documents, Chats, Tasks, each under its heading with its count, as frame 1 draws; a group with no results doesn't show.
- **The count line** above the groups ("1 result with these words") and More, as drawn. More holds Match capital letters, Whole words only and the kinds with their counts (frame 5), and not Replace (decision 2).
- **A long group** shows its first rows and a row for the rest (the lead's number and words, question 5).
- **Still reading:** the results found so far show, with one line saying the index is still reading (question 2); no spinner over the column.
- **Nothing found:** one line (question 1). In Sprint 150 the Search by meaning row comes first and is chosen, as drawn.
- **Past the limits:** one line (question 2). **Not available** (R4): one line.

### R7: The box under New, and the column that becomes the results

As someone in a project, I want the box where Search is today, and my documents back when I'm done.

Acceptance criteria:
- **On Documents, the head's Search row is the box.** At rest it reads as today's row; a click or ⌘⇧F (decision 1) puts the caret in it.
- **Typing shows the results in the left column** in place of the Documents label and the tree, under the box, which stays where it is.
- **Clearing the box** (its ×, deleting its words, or Esc) **brings the documents back as they were:** the same folders open, the same scroll, the same selection.
- **The box keeps its words** when the person goes to another place and back.
- **New while searching** clears the box first, then opens its menu (its File and Folder items work in the tree).
- **The head doesn't move:** the box takes the Search row's room from the first frame, and the content under it doesn't jump when the results come or go (Sprint 145's #569 rule; Sprint 152's slots once merged).
- **Tasks', Agents' and Home's own Search rows don't change.**
- **On a shell without the box** (a 2.1 shell with a newer extension) and with the kill switch off, the Search row opens VS Code's search, as today (E3).

### R8: The keyboard, and opening a result

As someone with my hands on the keyboard, I want to reach and open a result without the mouse.

Acceptance criteria:
- **↓ from the box** moves to the first result; ↑ and ↓ move through the results; ↑ on the first result goes back to the box; Esc in the results goes back to the box.
- **Enter in the box** opens the top result (question 6). In Sprint 150 it runs Search by meaning instead.
- **Enter or a click on a result opens it:** a document in its usual editor (Markdown in Ritemark, Word and PDF in their previews, CSV in the table), at its top until R9; a chat on the AI's sheet with the matching message in view; a task as its card's page.
- **The results stay** after an open, so the next one is one key away.
- **Each result row** is reachable and named for a screen reader: its kind, its name and its passage.

### R9: A document opens at its passage

As someone who found a word on page 30, I want to land on page 30.

Acceptance criteria:
- **A Markdown document** opens with its find bar open, holding the words, on the match the result showed.
- **A Word or PDF preview** opens the same way with its own find bar.
- **A CSV** opens at its top, as today (the table has no find bar).
- **The find bar** behaves as when ⌘F opened it: Esc closes it, Enter steps to the next match.
- **Nothing in the document changes:** no edit, no save, no change to the editor's undo.

### R10: Room for the meaning layer

As Sprint 150, I want to stream places under these results without a second index or a second model.

Acceptance criteria:
- **One result model for both layers:** each result says which layer found it (`words` now, `meaning` in 150), and has room for a one-line why and for an answer line above the groups, both unused here.
- **Results stream by query:** the view draws the words layer's results for a query at once, and can take later results for the same query under or in place of them; results for an older query are dropped.
- **The index answers 150's two questions** without a second walk: the best passages for a list of words (a paragraph, a message or a table's matching rows; at most 20), and the project's map (each document's path, name and first line). Unit tests; no screen.

## Engineering requirements

### E1: Speed, and a host that stays responsive

Targets, measured on the large generated folder (technical plan, *Measurements*), on the Mac and through the overlay on Windows:
- **A key to results drawn:** median at most 50 ms, 95th percentile at most 100 ms, with the index read (M2). The worker's own query at most 15 ms at the 95th percentile.
- **A cold index:** Markdown and CSV searchable within 15 s; Word and PDF reported (M1). **A warm start:** searchable within 3 s (M1).
- **The host during a cold index:** its event-loop delay at most 20 ms at the 95th percentile (M3).
- **The start unchanged:** the first-frame check from Sprint 152 if it's on `main`, else `project-check.mjs --measure 10`, with the index on and off (M4).
- **The first results in a new window** (the view's first load and the index's first read) are reported (M5); **freshness** within R4's 2 s (M6).
- **The worker's memory** peak is reported, and its heap is capped at 512 MB.

A target missed goes into `research/measurements.md` with its cause, and the Development manager decides: change the limit, take the cut, or accept it.

### E2: On this computer only

- No network request and no AI call anywhere in this sprint's code.
- Nothing is written into the project. The only copies are decision 3's, in the extension's storage for the project.
- No usage event. Logs carry counts and timings only: no words, names or paths.

### E3: The kill switch, and older shells

- `ritemark.features.project-search`, on by default, as `powerpoint-preview`: off, the Search row opens VS Code's search and the index never starts. On a shell with the box, the extension's context key `ritemark.projectSearch.enabled` tells the shell: with it false, the shell draws the plain row, a click, typed text and ⌘⇧F all reach VS Code's search, and the tree never hides. Tested with PR 3 applied.
- The extension works on a shell without the box: the Search row's command called with no words opens VS Code's search, and the results view's `when` is never true there.

### E4: Dependencies, the bundle and the tier

- **New dependencies:** `pdfjs-dist` (Apache-2.0, the webview's version, 5.4.296) and `ignore` (MIT). Both are free software and plain JavaScript, with no native code.
- **Inlined into a new esbuild entry,** `out/search/searchWorker.js`, the worker's own bundle, so an extension release can carry them (`out/**/*.js` ships). If A2 shows `pdfjs-dist` can't be inlined, it goes on esbuild's `external` list, ships only with a shell release (2.2 is one), and `check-bundled-extension-complete.sh` covers it; the PR says so.
- **Bundle-safe:** the worker is found through `context.extensionPath`, never `__dirname` depth; no dynamic path left in the bundle.
- **Licences:** the worker's bundle keeps its dependencies' licence comments.
- **`media/webview.js`** measured before and after (`notes/bundle.md`).
- **Tier:** shell, by patch 018 (PR 3). The PRs' tiers are in the sprint plan.

### E5: Docs

`docs/development/architecture.md` (Search as a subsystem: the worker, its sources, the view, the shell's box); `CLAUDE.md`'s patch table (018: the field row and the swap) and its repository structure (`src/search/`); `layout-invariants.md` (the Documents head's box); `docs/CHANGELOG.md`; the release notes lines through the `release-notes` skill.

## Non-Requirements

- The meaning layer: Enter, the AI's small model, places, the answer line, Continue in chat (Sprint 150).
- Search all projects, and search on Home (experience 18).
- Replace (decision 2).
- Text from plain text, web pages, Excel and PowerPoint files.
- An index of meanings kept on the computer (experience 8, *Not on it*).
- What an open document holds but hasn't saved: Ritemark saves on its own, so the results follow the file within seconds.
- Regular expressions and include or exclude patterns: they stay in VS Code's search.

## Decisions

Three, for the Development manager, each with a recommendation. The sprint plan carries the same list in plain words.

1. **The Search row and ⌘⇧F open Ritemark's search;** VS Code's search stays in More. Recommended: yes.
2. **Replace waits** for its own sprint, High; More holds the options and the kinds. Recommended: yes. The other answer: Replace in Markdown only, as a fifth PR, High, cut first.
3. **Word and PDF text is kept on this computer,** in Ritemark's storage for the project, at most 200 MB. Recommended: yes. The other answer: read again at every start.

The Experience lead answered the sprint plan's seven questions on 1 November (ritemark-dev `releases/v2.2.0/analysis/2026-11-01-sprint-148-experience-answers.md`). Question 7 changed R5 above: letters typed without their marks find marked ones, a typed mark finds only itself, and the exact letters rank first. The other six concern the panel (PR 2) and change no requirement of the index.
