# Sprint 138 Spec — What the AI writes looks right

## Purpose

ChatGPT and Claude write formulas as `$…$` and `$$…$$`. Today Ritemark shows them as raw LaTeX, and worse, one edited word anywhere saves every formula in a form no other tool reads ([research/today.md](research/today.md)). After this sprint the editor typesets them, the file keeps them byte for byte as plain Markdown, a dollar amount in prose stays text, and a PDF, a Word document or a Google Doc made from the document shows typeset math, never raw LaTeX. A quote block published to Google Docs starts at its indent, with a thin border (#408). This is item 3 of the 2.1 shape and the day-one film's subject: an analyst's report with equations.

## Principles

- **The file is the truth.** Math stays plain Markdown that Obsidian, GitHub, Typora and Pandoc read the same way. Opening and saving writes back what was there, byte for byte (the #270 rule).
- **Prose stays prose.** `costs $5 and $10` is never math.
- **An equation is never lost.** Wherever one cannot be typeset, its source shows; nothing drops it silently.
- **Never raw LaTeX in a client's file** (the shape's decision 4). PDF, Word and Google Docs get typeset math.
- **No weight for a document without math** (#107). KaTeX's stylesheet and fonts load only when a document has math.
- **Behaviour first, no new elements.** An equation is edited where it is, as Mermaid's code and diagram already switch in place. Where the Experience lead draws it, the drawing wins and this spec changes first.
- **The same for every AI.** Agents read and write the file's source; nothing here is runtime-specific.

## Requirements

### R1: Math is read from the file

As someone opening a document an AI wrote, I want its formulas recognised as math, and nothing else.

Acceptance criteria:
- **Inline math** is `$…$`: the opening `$` has a non-space character right after it, the closing `$` has a non-space character right before it and no digit right after it, and there is no blank line between them. A `\$` inside does not close it. These are Pandoc's `tex_math_dollars` rules, which #481 calls the CommonMark math rules and which GitHub and Obsidian follow closely (inferred).
- **Display math** is `$$…$$`, with no blank line inside. Spaces and line breaks may sit between the delimiters and the formula.
  - On lines of its own, set off from a paragraph by a blank line or starting the block, it is an equation block.
  - Inside a paragraph (no blank line before it), it is display math within that paragraph, shown centred on its own line.
- **ChatGPT's delimiters:** `\(…\)` is inline math and `\[…\]` display math, by the same two placements (recommended in this plan; decision for Jarmo 3).
  - *Changed 26 October, on Sprint 137's corpus:* `\[…\]` is display math only on lines of its own (`\[` opening a line, `\]` closing one), as ChatGPT writes it. In running text it stays text, because Ritemark 2.0.1 and earlier saved every literal bracket as `\[` and `\]`: "See \[1\] and \[draft\]." in a file 2.0.1 saved is a sentence with two references, and 137's one-time cleanup writes it back as `[1]` and `[draft]`.
- **Not math:** anything inside a code span, a fenced or indented code block, an HTML comment or a link's address; `costs $5 and $10`; `$20,000 and $30,000`; `$HOME and $PATH`; a lone `$`.
- **`\$`** in the file is a literal dollar sign, shown as `$`.
- Math can sit in paragraphs, headings, list items, quotes and table cells; an equation block can sit at the top level, in a list item and in a quote.

### R2: Math is written back as it was

As someone who keeps files in git or opens them in Obsidian, I want a save to leave every formula I did not change exactly as it was.

Acceptance criteria:
- Opening a document with math and saving it, untouched or edited elsewhere, writes every equation back byte for byte: its delimiters, the spaces and line breaks inside them, and its LaTeX. Backslashes, `_`, `*`, `\{`, `\,`, `\%` and `\\` are never escaped, doubled or dropped.
- An edited equation keeps its delimiters (`$`, `$$`, `\(`, `\[`) and its line form (a block written on its own lines stays on its own lines). Inline `$` math is trimmed of spaces just inside its delimiters, so it reads as math again; a bare `$` typed inside it is written `\$`.
- **Literal dollars:** a `\$` in the file stays `\$`. A `$` typed as text stays as it is, unless it would pair up with another and read as math on reopening; then both of the pair are written `\$`. So `$5` and `costs $5 and $10` are written as they are, and what the editor shows is what reopening shows.
- These cases join the round-trip corpus Sprint 137 builds for #270, and the corpus holds math in paragraphs (with single line breaks), headings, lists, quotes and tables. Math inside a list item or a paragraph with soft line breaks is byte for byte once Sprint 137's list and soft-break fixes are in (Depends on, in [sprint-plan.md](sprint-plan.md)).
- A document without math saves exactly as it does today.

### R3: Typeset in the editor

As someone reading a document with math, I want to see the formulas as formulas.

Acceptance criteria:
- Inline math is typeset in the line, at the text's size; display math is centred on its own line, as KaTeX's display style.
- The typesetter is KaTeX 0.16.47, the copy already in `webview.js` through Mermaid ([research/fonts-and-bundle.md](research/fonts-and-bundle.md)), with `trust` off and KaTeX's limits on macro expansion and size.
- Math draws in Ritemark Light and Ritemark Dark in the text's own colour, readable at 4.5:1.
- A screen reader reads each equation from KaTeX's MathML, which sits beside its HTML, within its sentence; the visual glyphs are hidden from it. What VoiceOver says is recorded (S16).
- Showing math never changes the file, and never marks the document as changed.
- A document without math loads no KaTeX stylesheet or font. The first equation shown loads them once for that view.
- If KaTeX's stylesheet cannot load, every equation shows as its source in the code style, never as unstyled glyphs.

### R4: Editing an equation where it is

As someone fixing a formula, I want to change its LaTeX in place and see it typeset again when I leave.

Acceptance criteria:
- A click on an equation, or Enter while it is selected, shows its source in place:
  - inline: the LaTeX in the code style between muted delimiters, with the cursor in it;
  - a block: the LaTeX in a field the width of the text, with the typeset result below it, updated as the person types, as Mermaid's code and diagram switch today.
- Leaving it (a click elsewhere, Escape, Tab, or an arrow key out of an inline equation; Escape or a click elsewhere for a block, where Enter makes a new line) typesets it again. The change is one undo step.
- Emptying the source and leaving removes the equation.
- Moving the cursor with the arrows passes an inline equation as one character; Backspace beside it selects it first, then deletes it.
- Pointing at an equation shows the pointer, as for anything clickable (the global rule).
- The look is the Experience lead's to draw (decision for Jarmo 6); until then the behaviour above, with Ritemark's existing tokens and no new toolbar, panel or menu.

### R5: Writing a new equation

As someone writing, I want to type a formula the way I would in any Markdown editor.

Acceptance criteria:
- Typing the closing `$` of a valid inline `$…$` (R1's rules) turns it into an equation. Typing `costs $5 and $` never does. Undo straight after turns it back into the typed text, which then saves as `\$…\$` (R2).
- `$$` and Enter in an empty paragraph makes an equation block, open for editing.
- The slash menu and the block menu offer **Equation**, which makes an equation block, open for editing (`blockItems.ts`).

### R6: A typo shows the source, quietly

As someone whose AI wrote a formula KaTeX cannot read, I want to see what is there and what is wrong, and keep my document.

Acceptance criteria:
- An equation KaTeX cannot typeset shows its source in the code style, with a small warning mark. Pointing at the mark shows a tooltip (`ui/tooltip.tsx`) with one plain sentence, for example: "Ritemark can't typeset this: \foo isn't a command it knows."
- The rest of the document is unaffected, and the source is saved as it is.
- Fixing the source typesets it at once.

### R7: Copy, paste and the AI

As someone who moves text between Ritemark, a chat and other apps, I want equations to travel as their source, and pasted ones to arrive as equations.

Acceptance criteria:
- The selection the AI's sheet receives, and a comment's captured text, contain each equation's source with its delimiters (`$\bar{x}$`), for Claude, ChatGPT and OpenCode alike.
- Copy as Markdown, and the plain text of a copied selection, carry the source with delimiters.
- Copying and pasting within Ritemark keeps equations as equations.
- **Pasting rendered math** from ChatGPT's or Claude's pages, or any page that uses KaTeX or MathML with a TeX annotation, makes equations from the source those pages carry (recommended in this plan; decision for Jarmo 4).
- Pasting plain text with `$…$` in a paragraph makes inline equations, by R1's rules.

### R8: PDF

As someone sending a PDF, I want the math typeset, with KaTeX's look.

Acceptance criteria:
- Inline math sits in its line on the text's baseline; display math is centred on its own lines; both in paragraphs, headings, list items, quotes and table cells.
- The equations use KaTeX's fonts and are sharp when the PDF is printed or zoomed to 200%.
- An equation wider than the text column is scaled down to fit; it is never cut off.
- No raw LaTeX appears, except for an equation with a typo (R6), handled as decision for Jarmo 5 says.

### R9: Word

As someone sending a Word document, I want equations Word knows as equations.

Acceptance criteria:
- Each equation is a native Word equation (OMML): inline in its sentence, display centred on its own line, editable in Word's equation editor. The converter is `mathml2omml` (decision for Jarmo 1), from the MathML KaTeX writes ([research/word-equations.md](research/word-equations.md)).
- An equation that cannot be converted is a picture of the typeset equation, inline at its text size or centred for display. One such equation never stops the export.
- No raw LaTeX appears, except for an equation with a typo (R6), as decision for Jarmo 5 says. Math in a table's header row is an equation too (today that row is taken from plain text).
- The file opens with no repair prompt in Word for Mac and Word for Windows, and its equations show in LibreOffice.
- If audit A4 fails, every equation is a picture, and the sprint plan records it (the "otherwise" of the shape's decision 4).

### R10: Google Docs

As someone publishing to Google Docs, I want my client to see equations, not LaTeX (decision for Jarmo 2).

Acceptance criteria:
- An equation block is a picture of the typeset equation on its own centred line, published the way a Mermaid diagram is today.
- Inline math is an inline picture in its sentence, at the text's size (audit A5).
- Math in a table cell is published as its source text, and the publish result says so in one sentence. (Known limit: Ritemark fills table cells as text.)
- Sync skips an unchanged document as before: the change check counts each equation's source, not its picture's bytes.
- The pictures travel the existing route (`imageStaging.ts`); one that cannot be placed is named in the result, never dropped silently.
- **First to cut** in this sprint: if cut, every equation is published as its source and the result says so.

### R11: Quote blocks in Google Docs (#408)

As someone publishing a document with a quote, I want the quote to look like a quote.

Acceptance criteria:
- Every line of a quote paragraph, the first included, starts at the quote's indent (18 pt per level): `indentFirstLine` equals `indentStart`, both in the request's `fields`.
- The left border is a thin line, 0.5 pt, in the existing grey, with its 6 pt padding kept if it reads well at that width (checked in a real Doc).
- Single, multi-paragraph and nested quotes, and a quote containing a list, are covered in `mapper.test.ts` and checked in a published Doc.
- A Doc already published changes on its next Sync.

### R12: PDF text keeps its bold, italic and code

As someone sending a PDF, I want it to keep the emphasis the help promises.

Acceptance criteria:
- Paragraphs, headings, list items, quotes and table cells in a PDF keep bold, italic and inline code, as `docs/user/features/export.md` says ("Bold/Italic: Preserved"). Today the exporter flattens them to plain text ([research/today.md](research/today.md)).
- This comes from the one inline layout R8 needs, so text and math are laid out together (the adjacent-fix rule). If it is cut, the layout handles math only and text keeps today's look.

### R13: The weight, and how it reaches people

As Ritemark's team, we want math to cost almost nothing for documents without it, and to know exactly how it ships.

Acceptance criteria:
- `webview.js` grows by at most 40 KB, measured before and after (#107), and holds exactly one KaTeX, at the version `media/katex/` was copied from (a build check).
- `media/katex/` holds KaTeX's stylesheet (rewritten to name only woff2), its 20 woff2 faces and its licence, copied by the webview build from the pinned package. Nothing from it is inlined into a bundle.
- `mathml2omml` is a dependency of the extension, kept out of `out/extension.js` (esbuild `external`), unmodified, with its licence in the notices.
- **Release tier: shell.** The fonts, the stylesheet and the external module reach people only with an app release, and `scripts/validate-build-output.sh` checks they are in the built app. They ship in 2.1.0 (the shape's decision 1).
- An extension release that would carry the math code without these files is caught by `release-extension-preflight.sh`, and R3's last criterion keeps such an app safe.

### R14: Nothing lost

As someone updating to 2.1, I want everything I had to work as before.

Acceptance criteria:
- Documents without math open, show and save exactly as in 2.0.1.
- Mermaid diagrams, including Mermaid's own math in labels, render as before.
- Comments, the task board's card pages, tables, images, Export, Copy as Markdown and Google Docs work as before on documents with and without math.
- Everything here works on Windows as on the Mac (S-numbers marked *Windows* in [scenarios.md](scenarios.md)).
- No feature is removed or stubbed (HARD RULE #1).

## Engineering requirements

- **E1, tests.** Unit tests for R1's rules (including every "not math" case), the Turndown rules and the dollar escaper (R2), the round-trip corpus (R2), the PDF inline layout (R8, R12), the Word wrapper with its fallback (R9), and the Google Docs mapper for math and quotes (R10, R11). All in the `test` chain of `extensions/ritemark/package.json`.
- **E2, the bundle.** `webview.js` and `out/extension.js` sizes recorded before and after in `notes/bundle.md`; the one-KaTeX check runs in the build.
- **E3, the film.** An analyst's report with equations (`extensions/ritemark/webview/src/extensions/math/fixtures/analyst-report.md`: inline and display math, a table and a list with math, a quote) opens, edits and saves byte for byte, and exports to PDF and Word that look right in Preview, Acrobat, Word for Mac and Word for Windows. Before the day-one film is captured, the film's own document is checked the same way on the release candidate.
- **E4, docs.** `docs/user/features/` (formatting or blocks, export, google-docs, keyboard shortcuts), `docs/development/architecture.md` (the editor's math nodes, the export path, the external), `docs/CHANGELOG.md`, and lines for 2.1's release notes.
- **E5, the production build.** After the merge, a production build from a clean-room worktree at the merged commit: `media/katex/` and `mathml2omml` in the app, a Word export with native equations from the packaged app, and the drift check.
- **E6, the public promise.** A reply for jarmo-productory/ritemark-public#2 drafted for release day; it is posted with Jarmo's word.

## Non-Requirements

- Math in the AI's sheet (chat answers): the sheet's renderer is a separate surface (decision for Jarmo 7; recommended: a later issue).
- GitHub's ` ```math ` fences; `\newcommand` shared across equations; mhchem's `\ce{}`; equation numbers and references across a document.
- Native equations in Google Docs: the Docs API cannot create them.
- Vector math in the PDF (pictures at 4× here; MathJax's SVG later is possible).
- Word equations into Markdown (Save as Markdown from a .docx); Ritemark's own Word preview drawing exported equations well; MathML on the clipboard for pasting into Word.
- Search and spell check inside equations.
- Other backslash escapes (the #270 class, Sprint 137's ground).
- The PDF's other gaps found in the help (task checkboxes, header, page numbers): an issue to file.
- New usage-data events.
- TipTap 3 (#243). The nodes here follow TipTap 3's own Mathematics model, so that upgrade keeps them.

## Resolved Questions

Decided in this plan (engineering, 26 October 2026); each is open to Jarmo's override at approval.

- **Nodes, not decorations.** An inline node and a block node, with the LaTeX and its delimiters as attributes. TipTap 2's Mathematics extension (2.27, MIT) decorates plain text, so its LaTeX would still pass through Turndown's escaping on save (inferred from its 2.x design); TipTap 3's uses nodes, as here.
- **KaTeX, the copy already in the bundle,** pinned to 0.16.47, imported the way Mermaid imports it.
- **KaTeX's fonts need the shell release.** Files in `media/katex/`, loaded only with math, in 2.1.0 ([research/fonts-and-bundle.md](research/fonts-and-bundle.md)).
- **Pictures of equations are made in the webview** with KaTeX's fonts (plan A); MathJax 4 from draw.io's copy is plan B (audit A3).
- **MathML is made in the webview, OMML in the host,** so the host carries no KaTeX.
- **`\$` is kept** by a small inline node that shows `$` and saves `\$`, so a dollar escaped in the file is never rewritten.
- **No feature flag.** Reading math is what keeps formulas safe on save; a switch that turned it off would bring back today's damage.

## Open Questions

The seven decisions for Jarmo are in [sprint-plan.md](sprint-plan.md#decisions-for-jarmo), with a recommendation each.
