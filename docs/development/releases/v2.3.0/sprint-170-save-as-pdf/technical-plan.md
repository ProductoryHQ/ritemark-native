# Sprint 170 technical plan

A narrow, read-only look at main (f6dbfaa2). Pointers, not a design; PR 0 fills in the open question.

## What exists
- **The Text editor's Export as PDF:** `extensions/ritemark/src/export/pdfExporter.ts` (pdfkit, `showSaveDialog` starting in the document's folder, Helvetica) and `src/export/v2/pdfHtmlExporter.ts`. Both draw text with pdfkit; neither renders CSS, so neither can draw the published page or a slide. The save dialog and Replace behaviour are the part to reuse.
- **The published page's print:** `extensions/ritemark/src/decks/page/pageHtml.ts`, `PRINT_CSS` (about line 697, `@page` margin 14mm 15mm) and `printOrderCss`. Kind 2 (Slides and handout) is this page printed.
- **The wall's renderer:** the slide renderer under `src/decks/` that Present, the strip and the page share (`slideRenderer`; the parity tests are `slideRenderer.parity.test.ts`). Kind 1 draws each slide with it at 16:9.
- **The deck bar's Publish:** `extensions/ritemark/webview/src/components/decks/DeckPublish.tsx` (`DeckPublish`, `DeckPublishControl`), placed by `DeckView.tsx`. Use the shadcn Button and the existing dropdown component, a Tooltip on both parts (never native `title`), and close on outside click and Esc.

## The open question (PR 0)
How does the extension host turn this HTML into a PDF with fonts embedded, links live, no network? Options to test, in this order:
1. A call the extension host already has (a webview or an Electron API reachable from extension code).
2. A bundled dependency (adds to the esbuild externals, and to the notice files).
3. A print path in the VS Code core, which is a patch and shell-tier.

PR 0 writes the answer, the tier it implies and the proof (one small PDF from a synthetic deck) in `research/`. Nothing else starts before it.

## Message flow
The webview sends the host the view's kind and the deck's text and look at the press (as Publish does); the host builds the page or slides, prints, asks for the file, writes it, and answers "saved as <name>" for the bar's note. The view's kind is read at the press, never remembered.

## Files likely touched
`DeckPublish.tsx`, a new host module under `src/decks/` for the print, the deck message types, `pageHtml.ts` (only to share its print rules; its output must not change), tests beside each.
