# Proof: a soft fade at the edge of a table that scrolls sideways

The shots show a synthetic deck, "Demo training / Assistants at work". Slide 3 has a wide "pilot week" table: six number columns and a "Notes from the pilot week" column. The handout shots are 1440×900 with the AI pane and the left column folded, from one isolated dev instance. The page shot is the page built by the real page builder from the same deck, served from 127.0.0.1 only and taken in headless Chromium.

| Shot | Shows |
| --- | --- |
| `s1-handout-start-1440x900` | The table at its start. The right side fades over 24 px, in the + column's room, so "Notes from the pilot week" fades out instead of being cut mid-word. The grey header row fades with it. |
| `s2-handout-middle-1440x900` | The table scrolled to its middle. Both sides fade; the left fade starts where the frame's clip does, 6 px in. |
| `s3-page-middle-390x844` | The published page at phone width, the table scrolled to its middle. Both sides fade, to the page's white. |

Measured in the instance: the frame was 735 px and the table 816 px. At the start the frame had `is-scrollable-right` and in the middle both classes (the end state was not measured in the instance; `tableEdges.test.ts` covers it). On the page at 390 px the frame was 358 px and the table 623 px: `is-scrollable-right` at the start, both in the middle, and `is-scrollable-left` only at the end. Both browsers draw overlay scrollbars here, so `--rm-fade-bar` stayed empty.

A Text document's table doesn't scroll in its own frame (`.rm-table` has `overflow: visible` outside a deck's handout), so it gets no class and looks as before. The same holds for a table on a slide.
