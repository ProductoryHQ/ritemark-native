# Sprint 167 tasks

Gate: no code until Jarmo approves the plan, and each PR's branch `sprint-167-block-details-prN` is created before its first edit. Shots on synthetic decks only.

## PR 1: logo corner, E (High), branch `sprint-167-block-details-pr1`, can start now
- [x] Issue created in milestone v2.3.0 (manager): #835
- [x] Where becomes Top | Bottom and Left | Right; old theme values still read (R6)
- [x] Room for the logo in all four corners on the editor, strip, wall and page
- [x] Tests: theme file round-trip, the four corners
- [x] Shots of a title slide with the logo bottom left; the Experience lead's look
- [x] Release-notes line; PR Risk and How to revert; `REVIEW.md` review

## PR 2: Mark, C (Standard), branch `sprint-167-block-details-pr2`, after Sprint 164 PR 3 merges
- [x] Issue created in milestone v2.3.0 (manager): #836: to be created
- [ ] Mark menu after Filled and Outline, showing its value (R3)
- [ ] Icon, Number, Dot, Arrow map to the existing looks; Number follows moves, adds, deletes
- [ ] Tests: each mark round-trips; numbering after a move
- [ ] Shots of the four marks; the Experience lead's look
- [ ] Release-notes line; PR Risk and How to revert; `REVIEW.md` review

## PR 3: content position, A (High), branch `sprint-167-block-details-pr3`, after Sprint 164 PR 2 and PR 3 merge
- [x] Issue created in milestone v2.3.0 (manager): #837: to be created
- [ ] A new slide setting, written only when not the default; old decks unchanged (R1)
- [ ] Content row in Slide settings; title and section slides read as Bottom
- [ ] Drawn alike on the editor, strip, wall, page and presenter view; with a picture left, right or behind; a full slide unchanged
- [ ] Tests: round-trip, no setting for the default, fit unchanged
- [ ] Shots at Top, Middle, Bottom on each surface; the Experience lead's look
- [ ] Release-notes line; PR Risk and How to revert; `REVIEW.md` review

## PR 4: picture behind, D (High), branch `sprint-167-block-details-pr4`, after PR 1 and PR 3
- [x] Issue created in milestone v2.3.0 (manager): #838: to be created
- [ ] Corner chip replaces the centred prompt, at rest a round handle, opening on hover (R4)
- [ ] Choosing Behind with no picture opens the chooser; paste or drop anywhere goes behind
- [ ] Placed picture: click chooses, ring, picture bar without Size or Crop, hover chip, paste or drop replaces (R5)
- [ ] Replace… and Remove under Behind in Slide settings
- [ ] Tests: paste, drop, replace, remove; the chip never takes the words' clicks
- [ ] Shots empty and placed, logo top right and not; the Experience lead's look
- [ ] Release-notes line; PR Risk and How to revert; `REVIEW.md` review

## PR 5: item handle, B (High), branch `sprint-167-block-details-pr5`, after Sprint 166 merges
- [x] Issue created in milestone v2.3.0 (manager): #839: to be created
- [ ] Handle on the item under the pointer of the chosen block only, with its menu and drag (R2)
- [ ] Column handle; Steps and list item handle on the left edge
- [ ] Backspace in an empty item still removes it; the handle covers no words
- [ ] Tests: each menu action with undo; the drop line
- [ ] Shots of the box, column and item handles; the Experience lead's look
- [ ] Release-notes line; PR Risk and How to revert; `REVIEW.md` review

## Sprint end
- [ ] Full test chain once per final head
- [ ] `qa-validator` sign-off
- [ ] `docs/development/architecture.md` updated if structure changed
- [ ] Worktree hygiene report after merge (`node ./scripts/worktree-hygiene.mjs --check`)
