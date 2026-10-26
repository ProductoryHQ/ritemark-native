# The corpus on main's pipeline, and after

`scripts/qa/markdown-fidelity-measure.mjs` with `--harness` pointed at a copy of `main`'s pipeline (08761e71) for *before*, and the branch's own harness for *after*. Each file is opened and saved through the editor's code as the corpus test does; the numbers are files, never content.

## The kept set (30 files, `fidelity-corpus/kept/`, before `brackets-around-marks.md` was added after QA's review)

The corpus test fails on `main`'s behaviour: 2 of the 30 kept files come back byte for byte after one open and save. On the branch, 30 of 30, after one save and after two, and a one-word edit changes exactly one line in each.

| On main, of 30 kept files | Files |
|---|---|
| Byte-identical after one open and save | 2 (7%) |
| Changes again on a second save | 4 (13%) |
| Fewer links after two saves | 2 (7%) |
| Fewer images after two saves | 2 (7%) |
| New trailing whitespace | 21 (70%) |
| A blank line holding spaces | 18 (60%) |
| A tight list made loose | 18 (60%) |
| A bullet padded to `-   item` | 16 (53%) |
| An ordered item padded to `1.  item` | 12 (40%) |
| A soft line break written as two trailing spaces | 11 (37%) |
| A table delimiter row rewritten | 6 (20%) |
| A blank line added between a line of text and the list under it | 4 (13%) |
| A thematic break `---` written as `* * *` | 4 (13%) |
| A `*` or `+` bullet changed to `-` | 4 (13%) |
| A number escaped (`1\.`) | 3 (10%) |
| A bare or `<…>` address written as `[url](url)` | 3 (10%) |
| A square bracket escaped | 3 (10%) |
| Inline or block HTML dropped | 2 (7%) |
| Front matter rewritten | 2 (7%) |
| `*`, `+`, `-` or `#` escaped | 1 (3%) |
| An underscore escaped inside a word | 1 (3%) |

## The three wider corpora

- **A:** the repository's own Markdown (`docs/`, the sample project, the starter pack), 1,087 files.
- **B:** the team's governance, product, strategy, release and decision documents in `ritemark-dev`, 132 files.
- **C:** the READMEs of the extension's npm dependencies, 89 files: GitHub-style READMEs, HTML and badges included.

| | A before | A after | B before | B after | C before | C after |
|---|---|---|---|---|---|---|
| Byte-identical after one open and save | 47 (4%) | 767 (71%) | 4 (3%) | 118 (89%) | 4 (4%) | 14 (16%) |
| Changes again on a second save | 148 (14%) | 4 (0%) | 1 (1%) | 0 | 21 (24%) | 3 (3%) |
| Fewer links after two saves | 94 (9%) | 1 (0%) | 34 (26%) | 0 | 26 (29%) | 21 (24%) |
| Fewer images after two saves | 3 (0%) | 0 | 1 (1%) | 0 | 18 (20%) | 0 |
| New trailing whitespace | 959 (88%) | 0 | 125 (95%) | 0 | 78 (88%) | 1 (1%) |

Measured on 26 October 2026, both columns the same day (B is a live folder, so its files move between days).

What is left, in short:

- **A:** 320 files still change. The named kinds: inline or block HTML dropped in 96 (outside the bound), `*`/`+`/`-`/`#` escapes in 23, a tight list made loose in 17 (lazy continuation lines and lists under a line inside an item, outside the bound), a blank line added under a line of text in 4, one each of the rest. The other files change in forms the measure does not name one by one, the known set's forms (`_em_` as `*em*`, reference links, padded table columns). One file loses one link: an image inside a link.
- **B:** 14 files still change: HTML in 6, a tight list made loose in 2, an escaped bracket in 1, and unnamed forms.
- **C:** READMEs are mostly HTML and badges. The 21 files with fewer links are badges, an image inside a link (`[![badge](…)](…)`): the image is kept and the link around it is lost, on `main` too. It is pinned in `known/image-in-link.md` and its `losses.json`, and it goes into the out-of-bound issue (E6).
