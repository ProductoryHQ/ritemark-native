# Proof: decks, space not lines (PR #780)

The shots are 1440×900 with the AI pane folded. They show a synthetic deck, "Demo training / Assistants at work". Slide 3 has no handout, slide 4 is skipped, and slide 5 has a wide table.

| Shot | Shows |
| --- | --- |
| `s1-split` | The split view at rest: no lines, the rail with the current slide's track, filled boxes drawn as fill only, and slide 3 folded to its "Slide only" row. |
| `s2-divider-hover` | The split pointed at, showing the 2 px accent line. |
| `s3-stacked` | The stacked layout, with the left column open. |
| `s4-sticky-number` | A long part scrolled: its number stays at the top of its track, with the ⋯ shown while the track is pointed at. |
| `s5-handout-only` | Handout only: the rail at the left of the 900 px column. |
| `s6-wide-table` | The wide table scrolled to its end inside its own frame, with room for the column grip and the + bars. |
| `s7-dark` | Ritemark Dark: the current track at 14 %. The skipped thumbnail's mark and the ⋯ keep their ink. |
| `s8-slide-only-row` | The "Slide only" row with its tooltip. |
| `s9-slide-only-open` | The same part after a click on its row: current, the caret in it, and its placeholder. |
| `s10-borderless-boxes` | Borderless: filled boxes are #EFF0F8 with no hairline. |
| `s11-page-slide-only` | The published page at slide 3, which has nothing in the text. The table's scrollbar is a thumb with no track. The page was built with the real page builder and served from 127.0.0.1, so nothing was sent anywhere. |

Shots s1, s6, s7, s9 and s11 come from the merged head with the review fixes; the others come from the first build. In s6 and s11 the table's last column still wraps one word per line, which is left for a later PR.
