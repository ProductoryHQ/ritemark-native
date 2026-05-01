# Sprint 56: Mermaid Diagram Fixes

## Goal

Fix the current Mermaid diagram reading experience before the planned `1.6.1` release: reduce wasted margins around diagrams, keep complex diagrams readable, add a copy-as-image action, and provide an expanded view for diagrams that do not fit comfortably inline.

## Customer Context

Kaja reported that Ritemark adds too much margin around Mermaid diagrams. More complex diagrams become unreadable because the diagram is scaled down until the text is tiny. She also requested:

- Copy as image for Mermaid diagrams
- An extended / fullscreen view for larger diagrams

Release timing from the conversation: Jarmo plans to include this in the weekend `1.6.1` release.

## Feature Flag Check

- [ ] Does this sprint need a feature flag?
  - The margin/readability changes are bug fixes to existing Mermaid rendering.
  - Copy-as-image uses the existing Mermaid SVG -> PNG export/rasterization path.
  - Expanded view is additive UI on an existing block type.
  - **Decision: No feature flag for the default plan.** Add a flag only if implementation requires a broader modal/viewer framework or risky shared editor behavior.

## Locked Product Decisions (Jarmo, 2026-05-01)

1. **Inline diagram width:** adjust to **content container width** (editor column width). Remove the hard `680px` cap. When the diagram's natural width exceeds the container, the inline block scrolls horizontally — it does not shrink-to-fit.
2. **Expanded view interaction:** **scroll + zoom**. Pan with normal scroll; zoom with `Cmd+Scroll` (macOS) and `Ctrl+Scroll` (Win/Linux).
3. **Image actions:** **both Copy and Download**. Copy writes PNG to clipboard. Download saves PNG file (filename derived from diagram or generic `mermaid-diagram.png`).

## Success Criteria

- [ ] Mermaid diagrams use substantially less inline padding/margin than today.
- [ ] Inline diagrams render at editor content container width (not capped at `680px`).
- [ ] When a diagram's natural width is wider than the content container, the inline block allows horizontal scrolling and does NOT shrink-to-fit.
- [ ] Mermaid toolbar includes `Copy Image` and copies a PNG image to the clipboard when the browser/webview clipboard API supports it.
- [ ] Mermaid toolbar includes `Download Image` and saves a PNG file via standard browser download.
- [ ] If image clipboard write is unavailable, the UI degrades gracefully with a clear failure state and keeps `Copy` source behavior working.
- [ ] Mermaid toolbar includes an `Expand` action.
- [ ] Expanded view supports both **scroll/pan** AND **Cmd/Ctrl+Scroll zoom**, with a visible zoom level indicator or reset affordance.
- [ ] Expanded view closes on `Escape`, returns focus to the editor block, and does not change document content.
- [ ] Existing source-code copy still copies Mermaid source, not the image.
- [ ] Existing `Code` / `Diagram` toggle still works.
- [ ] Invalid Mermaid syntax still shows an error state without crashing the editor.
- [ ] PDF/Word export behavior is not regressed.
- [ ] Webview build/tests pass.

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| Mermaid spacing fix | CSS and/or SVG sizing changes that remove excessive inline whitespace |
| Container-width sizing | Inline SVG sizing follows editor content container; oversized diagrams scroll horizontally instead of shrinking |
| Copy as image | Toolbar action that copies rendered Mermaid PNG to clipboard |
| Download as image | Toolbar action that downloads rendered Mermaid PNG as a file |
| Expanded view with zoom | Editor overlay for inspecting larger diagrams; supports scroll/pan + Cmd/Ctrl+Scroll zoom |
| Validation notes | Manual test matrix for simple, wide, tall, and invalid Mermaid diagrams |

## Implementation Checklist

### Phase 1: Confirm Current Layout Problem

- [ ] Create or reuse a test markdown file with:
  - [ ] Simple flowchart
  - [ ] Wide flowchart with many nodes
  - [ ] Tall sequence/class diagram
  - [ ] Invalid Mermaid block
- [ ] Inspect current inline rendering and capture before screenshots if useful.
- [ ] Confirm whether whitespace comes from:
  - [ ] `pre.tiptap-code-block.mermaid-block` top padding
  - [ ] `.mermaid-rendered-diagram` `padding: 16px`
  - [ ] Mermaid-generated SVG dimensions/viewBox
  - [ ] Forced SVG width `min(100%, 680px)`

### Phase 2: Inline Readability Fix

- [ ] Update Mermaid CSS in `extensions/ritemark/webview/src/components/Editor.tsx`.
- [ ] Reduce diagram container padding from the current generous spacing.
- [ ] Remove the hard `680px` SVG width cap.
- [ ] Size SVG to **content container width**: `max-width: 100%` of the editor column, NOT shrink-to-fit when the SVG is wider than the container.
- [ ] Add `overflow-x: auto` on the diagram container so wide diagrams scroll horizontally inside the inline block.
- [ ] Keep small diagrams centered without adding large whitespace; do not stretch small SVGs.
- [ ] Keep toolbar accessible without covering important diagram content.

### Phase 3: Copy + Download As Image

- [ ] Reuse `renderMermaidToPngDataUrl()` from `extensions/ritemark/webview/src/lib/mermaid.ts` where possible.
- [ ] Add a `Copy Image` toolbar action in `CodeBlockWithCopy.tsx`.
  - [ ] Convert current `svgContent` to PNG blob.
  - [ ] Use `navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])` when available.
  - [ ] Add success/error state separate from source-code copy state.
- [ ] Add a `Download Image` toolbar action in `CodeBlockWithCopy.tsx`.
  - [ ] Convert current `svgContent` to PNG blob.
  - [ ] Trigger download via temporary `<a download>` link or `URL.createObjectURL`.
  - [ ] Default filename: `mermaid-diagram.png` (or derived from first node label if trivial).
- [ ] Preserve existing `Copy` behavior as source-code copy.
- [ ] Feature-detect `ClipboardItem` and degrade Copy Image with clear error if unsupported; Download remains independent.

### Phase 4: Expanded View (Scroll + Zoom)

- [ ] Add an `Expand` action to the Mermaid toolbar.
- [ ] Implement an editor-local overlay/modal that renders the same SVG.
- [ ] Support **scroll/pan** for oversized diagrams (native scroll on overflow container).
- [ ] Support **zoom** via `Cmd+Scroll` (macOS) / `Ctrl+Scroll` (Win/Linux):
  - [ ] Zoom range: e.g. `0.25x` – `4x`.
  - [ ] Zoom anchored to cursor position when possible.
  - [ ] Show current zoom level (small badge) and provide a `Reset zoom` affordance.
  - [ ] Prevent default browser zoom while overlay is focused.
- [ ] Close on `Escape`; return focus to editor block.
- [ ] Avoid changing document content or TipTap node structure.

### Phase 5: Validation

- [ ] Run focused webview checks:
  - [ ] Mermaid source copy still works
  - [ ] Copy image works where supported
  - [ ] Copy image failure does not break the editor
  - [ ] Expanded view opens/closes cleanly
  - [ ] Diagram/code toggle still works
  - [ ] Invalid diagram still shows error
- [ ] Run relevant tests:
  - [ ] `npx tsx extensions/ritemark/webview/src/lib/mermaidExport.test.ts`
  - [ ] Webview build command used by current repo workflow
- [ ] If this becomes release-bound, run `./scripts/validate-qa.sh` before handoff.

## Technical Notes

- Current renderer lives in `extensions/ritemark/webview/src/components/CodeBlockWithCopy.tsx`.
- Current Mermaid helper lives in `extensions/ritemark/webview/src/lib/mermaid.ts`.
- Current Mermaid export inlining lives in `extensions/ritemark/webview/src/lib/mermaidExport.ts`.
- Current Mermaid CSS is embedded in `extensions/ritemark/webview/src/components/Editor.tsx`.
- TipTap `NodeViewContent` must stay mounted in the DOM even when showing the rendered diagram.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Clipboard image write unsupported in VS Code webview or some Chromium versions | Copy-as-image cannot always work | Feature-detect `ClipboardItem` and `navigator.clipboard.write`; show clear error and keep source copy |
| Removing width cap makes large diagrams overflow awkwardly | Poor inline UX | Use horizontal scrolling inline and expanded view for inspection |
| Toolbar overlaps diagram content | Annoying for small diagrams | Keep toolbar compact and consider always reserving only minimal top space |
| Modal focus handling breaks editor keyboard flow | Editor feels stuck after close | Trap/restore focus and close on `Escape` |
| Export image path regresses | PDF/Word output degrades | Keep export code unchanged unless needed; run Mermaid export test |

## Status

**Current Phase:** 5 (VALIDATION — awaiting Jarmo manual test in dev mode)

**Implementation branch:** `feat/sprint-56-mermaid-diagram-fixes` (current).

### Implementation summary

- Phase 1 ✅ confirmed whitespace sources; created `notes/test-diagrams.md`.
- Phase 2 ✅ `Editor.tsx` Mermaid CSS: `padding-top` 36→28, container `padding` 16→8, `min-height: 60px` removed, `border-radius` 12→8, removed `680px` cap (`width: auto`, `max-width: none`), block layout with `text-align: center`. Also `mermaid.ts`: `renderMermaid()` now applies `ensureSvgDimensions()` so inline SVG has explicit width/height (no more forced `100%`).
- Phase 3 ✅ Added `Copy image` and `Download` toolbar buttons in `CodeBlockWithCopy.tsx` reusing `renderMermaidToPngDataUrl()`. Feature-detected `ClipboardItem`; degrades to error label on unsupported. Download uses object URL + temp `<a download>`.
- Phase 4 ✅ Added `Expand` toolbar button + fullscreen overlay with cursor-anchored Cmd/Ctrl+Scroll zoom (range 0.25×–4×), reset button, zoom % indicator, Esc close, focus restore, body scroll lock.
- Phase 5 ✅ technical: TypeScript `noEmit` clean; `mermaidExport.test.ts` passing; webview vite build succeeds. ⏳ manual validation pending.

## Approval

- [x] Jarmo approved this sprint plan (locked decisions added 2026-05-01; "approved" 2026-05-01)
