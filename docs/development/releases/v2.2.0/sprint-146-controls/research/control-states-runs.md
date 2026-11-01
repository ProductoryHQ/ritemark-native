# The control states, run by run (R2–R4; S22–S26)

Every run on 1 November 2026, on one hidden dev instance of `sprint-146-controls-catalogue` (A3 says how it was launched), with `scripts/qa/control-states.mjs`. A run is 222 cells; both themes make 444 states.

| # | Build | Run | Result |
|---|---|---|---|
| 1 | Before the tracker (PR 1's head, with the catalogue) | All states, both themes, no comparison | 444 captured: the set the tracker is measured against |
| 2–5 | The same | 161 states in Light, compared with run 1 at `--share 0` (a single pixel over the threshold counts) | 0 of 161 differed, each time (A3) |
| 6 | The tracker, its prefix bare | All states, both themes, compared with run 1 | Caught a regression of the first build: keyboard focus on a split button lost its 1 px divider and gained the Button's 4 px ring, because the prefixed ring outranked the split button's rules. Fixed by putting the prefix in `:where()` (`research/focus-rings.md`). Its Dark half was spoiled by the window: another tab came forward and the pixel ratio dropped to 1 partway through; the script now brings the catalogue's tab forward before each cell and fails a state captured at another ratio |
| 7 | The tracker, `:where()` (this PR's head) | All states, both themes, compared with run 1 | **4 of 444 differ, all the Slider's:** pressed and after a click, in Light and Dark. Before the tracker the thumb kept its ring after the mouse (Radix focuses it by script on a press); now it doesn't. Every other state, the keyboard's rings among them, is as it was. This set is the candidate baseline (`docs/development/control-baseline/`) |
| 8 | R1's rule reverted in a scratch build (the Tailwind variant and the tooltip's mode check taken out) | 73 states (Split button, Dropdown menu, More actions, Select, Slider) in Light, compared with the baseline | **Exit 1, 6 differ:** Dropdown menu after a mouse pick (its ring), More actions after a mouse pick (its ring and its tooltip, RC3's fault), Select after a mouse pick and after a click outside (its frame), the Slider pressed and clicked. S22's failing half |
| 9 | This PR's head again, the bundle rebuilt byte for byte | 154 states (the rows of run 8 and the Tooltip), both themes, compared with the baseline | **Exit 0, 0 differ.** S22's passing half |

Crops in [`../qa/`](../qa/): `r2-reverted-dropdown-mouse-pick-light.png`, `r2-reverted-more-actions-mouse-pick-light.png`, `r2-reverted-select-mouse-pick-light.png` (run 8), and the Slider after a click before and after the tracker, `r2-before-tracker-slider-click-light.png` and `r2-slider-click-light.png`.

## The failing set

The plan asked for the first capture of `main`'s controls as the failing set. This branch is on PR 1's, so run 1 already has #585's close rule: a mouse pick from a menu or a Select drew no ring there. What the tracker changed on top of it is the Slider (run 7). `main`'s own failing states, before #585, are PR 1's audit's (`research/menu-focus-audit.md`: the PDF zoom menu's ring and tooltip, the agent Select's frame), and run 8 shows the same faults coming back in the catalogue when the tracker's rule is taken out.

## Not run here

- **S25, a front and a background run compared:** a front run brings the window forward and takes the screen; not done on a Mac someone is using.
- **Windows:** the overlay session checks the catalogue by eye at 100% and 150%.
- **The Experience lead's approval** of the 444 images: `docs/development/control-baseline/README.md` marks the set as waiting for it.
