# Sprint 164 tasks

Gate: no code until Jarmo approves the plan and each PR's branch is created from the sprint branch name `sprint-164-deck-finish-prN`.

## PR 1: Slide only (Standard), branch `sprint-164-deck-finish-pr1`
- [x] Issue created in milestone v2.3.0 (manager): #816
- [ ] Decks open in Slide only, new decks included; the chosen view is kept while open; reopened starts in Slide only (R1)
- [ ] Under 600 px and the published page unchanged
- [ ] Test: opens in Slide only, keeps the view while open, reopens in Slide only
- [ ] Shots: a deck just opened and a new deck; the Experience lead's look
- [ ] Release-notes line; PR Risk and How to revert; `REVIEW.md` review

## PR 2: spacing, variant D (High), branch `sprint-164-deck-finish-pr2`
- [x] Issue created in milestone v2.3.0 (manager): #817
- [ ] One before shot
- [ ] 12 px under blocks, old top margins removed (R2)
- [ ] 18 px inside surfaces, table cells 18 and 9
- [ ] 32 px between columns, no column padding, boxes 16 px
- [ ] Shots against variant D on the editor, strip, wall and page, and the fit levels; the Experience lead's look
- [ ] Release-notes line; PR Risk and How to revert; `REVIEW.md` review

## PR 3: Label (High), branch `sprint-164-deck-finish-pr3`, starts after PR 2 merges
- [x] Issue created in milestone v2.3.0 (manager): #818
- [x] Jarmo's yes by name for the three removals (19 November: "kinnitan sprindi 164 koos eemaldustega")
- [ ] Label block in the / menu with its hidden words (tag, badge, pill, eyebrow, silt, märgis) (R3)
- [ ] File form `[text]{.label}` and round-trip tests; tell the lead if the parser argues against it
- [ ] Steps pill migrates to a Label; new Steps block has none; round-trip tests
- [ ] Empty Label behaviour; slides and page only
- [ ] Removals done: Settings Label row, last-label rule, padding-top pill rule
- [ ] Shots on the slide, strip, wall and page; the Experience lead's look
- [ ] Release-notes line; PR Risk and How to revert; `REVIEW.md` review

## Sprint end
- [ ] Full test chain once per final head
- [ ] `qa-validator` sign-off
- [ ] `docs/development/architecture.md` updated if structure changed
- [ ] Worktree hygiene report after merge (`node ./scripts/worktree-hygiene.mjs --check`)
