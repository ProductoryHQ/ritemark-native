# v1.7.2 Marketing — Link any file, restructure from the outline

**Status:** Draft

## One-liner

Ritemark v1.7.2: type `@` to link any file in your workspace, Cmd-click to follow it, and change heading levels straight from the outline — without ever leaving the keyboard. Plus a clearer AI model picker and a leaner runtime under the hood.

## Positioning

**The moment you want to link to another file shouldn't send you to Finder.**

The headline of v1.7.2 is a single keystroke. Type `@` in any Markdown document and a file-search picker opens at the cursor. Type a few characters of any filename in your workspace, press Enter, and Ritemark inserts a Markdown link with the correct relative path already filled in — no counting `../` segments, no leaving the editor to go find the path. The Add Link dialog (Cmd+K) speaks the same `@`-syntax, so both ways of inserting a link feel identical.

Then those links actually go somewhere. Cmd-click an internal Markdown link and it opens as a Ritemark document. Cmd-click a PDF, image, CSV, or source file and it opens through VS Code's default opener, so a doc-set can reference diagrams, spreadsheets, and code without dead links. Links pointing outside the workspace, or to files that don't exist, show a quiet notification instead of silently doing nothing.

And restructuring a long document no longer means hunting for the right heading. Right-click any row in the Table of Contents and pick a new level (H1–H6), or press `⌥⌘1-6` from the keyboard. It's one undo step, and your scroll position stays exactly where it was.

Underneath, the AI sidebar got clearer and lighter: real model names and versions in a readable picker, real runtime versions in Settings, and two unused subsystems removed so the app is leaner.

## Who this is for

### Technical writers and documentation teams

Cross-linking a doc-set is the daily reality of technical writing, and until now it meant leaving the editor to find paths. `@` turns it into a keystroke; Cmd-click turns the result into navigation. A folder of Markdown files starts to feel like a connected set of documents, not a pile of files.

### Anyone restructuring long documents

Promoting and demoting headings while you reorganize an outline used to fight the editor (the default shortcut kept extending text selections instead of changing levels). v1.7.2 fixes that and routes it through the TOC, where you can see the whole structure while you change it — without the viewport jumping around.

## Cleanup, said plainly

v1.7.2 also removes two things that were quietly shipping without earning their place:

- **The "Legacy Agent" runtime** — a deprecated third chat runtime that called OpenAI/Gemini directly. The selector now offers only the two canonical runtimes, Claude Code and Codex. Old Legacy Agent conversations still open read-only, so nothing is lost.
- **Document search (RAG)** — a semantic-search subsystem that no longer surfaced any feature but still shipped, signed, and notarized with every build. Gone, along with its dependency.

Neither removal touches Claude Code, Codex, Flows, or your saved conversations. The app is just leaner.

## Platform note

The macOS Apple Silicon build is notarized and ready. The **Windows installer is coming shortly** as a follow-up asset on the same release page — a packaging fix in this release is what makes that Windows build possible.

## Social post (short)

Ritemark v1.7.2 is out.

Type `@` to link any file in your workspace. Cmd-click to follow it. Change heading levels straight from the Table of Contents.

Cross-linking your docs is now a keystroke, not a trip to Finder.

(macOS now · Windows shortly)

## Social post (thread)

1/ Ritemark v1.7.2 ships today. The headline is one keystroke.

Type `@` anywhere in a Markdown document → a file-search picker opens at the cursor.

2/ Filter by filename, press Enter, and Ritemark inserts a Markdown link with the correct relative path already filled in.

No counting `../` segments. No leaving the editor to find the path.

The Add Link dialog (Cmd+K) speaks the same `@`-syntax.

3/ Those links now go somewhere.

Cmd-click an internal Markdown link → opens as a Ritemark document.
Cmd-click a PDF / image / CSV / source file → opens via VS Code's default opener.
Out-of-workspace or missing target → a quiet notification, never a silent no-op.

4/ Restructuring long docs got easier too.

Right-click any Table of Contents row → pick a new heading level (H1–H6).
Or press ⌥⌘1-6 from the keyboard.

One undo step. Scroll position stays put.

5/ Under the hood, the AI sidebar got clearer and lighter:

- model picker shows real models as readable two-line rows with a proper scrollbar
- Settings reports real Claude (CLI + SDK) and Codex runtime versions
- removed the deprecated Legacy Agent runtime and the unused document-search subsystem

6/ macOS (Apple Silicon) is notarized and out now. Windows installer follows shortly on the same release page.

Ritemark v1.7.2 — link any file, restructure from the outline.

## Pitch lines

- *"The moment you want to link to another file shouldn't send you to Finder. v1.7.2 makes it a keystroke."*
- *"Type `@`, pick a file, get a relative-path Markdown link. Cmd-click to follow it."*
- *"Change heading levels straight from the outline — one undo step, scroll position preserved."*
- *"A leaner runtime: we removed the deprecated Legacy Agent and the unused document-search subsystem. Claude Code, Codex, and Flows are untouched."*

## Changelog bullets

- **Type `@` to link any local file** — file-search picker at the cursor, inserts a relative-path Markdown link; the Add Link dialog (Cmd+K) understands the same syntax
- **Cmd-click follows internal links** — Markdown opens in Ritemark; other files open via VS Code's default opener; out-of-workspace/missing targets show a non-blocking notification
- **Heading levels from the Table of Contents** — right-click a TOC row or press `⌥⌘1-6`; single undo step, scroll position preserved
- **Clearer AI model picker** — real models as two-line rows, constrained height, thin scrollbar, pointer-cursor rows
- **Real AI runtime versions in Settings** — Claude CLI + SDK chip; Codex app-server version from `--version`
- **Removed the deprecated Legacy Agent runtime** — selector now offers only Claude Code + Codex; saved legacy conversations open read-only
- **Removed the unused document-search (RAG) subsystem** and its `@orama/orama` dependency
- **Windows packaging fix** — stubbed leaked AI SDK peer deps so the Windows installer build packages cleanly
- Closes #79 (TOC heading-level changes) and #80 (`@`-mention file links); defers #81 (Markdown comment callouts)

## Screenshots

### Captured (`screenshots/`)

| File | Use |
| --- | --- |
| `1-7-2-at-mention-command-in-text.png` | **Hero shot.** Typing `@q4` in the editor; the file picker shows the matching workspace file. The primary v1.7.2 feature. |
| `1-7-2-at-syntax-in-linkdialog.png` | Add Link dialog (Cmd+K) with `@` typed and matching files listed — proves the dialog speaks the same syntax. |
| `1-7-2-toc-right-click.png` | Right-click on a Table of Contents row showing the "Change heading level" H1–H6 menu. |
| `1-7-2-editor-full-with-agent-chatpanel.png` | Full app: editor + outline + AI sidebar. Good general/context shot. |
| `1-7-2-agent-skills-management.png` | Agent Library / skills management view. Context shot for the AI-sidebar story; not tied to a v1.7.2 headline feature. |

### Still to capture (optional / nice-to-have)

| File | What it would show |
| --- | --- |
| TBD | Cmd-click following an internal link into a second Ritemark tab (the "links go somewhere" payoff) |
| TBD | AI model picker open, showing two-line rows + the thin scrollbar on a long list |
| TBD | Settings showing the Claude CLI + SDK chip and Codex `--version` (the runtime-clarity claim) |
