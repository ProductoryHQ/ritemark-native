# Sprint 162 PR 1: proof for the Theme button

Taken on 17 November 2026 in an isolated dev instance (`scripts/qa/dev-launch-isolated.sh`, a fresh profile and AI homes, the Decks flag on) at 1440 × 900, on a copy of the in-repo demo project (`docs/development/sprints/sprint-157-decks/demo-project/`) with two synthetic theme files added in `Slide library/Themes/` (Paper and Fern Hollow), one deck naming Fern Hollow and one with no `theme:` line. The deck used is "AI assistants and agents.deck.md" (a `deck: 1` deck).

## The fault first
On main, the editor's front-matter join rewrote the whole front matter with gray-matter whenever a value that isn't one plain word changed, as a theme path is. Run on the demo deck, a pick of Paper and its Undo through main's `joinFrontMatter`:

```
--- main: Undo gives the file back byte for byte: false   (the blank line after the front matter is lost)
--- branch: Undo gives the file back byte for byte: true
```

## In the app, on the final head
- Opening the untouched deck, and opening it again after a window reload, left the file byte for byte as the copy (`cmp`: same).
- A pick of Paper changed one line of the file (`diff`: `theme: …Evening.theme.md` → `theme: …Paper.theme.md`).
- Cmd+Z, with the focus back on the Theme button: `cmp` same as the copy. Cmd+Shift+Z wrote Paper again; Cmd+Z again gave the copy back byte for byte.
- The first attempt failed: Cmd+Z on the bar did nothing, because the webview's own script marks an undo outside a text field handled before a bubble-phase listener sees it. The bar's listener now runs in the capture phase, and the run above is after that fix.
- The menu's counts: Evening 6 decks (five naming it and the one with no line), Fern Hollow 1, Paper none; after the picks they followed at once (Evening 5, Fern Hollow 2, then Paper 1).
- The stage, the strip (shot 03, AI folded) and the wall (shot 06, Present) took Fern Hollow and Paper at once.
- Borderless from the menu wrote `look: borderless` under the theme line (shot 04); Esc closed the menu and gave the focus back to the button.
- Slide settings… (shot 05) shows Picture and Label only: no "This deck" section.

## Shots
- `01-bar-theme-button-ai-{open,folded}`: the bar, the Theme button before Saved.
- `02-menu-open-ai-{open,folded}`: LOOK and THEME, three themes with their counts, the current one ticked.
- `03-after-pick-notice-ai-{open,folded}`: the deck in Paper, "This deck uses Paper now." with Undo.
- `04-borderless-from-menu-ai-{open,folded}`: Borderless chosen in the menu.
- `05-slide-settings-without-this-deck-ai-folded`: the slide's popover without the deck's section.
- `06-wall-follows-fern-hollow`: Present's wall in Fern Hollow (one display, so the wall is a window).

## Not verified here
The published page (no real or fake publish was run; the page reads the theme through the same `readDeckTheme` as the view, `deckPublish.themeFor`). Shot 05 with the AI pane open (with the AI open the desk is under 600 px and the strip is off). Only Sofia Sans renders, as expected until PR 3.
