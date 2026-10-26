# Sprint 138 Technical Plan

The plan for [spec.md](spec.md). File references are to `main` at `b1ac84a7`; `E` = `extensions/ritemark/`. Code shapes here are proposals: when the code needs something else, this file changes first. The research behind it: [today.md](research/today.md) (the code as it is, and the round-trip probe), [word-equations.md](research/word-equations.md) and [fonts-and-bundle.md](research/fonts-and-bundle.md).

## What exists today

| Part | Today | File |
|---|---|---|
| Load | a scoped `marked` (`breaks`, `gfm`), with the comment tokenizer as the model for a new syntax | `E/webview/src/components/Editor.tsx` 58–74 |
| Save | Turndown through `createTurndownService()`; its tilde pass is the model for a selective escaper | `E/webview/src/utils/turndownService.ts` |
| Math | none. A save doubles LaTeX's backslashes, drops `\{`, `\,` and `\%`'s, escapes `_`, and turns `\(…\)` into parentheses | [today.md](research/today.md), the probe |
| KaTeX | 0.16.47's code in `webview.js` through Mermaid 11.17.1; no stylesheet or fonts | [fonts-and-bundle.md](research/fonts-and-bundle.md) |
| Export HTML | `App.tsx` 617–647: `getHTML` → tables → Mermaid PNGs → SVG PNGs → `exportPDF`, `exportWord`, `google-docs/publish` | `E/webview/src/App.tsx`, `E/webview/src/lib/` |
| PDF | pdfkit; text blocks flattened to plain text; images only as blocks | `E/src/export/v2/pdfHtmlExporter.ts` |
| Word | docx 8.5.0; inline runs keep bold, italic, code, links; inline images dropped; header row from `textContent` | `E/src/export/v2/wordHtmlExporter.ts` |
| Google Docs | blocks and runs; images lifted out of prose; placeholders for tables and images; quotes without `indentFirstLine`, a 3 pt bar | `E/src/googleDocs/mapper.ts` |
| AI's view of text | `textBetween` for the selection and comments; TipTap 2.27.2 sets no `leafText` | `Editor.tsx` 616–627; `commentIndex.ts` 130 |
| Insert menus | one list for the slash menu and the block menu | `E/webview/src/extensions/blockItems.ts` |

## Architecture overview

```text
file ──marked + math extensions──▶ HTML ──TipTap──▶ MathInline / MathBlock / LiteralDollar nodes
  ▲   (scoped editorMarked)        span[data-math] div[data-math]   (LaTeX + delimiters in attributes;
  │                                span[data-literal-dollar]          NodeViews typeset with KaTeX)
  └──Turndown + math rules + dollar escaper◀── getHTML ◀───────────────────────┘

export: getHTML ──prepareMathForExport (webview: KaTeX → MathML, PNG at 4×, metrics)──▶ host
        host: PDF inline layout (PNG) │ Word: mathml2omml → OMML, PNG fallback │ Google Docs: PNG via Drive staging
```

No new message type, no new host↔webview protocol and no new subsystem. The export payloads keep their shapes; the HTML they carry gains math elements. `architecture.md` gains a section (E4).

## Workstream 1: Markdown in and out (R1, R2)

### The shared rules: `E/webview/src/extensions/math/mathSyntax.ts`

Pure functions, used by the tokenizer, the input and paste rules and the escaper, so the four can never disagree:
- `scanInlineMath(src, at)`: from a `$`, `$$`, `\(` or `\[` at `at`, the extent, delimiter and LaTeX by R1's rules, or `null`. A `\$` inside does not close; `$` needs a non-space after the opener, a non-space before the closer and no digit after it; no blank line inside.
- `scanBlockMath(src)`: an equation block at the start of `src` (`$$` or `\[` opening a line, closing at a line's end), with the exact opening and closing text and the LaTeX between them, untrimmed.
- `literalMathPairs(text)`: the pairs of literal `$` in a text node that would read as math under the same rules, for the escaper.

### The `marked` extensions: `mathMarkedExtension.ts`

Registered on the editor's scoped `editorMarked` **always**, not behind a flag, because reading math is what keeps formulas safe on save. Registered also in the tests' `Marked`.
- **Block `mathBlock`**, with no `start()`, so it is tried only at a block boundary and never cuts a paragraph. A `$$` that follows a paragraph line without a blank line therefore stays in the paragraph, as inline display math (R1).
- **Inline `mathInline`**, with `start()` at the next `$`, `\$`, `\(` or `\[`. `marked` tries extensions before its own tokenizers at each position, so `\(` is ours before the escape tokenizer eats it, and a code span's backticks are consumed before its dollars are seen.
- **Inline `literalDollar`** for `\$` in prose.

HTML they render (attribute values HTML-escaped, as the comment extension does):

```html
<span data-math="inline" data-delimiter="$" data-latex="\bar{x}">$\bar{x}$</span>
<div data-math="block" data-open="$$" data-close="$$" data-latex="&#10;\int_0^1 x^2 \, dx&#10;">$$…$$</div>
<span data-literal-dollar="">$</span>
```

The element's text is the source with its delimiters, so anything that does not know math still shows the source (spec principle: never lost).

### The nodes: `MathInline.ts`, `MathBlock.ts`, `LiteralDollar.ts`

- `mathInline`: inline, atom, selectable; attributes `latex` and `delimiter` (`$`, `$$`, `\(`, `\[`).
- `mathBlock`: block, atom; attributes `latex` (untrimmed, so its line breaks stay), `open` and `close` (the exact delimiter text).
- `literalDollar`: inline, atom, shows `$`.
- Each sets `renderText` (TipTap's clipboard text) and ProseMirror's `leafText` through `extendNodeSchema`, both returning the source with delimiters, so `textBetween` gives the AI and comments the source (R7).
- Added to `Editor.tsx`'s extension list. They match TipTap 3's own Mathematics model (inline and block nodes, LaTeX in an attribute), so #243 keeps them.

### Writing back: `mathTurndownRules.ts`, in `createTurndownService()`

- `mathInline` → `delimiter + latex + closing delimiter`, from the attributes, never escaped.
- `mathBlock` → `\n\n` + `open + latex + close` + `\n\n`.
- `literalDollar` → `\$`.
- The escaper: `service.escape` gains a third pass after Turndown's own and the tilde pass: `escapeLiteralDollars(text)` writes `\$` for both dollars of each pair `literalMathPairs` finds, so `$x$` typed as text is written `\$x\$`. `$5`, `costs $5 and $10` and `$HOME` are left alone. Like the tilde pass, it judges within one text node.
- In `createTurndownService()`, so Copy as Markdown and Save as Markdown (DOCX and PDF previews) agree with the editor. A `$x$` in a Word document's text is literal there, and comes out as `\$x\$`, which is right.

An edited equation is written by the same rule from its new attributes: the delimiters stay, a block keeps its leading and trailing line breaks, inline `$` LaTeX is trimmed and a bare `$` in it becomes `\$` when the edit is committed (W3).

### Tests

- `mathSyntax.test.ts`: every R1 case, the "not math" list first.
- `mathRoundTrip.test.ts`, on the pattern of `literalTildeRoundTrip.test.ts` (xmldom, the editor's `Marked` options, `createTurndownService()`): each fixture through load and save, byte for byte, plus the escaper's cases.
- Fixtures in `E/webview/src/extensions/math/fixtures/`: `analyst-report.md` (the film's stand-in: inline and display math, a table, a list, a quote), `forms.md` (every delimiter form of S10), `prose-dollars.md` (S2's sentences and more), `edge-cases.md` (math in headings, lists, quotes, table cells; `\$`; code). They join Sprint 137's corpus for #270 when it lands, so one corpus checks both.
- The real editor path (TipTap included) is checked on a dev instance through CDP in audit A1 and S8–S10, because the unit tests stop at `marked` and Turndown.

## Workstream 2: Typesetting in the editor (R3)

### `E/webview/src/extensions/math/mathRender.ts`

- `loadKatex()`: `import('katex')`, which resolves to the copy Mermaid already brings. The webview pins `katex` to `0.16.47`, the version in Mermaid's tree (W9 checks there is one copy).
- `ensureKatexStylesheet()`: once per view, adds `<link rel="stylesheet" href="…/media/katex/katex.min.css?v=0.16.47">`, its URL derived from `webview.js`'s own (captured from `document.currentScript` when the bundle starts, in `main.tsx`), and resolves when it and `document.fonts.ready` have loaded. If the link fails, it reports `unavailable`, and the views show sources (R3).
- `typeset(element, latex, displayMode)`: `katex.render` with `throwOnError: true`, `trust: false`, `strict: 'ignore'`, `output: 'htmlAndMathml'`, `maxExpand: 1000`, `maxSize: 50`. A `ParseError` goes to the error view (W3).
- Called only by the math NodeViews, so a document without math never loads the stylesheet.

### The views: `MathInlineView.tsx`, `MathBlockView.tsx`

React NodeViews (`ReactNodeViewRenderer`), as `CodeBlockWithCopy` is, so the error tooltip and the editing field use the UI components. Audit A1 measures 200 equations: typeset within 1 s on an M1 more than the same document without them; if not, the typeset state becomes a plain DOM NodeView and React only for editing.

### Styles

Ritemark's own few rules in the editor's style block: inline equations without extra spacing; a block centred with the editor's paragraph spacing; the error mark; the editing field in the code style. KaTeX's colours inherit the text colour, so Light and Dark need nothing. KaTeX's own stylesheet is never imported into the bundle (W9).

## Workstream 3: Editing and writing equations (R4, R5, R6)

- **Opening:** a click on an equation, or Enter on a selected one (the node's keyboard shortcut), sets the view to editing.
  - inline: an auto-sized field in the code style between muted delimiters;
  - block: a field the text's width over the live typeset result, as Mermaid's code and diagram switch.
  The view's `stopEvent` keeps typing in the field away from ProseMirror.
- **Committing:** Escape, Tab, a click elsewhere, or an arrow key at the field's end (inline); Escape or a click elsewhere (block). One transaction with `setNodeMarkup`, so one undo step. Inline `$` LaTeX is trimmed and its bare `$` escaped. Empty → the node is deleted.
- **Cursor:** atoms already move as one position with the arrows; Backspace beside an atom selects it first (ProseMirror's default for selectable atoms; S23 checks).
- **Input rule** (`addInputRules`): on a typed `$`, `scanInlineMath` over the text before it; a match becomes a `mathInline`. Undo right after uses TipTap's `undoInputRule`, so the text comes back and the escaper keeps it literal.
- **`$$` and Enter** in an empty paragraph (a keyboard shortcut): the paragraph becomes an empty `mathBlock`, open for editing.
- **Equation** in `blockItems.ts`, with its case in `executeSlashCommand` and the block menu's executor: an empty block, open for editing. Its icon is a Phosphor icon added to the curated map in `ui/Icon.tsx`, which has none for math today (`function` or `math-operations`, the Experience lead's choice).
- **Errors:** `mathErrors.ts` turns KaTeX's common `ParseError` messages (undefined control sequence, missing or extra brace, unexpected end, unknown environment) into one plain sentence, with a general sentence for the rest. The view shows the source in the code style with a warning-circle icon and the sentence in `ui/tooltip.tsx`.
- **The look:** the Experience lead's drawing wins where it exists (decision for Jarmo 6). Until then, existing tokens only.

## Workstream 4: Copy, paste and the AI (R7)

- **The AI and comments:** `leafText` (W1) is all they need. S27 checks the three runtimes' prompts with the bridge trace; S28 the comment task's text.
- **Clipboard text and Copy as Markdown:** `renderText` and the Turndown rules.
- **Rendered math pasted from the web:** `parseHTML` rules on `mathInline` and `mathBlock` at a high priority, for `span.katex` and `span.katex-display`, and for `math` elements, that carry `annotation[encoding="application/x-tex"]`: the annotation's text is the LaTeX; `.katex-display` and `math[display=block]` make a block with `$$`, everything else inline `$`. ChatGPT's and Claude's pages render with KaTeX (inferred; S30 checks).
- **Plain text pasted with `$…$`:** a paste rule (`addPasteRules`) with the same `scanInlineMath`.

## Workstream 5: Export preparation in the webview (R8, R9, R10)

### `E/webview/src/lib/mathExport.ts`

`prepareMathForExport(html, target)` runs in the three handlers in `App.tsx`, next to the Mermaid and SVG passes. For each `[data-math]` element:
1. typeset it off screen with KaTeX at the export's text size (11 pt, the PDF template's body size), inline or display;
2. measure its width, height and depth below the baseline in CSS px, with a zero-size inline-block as the baseline probe;
3. draw it into a canvas at 4× through an SVG `foreignObject` that carries KaTeX's stylesheet and the faces the equation uses as `data:` URLs (fetched once from `media/katex/` and cached; `connect-src` allows it, as `svgRasterExport.ts` fetches SVGs), then `rasterizeSvgToPngDataUrl` to a PNG;
4. for `target === 'word'`, also KaTeX's MathML (`output: 'mathml'`);
5. replace the element with its export form:

```html
<span data-math="inline" data-delimiter="$" data-latex="\bar{x}" data-status="ok"
      data-width="21.4" data-height="14.1" data-depth="0.2" data-mathml="&lt;math …&gt;">
  <img data-math-image="" src="data:image/png;base64,…" alt="\bar{x}">
</span>
```

A typo gives `data-status="error"` and no picture. Every exporter shows such an equation as its source in the code style, and the host counts them for the message after the export (decision for Jarmo 5). The payloads do not change: the host reads the count from the HTML, and Google Docs' exact-key `{html, title}` stays exact.

**Audit A3** checks plan A (sharpness, baselines, fonts, 100 equations in under 3 s). If it fails, plan B typesets for export with MathJax 4's SVG output from `media/drawio/math4/` and rasterizes it the same way ([fonts-and-bundle.md](research/fonts-and-bundle.md)).

## Workstream 6: PDF (R8, R12)

### `E/src/export/v2/pdfInlineLayout.ts`

- `collectRuns(node)`: text runs with bold, italic and code from `STRONG`/`B`, `EM`/`I`, `CODE`; math runs (the PNG, and the width, height and depth converted from CSS px to points); line breaks from `BR`.
- `layoutRuns(doc, runs, { x, y, width, fontSize, fonts, color, lineGap })`: greedy word wrapping with `widthOfString` per font; each line's height from the tallest text ascent or math height above the baseline, and the deepest descent or math depth; text drawn word by word with `lineBreak: false`, math drawn at `baseline − (height − depth)`. An inline equation wider than the line is scaled to fit. Returns the end y. A dry run measures a block's height, for page breaks and table rows.
- Fonts: pdfkit's standard Helvetica, Helvetica-Bold, Helvetica-Oblique, Helvetica-BoldOblique and Courier, as the template names (`htmlPipeline.ts` styles).

### `pdfHtmlExporter.ts`

- `P`, headings, `BLOCKQUOTE`, list items and table cells use `layoutRuns` instead of `compactText(getNodeText(node))`, which gives R12 with R8.
- `div[data-math=block]`: its PNG centred, scaled to the column if wider, with the paragraph gap around it; `ensurePageRoom` before it.
- An equation with `data-status="error"`: its source in Courier.
- Code blocks, rules and images keep today's code.
- Tests: `pdfInlineLayout.test.ts` with a fake measuring document (fixed character widths), for wrapping, the baseline of a math run, a too-wide equation, bold and italic runs, and a table cell's height.

## Workstream 7: Word (R9)

### `E/src/export/v2/mathToWord.ts`

- `loadConverter()`: `mathml2omml` through `new Function('return import("mathml2omml")')`, as the agent SDKs load, cached. It is ESM only and stays out of the bundle (W9).
- `mathToWordChild(element, style)`:
  1. take `data-mathml` and strip `<annotation>`;
  2. `mml2omml(mathml)`; for display, wrap in `m:oMathPara` with `m:jc` centred;
  3. check the result parses as XML and its root is `m:oMath` or `m:oMathPara`;
  4. `ImportedXmlComponent.fromXmlString(omml)` (docx 8.5.0 exports it), cast to a paragraph child;
  5. on any failure, an `ImageRun` from the PNG at `data-width` × `data-height` px;
  6. for `data-status="error"`, a `TextRun` in the code font with the source.
- `wordHtmlExporter.ts`: `collectInlineRuns` gains the math case; `div[data-math=block]` becomes its own centred paragraph in `parseBlocks`; a table's header row goes through `collectInlineRuns` with bold, instead of `textContent`.
- Tests: `mathToWord.test.ts` runs the real converter on fixed MathML and checks the OMML; a throwing converter gives an `ImageRun`; a packed .docx (`Packer.toBuffer`) has `m:oMath` in `word/document.xml` and opens in LibreOffice headless where available.

**Audit A4** first ([word-equations.md](research/word-equations.md)): 40 formulas, Word for Mac and Windows, LibreOffice, Pages, Google Docs import. If it fails, every equation is a picture (the shape's decision 4).

## Workstream 8: Google Docs (R10, R11)

### `E/src/googleDocs/mapper.ts`

- `blocksFrom`: `div[data-math=block]` is an image block with its PNG, alt "Equation", and a centred paragraph (`alignment: CENTER` on its placeholder line).
- `inlineRuns`: `span[data-math=inline]` writes an inline placeholder token (`⁣RITEMARK_MATH_<n>⁣`) into the text and records an inline image with its size in points. `locatePlaceholders` already finds a token anywhere in a run. `placeholderRequests` replaces it, last first, with `insertInlineImage` carrying `objectSize.height` at the text size.
- A table cell's text uses each equation's source with delimiters, and the plan returns a note that the controller turns into one sentence in the result.
- An equation with `data-status="error"` is its source in the code style, as everywhere.
- **#408:** `case 'quote'` sets `indentFirstLine` to the same magnitude as `indentStart`, and `borderLeft.width` to 0.5 pt; `fields: 'indentStart,indentFirstLine,borderLeft'`. The 6 pt padding is checked in a real Doc at the new width (A5).

### `GoogleDocsPublisher.ts`

The unchanged-source check hashes the normalized HTML with every `img[data-math-image]` removed, so a picture rendered with different bytes never forces a Sync (R10). The equations' sources stay in the hash.

### Tests and audit

- `mapper.test.ts`: block and inline math, a table cell with math, the quote cases of #408 (single, multi-paragraph, nested, with a list), `indentFirstLine` in `fields`.
- `GoogleDocsPublisher.test.ts`: the hash ignores math pictures, not their sources.
- **Audit A5**, on a test Google account: an inline image at an inline placeholder lands in its sentence at the right size; how its bottom sits against the baseline (Docs gives inline images no baseline offset, so an equation's depth may sit raised: recorded, not fixed); the quote's first line, border and padding in a real Doc.

## Workstream 9: Delivery and weight (R13)

- **The webview's KaTeX:** `"katex": "0.16.47"` exact in `E/webview/package.json`, the version Mermaid 11.17.1 resolves, so the lockfile keeps one copy.
- **`media/katex/`:** a small Vite plugin in `E/webview/vite.config.ts` (the `webview` mode only) copies `katex.min.css`, rewritten so each `@font-face` names only its woff2 file, the 20 `fonts/*.woff2` and `LICENSE` into `../media/katex/`. The plugin also fails the build when the bundle's module graph holds more than one `katex` package, or one at another version than the copied files. The files are committed, as `webview.js` and `media/drawio/` are.
- **`mathml2omml`:** `"mathml2omml": "0.5.0"` exact in `E/package.json`; added to `external` in `E/esbuild.config.mjs`, which `scripts/check-bundled-extension-complete.sh` already checks.
- **`scripts/validate-build-output.sh`** (shell-tier): the built app's extension has `media/katex/katex.min.css`, 20 woff2 faces and `node_modules/mathml2omml`.
- **Notices:** KaTeX (MIT) and `mathml2omml` (LGPL-3.0-or-later, with the GPL text it builds on) in `branding/ATTRIBUTION.md`; KaTeX's licence beside its files; `mathml2omml`'s in its own folder.
- **Measured** in `notes/bundle.md` before and after: `webview.js`, `out/extension.js`, `media/katex/` (E2).

## Audits first (Phase 1)

| Audit | Question | Decides |
|---|---|---|
| A1 `research/editor-roundtrip-audit.md` | The probe through the real editor on a dev instance (TipTap included): what today's save does; then the 200-equation timing on the branch | R2's corpus; W2's view type |
| A2 `research/katex-assets-audit.md` | KaTeX's stylesheet and woff2 from `media/katex/` load in a dev instance and a production build, Mac and Windows, through the service worker | W2's loader, or plan B (host sends `data:` faces) |
| A3 `research/export-images-audit.md` | Plan A's pictures: sharp, on the baseline, KaTeX's fonts, fast | W5 plan A or B |
| A4 `research/word-equations-audit.md` | `mathml2omml` on 40 formulas, in Word (Mac and Windows), LibreOffice, Pages, Google Docs import | W7, or pictures only |
| A5 `research/google-docs-audit.md` | Inline images at inline placeholders; #408's look in a real Doc | W8 |
| A6 in `notes/bundle.md` | One KaTeX in `webview.js` after the direct import | W9 |

When an audit changes a requirement, `spec.md` changes first.

## Release tier

**Shell.** `scripts/validate-build-output.sh` is a shell-tier path, and `media/katex/` and the `mathml2omml` external reach people only with an app release (`CLAUDE.md`, *Release Tiers*). 2.1.0 is a shell release (the shape's decision 1).

## Risks inside the sprint

| Risk | Retirement |
|---|---|
| Math in a list item or a softly broken paragraph is not byte for byte until Sprint 137 lands | R2 says so; the corpus marks those cases and they turn green with 137; merge after 137 |
| `Editor.tsx` and `turndownService.ts` are Sprint 137's files too | Small, separate additions (an extension list entry, a rule file, one escaper pass); rebase on 137 before the PR |
| The pictures for export fail in the webview (A3) | Plan B: MathJax 4 from draw.io's copy |
| KaTeX's files do not load by URL (A2) | Plan B: the host sends the faces as `data:` URLs |
| `mathml2omml` converts poorly or Word repairs the file (A4) | The own mapper, or pictures only (the "otherwise" of the shape's decision 4) |
| The LGPL is refused | The own mapper (MIT), same fallback |
| Typing `$` in prose triggers math | R1's rules and the digit rule; S24; undo turns it back |
| `\(…\)` read as math changes a document that escaped a parenthesis on purpose | Rare; the same text is saved back unchanged either way; documented |
| A Mermaid upgrade brings another KaTeX | The build fails on two copies or a version mismatch (W9) |
| Many equations slow the editor | A1's timing; a plain DOM view for the typeset state |
| Google Docs' inline pictures sit high | A5 records it; a known limit if so |
| The film's outputs are wrong at capture | S46 on the release candidate before capture |
| Ritemark's own Word preview draws exported equations roughly | A known limit (`previews.md`); an issue to file |

## As built: where the code differs from this plan

Narrow choices made during the build, each within a requirement; the PR lists them for the Development manager.

| Plan | As built | Why |
|---|---|---|
| `MathInline.ts`, `MathBlock.ts`, `LiteralDollar.ts`; `MathInlineView.tsx`, `MathBlockView.tsx` | one `mathNodes.ts`, one `MathViews.tsx`, plus `mathEditing.ts` (keys, input rule, paste rule) and `mathCount.ts` | the three nodes share their source helpers and the two views their bubble, error mark and commit logic |
| `escapeLiteralDollars` on each text node | a paragraph-wide pass through a Turndown rule's filter, marking the dollars that would pair with a private-use sentinel the composed escaper turns into `\$` | a dollar pairs across text nodes and marks (`$5 and **$10**`), which a per-node escaper can't see |
| `mathml2omml`'s output used as is | the wrapper fixes stretchy fences (`m:d`), large-operator operands, upright function names, double-struck and other alphabets, `mtext` edge spaces, `\lvert`, and `m:argPr`/`m:sty`/`w:rPr` order | A4: the converter alone looks wrong in 16 of 40 formulas and loses text in one |
| (not in the plan) | the status bar counts equations ("65 words · 5 equations") | experience 38's frame 1 draws it |
| Equation in the block menu | inserted as a new paragraph after the block, then opened | the block menu acts on a block, which an equation never replaces |
| An icon in `ui/Icon.tsx` | Phosphor's `Function` (ƒ) as `'function'` | the menus' icons are Phosphor's; ƒ is its formula mark |
| Picture height from KaTeX's box | from the parts' struts (the TeX height and depth); across, from the box and its parts | KaTeX's box is a line box taller than the formula; it opened every PDF line holding an equation by about 2 pt (A3) |
| `.katex-display` spacing from KaTeX | the block's margins outside its box (`display: flow-root`), KaTeX's margin zero inside | the open block's focus ring otherwise stopped short of the equation |
