# Fidelity audit (R1–R9)

26 October 2026, on the Mac, from the worktree's dev build (CDP port 9231, an isolated profile under `$TMPDIR`, analytics off). The pre-audit is [fidelity-pre-audit.md](fidelity-pre-audit.md); this audit reproduces it in the app, checks the forms around the bound, and lists every webview path that parses or writes Markdown.

## 1. The losses and #270, reproduced in the app on main's build

Each file was opened from the Documents tree of a dev instance running `main`'s webview bundle, touched (one character typed and deleted, so the editor saves), saved by auto-save, and read back. `$` marks a line's end (`sed -n l`), so trailing spaces show. Screenshots were not kept; the bytes are the evidence.

**A link into a folder is deleted on open (#539).** `Read [the report](notes/report.md) and [the brief](../shared/brief.md).` came back as:

```text
Read the report and [the brief](../shared/brief.md).$
```

TipTap's link mark refused `notes/report.md` (no scheme, not `./`), so the link was gone from the editor before the save. The second save is the same.

**A link or bold around code is broken (#539).** ``See [`AGENTS.md`](AGENTS.md).`` and ``**`skill-creator` is vendored verbatim.**`` came back as:

```text
See `AGENTS.md`.$
`skill-creator` **is vendored verbatim.**$
```

The `code` mark excluded every other mark, so the link and the bold were cut off the code.

**Images in a row are deleted (#539).** Three images, each in its own paragraph, came back joined on one line after the first save:

```text
![First](images/a.png)![Second](images/b.png)![Third](images/c.png)$
```

Opening that line and saving again kept only the first image: two images lost over two saves.

**#270: a tight list made loose, padded, with spaces on its blank lines.**

```text
-   first item$
    $
-   second item$
    $
-   third item$
```

from `- first item` / `- second item` / `- third item`.

**#270: a soft line break written as two trailing spaces.** `Line in doc two.` / `Agent edit verified.` came back as `Line in doc two.␠␠$` / `Agent edit verified.$`: a hard break GitHub shows as a new line, where the source was one paragraph.

On the branch, each of these files comes back byte for byte after two saves (they are in the kept set: `links.md`, `images-row.md`, `issue-270-list.md`, `issue-270-soft-break.md`), and the editor shows the folder link, the link and bold around code, and the three images.

## 2. The captures

The corpus files are modelled on each tool's output, written by the team: no real tool export was captured here.

- **Kept (31):** ChatGPT's and Claude's answers, an Obsidian note (front matter with a comment, tab-indented lists, `[[wikilinks]]`, `> [!note]`), a Google Docs export (`* ` bullets, numbered lists, tables with `:----` delimiter rows), meeting notes, a consultant's proposal, an analyst's report, a trainer's handout, a GitHub-style README without HTML, Ritemark's own Save as Markdown, #270's two fixtures, and one file per form (lists, breaks, tables, thematic breaks, escapes and the negative escapes, brackets around marks (added after QA's review), front matter, code spans, comments, a CRLF file and a UTF-8 BOM file).
- **Known (13):** the forms outside the bound, each with its pinned output ([notes/out-of-bound.md](../notes/out-of-bound.md)).
- **Cleanup (1):** a file as Ritemark 2.0.1 saved it, with the one-time cleanup pinned (decision 4).

No real person's name, path, address or account is in any of them. A real Google Docs export and a real Obsidian vault were not captured: there is no Google sign-in or Obsidian install in this session. That stays open for the Windows round or the Development manager.

**Jarmo's own folder (decision 5)** was not measured. The decision allows it as numbers only, but no folder was named, and reading a folder under `~/Documents` from this session can raise a macOS privacy prompt on Jarmo's screen (memory: dev builds trigger `~/Documents` prompts). `scripts/qa/markdown-fidelity-measure.mjs <folder>` prints counts only, and is ready for when a folder is named.

## 3. Frequency checks

File counts; a line scan outside fences.

| Form | Repository (1,093 `.md`) | Team documents (142) | Dependency READMEs (89) |
|---|---|---|---|
| `1.` `1.` `1.` numbering | 0 | 0 | 0 |
| `_em_` | 21 (2%) | 0 | 22 (25%) |
| A list directly under a line of text inside a list item | 6 (1%) | 0 | 1 (1%) |

None of the three is common in the files people write here, so none moved into the bound. All three are in the known set.

## 4. The second save

On `main`, 148 of the repository's 1,087 files changed again on a second save, 21 of 89 READMEs, and one team document. The form traced in the app is images in a row (above); the others were counted, not traced one by one.

On the branch, 4 repository files and 3 READMEs still change on a second save:

- a loose list item holding an image and its caption, where a blank line moves (`docs/releases/v1.6.3/release-notes.md`);
- a task item whose text starts with a number (`- [ ] 1. Open Ritemark Native`), which `marked` reads as a task holding an ordered list; it moves by a space on the second save (`sprint-36-codex-chatgpt/TESTING-GUIDE.md`);
- two Sprint 119 evidence files (`roundtrip-docx-import.md`, `roundtrip-html-import.md`), not traced one by one;
- READMEs whose HTML becomes a line holding only a hard break, `\`, which the next open reads as a literal backslash (`zod`, `tsx`, `lie`).

None loses a word, link or image: the corpus measure counts links and images after two saves, and only the image-in-link form loses one. The traced ones are outside the bound (images inside loose items, HTML, a task holding a list), and they go into the out-of-bound issue.

## 5. Every webview path that parses or writes Markdown

| Path | Parses | Writes | After Sprint 137 |
|---|---|---|---|
| `components/Editor.tsx`: open, external update, image-mapping refresh, save | `markdownToEditorHTML` | `editorHTMLToMarkdown` | Through `utils/editorMarkdown.ts` |
| `App.tsx`: Copy as Markdown, the export paths | — | `editorTurndownService` with `preprocessTableHTML` | Through `utils/editorMarkdown.ts` |
| `App.tsx`: an AI's text inserted into the document | the global `marked` | — | Unchanged. Inserted text is new writing (R8), so it carries no as-written attributes |
| `components/viewers/DOCXViewer.tsx`: Save as Markdown in the Word preview | — | `createTurndownService()` | The same Turndown rules and escaping (R8, S36) |
| `components/ai-sidebar/RenderedMarkdown.tsx`: the AI's answers | its own `marked` | — | Display only, never written to a file |
| `extensions/comment/*`: comment callouts | the comment tokenizer in `editorMarked` | Turndown rules | Unchanged, through the module |

The host writes the body with `serializeSyncEdit` and the front matter with `editorSync/frontMatter.ts` (R5), and the bytes with `encodeDocumentBytes` (CRLF and BOM, R9).
