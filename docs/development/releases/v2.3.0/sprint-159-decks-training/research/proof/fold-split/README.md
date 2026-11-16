# Fold either side as one split control: proof

A dev window of the `deck-fold-split-button` branch, on a copy of Sprint 157's demo project, with `ritemark.features.decks` turned on in the test profile's settings. It was started on 16 November at 20:45 with `scripts/qa/dev-launch-isolated.sh`, so it had a fresh profile, throwaway AI homes and `--use-mock-keychain`, and it was stopped right after the checks (`LEFT=0`). The page was held at 1440 × 900 by a device-metrics override, so the shots are 1440 × 900 at 2×. The deck was driven with the CDP scripts of the handout-text proof (`../handout-text/hcdp.mjs.txt`, `../handout-text/hold-size.mjs.txt`). The hover was sent to the deck webview's own target.

## Shots for the Experience lead

| What | File |
|---|---|
| The default view: the pill upright at the bottom of the dotted line, AI column open | `default-split-pill-ai-open-1440.png` |
| The pill, close up | `split-pill-closeup.png` |
| The lower half hovered, close up: the soft fill, the arrow in the accent, the tooltip starting at the right | `split-pill-hover-lower-closeup.png` |
| The same hover, whole window, with the tooltip "Hide the handout" | `split-pill-hover-lower-1440.png` |
| The slide hidden: the single round › "Show the slide" at the handout's left edge | `slide-hidden-single-show-1440.png` |

## What the window showed

- **The pill:** one `.deck-fold.is-split` element, `role="group"`, 26 × 56, radius 13, white (`--r-surface`), with a 1 px `#CBD5E1` ring and the small shadow. Its two buttons are 26 × 28 each: "Hide the slide" on top (radius 13 13 0 0), "Hide the handout" below (0 0 13 13) with a 1 px hairline along its top. Neither has a native `title`.
- **The hover:** the hovered half turned `rgb(224, 231, 255)` with its icon `rgb(67, 56, 202)`, the other half stayed as it was, and the shared tooltip opened with "Hide the handout".
- **Hide the slide:** the stage went, and the control became one round 26 × 26 "Show the slide" at the handout's left edge. The keyboard focus stayed on that button.
- **Show the slide** brought the pill back. **Hide the handout** folded the handout and left one round "Show the handout" button; pressing it brought the pill back. Focus stayed on the pressed button each time.
- **Kept in view state:** after Hide the slide and Developer: Reload Window, the deck still had its slide hidden.
- **Opening a deck writes nothing:** the deck's SHA-256 was `6e7c409d…` before the launch and after it.

## Seen, not from this change

- After the first window opened, a toast said the built-in GitHub Copilot Chat extension failed to activate because a setting's default differs between its package.json and its code. The dev tree is a copy of `rundev-main`'s VS Code tree, and this branch changes no VS Code file or built-in extension. The toast was cleared before the shots.
