# Sprint 125 Phase 0 — PowerPoint preview renderer spike

2026-09-24. Question: is `@aiden0z/pptx-renderer@1.3.0` good enough to render `.pptx`
read-only inside a Ritemark webview, measured against PowerPoint's own rendering?
`pptx-preview@1.0.7` is the alternative. Microsoft PowerPoint 16.113.1 on macOS is the
reference. Everything here is synthetic; no real document was opened.

The spike ran in a scratch directory before the sprint started. Its measurements,
side-by-side sheets and focused crops are in [spike-results/](./spike-results/); the
generator, harnesses and fixtures move into `research/corpus/` with R1.

## Summary

**Adopt `@aiden0z/pptx-renderer` 1.3.0, with conditions. Reject `pptx-preview`.**

- **Fidelity.** On text, bullets, tables, pictures, shapes, groups, layouts and
  backgrounds, pptx-renderer is close to PowerPoint. Nearly every visible difference
  comes from fonts, because Calibri and Aptos are not installed outside Office.
- **Charts are its weak spot.** They are drawn but approximate. One defect misleads the
  reader: multi-series bar and column charts that PowerPoint has saved come out
  coloured by category instead of by series.
- **Cost.** A 40-slide deck renders in a median 124 ms, with a 6 MB JS heap and
  1,783 DOM nodes.
- **Webview fit.** It needs no eval, workers, WASM or network access, and uses
  `blob:` images only. It even works without `'unsafe-inline'` styles.
- **Safety.** It has real ZIP limits, but they are **off by default**, and a ZIP entry
  that lies about its size gets past them.
- **pptx-preview** draws charts as empty axes with a Chinese placeholder title. It drops
  table styles, bullets, two preset shapes and every font choice (all text comes out
  in Times). It fails silently on a bomb, and its source is closed.

## Fixtures

Written by `gen-fixtures.py` (python-pptx 1.0.2), 16:9 (13.333 × 7.5 in = 1280 × 720 px
at 96 dpi). Archive timestamps are pinned, so reruns are byte-identical.

| Fixture | Tests |
|---|---|
| `01-title-bullets` | Title slide, five bullet levels, mixed runs (bold, italic, underline, colour), numbered lists (`1.` and `a)`), alignment, an overflowing body, Two Content |
| `02-tables` | Built-in table style (header, banding), vertical and horizontal merges, cell fills; a plain table with custom column widths and wrapped cells |
| `03-images` | PNG at native aspect and stretched, transparent PNG, crops (PNG and JPEG), a full-bleed picture with text over it |
| `04-shapes-groups` | 10 presets, dash styles, 45° gradient, rotation, flipH, no-fill outline, straight connector with an arrowhead, elbow connector, nested groups, a rotated group |
| `05-charts` | Clustered column with data labels, horizontal bar, line with markers, pie with `0%` labels, doughnut |
| `06-fonts` | Theme fonts set to Aptos Display / Aptos, plus explicit Calibri, Calibri Light, Aptos, Arial, Helvetica Neue, Times New Roman, Georgia, Courier New, and "Ritemark Nowhere Sans" (installed nowhere); one paragraph wrapped in four fonts |
| `07-notes` | Three slides with speaker notes |
| `08-long-40-slides` | 40 slides cycling chart, bullets, table, shapes and picture (cost) |
| `09-layouts-backgrounds` | Section Header, Comparison, Content with Caption; solid, gradient and dark slide backgrounds; a hyperlink |
| `10-media-heavy-40` | Cost only (`gen-heavy.py`, no ground truth): 40 slides, each with a distinct 1920 × 1080 JPEG; 8 MB |
| `f1-not-a-zip` | A text file named `.pptx` |
| `f2-truncated` | The first half of `01` |
| `f3-decompression-bomb` | A valid deck whose `slide1.xml` inflates to 504 MiB of whitespace; the file is 0.55 MB |
| `f4-bomb-lying-size` | `f3`, with the entry's size in the local header and the central directory rewritten to 4 KiB |
| `f5-password-protected` | `01` saved by PowerPoint with an open password: an encrypted OOXML file, which is CFB, not ZIP |

Each deck was measured in two forms:
- **generated:** as python-pptx writes it;
- **PowerPoint:** re-saved by PowerPoint.

Only the charts differ between the two (see defect 1).

**Not covered:**
- SmartArt and OMML equations: python-pptx cannot write them.
- Embedded fonts, audio and video, hidden slides, and 4:3 decks.

## Method

| Step | Tool |
|---|---|
| Fixtures | `python3 gen-fixtures.py`; `python3 gen-heavy.py` |
| PowerPoint ground truth | `bash ppt-ground-truth.sh [names]`: AppleScript opens each deck, runs `save … as save as PDF` and re-saves `as save as Open XML presentation` into `ppt/`, then `pdftoppm -r 96` writes `ppt/png/`. `ppt-password.sh` writes `f5`. `ppt-close.sh` closes only corpus presentations, by name |
| Harnesses | `harness/aiden.js` (`PptxViewer`, list mode, `fitMode: 'none'`, `pdfjs: false`) and `harness/preview.js` (`init(dom, {width: 1280, height: 720, mode: 'list'})`), bundled by `node build-harness.mjs` (esbuild, minified IIFE, like the webview bundle) |
| Capture | `node capture-pptx.mjs --bundle … --out … [--csp docx\|strict] [--limits] [--lazy] [--css f]`. Playwright's `chrome-headless-shell` over CDP, a fresh browser per file, one PNG per slide. The page runs under the **DOCX preview's CSP** (`docxEditorProvider.ts`). It logs CSP violations and wraps `fetch`, XHR, `Worker`, `WebAssembly`, `eval`, `Function` and `URL.createObjectURL` |
| Compare | `python3 compare.py ppt/png results label=dir… --sheets --prefix p`. **diff** is Sprint 124's metric: mean absolute grey-level difference, in %, at 200 px wide (lower is closer). **d640** is the same at 640 px wide, which is more sensitive to where text sits |
| Cost, disposal | `timing.sh` (5 runs, medians), `leak-test.mjs` (15 open/destroy cycles in one page) |
| Audit | `static-audit.sh`, `licenses.mjs`, `size-split.mjs`, `bisect.sh` (Tailwind preflight, rule by rule) |

PowerPoint's automation permission had already been granted, and no prompt appeared.
PowerPoint's `open` often never answers the Apple Event, and some opens took
1–4 minutes. The script therefore sends `open` without waiting for the reply, then
polls for the presentation by name. The first attempt timed out; the rerun completed
all nine decks.

## Results

Slide sizes are 1280 × 720 in PowerPoint and in both renderers, and every renderer
produced PowerPoint's slide count on every fixture. The diff columns are for the
PowerPoint form; the generated form gives the same numbers except for 05 (renderer 4.55)
and 08 (renderer 1.22).

| Fixture | Slides | pptx-renderer diff / d640 | pptx-preview diff / d640 | Visual judgement |
|---|---:|---:|---:|---|
| 01 title + bullets | 5 | 2.72 / 4.26 | 4.16 / 4.78 | **R:** levels, glyphs, numbering, alignment and runs match; lines wrap earlier because of the fallback font. **P:** no bullet glyphs, the master's sizes are lost (≈ 10 pt), the body is mis-anchored, Times |
| 02 tables | 2 | 1.61 / 2.47 | 5.81 / 6.45 | **R:** table style, banding, merges and fills are near-exact. **P:** table style lost (no header fill, banding or borders) |
| 03 images | 3 | 1.36 / 1.88 | 1.29 / 1.89 | Both correct, crops included (checked at full size). **R:** text over the full-bleed picture sits ≈ 10 px low |
| 04 shapes + groups | 3 | 1.48 / 2.03 | 2.64 / 3.15 | **R:** every preset, fill, dash, rotation, flip, connector and nested or rotated group is right; text in the triangle and chevron is clipped (defect 6). **P:** Star and Cloud missing, the 45° gradient drawn vertical |
| 05 charts | 3 | 4.92 / 5.48 | 9.92 / 10.23 | **R:** all five chart types drawn; defects 1–5. **P:** every chart empty (axes only), titled "图表标题" ("chart title") |
| 06 fonts | 2 | 3.74 / 6.41 | 4.63 / 7.06 | **R:** installed fonts are right; Office fonts fall back to `system-ui`, the unknown font to Times (defects 7, 8). **P:** every line in Times, Arial and Courier New included |
| 07 notes | 3 | 1.35 / 2.08 | 1.92 / 2.15 | Slides fine. **Neither library reads speaker notes** (defect 12) |
| 08 forty slides | 40 | 1.13 / 1.63 | 3.67 / 3.97 | **R:** non-chart slides 0.5–1.4; chart slides ≈ 2.35 (auto title missing, axis scale). **P:** charts empty (≈ 6.6 each) |
| 09 layouts + backgrounds | 4 | 1.71 / 2.14 | 2.01 / 2.27 | **R:** inherited positions, all-caps from the layout, and all three backgrounds are right; hyperlink colour differs (defect 10). **P:** layout text styles and positions lost |

Sheets: PowerPoint form `spike-results/ppt-NN-*.jpg`, plus the generated form of the chart
deck, `gen-05-charts.jpg` (PowerPoint left, pptx-renderer middle, pptx-preview right).

## pptx-renderer defects, and their fixes

| # | Defect | Seen in | Fix |
|---|---|---|---|
| 1 | **A multi-series bar or column chart is coloured by category, not by series**, which contradicts its own legend. PowerPoint writes `<c:varyColors val="1"/>` when it re-saves; the spec and PowerPoint apply that flag only to single-series charts | 05 and 08, PowerPoint form ([crop](./spike-results/defect-chart-vary-colors.jpg)) | Pre-render XML pass: `varyColors=0` when a bar, line or area chart has more than one series. Upstream PR |
| 2 | **Chart titles missing.** An empty `<c:title>` (meaning "use the series name", as PowerPoint writes it) draws nothing; a single-series chart's automatic title is missing | 05 pie and doughnut, PowerPoint form ([crop](./spike-results/defect-pie-labels-titles.jpg)); 08 chart slides | Same pre-pass: write the series name into the title text. Upstream |
| 3 | Pie labels ignore the number format (`0%` shows as `0.46`; one reads `0...`) and collide with the legend | 05 ([crop](./spike-results/defect-pie-labels-titles.jpg)) | Upstream issue; accept for a preview |
| 4 | A bottom legend overlaps the category-axis labels | 05 column and line charts | Upstream; cosmetic |
| 5 | The automatic axis scale differs (0–10 step 2, against PowerPoint's 0–9 step 1) | 08 chart slides | Accept |
| 6 | Text in non-rectangular presets uses the bounding box, not the preset's text rectangle, so "Triangle" and "Chevron" are clipped | 04 ([crop](./spike-results/defect-preset-text-rect.jpg)) | Upstream; accept for a preview |
| 7 | **Office fonts are missing outside Office** (as in Sprint 124). The library's stack for Calibri is `Calibri, Aptos, Carlito, system-ui, Arial…`, so on a Mac it lands on SF Pro, which is wider, and lines wrap earlier | 01, 06 and every Office-default deck | Pass `fontFaces`: `local()` aliases to Helvetica Neue or Arial with `size-adjust` (Sprint 124 found 88 % best), or ship Carlito. Same decision as Sprint 124 |
| 8 | **A font installed nowhere falls back to Times.** The stack gets no generic family | 06 ([crop](./spike-results/defect-unknown-font-times.jpg)) | Before rendering, collect the deck's typefaces (theme and runs), test each with `document.fonts.check()`, and register a sans alias for missing ones through `fontFaces`. Or upstream: append `sans-serif` |
| 9 | **The host page's CSS leaks in.** Under the webview's Tailwind 3 preflight, 01 goes from 2.72 to 3.27. The bisect pins it to `html { font-family }`: elements the renderer does not style (bullets and empty runs, by the look of the shifts) inherit the page font and change line heights. `img { max-width: 100% }` does **not** break crops here, unlike docx-preview | 01 (a rule-by-rule bisect) | Mount the viewer in a container that pins `font-family` (the deck's minor-font stack) and `line-height: normal`, or in a shadow root |
| 10 | A hyperlink keeps its run colour where PowerPoint uses the theme's hyperlink colour. Links are live: `<a target="_blank">`, and `window.open` for click actions | 09 ([crop](./spike-results/defect-hyperlink-colour.jpg)) | Accept the colour. Decide the link policy (intercept, then route through the host or disable) |
| 11 | Text over a picture sits ≈ 10 px lower than in PowerPoint | 03 slide 3 | Accept |
| 12 | **Speaker notes are not supported** (the README says so; neither library parses `notesSlide`) | 07 | If the preview should show notes, read `ppt/notesSlides/*.xml` ourselves (JSZip is already in the webview) |
| 13 | Charts animate for 1 s on every mount, again when a windowed list remounts them | 05, 08 | Optional: an esbuild alias shim for `echarts/core` that turns animation off; or accept |
| 14 | **Failures.** Messages are JSZip's raw text, a URL included; a password-protected deck reads as "not a zip"; ZIP limits are off by default; a lying size header gets past them (below) | f1–f5 | Always pass `RECOMMENDED_ZIP_LIMITS`, plus a host pre-check (Sprint 124's R5): CFB magic `D0 CF 11 E0` means password-protected; no end-of-central-directory means damaged; inflate each entry in the extension host with Node `zlib.inflateRawSync(…, { maxOutputLength })` and a total cap before the bytes reach the webview |

## Failure fixtures

Measured in headless Chromium. An empty page is ≈ 295 MB of RSS.

| Fixture | pptx-renderer, default (no limits) | pptx-renderer + `RECOMMENDED_ZIP_LIMITS` | pptx-preview |
|---|---|---|---|
| f1 not a zip | throws "Can't find end of central directory : is this a zip file ? If it is, see https://stuk.github.io/jszip/…", 1 ms | same | same |
| f2 truncated | "Corrupted zip: can't find end of central directory", 1 ms | same | same |
| f3 bomb (504 MiB) | **inflates it and renders**: 5.2 s, **peak RSS 3.6 GB** | **rejected in 2 ms**: "PPTX zip limit exceeded: ppt/slides/slide1.xml is 528483324 bytes > maxEntryUncompressedBytes 33554432" | renders after 2.4 s; peak RSS 1.9 GB; **JS heap stays at 1 GB** after rendering |
| f4 lying bomb | inflates all of it, then "Bug : uncompressed data size mismatch": 2 s, peak RSS ≈ 940 MB | **the limits do not help**: same, 2.2 s, 780–940 MB | **silent**: resolves with 0 slides, no error, nothing in the console |
| f5 password | "Can't find end of central directory…" | same | same |

A larger lying bomb was not tried. JSZip inflates the whole entry before any size
check, so the ceiling is the webview's memory.

## Cost

Medians of 5 runs, fresh headless Chromium per run. "total" runs from bytes to the last
slide mounted (fonts ready, two frames). Heap is the JS heap after GC with the deck on
screen. RSS is the whole browser process tree.

| Configuration | Fixture | total ms (parse / build / render) | JS heap | RSS, empty → peak | DOM nodes |
|---|---|---:|---:|---:|---:|
| pptx-renderer, eager list | 01 (5 slides) | 35 (7 / 4 / 13) | 3.0 MB | 295 → 338 MB | 164 |
| pptx-renderer, eager list | **08 (40 slides)** | **124** (14 / 8 / 44) | **6.2 MB** | 298 → 392 MB | 1,783 |
| pptx-renderer, eager list | 10 (40 photos, 8 MB) | 135 (89 / 6 / 25) | 3.2 MB | 326 → 425 MB | 360 |
| pptx-renderer, windowed + lazy + limits | 08 | 219 (first 4 slides mounted) | 3.3 MB | 298 → 363 MB | 285 |
| pptx-renderer, windowed + lazy + limits | 10 | 216 | 2.9 MB | 326 → 400 MB | 108 |
| pptx-preview | 08 | 82 (its charts are empty) | 6.7 MB | 295 → 352 MB | 2,408 |
| pptx-preview | 10 | 238 | 6.7 MB | 322 → 534 MB (`data:` URLs) | 561 |

**Disposal.** `viewer.destroy()` (also `[Symbol.dispose]`):
- revokes its `blob:` URLs (3 of 3 on 03);
- disconnects its observers;
- disposes ECharts instances and clears the DOM (0 nodes and 0 canvases left).

`open()` takes an `AbortSignal`. Handles from `renderSlideToContainer` and thumbnails
are the caller's to dispose.

Over 15 open/destroy cycles on 08, the heap after GC went 1.95 → 5.19 MB after the
first cycle (one-time module caches), then to 6.24 MB after 15. That is a diminishing
≈ 40–70 KB per cycle; 05 behaves the same. No meaningful leak.

## Audit

| Area | pptx-renderer 1.3.0 | pptx-preview 1.0.7 |
|---|---|---|
| Harness bundle, minified IIFE with all dependencies | 1,220 KiB; **380 KiB gzip**; 317 KiB brotli | 1,331 KiB; 423 KiB gzip |
| of which charts | ECharts 6 (tree-shaken: 7 chart types, canvas) + zrender: 615 KiB min, 209 KiB gzip (**55 %** of gzip) | full ECharts 5 + zrender (`import * as echarts`): ≈ 1,020 KiB min |
| of which the renderer's own code | 508 KiB min / 141 KiB gzip (includes bundled mtx-decompressor) | 139 KiB (minified, no source) + lodash 75 KiB |
| Added to the webview bundle | ≈ 1,123 KiB min / 351 KiB gzip (JSZip 3.10.x is already in it); `media/webview.js` is 8.35 MB today, so **+14 %** | — |
| CSP (DOCX preview policy) | 0 violations on every fixture. **Also 0 under a strict policy without `'unsafe-inline'`**, pixel-identical: all styling goes through CSSOM (`el.style.cssText`). The equation and path-gradient paths use `setAttribute('style')`, so they would need `'unsafe-inline'` for styles, which the DOCX policy has | 0 violations |
| eval / `new Function` | none at run time. The one static hit is JSZip's `setimmediate` polyfill, which never runs with a function argument | none at run time; ECharts 5 contains `new Function("return ("+r+");")` (map JSON; never ran) |
| Workers, WASM, dynamic `import()` | only in the optional PDF.js path (a blob module worker for EMF-embedded PDF previews); `pdfjs: false` turns it off; `import.meta.resolve` is absent in an IIFE, so the default never reaches for it. 0 at run time | none |
| Network | none (`fetch` and XHR never called); images are `blob:` URLs (allowed by `img-src blob:`). External audio and video relationships would render only for http(s) URLs, and the webview CSP blocks them | none; images are `data:` URLs |
| `<style>` elements, `insertRule` | none | none |
| Fonts | `FontFace` from bytes for embedded EOT fonts (bounded by default: 16 faces, 250 ms); host `fontFaces` option | none |
| ZIP safety | `RECOMMENDED_ZIP_LIMITS` (4,000 entries, 32 MiB per entry, 256 MiB total, 192 MiB media), **opt-in; `parseZip` defaults to none**. Checked against declared sizes before inflating (f3: 2 ms), **so a lying header gets past it** (f4). Also caps chart `ptCount` at 10,000 and bounds EMF bitmaps | none |
| Error isolation | per node: a failing shape becomes a dashed-red placeholder; `onSlideError` and `onNodeError` (none fired on the corpus) | swallows some failures (f4) |
| Maintenance | Apache-2.0, TypeScript types, 12 releases from 2026-02-28 to 2026-09-14, visual regression against PowerPoint upstream; single maintainer | single maintainer; source closed ("source code for personal study only… source on paid request"); npm package free for commercial use; docs in Chinese only |

**Licenses of the runtime dependencies** (`spike-results/licenses.json`):
- **pptx-renderer:**
  - Apache-2.0: `@aiden0z/pptx-renderer`, `echarts` 6.1.0 (ships a NOTICE file we must carry).
  - BSD-3-Clause: `zrender`.
  - 0BSD: `tslib`.
  - MIT OR GPL-3.0-or-later: `jszip` (we take MIT, as the webview already does).
  - MIT and Zlib: `pako`.
  - MIT: `lie`, `immediate`, `readable-stream`, `setimmediate` and friends.
  - ISC: `inherits`.
  - MPL-2.0: **`mtx-decompressor` 1.4.2**, bundled unmodified inside the dist. File-level copyleft: carry the notice and the source link; `THIRD_PARTY_NOTICES.md` has both. The package also declares `mtx-decompressor` ^1.4.2 (1.6.0 installed), which the dist never imports.
  - Nothing GPL-only.
- **pptx-preview:** ISC in `package.json`, but the README restricts its (unpublished) source. Its dependencies are MIT, Apache-2.0 and BSD.

## Recommendation

1. **Adopt `@aiden0z/pptx-renderer` 1.3.0**, pinned. Call only `PptxViewer` (or
   `parseZip` → `buildPresentation` → `renderList`) with `pdfjs: false`,
   `zipLimits: RECOMMENDED_ZIP_LIMITS`, and `destroy()` on dispose. Pass an `AbortSignal`
   when the editor closes mid-load.
2. **Host pre-check before any byte reaches the webview** (defect 14):
   - CFB magic → "password-protected";
   - no end-of-central-directory → "damaged or not a presentation";
   - a bounded inflate of every entry with `maxOutputLength` and a total cap → "too large".

   Map every failure to our own message; never show JSZip's text.
3. **A small, unit-tested pre-render pass on the chart XML** for defects 1 and 2
   (`varyColors` on multi-series charts; title text for an empty `<c:title>`). Offer
   both upstream.
4. **Fonts:**
   - register Office-font aliases through `fontFaces`;
   - give missing families a sans fallback (defects 7 and 8);
   - pin `font-family` and `line-height` on the viewer's container (defect 9).

   Shipping Carlito and Caladea is the same open decision as in Sprint 124.
5. **Speaker notes**, if wanted, come from our own `notesSlides` reader (defect 12).
6. Accept defects 3–6, 10–11 and 13 for a read-only preview.
7. **Reject `pptx-preview`.**
   - Charts render empty with a Chinese placeholder title.
   - It loses table styles, bullets, master text sizes, two presets and every font.
   - On the bomb it keeps 1 GB of heap; on the lying bomb it fails silently.
   - Its source is closed and it bundles all of ECharts 5.

## Open questions

- **Not measured:**
  - SmartArt: both libraries reference the drawing fallback; pptx-renderer claims to render it.
  - OMML equations, embedded fonts, audio and video, hidden slides, 4:3 decks.
  - A real deck. A PowerPoint-made deck from Jarmo, rendered in the scratchpad only, is the next check.
- **The real webview was not exercised.** Headless Chromium with the DOCX CSP stood in.
  The result has to be confirmed in RUNDEV, links included.
- **Where the code lives:** add about 1.1 MB (min) to the single IIFE webview bundle, or
  build a separate entry loaded only for `.pptx`?
- **Eager or windowed list?** Eager settles faster (124 ms, 1,783 nodes for 40 slides).
  Windowed keeps the DOM small but remounts and re-animates charts. A slide-count
  threshold is one option.
- **Link policy:** clicking a link in a preview. Intercept, then route through the host
  or disable?
- **Upstream PRs** for defects 1–4 and 8, or keep them in our pre-render pass?
