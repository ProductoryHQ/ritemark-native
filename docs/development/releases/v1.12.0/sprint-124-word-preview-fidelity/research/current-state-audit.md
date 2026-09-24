# Sprint 124 Phase 0 — Word preview today

Read on `sprint-124-word-preview-fidelity`, branched from `origin/main` `4070ffc6`
(2026-09-23). Every claim is a line of code, a measurement, or a quoted source.

## 1. What the viewer does

`webview/src/components/viewers/DOCXViewer.tsx` renders a `.docx` with
`docx-preview` 0.3.7 (`renderAsync`, line 91) using these options:
`useBase64URL`, `inWrapper`, keep width, height and fonts, `breakPages: true`.
`ignoreLastRenderedPageBreak` is left at its default, `true`.

| Has | Missing |
|---|---|
| File name, **Save as Markdown** (Mammoth → Turndown, images to `./images/`), **Open in Word**, a `↻` refresh | Page position, previous / next page, zoom, fit width / fit page, search |
| "Loading {filename}..." text; an error screen with the message and **Try Again** | Anything that says *which* failure it was (not a Word file, password-protected, too large, damaged) |
| A `.doc` guard with a plain message (line 183) | A notice for content the preview cannot draw (charts, SmartArt, embedded objects) |

The toolbar breaks three house rules: hand-rolled `<button>`s instead of the
shadcn `Button`, native `title` hovers instead of `ui/tooltip.tsx`, and a bare `↻`
glyph for Refresh (lines 216–264).

## 2. What the host does

`src/docxEditorProvider.ts`:

- Loads **`media/webview.js`** — the one shared bundle every Ritemark webview uses
  (line 54).
- Sends the whole file as one base64 string in a `load` message; **there is no
  size limit** (`sizeBytes` is sent, line 120, but nothing checks it).
- **Open in Word** shows only when Word is installed (`checkWordInstalled`,
  line 177; `hasWord &&` in the viewer, line 235). The host already knows the
  fallback — `getWordProcessorAppName` returns *Pages* on macOS and *default
  application* elsewhere — but the viewer hides the button, so a Mac without Word
  has **no way to open the document externally** from the preview.
- Watches the file and posts `fileChanged` / `fileDeleted` (lines 209, 225), but
  **the DOCX viewer listens to neither** (only `SpreadsheetViewer` does). An
  external edit shows only after a manual refresh; a deleted file keeps showing.

## 3. Page breaking is not pagination

The `docx-preview` README, verbatim in `node_modules/docx-preview/README.md`
(lines 96–106): it starts a new page only at a manual page break, at a section
change (e.g. portrait → landscape), and — **only if `ignoreLastRenderedPageBreak`
is `false`** — at the `<w:lastRenderedPageBreak/>` markers Word stores when it
saves. *"Realtime page breaking is not implemented."*

So today, with that option at its default, **a document without manual breaks
renders as one very tall "page"**. Turning the option off would give pages close
to Word's for documents **Word last saved**. Documents written by other tools
(Google Docs export, generators, many converters) carry no markers and would still
show long pages. Computing page breaks ourselves means re-implementing Word's
layout, which the issue rules out. This is the central fidelity limit, and the
corpus has to measure it for both kinds of document.

## 4. The renderer

| Version | Date | What matters here |
|---|---|---|
| 0.3.7 (ours) | 2025-09-30 | — |
| 0.4.0 | 2026-07-07 | **Breaking:** an `h()` hook creates most HTML nodes; nested smart tags; `[Content_Types].xml` parsing |
| 0.4.1 | 2026-09-21 | `pageBreakBefore` set as direct formatting now breaks the page; the even/odd headers fix re-merged; minor bug fixes (no release notes — read from the commit log) |

We call only `renderAsync`, which the README calls the one stable API, so the
breaking change should not hit our call. The spike candidate is **0.4.1**, not
0.4.0: its only product change is a page-break fix. It is Apache-2.0, like 0.3.7.

## 5. The shared bundle

A source-mapped build of today's `webview.js` (8.9 MB), attributed by package:

| Share | What |
|---|---|
| **≈ 47 %** | Mermaid and its layout stack (`mermaid`, `elkjs`, `@mermaid-js/parser`, `cytoscape`, `layout-base`, `cose-base`, `dagre-d3-es`, …) |
| 5.6 % | `xlsx` |
| 5.0 % | `pdfjs-dist` |
| **≈ 6 %** (0.55 MB) | **The Word path:** `docx-preview` 75 KB, `jszip` 97 KB, and Mammoth with its dependencies (`mammoth`, `dingbat-to-unicode`, `bluebird`, `@xmldom/xmldom`, `xmlbuilder`, `underscore`) |

Nothing outside `DOCXViewer.tsx` imports `docx-preview`, `mammoth` or `jszip`.

Two consequences:

- Moving the Word code out saves ordinary views only about 0.55 MB. The real gain
  goes the other way: **a Word tab would load a bundle of roughly 1 MB instead of
  8.9 MB**, and Sprint 125's PowerPoint renderer gets a place to live that is not
  the shared bundle. The large win for every view is Mermaid, and that belongs to
  [#107](https://github.com/ProductoryHQ/ritemark-native/issues/107), not here.
- The build is one IIFE with `inlineDynamicImports: true`
  (`webview/vite.config.ts`), so code cannot be lazy-loaded inside it. A boundary
  means a **second bundle file**.

## 6. What a second bundle touches

`webview.js` is named explicitly by the release tooling:

| File | Role | Tier |
|---|---|---|
| `.claude/hooks/pre-commit-validator.sh` Checks 2, 4, 5, 6 | size, raw-Tailwind, freshness, sentinel | harness |
| `scripts/release-extension.sh` (file list, line ~191) | the extension-update manifest — **a file not listed is not shipped** by an extension-only update | extension lane |
| `scripts/release-extension-preflight.sh`, `scripts/check-bundled-extension-complete.sh` | presence / freshness checks | harness |
| `scripts/build-prod.sh` (lines 110–126), `scripts/build-prod-windows.sh`, `scripts/stage-extension-for-shell-build.sh` | clean-rebuild check, staging | **shell-tier** |

So the asset boundary makes Sprint 124 **shell-tier**. v1.12.0 is already planned
as a full-app release, so this changes the sprint's gate, not the release's.

## 7. What the machine can do for ground truth

- **Microsoft Word is installed** on this Mac. It can re-save a document (adding
  Word's page markers) and export it as PDF via AppleScript. The first scripted
  run asks macOS for Automation permission, which only Jarmo can grant.
- `pdftoppm` (PDF → PNG pages) and ImageMagick `compare` (per-page difference)
  are installed.
- LibreOffice is **not** installed.
- The extension already depends on the **`docx` package** (`package.json` line
  817, used for DOCX export). It can generate the fixtures: headings, lists,
  tables, images, headers and footers, footnotes, sections, landscape pages,
  equations and embedded fonts. **No new dependency is needed for the corpus.**
- Only one `.docx` is in the repository (a Sprint 46 Mermaid smoke test). There
  is no corpus.

## 8. Style isolation

`docx-preview` writes its CSS into a style container we pass in, under a `docx`
class prefix. The document still lives in the same DOM as the webview's
Tailwind preflight (`img { max-width: 100%; height: auto }`, list and heading
resets, table defaults), which can leak into the rendered page. Whether it does
is measured against the corpus. The cure, if needed, is rendering into a shadow
root.

## Conclusions for the plan

1. Build the corpus and the Word ground truth **first**. Nothing about the
   renderer changes without it.
2. Spike **0.4.1** with `ignoreLastRenderedPageBreak: false` against 0.3.7 as it
   is today, and adopt it only on evidence.
3. A dedicated `media/office-preview.js` bundle is the asset boundary. It makes
   the sprint shell-tier and touches the release tooling listed in §6.
4. The viewer needs page, zoom, fit and search controls, an **Open externally
   that is always there** (Word, else Pages, else the default app), and specific
   failure messages. It should also follow `fileChanged` / `fileDeleted`.
5. Documents Word did not save keep long pages. The product states that limit;
   it does not paper over it.
