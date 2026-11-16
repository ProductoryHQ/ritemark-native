# Card or Borderless in the gear's popup: proof

Jarmo, 16 November: "card/borderless buttons also to settings?". The Experience lead drew it in experience 46's README, "Card or Borderless lives in the gear's popup" (ritemark-dev d89220d), and asked the same evening that the gear stay enabled while the slide is hidden.

One dev window of this branch (after merging #761), started on 16 November at about 22:50 EET with `scripts/qa/dev-launch-isolated.sh` (a fresh profile, throwaway AI homes, `--use-mock-keychain`), on a copy of Sprint 157's demo project with `ritemark.features.decks` on in its settings. The left column and the AI column were folded, and the page was held at 1440 × 900 by a device-metrics override (`../handout-text/hold-size.mjs.txt`), so the shots are 1440 × 900 at 2×. `../handout-text/hcdp.mjs.txt` drove it: Quick Open, palette commands, real mouse presses into the deck webview, and shots. It was launched once and stopped at once (`LEFT=0`).

## Shots for the Experience lead

| What | File |
|---|---|
| The bar without the segment: the strip button, "Slide 6 of 13" and the gear on the left; Saved, Publish and Present on the right. (The ⋯ on slide 6's thumbnail is the hover its click left.) | `bar-without-segment-1440x900.png` |
| The popup open on a Card deck: the library lines, Layout, Look, Picture, Skip slide, then a line, THIS DECK · ALL 13 SLIDES, and Card \| Borderless across the popup | `popup-card-deck-1440x900.png` |
| The same deck after Borderless was chosen in the popup: the slide and the strip on white, the popup still open | `popup-borderless-deck-1440x900.png` |
| The popup's last section, close up | `popup-deck-section-closeup.png` |
| The slide hidden (‹): the gear stays enabled and opens the same popup, for slide 6, which the strip rings | `popup-slide-hidden-1440x900.png` |
| Before, on main: the segment on the bar, between the notice and Saved | `before-main-bar-1440x900.png` |
| A deck with no slides (second window): the gear is enabled and its popup is the deck's section alone, THIS DECK · NO SLIDES YET, then Card \| Borderless | `popup-empty-deck-1440x900.png` |
| A short window (the page held at 1440 × 600): the popup stops 8 px above the bottom, 474 px of its 575, and scrolls | `short-window-popup-top-1440x600.png` |
| The same popup after one wheel turn over it: scrolled to the end (101 px), with Card \| Borderless inside it | `short-window-popup-scrolled-1440x600.png` |

## What the window showed

Read from the deck webview after each real mouse or key event:

```
open the deck                bar "Slide 1 of 13 Saved Publish Present", no radio group in the bar
gear                         popup open, gear data-state active, aria-expanded true
popup's children, in order   head "Slide 6", the library lines, line, Layout, Look, Picture, line,
                             Skip slide, line, "This deck · all 13 slides" (text-transform: uppercase), Card | Borderless
segment width                292 of the popup's 316 (its padding is 12 a side): the full width
Tab from the popup           Close, Keep it here, Update the library, Layout, Look, Picture, Skip slide, Card | Borderless, then out
gear, Esc                    popup closed, focus on the gear
gear, press on the handout   popup closed, focus in the handout (the press made part 7 current)
gear, Borderless             look "borderless" checked, the stage is-borderless, popup still open, file gains `look: borderless`
Hide the slide               no stage; gear enabled (disabled: false)
gear with the slide hidden   popup open, the same children, "This deck · all 13 slides"
another deck (3 slides)      "This deck · all 3 slides"
```

## Second window (after the Development manager's ask on #764)

A second isolated window of head `5b59c960` was started at about 23:25 EET and stopped right after (`LEFT=0`). It ran on the same scratch copy, with two empty decks added.
- **A deck with no slides:** the gear was enabled. Its popup held one group, 316 × 74 px: THIS DECK · NO SLIDES YET, then Card \| Borderless. It had no line, slide head or slide section. Choosing Borderless kept it open.
- **The short window:** the popup had `max-height: 474px` and `overflow-y: auto`. Its scrollbar takes a few pixels at the right, so there the lines between sections stop at the scrollbar instead of at the popup's edge.

## The front matter, byte for byte

`front-matter-bytes.txt`: Borderless chosen through the popup on this branch and through the bar on main's own bundle (swapped in for one reload of the same window) wrote byte-identical files, each one line more than before: `look: borderless`. The same held for a deck with no slides, in the second window.

## Not shown

- **The tooltip on screen.** The window was driven over CDP and no tooltip was captured. The segment keeps the shared `Tooltip` with the bar's words, which the unit test checks.
- **Dark theme.** Light only.
- **A toast after the reload:** "Activating extension 'GitHub.copilot-chat' failed: The default value for setting chat.cli.planExitMode.enabled is different in packageJson and in code." It is the dev tree's built-in `extensions/copilot` at the VS Code pin; `build-prod.sh` removes that extension from product builds. Not this change.
