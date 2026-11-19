# Sprint 164 tasks

Gate: no code until Jarmo approves the plan and each PR's branch is created from the sprint branch name `sprint-164-deck-finish-prN`.

## PR 1: Slide only (Standard), branch `sprint-164-deck-finish-pr1`
- [x] Issue created in milestone v2.3.0 (manager): #816
- [x] Decks open in Slide only, new decks included; the chosen view is kept while open; reopened starts in Slide only (R1)
- [x] Under 600 px and the published page unchanged
- [x] Test: opens in Slide only, keeps the view while open, reopens in Slide only
- [x] Shots: a deck just opened and a new deck; the Experience lead's look
- [x] Release-notes line; PR Risk and How to revert; `REVIEW.md` review

## PR 2: spacing, variant D (High), branch `sprint-164-deck-finish-pr2`
- [x] Issue created in milestone v2.3.0 (manager): #817
- [x] One before shot
- [x] 12 px under blocks, old top margins removed (R2)
- [x] 18 px inside surfaces, table cells 18 and 9
- [x] 32 px between columns, no column padding, boxes 16 px
- [x] Shots against variant D on the editor, strip, wall and page, and the fit levels; the Experience lead's look (he approved #821's shots in `proof/pr2-spacing/`; the fit levels are measured by `slideSpacing.test.ts` at fit 1 and 0.7, not shot in the app)
- [x] Release-notes line; PR Risk and How to revert; `REVIEW.md` review

## PR 3: Label (High), branch `sprint-164-deck-finish-pr3`, starts after PR 2 merges
- [x] Issue created in milestone v2.3.0 (manager): #818
- [x] Jarmo's yes by name for the three removals (19 November: "kinnitan sprindi 164 koos eemaldustega")
- [x] Label block in the / menu with its hidden words (tag, badge, pill, eyebrow, silt, märgis) (R3)
- [x] File form `[text]{.label}` and round-trip tests; tell the lead if the parser argues against it (it doesn't: a paragraph that is that one line)
- [x] Steps pill migrates to a Label; new Steps block has none; round-trip tests
- [x] Empty Label behaviour; slides and page only
- [x] Removals done: Settings Label row, last-label rule, padding-top pill rule (DeckView.tsx's leftovers went in PR 4, [#892](https://github.com/ProductoryHQ/ritemark-native/pull/892), once #819 had merged)
- [x] Shots on the slide, strip, wall and page (taken: `proof/pr3-label/`); the Experience lead's look (he approved them)
- [x] Release-notes line; PR Risk and How to revert; `REVIEW.md` review (High: two rounds and the security review)

## PR 4: the Label row's leftovers (Standard), branch `sprint-164-deck-finish-pr4`
- [x] Dead code from PR 3's removals gone, nothing else: `withStepsTag`, the `blockStepsTagOf` alias, `SlideSettings`' `stepsTag`/`onUndo` props, DeckView's `stepsTagSetting`, and `updateSlideMarkdown`, which only it called ([#892](https://github.com/ProductoryHQ/ritemark-native/pull/892))
- [x] Existing tests pass; no new behaviour, so no new test
- [x] PR Risk and How to revert; `REVIEW.md` review (Standard: one round)

## Sprint end
- [x] Full test chain once per final head: EXIT 0 on #819's `1daa17fe` ([Review record](https://github.com/ProductoryHQ/ritemark-native/pull/819#issuecomment-7016313052)), #821's `0e20be20` ([Review record](https://github.com/ProductoryHQ/ritemark-native/pull/821#issuecomment-7015943537)) and #858's `ee854346` ([Review record](https://github.com/ProductoryHQ/ritemark-native/pull/858#issuecomment-7019351407)); #892's is in its own Review record
- [x] `qa-validator` sign-off (19 November: every technical check passed; it blocked only on this list's unticked items)
- [x] `docs/development/architecture.md` updated if structure changed (Decks, "The Label block", and the version history rows of PRs 3 and 4)
- [x] Worktree hygiene report after merge (`node ./scripts/worktree-hygiene.mjs --check`), run on 19 November
