# PR 5 proof: Present, the wall

A hidden dev instance (`scripts/qa/dev-launch-isolated.sh`, `RITEMARK_PRESENT_WINDOWED=1`) on one display, the Sprint 157 demo project with `ritemark.features.decks` on, driven over CDP on the night of 15 to 16 November 2026. The demo deck has 13 slides, slide 12 skipped; a test word (`NOTESWORD-ZEBRA`) was put in slide 3's notes.

## Shots (1440 × 900, the wall's webview)

- `wall.png`: the wall, Card, the bar faded.
- `wall-bar.png`: the bar after a pointer move: back, 7 of 13, next, all slides, "esc to stop".
- `wall-goto.png`: typing 7: "7 · Go to An assistant's four parts ↵".
- `wall-grid.png`: all slides, Borderless; 13 shown slides by their thumbnail numbers (12, the skipped one, is passed: 11, 12, 14 after the slide added mid-session).
- `wall-borderless.png`: a Borderless deck's words on white, bands of #0E0C24.
- `present-menu.png`: Present on the deck's bar and its menu, From the start (⇧⌘↩).
- `deck-after-stop.png`: Esc on slide 11: the deck view is back on slide 11. (The Copilot Chat toast is the dev build's own and comes with every dev launch.)
- `wall-window-title-row.png`: the wall's whole window in the windowed mode: no tab row, but the window's title row and the desk's edge stay (see below).

## Log

```
Home       1 of 12 | AI assistants and agents
ArrowRight 2 of 12 | Today
PageDown   3 of 12 | Shared prompt board
Space      4 of 12 | Why agents?
Enter      5 of 12 | Why talk about agents?
ArrowDown  6 of 12 | An assistant's four parts
ArrowLeft  5 of 12   PageUp 4 of 12   ArrowUp 3 of 12
End        12 of 12 | What to try on Monday
ArrowLeft  11 of 12 | Which tool for which data   (slide 12, skipped, passed)
ArrowLeft  10 of 12   ArrowRight 11 of 12   ArrowRight 12 of 12

-- a slide added after slide 2 in the file while the wall shows slide 2 --
ArrowRight 3 of 13 | Added while presenting
ArrowRight 4 of 13   ArrowLeft 3 of 13   ArrowLeft 2 of 13

wall states received: 14, none holding NOTESWORD-ZEBRA, slide 1's notes or the skipped slide's title;
fields assets,borderless,count,position,slide,slides,theme,type; slide fields data,kind,number,title; no id/from/kept/skip/notes
fade: wall-fade-in 0.3s; with prefers-reduced-motion: reduce, none
⌘↩ presented from the current slide, ⇧⌘↩ from slide 1; the deck file unchanged by either (no line break added)
Esc in the grid closes the grid; Esc on the wall stops; the wall's window closes with the panel
```

## What the hidden run could not show

- **Full screen.** macOS gives the focus to a background app's new window only when a person acts, and refuses full screen to a window of an app that isn't active, so a hidden run can't show it. The host makes the wall's window compact and full screen only after the wall says its window has the focus; without that answer it leaves the wall a window of its own, so the main window is never made full screen by mistake.
- **The title row and the desk's edge.** VS Code's compact mode takes the tab row away in Ritemark's frame, but an auxiliary window keeps its title row (patch 018) and the desk's 8 px edge and rounded corners. Full screen may hide the title row; PR 6's shell piece places the wall itself.
