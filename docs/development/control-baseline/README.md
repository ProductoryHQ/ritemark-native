# The control baseline

The approved image of every state of every shared control (`extensions/ritemark/webview/src/components/ui/`), in Ritemark Light and Ritemark Dark. `scripts/qa/control-states.mjs` compares a running build's controls with them (Sprint 146, R4; the review process's Step 8). Each file is `<theme>-<row>-<variant>-<state>.png`, one cell of the control catalogue at device pixels.

**The Experience lead approves each image once.** A PR that changes a control's look (`components/ui/`, `index.css`, a control's own classes) takes a new set of that control's images in the same PR, and the lead approves them again before the merge. A look the lead wants changed becomes its own issue; the baseline records the looks as they are.

**Status:** the set taken in Sprint 146's PR 2 (456 images: 228 states in each theme). The Experience lead approved it on 1 November 2026 (ritemark-dev `releases/v2.2.0/analysis/2026-10-31-sprint-146-experience-answers.md`, section 9), except four faults in shared controls. Those were fixed in PR 2 and their 21 images retaken (the Dark primary's ring, the dialog's close, the long Select, the Slider, the disabled tab, and the Dark split button's focus that the primary's fix also moved); those 21 wait for the lead's look.

## Run it

1. Start Ritemark with the catalogue's launch setting and a debugging port, hidden, on a profile of its own. For a dev instance (the VS Code tree built, `extensions/ritemark` linked into it):
   ```bash
   open -n -g -j -a vscode/.build/electron/Ritemark.app \
     --env NODE_ENV=development --env VSCODE_DEV=1 --env VSCODE_CLI=1 \
     --env RITEMARK_BUILD_CHANNEL=test --env RITEMARK_CONTROL_CATALOGUE=1 \
     --args "$PWD/vscode" --remote-debugging-port=<port> \
     --user-data-dir=/private/tmp/<short>/ud --extensions-dir=/private/tmp/<short>/ext \
     --shared-data-dir=/private/tmp/<short>/shared --use-mock-keychain <a folder> \
     --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --disable-background-timer-throttling
   ```
   For a release candidate, the same with `-a /Applications/Ritemark.app` (or the candidate's path) and no `NODE_ENV`, `VSCODE_DEV` or `VSCODE_CLI`. Point the AIs' homes (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `XDG_*`) at scratch folders: the catalogue needs no AI. A window on a fresh profile opens on the welcome; open a folder first, and the catalogue opens as a tab beside Home.
2. Run the script from the repository's root:
   ```bash
   node scripts/qa/control-states.mjs --port <port> --out <dir> --compare docs/development/control-baseline
   ```
   It switches the theme through the palette, draws every cell afresh, reaches each state with real input (`Input.dispatchMouseEvent`, `Input.dispatchKeyEvent`), captures it, and leaves the window in Ritemark Light. About ten minutes for both themes. `--only <row>` takes one control's row (`button`, `split-button`, `select`, …).
3. Read the result: the exit code is 1 when any state differs from its image or has none, or when an image here has no state in the catalogue (`NO STATE`: a state deleted or renamed; remove its image in the same PR, or bring the state back), and 0 otherwise; the counts are printed. An `--only` run doesn't look for images with no state, and a `--themes` run looks only at its themes' images. A state differs when more than 0.03% of its pixels move by more than 24 in their three channels (`--share`): enough for text's anti-aliasing when a row is added above, never enough to hide a ring or a radio's dot. `<dir>/compare.html` shows each differing state's approved image, capture and difference; `<dir>/sheet.html` lays all the captures out as the catalogue's grid.

## Take a new set

Run the script without `--compare` into an empty folder, open `<dir>/sheet.html`, and send it to the Experience lead. Copy the images the lead approves into this folder, replacing the old ones, in the same PR as the change. Take them on the Mac at 2× (the set here is a Mac's): fonts draw differently on Windows, so there the catalogue is checked by eye through the test overlay at 100% and 150%.

## What the images depend on

- **The Mac's display:** device pixels at 2×; a 1× screen draws other images.
- **Focus emulation:** the script turns it on, so a hidden window draws its focus as a front one. A run with the window in front and one behind it should give the same images (S25; not run yet: a front run takes the screen).

## Where it runs

- On a PR that touches `components/ui/`, `index.css` or a control's look: the PR template's Risk section asks for its result.
- At Gate 1, on the release candidate, beside `frame-screenshots.mjs` (the `release` skill and the `release-manager` agent).
- `REVIEW.md` and the reviewer brief leave this folder out of what is reviewed, as `frame-baseline/`.
