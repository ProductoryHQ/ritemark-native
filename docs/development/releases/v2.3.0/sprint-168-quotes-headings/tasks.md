# Sprint 168 tasks

Gate: no code until Jarmo approves the plan, and each PR's branch `sprint-168-quotes-headings-prN` is created before its first edit. Shots on synthetic decks only.

## PR 1: the quote's look, R1 (High), branch `sprint-168-quotes-headings-pr1`, after Sprint 166 PR 5 (#841) merges
- [x] Issue created in milestone v2.3.0 (manager): #863: to be created
- [ ] Audit: how the attribution line is told apart on every surface
- [ ] The quote's look per the README, with the attribution line
- [ ] Same on the editor, wall, presenter view, strip and page, on dark and on Paper
- [ ] Tests: parity across the renderers; a quote with no attribution; a deck with no quote unchanged
- [ ] Shots: a quote with attribution on dark and on Paper, in the editor and on the wall; the Experience lead's look
- [ ] Release-notes line; PR Risk and How to revert; `REVIEW.md` review

## PR 2: a prompt out of a quote, R2 (High), branch `sprint-168-quotes-headings-pr2`, can start now
- [x] Issue created in milestone v2.3.0 (manager): #864: to be created
- [x] Check Sprint 166 PR 8 and Sprint 167 PR 5 for overlap before the first edit
- [x] Code block inside a quote lifts the paragraphs out, then makes one code block with Copy and ↗
- [x] An emptied quote goes; the whole change is one undo step
- [x] Bubble and / menu both; outside a quote unchanged
- [x] Tests: each scenario in `scenarios.md`, including Undo
- [x] Shots: the code block taken out of a quote, before and after (`proof/pr2-prompt-out-of-quote/`); the Experience lead's look follows
- [x] Release-notes line; PR Risk and How to revert; `REVIEW.md` review (High, three rounds: round three on the attribution commit, the Experience lead's 19 November rule)

## PR 3: heading levels, R3 (High), branch `sprint-168-quotes-headings-pr3`, after Sprint 164 PR 3 merges
- [x] Issue created in milestone v2.3.0 (manager): #865: to be created
- [x] h2 and h3 values in `slide.css`; the title's line keeps its look
- [x] / menu: Heading 1, 2, 3 with the hidden words; "Title" and "Heading" renamed (no real removal); the bubble unchanged
- [ ] One realistic synthetic deck with an h2 mid-slide checked through the fit
- [x] Tests: menu entries and keywords; the fit with the larger h2 (`blocks/slideHeadings.test.ts`: computed sizes through slide.css and decks.css, the box's h3, the fit)
- [ ] Shots: a slide with h1, h2 and h3 together; the Experience lead's look
- [ ] Release-notes line; PR Risk and How to revert; `REVIEW.md` review

## Sprint end
- [ ] Full test chain once per final head
- [ ] `qa-validator` sign-off
- [ ] `docs/development/architecture.md` updated if structure changed
- [ ] Worktree hygiene report after merge (`node ./scripts/worktree-hygiene.mjs --check`)
