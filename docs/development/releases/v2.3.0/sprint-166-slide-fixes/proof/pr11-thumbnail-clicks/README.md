# Sprint 166 PR 11: a thumbnail takes no click or wheel inside it (#856)

The same isolated dev launch as PR 10 (`scripts/qa/dev-launch-isolated.sh`, its own profile and port, Decks on in that profile only), the window at 1440×900, the project side bar and the AI pane hidden so the strip shows. The same synthetic deck: slide 2 has a Columns block whose left column holds twenty points, 882 px of words in a 382 px column, so its thumbnail draws a column that holds more than its room. The run was recorded twice in that one launch: first with main's webview (`5b60d217`), then, after a rebuild of the webview and Reload Window, with this branch's.

Each click is a real mouse click through the Chrome DevTools Protocol at a point of thumbnail 2's picture (as a fraction of its width and height), with slide 3 chosen first. "Under the point" is what the deck's page reports there.

| # | Where on thumbnail 2 | Before (main `5b60d217`) | After |
| --- | --- | --- | --- |
| 1 | Exact centre (0.5, 0.5) | under it the column (`blk-column`), its scrollbar: 3 → **3**, not chosen | under it the thumbnail: 3 → **2** |
| 2 | Exact centre again | 3 → **3** | 3 → **2** |
| 3 | Lower middle (0.48, 0.75) | 3 → **2** | 3 → **2** |
| 4 | Left, in the column's words (0.25, 0.5) | 3 → **2** | 3 → **2** |
| 5 | Bottom-left corner (0.1, 0.9) | not run | 3 → **2** |
| 6 | One wheel notch down (100 px) over the column (0.3, 0.5) | the thumbnail's column scrolls 0 → **100 px** | the column stays at **0**; the wheel is the strip's |
| 7 | One wheel notch up there | the column scrolls back 100 → **0** | the column stays at **0** |

The thumbnail's columns draw no scrollbar now (`scrollbar-color` transparent in a thumbnail): they keep their room, so the words wrap as on the stage, and their soft fade at the foot. The top-right corner, where the slide's ⋯ button shows on hover, still opens the slide's menu: it is the thumbnail's own control, not part of the picture.

## Shots (1440×900)

- [before-centre-click-misses-1440x900.png](before-centre-click-misses-1440x900.png) and [before-strip-detail-3x.png](before-strip-detail-3x.png): main. A wheel notch over thumbnail 2 scrolled the column inside it, and its scrollbar shows as a thin line; a click on its centre left slide 3 chosen.
- [after-centre-click-chooses-slide-2-1440x900.png](after-centre-click-chooses-slide-2-1440x900.png) and [after-strip-detail-3x.png](after-strip-detail-3x.png): this branch. A click on the exact centre of thumbnail 2 chose it: the stage shows slide 2, the thumbnail is ringed, its column has no scrollbar and keeps its fade.

## After the review

The launch above ran the first version of the rule, on the strip's thumbnails only. The review (round one, #875) found the same pictures in three more places, and the rule now covers them all, in one place (`decks.css`, which the wall and the presenter view load too): the strip's thumbnails and the copy a drag lifts, the wall's grid of slides, and the presenter view's row and Next. Nothing in the slide inside them takes the pointer, and no block in them draws a scrollbar, whatever its own rule sets (a column, a pane, a code block). On the strip the outcome should be the one in the table: the click's target is now the picture's frame around the slide rather than the thumbnail's row, and it reaches the thumbnail's own click from there. That is covered by the test, not by a second launch.

## The test

`webview/src/components/decks/slideNav.test.ts` (#856 block) reads the rule: nothing in a thumbnail's slide takes the pointer, in the strip, the drag's lifted copy, the wall's grid and the presenter view's row and Next; no block in it draws a scrollbar; the only rules that give the pointer back are the stage's own layers and the wall's bar (a new one fails the test until it is checked against the thumbnails); the stage's columns and panes still scroll; and each thumbnail's own click (strip, wall grid, presenter row) chooses its slide. On main it fails at "nothing in the picture takes the pointer".

## Not verified

- A real mouse and trackpad (protocol events).
- The wheel scrolling the strip itself over a thumbnail: this deck's strip is too short to scroll. With nothing in the picture taking the pointer, the wheel's target is the thumbnail, inside the strip.
- A drag of a thumbnail to a new place after the change: the drag starts on the thumbnail's own row, which now gets the press directly instead of from the picture inside it.
- The wall's grid of slides and the presenter view's row and Next, live: the rule covers them since the review, and the test reads it, but no Present window was opened for them (their fault was found by reading, not reproduced).
- Windows.
