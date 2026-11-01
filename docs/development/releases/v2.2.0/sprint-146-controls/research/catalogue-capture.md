# A3: capturing a control's state in a hidden window (R2, R4; S22–S26)

Run on 1 November 2026 on one hidden dev instance of `sprint-146-controls-catalogue` (launched with `open -n -g -j`, the three backgrounding flags, `--use-mock-keychain`, a short profile under `/private/tmp`, scratch homes for the AIs, `RITEMARK_CONTROL_CATALOGUE=1`), with the catalogue drawn by the build before the input-mode tracker.

## What was checked

| Question | Answer | How |
|---|---|---|
| Does focus emulation make a hidden window's `:focus` and `:focus-visible` draw? | Yes | `Emulation.setFocusEmulationEnabled` on the workbench page and on the catalogue's webview target: the keyboard-focus cells show their rings (Button's 4 px, the split button's 2 px outline, Switch's 3 px, Select's 1 px) in a window that never came to the front |
| Do hover and a held press reach a webview through the workbench page's input? | Yes | `Input.dispatchMouseEvent` on the workbench page at the control's centre (the webview's offset plus the control's rectangle): hover fills, the pressed buttons' `active:scale-[0.98]`, a held press on a split button's main part, the Slider's thumb |
| Is a cell's capture stable? | Yes: no pixel moved | Five runs of the same build. Run 1 is the full set (222 cells, both themes). Runs 2–5 took 161 cells (Button, Split button, Dropdown menu, Select, Switch, Slider, Dialog, Tooltip) in Light, compared with run 1 at `--share 0`, which reports any state with a single pixel over the threshold: **0 of 161 differed in each run** |
| Does the theme switch through the palette work with the catalogue in front? | Yes | `Preferences: Color Theme` by its exact row, as `frame-screenshots.mjs` does it; both themes' sets came out in each full run |
| Does a background window draw as a front one (S25)? | Not run | A front run would bring the window to the front and take the screen from whoever uses the Mac. Focus emulation is the mechanism; the README lists it as open |

## What the runs set

- **The tolerance:** a pixel differs when its three channels move by more than 24 in all (as `frame-screenshots.mjs`), and a state differs when more than 0.03% of its pixels do (`--share`, default `0.0003`). Five runs of one build moved no pixel; a run with every row moved 37 px down moved up to 0.02% of a cell (text's anti-aliasing at another place on the screen), in 20 of 112 cells. The first build allowed 0.1%, and PR 2's first review showed why that was too loose: the context menu's radio dot, once fixed, is 0.06% of its cell and passed unseen. A 1 px ring is over 1%.
- **The placement:** each cell is scrolled to 48 px below the page's top on whole pixels, clear of the desk's hairline over the webview's first row (a cell scrolled to the very top took that line in); a dialog is captured as its own box, since the blurred page round it changes with what the page shows behind.
- **The waits:** 650 ms after the input before a capture (a tooltip's 300 ms delay and its first paint, a menu's mount). With motion and the caret off on the page, nothing moves after that.
- **A cell's room:** a cell is its control plus the room its menu or tooltip needs, so the capture holds the whole state. Menus need up to 300 × 270 (the Select's whole list), the context menu 340 × 330 (500 wide with its submenu), tooltips 112 high, with the control set in far enough for a tooltip centred on it.

## What the images depend on (written into the baseline's README)

- The Mac's display at 2×.
- The Mac's accent colour, for the one control that draws Chromium's own outline in keyboard mode: the dialog's close (`dialog-dialog-close-focus`).
- The fonts of the Mac: Windows is checked by eye.

## Seen on the way

- **The dialog's close has no ring of Ritemark's.** In keyboard mode it draws the system's own focus outline, in the Mac's accent colour (orange on the test Mac). A look for the Experience lead's list, not this sprint's change.
- **A narrow plain Button overflows its room** (it doesn't shrink: `shrink-0`, `whitespace-nowrap`); a split button cuts its label to "A…". That is #566, PR 3's.
