# Sprint 164 scenarios

## R1: Slide only
- Given an existing deck, when it is opened, then only the slide shows.
- Given a new deck, when it is created, then it shows Slide only.
- Given an open deck, when the person picks Slide and handout, then that view stays while the deck is open.
- Given the deck is closed and opened again, then it starts in Slide only.
- Given the window is under 600 px, then the view is as it is today.
- Given the published page, then Slide and text is still the reader's default.

## R2: Spacing
- Given a slide with three blocks, then there is 12 px under the first two and nothing under the last.
- Given a Columns block, then the gap is 32 px, the first column starts at the content edge, the last ends at the other, and the split handle sits mid-gap.
- Given a box, tab pane or code block, then it has 18 px inside; a table cell has 18 px at the sides and 9 px above and under.
- Given the first tab, then its name lines up with the pane's words.
- Given any fit level, then the values scale with the slide.
- Given the editor, strip, wall and page, then all draw the same spacing.

## R3: Label
- Given the / menu, when "pill" or "märgis" is typed, then Label is offered in Blocks.
- Given a Label with words, then it looks like today's Exercise pill, and the file holds `[Exercise · 1 / 2]{.label}` on its own line.
- Given an empty Label with the cursor in it, then a faint "Label" shows; Backspace removes it.
- Given an empty Label that is not being edited, then it is never drawn on the wall, page or thumbnail.
- Given the Text editor or the handout, then the Label does not show.
- Given a deck with a Steps pill, when it is opened, then the pill is a Label in the same place with the same words; an emptied pill becomes nothing.
- Given a new Steps block, then it has no Label.
- Given a Label right before a heading, then it sits 8 px above it.
