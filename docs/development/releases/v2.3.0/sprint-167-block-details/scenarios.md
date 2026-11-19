# Sprint 167 scenarios

All shots are taken on synthetic decks, never Jarmo's real decks.

## R1: Slide content
- Given a new slide, then Content shows Top and the file has no content setting.
- Given Middle or Bottom chosen, then the whole flow, title included, moves, and the file holds the setting.
- Given a title or section slide with no setting, then Content shows Bottom, and choosing Top changes it.
- Given a full slide, then Top, Middle and Bottom look the same and the fit is unchanged.
- Given a Left or Right picture, then the content aligns inside its column; given Behind, over the picture.
- Given a Columns block, then each column keeps its own alignment.
- Given Middle, then the editor, strip, wall, page and presenter view draw the same.
- Given an old deck with no setting, then it reads exactly as before.

## R2: A block's own handle
- Given a chosen block, when the pointer is over one box, then its handle shows mid top edge and no other block shows one.
- Given the handle's menu, then Duplicate, Move left, Move right and Delete box work, with undo.
- Given a drag from the handle, then a drop line shows and the box lands there.
- Given a Columns block, then a column's handle offers Delete column without emptying it first.
- Given a Steps or list item, then its handle is on the left edge with Move up and Move down.
- Given an empty item, then Backspace still removes it.
- Given any handle, then it covers no words.

## R3: Mark
- Given a Boxes block, then the bar shows Mark after Filled and Outline, with its value.
- Given Number, then the boxes are numbered in order, and the numbers follow a move, an add and a delete.
- Given Icon, then each box keeps its own icon, and Icon is the default.
- Given an old deck that uses steps, line or arrows, then the bar shows the matching Mark.

## R4: Picture behind, empty
- Given Behind chosen with no picture, then the chooser opens at once.
- Given an empty place, then no prompt is in the middle, and the chip is a small round handle that opens while the pointer is over the slide.
- Given the logo is top right, then the chip is bottom right; otherwise top right.
- Given a picture pasted or dropped anywhere on the slide, then it goes behind.
- Given words under the chip's place, then the chip never takes their clicks.

## R5: Picture behind, placed
- Given a click where there are no words, then the picture is chosen, the ring goes round the slide and the bar opens.
- Given the bar, then there is no Size or Crop, and ⋯ holds Replace picture…, Copy and Remove.
- Given rest, then the corner is empty; on hover the chip "Picture behind · Choose" appears and chooses the picture.
- Given a paste or drop on the chosen picture, then it is replaced.
- Given Slide settings under Behind, then Replace… and Remove are there.

## R6: Logo corner
- Given the theme's Where, then Top | Bottom and Left | Right give four corners.
- Given a logo bottom left on a title slide, then no words run under it.
- Given any corner, then the editor, strip, wall and page leave the same room.
- Given an old theme with its corner, then it reads as before.
