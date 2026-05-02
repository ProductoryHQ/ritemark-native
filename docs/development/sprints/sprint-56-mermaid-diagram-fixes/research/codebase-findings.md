# Sprint 56: Codebase Findings

## Existing Mermaid Implementation

Sprint 46 already shipped Mermaid rendering. Sprint 56 should improve the existing implementation rather than introduce a new node type.

Relevant files:

- `extensions/ritemark/webview/src/components/CodeBlockWithCopy.tsx`
  - Detects `node.attrs.language === 'mermaid'`.
  - Renders SVG via `renderMermaid()`.
  - Provides `Code` / `Diagram` toggle.
  - Provides existing `Copy` button that copies Mermaid source text.
  - Keeps `NodeViewContent` mounted and visually hidden in diagram mode.
- `extensions/ritemark/webview/src/lib/mermaid.ts`
  - Lazily imports Mermaid.
  - Renders source to SVG.
  - Includes `renderMermaidToPngDataUrl(svg)`, already used for export image generation.
- `extensions/ritemark/webview/src/lib/mermaidExport.ts`
  - Finds `language-mermaid` code blocks in HTML export.
  - Converts rendered Mermaid SVG to PNG data URL.
  - Replaces code blocks with `<figure><img /></figure>` for export.
- `extensions/ritemark/webview/src/components/Editor.tsx`
  - Contains the Mermaid block and SVG sizing CSS.

## Likely Root Cause Of Kaja's Margin / Readability Issue

Current CSS adds multiple layers that make diagrams feel small:

- Mermaid block reserves `padding-top: 36px`.
- Rendered diagram container uses `padding: 16px`.
- Rendered diagram has `border-radius: 12px`.
- SVG is constrained to `width: min(100%, 680px)`.
- SVG also has `max-width: 100%`, so wide diagrams are scaled down to the editor column instead of remaining readable with horizontal scroll.

For complex diagrams, the most harmful rule is the forced `680px` cap combined with `max-width: 100%`. This turns detail-heavy diagrams into smaller images instead of allowing the user to inspect them at a useful size.

## Recommended Implementation Direction

### Inline sizing

Keep inline rendering lightweight:

- Reduce container padding to a smaller value such as `6px` or `8px`.
- Remove the `680px` cap.
- Let SVG render at natural width when possible.
- Use `overflow: auto` on the container so wide diagrams scroll.
- Center only small diagrams; avoid centering large overflow content in a way that hides the left edge.

### Copy as image

Use the already-existing SVG-to-PNG helper:

1. Take current `svgContent` from `CodeBlockWithCopy.tsx`.
2. Call `renderMermaidToPngDataUrl(svgContent)`.
3. Convert data URL to `Blob`.
4. Write `image/png` to clipboard through `ClipboardItem`.

This avoids adding a second rasterization path.

### Expanded view

Prefer a local React overlay in `CodeBlockWithCopy.tsx` for sprint-56:

- It is close to the existing SVG state.
- It does not change TipTap document schema or markdown serialization.
- It can be validated independently from global app routing.

If the overlay becomes useful for other blocks later, extract it after this sprint.

## Validation Focus

Manual validation should include at least:

- A simple flowchart to verify small diagrams do not look oversized.
- A wide flowchart to verify horizontal scroll and expanded view.
- A sequence/class diagram to verify height behavior.
- An invalid Mermaid diagram to verify error behavior.
- PDF and Word export smoke check to ensure the existing export path still works.

## Open Questions

- Should inline diagrams preserve natural Mermaid width exactly, or cap to a larger product-level maximum such as `1200px`?
- Should expanded view include zoom controls in sprint-56, or is scrollable full-window inspection enough for `1.6.1`?
- Do we need a save/download image action, or is clipboard copy enough for the current request?
