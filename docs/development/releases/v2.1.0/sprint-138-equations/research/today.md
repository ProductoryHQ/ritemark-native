# What exists today, and what a save does to math

Read on 2026-10-26 from `main` at `b1ac84a7` (v2.0.1 closeout), for the plan. File references are to that commit. `E` = `extensions/ritemark/`.

## The editor's way in and out

| Step | Today | File |
|---|---|---|
| Load | `editorMarked = new Marked({ breaks: true, gfm: true })`, a scoped instance so extensions never touch the global `marked` the AI's sheet uses. The comment tokenizer is registered on it lazily. `marked.parse` runs at mount and on every host update | `E/webview/src/components/Editor.tsx` 58–74, 331, 771 |
| Into TipTap | the HTML goes through the task-list and image pre-passes, then `createNodeFromContent` with `preserveWhitespace: 'full'`; a structural diff is applied, with `setContent` as the fallback | `Editor.tsx` 771–830 |
| Save | `serializeEditorHTML(editor.getHTML())` = `turndownService.turndown(preprocessTableHTML(html))`. The same function serializes for change detection, so a load that serializes differently from the file looks like an edit | `Editor.tsx` 143–153 |
| Turndown | `createTurndownService()`: ATX, fenced code, `-`, `*`, `**`, GFM tables and task items, a strikethrough rule, a pipe escape in cells, the image path rule. Turndown's own escaper runs on text, and a second pass escapes only the tildes `marked` would pair (`escapeLiteralTildes`) | `E/webview/src/utils/turndownService.ts` |
| Comments | the model for a new syntax: a `marked` extension (`commentMarkedExtension.ts`), Turndown rules (`commentTurndownRules.ts`) and an atom node with the source in an attribute (`CommentNode.ts`) | `E/webview/src/extensions/comment/` |
| Round-trip tests | `tsx` scripts with `@xmldom/xmldom`, the editor's own `Marked` options and `createTurndownService()`: `literalTildeRoundTrip.test.ts`, `orderedListRoundTrip.test.ts`, `strikethroughRoundTrip.test.ts` | `E/webview/src/utils/`; run from `E/package.json` `test` |

Neither `marked` nor Turndown knows math. `$` has no meaning to either, and LaTeX's backslashes are Markdown escapes to `marked`.

## The probe: what a save does to math today

A scratch script fed seven strings through `marked` 9.1.6 with the editor's options and Turndown 7.2.4 with the editor's options and its default escaper. It ran outside TipTap and without Ritemark's tilde pass, which only adds escapes for tildes. Audit A1 repeats it through the real editor.

| In the file | After a save (from the probe) | What broke |
|---|---|---|
| `$\bar{x} = \frac{1}{n}\sum_{i=1}^{n} x_i$` | `$\\bar{x} = \\frac{1}{n}\\sum\_{i=1}^{n} x\_i$` | every backslash doubled, every `_` escaped: no tool reads it as the same formula |
| `$\{x \mid x > 0\}$`, `$a\,b$` | `${x \\mid x > 0}$`, `$a,b$` | `\{`, `\}` and `\,` are Markdown escapes to `marked`, so their backslashes are gone |
| `$5\%$`, `$a*b*c$` | `$5%$`, `$a*b*c$` | `\%` loses its backslash (a LaTeX comment now); `*b*` was italic in the editor |
| `Costs $5 and $10 in prose.` | unchanged | — |
| `$$` / `\begin{pmatrix} a & b \\ c & d \end{pmatrix}` / `$$` | `$$  ` / `\\begin{pmatrix} … \\\\end{pmatrix}  ` / `$$` | hard breaks with trailing spaces (#270's soft-break class), doubled backslashes |
| `\(x^2\)` and `\[ y = mx + b \]` | `(x^2)` and `\[ y = mx + b \]` | ChatGPT's inline delimiters become plain parentheses |

So today, one edited word anywhere in a document saves every formula in it in a form no other tool reads. Typesetting is the promise; not damaging the source is the floor under it. This sprint's R1 and R2 are that floor.

The probe, for repeating it: save as a `.cjs` file anywhere and run it with `node`, with `M` pointing at an installed `extensions/ritemark/webview/node_modules` (6 of the 7 cases come back changed).

```js
const M = process.env.M; // .../extensions/ritemark/webview/node_modules
const { Marked } = require(`${M}/marked/lib/marked.cjs`);
const TurndownService = require(`${M}/turndown/lib/turndown.cjs.js`);
const marked = new Marked({ breaks: true, gfm: true });
const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced',
  bulletListMarker: '-', emDelimiter: '*', strongDelimiter: '**' });
for (const md of [
  'The mean is $\\bar{x} = \\frac{1}{n}\\sum_{i=1}^{n} x_i$ here.',
  'A set $\\{x \\mid x > 0\\}$ and a thin space $a\\,b$.',
  'Percent $5\\%$ and $a_1 + b_1$ and $a*b*c$.',
  'Costs $5 and $10 in prose.',
  '$$\n\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}\n$$',
  '$$\nE = mc^2\n$$',
  'ChatGPT style \\(x^2\\) and \\[ y = mx + b \\]',
]) {
  const saved = turndown.turndown(marked.parse(md));
  console.log(JSON.stringify(md), '->', JSON.stringify(saved), saved === md ? 'same' : 'CHANGED');
}
```

## Export

| Target | Today | File |
|---|---|---|
| The webview's part | `handleExportPDF`, `handleExportWord`, `handlePublishGoogleDocs`: `editor.getHTML()` → `preprocessTableHTML` → `inlineMermaidDiagramsForExport` (Mermaid to PNG) → `inlineSvgImagesForExport` (SVG to PNG) → `sendToExtension('exportPDF' / 'exportWord' / 'google-docs/publish')` | `E/webview/src/App.tsx` 617–647; `E/webview/src/lib/mermaidExport.ts`, `svgRasterExport.ts`, `mermaid.ts` (`rasterizeSvgToPngDataUrl`) |
| Host entry | `ritemarkEditor.ts` hands the HTML to `exportToPDFV2` and `exportToWordV2`; both pass it through `buildNormalizedExportHtml`, which strips comments and unsafe tags | `E/src/ritemarkEditor.ts` 1026–1053; `E/src/export/v2/htmlPipeline.ts` |
| PDF | pdfkit 0.17.2 draws node by node from node-html-parser 7.1.0. A paragraph, heading, list item, quote and table cell is flattened to plain text (`compactText(getNodeText(node))`) in one font, so bold, italic and inline code are lost, though the help says "Bold/Italic: Preserved". Images are drawn only as blocks; an image inside a paragraph is dropped | `E/src/export/v2/pdfHtmlExporter.ts` 168–212 |
| Word | docx 8.5.0. `collectInlineRuns` keeps bold, italic, code and links; an element it doesn't know contributes its children, so an `<img>` inside a paragraph is dropped. A table's header row is taken from `textContent` | `E/src/export/v2/wordHtmlExporter.ts` 76–121, 147–175 |
| Legacy exporters | `export/pdfExporter.ts` and `export/wordExporter.ts` are imported nowhere | — |

docx 8.5.0 has typed equation classes (`Math`, `MathRun`, `MathFraction`, `MathSuperScript`, `MathSubScript`, `MathSubSuperScript`, `MathRadical`, `MathSum`, `MathIntegral`, `MathFunction`, four bracket kinds), and it exports `ImportedXmlComponent.fromXmlString`, which can carry ready OMML into a paragraph. See [word-equations.md](word-equations.md).

## Google Docs

| Part | Today | File |
|---|---|---|
| HTML to blocks | `inlineRuns` skips an `<img>` in prose; `blocksFrom` lifts such images out as image blocks after their paragraph. Table cells are text only (`textOf`) | `E/src/googleDocs/mapper.ts` 85–134, 207–215 |
| Requests | one `insertText` with placeholder lines for tables and images; styling; bullets; then tables and images at their placeholders, last first (`placeholderRequests`, `insertInlineImage`) | `mapper.ts` 255–424 |
| Quotes (#408) | `updateParagraphStyle` with `indentStart` 18 pt per level and `borderLeft` 3 pt, `fields: 'indentStart,borderLeft'`. `indentFirstLine` is never set, so the first line keeps the Doc's own value | `mapper.ts` 307–320 |
| Images | uploaded to the person's Drive, shared by link while Docs copies them, then unshared and deleted; a `data:` PNG works (Mermaid diagrams take this path) | `E/src/googleDocs/imageStaging.ts` |
| Sync | skips an unchanged source by the sha256 of the normalized HTML | `E/src/googleDocs/GoogleDocsPublisher.ts` |

## Where the AI meets the text

- The selection the AI's sheet receives is `doc.textBetween(from, to, ' ')`, with 80 characters of context on each side (`Editor.tsx` 616–627). A comment's captured text is `textBetween` too (`commentIndex.ts` 130).
- An atom node contributes to `textBetween` only through ProseMirror's `leafText`. TipTap 2.27.2 does not map a node's `renderText` to `leafText` (no `leafText` in `@tiptap/core`'s build), so a math node must set it itself, or the AI and comments see nothing where an equation is.
- Agents read and write the file itself, so they already see and write the source.

## Found on the way, not in this sprint

- The help (`docs/user/features/export.md`) says the PDF keeps task-list checkboxes and has a title header and page numbers, and that Word has a footer. The exporters draw none of these. To file as an issue after a check.
- Ritemark's own Word preview (docx-preview) draws equations only roughly (`docs/user/features/previews.md`), so a .docx with native equations opened inside Ritemark will look rough. Chromium renders MathML itself, so a later fix could turn OMML into MathML there (`omml2mathml`, Apache-2.0). To file as an issue.
- Pasting into the editor: plain text is not read as Markdown; rich HTML goes through TipTap's own parser (`handlePaste` returns false). Rendered math from ChatGPT's or Claude's pages arrives as KaTeX HTML carrying the source in `<annotation encoding="application/x-tex">`.
