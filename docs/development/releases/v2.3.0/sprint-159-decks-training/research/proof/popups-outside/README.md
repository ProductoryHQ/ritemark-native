# Popups close on an outside press; Slide settings in the deck's bar

Proof for the PR that makes popups close when you click outside them (Jarmo, 17 November 2026) and moves Slide settings into the deck's bar ("Nothing around the slide but the slide", experience 46's README at ritemark-dev 8e84046).

Taken on 16 November 2026 in an isolated dev instance (`scripts/qa/dev-launch-isolated.sh`, Decks flag on in the throwaway profile) on a copy of Sprint 157's demo project, at 1440 × 900 CSS pixels (2× screens).

| Shot | What it shows |
| --- | --- |
| `bar-gear-1440x900.png` | The deck's bar: the strip button, "Slide 6 of 13", then the Slide settings gear (28 px ghost, muted). Nothing above the slide; under it only the speaker notes. |
| `bar-gear-closeup.png` | The gear (Phosphor `gear`, as the old Settings button drew) beside the count, close up. Retaken 16 November after the coordinator's fix: the first cut drew `sliders-horizontal`. |
| `bar-gear-on-closeup.png` | The gear in its `on` state while the popup is open. |
| `popup-library-1440x900.png` | (Taken before the gear fix: its bar still shows the sliders icon.) Slide 6 (a changed library copy): the popup under the gear, left-aligned, the gear `on`. At its top: "From the library · AI assistants", the sentence, Keep it here and Update the library; then a line; then Layout, Look, Picture, Skip slide. |
| `popup-table-1440x900.png` | (Taken before the gear fix, as above.) Slide 11 (a table, copied from another deck): "From Data in Excel" and Add a row · Add a column at the top. |
| `strip-badges-closeup.png` | The strip's library badges: amber on 5, 6 and 7 (changed in this deck), quiet on 10. |

The behaviour, read from the deck webview over CDP after each real mouse or key event:

```
start (popup open)          open:true  gear data-state:active aria-expanded:true
press on a picture place    open:true  focus: the radio inside the popup
press on the handout        open:false focus: the handout's editor (where the press put it)
gear, press inside, Esc     open:false focus: the gear
gear, gear                  open:false focus: the gear (it toggles)
```
