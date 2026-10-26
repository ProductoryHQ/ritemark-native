# Sprint 137 Spec — Files come back as written

## Purpose

Ritemark 2.1's first promise: open a Markdown document, change a word, save it, and the file changes only where you changed it.
- Lists keep their marker, their spacing and their tightness.
- Soft line breaks stay soft.
- No trailing spaces appear.
- Nothing in the file is lost.

When an agent changes a file you are editing, one question answers it, Ritemark's Review changes, not VS Code's "content is newer" notification as well.

Today 4% of real files come back byte for byte after one open and save ([research/fidelity-pre-audit.md](research/fidelity-pre-audit.md)). This sprint fixes it for the common forms, proven by a corpus of real-looking files. It adds no new serializer and does not move to TipTap 3 (Jarmo's decision 3, 21 October).

## Principles

- **Fix what is written to disk, not what is shown.** The editor reads Markdown as it does today (`breaks: true` stays). A document looks the same in the editor before and after this sprint (R7). The only exceptions are R6's: links, marks and images that today are silently lost now show, because the file has them.
- **The parse remembers how a block was written, and the save writes it that way.** `marked` stays the parser and Turndown stays the serializer. What was written is carried as data-only attributes on TipTap's nodes and marks.
- **The corpus is the bar.** A form is in the bound when a corpus file holds it and the corpus test passes on it byte for byte. A form outside the bound is listed in a pinned test, so the bound is honest and stays as it is.
- **Nothing is lost** (no-go in the shape: "Nothing that rewrites a user's file without their action"). A form outside the bound may be reformatted. It may never lose a word, a link, a mark or an image.
- **One question for one change.** A conflict has one answer, in Ritemark's words and in Ritemark's place. No question appears where nothing is in conflict.
- **New writing uses one plain form.** What a person types in Ritemark is written in the common form most tools write: `- item`, tight lists, `---`.

## Requirements

### R1: Lists come back as written

As someone who keeps Markdown in git or edits it in Obsidian too, I want saving to leave every list I didn't touch exactly as I wrote it.

Acceptance criteria:
- **The marker** stays as written:
  - a bullet's `-`, `*` or `+`;
  - an ordered list's `.` or `)` after the number;
  - an ordered list's start number.
- **The space after the marker** stays as written, from one to four spaces. `- item` stays `- item`, and `-   item` stays `-   item`.
- **Tightness** stays as written. A tight list (no blank lines between items) stays tight, a loose list stays loose, for bullets, numbers and tasks alike. A list is written loose only when an item holds two paragraphs, which a tight list cannot hold without merging them.
- **Nested lists** keep their indent as written:
  - two, three or four spaces;
  - or a tab, when the document indents nested lists with tabs, as Obsidian does by default.
- **A list directly under a line of text** (`Attendees:` and the list on the next line) stays directly under it, with no blank line added.
- **A list that mixes tasks and plain items** (`- [x] task` and `- plain` in one list) is written back as one list. No blank line is added where the editor splits it.
- **A line break inside a task item** stays a line break, not a space.
- Adding, removing or editing one item changes only that item's line and, for a numbered list, the numbers after it.

### R2: Line breaks come back as written

As someone whose files are read on GitHub and in Obsidian, I want a line break to keep its meaning.

Acceptance criteria:
- **A soft line break** stays a soft line break: a newline with nothing before it. GitHub and every CommonMark reader keep showing those lines as one paragraph, as they did before Ritemark saved. In the editor it still shows as a new line, as today.
- **A hard line break** stays in the form it was written: two or more spaces before the newline, or a backslash.
- **A line break typed in Ritemark** (Shift+Enter, or pasted text with line breaks) is written as a hard break with a backslash at the end of the line (`line\`), with no trailing spaces. Decision 3, 26 October.
- **Inside a quote,** a soft break stays `> one` / `> two`.
- **Inside a table cell,** a line break is written `<br>`, the one form a cell can hold. *(Scope change, 26 October.)*
- **A line break at the very end of a paragraph,** which no reader shows, is not written: a backslash there would read as a literal `\` on the next open. *(Scope change, 26 October.)*

### R3: No whitespace appears at the end of a line

As someone whose linter or `git diff --check` flags trailing whitespace, I want saving never to add it.

Acceptance criteria:
- No line written by Ritemark ends in a space or a tab unless the source line did, for example a two-space hard break the author wrote.
- The empty line between loose list items, inside a list item, or inside a quote is empty: never `␠␠␠␠`, `␠␠`, or `>␠`.
- An empty table cell is written `| |`, not `|  |`.
- Fenced code is left exactly as written, its spaces included.

### R4: The other common forms come back as written

As someone who writes what ChatGPT, Claude and Obsidian write, I want the forms they use to survive a save too.

Acceptance criteria:
- **A thematic break** stays as written: `---`, `***`, `___` or `* * *`.
- **A web address written bare** (`https://example.com`) or in angle brackets (`<https://example.com>`) stays that way. So does a bare e-mail address. It does not become `[https://example.com](https://example.com)`.
- **Escapes are written only where the character would otherwise change what the line means:**
  - an underscore inside a word stays bare: `snake_case`, `my_file.md`;
  - a square bracket that opens no link stays bare: `[1]`, `[draft]`, `[[Wikilink]]`, `> [!note]`, `![[image.png]]`;
  - a number and full stop are escaped only at the start of a line, where they would start a list. They are not escaped in a heading (`## 1. Background`), after bold (`**1. Scope**`) or in a table cell;
  - Turndown's other line-start escapes (`-`, `+`, `#`, `>`, `=`) likewise apply only at the start of a line;
  - everything that today stops text from turning into formatting stays escaped (R9's negative fixtures).
- **Blocks written directly under one another,** with no blank line between them (a paragraph under a heading, a list or table under a line of text, a quote under a paragraph), stay that way. R1's list under a line, made general. *(Scope change, 26 October: the corpus showed the same rewrite for every block, not only lists.)*
- **A code fence** keeps its info string as written, and a fence written without one stays without one. Today such a fence is written ```` ```plaintext ````, in 19% of the repository's files. Fenced code itself stays exactly as written (R3). *(Scope change, 26 October.)*
- **A backslash** is escaped only where it would otherwise escape the next character: before ASCII punctuation, or at the end of a line. `C:\Users\me` and `\d+` stay as written. *(Scope change, 26 October: the plan kept today's escaping of every backslash, Turndown's default, which writes `C:\\Users\\me` for `C:\Users\me` in a file nobody edited.)*
- **A `<`** before a letter, `/`, `!` or `?` is escaped, because the next open would read it as HTML and drop it: `Promise<string>` lost `<string>` on the second open. Every other `<` stays bare. *(Scope change, 26 October, under R6: nothing is lost.)*
- **A table** keeps:
  - its delimiter row as written (`|---|---|`, `| --- | --- |`, `|:---|---:|`), as long as its number of columns has not changed;
  - its column alignment, always. Today alignment is lost on every save;
  - its cell spacing, `| a | b |` or `|a|b|`.

### R5: Front matter comes back byte for byte

As someone whose notes start with YAML front matter (Obsidian, static sites, agents), I want saving the text to leave the front matter untouched.

Acceptance criteria:
- When the person has not changed a property, the front matter block is written back exactly as it was. That includes:
  - its comments, quoting, key order and date forms;
  - inline lists like `tags: [a, b]`;
  - the blank line after the closing `---`.
- When the person changes a property in the Properties panel, the front matter is written as today. Keeping YAML's form through an edit is outside this sprint.
- A task card's page keeps its front matter as it does today (Sprint 130's splice).

### R6: Nothing in the file is lost

As anyone, I want a save never to delete a link, a mark or an image I didn't touch.

Acceptance criteria:
- **A link to a file in another folder** (`[report](notes/report.md)`, `[doc](../shared/doc.md)`) opens as a link and is saved as a link. Today TipTap drops it on open.
  - Every address TipTap accepts today is still kept, and so is every relative path that Ritemark's own link check accepts (`isSafeRelativePath` in `lib/linkTargets.ts`).
  - `javascript:`, `vbscript:`, `data:` and `file:` addresses stay refused, as `classifyLinkTarget` refuses them.
  - The link dialog can set such an address too.
- **A link around code** (``[`file.md`](file.md)``) keeps its link.
- **Bold, italic or strikethrough around code** (``**`name` is vendored**``) keeps its mark.
- **Images in a row,** each in its own paragraph, stay one per paragraph, on every later save too.
- A form outside the bound may be reformatted, but its text, links, marks and images survive two saves (R9).

### R7: The editor looks the same

As someone opening a document I know, I want it to look exactly as it did.

Acceptance criteria:
- For every corpus file, the editor's document is the same as on `main` before the sprint, with Ritemark's `data-md-*` attributes taken away. That means the same nodes, marks, text and rendered HTML.
- The exceptions are R6's alone. A link, mark or image that today is dropped on open now shows. Each exception is listed in the test by file and node.
- No stylesheet reads a `data-md-*` attribute.
- Typing, Enter, Shift+Enter, Backspace, lists' input rules, undo, paste, drag and drop and the slash menu behave as today.

### R8: New writing uses one plain form

As someone writing in Ritemark, I want what I type to be written in the form most tools write and read.

Acceptance criteria:
- **A new list** (typed, pasted, from the slash menu or the + menu) is written tight, as `- item` or `1. item`, with nested lists indented to the item's text: two spaces under `-`, three under `1.`.
- **A new item** in an existing list follows that list's form.
- **A new thematic break** is `---`. The one exception is a document's very first block. There it is `***`, because a file starting with `---` reads as front matter. *(Scope change, 26 October: this holds with front matter too. The body is written on its own, and once the last property is removed a body starting with `---` becomes the file's first line.)*
- **A new line break** follows R2.
- **New links, images, tables, emphasis and code** are written as today: `[text](url)`, `![alt](src)`, `| a | b |` with `| --- |`, `*em*` and `**strong**`, backtick fences.
- **Save as Markdown** (Word preview) and **Copy as Markdown** use the same rules. Their output changes to these forms: `- item` and tight lists instead of `-   item`.

### R9: The corpus is the bar

As the team, we want a test that fails the moment a save rewrites what the bound promises to keep.

Acceptance criteria:
- **The corpus lives in the repository** as Markdown files, each modelled on a real source:
  - ChatGPT's and Claude's answers;
  - an Obsidian note;
  - a Google Docs export;
  - hand-typed meeting notes;
  - a consultant's proposal, an analyst's report and a trainer's handout;
  - a GitHub-style README without HTML;
  - Ritemark's own Save as Markdown output;
  - #270's own fixtures.

  No real person's name, path, address or account is in any of them.
- **The kept set:** every file comes back byte for byte after open and save, and again after a second save. Opening it, typing one word at the end of one paragraph, and saving changes exactly that one line.
- **The known set:** files with forms outside the bound (*Non-Requirements*). Each has its expected output pinned. The test proves the output is stable on a second save and loses no text, link, mark or image.
- **The cleanup set:** files saved by Ritemark 2.0.1 and earlier. Their expected output pins the one-time cleanup, R3's spaces on empty lines going away. Decision 4, 26 October.
- **Negative fixtures:** text that must stay escaped so it does not turn into formatting:
  - `*not italic*` written escaped;
  - `1\. not a list` at the start of a line;
  - `\# not a heading`;
  - a literal `[x]: y` at the start of a line;
  - a plain list item that starts with an escaped `\[ ]`.
- **The test drives the editor's own code,** the same modules `Editor.tsx` uses, not a copy of its settings. It runs in `npm run test:editor-sync`.
- **Line endings and the BOM:** a CRLF file and a file with a UTF-8 BOM are written back with their line endings and BOM (the host's `encodeDocumentBytes`). This is checked on Windows too.

### R10: One question answers a conflict

As someone editing a document while an agent changes it, I want one clear question, in Ritemark's words.

Acceptance criteria:
- **For a document open in Ritemark's editor,** VS Code's "Failed to save '…': The content of the file is newer…" notification, with Compare and Overwrite, never shows.
- **Ritemark's Review changes is the one question.**
  - It shows in the document's bar when the document's tab is visible, as today.
  - When no Ritemark tab of the document is visible, one Ritemark notification names the document and offers Review changes. Two cases: the tab is behind another, or the save came from a text-editor tab of the same file. Review changes brings the document forward with its review open.
- **After Keep my version or Use disk version,** the document is saved and clean. The next edit auto-saves with no question.
- **When Ritemark cannot answer,** VS Code's notification shows as today, so a conflict is never left without a question. That is the case when no Ritemark editor holds the document, or Ritemark's extension is not running.
- **A document open only in VS Code's text editor** (Open With ▸ Text Editor) keeps VS Code's own notification, unchanged.
- **Mac and Windows alike.** The report came from Windows (#454).

### R11: No question where nothing is in conflict

As someone working in a OneDrive, SharePoint or Google Drive folder, I want saving to just work when no one else changed my words.

Acceptance criteria:
- **When VS Code refuses a save as "newer" but the disk text is what the person started from,** the save completes with no question and the person's text is on disk. In that case only the file's date, size or line endings changed: a sync client or a tool touched it, and no one changed the text.
- **When the disk already holds exactly the person's text,** nothing is asked and the document ends clean.
- **Anything else is a real conflict** and goes to R10.

### Engineering requirements

- **E1: Tests.**
  - The corpus test (R9).
  - Unit tests for each new Turndown rule and attribute, with the negative fixtures.
  - The existing round-trip tests, updated only where they pinned today's rewrites, each update named in the commit.
  - A unit test for the save-conflict decision (R10, R11).
  - A VS Code unit test for the patch's hand-over.
  - The webview's and the extension's type checks.
- **E2: The patch.**
  - #454's shell change goes into `014-ritemark-save-receipts.patch`, the patch that owns saving (`PATCH-RULES.md` §1: one domain per patch). No new patch.
  - The file list and hunk count are recorded before and after (§8).
  - Dry run, real apply from pristine, a second run clean.
  - `check-patch-stacking.mjs` passes, and `compile-check-ts-native` is green.
- **E3: The bundle.** `media/webview.js` is measured before and after (#107). The corpus files are read by the test, never imported, so they add nothing.
- **E4: Docs.**
  - `architecture.md`: the editor's Markdown pipeline and the save-conflict hand-over in *Editor–disk synchronization*.
  - `CLAUDE.md`'s and `PATCH-RULES.md`'s rows for patch 014.
  - The changelog and 2.1's notes, with the bound in plain words.
- **E5: Builds.**
  - After the merge, a production build from a clean-room worktree at the merged commit, as a build check.
  - A Windows round from main for R9's CRLF case, R10 and R11.
  - The drift check: patch 014 on the newest VS Code release.
- **E6: The bound is written down.** The forms outside the bound, each with its corpus fixture and today's output, go into one GitHub issue for after 2.1. The Development manager files it.

## Non-Requirements

- **A new serializer, or writing untouched blocks from their source text.** Decision 3. The pre-audit shows the narrow fix is enough for the bound.
- **TipTap 3 (#243).** The attributes this sprint adds work the same in TipTap 3.
- **Changing how the editor reads Markdown,** soft breaks included. Decision 3 and the shape's risk: it would change how existing documents look.
- **Forms outside the bound,** reformatted but never lost:
  - inline and block HTML, HTML comments outside comment callouts, and entities;
  - setext headings and closed `#` headings;
  - `~~~` fences and indented code;
  - `_em_` and `__strong__` (written `*` and `**`);
  - reference links and their definitions (written inline);
  - table columns padded to line up;
  - tables without outer pipes;
  - an ordered list numbered `1. 1. 1.` (written counting up);
  - an image inside a link (README badges);
  - more than one trailing newline at the end of a file (one, as since #254).

  The audit may move a form into the bound when the real-tool captures show it is common. That goes through the scope-change protocol: R1–R4 first.
- **Keeping YAML's form when a property is edited** (R5).
- **Footnotes (#153), equations (#481, Sprint 138)** and anything else new in the format.
- **Changing VS Code's conflict editor** for documents open only in the text editor.
- ~~**The link dialog's update bug (#502)** and **the false Retry document update (#512)**~~: taken in by decision 7 (26 October) and fixed in this sprint.

## Resolved Questions

- **2026-10-19 (Jarmo):** #270 is 2.1's first item ("võtame #270 2.1 esimeseks").
- **2026-10-21 (Jarmo, the shape's decision 3):** untouched lists and soft breaks are written back as they were in the common forms, checked against a corpus of real files. No new serializer, no TipTap 3.
- **2026-10-21 (Jarmo, the shape's decision 1):** one shell release, 2.1.0, on Mac and Windows, so #454's patch rides with it.
- **2026-10-26 (engineering, in this plan):**
  - the approach is data-only attributes from the parse and Turndown rules that read them; the pre-audit's prototype measured it;
  - #454's change goes into patch 014;
  - the corpus test drives the editor's own modules, which means moving the pipeline out of `Editor.tsx` with no change in behaviour.

## Scope changes during the sprint

Made by engineering on 26 October 2026, under the plan's rule for a decision it doesn't cover (the narrowest option the plan's spirit supports, written down in the PR). Each is marked *(Scope change)* above, with its fixture in the corpus:

| Change | Requirement | Where it is pinned |
|---|---|---|
| Blocks written directly under one another stay so | R4 (R1 made general) | the corpus (`kept/lists-under-a-line.md`, `kept/meeting-notes.md`, `kept/front-matter-tight.md` and others) |
| A fence's info string kept; no `plaintext` | R4 | `markdownAsWritten.test.ts`; `kept/claude-answer.md`, `kept/code-spaces.md` |
| A backslash escaped only before punctuation or at a line's end | R4 | `markdownAsWritten.test.ts`; `kept/escapes-left-alone.md`, `kept/escapes-negative.md` |
| `<` escaped before a letter, `/`, `!` or `?` | R4, R6 | `markdownAsWritten.test.ts`; the negative fixtures |
| `<br>` for a break in a table cell; no break at a paragraph's end | R2 | `markdownAsWritten.test.ts` |
| `***` as the first block with front matter too | R8 | `markdownAsWritten.test.ts` |

## Open Questions

For Jarmo, with recommendations, in [sprint-plan.md](sprint-plan.md#decisions-for-jarmo).
