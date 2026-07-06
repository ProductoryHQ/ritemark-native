<!-- DRAFT — scope complete (sprint 90 + sprint 89 merged to main); awaiting release gates (not yet built/tested/notarized) -->

## [1.8.1] - TBD

### Added
- SVG and draw.io diagrams now render in PDF and Word exports — inline `data:image/svg+xml` images and file-referenced `.svg`/`.drawio.svg` diagrams are rasterized to PNG in the webview `<canvas>` (the same technique used for mermaid) and embedded in the exported document, so v1.8.0 draw.io diagrams finally appear in exports (#127)
- Model Gateway — new AI models can now appear in the app without waiting for a Ritemark release. A new `src/ai/modelCatalog/` subsystem resolves the model list and default for every runtime/surface (AI sidebar, Flow LLM nodes, BYOK picker) through a provenance-tracked waterfall: live provider probe (Anthropic `/v1/models`) → remote published catalog (`ritemark-public` `feeds/model-catalog.json`) → on-disk cache → bundled baseline (working offline cold start). The remote catalog refreshes on activation, every 6 hours, and on manual refresh, gated by the `remote-model-catalog` feature flag (enabled by default). Partially advances #109 (model-resolution unification shipped; retry/telemetry unification descoped and still open)

### Changed
- Out-of-box default Claude model is now `claude-sonnet-5`, replacing the stale `claude-sonnet-4-5` default

### Fixed
- One bad image can no longer crash a PDF or Word export — every image node in both v2 exporters is wrapped in per-node try/catch, so a decode failure is warned and the single image skipped while the rest of the document exports intact; previously a single file-referenced `.svg` (including any `.drawio.svg`) could abort the entire PDF export (#127)
- GIF / BMP / TIFF data-URL images no longer crash PDF export — they passed the old format check but the PDF encoder (pdfkit) can't decode them, a latent crash; they now skip gracefully (#127)
- `saveAsMarkdown` is now atomic — when converting a document to markdown, a failure partway through the multi-image write no longer orphans image files or leaves a `.md` referencing missing images; only newly-created image files are removed on failure and pre-existing files in `images/` are never touched (#76)
- Inserting an SVG via the `/image` picker works again — a pre-existing regex bug rejected valid SVGs with "Invalid image data URL" because it couldn't parse the compound `svg+xml` MIME subtype; a shared `parseImageDataUrl` helper now handles compound subtypes and maps `svg+xml → svg`

### Notes
- SVGs are **rasterized to PNG at a fixed target DPI**, not embedded as scalable vectors — vector-preserving SVG-in-PDF was explicitly out of scope. Exported diagrams are pixel images and may look less crisp at very high zoom. Known limitation, not a bug.
- No new runtime dependency was added (no `sharp`, `resvg`, `canvas`, or `puppeteer`) — rasterization reuses the webview's browser `<canvas>`, so there is no impact on build, signing, or notarization.
- Rasterization runs as a webview pre-pass (`lib/svgRasterExport.ts::inlineSvgImagesForExport`) after the mermaid pre-pass; any failure leaves the image tag untouched so the host's fail-safe guard skips it — export never aborts. The editor CSP gained `connect-src ${cspSource}` to permit the SVG fetch.
- The planned `export-svg-rasterization` kill-switch flag was dropped — feature flags are not plumbed to the webview, and graceful degradation-to-skip already provides the safety a kill-switch would. Deviation from the sprint plan, noted for Jarmo.
- Legacy (non-v2) export paths were not touched.
- Deferred: #124 (draw.io create-without-slash / link-existing / rename-with-references) is out of scope and planned for a follow-on sprint.
- Model Gateway: the static model-ID constants that used to require a code change + release to add a model were deleted — `CLAUDE_MODELS`, `DEFAULT_MODEL`, `CLAUDE_FALLBACK_MODELS`, `BYOK_PROVIDER_MODELS`, Codex's `getCodexModels()` / `FALLBACK_MODELS`, and the hardcoded webview defaults. `src/ai/modelConfig.ts` keeps its name and role (OpenAI/Gemini static config + image-model types); only the Claude/BYOK model-ID logic moved into `modelCatalog/`.
- Model Gateway: no new npm dependency was added — catalog schema validation is hand-rolled (no `zod`), a deliberate limit on the resolver's footprint, in the same spirit as this release's no-new-native-dependency constraint on the export side.
- Carried-forward debt (not a regression, not blocking): `UnifiedViewProvider.ts` is 1223 LOC — down from 1267 but still over the sprint's own ≤1100 target; the remaining reduction is deferred to a later sprint.
