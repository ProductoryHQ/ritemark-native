# Sprint 90 — Export Integrity: Behaviour Spec

Source of truth for what the sprint changes. Written before implementation.

## Problem

The v2 export pipeline (`exportToPDFV2` / `exportToWordV2`) loses content and can crash:

- **Inline SVG data-URLs** (`data:image/svg+xml;…`) are silently dropped — `imageSource.ts:14` only accepts `png|jpeg|jpg|gif|bmp|tiff`.
- **File-referenced SVGs** (`![](diagram.svg)`) are *unguarded* — `imageSource.ts:32` `fs.readFileSync`s any file and hands raw SVG bytes downstream. In PDF, `doc.openImage()` throws with **no per-image try/catch**, so one `.svg` **aborts the entire export**. In Word, it renders a broken/empty image.
- **draw.io diagrams** are stored as `.drawio.svg` (Sprint 82) → they hit exactly this path → diagrams never appear in exported PDF/Word, and can crash PDF.
- **GIF/BMP/TIFF data-URLs** pass the regex but pdfkit can't decode them either — latent crash, same missing guard.
- **`saveAsMarkdown`** writes images one-by-one then the `.md`; a mid-loop failure orphans already-written image files and can leave a `.md` referencing missing images (#76).

## Requirements

### Phase 1 — Fail-safe correctness (no new dependencies)

**R1 — File-referenced SVGs skip gracefully.**
`tryLoadImageSource()` treats a file whose resolved content is SVG the same as a data-URL SVG: return `null` (skip) rather than raw bytes, UNTIL Phase 2 rasterization is in place. No document containing a `.svg` reference may crash export.

**R2 — One bad image never aborts an export.**
Each IMG node in `pdfHtmlExporter.ts` and `wordHtmlExporter.ts` is wrapped so a throw is caught, logged, and the node skipped; the export completes with every other element intact.

**R3 — Only decodable rasters reach the encoders.**
Data-URL formats that pass the current regex but the encoder cannot decode (GIF/BMP/TIFF for pdfkit) are guarded so they skip gracefully instead of crashing.

**R4 — `saveAsMarkdown` leaves no partial state on failure.**
`saveAsMarkdownHandler` records only image files it newly creates and, on any failure before completion, `unlink`s exactly those. Pre-existing user files in `images/` are never touched. A successful save is byte-for-byte identical to today.

### Phase 2 — SVG actually renders (feature)

**R5 — Embedded SVG/diagrams appear in PDF and Word.**
SVG images — inline `data:image/svg+xml` **and** file-referenced `.svg` including `.drawio.svg` — are rasterized to PNG and embedded, so the diagram is visible in the exported document. Rasterization uses the webview's `<canvas>` (browser context already present) — **no native module**. Supersedes the R1 skip for SVGs once wired.

### R6 — Inserting an SVG via the image picker works (added mid-sprint, Jarmo 2026-07-02)

Discovered during Phase 2 QA: the `/image` picker offers `.svg`, builds a
`data:image/svg+xml;base64,…` URL, but `saveImage` rejected it with "Invalid
image data URL" (a `(\w+)` regex can't match the compound `svg+xml` subtype).
Pre-existing bug, not a Sprint 90 regression. Fix: parse the data URL through a
shared helper that accepts compound subtypes and maps `svg+xml → svg`.

## Non-goals (out of scope)

- **#124** draw.io create-without-slash / link-existing / rename-with-references — separate follow-on sprint (proposed Sprint 91). Diagrams exporting correctly (R5) is the only #124-adjacent benefit delivered here.
- Any new runtime dependency (`sharp`, `resvg`, `canvas`, `puppeteer`, …).
- Vector-preserving SVG-in-PDF (we rasterize; true vector embedding is out of scope).
- Non-v2 (legacy) export paths.

## Acceptance

- A document with a file-referenced `.svg` exports to PDF **without crashing** (R1/R2).
- A document with a broken/corrupt image exports with that image skipped and everything else intact (R2).
- A GIF/BMP/TIFF data-URL no longer crashes PDF export (R3).
- A `saveAsMarkdown` that fails mid-images leaves **zero** new files on disk and preserves pre-existing files (R4).
- After Phase 2, a `.drawio.svg` diagram and an inline SVG both appear as images in exported PDF **and** Word (R5).
- TypeScript compiles; pre-commit hook passes; `qa-validator` signs off.

## Linked issues

- [#127](https://github.com/ProductoryHQ/ritemark-native/issues/127) — SVG images dropped / break PDF/Word export (R1, R2, R3, R5)
- [#76](https://github.com/ProductoryHQ/ritemark-native/issues/76) — atomic `saveAsMarkdown` cleanup (R4)
