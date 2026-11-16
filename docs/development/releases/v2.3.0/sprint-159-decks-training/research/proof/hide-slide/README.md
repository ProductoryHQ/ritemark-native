# Hide the slide: proof

A dev window of the `deck-hide-slide` branch, on a copy of Sprint 157's demo project, with `ritemark.features.decks` turned on in its settings. It was started on 16 November at 19:14 with `scripts/qa/dev-launch-isolated.sh`, so it had a fresh profile, throwaway AI homes and `--use-mock-keychain`, and it was stopped at 19:22 (`LEFT=0`). The page was held at 1440 × 900 by a device-metrics override, so the shots are 1440 × 900 at 2×. The deck was driven with the CDP scripts of the handout-text proof (`../handout-text/hcdp.mjs.txt`, `../handout-text/hold-size.mjs.txt`).

## Shots for the Experience lead

| What | File |
|---|---|
| The default view: ‹ Hide the slide over › Hide the handout on the dotted line, AI column open | `default-both-buttons-ai-open-1440.png` |
| The two buttons, close up | `divider-buttons-closeup.png` |
| The slide hidden, AI column open, from the first run with the earlier 760 px column (taken right after the column opened: part 6's heading had scrolled above the top while the handout narrowed) | `slide-hidden-ai-open-1440.png` |
| The slide hidden, AI column folded: the Text editor's 900 px column (taken again after the Experience lead's change, in a second run) | `slide-hidden-ai-folded-1440.png` |
| Add to library with the slide hidden: the sheet beside slide 2's thumbnail (second run) | `add-to-library-slide-hidden-1440.png` |

## What the window showed

- **Both sides shown:** two buttons on the line, "Hide the slide" (26 px, 36 px above) and "Hide the handout" (26 px, where the one fold was). Neither has a native `title`.
- **Hide the slide:** the stage, Settings and Speaker notes were gone (no `.deck-stage`, no Settings button, no "Speaker notes" text), and so was the divider's drag. The strip stayed. The handout ran from the strip's edge (132) to the right edge. After the Experience lead's change it is the Text editor's own column: a 900 px box, centred, with the handout's text edges (48 and 32) inside it. In the second run, with the AI column folded, the handout was 1292 wide, and its text started 244 px in and ended 228 px from the right. The line between slides ran the handout's full width (left 132, 885 wide). One button showed: "Show the slide", at the handout's left edge.
- **The strip with the slide hidden:** clicking slide 6's thumbnail made it the current slide ("Slide 6 of 13", the ring on 6) and scrolled the handout to part 6 (`slide-hidden-ai-folded-1440.png`).
- **Show the slide:** the stage, Settings and the notes came back, with both buttons.
- **Hide the handout** with the slide shown: the handout folded and one "Show the handout" button stayed, as before. Pressing it brought both buttons back. While either side is hidden there is no button to hide the other.
- **Kept per deck, in view state:** after Hide the slide, the deck's view state was `{"deckFold":"slide"}`. "Data in Excel", opened next, showed both sides and had no fold in its state. After Developer: Reload Window the first deck still had its slide hidden. Closing the deck's tab and opening it again showed both sides: VS Code drops a webview's state with its tab, as it drops the divider's share.
- **Opening a deck writes nothing:** after opening, folding either side, closing, reopening and reloading, both decks had the SHA-256 of their copies (`6e7c409d…` and `62a4c807…`). "Data in Excel" kept its mtime from before the launch.

## Not shown

- **The scroll rule with the slide hidden.** The window's page reported `document.hidden` during the run, so `requestAnimationFrame` never fired and neither wheel nor scroll could move the current slide. The same was true with the slide shown, so this was the run, not this change. The handout's scroll container and its listeners are the same element in both layouts.
- **The tooltips on screen.** For the same reason, a hover drew no tooltip. Both buttons use the shared `Tooltip`, and the unit test checks there's no native `title`.
- **An outside edit during the run.** At 19:15:52, while the window was open, the deck's first heading was changed from "Welcome" to "Sissejuhatus", and the handout's headings were written into the file (the first-edit stamp, `handout: text`). The test typed nothing into the deck, and no code in the repository writes "Sissejuhatus". This was typing, so the stamp followed as it should. It wasn't the fold. The copy was put back at once, and every shot and hash above is from after that. After that, the slide was hidden and shown again several times, the handout once, the tab was closed and opened again, and the window was reloaded. The file's SHA-256 and mtime stayed as they were.

## Second run (the Experience lead's two changes)

A fresh isolated instance of the same branch was started on 16 November after 19:30 and stopped right after (`LEFT=0`). It ran on the same scratch copy, and the deck's SHA-256 was unchanged afterwards. The window's page was hidden again. Each screenshot forces a frame, so the layout was read after a few shots.
- **The column:** the solo handout takes `--deck-text-column` from the Editor's `TEXT_COLUMN_WIDTH` (900), the number the Text editor's own `max-width` rule uses.
- **Add to library:** with the slide hidden, slide 2's ⋯ → Add to library… opened its sheet beside slide 2's thumbnail, where the strip's own menus open. The sheet was cancelled.
