# Decks fixes of 17 November (PR #771): proof

These are Jarmo's findings from testing the dev build with a real 49-slide deck, plus the Experience lead's view switch. Jarmo's deck is client material, so every case here comes from a fixture deck written in the demo project's style. It is a `.deck.md` of 8 slides, kept outside the repo:

1. A cover with a three-line title.
2. A title that is one long word.
3. A five-box agenda with long Estonian words.
4. A five-column table.
5. A title-only slide.
6. A section slide.
7. A tall picture under a long title.
8. A picture whose file doesn't exist.

The fixture also holds `images/tall.png` and `images/wide.png`.

Every run used an isolated dev instance (`scripts/qa/dev-launch-isolated.sh`) with no AI sign-in. Shots are 1440 × 900 at 2×.
- **Before:** a build of `main` 6acbc914.
- **After:** the PR's final head.

## The fit: stage against strip, measured

The fit step of the stage and of each thumbnail, read from the running app. Each thumbnail was measured on its own, with slide 1 on the stage. "Clip" means words past the top, the bottom or a right edge of the slide.

| Slide | Before: stage | Before: thumbnail | After: stage | After: thumbnail |
| --- | --- | --- | --- | --- |
| 1 cover | 0 | 0 | 0 | 0 |
| 2 long word | 0 (word split mid-word) | 0 (split) | 2 (whole word) | 2 |
| 3 five boxes | **1** | **0** (words split) | 4 (whole words) | 4 |
| 4 table | 0 | 0 | 0 | 0 |
| 5 title only | 0 | 0 | 0 | 0 |
| 6 section | 0 | 0 | 0 | 0 |
| 7 picture + long title | **4** | **0, title 178 px past the top** | 0, picture shrinks, title whole | 0 |
| 8 missing picture | 0, picture silently gone | 0 | 0, "Picture not found · gone.png" + Replace picture… | 0 |

Causes found:
- **The strip measured differently from the stage.** It used only `scrollHeight`, which misses words past the top and sideways.
- **A title over a picture was drawn as a cover slide.** So the picture pushed the title up and off the slide.
- **The stage's first step could be taken before its picture loaded,** and the hysteresis then held it there.
- **Words broke mid-word** because of `overflow-wrap: anywhere`.

## Shots

**Before**, AI column folded: `before-slide1-ai-folded-1440x900.png` … `before-slide8-ai-folded-1440x900.png`.
- They show slide 3 split mid-word with a "+" on every box, and thumbnail 7 with its title cut off.
- They also show the fold arrows on the divider.

`before-slide8-missing-picture-ai-open-1440x900.png` (AI column open) shows the missing picture gone silently.

**After**, with the AI column folded and the left column showing the project list:
- `after-slide1-ai-folded-1440x900.png` … `after-slide8-ai-folded-1440x900.png`: the strip next to the stage for each case.
- `view-slide-only-…`, `view-both-…` and `view-handout-only-ai-folded-1440x900.png`: the switch in each state.
- `crop-bar-slide-only.png`, `crop-bar-both.png` and `crop-bar-handout-only.png`: the bar with the switch, close up.
- `crop-divider-nothing-on-it.png`: the line between the panes, with nothing on it.
- `crop-box-long-word.png`: boxes with long words, kept whole.
- `plus-on-edited-box-ai-folded-1440x900.png` and `crop-plus-on-edited-box.png`: the "+" place on the box with the caret only.
- `after-move-slide7-ai-folded-1440x900.png`: the deck moved into `Arhiiv/`. Its picture still shows.

**After**, with the AI column open (left column folded, so the strip fits):
- `after-slide3-ai-open-1440x900.png`, `after-slide7-ai-open-1440x900.png`, `after-slide8-ai-open-1440x900.png`.
- `view-slide-only-…`, `view-both-…` and `view-handout-only-ai-open-1440x900.png`: with the slide above the handout, the middle icon shows the panes one above the other (`square-split-vertical`).

## A move in the app (final head)

- **The move:** Rename to `Arhiiv/Fit cases.deck.md` changed exactly two lines, `images/tall.png` → `../images/tall.png` and `images/gone.png` → `../images/gone.png`. The deck was saved.
- **Picture files:** both kept the same SHA-1 before and after: `tall.png` 65262ddb…, `wide.png` 5108d9d9….
- **Moving back:** Cut and Paste back into `Koolitus/` restored the text byte for byte (`diff` empty).
- **One Undo inside the deck editor did not restore the paths.** After a rename, VS Code opens the deck afresh at its new address, so the editor's history starts after the rebase. Moving the deck back restores them.

## Keys after Slide only (final head)

With Slide only pressed and the focus still on it, ↓ ↓ ↑ took the deck from slide 3 to 4, 5, then back to 4. All three switch buttons take the keyboard focus.

## Not verified

- **One Undo inside the deck editor after a move.** Tried; it does not restore the paths (see above).
- **The explorer's own Undo of a move (⌘Z in Documents).** Not tried, because the automation's key events don't reach VS Code's keybindings. That Undo is a move back, which is verified.
- **Windows:** paths with drive letters are covered only by the unit test that refuses a path between two drives.
- **The published page in Safari before 17.6.** It falls back to `justify-content: flex-end` for covers; not checked in that browser.
- **Thumbnail measuring time on a 49-slide deck.** Not measured; the fixture has 8 slides.
