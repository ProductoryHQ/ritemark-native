# An exercise's label is the slide's own words: proof

Run on 16 November 2026 after 18:00 EET, on macOS arm64, by the builder. One dev window of this branch was started with `scripts/qa/dev-launch-isolated.sh`, which gives it a fresh profile, throwaway AI homes and `--use-mock-keychain`. It was launched once and quit at once (`LEFT=0`). `ritemark.features.decks` was turned on in its user settings. The project was a copy of Sprint 157's demo project, and the deck was "AI assistants and agents", whose slide 8 is an exercise. The page was held at 1440 × 900 by a device-metrics override (`hold-size.mjs.txt`), so the shots are 1440 × 900 at 2×. `cdp.mjs.txt` drove the window: Quick Open, clicks in the deck webview, keys, and shots. The window was reloaded once, with Developer: Reload Window, after the fix described under "Found while shooting".

## The fault, then the fix

`fault.ts.txt` reads two slide blocks, one with `tag: Harjutus` and one with `tag: ""`, then lays them out for the stage and the page, and writes an edit.

- **On main** (`fault-on-main.txt`): the reader drops the line (`data.tag` is undefined). The stage and the page both draw "Exercise" for both slides, and an edit that sets the pill writes nothing to the file.
- **On this branch** (`fixed-on-branch.txt`): the reader keeps the words and the empty line. The stage draws the pill as text it can edit, the page draws "Harjutus" or no pill, and the edit writes `tag: Harjutus`.

When main's source files are put back under this branch's tests, the tests fail:
- `exerciseTag.test.ts`: `exerciseTagOf` is not there;
- `deckFormat.test.ts`: the line is never written;
- `ritemarkTools.test.ts`: `insert_slides` copies read no `tag`.

## In the window

1. **Opening writes nothing.** The deck's SHA-256 was `6e7c409d…93fc` before the launch. It was the same after the deck had been open on slide 1 and then slide 8, with nothing typed.
2. **Click into the pill.** The caret landed at offset 4, inside "Exer|cise", with nothing selected.
3. **Type over it.** I selected the pill's words and typed "Harjutus". The file got `tag: Harjutus` on the line after `title:`, and the thumbnail showed HARJUTUS too. Shots: `pill-harjutus-typing-1440.png` (caret in it), `pill-harjutus-1440.png` and `pill-harjutus-closeup.png`.
4. **Empty it.** The file says `tag: ""`.
   - With the caret still in the pill, the pill keeps its look, and "Exercise" shows faintly at 0.45 opacity (`pill-empty-caret-1440.png`, `pill-empty-caret-closeup.png`).
   - Once the caret leaves, the pill has `display: none`, and the thumbnail draws no pill.
5. **Undo in the pill** (Cmd+Z) brought back `tag: Harjutus` and its words. I then emptied the pill again.
6. **After a reload, slide 8 has no pill** on the stage or in the strip (`pill-none-1440.png`, `pill-none-closeup.png`).
7. **Settings → Label.**
   - Only on an exercise. The field is empty, with "Exercise" as its placeholder, because the pill is off (`settings-label-empty-1440.png`).
   - Typing "Harjutus" wrote `tag: Harjutus`, and the pill came back (`settings-label-harjutus-1440.png`).
   - Cmd+Z in the field put back `tag: ""` in one step, and Cmd+Shift+Z put back `tag: Harjutus`.
8. **The file after it all** (`deck-after-edits.diff.txt`) differs from the demo deck only by that one line, `tag: ""`.

## Focusing and leaving without typing writes nothing (the Experience lead's guard)

This was run on the merged head with the guard in place (`focus-writes-nothing.txt`). On a fresh copy of the deck, which has no `tag:` line:
- I clicked into the Label field, which shows "Exercise", and left it.
- I clicked into the pill and left it.

The file kept its SHA-256 and has no `tag:` line (`guard-label-focused-1440.png`, `guard-pill-focused-1440.png`). Writing the words already shown is now no write at all: `setPath` returns the same data, and the Label row goes through it.

## Found while shooting

When its words are deleted, Chromium leaves a `<br>` in the pill, so the pill never read as `:empty` and the faint "Exercise" didn't show. The first try showed an empty pill with no placeholder. `SlideCanvas` now clears a box that empties, keeping the caret in it. Step 4 was shot after that fix. The fix applies to every box on the stage, the title too. I did not check whether the title's placeholder had the same fault.

A toast, "Activating extension 'GitHub.copilot-chat' failed: …chat.cli.planExitMode.enabled…", showed after each start. It comes from the dev tree's built-in Copilot Chat extension and has nothing to do with this change. I cleared it before the shots.

## Not run here

- Present on a display, and Publish to the fake host. The wall's and the page's pill are covered by `exerciseTag.test.ts` and the parity cases in `slideMarkup.test.ts`: the same pill or none on the slide, the part's label, Contents and the wall.
- Borderless and Windows.
