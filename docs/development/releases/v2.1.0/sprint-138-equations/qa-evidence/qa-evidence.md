# Sprint 138 QA evidence

Walked on 26 October 2026 on a dev instance of the sprint branch on the Mac (Apple Silicon): its own short profile under `$TMPDIR`, CDP port 9233, the mock keychain, the test build channel, analytics off. The test project is "Leadership programme" with the drawing's report and the fixtures. The AI's sheet shows "Claude is signed out" in every screenshot because the test profile has no sign-in; that is the profile, not this sprint.

## Screenshots

02, 03, 04, 05, 07 and 08 were re-taken after the Experience lead's check of experience 38 (the selection chip and the inline typo's wrapping); 14 is new.

| File | What it shows | Experience 38 frame |
|---|---|---|
| [01-typeset-light.png](01-typeset-light.png) | The report typeset: inline equations at the text's size, two display equations centred; the status bar's "65 words · 5 equations" | 1 |
| [02-inline-open-light.png](02-inline-open-light.png) | An inline equation open: its LaTeX in place with faint delimiters, the result bubble under it. Opening it by a click puts no "Working on selected text" chip in the AI's sheet, as a click into text doesn't | 2 |
| [03-block-open-light.png](03-block-open-light.png) | A block open: "Equation · LaTeX", "Esc to finish", the field, the result under it changing as typed | 3 |
| [04-typos-light.png](04-typos-light.png) | A block typo (`\fracc`) and two inline typos, each its source with the amber mark; the good equation above typesets. An inline typo and its mark are one unit on the line: `\fracc{a}{b}` moves to the next line whole, rather than breaking after `{a}` | 4 |
| [05-typo-tooltip.png](05-typo-tooltip.png) | The mark's tooltip: "Ritemark can't typeset this: `\fracc` isn't a command it knows." (cropped from the first walk; the block and its tooltip are unchanged) | 4 |
| [06-new-block-empty.png](06-new-block-empty.png) | A new equation from the `/` menu: the placeholder "For example \frac{a}{b}" and "The equation shows here as you type." The paragraph split above it comes from the scripted test's click landing mid-sentence before it typed a new paragraph, not from the equation | 5 |
| [07-inline-open-dark.png](07-inline-open-dark.png) | Frame 2 in Dark | 2 |
| [08-block-open-dark.png](08-block-open-dark.png) | Frame 3 in Dark | 3 |
| [09-pdf-page.png](09-pdf-page.png) | The report as a PDF (Quick Look): inline equations on the baseline, display equations centred, bold table header, the quote with its bar, `$12,000` and `$250` as text | — |
| [10-pdf-table-and-list.png](10-pdf-table-and-list.png) | The PDF at 4×: table cells' first lines aligned whether or not they hold an equation; a list with equations | — |
| [11-word-mac.png](11-word-mac.png) | The report's Word copy in Word for Mac (saved as PDF by Word): native equations, inline and display. A lone equation in a table cell is centred by Word | — |
| [12-word-mac-typos.png](12-word-mac-typos.png) | The typo report's Word copy: the good equation native, the typos as their source in the code font | — |
| [13-word-mac-wide-equation.png](13-word-mac-wide-equation.png) | A sum wider than the page: Word breaks the equation over two lines; bold, italic and code in a paragraph, a list and a table | — |
| [14-selection-chip.png](14-selection-chip.png) | A Shift-arrow selection across an equation: the chip reads "from $\bar{x}_1 = 3.1$ to", the source with its delimiters (R7). Inside the selection, the browser's highlight paints over part of the typeset equation | — |

The Word audit's evidence (40 formulas, the wrapper against the converter alone) is in [../research/evidence/](../research/evidence/).

## Scenarios

| Scenario | Result | How |
|---|---|---|
| S1 inline and display typeset | pass | dev instance (01) |
| S2 dollar amounts stay text | pass | dev instance and `prose-dollars.md` byte for byte |
| S3 not inside code; S4 ChatGPT's delimiters; S5 display math in a paragraph; S6 an escaped dollar; S7 math in lists, quotes, tables, headings | pass | `mathSyntax.test.ts`, `mathRoundTrip.test.ts`; the report shows S7's table, list and quote |
| S8 open and save untouched; S9 an edit elsewhere | pass for every equation; the list lines are Sprint 137's | `mathRoundTrip.test.ts`; dev instance diff ([A1](../research/editor-roundtrip-audit.md)) |
| S10 every delimiter form | pass | `forms.md` byte for byte |
| S11 editing one equation | pass | dev instance: only its lines saved; one ⌘Z restores the file byte for byte |
| S12 an inline edit stays math; S13 literal dollars; S14 a document without math | pass | unit tests; S13 also in the dev instance |
| S15 Dark and Light | pass | 01–08 |
| S16 a screen reader | partly: KaTeX's MathML is in the DOM and its HTML is `aria-hidden`; VoiceOver not run | dev instance DOM |
| S17 nothing loaded without math | pass | dev instance: no KaTeX request for `plain.md` |
| S18 showing math is not an edit | pass | the bar stays "Saved" on open |
| S19 the stylesheet missing | pass | dev instance: 12 equations show their sources |
| S20–S23 editing in place, emptying, the cursor passing | pass | dev instance (02, 03, 07, 08) |
| S24 typing `$…$`; S25 `$$` and Enter, `/` menu, block menu | pass | dev instance (06) |
| S26 an unknown command | pass | dev instance (04, 05) |
| S27 the AI sees the source | at the source: a dragged or Shift-arrow selection carries the LaTeX with delimiters (14); opening an equation by a click or Enter sends no selection (02, 03); not traced through Claude, ChatGPT and OpenCode, because the test profile has no sign-in | dev instance; `mathRoundTrip.test.ts` |
| S28 a comment on an equation | not run | — |
| S29 Copy as Markdown | pass: the clipboard equals the file (bar its final newline), `$…$` included; with an equation open, Copy as Markdown now takes the whole document, as with a cursor in text (the same rule in `getSelectionHTML`; not clicked through) | dev instance |
| S30 paste from ChatGPT's and Claude's pages; S31 plain text with math | pass with synthetic paste events carrying KaTeX's HTML, MathML with a TeX annotation, and plain `$…$`; not pasted from the live sites | dev instance |
| S32 the report as PDF; S33 a wide equation; S34 bold, italic and code; S35 a typo at export | pass on the Mac; the message reads "3 equations couldn't be typeset and show as their source." | dev instance (09, 10) |
| S36 the report as Word | pass in Word for Mac; Word for Windows not run | (11–13) |
| S37 an equation Word can't take | pass in unit tests (picture fallback) | `mathToWord.test.ts` |
| S38 other readers | Word for Mac only; LibreOffice, Pages and a Google Docs import not run | [A4](../research/word-equations-audit.md) |
| S39–S41 Google Docs | not run: no test account; unit tests only | [A5](../research/google-docs-audit.md) |
| S42 the bundle | pass: +36.6 KB, one KaTeX | [notes/bundle.md](../notes/bundle.md) |
| S43 the production build | not run: after the merge, from a clean-room worktree | — |
| S44 Mermaid | pass in the editor and the PDF: the diagram renders. Math in a Mermaid label shows its `$$…$$` source, because Ritemark draws Mermaid with `htmlLabels: false` (unchanged by this sprint); not compared side by side with 2.0.1 | dev instance |
| S45 the 2.0.1 regression set; S46 before the film | not run | Windows session and the release candidate |

The full `npm test` chain and `npm run compile` pass; the pre-commit validator passes.
