# Equations in Word: the free options

Decision 4 of the 2.1 shape (approved 21 October): native Word equations if a free converter does it simply, an image otherwise, and never raw LaTeX in a client's file. Desk research on 2026-10-26, from the npm registry, the packages' repositories and the docx 8.5.0 build in `extensions/ritemark/node_modules`. Nothing was installed or run; audit A4 is the spike that proves the choice.

## What Word needs

A native Word equation is Office Math Markup (OMML, `m:oMath`) inside a paragraph, or `m:oMathPara` for a display equation on its own line. Word, LibreOffice and Google Docs' .docx import all read OMML; Pages reads it as an equation or a picture (to check in A4).

Ritemark already has the two ends:
- **LaTeX to MathML:** KaTeX, which is in `webview.js` already (see [fonts-and-bundle.md](fonts-and-bundle.md)), writes MathML with `output: 'mathml'`. The webview can put each equation's MathML into the export HTML, so the host needs no KaTeX.
- **OMML into a .docx:** docx 8.5.0 exports `ImportedXmlComponent.fromXmlString(xml)` and `XmlComponent` at the package root, so ready OMML can be placed in a paragraph next to `TextRun`s. Its document root already declares the `m:` namespace, because docx has its own `Math` classes.

The missing middle is MathML to OMML.

## The options

| Option | Licence | What it takes | What it covers | Verdict |
|---|---|---|---|---|
| **`mathml2omml` 0.5.0** (Fidus Writer, Johannes Wilm; updated March 2025) | LGPL-3.0-or-later | One call, `mml2omml(mathml)`, returns an `m:oMath` string. Pure JavaScript, no runtime dependencies, ESM only, 10 files, 617 KB unpacked. Its own small XML parser (MIT, from html-parse-stringify) | Written as Microsoft's MML2OMML mapping without XSLT, so it aims at what Word does with MathML itself. Used in Fidus Writer's own Word export | **Recommended**, after A4 |
| `latex-to-omml` 2.1.1 | MIT itself, but depends on `mathml2omml` and `mathjax-node` | MathJax 2 for Node plus xmldom, to do what KaTeX already does here | The same converter underneath | No: the same LGPL core, plus an old MathJax |
| `@hungknguyen/docx-math-converter` 1.1.4 | ISC; depends on a fork of `mathml2omml`, `jsdom` and `mathjax` 3 | jsdom in the extension host | — | No: heavy, and the same core |
| docx 8.5.0's own `Math` classes | MIT, already ours | Our own mapper from MathML to docx objects | Fractions, scripts, radicals, sums, integrals, functions and four bracket kinds. **No** accents (`\bar{x}`, `\hat{\beta}`), matrices, `cases`, aligned rows, limits under (`\lim`, `\max_x`) or custom fences (`\lvert x\rvert`) | No: an analyst's report needs `\bar{x}` and `\hat{\beta}` on page one |
| Our own MathML to OMML mapper | MIT (ours) | About 400 lines and their tests, kept by us. OMML is a small vocabulary: `m:r`, `m:f`, `m:sSup`/`m:sSub`/`m:sSubSup`, `m:rad`, `m:nary`, `m:d`, `m:acc`, `m:bar`, `m:limLow`/`m:limUpp`, `m:func`, `m:m`, `m:eqArr`, `m:groupChr` | What we write; anything unknown falls back to an image | The fallback if the LGPL is refused |
| Microsoft's `MML2OMML.XSL` | Microsoft's, installed with Office | An XSLT processor in the host, and Office on the computer | Everything Word does | No: not ours to ship, no XSLT in Node, missing wherever Office is |
| Pandoc | GPL-2.0, a separate binary | A 100+ MB binary to bundle | Full | No |
| An image per equation | — | The PNG the PDF path makes anyway | Everything KaTeX typesets | The fallback (the shape's decision 4), per equation |

## The recommendation

**`mathml2omml`, behind our own small wrapper, with an image fallback for each equation it cannot convert.**

- **Simple:** the webview already has the MathML; the host calls one function per equation and places the string. The wrapper strips KaTeX's `<annotation>`, wraps display equations in `m:oMathPara` (centred), and checks the result is well-formed XML with an `m:oMath` root. Anything else, or a thrown error, uses that equation's image, so one bad equation never stops an export and never shows as LaTeX.
- **Free:** LGPL-3.0-or-later is free software. What it asks of an MIT app like Ritemark, in short (this is the plan's reading, not legal advice):
  - ship it **unmodified as its own module** that the app loads at run time, in the bundled extension's `node_modules`, kept out of the esbuild bundle (`external`). This is the "suitable shared library mechanism" of LGPL-3.0 §4(d)(1): a person can replace that file;
  - ship its licence text, with the GPL text it builds on, and name it in the third-party notices;
  - if Ritemark ever changes it, publish the changed source under the LGPL.
  Ritemark's own code stays MIT. Jarmo decides whether an LGPL module is acceptable; the plan asks.
- **Delivery:** an esbuild external lives in `node_modules`, which reaches people only with a shell release. 2.1.0 is a shell release (the shape's decision 1). It is ESM only, so it loads through the same `new Function('return import(...)')` route as the two agent SDKs, and `scripts/check-bundled-extension-complete.sh` already checks every external is in the bundled extension.

**If Jarmo says no to the LGPL:** our own mapper (MIT), the table's fifth row, with the same image fallback. More code, ours to keep.

**If A4 fails** (below): images only, the "otherwise" of the shape's decision 4, and the sprint says so.

## Audit A4: the spike before any Word code

1. A corpus of 40 formulas an analyst, a technical writer or a trainer writes, taken from real ChatGPT and Claude answers: the mean and `\bar{x}`, standard deviation, `\hat{\beta}` regression, compound growth, NPV with `\sum`, elasticity, a `\frac` inside a `\sqrt`, `\begin{cases}`, a 2×2 `pmatrix`, `aligned`, `\lim`, `\max_x`, `\lvert x\rvert`, `\mathbb{E}`, `\text{}`, `\le`, `\approx`, `\cdot`, `\%`.
2. KaTeX 0.16.47 MathML for each, then `mathml2omml`, then into a .docx through docx 8.5.0's `ImportedXmlComponent`, inline in a sentence and as display.
3. Open the file in Word for Mac, Word for Windows (through the Development manager's Windows session), LibreOffice and Pages, and import it into Google Docs.
4. **Pass:** Word opens it with no repair prompt; at least 38 of the 40 look right by eye in Word on both systems; the other two convert or fall back to their image cleanly; LibreOffice shows them as equations. Record the result per formula in `research/word-equations-audit.md`.
5. **Fail:** Word repairs the file, or more than two formulas come out wrong. Then the next step is the own mapper (if the LGPL was the only problem) or images only, decided with Jarmo.

## Later, not in this sprint

- **Copy from Ritemark, paste into Word:** Word turns pasted MathML into equations. Putting MathML on the clipboard is a separate change.
- **Word to Markdown:** Save as Markdown from a .docx (mammoth) drops OMML today. `omml2mathml` (Apache-2.0) and KaTeX's reverse do not exist as one step; it needs its own look.
