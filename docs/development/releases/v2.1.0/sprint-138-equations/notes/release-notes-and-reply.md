# Release-notes lines and the public reply (E4, E6)

Drafts for release day. The reply is posted only with Jarmo's word.

## Lines for 2.1's release notes (equations lead)

**Equations.** Formulas from ChatGPT, Claude or your own hand, written as LaTeX between dollar signs, now show as typeset math, and your file keeps them exactly as written. Click one to change it, with the result shown as you type. Type `$…$`, or `$$` and Enter, or choose Equation from the `/` menu for a new one. A formula Ritemark can't typeset says what's wrong instead of breaking the page.

**Equations in shared copies.** PDF copies typeset them, Word copies get real Word equations you can edit, and Google Docs gets them as pictures.

**Better PDF copies.** Bold, italic and code now come through in paragraphs, lists, quotes and tables.

**Quotes in Google Docs.** Every line of a long quote now lines up under the first, beside a thin bar (#408).

**Known limits.**
- A line holding nothing but `\[draft\]` in a file Ritemark 2.0.1 saved (2.0.1 wrote every literal bracket as `\[` and `\]`) now opens as an equation. Brackets anywhere else in a line stay brackets.
- Word centres an equation that stands alone in a table cell.
- In Google Docs, equations are pictures, and an inline one may sit slightly high in its line.

## Reply for jarmo-productory/ritemark-public#2

> Equations are in Ritemark 2.1. Write LaTeX between dollar signs, `$E=mc^2$` in a sentence or `$$…$$` on its own lines (ChatGPT's `\(…\)` and `\[…\]` work too), and Ritemark shows it typeset with KaTeX. Your files keep the math exactly as written, so Obsidian, GitHub, Typora and Pandoc read the same formulas. Click a formula to edit its LaTeX with the result shown as you type; PDF copies typeset it, and Word copies get native Word equations. Thanks for asking for it. If anything renders differently from what you expect, a reply here with the LaTeX helps.
