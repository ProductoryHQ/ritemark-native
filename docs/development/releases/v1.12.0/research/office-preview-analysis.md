# Office Preview Analysis — Word and PowerPoint

**Date:** 2026-09-13<br>
**Status:** Release-planning recommendation; no implementation or dependency approval<br>
**Related issues:** [#284](https://github.com/ProductoryHQ/ritemark-native/issues/284), [#285](https://github.com/ProductoryHQ/ritemark-native/issues/285)

## Decision Summary

Add two separate sprints to v1.12.0:

1. **Sprint 124 — Word preview fidelity:** make DOCX viewing page-oriented and substantially closer to the source document, with PDF-like navigation, zoom, fit, search, loading, refresh, and failure behavior.
2. **Sprint 125 — PowerPoint preview:** add a secure, local, read-only preview for modern `.pptx` files with thumbnails, navigation, zoom, fit, search, and an external-open fallback.

The two sprints are intentionally separate. Word already has a renderer and needs fidelity, interaction, and packaging work. PowerPoint needs a new document/provider pipeline and a new renderer dependency. Sprint 125 depends on the Office-preview asset boundary established in Sprint 124.

## Current Ritemark State

### Word

- DOCX is handled by `DocxEditorProvider`, `DocxDocument`, and `DOCXViewer`.
- Rendering uses `docx-preview` 0.3.7 in the browser; Mammoth is used for Save as Markdown, not for the visual preview.
- The renderer currently enables page breaks and respects document width, height, and fonts, but does not opt into last-rendered Word page breaks.
- The viewer does not yet provide the page navigation, zoom, fit, or search interaction users get in the PDF viewer.
- DOCX, PDF, and ordinary editor UI currently share the generated `media/webview.js`, which is roughly 8.4 MB. Adding another large Office renderer to this common asset would make unrelated views pay the cost.

### PowerPoint

- There is no `.pptx` document type, custom read-only editor provider, viewer component, manifest association, or renderer dependency.
- PowerPoint preview is already recorded as a wishlist item, but no implementation scaffold exists.

## Feasibility Options

| Approach | Fidelity | Local/offline | Product cost | Recommendation |
|---|---|---:|---|---|
| Browser-native DOCX/PPTX rendering | Good for common documents; imperfect for advanced Office layout | Yes | Renderer maintenance, visual corpus, bundle isolation | Default product path |
| Local LibreOffice conversion to PDF | Often high, but depends on installed LibreOffice, fonts, and conversion behavior | Yes | External application dependency, process lifecycle, temp-file handling | Research-only optional fallback |
| Microsoft Graph conversion to PDF | Potentially high because Microsoft performs the conversion | No | Sign-in, upload, permissions, network, privacy disclosure, failure states | Reject as the default local preview path |

Ritemark should remain local-first. Neither an Office upload nor a bundled LibreOffice runtime belongs in these sprints. A later, explicitly approved integration may offer conversion as an optional action.

## Sprint 124 Recommendation — Word Preview Fidelity

### Product definition

“Comparable to PDF” means:

- a stable, page-oriented reading experience;
- page navigation, zoom, fit-width/fit-page, text search, refresh, loading, and actionable errors;
- materially improved rendering of representative headings, lists, tables, images, headers/footers, page/section breaks, footnotes, and common fonts;
- measured visual evidence against Word- or LibreOffice-rendered PDF ground truth.

It does **not** mean a promise that every DOCX will be pixel-identical to Microsoft Word. Browser HTML/CSS layout cannot reproduce every Word pagination and font-metric decision.

### Technical direction

1. Create a representative DOCX fixture corpus and baseline page images before changing the renderer.
2. Spike `docx-preview` 0.4.0 against that corpus. It is newer than the current 0.3.7 and includes a breaking render-hook change, so upgrade only if the evidence shows equal or better rendering and no unacceptable regressions.
3. Test `ignoreLastRenderedPageBreak: false` and document-specific CSS/font handling; keep it only where it improves the corpus without introducing false breaks.
4. Add PDF-like viewer chrome without pretending the HTML output is a PDF: page position, zoom, fit, search, loading, refresh, and Open in Word/external fallback.
5. Split Office preview code into a dedicated webview entry or equivalent lazy asset boundary so ordinary Markdown views do not load the DOCX renderer.
6. Preserve the existing read-only boundary and Save as Markdown workflow. DOCX editing and legacy `.doc` support remain out of scope.

### Acceptance evidence

- Golden screenshots for a deliberately varied corpus on macOS arm64/x64 and Windows.
- Explicit expected-difference notes for unsupported Word features.
- Performance and memory measurements for small and large documents.
- No regression in Markdown, PDF, CSV, transcription, or agent webviews from the asset split.

## Sprint 125 Recommendation — PowerPoint Preview

### Renderer spike

Use the exact version `@aiden0z/pptx-renderer@1.2.4` as the first candidate, not as an automatic dependency approval. It is browser-native, Apache-2.0, exposes slide rendering and search-oriented APIs, and documents ZIP safety limits. Its own documentation is explicit that it does not provide complete PowerPoint parity.

Before adoption, verify:

- license and dependency tree;
- bundle size and lazy-loading behavior;
- malformed/oversized ZIP handling and decompression limits;
- external-link and media URL filtering under the webview CSP;
- charts, SmartArt, grouped shapes, theme fonts, images, tables, speaker notes, and unsupported-content fallbacks;
- disposal of object URLs, renderer instances, listeners, and large buffers.

### Product and architecture direction

1. Add a `.pptx` custom read-only editor provider and document wrapper using the existing provider/document lifecycle rather than creating a new runtime.
2. Load the renderer from a dedicated PPTX asset, reusing the viewer shell and asset boundary established in Sprint 124.
3. Provide slide thumbnails, current/total position, previous/next, keyboard navigation, zoom, fit, text search where supported, loading, refresh, errors, and Open externally.
4. Support modern `.pptx` only. Legacy `.ppt`, editing, macros, animation/transition playback, and full slideshow parity are out of scope.
5. Gate the feature with a default-on experimental `powerpoint-preview` kill switch. Keep the provider registration stable and show a truthful disabled/failure fallback when the flag is off.
6. Build a visual fixture corpus and compare rendered slides to PowerPoint- or LibreOffice-exported ground truth on every supported platform.

## Architecture and Release Impact

- These sprints expand v1.12.0 from four to six sprints.
- Sprint 124 changes webview asset structure; Sprint 125 adds a document type, provider, manifest association, host/webview messages, dependency, and feature flag.
- Both therefore trigger the architecture documentation gate. `docs/development/architecture.md` must be updated during the relevant sprint close.
- The release remains full-app unless all shell-facing work is removed. PowerPoint file association and packaged assets must be verified in signed release candidates, not only in extension dev mode.
- Each sprint gets its own feature branch and Phase 0 evidence. Planning approval does not approve either renderer upgrade/dependency.

## Sources

- [`docx-preview` repository](https://github.com/VolodymyrBaydalka/docxjs) and [0.4.0 release](https://github.com/VolodymyrBaydalka/docxjs/releases)
- [`@aiden0z/pptx-renderer` repository](https://github.com/aiden0z/pptx-renderer) and [releases](https://github.com/aiden0z/pptx-renderer/releases)
- [LibreOffice command-line parameters](https://help.libreoffice.org/latest/en-US/text/shared/guide/start_parameters.html)
- [Microsoft Graph file-format conversion](https://learn.microsoft.com/en-us/graph/api/driveitem-get-content-format?view=graph-rest-1.0)
