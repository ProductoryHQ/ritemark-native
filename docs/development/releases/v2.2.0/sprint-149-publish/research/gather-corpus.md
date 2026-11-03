# A3: the gather's corpus

Sprint 149, Phase 1, no account, gates W3 (PR 3). A read-only audit, 3 November 2026: each page's text was scanned for references (`src`, `href`, `srcset`, `poster`, CSS `url()` and `@import`, module `import`, `fetch`) by a throwaway script; nothing was opened or launched.

**The corpus is ten real pages from Ritemark's own private repos** (most written by Claude for Jarmo: dashboards, design boards, slides, a prototype, release pictures, a demo API page), plus the spike's `hostile.html`. Their paths and contents stay out of this public repo; each is named by what it is. **Not in it:** a Claude.ai or ChatGPT downloaded artifact and a template-site page, since none is in the repos and reading Jarmo's own Downloads is out of scope. Claude-written pages stand in for the first; the template site is still to add before PR 3's tests freeze (one free template, downloaded by Jarmo or the lead into a scratch project).

## Finding in one line

R3's rules hold, with two changes for `spec.md` before PR 3: a `../` reference that stays inside the project is common and must go up (it is "outside" only when it leaves the project), and references a script builds at run time are common enough (4 of 10 pages) that the sheet should say so in a line rather than stay silent.

## The pages

| # | What it is | Local files it uses | Remote | Other pages | Built by script |
|---|---|---|---|---|---|
| P1 | A planning board (single file, 155 KB) | none | Google Fonts (`link`) | none | yes (24 sites: `innerHTML`, `createElement`) |
| P2 | Release hero options (pictures in a folder) | `img/…webp` via `img src` and `srcset`, **as template strings** (`img/slide-${key}.webp`) | Google Fonts | none | yes: every picture |
| P3 | A demo API reference | none | none | `../dashboard/…html` (`a href`, `../`) | no |
| P4 | A demo dashboard (inline SVG) | none (`url(#grad)` fragments only) | none | none | no |
| P5 | A users dashboard | none | Google Fonts; GitHub links | one `a href` built from data | yes (10) |
| P6 | A before/after comparison | **39 pictures** (`before/…png`, `after-…png`), plain `img src` in two folders | Google Fonts | none | no |
| P7 | A slide index | `../tokens.css` (`link href`, `../`, inside the project) | via the stylesheet's `@import` of Google Fonts | 7 sibling slide pages (`a href`) | no |
| P8 | A design-system preview | `../tokens.css` | as P7 | 3 sibling pages | no |
| P9 | An interactive prototype | none | Google Fonts | none | yes (6) |
| P10 | A foundation drawing | none | Google Fonts | none | no |
| H | The spike's `hostile.html` | none | cdnjs (lodash) | none | yes; `fetch('file:///etc/hostname')`, `fetch('file:///etc/hosts')` |

## What it means for R3 (`spec.md`, to change before PR 3's tests)

1. **`../` inside the project goes up.** P3, P7 and P8 reference a parent folder that is still in the project. R3 already resolves "against the page's folder … `realpath`ed", so the rule is right; the scenarios need a positive case beside S8 (`../tokens.css` from `slides/index.html` goes up, keeping its path relative to the page's folder). **The upload's layout follows:** with a parent reference, the page can't sit at the Worker's root with its files beside it unchanged; the published tree must be rooted at the deepest folder that holds the page and every gathered file, with `/` redirecting to the page. W4 needs this.
2. **Script-built references are common** (P1, P2, P5, P9, H). P2 is the trap: its pictures exist in the project and work locally, but the gather sees none of them, so the published page shows broken pictures. R3 says "not guessed", which stays; add to R5 one plain line in the sheet when the page builds file names in its script ("This page loads some files from its script. Ritemark can't see which, so they won't go."), and a scenario for it. Detection is cheap (a template string or concatenation inside `src`/`srcset`/`href` values, or `.src =` in a script), and a false line costs nothing.
3. **Links to other pages are frequent** (P3, P7, P8). R3's "named as left out" stands; with 7 links in P7 the Left out list should fold them into one line ("7 other pages, so their links won't work").
4. **Stylesheets reach out with `@import`** (P7, P8 through `tokens.css`). R3's recursion through linked CSS covers it; remote `@import`s stay remote.
5. **Picture-heavy pages are real** (P6: 39 files in two folders). Well inside the free plan's limits; the sheet's "This page and 39 files" with See the files folded is the right default.
6. **`file://` references** appear only in the hostile page, in `fetch` (not a tag). The gather never follows `fetch`, so they don't go; S11's tag cases stay as written.
7. No page used `poster`, CSS `url()` to a local file, module `import`, or a `<base href>`. The boundary tests keep those cases (S8–S13) from the spec, not from the corpus; `<base href>` should be added: it changes how every relative reference resolves, and the gather must honour it or refuse it.
