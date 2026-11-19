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
- [ ] Shots against variant D on the editor, strip, wall and page, and the fit levels; the Experience lead's look
- [x] Release-notes line; PR Risk and How to revert; `REVIEW.md` review

## PR 3: Label (High), branch `sprint-164-deck-finish-pr3`, starts after PR 2 merges
- [x] Issue created in milestone v2.3.0 (manager): #818
- [x] Jarmo's yes by name for the three removals (19 November: "kinnitan sprindi 164 koos eemaldustega")
- [x] Label block in the / menu with its hidden words (tag, badge, pill, eyebrow, silt, märgis) (R3)
- [x] File form `[text]{.label}` and round-trip tests; tell the lead if the parser argues against it (it doesn't: a paragraph that is that one line)
- [x] Steps pill migrates to a Label; new Steps block has none; round-trip tests
- [x] Empty Label behaviour; slides and page only
- [x] Removals done: Settings Label row, last-label rule, padding-top pill rule (DeckView.tsx's three leftover lines follow once #819 merges)
- [ ] Shots on the slide, strip, wall and page (taken: `proof/pr3-label/`); the Experience lead's look
- [x] Release-notes line; PR Risk and How to revert; `REVIEW.md` review (High: two rounds and the security review)

## Sprint end
- [ ] Full test chain once per final head
- [ ] `qa-validator` sign-off
- [ ] `docs/development/architecture.md` updated if structure changed
- [ ] Worktree hygiene report after merge (`node ./scripts/worktree-hygiene.mjs --check`)
