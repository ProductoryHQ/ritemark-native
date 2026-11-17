# Proof: a scrolling table keeps sensible column widths

The shots show a synthetic deck, "Demo training / Assistants at work". Slide 3 has a wide "pilot week" table: six number columns and a "Notes from the pilot week" column. The app shots are 1440×900 with the AI pane folded, from one isolated dev instance.

| Shot | Shows |
| --- | --- |
| `s1-handout-before` | Before: the old layout, drawn by overriding the new `<col>` floor in the same instance. The notes wrap one or two words per line, and every row is five or six lines tall. |
| `s2-handout-after` | After: the number columns keep their widest word, and the notes column keeps 200 px. The table scrolls in its frame, and each note wraps into three or four lines. |
| `s3-handout-after-scrolled` | The same table scrolled to its end, showing the whole notes column. |
| `s4-page-after` (1440×900) | The published page, built with the real page builder from the same deck and served from 127.0.0.1 only. The page uses the same rule, so its notes wrap into two or three lines in their 200 px column. |
| `s5-page-after` (390×844) | The same page at phone width. The table scrolls sideways in its frame. |

Measured in the instance: the handout's notes column was 200 px wide, the frame 720 px and the table 820 px. The page's notes column was 200 px. After the deck was opened and viewed, `cmp` found its file byte for byte unchanged, because the widths are drawn, not written.

The page shots come from the first head, where the page set its floor as the `<col>`'s `min-width`. After review, the page draws the floor as a spacer in the header cell instead, because Safari and Firefox ignore a `<col>`'s `min-width`. That build was measured in Chromium at 1440×900 and gave the same column widths as before (73, 108, 86, 63, 64, 73 and 200 px), so the shots stand. The same check covered two other cases. A table in an Exercise step now fills the step's 486 px. A table with stored widths of 20/20/60 % is drawn at 109/109/326 px of the 544 px text width, as the handout draws it.
