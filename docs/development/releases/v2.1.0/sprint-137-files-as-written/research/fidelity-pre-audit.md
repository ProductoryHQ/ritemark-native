# What open and save does to real files today: the pre-audit

Written with the plan, 26 October 2026, on `main` at `b1ac84a7` (2.0.1). It is a measurement to size the sprint and choose the approach. It is not proof. Phase 1's [fidelity audit](../tasks.md#phase-1-audits-first) reproduces each finding in the app before any code depends on it (memory: no unproven diagnoses).

## How it was measured

A scratch harness ran each file through the editor's own load and save code, outside the app:

1. **Host, opening:** `gray-matter` splits the front matter, then `canonicalMarkdownProjection` (`src/editorSync/state.ts`).
2. **Webview, loading:** `new Marked({ breaks: true, gfm: true })` as in `Editor.tsx:68`, then `transformTaskListElements` (`utils/taskListRoundTrip.ts`), then Editor.tsx's image unwrap (`preprocessImageHTML`, `Editor.tsx:85`), then a ProseMirror parse with the editor's TipTap extensions (StarterKit without its lists, `BulletList`, `BoundedOrderedList`, `ListItem`, `TaskList`, `TaskItem` nested, the table nodes, `Image`, `Link`).
3. **Webview, saving:** ProseMirror's `DOMSerializer` (what `getHTML()` does), `preprocessTableHTML` (`Editor.tsx:117`), then `createTurndownService()` with `addTipTapTaskListTurndownRules` (`utils/turndownService.ts`, `utils/taskListRoundTrip.ts`).
4. **Host, writing:** `serializeFrontMatter` (`ritemarkEditor.ts:1304`): `ensureTrailingNewline` without front matter, `matter.stringify` with it.

The dependencies are the locked ones: `marked` 9.1.6, `turndown` 7.2.4, `turndown-plugin-gfm` 1.0.2, TipTap 2.27.2. The DOM is `@mixmark-io/domino`, as in `literalTildeRoundTrip.test.ts`. Ritemark's own files were copied unchanged from `b1ac84a7`.

**Where the harness differs from the app:**
- No comment-callout extension, so an HTML comment is lost here; the app may keep it.
- The stock `Link` mark. Ritemark's `CustomLink` adds click handling and does not override `isAllowedUri`, so links parse the same.
- No image mappings and no table header plugin.

The classes below come from a regex classifier, so the counts are approximate.

**Three corpora,** read in place and never copied:

| | Files | What they are |
|---|---|---|
| A | 1,067 | `ritemark-native`'s `docs/`, the sample project and the starter pack: written by the team and its agents in many tools since 2025 |
| B | 140 | `ritemark-dev`'s governance, product, strategy, releases and decisions: written by people and agents in Ritemark, Claude Code and Codex |
| C | 89 | READMEs of npm packages in the extension's `node_modules`: third-party, GitHub-style |

None of these is a consultant's or a trainer's own file. Phase 1 adds those forms (see the end of this note).

## Today: almost no file comes back as it was

| | A | B | C |
|---|---|---|---|
| **Byte-identical after one open and save** | **40 (4%)** | **4 (3%)** | **4 (4%)** |
| Changes again on a second save | 145 | 1 | 21 |
| Fewer links after two saves | 87 (8%) | 31 (22%) | 44 (49%) |
| Fewer images after two saves | 3 | 1 | 34 (38%) |

**Files touched by each class** (a file can be in several):

| Class | A | B | C |
|---|---|---|---|
| A blank line holding spaces between list items | 83% | 86% | 73% |
| A tight list made loose | 82% | 86% | 65% |
| A bullet padded to `-   item` | 80% | 84% | 69% |
| A soft line break written as a hard break with two trailing spaces | 48% | 46% | 63% |
| An ordered item padded to `1.  item` | 48% | 62% | 7% |
| A table's delimiter row rewritten to `\| --- \|` | 47% | 11% | 10% |
| A blank line added between a line of text and the list under it | 38% | 13% | 6% |
| A thematic break `---` written as `* * *` | 31% | 6% | 18% |
| A number and full stop escaped where no list could start (`**1\. Title**`, a table cell) | 17% | 39% | 1% |
| `*`, `+`, `-` or `#` escaped | 9% | 3% | 7% |
| Inline or block HTML dropped | 8% | 4% | 22% |
| An underscore escaped inside a word (`snake\_case`) | 8% | 4% | 9% |
| A bare or `<…>` web address written as `[url](url)` | 7% | 5% | 20% |
| A square bracket escaped (`\[1\]`, `\[\[Note\]\]`) | 6% | 2% | 11% |
| A `*` or `+` bullet changed to `-` | 0% | 0% | 31% |
| Front matter rewritten | 2% | 8% | 0% |
| A setext heading changed to `#` | 0% | 0% | 10% |

## 58 common forms, one at a time

Each form was opened and saved on its own. Today **12 of 58** come back byte for byte. These are the ones that matter for the bound:

| Written | Comes back as today |
|---|---|
| `- first item` / `- second item` (#270's fixture) | `-   first item`, a line of four spaces, `-   second item` |
| `* one` / `* two`, `+ one` / `+ two` | `-   one`, four spaces, `-   two` |
| `1. one` / `2. two` | `1.  one`, four spaces, `2.  two` |
| `1) one` / `2) two` | `1.  one`, four spaces, `2.  two` |
| `- a` / `  - b` (nested, 2 spaces) | `-   a`, four spaces, `    -   b`, eight spaces |
| `- [ ] a`, blank, `- [x] b` (loose tasks) | `- [ ] a` / `- [x] b` (made tight) |
| `- [x] task` / `- plain` | `- [x] task`, blank, `-   plain` (split into two lists) |
| `Intro:` / `- a` / `- b` | `Intro:`, blank, `-   a` … |
| `Line in doc two.` / `Agent edit verified.` | `Line in doc two.␠␠` / `Agent edit verified.` |
| `Line one\` / `Line two` (backslash break) | `Line one␠␠` / `Line two` |
| `> one` / `>` / `> two` | `> one` / `>␠` / `> two` |
| `---` | `* * *` |
| `See https://example.com` | `See [https://example.com](https://example.com)` |
| `Use my_file_name.md` | `Use my\_file\_name.md` |
| `See [1] and the [draft] note.` | `See \[1\] and the \[draft\] note.` |
| `## 1. Intro` | `## 1\. Intro` |
| `\|a\|b\|` / `\|---\|---\|` | `\| a \| b \|` / `\| --- \| --- \|` |
| `\| Name \| Qty \|` / `\|:---\|---:\|` | the alignment row becomes `\| --- \| --- \|`: **alignment is lost** |
| Front matter, blank line, body | the blank line after `---` is dropped |
| `date: 2026-10-20` in front matter | becomes a timestamp |
| `tags: [a, b]` | becomes a block list, `  - a` / `  - b` |
| `title: "Hello: world"` | `title: 'Hello: world'` |
| `# comment` in front matter | dropped |

**Unchanged today:** `*italic*` and `**bold**`, inline links to web addresses, images, a canonical `| a | b |` table, two-space hard breaks, tight task lists, `A + B`, `Issue #270`, non-ASCII text.

## Three findings that lose content, not only formatting

Each is in the app's code as well as in the harness. Phase 1 reproduces each in the app first.

1. **A link into a folder is deleted on save.**
   - TipTap 2.27's `Link` drops any link whose address `isAllowedUri` rejects. Its pattern is built in a template literal, so `[^a-z+.\-:]` becomes a range from `.` to `:`, which takes in `/`.
   - So `[report](notes/report.md)` and `[doc](user/features/x.md)` lose their link when the file opens, and the save writes the bare text. `a.md`, `./a.md` and web addresses survive.
   - `CustomLink` does not override `isAllowedUri`. Its `validate` option only feeds autolinking.
   - The same check makes `setLink` refuse such an address, so the link dialog cannot set one either (next to #502).
2. **A link or bold around code is broken apart.**
   - TipTap's `Code` mark has `excludes: '_'`, so no other mark can sit on code.
   - ``[`file.md`](file.md)`` loses its link.
   - ``**`skill-creator` is vendored**`` is written back as `` `skill-creator` **is vendored**``.
   - In the corpora: 63, 24 and 9 files have code inside a link, and 313, 21 and 8 have code inside bold.
3. **Images in a row are joined, then all but the first are deleted.**
   - TipTap's image is a block node, but `getHTML()` gives a bare `<img>`, and Turndown writes images inline. So `![a](a.png)`, blank, `![b](b.png)` is saved as `![a](a.png)![b](b.png)` on one line.
   - On the next open, `preprocessImageHTML` keeps only the first `<img>` of a paragraph, and the next save deletes the rest.
   - A gallery of screenshots is a common form in reports and handouts.

Read in the code, not measured:
- **A line break inside a task item becomes a space.** `tiptapTaskItem` joins its lines with `content.trim().replace(/\n+/g, ' ')`.
- **A task item always uses `-`.** The rule writes `- [ ]` whatever marker the source used.

## Why lists rewrite: the mechanism

- TipTap's list item holds `paragraph block*`, so `getHTML()` wraps every item's text in `<p>`, tight list or loose.
- Turndown 7.2.4's `listItem` rule (`lib/turndown.cjs.js:103–118`) treats any item ending in a paragraph as a loose item:
  - it adds a newline and indents every line by the prefix's width;
  - the prefix is `-` plus three spaces, or the number, a full stop and two spaces;
  - indenting the empty line too gives the line of four spaces.
- The editor's parse keeps nothing about how a list was written: its marker, its padding, its tightness or its indent.

- **Soft breaks:** `breaks: true` turns every single newline into a `hardBreak`. Turndown's default `br` is two spaces and a newline.
- **Thematic breaks:** `createTurndownService` sets no `hr`, so Turndown's default, `* * *`, is written.

## A prototype of the narrow fix, measured

To check that the narrow fix is enough, the harness was given a prototype of [technical-plan.md](../technical-plan.md)'s approach:
- the parse records how a list, break, rule, link and table were written, as data-only attributes (`data-md-*`) carried by TipTap node and mark attributes;
- Turndown rules write by them;
- front matter is kept byte for byte when the properties are unchanged;
- relative links are accepted, code no longer excludes other marks, and a block image is its own paragraph.

Turndown and `marked` stay as they are. The rendered document is unchanged, apart from the restored links and marks.

| | A | B | C |
|---|---|---|---|
| Byte-identical after one save, today → prototype | 4% → **38%** | 3% → **51%** | 4% → **10%** |
| Fewer links after two saves | 87 → **2** | 31 → **0** | 44 → 44 |
| Fewer images after two saves | 3 → **1** | 1 → **0** | 34 → 23 |
| Common forms back byte for byte | 12 of 58 → **44 of 58** | | |

**What the prototype left, and why it does not change the approach:**
- **Outside the bound** (spec, *Non-Requirements*):
  - HTML, HTML comments and entities;
  - setext and closed `#` headings;
  - `~~~` fences and indented code;
  - `_em_` and `__strong__`;
  - reference links;
  - padded table columns;
  - README badges, an image inside a link, which explain most of C's lost links and images.
- **Prototype gaps, to be closed in the sprint:**
  - In 81 files of A, a tight list turns loose on the second save. The first save leaves a blank line inside one item, and the second parse then reads the whole list as loose. Phase 1 finds the form; R9's second-save check catches it.
  - A number escaped after `**` or in a table cell (B's 31%). Turndown escapes `1. ` at the start of every text run. Moving that escape to the start of a line fixes it (technical-plan.md, W4).
  - A line of text directly above a list. The prototype keeps the plain case (`Intro:` and a list under it); the forms around it, such as a list under a line inside a list item or a quote, are Phase 1's.

**What this says about the bound.** In these corpora, lists, line breaks and trailing spaces are most of what a save changes, so #270 alone moves the needle. With the same-path forms in R4 and the three losses fixed in R6, most of the team's own files come back byte for byte, and links and images stop disappearing. READMEs with HTML and badges stay outside, and the people 2.1 is for rarely write those.

The other approach is to write each untouched block back from its original source. It would keep everything, HTML included. It is also the new serializer that decision 3 rules out: it has to map source blocks to editor nodes through image unwrapping, task-list splitting and list joining, and keep reference definitions alive. The measurements show the narrow fix is enough, so the plan does not take it.

## What Phase 1 adds

These forms are not in the corpora above. Phase 1 captures each from the real tool, scrubbed of names and paths:
- **Google Docs:** File ▸ Download ▸ Markdown.
- **Obsidian:**
  - a note with front matter (tags, a date, a comment);
  - `[[wikilinks]]` and `> [!note]` callouts;
  - nested lists indented with a tab, Obsidian's default.
- **ChatGPT and Claude:** answers copied into a document.
- **Ritemark 2.0.1's own output:** a Word file through Save as Markdown, and a document saved by 2.0.1.
- **Hand-typed meeting notes:**
  - soft breaks;
  - `*` bullets;
  - `Attendees:` with a list under it;
  - a bare address and an e-mail.

With Jarmo's yes (sprint-plan.md, question 5), the same harness also measures one folder of his own real files on his Mac. It records only the numbers per class: no file is copied, and no text leaves the computer.
