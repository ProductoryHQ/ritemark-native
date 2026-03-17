---
name: macos-screenshots
description: Capture and inspect macOS screenshots for visual debugging. Use when a task needs a fresh screenshot of the full screen, a specific window, or an interactively selected window, then open the image for inspection.
---

# macOS Screenshots

Use this skill when you need current visual state from the user's Mac app windows.

## Use This Skill For

- visual verification of Ritemark, VS Code, Electron, or webview UI state
- before/after screenshots during UI debugging
- capturing a specific app window instead of the whole screen
- capturing a full-screen snapshot for layout or multi-window issues

## Default Workflow

1. Save screenshots under `/tmp/` with a descriptive filename.
2. Use `screencapture` on macOS.
3. After capture, open the image with the image-view tool for inspection.

## Commands

Full screen:

```bash
screencapture -x /tmp/fullscreen.png
```

Interactive window selection:

```bash
screencapture -x -i -W /tmp/window.png
```

Specific window by window id:

```bash
screencapture -x -l12345 /tmp/window-12345.png
```

Window only, no shadow:

```bash
screencapture -x -o -i -W /tmp/window-no-shadow.png
```

## Notes

- `-W` starts interactive window mode.
- `-l<windowid>` captures one exact window when you already know the id.
- `-o` removes the macOS shadow, useful for tighter diffs.
- Prefer PNG output.

## Permissions

- GUI capture commands may require escalated permissions.
- If you need interactive selection or direct screen capture outside the sandbox, request escalation and explain that you are taking a screenshot for UI inspection.

## Inspect After Capture

Once the file exists, open it with the image viewer tool using the saved absolute path.

Example paths:

- `/tmp/ritemark-window.png`
- `/tmp/ritemark-fullscreen.png`
