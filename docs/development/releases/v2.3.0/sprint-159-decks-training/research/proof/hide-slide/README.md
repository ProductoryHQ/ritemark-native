# Hide the slide: proof

A dev window of the `deck-hide-slide` branch, on a copy of Sprint 157's demo project, with `ritemark.features.decks` turned on in its settings. It was started on 16 November at 19:14 with `scripts/qa/dev-launch-isolated.sh`, so it had a fresh profile, throwaway AI homes and `--use-mock-keychain`, and it was stopped at 19:22 (`LEFT=0`). The page was held at 1440 × 900 by a device-metrics override, so the shots are 1440 × 900 at 2×. The deck was driven with the CDP scripts of the handout-text proof (`../handout-text/hcdp.mjs.txt`, `../handout-text/hold-size.mjs.txt`).

## Shots for the Experience lead

| What | File |
|---|---|
| The default view: ‹ Hide the slide over › Hide the handout on the dotted line, AI column open | `default-both-buttons-ai-open-1440.png` |
| The two buttons, close up | `divider-buttons-closeup.png` |
| The slide hidden, AI column open (taken right after the column opened: part 6's heading had scrolled above the top while the handout narrowed) | `slide-hidden-ai-open-1440.png` |
| The slide hidden, AI column folded | `slide-hidden-ai-folded-1440.png` |

## What the window showed

- **Both sides shown:** two buttons on the line, "Hide the slide" (26 px, 36 px above) and "Hide the handout" (26 px, where the one fold was). Neither has a native `title`.
- **Hide the slide:** the stage, Settings and Speaker notes were gone (no `.deck-stage`, no Settings button, no "Speaker notes" text), and so was the divider's drag. The strip stayed. The handout ran from the strip's edge (132) to the right edge, its text 70 px in on each side: a column of 745 px, centred, at most 760 (the 15 px scrollbar lane takes the rest). The line between slides ran the handout's full width (left 132, 885 wide). One button showed: "Show the slide", at the handout's left edge.
- **The strip with the slide hidden:** clicking slide 6's thumbnail made it the current slide ("Slide 6 of 13", the ring on 6) and scrolled the handout to part 6 (`slide-hidden-ai-folded-1440.png`).
- **Show the slide:** the stage, Settings and the notes came back, with both buttons.
- **Hide the handout** with the slide shown: the handout folded and one "Show the handout" button stayed, as before. Pressing it brought both buttons back. While either side is hidden there is no button to hide the other.
- **Kept per deck, in view state:** after Hide the slide, the deck's view state was `{"deckFold":"slide"}`. "Data in Excel", opened next, showed both sides and had no fold in its state. After Developer: Reload Window the first deck still had its slide hidden. Closing the deck's tab and opening it again showed both sides: VS Code drops a webview's state with its tab, as it drops the divider's share.
- **Opening a deck writes nothing:** after opening, folding either side, closing, reopening and reloading, both decks had the SHA-256 of their copies (`6e7c409d…` and `62a4c807…`). "Data in Excel" kept its mtime from before the launch.

## Not shown

- **The scroll rule with the slide hidden.** The window's page reported `document.hidden` during the run, so `requestAnimationFrame` never fired and neither wheel nor scroll could move the current slide. The same was true with the slide shown, so this was the run, not this change. The handout's scroll container and its listeners are the same element in both layouts.
- **The tooltips on screen.** For the same reason, a hover drew no tooltip. Both buttons use the shared `Tooltip`, and the unit test checks there's no native `title`.
- **An outside edit during the run.** At 19:15:52, while the window was open, the deck's first heading was changed from "Welcome" to "Sissejuhatus", and the handout's headings were written into the file. The test drove no typing then. The copy was put back at once, and every shot and hash above is from after that.
