# Sprint 90 — Technical Plan

## Current pipeline (verified 2026-07-01)

Both v2 exporters run **in the extension host** (pdfkit/docx are Node libs), wired in `ritemarkEditor.ts:729,743`. Every image flows through one chokepoint:

- `export/v2/imageSource.ts`
  - `:14` accept regex `png|jpeg|jpg|gif|bmp|tiff` for data-URLs; SVG data-URLs → `null` (dropped).
  - `:32` file-path branch: `fs.readFileSync(absolutePath)` with **no extension filter** → raw SVG bytes returned.
- `export/v2/pdfHtmlExporter.ts` (IMG case ~263–288): `tryLoadImageSource` → `if(!buf) return` → `doc.openImage(buf)` at `:279`. **No per-node try/catch.** Throw propagates to outer catch at `exportToPDFV2` (~`:345`) → whole export fails.
- `export/v2/wordHtmlExporter.ts` (IMG case ~257–290): same shape; `getImageDimensions` (`:27`) only knows PNG/JPEG signatures → SVG falls back to 600×400 and `new ImageRun({data: svgBytes})` → broken image. No per-node try/catch.
- `export/saveAsMarkdown.ts` `saveAsMarkdownHandler`: writes images in a loop via `writeImageRelativeTo` (`imageWriter.ts`, sync `fs.writeFileSync`), then `workspace.fs.writeFile` for the `.md`. No rollback of written images on failure.

**No rasterization primitive exists anywhere** (no `sharp`/`resvg`/`canvas`/`puppeteer`/`sizeOf` in deps). The webview *is* a browser context (can rasterize via `<canvas>`). draw.io's vendored webapp can export PNG but is not wired to the export pipeline.

## Phase 1 — Fail-safe (host-only, no deps)

### W1 — `imageSource.ts` guards (R1, R3)
- Add SVG detection for the **file-path** branch: sniff content/extension; return `null` (skip) for SVG in Phase 1. In Phase 2 this branch instead returns a rasterized PNG buffer (see W4).
- Tighten the data-URL branch so only encoder-decodable formats (PNG/JPEG) pass to the raster path; GIF/BMP/TIFF → `null` (or routed through rasterization later). Update `imageSource.test.ts`.
- Return shape stays `Buffer | null` — no signature change, so callers are unaffected.

### W2 — Per-image try/catch in both exporters (R2)
- Wrap the body of the IMG `case` in `pdfHtmlExporter.ts` and `wordHtmlExporter.ts` in try/catch: on throw, `console.warn` with the image path and `return`/`return []` (skip the node). The outer export try/catch remains as a last resort but should no longer be reached by a single bad image.

### W3 — Atomic `saveAsMarkdown` (R4)
- Approach 1 (least invasive), entirely inside `saveAsMarkdownHandler`:
  - Before the loop, capture which target image paths already exist.
  - As each image writes, push its path to a `created: string[]` **only if it did not pre-exist**.
  - Wrap images-loop **and** the `.md` write in try/catch; on catch, `fs.unlink` each path in `created` (best-effort, swallow unlink errors), then re-throw to the existing error toast.
- Add `saveAsMarkdown.test.ts`: inject failure on Nth image and on `.md` write; assert no `created` files remain and pre-existing files survive.

## Phase 2 — Rasterization (feature, R5)

**Chosen direction: rasterize SVG→PNG in the webview `<canvas>` — no native module** (avoids the native-module/notarization/arch landmine documented in memory). Gated on a Phase 0 audit because the exporters run host-side while the canvas lives webview-side.

### W0 — Phase 0 audit (BLOCKS W4/W5) — RESOLVED 2026-07-02, see [research/rasterization-audit.md](research/rasterization-audit.md)
Outcome: webview pre-pass; `.drawio.svg` has real geometry (rasterizes fine, no draw.io runtime); CSP needs `connect-src`. Original questions:
1. **Where does rasterization run?** Candidates:
   - (a) **Webview pre-pass** — before export is triggered, the webview converts every SVG image in the document (inline data-URL and resolved file `.svg`) to a PNG data-URL, so the host exporter only ever sees PNG. Cleanest, but the webview must be able to resolve file-referenced `.svg` content (may need the host to supply bytes).
   - (b) **Host→webview round-trip** — host collects SVG sources, posts them to the webview for canvas rasterization, awaits PNG buffers, continues export. More plumbing; keeps export orchestration host-side.
2. **Do `.drawio.svg` files rasterize correctly on canvas?** They are valid SVG with the mxfile XML in a non-rendered `content` attribute — confirm `<img src=svg>`→`drawImage`→`toDataURL('image/png')` produces the visible diagram (watch for tainted-canvas/CSP and external-resource issues).
3. **Target DPI / max dimensions** for acceptable quality vs. payload size.

Record findings in `research/rasterization-audit.md`. If webview-canvas is blocked, fall back options (in order): draw.io's own PNG export for `.drawio.svg` only; then reconsider a host-side dependency (explicit new decision, would need Jarmo sign-off given the native-module risk).

### W4 — Wire rasterization into the image path (R5)
- Implement the audited approach. In the pre-pass model, `imageSource.ts` no longer sees SVGs (they arrive as PNG data-URLs); in the round-trip model, the SVG branch of `imageSource.ts` returns the rasterized PNG buffer.
- Ensure both inline data-URL SVG and file-referenced `.svg`/`.drawio.svg` are covered.

### W5 — Failure degradation (R5 + R2)
- A rasterization failure falls back to the R1 skip (never crashes). Covered by S12.

## Feature-flag check
Phase 1 is bug-fix hardening of an existing feature — no flag. Phase 2 (R5) adds visible new export behaviour; gate behind a kill-switch flag `export-svg-rasterization` (default ON per HARD RULE #2, `stable`, not surfaced in Settings) so it can be disabled without reverting if a rasterization edge case ships badly.

## Files touched
- `export/v2/imageSource.ts` (+ `imageSource.test.ts`)
- `export/v2/pdfHtmlExporter.ts`
- `export/v2/wordHtmlExporter.ts`
- `export/saveAsMarkdown.ts` (+ new `saveAsMarkdown.test.ts`)
- webview rasterization module (Phase 2, path decided in W0)
- `features/flags.ts` (Phase 2 flag)
- `docs/development/architecture.md` (export subsystem note, sprint-end)

## Risks
- **R2 masking real errors** — skipping bad images could hide a genuine regression; mitigate with a `console.warn` per skip and an S5/S9 regression check that raster output is unchanged.
- **Phase 2 wiring** — the host/webview split is the main unknown; W0 audit de-risks it before code.
- **draw.io SVG canvas quirks** — external refs / tainted canvas; audited in W0.
