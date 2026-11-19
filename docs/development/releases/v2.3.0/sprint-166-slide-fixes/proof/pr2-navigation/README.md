# Sprint 166 PR 2: moving between slides in Slide only (#824)

One isolated dev launch (`scripts/qa/dev-launch-isolated.sh`, its own profile and port, Decks on in that profile only), the window at 1440×900, the project side bar hidden so the strip shows. A synthetic deck of six slides (`nav.deck.md`, block slides in Evening; slide 2 has a Columns block whose left column holds twenty points, 882 px of words in a 382 px column). The deck opened in Slide only. The same run was recorded twice in that one launch: first with main's webview (`a0fec8f9`), then, after a rebuild of the webview and Reload Window, with this branch's.

How each gesture was sent:

- **Mouse wheel:** real wheel events through the Chrome DevTools Protocol, 100 px a notch, 150 ms apart (each one its own notch).
- **Line wheel:** a `WheelEvent` with `deltaMode` 1 (lines), 3 lines a notch, sent in the deck's own page at the same point, since the protocol sends pixels only.
- **Trackpad flick:** 40 real wheel events, 16 ms apart, falling off from 24 px as momentum does (about 236 px in all).
- **Keys:** real key presses, after a click on the empty band above the slide (the focus on the page, not in the words), and then with the caret in the title.

The slide's number after each gesture is the deck bar's "Slide N of 6".

## The run

| # | Gesture | Where | Before (main `a0fec8f9`) | After |
| --- | --- | --- | --- | --- |
| 1 | Mouse wheel, 1 notch down (100 px) | over the slide | 1 → **2** | 1 → **2** |
| 2 | Mouse wheel, 2 notches down | over the slide | 2 → **4** | 2 → **4** |
| 3 | Mouse wheel, 1 notch up | over the slide | 4 → **3** | 4 → **3** |
| 4 | Line wheel (deltaMode 1), 1 notch down | over the slide | 3 → **4** | 3 → **4** |
| 5 | Line wheel (deltaMode 1), 1 notch up | over the slide | 4 → **3** | 4 → **3** |
| 6 | Trackpad flick down (40 small deltas) | over the slide | 3 → **4** | 3 → **4** |
| 7 | Trackpad flick up | over the slide | 4 → **3** | 4 → **3** |
| 8 | Mouse wheel, 1 notch down (100 px) | band above the slide | 1 → **2** | 1 → **2** |
| 9 | Mouse wheel, 2 notches down | band above the slide | 2 → **4** | 2 → **4** |
| 10 | Mouse wheel, 1 notch up | band above the slide | 4 → **3** | 4 → **3** |
| 11 | Line wheel (deltaMode 1), 1 notch down | band above the slide | 3 → **4** | 3 → **4** |
| 12 | Line wheel (deltaMode 1), 1 notch up | band above the slide | 4 → **3** | 4 → **3** |
| 13 | Trackpad flick down (40 small deltas) | band above the slide | 3 → **4** | 3 → **4** |
| 14 | Trackpad flick up | band above the slide | 4 → **3** | 4 → **3** |
| 15 | Mouse wheel, 1 notch down (100 px) | band under the slide | 1 → **2** | 1 → **2** |
| 16 | Mouse wheel, 2 notches down | band under the slide | 2 → **4** | 2 → **4** |
| 17 | Mouse wheel, 1 notch up | band under the slide | 4 → **3** | 4 → **3** |
| 18 | Line wheel (deltaMode 1), 1 notch down | band under the slide | 3 → **4** | 3 → **4** |
| 19 | Line wheel (deltaMode 1), 1 notch up | band under the slide | 4 → **3** | 4 → **3** |
| 20 | Trackpad flick down (40 small deltas) | band under the slide | 3 → **4** | 3 → **4** |
| 21 | Trackpad flick up | band under the slide | 4 → **3** | 4 → **3** |
| 22 | Mouse wheel, 1 notch down | over the slide | 1 → **2** | 1 → **2** |
| 23 | Trackpad flick down | over the long column (slide 2) | 2 → **3** | 2 → **2** (column at 238 px) |
| 24 | Mouse wheel, 1 notch down | over the long column | 3 → **4** | 2 → **2** (column at 338 px) |
| 25 | Mouse wheel, 3 notches down | over the long column | 4 → **6** | 2 → **3** (two notches take the column to its end at 500 px, the third moves the slide) |
| 26 | Mouse wheel, 1 notch down | where the column was | 6 → **6** (the last slide) | 3 → **4** |
| 27 | Click on the empty band | band above the slide | 1 → **1** | 1 → **1** |
| 28 | Key ↓ | focus on the page | 1 → **2** | 1 → **2** |
| 29 | Key ↓ | focus on the page | 2 → **3** | 2 → **3** |
| 30 | Key ↑ | focus on the page | 3 → **2** | 3 → **2** |
| 31 | Key Page Down | focus on the page | 2 → **3** | 2 → **3** |
| 32 | Key Page Up | focus on the page | 3 → **2** | 3 → **2** |
| 33 | Key End | focus on the page | 2 → **6** | 2 → **6** |
| 34 | Key Home | focus on the page | 6 → **1** | 6 → **1** |
| 35 | Click in the title | caret in the title | 1 → **1** | 1 → **1** |
| 36 | Key ↓ | caret in the title | 1 → **1** (the caret moves) | 1 → **1** (the caret moves) |
| 37 | Key End | caret in the title | 1 → **1** (the caret moves) | 1 → **1** (the caret moves) |
| 38 | Trackpad flick down | over the title being edited | 1 → **2** | 1 → **2** |

**One gesture, one slide:** every flick (rows 6, 7, 13, 14, 20, 21, 38) moved exactly one slide, before and after; two notches moved two (rows 2, 9, 16).

**What was broken in this layout (rows 23–26):** the stage took every wheel event over the slide, so the long column never scrolled. A flick over it skipped to slide 3, and its last points (Fifteen to Twenty) could not be reached with the wheel at all. Now the column scrolls first, a flick's momentum never moves the slide, and the next gesture at the column's end does.

## The stage taller than its room

The stage scrolls when it is taller than its room (a short window, a row under the slide). On main the empty bands then did nothing at all, even with the stage at its end. Here the stage was made taller by a synthetic 400 px row under the slide (the group's bottom padding, set from the test script, standing in for such a row); the gestures are over the band under the slide.

| # | Gesture | Where | Before (main `a0fec8f9`) | After |
| --- | --- | --- | --- | --- |
| 1 | Mouse wheel, 1 notch down | band under the slide | 1 → **1** (the stage scrolls to 100 of 115) | 1 → **1** (the stage scrolls to 100 of 115) |
| 2 | Mouse wheel, 1 notch down | band under the slide | 1 → **1** (stage at its end, 115) | 1 → **1** (stage at its end, 115) |
| 3 | Mouse wheel, 1 notch down | band under the slide, stage at its end | 1 → **1** (nothing happens) | 1 → **2** |
| 4 | Trackpad flick down | band under the slide, stage at its end | 1 → **1** (nothing happens) | 2 → **3** |
| 5 | Mouse wheel, 1 notch up | band under the slide | 1 → **1** (the stage scrolls back to 15) | 3 → **3** (the stage scrolls back to 15) |
| 6 | Mouse wheel, 1 notch down | over the slide | 1 → **2** | 3 → **4** |

## Shots (1440×900)

- [1-before-flick-over-long-column-1440x900.png](1-before-flick-over-long-column-1440x900.png): main. Slide 2 chosen in the strip, then one trackpad flick over its long column: the deck went to slide 3.
- [2-after-flick-over-long-column-1440x900.png](2-after-flick-over-long-column-1440x900.png): this branch. The same flick scrolls the column (Six to Fourteen in view, the fade at its foot); the deck stays on slide 2.

## Which code ran

The After column ran this branch's first commit, `54d34645`. The review round then changed the route without changing these outcomes: a box can still take a gesture after a few pixels of jitter the other way, the gesture stays with the box it began on (as the browser's own scroll does) even if the pointer drifts, what is under the pointer is read only while a gesture is undecided, and a column or pane at its end keeps the rest of a turn from the stage (`overscroll-behavior-y: contain`). Those are covered by `slideNav.test.ts`, not by a second launch.

## Not verified

- A real Mac trackpad and a real mouse: the gestures here are protocol events of the same shape (pixel deltas, timing), not hardware. Real trackpad momentum can run longer than the 40 events used here; a second flick during the first one's momentum still counts as the same gesture (one slide per gesture, as designed).
- A tabs block's pane: it scrolls by the same rule as the column (any box on the slide whose words overflow and scroll), but this deck has no tabs.
- Windows.
