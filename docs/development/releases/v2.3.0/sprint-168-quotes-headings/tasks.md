# Sprint 168 tasks

Gate: no code until Jarmo approves the plan, and each PR's branch `sprint-168-quotes-headings-prN` is created before its first edit. Shots on synthetic decks only.

## PR 1: the quote's look, R1 (High), branch `sprint-168-quotes-headings-pr1`, after Sprint 166 PR 5 (#841) merges
- [x] Issue created in milestone v2.3.0 (manager): #863: to be created
- [x] Audit: how the attribution line is told apart on every surface (the renderer writes `blk-by` on it, the stage's decoration the same; the file is untouched)
- [x] The quote's look per the README, with the attribution line
- [x] Same on the editor, wall, presenter view, strip and page, on dark and on Paper (one renderer and one sheet; seen on the stage, the wall and the page; the strip and the presenter view by tests)
- [x] Tests: parity across the renderers; a quote with no attribution; a deck with no quote unchanged
- [x] Shots: a quote with attribution on dark and on Paper, in the editor and on the wall (`proof/pr1-quote-look/`); the Experience lead's look
- [x] Release-notes line; PR Risk and How to revert; `REVIEW.md` review

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
- [x] One realistic synthetic deck with an h2 mid-slide checked through the fit (three h2s: 453 of 460 px at 100 % before; after, 440 of 460 at 92 %, nothing past the bottom)
- [x] Tests: menu entries and keywords; the fit with the larger h2 (`blocks/slideHeadings.test.ts`: computed sizes through slide.css and decks.css, the box's h3, the fit)
- [x] Shots: a slide with h1, h2 and h3 together, the title's line, the / menu, the realistic deck before and after (`proof/pr3-headings/`); the Experience lead's look follows
- [x] Release-notes line; PR Risk and How to revert; `REVIEW.md` review (High, two rounds; #889)

## Sprint end
- [ ] Full test chain once per final head
- [ ] `qa-validator` sign-off
- [ ] `docs/development/architecture.md` updated if structure changed
- [ ] Worktree hygiene report after merge (`node ./scripts/worktree-hygiene.mjs --check`)
