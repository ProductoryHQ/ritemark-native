# Sprint 166 PR 10: a gesture over the slide moves one slide in Slide and handout too (#855)

One isolated dev launch (`scripts/qa/dev-launch-isolated.sh`, its own profile and port, Decks on in that profile only), the window at 1440×900, the project side bar and the AI pane hidden so the strip shows. A synthetic deck of six slides (`nav.deck.md`, block slides; slide 2 has a Columns block whose left column holds twenty points, 882 px of words in a 382 px column), each with four paragraphs of handout (a part is 361 px tall: part 2's head sits at 355 px, part 3's at 716, part 4's at 1077). The view switch was set to **Slide and handout**. The same run was recorded twice in that one launch: first with main's webview (`a4a8aa69`), then, after a rebuild of the webview and Reload Window, with this branch's.

How each gesture was sent (real input through the Chrome DevTools Protocol, as in PR 2):

- **Mouse wheel:** wheel events of 100 px a notch, 150 ms apart (each one its own notch).
- **Trackpad flick:** 40 wheel events, 16 ms apart, falling off from 24 px as momentum does (about 236 px in all).

The slide's number after each gesture is the deck bar's "Slide N of 6". "Part N at the handout's top" is the part whose head is nearest the handout's top after the gesture, where a click on the strip's thumbnail puts it.

## Slide and handout

| # | Gesture | Where | Before (main `a4a8aa69`) | After |
| --- | --- | --- | --- | --- |
| 1 | Mouse wheel, 1 notch down (100 px) | over the slide | 1 → **1** (part 1 at the handout's top) | 1 → **2** (part 2 at the handout's top) |
| 2 | Mouse wheel, 2 notches down | over the slide | 1 → **1** (part 1 at the handout's top) | 2 → **4** (part 4 at the handout's top) |
| 3 | Mouse wheel, 1 notch up | over the slide | 1 → **1** (part 1 at the handout's top) | 4 → **3** (part 3 at the handout's top) |
| 4 | Trackpad flick down | over the slide | 1 → **1** (part 1 at the handout's top) | 3 → **4** (part 4 at the handout's top) |
| 5 | Trackpad flick up | over the slide | 1 → **1** (part 1 at the handout's top) | 4 → **3** (part 3 at the handout's top) |
| 6 | Trackpad flick up | over the slide | 1 → **1** (part 1 at the handout's top) | 3 → **2** (part 2 at the handout's top) |
| 7 | Mouse wheel, 1 notch down | the band under the slide | 1 → **1** (part 1 at the handout's top) | 2 → **2** (part 2 at the handout's top) |
| 8 | Trackpad flick down | the band under the slide | 1 → **1** (part 1 at the handout's top) | 2 → **2** (part 2 at the handout's top) |
| 9 | Trackpad flick down | over the long column (slide 2) | 2 → **2** (column at 238 of 500, part 2 at the handout's top) | 2 → **2** (column at 238 of 500, part 2 at the handout's top) |
| 10 | Mouse wheel, 3 notches down | over the long column | 2 → **2** (column at 500 of 500, part 2 at the handout's top) | 2 → **2** (column at 500 of 500, part 2 at the handout's top) |
| 11 | Mouse wheel, 1 notch down (the column at its end) | over the long column | 2 → **2** (column at 500 of 500, part 2 at the handout's top) | 2 → **3** (part 3 at the handout's top) |
| 12 | Mouse wheel, 1 notch down | over the handout | 1 → **1** (handout scrolled to 100 px) | 1 → **1** (handout scrolled to 100 px) |
| 13 | Mouse wheel, 1 notch down | over the handout | 1 → **2** (handout scrolled to 200 px) | 1 → **2** (handout scrolled to 200 px) |
| 14 | Mouse wheel, 1 notch down | over the handout | 2 → **2** (handout scrolled to 300 px) | 2 → **2** (handout scrolled to 300 px) |
| 15 | Mouse wheel, 1 notch down | over the handout | 2 → **2** (handout scrolled to 400 px) | 2 → **2** (handout scrolled to 400 px) |
| 16 | Trackpad flick down | over the handout | 2 → **3** (handout scrolled to 638 px) | 2 → **3** (handout scrolled to 638 px) |
| 17 | Trackpad flick down | over the handout | 3 → **4** (handout scrolled to 876 px) | 3 → **4** (handout scrolled to 876 px) |
| 18 | Trackpad flick up | over the handout | 4 → **3** (handout scrolled to 638 px) | 4 → **3** (handout scrolled to 638 px) |
| 19 | Mouse wheel, 1 notch up | over the handout | 3 → **3** (handout scrolled to 538 px) | 3 → **3** (handout scrolled to 538 px) |
| 20 | Mouse wheel, 1 notch down | over the slide | 3 → **3** (part 3 at the handout's top) | 3 → **4** (part 4 at the handout's top) |

Rows 1 to 8 start from slide 1, chosen on the strip; rows 9 to 11 from slide 2; rows 12 to 20 from slide 1 again.

**What was broken (rows 1–6, 11, 20):** with the handout beside the slide, a wheel or flick over the slide did nothing. Now it moves one slide, as in Slide only, and the handout scrolls to that slide's part by the strip's own path (the part's head at the top). Two notches move two slides (row 2), every flick one (rows 4–6).

**What stays as it was:**
- Over the handout's text (rows 12–19) the wheel scrolls the text, and the slide follows the part being read, one part per turn at most (the scroll rule, unchanged): the same in both columns.
- A long column on the slide scrolls first and keeps the whole gesture (rows 9–10, as #849 made it in Slide only); at its end the next gesture moves the slide (row 11; on main the slide never moved).
- A window too short for the slide (review of #871): beside the handout the slide keeps its width, so the stage can be shorter than the slide. Over the slide the stage then scrolls first, as a long column does, so the slide's foot can be reached, and at its end the next gesture moves the slide. In this run the stage fits (780 px for a 264 px slide), so nothing scrolls first; the rule is in `slideNav.test.ts`.
- The band under the slide (rows 7–8): beside the handout it is the stage's own scroll and never steps. The design names only the slide for this view ("over the slide, a gesture means the same in every view"); in Slide only the space around the slide steps as before (below).

## Slide only, unchanged

The same launch, this branch, view switch on **Slide only**:

| # | Gesture | Where | After |
| --- | --- | --- | --- |
| 1 | Mouse wheel, 1 notch down | over the slide | 1 → **2** |
| 2 | Trackpad flick down | over the slide | 2 → **3** |
| 3 | Mouse wheel, 1 notch up | over the slide | 3 → **2** |
| 4 | Mouse wheel, 1 notch down | the band under the slide | 2 → **3** |
| 5 | Trackpad flick up | the band under the slide | 3 → **2** |

## The slide above the handout

The same launch, this branch, the window narrowed to 1000×900 so the slide sits above the handout (`deck-stage is-above`): over the slide, one notch down 1 → **2**, one more 2 → **3**, one up 3 → **2**, and the handout at part 2's head (355 px).

## The test that fails before

`webview/src/components/decks/slideNav.test.ts` asks for the views the stage's wheel listens in (`stageWheelOf`: Slide only and Slide and handout, never Handout only), for the rule beside the handout (over the slide the slide moves, a long column first; the band stays the stage's, and a flick there moves nothing), and reads the deck view's wiring (the wheel listens whenever the slide is shown; the keys still only in Slide only). On main it fails: `The requested module './slideNav' does not provide an export named 'stageWheelOf'`, and the wiring it reads (`if (!fullSlide || !stage) return`) is main's Slide-only guard.

## Shot (1440×900)

- [two-notches-over-the-slide-1440x900.png](two-notches-over-the-slide-1440x900.png): this branch, Slide and handout. Slide 1 chosen on the strip, then two mouse-wheel notches over the slide: the deck is on slide 3, its thumbnail ringed, and the handout has scrolled to part 3.

## Not verified

- A real Mac trackpad and a real mouse: the gestures are protocol events of the same shape (pixel deltas, timing), not hardware.
- The slide above the handout beyond the three notches above (no flick, no long column there).
- A window too short for the slide beside the handout, live: the stage scrolling first over the slide is covered by the test only (the review fix came after the launch).
- Windows.
