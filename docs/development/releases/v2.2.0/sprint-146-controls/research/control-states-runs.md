# The control states, run by run (R2–R4; S22–S26)

Every run on 1 November 2026, on one hidden dev instance of `sprint-146-controls-catalogue` (A3 says how it was launched), with `scripts/qa/control-states.mjs`. A run was 222 cells until PR 2's first review added Button's `default` and `icon-lg` sizes; now it is 228, and both themes make 456 states.

| # | Build | Run | Result |
|---|---|---|---|
| 1 | Before the tracker (PR 1's head, with the catalogue) | All states, both themes, no comparison | 444 captured: the set the tracker is measured against |
| 2–5 | The same | 161 states in Light, compared with run 1 at `--share 0` (a single pixel over the threshold counts) | 0 of 161 differed, each time (A3) |
| 6 | The tracker, its prefix bare | All states, both themes, compared with run 1 | Caught a regression of the first build: keyboard focus on a split button lost its 1 px divider and gained the Button's 4 px ring, because the prefixed ring outranked the split button's rules. Fixed by putting the prefix in `:where()` (`research/focus-rings.md`). Its Dark half was spoiled by the window: another tab came forward and the pixel ratio dropped to 1 partway through; the script now brings the catalogue's tab forward before each cell and fails a state captured at another ratio |
| 7 | The tracker, `:where()` (this PR's head) | All states, both themes, compared with run 1 | **4 of 444 differ, all the Slider's:** pressed and after a click, in Light and Dark. Before the tracker the thumb kept its ring after the mouse (Radix focuses it by script on a press); now it doesn't. Every other state, the keyboard's rings among them, is as it was. This set is the candidate baseline (`docs/development/control-baseline/`) |
| 8 | R1's rule reverted in a scratch build (the Tailwind variant and the tooltip's mode check taken out) | 73 states (Split button, Dropdown menu, More actions, Select, Slider) in Light, compared with the baseline | **Exit 1, 6 differ:** Dropdown menu after a mouse pick (its ring), More actions after a mouse pick (its ring and its tooltip, RC3's fault), Select after a mouse pick and after a click outside (its frame), the Slider pressed and clicked. S22's failing half |
| 9 | This PR's head again, the bundle rebuilt byte for byte | 154 states (the rows of run 8 and the Tooltip), both themes, compared with the baseline | **Exit 0, 0 differ.** S22's passing half |
| 10 | Review round 1's fixes: the context menu's radio dot drawn, Button's two missing sizes, room for the Select's whole list | Button, Select and Context menu, both themes | The new sizes had no image and the Select's list a new size, as expected. The radio dot did not count at 0.1%: it is 0.06% of its cell. So a state now differs when any pixel does (five runs moved none). The new images are in the baseline |
| 11 | The same, every state | All 456, both themes, against the baseline, any pixel | 59 differ by a few pixels each (under 0.01%): the cells the new rows moved down. Scrolling a cell to the centre put it on half device pixels |
| 12 | Cells scrolled to the page's top, then 48 px below it, on whole pixels; a dialog captured as its own box | All 456, both themes | The new set. Scrolled to the very top, a cell took in the desk's hairline over the webview's first row; 48 px below is clear of it. This set is the baseline now |
| 13 | Every row moved 37 px down in a scratch build | 112 states in Light, against run 12, any pixel | 20 differ, by at most 0.02% (text's anti-aliasing at another place). So a state differs above 0.03%: the radio dot (0.06%) and any ring (over 1%) still count |
| 14 | This PR's head, review round 1's fixes in | All 456, both themes, against the baseline | 1 differed: a long Textarea in Dark had drawn a scrollbar in run 12 and not here. The catalogue's page now draws no scrollbars; with that, all 456 again: only the two long Textareas changed (their new images are in), then Input, Textarea and Select once more: **exit 0, 0 of 48** |
| 15 | Codex's answers: focus coming back into the page turns the mode to keyboard; approved images with no state fail the comparison. A fresh hidden instance, cloned VS Code tree at Electron 43.8.3 | All 456, both themes, against a scratch copy of the baseline with one extra image for a state the catalogue doesn't have | Dark: 0 differ. Light: 52 differ, every keyboard-focus state and the clicked fields, all for one reason: the catalogue's page had no focus at all during the first theme of the first run on the fresh window (a clicked field drew no focus look either, and a field's look doesn't depend on the mode). The extra image: `NO STATE`, counted apart; exit 1 |
| 16 | The same instance, warmed (the palette had opened once) | Button and Input in Light, then all 456 in both themes, against the baseline | **Exit 0, 0 of 456 differ**, the mouse-pick cells included: the re-entry rule moved no approved image |

Crops in [`../qa/`](../qa/): `r2-reverted-dropdown-mouse-pick-light.png`, `r2-reverted-more-actions-mouse-pick-light.png`, `r2-reverted-select-mouse-pick-light.png` (run 8), and the Slider after a click before and after the tracker, `r2-before-tracker-slider-click-light.png` and `r2-slider-click-light.png`.

## The failing set

The plan asked for the first capture of `main`'s controls as the failing set. This branch is on PR 1's, so run 1 already has #585's close rule: a mouse pick from a menu or a Select drew no ring there. What the tracker changed on top of it is the Slider (run 7). `main`'s own failing states, before #585, are PR 1's audit's (`research/menu-focus-audit.md`: the PDF zoom menu's ring and tooltip, the agent Select's frame), and run 8 shows the same faults coming back in the catalogue when the tracker's rule is taken out.

**Seen in run 15, not fixed here:** a first run on a freshly started window can capture its first theme with the page unfocused, so every keyboard state reads as different. A second run, or any run after the palette has opened once, matches. Worth a guard in the script (check that the page has the focus after the first click, or open and close the palette once before the first theme) before Gate 1 relies on a fresh candidate's first run.

## Not run here

- **S25, a front and a background run compared:** a front run brings the window forward and takes the screen; not done on a Mac someone is using.
- **Windows:** the overlay session checks the catalogue by eye at 100% and 150%.
- **The Experience lead's approval** of the 456 images: `docs/development/control-baseline/README.md` marks the set as waiting for it.
