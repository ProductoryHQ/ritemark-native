# W0 — SVG Rasterization Audit (Phase 2 gate)

Resolves the technical-plan W0 questions. Outcome: **webview pre-pass, no native dependency.** Phase 2 unblocked.

## Findings

1. **Export HTML is built in the webview and posted to the host.**
   `App.tsx:455/467` call `editorRef.getHTML()` → `inlineMermaidDiagramsForExport()` → `sendToExtension('exportPDF'|'exportWord', { html, … })`. The host (`ritemarkEditor.ts:729/743`) receives `ExportV2Request.html` as-is (`export/v2/types.ts`). So the webview is the natural rasterization site — and there is already a **precedent**: mermaid diagrams are rasterized SVG→PNG in the webview before export (`lib/mermaidExport.ts`, `lib/mermaid.ts:176`).

2. **Image `src`/`title` at export time.**
   - Inline SVG → `src="data:image/svg+xml;…"`, no title.
   - File-referenced → `src="vscode-webview://…/x.svg?v=…"` (webview URI) **+ `title="./images/x.svg"`** (original relative path). `Editor.tsx:199` sets both.
   - Host `tryLoadImageSource` reads **`title || src`** → for file refs it uses the relative path. **Consequence:** a rasterized `<img>` must have its `title` removed, or the host re-resolves (and now Phase-1-skips) the `.svg`. Handled in `svgRasterExport.ts` (`rewriteImgTag` drops title).

3. **`.drawio.svg` DOES contain rendered geometry — audit's "blank image" claim was wrong.**
   The audit inferred "empty `<g/>`, needs draw.io runtime" from the *empty new-diagram* template (`ritemarkEditor.ts:56`). Checked the real fixture `sprint-82-drawio-diagrams/test-diagram.drawio.svg`: it has `viewBox="0 0 141 281"`, 2×`<path>`, 2×`<rect>`, 3×`<text>` — the visible vector shapes are in the SVG body; the mxfile is only in the `content=` attribute (for editability). **A plain `<img>`/canvas renders the diagram.** No draw.io runtime needed. This is exactly why Sprint 82 chose `.drawio.svg` ("renders anywhere").

4. **Canvas taint + CSP.**
   - Drawing a `vscode-webview://` `<img>` to canvas and calling `toDataURL()` risks a tainted-canvas `SecurityError`. Avoided by **fetching the SVG bytes and rasterizing from a `data:` URL** (mermaid does the same — born as data-URL, untainted).
   - The editor CSP (`ritemarkEditor.ts:1583`) had **no `connect-src`** → `default-src 'none'` blocks `fetch()`. Added `connect-src ${webview.cspSource}` (permits fetching only the extension's own webview resources — benign).
   - Residual taint risk: an SVG referencing external fonts/images. draw.io embeds resources inline, so low risk; a failure degrades to skip (never crashes).

## Decision (locks technical-plan W0)

- **Site:** webview pre-pass — new `lib/svgRasterExport.ts::inlineSvgImagesForExport(html)`, run after `inlineMermaidDiagramsForExport` in both export handlers.
- **Inline SVG:** decode data-URL → rasterize.
- **File SVG / `.drawio.svg`:** `fetch(src)` → SVG text → rasterize; strip `title`.
- **Rasterizer:** reuse `rasterizeSvgToPngDataUrl` (extracted from the mermaid path).
- **Degradation:** any failure leaves the `<img>` untouched → host Phase-1 guard skips it. Export never aborts.
- **Feature flag:** dropped. Feature flags are not plumbed to the webview, and graceful degradation already provides the safety a kill-switch would. Deviation from the original plan — noted for Jarmo.
