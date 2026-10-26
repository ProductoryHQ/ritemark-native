# Audit A4: equations in Word through `mathml2omml`

Run on 26 October 2026 on the sprint branch, before any Word export code, as [word-equations.md](word-equations.md) asks. The question: does KaTeX's MathML, through `mathml2omml` 0.5.0 and docx 8.5.0's `ImportedXmlComponent`, give native Word equations that open cleanly and look right?

**Result: pass on Word for Mac, with our wrapper doing four fixes around the converter. The converter alone fails the bar.** The converter ships unmodified; the fixes are ours (`extensions/ritemark/src/export/v2/mathToWord.ts`, MIT).

## The corpus

40 formulas in `extensions/ritemark/src/export/v2/fixtures/mathCorpus.ts`, the list the plan named: the mean and `\bar{x}`, standard deviation, variance with `\mathbb{E}`, `\hat{\beta}` regression and the OLS slope, compound growth, CAGR, NPV with `\sum`, elasticity, `\frac` in `\sqrt`, `cases`, a 2×2 `pmatrix`, `aligned`, `\lim`, `\max_x`, `\lvert x\rvert`, `\text{}`, `\le`, `\approx`, `\cdot`, `\%`, the report's own attrition and margin formulas, an integral, the normal density, `\binom`, a set, a product, derivatives and the logistic function. Each went into one .docx twice, inline in a sentence and as a centred display equation, once through our wrapper (A) and once through the converter alone (B).

## What was run

| Reader | Run | Result |
|---|---|---|
| Word for Mac (16.x, installed) | opened through Launch Services, saved as PDF by AppleScript, the PDF read page by page | **A: 40 of 40 right**, no repair prompt, inline and display. B: opens cleanly too, but 16 of 40 look wrong, and one loses text (below) |
| Well-formedness | `xmllint` on `word/document.xml`; docx's strict XML parser on each equation | well-formed; no schema problem left in A's OMML (checks below) |
| Time | 40 formulas × 2 forms × 2 variants | 45 ms in Node |
| Word for Windows | not run here | through the Development manager's Windows session (S36) |
| LibreOffice | not run: not installed on this Mac, and a 300 MB download for one check | the Windows session, or a later QA run |
| Pages | **not run**: Pages stopped on a first-run dialog before it read the file, so it could not be driven unattended; it was stopped and nothing of it remains | a person opens the S36 file in Pages once |
| Google Docs import | not run: no test Google account in this session | with A5 |

Evidence: [Word for Mac, A, page 1](evidence/a4-word-mac-wrapper-1.png), [A, page 2](evidence/a4-word-mac-wrapper-2.png), [B, the converter alone](evidence/a4-word-mac-converter-alone.png).

## What the converter alone gets wrong (B), and the wrapper's fix

| In Word | Formulas | Cause | The wrapper (A) |
|---|---|---|---|
| Brackets at text height beside a fraction or a matrix | compound growth, CAGR, `cases`, `pmatrix`, limit, `\binom`, variance (7) | `mathml2omml` has no `m:d`; KaTeX's `<mo fence="true">` comes out as a plain character | each fenced `mrow` is converted on its own and put in an `m:d` with its characters; Word stretches it |
| A gap or a dotted box after `∑` and `∫`, the operand after it; the product loses `(1 +` altogether | mean, standard deviation, NPV, expectation, integral, product (6) | only a token or an `mrow` right after the operator becomes its operand, and a run that lands in the empty operand is lost | what follows the operator, up to the next relation sign, is grouped in one `mrow` first |
| `lim`, `max`, `cos` in italic | limit, max, cdot (3) | a multi-letter `mi` is styled like a variable | such an `mi` gets `fontstyle="normal"`, which the converter writes as `m:sty p` |
| `𝔼` as a plain E; upright `Δ` and `∞` as text | variance, expectation, margin (3) | an unknown `mathvariant` becomes `m:nor` with `m:sty m:val="undefined"` | `\mathbb`, `\mathfrak`, `\mathcal`, sans-serif and monospace letters become Unicode's mathematical alphabets; `normal` becomes `fontstyle="normal"` |
| "ifx" for `\text{if } x` | `cases` (1) | its XML parser trims every text node | edge spaces of an `mtext` travel as a private-use character and come back as spaces |
| `∣x∣` spaced like "divides" | absolute value, cdot (2) | KaTeX writes `\lvert` as U+2223 | a non-stretchy U+2223 becomes `|` |
| (not visible) two `m:argPr` in one `m:e`; `w:rPr` before `m:rPr`; `m:sty="undefined"` | `cases`, `aligned`, every styled run | converter output order | removed or reordered after conversion |

Some formulas have several of these: 16 formulas in B look wrong, and the product formula is missing text. Word for Mac tolerated B's schema slips without a repair prompt; they are fixed anyway, because Word for Windows and LibreOffice may be stricter.

## Decision

- **W7 goes ahead with `mathml2omml`** (decision 1, approved), shipped unmodified as an esbuild external, behind the wrapper above. The wrapper's fixes are in `mathToWord.ts` with their reasons, and `mathToWord.test.ts` runs the whole corpus through the real converter on every test run, so a converter upgrade that breaks a formula shows.
- An equation the wrapper still cannot convert, or whose OMML docx's strict parser rejects, is its picture (R9). In this corpus that never happened.
- **Still open for S36:** Word for Windows, LibreOffice, and Pages by hand. If Word for Windows asks to repair, the fallback is pictures for every equation (the shape's decision 4), and the spec changes first.

## Reproducing it

`/private/tmp/…/a4/spike.mts` was a scratch script; its core is now `mathToWord.test.ts`. By hand: KaTeX `renderToString(latex, { output: 'mathml' })`, then `mathmlToOmml(mathml, display, mml2omml)` from `mathToWord.ts`, then `ommlToParagraphChild` into a docx `Paragraph`, then `Packer.toBuffer`.
