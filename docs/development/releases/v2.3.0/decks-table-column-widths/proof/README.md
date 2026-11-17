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
