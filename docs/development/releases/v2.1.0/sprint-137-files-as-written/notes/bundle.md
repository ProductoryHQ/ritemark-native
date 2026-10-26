# Bundle sizes (E3, #107)

Measured with `wc -c` on 26 October 2026, after `npm run build` in `extensions/ritemark/webview` (Vite, both modes).

| Bundle | main (08761e71) | Sprint 137 | Change |
|---|---|---|---|
| `media/webview.js` | 8,611,995 | 8,629,515 | +17,520 (+0.2%) |
| `media/office-preview.js` | 2,576,131 | 2,586,103 | +9,972 (+0.4%) |

- `webview.js` grows by the as-written module (`markdownAsWritten.ts`), the link and update helpers (`lib/linkEdit.ts`, `lib/documentUpdate.ts`) and `@tiptap/extension-code`, which StarterKit already bundled; it is now listed so the editor can extend it.
- `office-preview.js` shares `turndownService.ts` (Save as Markdown in the Word preview), so it carries the Turndown rules and the escaping. The TipTap side of the module (`MarkdownAsWritten`) lives in `editorMarkdown.ts`, which the Word preview does not import. A first cut that put it in `turndownService.ts` pulled TipTap into `office-preview.js` (+124 KB); that was moved before the commit.
- The corpus files are read by the test from disk and never imported, so they add nothing to either bundle.
