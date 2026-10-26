# Sprint 137 Scenarios

These are the manual QA matrix. Each one names the requirement it shows. "S" numbers are stable: a new scenario gets a new number.

**How each scenario runs,** unless it says otherwise:
- **Where:** on the Mac, on a dev instance launched in the background with its own short user-data directory and `--use-mock-keychain`, driven over CDP (memory: dev-instance CDP isolation, no pop-up test windows).
- **"Open and save":** open the file in Ritemark's editor, type one character at the end of the last paragraph, delete it again, and let auto-save write.
- **"On disk":** read with `cat -A` (`$` marks a line's end, `^I` a tab) and `git diff`, in a scratch git repository holding the corpus files.

Most byte-level checks are also automated in the corpus test (R9). These scenarios prove them in the app, through the real webview, bridge and host.

## Feature: Lists come back as written (R1)

### S1: #270's own fixture
Given a file holding `# Trailing newline test`, `Some intro text.` and a tight list `- first item` / `- second item` / `- third item`
When the person opens it, types ` EDITED` at the end of the third item and saves
Then `git diff` shows exactly one changed line, `- third item EDITED`
And no line has trailing spaces, and no blank line was added between the items.

### S2: Every marker and its spacing
Given a file with these lists, separated by paragraphs:
- `* one` / `* two`
- `+ one` / `+ two`
- `1) one` / `2) two`
- `-   padded` / `-   item`
- `5. five` / `6. six`

When the person opens and saves it
Then the file is byte-identical.

### S3: Loose stays loose, tight stays tight
Given a file with a loose list (a blank line between items), a tight list, a loose task list and a tight task list
When the person opens and saves it
Then the file is byte-identical
And the editor shows all four lists exactly as on `main`.

### S4: Nested lists, spaces and a tab
Given three nested lists: one indented with two spaces under `-`, one with three under `1.`, one with four under `-`
And an Obsidian note whose nested lists are indented with a tab
When the person opens and saves each
Then each file is byte-identical, with `^I` where the tabs were.

### S5: A list directly under a line
Given `Attendees:` with `- Mari` / `- Jaan` on the very next lines
When the person opens and saves it
Then there is still no blank line between `Attendees:` and `- Mari`.

### S6: Tasks and plain items in one list
Given one list `- [x] Send the brief` / `- Book the room` / `- [ ] Draft module 4`
When the person opens and saves it
Then the file is byte-identical: one list, no blank lines added, and `- Book the room` keeps one space.

### S7: Editing a list changes only what was edited
Given S2's file
When the person adds an item to the `*` list with Enter, deletes the second item of the `+` list, and ticks nothing else
Then `git diff` shows the new `* …` line and the removed `+ two` line, and nothing else.

### S8: A numbered list renumbers only after the edit
Given `1. a` / `2. b` / `3. c`
When the person deletes `2. b`
Then the file reads `1. a` / `2. c`, and the diff touches only those two lines.

### S9: A line break inside a task item
Given `- [ ] Call the client` followed by a soft line break and `  about Friday` in the same item
When the person opens and saves it
Then the file is byte-identical: the break is still a break, not a space.

## Feature: Line breaks come back as written (R2)

### S10: The agent's soft break (#270's second case)
Given `Line in doc two.` / `Agent edit verified.` (one paragraph, one newline)
When the person edits the document's title and saves
Then those two lines are byte-identical: no `␠␠` at the end of the first
And on GitHub's renderer the two lines still show as one paragraph
And in the editor they still show on two lines, as today.

### S11: Hard breaks keep their form
Given an address block written with two trailing spaces on each line, and another written with a backslash at each line's end
When the person opens and saves it
Then both blocks are byte-identical.

### S12: A break typed in Ritemark
Given a new paragraph
When the person types `Line one`, presses Shift+Enter and types `Line two`
Then the file holds `Line one\` / `Line two`, with nothing after the backslash (decision 3)
And after a reopen the editor shows the two lines as it did before the save.

### S13: Soft breaks inside a quote
Given `> one` / `> two`
When the person opens and saves it
Then the file is byte-identical.

## Feature: No whitespace at the end of a line (R3)

### S14: `git diff --check` stays quiet
Given every file of the corpus's kept set
When the person opens and saves each
Then `git diff --check` reports nothing for any of them.

### S15: Empty lines are empty
Given a loose list, a list item holding two paragraphs, and a quote with an empty `>` line between two paragraphs
When the person opens and saves it
Then no line in the file is made of spaces, and the quote's empty line is `>` alone.

### S16: Code keeps its spaces
Given a fenced code block whose lines end in spaces and hold tabs
When the person opens and saves the document
Then the code block is byte-identical.

## Feature: The other common forms (R4)

### S17: A ChatGPT answer
Given a ChatGPT answer pasted into a file, with:
- `##` headings and `**bold**` labels;
- `-` and `1.` lists;
- `---` between sections;
- a table with `|---|---|`;
- a code fence

When the person opens and saves it
Then the file is byte-identical.

### S18: Web addresses written bare
Given `See https://example.com and <https://ritemark.app>, or write to info@example.com.`
When the person opens and saves it
Then the file is byte-identical
And each address is still a link in the editor, as today.

### S19: Underscores, brackets and numbers left alone
Given a file with:
- `my_file_name.docx` and `snake_case`;
- `See [1] and [draft]`;
- `[[Project plan]]`;
- `> [!note]` / `> Read this first`;
- `## 1. Background`;
- `**2. Scope**`;
- a table cell `3. Budget`

When the person opens and saves it
Then the file is byte-identical.

### S20: Escapes that matter stay
Given a file with:
- `\*not italic\*`;
- `1\. not a list` at the start of a paragraph;
- `\# not a heading`;
- `\[x]: not a definition`;
- a plain list item `- \[ ] not a task`

When the person opens and saves it
Then the file is byte-identical
And after a reopen none of them has turned into formatting.

### S21: Table alignment and spacing
Given three tables:
- `|a|b|` / `|---|---|`;
- `| Name | Qty |` / `|:---|---:|`;
- `| a | b |` / `| --- | --- |` with an empty cell

When the person opens and saves the file
Then the file is byte-identical, alignment included.

### S22: A table edited
Given S21's second table
When the person adds a column from the table's controls
Then the new column's delimiter is `---`, the old columns keep `:---` and `---:`, and every row has the new cell.

### S23: Thematic breaks
Given `---`, `***` and `___` between paragraphs
When the person opens and saves the file
Then it is byte-identical.

## Feature: Front matter (R5)

### S24: An Obsidian note's front matter
Given a note starting with front matter holding:
- a comment line;
- `title: "Plan: Q4"`;
- `created: 2026-10-20`;
- `tags: [client, draft]`;
- then a blank line and the body

When the person edits the body and saves
Then the front matter and the blank line after it are byte-identical.

### S25: A property changed in the Properties panel
Given S24's note
When the person changes `title` in the Properties panel
Then the file's front matter holds the new title. Its other lines may be rewritten as today, and the body is byte-identical.

### S26: A task card's page
Given a task card opened as a page
When the person edits its body and saves
Then the board's front matter is byte-identical, as since Sprint 130.

## Feature: Nothing is lost (R6)

### S27: A link into a folder
Given `Read [the report](notes/report.md) and [the brief](../shared/brief.md).`
When the person opens the file
Then both are links in the editor (today they are plain text)
When the person saves
Then the file is byte-identical
And ⌘-click on each opens the target file.

### S28: Setting a link into a folder
Given a selected word
When the person adds a link to `notes/report.md` from the link dialog
Then the file holds `[word](notes/report.md)`.

### S29: Links and marks around code
Given ``See [`AGENTS.md`](AGENTS.md).`` and ``**`skill-creator` is vendored verbatim.**``
When the person opens the file
Then the code in the first is a link, and the whole of the second is bold, in the editor
When the person saves
Then the file is byte-identical.

### S30: A row of screenshots
Given three images, each in its own paragraph, one after another
When the person opens and saves the file, then opens and saves it again
Then the file is byte-identical after each save, and the editor shows three images.

### S31: Dangerous addresses stay refused
Given `[x](javascript:alert(1))`, `[y](data:text/html,hi)` and `[z](file:///etc/hosts)`
When the person opens the file
Then none of them is a link in the editor, as today.

## Feature: The editor looks the same (R7)

### S32: Familiar documents, side by side
Given the corpus's kept and known sets, and three documents from the sample project
When each opens on `main` and on the branch, at 1440 × 900, in Ritemark Light and Ritemark Dark
Then the screenshots match, except where S27 and S29 now show a link or bold.

### S33: Editing feels the same
Given a document with lists, tasks, a table and a quote
When the person types a list with `- ` and `1. `, presses Enter and Backspace in lists, ticks a task, presses Shift+Enter, undoes, pastes from a web page and drags a block
Then each behaves as on `main`.

## Feature: New writing in one plain form (R8)

### S34: A new list
Given an empty document
When the person types `- milk`, Enter, `eggs`, Tab, `brown`
Then the file holds `- milk` / `- eggs` / `  - brown`, with no blank lines and no trailing spaces.

### S35: A new item in an old list
Given a list written `*   one` / `*   two`
When the person adds an item after `two`
Then the new line is `*   three`.

### S36: Save as Markdown from Word
Given a Word document with a bulleted list, a numbered list and a table, open in the Word preview
When the person chooses Save as Markdown
Then the new file has `- item` and `1. item` tight lists and a `| --- |` table, and no line ends in spaces.

## Feature: The corpus (R9)

### S37: The corpus test
When `npm run test:editor-sync` runs
Then the corpus test reports every kept file byte-identical after one and two saves, and after the one-word edit only the edited line changed
And every known file matches its pinned output, stable on a second save, with no text, link, mark or image lost
And every negative fixture still escaped.

### S38: Windows line endings and a BOM
Given a CRLF file and a UTF-8 file with a BOM, from the kept set
When the person opens and saves each on Windows
Then each is byte-identical, CRLF and BOM included.

### S39: A file Ritemark 2.0.1 saved
Given a file saved by Ritemark 2.0.1 (lists `-   item` with lines of four spaces between)
When the person opens and saves it in 2.1
Then the lists keep `-   ` and their blank lines, and the four spaces on the blank lines are gone, once (pending question 4)
And a second save changes nothing.

## Feature: One question answers a conflict (R10)

Each runs with auto-save as shipped (after 1 s), on the Mac and on Windows. "The agent writes" means an AI turn that edits the open document. Where a turn can't be run, a shell command writes a changed copy of the file, timed while the person is typing.

### S40: The agent changes the document while the person types
Given a document open in Ritemark, with the person typing in it
When the agent writes the same file
Then Ritemark's Review changes shows in the document's bar
And VS Code's "The content of the file is newer" notification does not show, now or after the next auto-save.

### S41: Keep my version, then keep typing
Given S40's review
When the person chooses Keep my version and types another word
Then the file holds the person's text and the new word, the tab is clean after auto-save, and no question shows.

### S42: Use disk version, then keep typing
Given S40's review
When the person chooses Use disk version and types another word
Then the file holds the agent's text and the new word, the tab is clean after auto-save, and no question shows.

### S43: The document's tab is behind another
Given the document open in Ritemark in a tab behind another tab, with unsaved typing
When the agent writes the file and the next save is refused
Then one Ritemark notification names the document and offers Review changes
And Review changes brings the document forward with its review open
And VS Code's notification does not show.

### S44: The same file in a text editor too
Given the document open in Ritemark and, beside it, in VS Code's text editor (Open With ▸ Text Editor)
When the person types in the text editor and the agent writes the file
Then the one question is Ritemark's, as in S43
And VS Code's notification does not show.

### S45: Only VS Code's text editor
Given the document open only in VS Code's text editor
When the same conflict happens
Then VS Code's own notification shows, as today.

### S46: Ritemark is not running
Given a build where Ritemark's extension did not start (the shell watchdog's case, or a dev profile with the extension disabled)
When the same conflict happens in a text editor
Then VS Code's notification shows, so the person still gets a question.

## Feature: No question where nothing is in conflict (R11)

### S47: A sync client touches the file
Given a document open in Ritemark with unsaved typing
When a tool rewrites the file with the same text (a new date, or CRLF changed to LF), and auto-save runs
Then no question shows, the save completes, and the file holds the person's text.

### S48: A synced folder (#499)
Given a project in a OneDrive folder on Windows and an iCloud or Google Drive folder on the Mac, including an online-only file
When the person edits a document there while the sync client is running
Then saving shows no question unless the text really changed elsewhere.

### S49: The disk already has the person's text
Given unsaved typing
When a tool writes exactly the person's text to the file
Then no question shows and the tab is clean.
