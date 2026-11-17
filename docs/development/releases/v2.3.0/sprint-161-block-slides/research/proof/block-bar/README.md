# The block's bar: proof shots

Dev runs on 17 November 2026, from about 18:00 EET, on Jarmo's daytime words for that day ("sa võid täna kohe screenshottidega alustada. mul koolituste vaba päev"). Each run was one launch of `scripts/qa/dev-launch-isolated.sh`: a fresh profile, throwaway AI homes and the mock keychain, `ritemark.features.decks` on, and a fixture deck written for the run (no real deck was opened). Nothing was signed in to. Every run was stopped with `LEFT=0`, and its run folder, profile included, was deleted.

The workbench was held at 1440 × 900 CSS px (the files are 2880 × 1800). "AI folded" means the AI column is hidden; "AI open" means it shows. With the AI column open, the room is narrower, so the slide sits above the handout.

**The file, checked in the run**
- Opened: the deck was the fixture byte for byte (`cmp`).
- Width S, M and L wrote `:::: {.boxes width="s"}` and so on on the block's own line. Auto took it out again.
- Outline wrote `fill="outline"`. Columns' count 2 left two columns, with Codex's words in the second.
- The split drag wrote `width="22%"`, `"44%"` and `"33%"` on the three columns' own lines: the first line snapped to a third of its two columns.
- Turn into Steps, then one ⌘Z: the file was byte for byte as before (`cmp`).
- The ⋮ drag moved the list under the line typed after it, and one ⌘Z gave the file back byte for byte (`cmp`).
- At the end, `diff` against the fixture showed only the lines these steps wrote.

**Measured in the run (screen px, at the stage's scale of about 0.49)**
- Auto, five boxes: three boxes 130 wide in the first row, two boxes 199 wide in the second.
- S: four 88 wide (180 on the slide), then one. M: three 127 wide (260), then two. L: two 195 wide (400), two, then one.
- Tab in "News and notices" went to the start of "Desktop agents", and Shift+Tab went back. Tab in "Summary", the last box, stayed there.

| Shot | What it shows |
| --- | --- |
| `01-boxes-bar-auto-five-boxes-ai-folded-…`, `…-ai-open-…` | The agenda's five boxes chosen: the ring, the ⋮, the + on the right edge, and the bar under the block. Auto lays them out in two rows, 3 + 2. |
| `02-type-menu-open-…` | Boxes ▾ open: Boxes, Steps, Columns, List and Numbered. |
| `03-width-S-…`, `…-M-…`, `…-L-…` | Width S, M and L: the boxes wrap, start at the left and keep their width in the last row. |
| `04-style-outline-…` | Outline. Filled is the theme's own, so choosing it again writes nothing. |
| `05-plus-adds-a-box-…` | The + added a sixth, empty box (3 + 3). |
| `06-columns-bar-…` | Columns chosen: the count 2 · 3 · 4, top · middle · bottom, Add, Delete and ⋯. |
| `07-columns-count-2-…` | Two columns: the third column's words are in the second. |
| `08-split-drag-…` | The line between the first two columns being dragged, with its guide at the snapped third. |
| `09-columns-more-menu-…` | Frame 23's ⋯: Add a column, Remove a column and Delete block. The split from shot 08 is drawn (22 / 44 / 33). |
| `10-steps-bar-…`, `11-list-bar-…` | Steps and a list: the type, Add and Delete only. |
| `12-plus-adds-a-list-item-…` | The + on the list's bottom edge added an empty item, with the caret in it. |
| `13-grip-drag-bar-hidden-…` | The ⋮ dragged (final run): a line under "Next steps for the team" shows where the list lands, and the bar is hidden while it drags. |
| `04-style-outline-borderless-…` | Final run: Outline on a Borderless deck, with the outline's own line, visible on white. |
| `14-turned-into-steps-…` | Boxes turned into Steps: each box's heading is a step and its line sits under it. |

**The final run (17 November, on f8656975, one launch, stopped with `LEFT=0` and its folder deleted)**
- The untouched deck opened byte for byte (`cmp`).
- Changing the slide with the caret in a box: the deck stayed responsive.
- Turn into Steps and one ⌘Z, and the ⋮ drag and one ⌘Z: each gave the file back byte for byte (`cmp`).
- A second fixture deck (Borderless) opened byte for byte. Its Outline boxes are shot.
- The run's driver didn't reach that deck's other slides, so a Boxes block inside a box and fourteen boxes were not shot on the stage. They are covered by `blockBar.test.ts` (the CSS rules and `data-many`), and the strip's thumbnails in shot 04 show them drawn.

**Found and fixed in the run**
- The deck hung when the slide changed with the caret in a box. The caret's box mark (`slideCaretBox`, PR 3) had landed on an element that wasn't a box. ProseMirror read the class back and drew it again, without end. The mark now goes only on a box the slide draws. The same run was then repeated, and it held.
- React put the handles in beside the bubble menu, which had already moved to the page, and the insert failed. The handles now go in a layer that the bar places in the frame itself.
- The bar covered the drop line during a ⋮ drag, so it's now hidden while a handle drags.
- Choosing Filled wrote `fill="filled"` even when the theme's boxes were filled. The theme's own style now writes nothing.
