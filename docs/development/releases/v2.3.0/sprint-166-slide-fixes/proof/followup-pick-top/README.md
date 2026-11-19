# Sprint 166 follow-up: a chosen slide from its top (#902)

Two isolated dev launches (`scripts/qa/dev-launch-isolated.sh`, each with its own short profile and port, Decks on and auto-save off in that profile only), the extension compiled from the branch and the shell a copy of the main dev tree with the canonical patches. A synthetic deck of 12 slides, each a title and five points with a handout part of four paragraphs. Slide and handout, the strip shown, the page held at 1440×560 (Chrome DevTools Protocol device metrics; Electron has no window-bounds command) and the split dragged right, so the slide's pane (`.deck-stage`) scrolls 122 px, as in the close-out. Input was real input through the protocol: a wheel notch is one 100 px wheel event; clicks and keys are mouse and key events.

- **Launch 1** (the "before" rows): main's webview bundle swapped into the same window, then Reload Window.
- **Launch 2** (the "after" rows): the final code, the branch with main merged in (`10770d1f`), where one layout effect on the shown slide sets the pane.

| # | Code | Before the choice | Choice | Slide | Pane after |
| --- | --- | --- | --- | --- | --- |
| 1 | main | pane 122 (two notches over the slide) | click on thumbnail 5 | 1 → 5 | **122** (from its foot) |
| 2 | main | pane 122 | End, the focus on the strip | 5 → 12 | **122** |
| 3 | final | pane 122 | click on thumbnail 5 | 1 → 5 | **0** |
| 4 | final | pane 122 | End, the focus on the strip | 5 → 12 | **0** |
| 5 | final | pane 122 | Home, the focus on the strip | 12 → 1 | **0** |
| 6 | final | pane 122 | ↓, the focus on the strip | 1 → 2 | **0** |
| 7 | final | pane 122 (its end) | a notch down over the slide (#871) | 2 → 3 | 0 (going on: from its top, unchanged) |
| 8 | final | pane 0 | a notch up over the slide (#871) | 3 → 2 | 122 (going back: from its end, unchanged) |

The same slide keeps its place (final code, slide 2, the pane scrolled to 82 of 122):

| # | Action | Pane after |
| --- | --- | --- |
| 9 | the split dragged 20 px left | 82 (of 118 now) |
| 10 | a click on the view switch's Slide and handout (already chosen, which runs the re-pick) | 82 |
| 11 | ⌘F (Find opens beside the handout), then Esc | 82, 82 |
| 12 | Slide only, then back to Slide and handout | 0: in Slide only the slide fits its pane (0 of 0), so nothing is left to keep |

Shots: `0-pane-scrolled-down-1440x560.png` (slide 1, its pane at its end), `1-before-strip-click-pane-left-1440x560.png` (row 1: slide 5's title out of view), `2-after-strip-click-from-top-1440x560.png` (row 3), `3-after-end-from-top-1440x560.png` (row 4), `4-after-home-from-top-1440x560.png` (row 5), `5-wheel-forward-from-top-1440x560.png` (row 7), `6-wheel-back-from-end-1440x560.png` (row 8). Shots 2–6 are from launch 2.

Not driven: Contents (the deck's editor has none) and the go-to box (on the wall and in the presenter view, which show the whole slide and have no pane to scroll). The other ways of choosing a slide in the editor (a comment's Previous and Next, the handout's rail, an undo's flash, a slide's menu, the handout read on into the next part) change the shown slide and so pass through the same effect; they were not driven live, and the source test checks the wiring, not each path.
