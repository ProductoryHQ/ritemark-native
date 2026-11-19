# Sprint 168 tasks

Gate: no code until Jarmo approves the plan, and each PR's branch `sprint-168-quotes-headings-prN` is created before its first edit. Shots on synthetic decks only.

## PR 1: the quote's look, R1 (High), branch `sprint-168-quotes-headings-pr1`, after Sprint 166 PR 5 (#841) merges
- [ ] Issue created in milestone v2.3.0 (manager): to be created
- [ ] Audit: how the attribution line is told apart on every surface
- [ ] The quote's look per the README, with the attribution line
- [ ] Same on the editor, wall, presenter view, strip and page, on dark and on Paper
- [ ] Tests: parity across the renderers; a quote with no attribution; a deck with no quote unchanged
- [ ] Shots: a quote with attribution on dark and on Paper, in the editor and on the wall; the Experience lead's look
- [ ] Release-notes line; PR Risk and How to revert; `REVIEW.md` review

## PR 2: a prompt out of a quote, R2 (High), branch `sprint-168-quotes-headings-pr2`, can start now
- [ ] Issue created in milestone v2.3.0 (manager): to be created
- [ ] Check Sprint 166 PR 8 and Sprint 167 PR 5 for overlap before the first edit
- [ ] Code block inside a quote lifts the paragraphs out, then makes one code block with Copy and ↗
- [ ] An emptied quote goes; the whole change is one undo step
- [ ] Bubble and / menu both; outside a quote unchanged
- [ ] Tests: each scenario in `scenarios.md`, including Undo
- [ ] Shots: the code block taken out of a quote, before and after; the Experience lead's look
- [ ] Release-notes line; PR Risk and How to revert; `REVIEW.md` review

## PR 3: heading levels, R3 (High), branch `sprint-168-quotes-headings-pr3`, after Sprint 164 PR 3 merges
- [ ] Issue created in milestone v2.3.0 (manager): to be created
- [ ] h2 and h3 values in `slide.css`; the title's line keeps its look
- [ ] / menu: Heading 1, 2, 3 with the hidden words; "Title" and "Heading" renamed (no real removal); the bubble unchanged
- [ ] One realistic synthetic deck with an h2 mid-slide checked through the fit
- [ ] Tests: menu entries and keywords; the fit with the larger h2
- [ ] Shots: a slide with h1, h2 and h3 together; the Experience lead's look
- [ ] Release-notes line; PR Risk and How to revert; `REVIEW.md` review

## Sprint end
- [ ] Full test chain once per final head
- [ ] `qa-validator` sign-off
- [ ] `docs/development/architecture.md` updated if structure changed
- [ ] Worktree hygiene report after merge (`node ./scripts/worktree-hygiene.mjs --check`)
