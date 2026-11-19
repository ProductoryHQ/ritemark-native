# Sprint 166 follow-up: a chosen slide from its top (#902)

One isolated dev launch (`scripts/qa/dev-launch-isolated.sh`, its own short profile and port, Decks on and auto-save off in that profile only), on this branch's head with the extension compiled from it and the shell a copy of the main dev tree with the canonical patches. A synthetic deck of 12 slides, each a title and five points with a handout part of four paragraphs. Slide and handout, the strip shown, the page held at 1440×560 (Chrome DevTools Protocol device metrics; Electron has no window-bounds command) and the split dragged right, so the slide's pane (`.deck-stage`) scrolls 122 px, as in the close-out. Input was real input through the protocol: a wheel notch is one 100 px wheel event; clicks and keys are mouse and key events.

The "before" rows ran on main's webview bundle in the same window (swapped in, then Reload Window), the "after" rows on this branch's bundle (put back, Reload Window).

| # | Bundle | Before the choice | Choice | Slide | Pane after |
| --- | --- | --- | --- | --- | --- |
| 1 | main | pane 122 (two notches over the slide) | click on thumbnail 5 | 1 → 5 | **122** (from its foot) |
| 2 | main | pane 122 | End, the focus on the strip | 5 → 12 | **122** |
| 3 | branch | pane 122 | click on thumbnail 5 | 1 → 5 | **0** |
| 4 | branch | pane 122 | End, the focus on the strip | 5 → 12 | **0** |
| 5 | branch | pane 122 | Home, the focus on the strip | 12 → 1 | **0** |
| 6 | branch | pane 122 | ↓, the focus on the strip | 1 → 2 | **0** |
| 7 | branch | pane 122 (its end) | a notch down over the slide (#871) | 2 → 3 | 0 (going on: from its top, unchanged) |
| 8 | branch | pane 0 | a notch up over the slide (#871) | 3 → 2 | 122 (going back: from its end, unchanged) |

Shots: `0-pane-scrolled-down-1440x560.png` (slide 1, its pane at its end), `1-before-strip-click-pane-left-1440x560.png` (row 1: slide 5's title out of view), `2-after-strip-click-from-top-1440x560.png` (row 3), `3-after-end-from-top-1440x560.png` (row 4), `4-after-home-from-top-1440x560.png` (row 5), `5-wheel-forward-from-top-1440x560.png` (row 7), `6-wheel-back-from-end-1440x560.png` (row 8).

Not driven: Contents (the deck's editor has none) and the go-to box (on the wall and in the presenter view, which show the whole slide and have no pane to scroll). Every other way of choosing a slide in the editor (a comment's Previous and Next, the handout's rail, an undo's flash, a slide's menu) goes through the same `pick` and is covered by the source test in `slideNav.test.ts`, not driven live.
