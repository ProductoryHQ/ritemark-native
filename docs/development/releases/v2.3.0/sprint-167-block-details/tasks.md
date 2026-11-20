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
- [x] Mark menu after Filled and Outline, showing its value (R3)
- [x] Icon, Number, Dot, Arrow map to the existing looks; Number follows moves, adds, deletes
- [x] Tests: each mark round-trips; numbering after a move
- [x] Shots of the four marks, in the editor and on the wall, and the menu open (`proof/pr2-mark/`)
- [x] The Experience lead's look (before the merge): #878, approved 19 November
- [x] Release-notes line; PR Risk and How to revert; `REVIEW.md` review

## PR 3: content position, A (High), branch `sprint-167-block-details-pr3`, after Sprint 164 PR 2 and PR 3 merge
- [x] Issue created in milestone v2.3.0 (manager): #837: to be created
- [x] A new slide setting, written only when not the default; old decks unchanged (R1): `valign:` in the block slide's header
- [x] Content row in Slide settings; title and section slides read as Bottom
- [x] Drawn alike on the editor, strip, wall, page and presenter view; with a picture left, right or behind; a full slide unchanged
- [x] Tests: round-trip, no setting for the default, fit unchanged (`contentPlace.test.ts`, `slideContentPlace.test.ts`)
- [x] Shots at Top, Middle, Bottom on each surface (`proof/pr3-content-position/`)
- [x] The Experience lead's look (before the merge): #891, approved 19 November
- [x] Release-notes line; PR Risk and How to revert; `REVIEW.md` review

## PR 4: picture behind, D (High), branch `sprint-167-block-details-pr4`, after PR 1 and PR 3
- [x] Issue created in milestone v2.3.0 (manager): #838
- [x] Corner chip replaces the centred prompt, at rest a round handle, opening on hover (R4) (`blocks/BehindChip.tsx`, `blocks/behindChipPlace.ts`)
- [x] Choosing Behind with no picture opens the chooser; paste or drop anywhere goes behind
- [x] Placed picture: click chooses, ring, picture bar without Size or Crop (Focus first, its dot moved by the arrow keys too), hover chip, paste or drop replaces (R5)
- [x] Replace… and Remove under Behind in Slide settings (Choose… while it is empty)
- [x] Tests: paste, drop, replace, remove; the chip never takes the words' clicks (`blocks/behindChip.test.ts`, `handout/deckConvert.test.ts`)
- [x] Shots empty and placed, logo in each corner (`proof/pr4-picture-behind/`)
- [x] The Experience lead's look (before the merge): #900, approved 20 November (the round handle at rest and Focus first in the bar confirmed)
- [x] Release-notes line; PR Risk and How to revert; `REVIEW.md` review

## PR 5: item handle, B (High), branch `sprint-167-block-details-pr5`, after Sprint 166 merges
- [x] Issue created in milestone v2.3.0 (manager): #839: to be created
- [x] Handle on the item under the pointer of the chosen block only, with its menu and drag (R2) (`blocks/itemHandle.ts`, `blocks/SlideItemHandle.tsx`)
- [x] Column handle; Steps and list item handle on the left edge
- [x] Backspace in an empty item still removes it; the handle covers no words
- [x] Tests: each menu action with undo; the drop line (`blocks/itemHandle.test.ts`)
- [x] Shots of the box, column and item handles (`proof/pr5-item-handle/`)
- [x] The Experience lead's look (before the merge): #911, approved 20 November (the first item's grip left of ⋮; Delete column of two leaves plain blocks)
- [x] Release-notes line; PR Risk and How to revert; `REVIEW.md` review

## Sprint end
- [x] Full test chain once per final head: EXIT 0 in each Review record (#844 `7a324597`, #878 `c4b39c11`, #891 `2e6fa6d4`, #900 `ab950208`, #911 `087a81bf`, follow-up #912 `2ee55923`)
- [x] `qa-validator` sign-off (20 November): every PR check passed; it asked for these ticks, the release plan's row, architecture rows for PRs 1 and 2 and the hygiene report, which this close-out adds
- [x] `docs/development/architecture.md` updated: rows for PRs 3, 4 and 5 came with their PRs; this close-out adds PRs 1 and 2 and the #912 page fix
- [x] Worktree hygiene report after merge (`node ./scripts/worktree-hygiene.mjs --report`, 20 November, read only; removing what it lists waits for Jarmo's go-ahead)
