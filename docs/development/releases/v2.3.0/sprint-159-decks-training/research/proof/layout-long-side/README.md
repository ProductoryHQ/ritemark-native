# The slide along the room's long side: proof

A dev window of the `deck-layout-long-side` branch, on a copy of Sprint 157's demo project, with `ritemark.features.decks` turned on in the test profile's settings. It was started on 16 November at 21:10 with `scripts/qa/dev-launch-isolated.sh`, so it had a fresh profile, throwaway AI homes and `--use-mock-keychain`, and it was stopped after the checks (`LEFT=0`). The window was 1440 × 900 at 2×; the 1920 × 1080 shot and the width sweep held the page at those sizes with a device-metrics override. The deck was driven with the handout-text proof's CDP driver (`../handout-text/hcdp.mjs.txt`).

## Shots for the Experience lead

Retaken on 16 November at 22:05 after merging #759 (Slide settings in the deck's bar, the library line in its popup), in a second dev window with a fresh profile, so the stage above has no Settings row and no library line.

| What | File |
|---|---|
| 1440 × 900, the left column and the AI column folded: beside | `beside-ai-folded-1440.png` |
| 1440 × 900, the AI column open: above, the slide 636 × 358, the flat pill at the line's right end | `above-ai-open-1440.png` |
| 1440 × 900, the left column open: above, the slide 636 | `above-left-open-1440.png` |
| A 1920 × 1080 window with the AI column open: beside | `beside-ai-open-1920.png` |
| The flat pill at the line's right end, close up | `flat-pill-closeup.png` |
| Above, the handout hidden: the full slide, ˄ "Show the handout" at its bottom right | `above-handout-hidden-1440.png` |
| Above, the slide hidden: ˅ "Show the slide" at the handout's top left (first run) | `above-slide-hidden-1440.png` |

**The slide above is the pane's height less 32, at 16:9:** a pane of 390 gives a slide 636 × 358, with 16 above it. **One row is still under it: "Speaker notes".** It isn't part of #759 (the experience's "Notes are comments" removes it later), so the stage above is 48 px taller than its pane, the notes row sits under the level line and the slide's pane shows a scrollbar at its right. The slide itself is whole.

## What the window showed

- **Measured sizes** (CSS px, second run): AI and left column folded: room 1,292, beside, slide 469 wide, centred in its pane's height. AI open: room 900, above, the line at 390 of 780, slide 636 × 358 at 16 from the top. Left column open: room 1,044, above, slide 636. 1920 × 1080, AI open: room 1,380, beside, slide 504.
- **The boundary, swept by window width** (both columns folded, strip shown): beside down to a room of 1,100, above at 1,099; growing again it stayed above through 1,123 and went beside at 1,124. Each crossing moved the slide once.
- **The level line drags** and keeps its own share: dragged back to half after a reload, it stayed through the AI and left columns opening and folding, and the beside share stayed as it was.
- **The fold:** Hide the handout left the full slide with ˄ "Show the handout" at the bottom right, focus on it; Space on that button brought the handout back. Hide the slide left the handout's centred column with ˅ "Show the slide" at its top left. After Developer: Reload Window the hidden slide stayed hidden (view state).
- **Keys with the handout hidden**, focus on the page: ↓ Space PageDown went forward, PageUp ↑ ← back, → forward, End to 13, Home to 1. ⌘↓, ⇧Space and ⌥→ did nothing. With the caret in a slide's title, ↓ → ↑ End Home PageDown left the slide where it was. With the focus on the fold's button, the arrows moved the slide and Space pressed the button.
- **The wheel with the handout hidden** (wheel events dispatched on the slide in the webview, since the window was behind others and the browser throttled its timers): one 120 px notch moved one slide, and its default was prevented; a 60-event flick 16 ms apart moved one; 30 px in all moved none; three 80 px turns 450 ms apart moved three; two lines (80 px) moved one; a sideways swipe did nothing. With the handout shown, a wheel on the slide moved nothing and was not prevented.
- **Opening a deck writes nothing:** every `.deck.md` in the project had the same SHA-256 before the launch and after the checks. The second run's project, the same. (One space typed into a title by the key check was undone with ⌘Z before the file was compared.)

## The level line's share, read in a fresh profile (second run)

The share is read from the line's place (line ÷ the desk's height), since the webview's kept state can't be read from outside it.

| When | Orientation | Line / height | Share |
|---|---|---|---|
| After the first reload with the deck open | above | 390 / 780 | 0.500 |
| After the second reload | above | 390 / 780 | 0.500 |
| After the first run's command sequence replayed twice (pick, move off-screen, shot, AI and left column toggled through the palette) and a third reload | above | 390 / 780 | 0.500 |

The 69 % line seen once in the first run did not appear. No drag was made in the second run.

## Seen, not from this change

- The window was behind other windows the whole time: the webview reported `visibilityState` hidden, its renders came late and its timers were throttled. `Page.bringToFront` was sent before each shot.
- Once, in the first run, after several palette commands, the level line was found at 69 % with no drag of ours in the log, and it was kept across a reload. The share is written only when a drag on the line ends (`keepAboveRatio` in the drag's `up`), so a pointer press on the line must have reached the deck. It was not reproduced: in the first run a deliberate drag, panel toggles and reloads afterwards all behaved, and in the second run (fresh profile) three reloads and the replayed sequence read 0.500 each time. Left as unexplained.
- Changing the handout's width (a column opening or folding) reflows its text without scrolling the part being read back to the top, as it does today beside; the current slide can then move on by the scroll rule.
