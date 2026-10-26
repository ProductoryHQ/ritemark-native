# Sprint 138: What the AI writes looks right

Track: SDD (auto-detected: 14 user-facing requirements across two issues; webview ↔ host ↔ PDF, Word and the Google Docs API)
Override with: "use plain full track"
Branch: `sprint-138-equations`, made from `origin/main` after approval. This plan is on `plan/sprint-138-equations`.
Release tier: shell (`scripts/validate-build-output.sh`; KaTeX's fonts and stylesheet in `media/katex/` and the `mathml2omml` module reach people only with an app release; they ship in 2.1.0)
Status: **Approved (Phase 2 → 3), 26 October 2026,** by the Development manager under Jarmo's delegation. The sprint branch is created before the first code edit.

## SDD Artifacts

- [spec.md](spec.md): the behaviour contract, R1–R14 and E1–E6.
- [scenarios.md](scenarios.md): S1–S46, the manual QA matrix.
- [technical-plan.md](technical-plan.md): what exists today, workstreams W1–W9, audits A1–A6.
- [tasks.md](tasks.md): the implementation checklist by phase.
- Research: [today.md](research/today.md) (the code, and a probe of what a save does to math today), [word-equations.md](research/word-equations.md) (the free options), [fonts-and-bundle.md](research/fonts-and-bundle.md) (KaTeX, the bundle, the fonts).
- This file: intent, decisions, status.

The release is 2.1.0. Its shape is in `ritemark-dev`: `releases/v2.1.0/shape.md`, approved by Jarmo on 21 October with all eight recommendations; this sprint is its item 3. There is no `docs/development/releases/v2.1.0/release-plan.md` on this branch yet; the Development manager keeps the release's tracker.

## Goal

Formulas that ChatGPT and Claude write as `$…$` and `$$…$$` are typeset in the editor and stay plain Markdown in the file, byte for byte; a dollar amount in prose stays text; a PDF, a Word document and a Google Doc made from the document show typeset math, never raw LaTeX; and a quote published to Google Docs starts at its indent, with a thin border.

## Linked Issues

- [#481](https://github.com/ProductoryHQ/ritemark-native/issues/481): equations in documents. Promised in public (jarmo-productory/ritemark-public#2) for "the first update after 2.0"; **cannot be cut.**
- [#408](https://github.com/ProductoryHQ/ritemark-native/issues/408): Google Docs quote blocks (R11).
- [#107](https://github.com/ProductoryHQ/ritemark-native/issues/107): watched; the bundle is measured before and after (R13, E2).
- [#270](https://github.com/ProductoryHQ/ritemark-native/issues/270): Sprint 137's; this sprint's math joins its corpus (R2).
- [#243](https://github.com/ProductoryHQ/ritemark-native/issues/243): TipTap 3, not here; the math nodes follow its model.

## What a save does to math today

Before this sprint, one edited word saves every formula in a document in a form no other tool reads: backslashes doubled, `\{`, `\,` and `\%` losing theirs, `_` escaped, `\(x\)` turned into `(x)` ([research/today.md](research/today.md), a probe of the editor's own `marked` and Turndown options; audit A1 confirms it in the real editor). So R1 and R2, reading math and writing it back untouched, are the floor under the typesetting, and they come first.

## MVP Scope

| Area | Requirements |
|---|---|
| Reading `$…$`, `$$…$$` (and ChatGPT's `\(…\)`, `\[…\]`); dollar amounts stay text; `\$` | R1 |
| Writing every equation back byte for byte; edited ones keep their form; literal dollars | R2 |
| Typesetting with the KaTeX already in the bundle; stylesheet and fonts only with math | R3 |
| Editing in place; writing new ones (`$…$`, `$$` + Enter, Equation in the menus) | R4, R5 |
| A typo shows the source, quietly | R6 |
| The AI, comments, copy and paste see and carry the source; pasted rendered math becomes equations | R7 |
| PDF with typeset math | R8 |
| Word with native equations, a picture where one can't convert | R9 |
| Google Docs with equations as pictures | R10 |
| Google Docs quotes (#408) | R11 |
| PDF text keeps bold, italic and code (the adjacent fix) | R12 |
| Weight and delivery | R13 |
| Nothing lost; Windows | R14 |
| Tests, the bundle, the film, docs, the production build, the public reply | E1–E6 |

**Not in this sprint:** math in the AI's sheet (decision 7 below), ` ```math ` fences, shared `\newcommand`s, mhchem, equation numbering across a document, vector math in the PDF, Word equations into Markdown, Ritemark's Word preview drawing equations, MathML on the clipboard, other backslash escapes (#270's ground), new usage data, TipTap 3. The spec's *Non-Requirements* has the reasons.

## The day-one film

The film is an analyst's report with equations: raw `$…$` in Word, then typeset in Ritemark, in the PDF and in Word. It rests on R8 and R9 being right, KaTeX's fonts included. So:
- `analyst-report.md` (a fixture: inline and display math, a table and a list with math, a quote) runs through every scenario from the first build;
- S32 and S36 check its PDF and Word output on the Mac and on Windows;
- **S46:** before the film is captured, the film's own document is opened, edited, saved and exported on the release candidate, on both systems, and only then is it filmed.

## Cut order

The shape: "If the appetite runs out, cut from the bottom: #408 first". Inside this sprint:
1. **R10, equations in Google Docs** first: they are not in the shape's promise. If cut, equations are published as their source and the result says so.
2. **R11, #408**, as the shape says.
3. **R12, PDF bold and italic:** the layout then handles math only.

R1–R9, R13 and R14 are #481's core and are not cut.

## KaTeX's fonts need a shell release

Yes ([research/fonts-and-bundle.md](research/fonts-and-bundle.md)).
- KaTeX's **code** is already in `webview.js`, through Mermaid (0.16.47). The editor imports that same copy, pinned, so typesetting adds no KaTeX code.
- Its **stylesheet and 20 woff2 faces** (about 320 KB) become files in `media/katex/`, loaded only when a document has math. Inlined into `webview.js` instead, they would add 400 KB at least, or about 1.5 MB through the build's font inlining, to every view (#107).
- An extension release ships only the JavaScript bundles and `package.json`, so these files reach people with the **2.1.0 shell release**, which the shape's decision 1 already makes. `validate-build-output.sh` checks them in the built app. If they are missing, equations show as their source, never as broken glyphs.

## Equations in Word: the choice

**`mathml2omml`** (LGPL-3.0-or-later, pure JavaScript, no dependencies): KaTeX's MathML in, a native Word equation out, one call per equation, after a spike on 40 real formulas (A4). An equation it cannot convert becomes a picture of the typeset equation; LaTeX never appears. The other free options are heavier versions of the same converter, docx's own equation classes (no `\bar{x}`, no `\hat{\beta}`, no matrices), or our own converter; [research/word-equations.md](research/word-equations.md) compares them. The LGPL is decision 1 below.

## Windows

- The *Windows* scenarios (S32, S36, S43, S45) run on a Windows build from the branch through the Development manager's Windows session; Word for Windows is part of A4 and S36.
- After the merge, the 2.1.0 Windows build carries `media/katex/` and the external like the Mac's (S43).

## Tests and the production build

- Unit tests (E1): R1's rules, the round-trip corpus, the escaper, the PDF layout, the Word wrapper, the Google Docs mapper and the change hash.
- CDP checks on a dev instance for the real editor's round trip and the AI's prompts.
- The bundle measured before and after; a build check for one KaTeX (E2).
- After the merge, a production build from a clean-room worktree at the merged commit: `media/katex/` and `mathml2omml` in the app, a Word export from the packaged app, the drift check (E5).

## Product Decisions

- **2026-10-21 (Jarmo, the shape, "kinnitan soovitustega"):** equations in the editor, PDF and Word, plain Markdown in the file, dollar amounts stay text (item 3); one shell release, 2.1.0 (the shape's decision 1); native Word equations if a free converter does it simply, an image otherwise, never raw LaTeX (the shape's decision 4); #481 cannot be cut, #408 is cut first.
- **2026-10-20 (Jarmo):** "promote support for equations!" (#481).
- **2026-10-26 (engineering, in this plan):**
  - reading and writing math come first: today's save damages formulas;
  - nodes, not decorations, as TipTap 3 does;
  - the KaTeX already in the bundle, pinned; its fonts as files in `media/katex/`, shipped in 2.1.0;
  - pictures for export made in the webview with KaTeX's fonts, MathJax 4 from draw.io's copy as plan B;
  - MathML in the webview, OMML in the host;
  - `\$` kept as written;
  - PDF text gets bold, italic and code back through the same layout (the adjacent-fix rule);
  - no feature flag (below).

## Decisions for Jarmo

1. **Word equations through an LGPL converter?** I recommend yes: `mathml2omml` (LGPL-3.0-or-later), shipped unmodified as its own module with its licence, and a picture for any equation it can't convert. LGPL is free software; it asks that the module stay replaceable and that changes to it be published, and Ritemark's own code stays MIT. If no: our own converter (MIT, more code to keep), or pictures only.
2. **Equations in Google Docs?** The shape names the editor, PDF and Word, not Google Docs. I recommend pictures, display and inline, so a client's Doc shows no LaTeX; Google's API cannot make native Docs equations. One known limit: Ritemark fills table cells as plain text, so math in a table cell goes as its source, and the result says so. It is the first thing to cut. If cut, all equations are published as their source and the result says so.
3. **ChatGPT's `\(…\)` and `\[…\]` too?** I recommend yes. ChatGPT writes math that way when its answers are copied (inferred), and today a save turns `\(x\)` into `(x)`. It costs little in the same rules.
4. **Pasted math from ChatGPT's and Claude's pages becomes equations?** I recommend yes. Their pages render math with KaTeX, which keeps each formula's LaTeX beside it (inferred; S30 checks), so a paste can keep the formula; otherwise pasted formulas arrive as garbled text.
5. **An equation with a typo at export?** I recommend the export goes ahead, shows that equation as its source in the code style, and the message after the export says how many couldn't be typeset. Stopping the export would stop the person; hiding the equation would lose it.
6. **The look of editing an equation:** I recommend asking the Experience lead for a short drawing (typeset, editing inline, editing a block, a typo, empty), through the Development manager. The reading, saving and export work doesn't wait for it; the editor's look does, and screenshots go to the Experience lead before the merge.
7. **Math in the AI's sheet?** Answers there show `$…$` raw today. I recommend a later issue, not this sprint. The sheet's renderer is a separate surface with streaming text, and the shape names the editor, PDF and Word.

## Feature Flag Check

No feature flag. Reading math is what keeps formulas safe on save; a switch that turned it off would bring back today's damage. Typesetting is on for everyone (HARD RULE #2), works on both platforms and needs no download. HARD RULE #1 holds: nothing is removed; R14 checks what exists.

## Success Criteria

- [x] `analyst-report.md` and the corpus open and save byte for byte, untouched and with an edit elsewhere (R1, R2). *All math fixtures and 137's corpus with `kept/equations.md` and `kept/equations-in-lists.md`, 47 files*
- [x] Dollar amounts and code stay text; `\$` stays `\$` (R1, R2). *Pandoc's pairing: the first `$` after an opener decides*
- [ ] Equations typeset in Light and Dark, read by VoiceOver; a document without math loads nothing of KaTeX's (R3). *All but VoiceOver, not run (MathML is in the DOM)*
- [x] Equations are edited in place and written with `$…$`, `$$` + Enter and the menus; a typo shows its source quietly (R4–R6).
- [ ] The AI's prompt, a comment, Copy as Markdown and clipboard text carry the source; pasted rendered math becomes equations (R7). *Open: a comment (S28), the three runtimes' prompts and pasting from the live pages*
- [x] The report's PDF has typeset math with KaTeX's look, sharp at 200%, and keeps bold and italic (R8, R12). *On the Mac*
- [ ] The report's Word file opens with no repair prompt on the Mac and Windows, with native equations (R9). *The Mac passes; Windows is open*
- [ ] A published Google Doc shows equations as pictures, and its quotes start at their indent with a thin border (R10, R11). *Open: no Google test account*
- [ ] `webview.js` grows by at most 40 KB with one KaTeX; the production build carries `media/katex/` and `mathml2omml` (R13, E2, E5). *+37.4 KB with one KaTeX; the production build is open (S43)*
- [ ] Documents without math, Mermaid and the 2.0.1 regression set behave as before, on the Mac and Windows (R14).
- [ ] The film's document passes S46 on the release candidate before capture (E3).

## Risks

| Risk | Retirement |
|---|---|
| Math in list items and softly broken paragraphs depends on Sprint 137 | Those corpus cases turn green with 137; merge after 137 |
| Sprint 137 edits the same two editor files | Small, separate additions; rebase on 137 before the PR |
| Export pictures fail in the webview | Audit A3; plan B, MathJax 4 from draw.io's copy |
| The fonts don't load by URL | Audit A2; plan B, the host sends them as `data:` URLs |
| The converter fails or the LGPL is refused | Audit A4 and decision 1 below; our own converter or pictures only |
| A Mermaid upgrade brings a second KaTeX | The build fails on two copies |
| The film's outputs aren't right at capture | S46 on the release candidate |

The full list is in [technical-plan.md](technical-plan.md#risks-inside-the-sprint).

## Depends on

- **Sprint 137 (#270)** for the list and soft-break cases of R2. Everything else stands alone; the PR is rebased on 137 and merged after it.
- **The Experience lead's drawing** for the editing look (decision 6 below), not for the rest.
- **A test Google account** for A5 and S39–S41, and **the Development manager's Windows session** for the *Windows* scenarios and A2 and A4 on Windows.

## Pre-Implementation Gate

- Jarmo's approval of this plan, with his answers to the seven decisions, gates Phase 0.
- Phase 1's audits come before the code they decide. When an audit changes a requirement, `spec.md` changes first.

## Approval

- [x] Approved on 26 October 2026 by the Development manager, under Jarmo's delegation of the same day: "ei sprindiplaanid kinnitad sina. midagi ei tohi minu taga oodata kuni Gate 1 RCini" and "ja muud asjad ka sh worktreede kustutamine" (ritemark-dev `decisions/log.md`, 26 October). Until 2.1's Gate 1 RC, the manager's word counts for plan approval, sprint start and admin merge of 2.1 work. Release approval (Gate 1, Gate 2, publish) stays Jarmo's.

**The plan's questions, decided:**
1. **Word equations:** the LGPL converter is accepted. `mathml2omml` ships unmodified, as its own module outside the bundle, with its licence in the notices. Any equation it can't convert becomes a picture, never LaTeX. The A4 spike (40 formulas in Word for Mac and Windows, LibreOffice and Pages) comes first. If it fails, the fallback is pictures.
2. **Equations in Google Docs:** pictures, both display and inline. Math in a table cell goes as source, and the result says so. This is the first thing to cut.
3. **ChatGPT's `\(…\)` and `\[…\]`** are read too.
4. **Rendered math pasted from ChatGPT's and Claude's pages** becomes equations; S30 checks it.
5. **A typo at export:** the export goes ahead, that equation shows its source in the code style, and the message says how many equations couldn't be typeset.
6. **The editing look** is experience 38, drawn by the Experience lead on 26 October (`ritemark-dev/product/design/experience/experiences/math/`), including the result bubble while inline math is open. Match it exactly.
7. **Math in the AI's sheet:** a later issue, not this sprint.

**Order:** the audits, the Word converter, export, fonts and #408 can start now. The editor's reading and writing of math (R1, R2) is built on Sprint 137's extracted pipeline, after 137 merges.

**Also filed from this plan:**
- #537: the export help promises things the exporters don't do;
- #538: the Word preview's equations.

