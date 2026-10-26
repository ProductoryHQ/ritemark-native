# The forms outside the bound (E6)

For the Development manager to file as one GitHub issue for after 2.1. Each form has its fixture in `extensions/ritemark/webview/src/utils/fidelity-corpus/known/`, with today's output pinned in `<name>.expected.md`. The corpus test proves each output is stable on a second save and loses no text, link, mark or image, with the one listed exception (`losses.json`).

| Fixture | Written as | Saved as (today, after Sprint 137) | Lost? |
|---|---|---|---|
| `image-in-link.md` | `[![Build](…/badge.svg)](…/ci)` | `![Build](…/badge.svg)` | **The link.** TipTap's image is a block node and cannot sit inside a link. The same on `main`. 21 of 89 dependency READMEs lose a badge's link this way; 1 file of the repository's 1,087. |
| `html.md` | `<span>span</span>`, `<b>bold</b>`, `<div>…</div>`, `&copy;` | `span`, `**bold**`, the block's text, `©` | The markup; the text stays. 96 of the repository's 1,087 files, 6 of the team's 132. |
| `code-span-spaces.md` | `` ` x` ``, `` `  two  spaces  ` `` | `` `x` ``, `` `two spaces ` `` | Spaces inside a code span (ProseMirror's parse collapses them). |
| `marks-nesting.md` | `~~**struck bold**~~`, `**bold [link](…) inside**` | `**~~struck bold~~**`, `**bold** [**link**](…) **inside**` | Nothing; marks are reordered and split around the link. |
| `code-forms.md` | `~~~python` fences, four-space indented code | backtick fences | Nothing. |
| `lazy-continuation.md` | a list item's continuation line with no indent | indented by the item's width | Nothing. |
| `ordered-ones.md` | `1.` `1.` `1.` | `1.` `2.` `3.` | Nothing. None of the three corpora numbers this way. |
| `reference-links.md` | `[the guide][guide]`, `[the FAQ][]` with definitions | inline links, the definitions gone | Nothing; each link keeps its address. |
| `setext-headings.md` | `Title` / `=====`, `## Closed ##` | `# Title`, `## Closed heading` | Nothing. 9 of 89 READMEs, 1 repository file. |
| `tables-outside.md` | padded columns, a table without outer pipes | `\| a \| b \|` with `\| --- \|` | Nothing. |
| `underscore-emphasis.md` | `_em_`, `__strong__`, `___both___` | `*em*`, `**strong**`, `***both***` | Nothing. `_em_` is in 21 of the repository's 1,093 Markdown files (2%), none of the team's, 22 of 89 READMEs. |
| `blank-lines.md` | two blank lines between blocks | one | Nothing. |
| `trailing-newlines.md` | several newlines at the end of the file | one | Nothing. |

Frequencies are file counts from `scripts/qa/markdown-fidelity-measure.mjs` and a line scan of the same folders (`1. 1. 1.`, `_em_`, a list directly under a line of text inside a list item: 6 of the repository's files, 1 README). Nothing of anyone's own folder was measured.
