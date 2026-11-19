# Sprint 166 close-out: the live checks

One isolated dev launch (`scripts/qa/dev-launch-isolated.sh`, its own short profile and port, Decks on and auto-save off in that profile only), on main `c25a6687` (the extension compiled from it, the shell a copy of the main dev tree with the canonical patches). A synthetic deck of 12 block slides, each with a handout part of four paragraphs; slides 3 and 8 have a Columns block whose left column holds twenty points (500 px more than its room). Input was real input through the Chrome DevTools Protocol: a mouse-wheel notch is one 100 px wheel event, a trackpad flick is 40 wheel events 16 ms apart falling off from 24 px. "Pane" is the slide's side of the deck view (`.deck-stage`); its numbers are its scroll position out of its most.

## 1. The slide's pane keeps its place by direction (#871)

Slide and handout, the window 1440×560 and the split dragged right so the slide is wider than its room: the pane scrolls 122 px. In a 1440×900 window the slide fits its pane at any split, so this needs a short window.

| # | Gesture | Where | Slide | Pane |
| --- | --- | --- | --- | --- |
| 1 | Notch down | over the slide | 1 → 1 | 0 → 100 (the pane scrolls first) |
| 2 | Notch down | over the slide | 1 → 1 | 100 → 122 (its end) |
| 3 | Notch down | over the slide | 1 → **2** | **0** (going on: from its top) |
| 4 | Notch down | over the slide | 2 → 2 | 0 → 100 |
| 5 | Notch up | over the slide | 2 → 2 | 100 → 0 |
| 6 | Notch up | over the slide | 2 → **1** | **122** (going back: from its end) |
| 7 | Notch down | over the slide, pane at its end | 1 → **2** | **0** |
| 8 | Flick down | over the slide | 2 → 2 | 0 → 122 |
| 9 | Flick down | over the slide | 2 → **3** | **0** |
| 10 | Flick up | over the slide | 3 → **2** | **122** |
| 11 | Flick up | over the slide | 2 → 2 | 122 → 0 |
| 12 | Flick down | band under the slide | 2 → 2 | 0 → 122 |
| 13 | Flick down | band under the slide | 2 → **3** | **0** |
| 14 | Notch up | band under the slide | 3 → **2** | **122** |
| 15 | Notch up ×2 | band under the slide | 2 → 2 | 122 → 22 → 0 |

Each step lands where the gesture goes on, as the decks README and #871 say. Shots: `1-forward-pane-at-top-1440x560.png` (row 7: slide 2 from its top), `2-back-pane-at-end-1440x560.png` (row 6: slide 1 from its end).

## 2. A chosen slide from its top (the Experience lead's rule)

The same window. Before each choice the pane had been scrolled down with the wheel over the band: to its end (122), and to 100 before row 2.

| # | Choice | Slide | Pane after | Rule met |
| --- | --- | --- | --- | --- |
| 1 | Click on thumbnail 5 in the strip | 2 → 5 | **122** | no: slide 5 shows from its foot |
| 2 | End, the focus on the strip | 6 → 12 | **100** (as it was) | no |
| 3 | Home, the focus on the strip | 2 → 1 | **122** | no |
| 4 | ↓, the focus on the strip | 1 → 2 | **122** | no |
| 5 | End, then Home, on the stage in Slide only | 1 → 12 → 1 | 0 (the slide fits its pane in Slide only) | yes |

The wheel's step sets the pane (`stageScrollAfter`); a choice from the strip (`pick`) scrolls the handout to the slide's part but leaves the slide's pane where it was. Shot: `3-strip-click-pane-left-at-end-1440x560.png` (row 1: slide 5 chosen, its title out of view above).

Not driven: Contents (the deck's editor has no Contents control); the go-to box on the wall and in the presenter view (typing a number). The wall and the presenter view's Now show the whole slide, with nothing to scroll.

## 3. Thumbnail clicks (#875) on the wall's grid and in the presenter view

#875's own launch ran the strip only. Here the wall (full screen) and then the presenter view (the dev build's windowed mode, `RITEMARK_PRESENT_WINDOWED=1`, on one display), each at 1440×900.

| # | Where | Action | Result |
| --- | --- | --- | --- |
| 1 | Wall, **All slides** grid | 1 notch over slide 8's long column | column unscrolled (the shot: Point One at its top) |
| 2 | Wall, **All slides** grid, opened again | 2 notches there | column stays at 0 of 500 |
| 3 | Wall, **All slides** grid | click on slide 8's centre | the wall shows slide 8 (from 3) |
| 4 | Wall, **All slides** grid | click in slide 8's column words | the wall shows slide 8 (from 5) |
| 5 | Presenter view, row | click on thumbnail 2's centre | Now: slide 2 |
| 6 | Presenter view, row | 2 notches over thumbnail 3's long column | column stays at 0 of 500 |
| 7 | Presenter view, Next (slide 3) | 2 notches over its long column | column stays at 0 of 500 |
| 8 | Presenter view, row | click on thumbnail 3's centre | Now: slide 3 |
| 9 | Presenter view, row | click in thumbnail 3's column words | Now: slide 3 (from 1) |
| 10 | Strip | click on thumbnail 3's centre | slide 3 chosen |

In every thumbnail the columns reported `pointer-events: none`, and the point under a column's words was the thumbnail's slide, not the column. Shots: `4-wall-grid-after-wheel-1440x900.png` (row 1: slide 8's column still shows Point One to Eight with its fade), `5-presenter-centre-click-1440x900.png` (row 8).

## 4. The gesture in Slide only (#849), at 1440×900

| # | Gesture | Where | Slide |
| --- | --- | --- | --- |
| 1 | Notch down | over the slide | 1 → 2 |
| 2 | Flick down | over the slide | 2 → 3 |
| 3 | Flick down | over slide 3's long column | 3 → 3 (the slide stays; the column takes the flick) |
| 4 | Flick up | over the slide's right side | 3 → 2 |
| 5 | Flick down | band under the slide | 2 → 3 |

Slide and handout: section 1. Shot: `6-slide-only-after-flicks-1440x900.png`.

## 5. #860: a renderer crash, then Reopen

`plain-860.md` (six lines) open in the text editor, auto-save off. The window's renderer was crashed from the main process (`webContents.forcefullyCrashRenderer()` over the main process's inspector). The dialog said "The window terminated unexpectedly (reason: 'killed', code: '2')" with Reopen and Close; Reopen was chosen by answering that dialog's call with its first button from the main process (no native click), so the Reopen code path ran as is.

- **First crash**, seconds after the file was opened: the reopened window did not restore its tab (the editor state had not been saved yet). Opened again, it showed its six lines, not dirty.
- **Second crash**, 75 s later: the reopened window restored `plain-860.md` as the active tab with its six lines, not dirty, and the deck tab with its 12 slides.
- Both files on disk kept their bytes through both crashes (same SHA-1 before and after).

So a crash and Reopen does not double the text the way a raw `Page.reload` does. Shot: `7-860-crash-reopen-not-doubled-1440x900.png`.

## Seen in the run

- A toast at the start: "Activating extension 'GitHub.copilot-chat' failed: The default value for setting chat.cli.planExitMode.enabled is different in packageJson and in code." It comes from the dev tree's built-in Copilot Chat extension, not from Ritemark's; not looked into further.
- The first, full-screen wall closed by itself about a minute after the last grid click, with no Esc sent; the deck view came back on slide 8, as a Stop leaves it. Not reproduced or looked into.

## Not verified

- A real Mac trackpad and a real mouse: protocol events of the same shape.
- The presenter view on a real second display (it ran in the windowed mode on one display).
- The go-to box, and Contents on the published page.
- Windows.
