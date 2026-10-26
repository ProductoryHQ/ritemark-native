# Sprint 137's part of the 2.1 release notes (draft)

Kept here so the four 2.1 sprints don't write one file at the same time; the release step folds it into `docs/releases/v2.1.0/release-notes.md`. The public wording is decision 6's; the product marketer takes the final words from these notes.

---

## Your Markdown, as you wrote it

Ritemark 2.1 keeps your Markdown as you wrote it: lists, line breaks, tables and front matter come back unchanged when you save. Open a document, change a word, save it, and the file changes only where you changed it. If you keep your notes in git, `git diff` shows your edit and nothing else.

Before 2.1, saving rewrote parts of a file you hadn't touched. A list written `- item` came back as `-   item` with blank lines between the items, lines that belonged to one paragraph came back with two spaces at their ends, and `---` came back as `* * *`. In a test over the team's own documents, 3 files in 100 came back unchanged after one save. In 2.1, 89 in 100 do, and the rest change only in the forms below.

What comes back as written:

- **Lists:** their marker (`-`, `*`, `+`, `1.`, `1)`), the space after it, their nesting (spaces or tabs), whether they are tight or loose, and a list written directly under a line of text.
- **Line breaks:** a line that goes on to the next line stays one paragraph, as GitHub and Obsidian read it. A line break written with two spaces or a backslash keeps its form.
- **No new spaces at the ends of lines,** and empty lines stay empty.
- **Tables:** the row under the header as written, the column alignment (lost on every save before), and the spacing in the cells.
- **Front matter,** byte for byte, when you haven't changed a property.
- **Thematic breaks, web addresses written bare or in `<…>`, code fences** with or without a language, and text such as `snake_case`, `[1]`, `[[Wikilinks]]` and `## 1. Background`, which used to gain backslashes.

What is still rewritten, without losing anything: HTML (its text stays), headings underlined with `===`, `_emphasis_` (written `*emphasis*`), reference links (written inline), table columns padded to line up, and `~~~` or indented code (written with backticks). One loss is left: a link around an image, such as a badge in a README, keeps the image and loses the link, as before.

**A line break you type** (Shift+Enter) is written as a backslash at the end of the line, `line\`, a line break in every Markdown reader, with no spaces at the end.

**Files Ritemark saved before 2.1** change once, on their first save in 2.1: the spaces Ritemark put on empty lines go, and so do backslashes that were never needed. Their lists keep the form they have now. After that, they come back as written too.

## Nothing in your file is lost

Three things a save used to delete are kept, and now show in the editor:

- **A link to a file in another folder,** such as `[the report](notes/report.md)`. The editor dropped it when the document opened.
- **A link or bold around code,** such as ``[`AGENTS.md`](AGENTS.md)``.
- **Images in a row,** each in its own paragraph. Two saves used to leave only the first.

## One question when an agent changes your document

When an agent changes a document while you are typing in it, Ritemark asks one question: Review changes, in the document. VS Code's "The content of the file is newer" notification no longer shows as well. If the document's tab is behind another tab, one Ritemark notification names it, and its Review changes brings the document forward with the review open. After Keep my version or Use disk version, your next edit saves with no question.

When nobody else changed your words, there is no question at all: a sync client such as OneDrive that only touched the file, or rewrote its line endings, no longer stops your save. A document open only in VS Code's text editor keeps VS Code's own notification.

## Fixes

- **Editing a link's address works (#502).** The link dialog changed nothing when you edited an existing link. It now says Edit link, and saving it changes the address.
- **No false "Retry document update" (#512).** After an AI edit to a document in a window behind other windows, Ritemark could show Retry document update although the change had arrived.
- **Deleting text no longer freezes the editor.** Removing a paragraph that ended like the one next to it could stop the editor responding.
