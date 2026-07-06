---
date: '2026-07-03'
title: 'Ritemark v1.8.1 — Export Integrity: SVG & Draw.io Diagrams in Your Exports'
author: Jarmo Tuisk
status: Draft
sprints:
  - sprint-90
  - sprint-89
tags:
  - sprint-90
  - sprint-89
  - export
  - pdf
  - word
  - svg
  - drawio
  - diagrams
  - models
  - ai
  - model-catalog
---

# Ritemark v1.8.1 — Export Integrity: SVG & Draw.io Diagrams in Your Exports

**Status:** Draft (scope complete; release gates not yet run)
**Type:** Patch (1.8.0 → 1.8.1)
**Focus:** Bug-fix release. The v2 PDF/Word export pipeline used to silently drop SVG images — and a single file-referenced `.svg` could crash the entire export. **Draw.io diagrams** (the `.drawio.svg` files from v1.8.0) hit this exact bug and never appeared in exported documents. This release makes export **fail-safe** (one bad image can no longer abort a whole export) and makes **SVG and draw.io diagrams actually render** in exported PDF and Word by rasterizing them to PNG. It also makes `saveAsMarkdown` atomic and fixes a pre-existing bug that blocked inserting an SVG via the `/image` picker. Closes [#127](https://github.com/ProductoryHQ/ritemark-native/issues/127) and [#76](https://github.com/ProductoryHQ/ritemark-native/issues/76).

This release also folds in the new **Model Gateway** (Sprint 89) — mostly under-the-hood plumbing with one visible payoff: the app's AI model list and defaults now resolve from a live provider probe and a remotely-published catalog, so **new models can appear in Ritemark without waiting for a release**, and the out-of-box Claude default moves to `claude-sonnet-5`. Partially advances [#109](https://github.com/ProductoryHQ/ritemark-native/issues/109) (model-resolution unification shipped; retry/telemetry unification remains open).

* * *

## Downloads

<!-- Artifacts are NOT live yet — v1.8.1 has not been built, signed, or notarized.
     These are the target URLs where the assets will land once the release gates pass. -->

| Asset | Platform | URL |
|-------|----------|-----|
| Ritemark-arm64.dmg | macOS (Apple Silicon, arm64) — notarized | https://github.com/jarmo-productory/ritemark-public/releases/download/v1.8.1/Ritemark-arm64.dmg |
| Ritemark-x64.dmg | macOS (Intel, x64) — notarized | https://github.com/jarmo-productory/ritemark-public/releases/download/v1.8.1/Ritemark-x64.dmg |
| Ritemark-Setup.exe | Windows x64 | https://github.com/jarmo-productory/ritemark-public/releases/download/v1.8.1/Ritemark-Setup.exe |

* * *

## Why This Release

v1.8.0 shipped draw.io diagrams in markdown — a big win for technical writers. But there was a gap: those diagrams, and SVG images in general, did not survive **export**. The v2 PDF/Word pipeline silently dropped inline SVG data-URLs, and file-referenced `.svg` files (which is exactly what `.drawio.svg` diagrams are) were passed straight to the encoder unguarded. In PDF that threw with no per-image safety net, so a **single** `.svg` reference could abort the entire export. In Word the same image rendered as a broken box.

v1.8.1 closes that gap in two moves. First, export is now **fail-safe**: any image that can't be decoded — a corrupt file, an unsupported format, a malformed SVG — is skipped with a warning, and the rest of the document exports intact. No single image can crash an export anymore. Second, **SVG images actually render**: inline SVG and file-referenced `.svg`/`.drawio.svg` are rasterized to PNG in the webview and embedded in the exported PDF and Word document, so your draw.io diagrams finally show up where the prose lives.

Alongside that, `saveAsMarkdown` (used when converting an imported document to markdown) is now atomic, and a pre-existing bug that rejected valid SVGs in the `/image` picker is fixed.

Separately, the **Model Gateway** work removes a long-standing friction point: until now, every new AI model required a code change and a full Ritemark release before it could appear in the app. v1.8.1 replaces the hardcoded model lists with a resolver that reads from a live provider probe and a remotely-published catalog, so the model list can move independently of the app — see *What's New* below.

Sprint docs: `docs/development/sprints/sprint-90-export-integrity/` and `docs/development/sprints/sprint-89-model-gateway/`

* * *

## What's New

### SVG and draw.io diagrams now render in PDF and Word exports (sprint-90)

<!-- Screenshots would live in ./screenshots/ (directory not yet created for this release). -->

Draw.io diagrams and SVG images now appear as real images in your exported documents:

- **Inline SVG (`data:image/svg+xml`) is embedded.** SVG images pasted or generated directly into the document now export as visible raster images at the correct aspect ratio.
- **File-referenced `.svg` and `.drawio.svg` are embedded.** A diagram you created with `/diagram` in v1.8.0 now renders in both the exported PDF and the exported Word document, instead of silently vanishing.
- **How it works, briefly.** SVGs are rasterized to PNG in the webview using the browser's own `<canvas>` — the same technique Ritemark already uses for mermaid diagrams. There is **no new native dependency** (no `sharp`, `resvg`, `canvas`, or `puppeteer`) and therefore no impact on build, signing, or notarization.

This closes [#127](https://github.com/ProductoryHQ/ritemark-native/issues/127). The behavior is on by default.

One thing to know: SVGs are **rasterized**, not embedded as vectors — see Known Issues below.

### New models can appear without waiting for a Ritemark release (sprint-89)

The list of AI models you can pick — in the AI sidebar, in Flow LLM nodes, and in the BYOK provider picker — used to be hardcoded in the app. Adding a model meant a code change and a full release. Model Gateway replaces that with a **provenance-tracked waterfall resolver** (`src/ai/modelCatalog/`) that resolves the model list and default for every runtime and surface from, in order:

1. **Live provider probe** — the real provider API (Anthropic's `/v1/models` REST endpoint), so freshly-released models show up as soon as your key can see them.
2. **Remote published catalog** — `feeds/model-catalog.json` on `ritemark-public` (already live), so Ritemark can add or re-order models for everyone without an app update.
3. **On-disk cache** — the last good result, for offline and rate-limited sessions.
4. **Bundled baseline** — shipped with the app, so a fresh, offline, zero-network cold start still has a working model list.

Two user-visible results:

- **The model list moves independently of the app.** New models can be published to the catalog and appear in Ritemark without waiting for a release. The remote catalog refreshes on activation, every 6 hours, and via a manual refresh action. This is controlled by the `remote-model-catalog` feature flag, **enabled by default** — disabling it falls back to bundled/cache-only behavior.
- **A newer out-of-box Claude default.** The default Claude model is now `claude-sonnet-5`, replacing the stale `claude-sonnet-4-5` default.

This is primarily an infrastructure change; most of it is invisible. It **partially advances** [#109](https://github.com/ProductoryHQ/ritemark-native/issues/109): model-resolution unification shipped, but retry/telemetry unification (also tracked in #109) was descoped from this sprint and remains open — so #109 stays open.

* * *

## Fixes &amp; Polish

- **One bad image can no longer crash an export (sprint-90).** Every image node in the PDF and Word exporters is now wrapped so a decode failure is caught, logged, and the single image skipped — the export completes with every other element intact. Previously one file-referenced `.svg` (including any `.drawio.svg` diagram) could abort the entire PDF export. Part of [#127](https://github.com/ProductoryHQ/ritemark-native/issues/127).
- **GIF / BMP / TIFF data-URLs no longer crash PDF export (sprint-90).** These formats passed the old format check but the PDF encoder (pdfkit) can't actually decode them, which was a latent crash. They now skip gracefully.
- **`saveAsMarkdown` is now atomic (sprint-90).** When converting a document to markdown, images used to be written one by one before the `.md` file — a failure partway through left orphaned image files on disk and a `.md` referencing missing images. The save now tracks only the image files it newly creates and, on any failure, removes exactly those. Pre-existing files in `images/` are never touched, and a successful save is byte-for-byte identical to before. Closes [#76](https://github.com/ProductoryHQ/ritemark-native/issues/76).
- **Inserting an SVG via the `/image` picker works again (sprint-90).** The picker offered `.svg` files but then rejected them with "Invalid image data URL" — a pre-existing bug where the parser couldn't handle the compound `svg+xml` MIME subtype. SVGs now insert correctly.

* * *

## Under the Hood

### Fail-safe image path (R1, R2, R3)

The single image chokepoint `export/v2/imageSource.ts` now guards its file-path branch: content sniffed as SVG returns `null` (skip) in the fail-safe layer rather than handing raw SVG bytes downstream, and data-URL formats the encoders can't decode (GIF/BMP/TIFF for pdfkit) are filtered out. The `Buffer | null` return shape is unchanged, so callers are unaffected. On top of that, the IMG case in both `pdfHtmlExporter.ts` and `wordHtmlExporter.ts` is wrapped in per-node try/catch — a throw is warned and the node skipped, so the outer export catch is no longer reached by a single bad image. The previously-orphaned `imageSource.test.ts` was wired into `npm test`.

### Atomic `saveAsMarkdown` (R4)

`saveAsMarkdownHandler` now captures which target image paths already exist before the write loop, records only newly-created paths, and wraps both the images loop and the `.md` write in try/catch. On failure it `unlink`s exactly the created paths (best-effort) and re-throws to the existing error toast. New `saveAsMarkdown.test.ts` injects failures on the Nth image and on the `.md` write and asserts no orphans remain and pre-existing files survive.

### Webview pre-pass rasterization (R5)

Rasterization runs in the **webview**, not the host — the export HTML is already built webview-side and posted to the host exporters, and the webview is a browser context with a `<canvas>`. A new `lib/svgRasterExport.ts::inlineSvgImagesForExport(html)` runs right after the existing mermaid pre-pass in both export handlers: inline SVG data-URLs are decoded and rasterized; file-referenced `.svg`/`.drawio.svg` are fetched, converted to SVG text, and rasterized; the shared `rasterizeSvgToPngDataUrl` helper (extracted from the mermaid path) does the conversion. To avoid a tainted-canvas `SecurityError`, SVGs are rasterized from `data:` URLs (never from a `vscode-webview://` `<img>`), and the editor CSP gained `connect-src ${cspSource}` so the fetch is permitted. The `title` attribute is stripped from rewritten tags so the host doesn't re-resolve (and skip) the original `.svg`. Any rasterization failure leaves the tag untouched, so the host's fail-safe guard skips it — export never aborts.

**Note on the `.drawio.svg` audit:** the Phase 0 audit initially assumed a `.drawio.svg` was a blank shell needing the draw.io runtime to render. The real fixture proved otherwise — the visible vector shapes live in the SVG body (the mxfile lives only in a non-rendered `content=` attribute for editability), so a plain `<img>`/canvas renders the diagram with no draw.io runtime. Details in `research/rasterization-audit.md`.

**Deviation from plan:** the planned `export-svg-rasterization` kill-switch flag was dropped. Feature flags are not plumbed to the webview, and the graceful-degradation-to-skip behavior already provides the safety a kill-switch would.

### Shared `parseImageDataUrl` helper (R6)

The `/image` insert bug was a `(\w+)` regex that couldn't match the compound `svg+xml` subtype in `data:image/svg+xml;base64,…`. A shared `parseImageDataUrl` helper in `imageWriter.ts` now parses data URLs, accepts compound subtypes, and maps `svg+xml → svg`; both `saveImage` and `resizeImage` in `ritemarkEditor.ts` use it. Covered by tests in `imageWriter.test.ts`.

### Model Gateway resolver (sprint-89)

The new `src/ai/modelCatalog/` subsystem resolves the model list and default for every runtime/surface through a provenance-tracked waterfall: **live provider probe → remote published catalog → on-disk cache → bundled baseline.** Each resolution records where it came from, so the source is auditable rather than silently guessed. The remote catalog (`feeds/model-catalog.json` on `ritemark-public`) is fetched on activation, every 6 hours, and on a manual refresh; the `remote-model-catalog` flag (default on) gates the remote/live tiers, and disabling it collapses the waterfall to cache-and-bundled.

This let us delete the static model-ID constants that previously forced a code change + release to add a model: `CLAUDE_MODELS`, `DEFAULT_MODEL`, `CLAUDE_FALLBACK_MODELS`, `BYOK_PROVIDER_MODELS`, Codex's `getCodexModels()` / `FALLBACK_MODELS`, and the hardcoded webview model defaults. `src/ai/modelConfig.ts` keeps its name and role — it still holds the OpenAI/Gemini static config and the image-model types — only the Claude/BYOK model-ID logic moved into `modelCatalog/`.

**No new npm dependency was added.** Schema validation for the fetched catalog is hand-rolled rather than pulling in `zod` — in the same spirit as Sprint 90's no-new-native-dependency constraint, and honored here as a deliberate limit on the resolver's footprint.

**Carried-forward debt (not a regression, not blocking):** `UnifiedViewProvider.ts` is 1223 LOC — down from 1267, but still over the sprint's own ≤1100 target. It was touched during this work but not fully refactored; the remaining reduction is flagged as carried-forward debt for a later sprint. Called out here so it isn't lost.

* * *

## Tests and Validation

**This release has not been built, tested, or validated yet.** Scope is complete — both Sprint 90 (export integrity) and Sprint 89 (model gateway) are merged to `main` — but the release gates are still pending:

- **Gate 1 (macOS arm64):** NOT YET RUN — no signed DMG built.
- **Gate 2 (macOS x64 + Windows x64):** NOT YET RUN.
- **Notarization / stapling:** NOT YET RUN. No DMGs signed or notarized; bundled agent binaries not yet re-signed.
- **`qa-validator` sign-off:** PENDING.
- **Jarmo local test pass (S1–S13):** PENDING.

Automated coverage is in place: `imageSource.test.ts`, `saveAsMarkdown.test.ts`, `svgRasterExport.test.ts`, and the SVG cases in `imageWriter.test.ts` are all wired into `npm test`. For Model Gateway, `npm run compile` exits 0, the webview `typecheck` exits 0, and the 12/12 `modelCatalog` unit tests pass — all independently re-verified during PR review, including a live fetch of the published catalog that confirmed it matches.

Pending manual QA scenarios (from `scenarios.md`):

- **S1–S2** — file-referenced SVG does not crash PDF / Word export.
- **S3** — a corrupt/unreadable image is skipped and the rest of the export survives.
- **S4** — a GIF/BMP/TIFF data-URL no longer crashes PDF export.
- **S5** — baseline PNG/JPEG export is unchanged (regression check).
- **S6–S8** — `saveAsMarkdown` leaves no orphans on mid-images or `.md`-write failure and preserves pre-existing files.
- **S9** — a successful `saveAsMarkdown` is byte-identical to before (regression check).
- **S10** — an inline SVG renders in PDF and Word.
- **S11** — a `.drawio.svg` diagram created via `/diagram` renders in PDF and Word.
- **S12** — a malformed SVG degrades to a skip (not a crash) and export still completes.
- **S13 (Model Gateway)** — with a live Anthropic key, the real provider probe returns `claude-sonnet-5` and it appears as the out-of-box default. Automated tests cover the resolver and the published-catalog fetch; the live-key runtime behavior is Jarmo's manual check, same as the rest of this release.

* * *

## Known Issues

- **SVGs are rasterized, not vector-embedded.** Exported SVG and draw.io diagrams are converted to PNG at a fixed target DPI, so they are pixel images in the final PDF/Word — not scalable vectors. At very high zoom or very large print sizes they can look less crisp than a true vector embed. Vector-preserving SVG-in-PDF was explicitly out of scope for this release; rasterization is the deliberate no-new-dependency approach. This is a known limitation, not a bug.
- **Very large (multi-MB) SVGs are not performance-tuned** this release. Rasterization payload/size was not optimized; if a real report surfaces, it will be addressed then.
- **Draw.io editing polish is deferred.** [#124](https://github.com/ProductoryHQ/ritemark-native/issues/124) — draw.io create-without-slash, link-existing, and rename-with-references — is out of scope here and planned for a follow-on sprint. Diagrams exporting correctly (this release) is the only #124-adjacent benefit delivered now.
