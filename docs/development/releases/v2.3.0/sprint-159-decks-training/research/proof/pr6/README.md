# PR 6 proof: the presenter view and the second display

A hidden dev instance on one display (the Mac's built-in), the demo project, `RITEMARK_PRESENT_WINDOWED=1`, driven over CDP on the night of 15 to 16 November 2026. Shots of whole windows were taken from the main process (`webContents.capturePage`), at 1440 × 900.

## The window check (technical plan §5, PR 6), first

1. **`getScreenDetails` in the core window.** Fault first, on the shell without the permission line: `NotAllowedError: Permission denied.` (`navigator.permissions.query({ name: 'window-management' })` → `denied`). With `'window-management'` in `allowedPermissionsInCore` (patch 004): `granted`, and one screen, `{ label: "Built-in Retina Display", isPrimary: true, isInternal: true, 1728 × 1117 }`.
2. **A webview moved to a new window, compact and full screen, in Ritemark's frame.** VS Code's compact mode takes the tab row away (seen: the group's title row 0 high), but in Ritemark's frame an auxiliary window kept its title row ("<deck> — <project>") and the desk's 8 px edge with rounded corners (`fallback-wall.png`). The Experience lead's bar (16 November): no title row, no project name, no edge, full screen or not. So the shell piece makes the window itself: frameless, compact, locked, and a *presentation's window* with no title row, no desk gap and no edge. Full screen can't be shown in a hidden run: macOS gives a background app's window neither the focus nor full screen (`BrowserWindow.setFullScreen(true)` on the main window, app inactive: `isFullScreen()` stays false).

## Shots

- `wall.png`: the wall, Card, in its presentation's window at 1440 × 900: the slide and its bands edge to edge, no title row, no project name, no edge.
- `wall-bar.png`: the same with the bar: back, 5 of 13, next, all slides, presenter view, esc to stop.
- `presenter.png`: the presenter view in Ritemark Dark: now (960 wide), next, the notes with A− and A+, the row, the clock, Pause, Reset, Slide 1 of 13, Back, Next (the bright one), Stop, and "Claude and notices wait until you stop." Swap displays shows only with two displays.
- `presenter-length.png`: after a click on the clock and 45: "1:34 elapsed, of 45 minutes"; the deck's front matter gained `ritemark-length: 45`.
- `present-menu.png`: the Present menu with Presenter view on (the dev windowed mode's wording on one display; with two it reads "Slides on <display>, notes here").
- `fallback-menu.png`, `fallback-wall.png`: the shell without the Present commands (its import taken out of the dev build's `out/` for the run, then put back): Present takes PR 5's path (one window, compact, VS Code's commands), and Presenter view is off, "Comes on with a second display".

## Log

```
place: windows 2 (wall) and 3 (presenter view) at the windowed bounds; each page 0,0 to its window's size;
  .part.titlebar display none; .monaco-workbench.ritemark-presenting; the group .locked
presenter view: → three times, a click, → once: Slide 5 of 13, its notes, the row's current thumbnail in view
clock: the length prompt shows in the presenter view's window; 45 ↵ wrote ritemark-length: 45 (one line added before
  the closing ---; presentProtocol.test.ts checks that the edit changes nothing else); the clock reads "elapsed, of 45 minutes"
Stop in the presenter view: both windows close, the deck view is on slide 5 (the slide ended on)
fallback: one window of VS Code's default size, tab row 0 high, title row shown; no presenter view
```

## Not verified (Jarmo's, on real hardware)

- The wall full screen on a projector and the presenter view on the laptop, each placed by display; Presenter view coming on by itself and naming the display.
- Swap displays (out of full screen, over, in again).
- A clicker.
- Windows' displays (a short task of its own after this PR).
