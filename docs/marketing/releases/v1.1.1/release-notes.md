# RiteMark v1.1.1

**Released:** 2026-01-30
**Type:** Minor (image workflow improvements)
**Download:** [GitHub Release](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/RiteMark.dmg)

## Highlights

RiteMark v1.1.1 focuses on **image handling** - insert images from files with `/image`, resize them with drag handles, and keep your documents clean with automatic file organization.

## What's New

### Insert Images from Files

Type `/image` in the editor to open a file picker. Select any image from your computer and RiteMark will:

- Copy the image to an `./images/` folder in your document's directory
- Insert proper markdown reference
- Handle filenames with special characters automatically

No more manual file copying or path typing.

### Image Resize Handles

Click on any image to see resize handles. Drag to resize - and here's the clever part: **RiteMark actually resizes the image file**, not just the display. This keeps your markdown clean (no inline width/height attributes) and your image files appropriately sized.

### Stale File Indicator

When a file changes outside RiteMark (e.g., edited in another app, synced from cloud), a **Refresh button** now appears in the header. This matches the behavior already present in the Data Editor - one click to reload the latest version.

### Blockquote in Bubble Menu

Select text and the bubble menu now includes a **quote button** for quick blockquote formatting. Part of the ongoing effort to make common formatting accessible without slash commands.

## Editor Polish

- **Cleaner bubble menu:** Table button removed (tables are still available via `/table` command)
- **Shared Dialog component:** Consistent modal styling across all dialogs
- **Better markdown parsing:** Images with special characters in filenames now handled correctly

## Technical Notes

- Base: VS Code OSS 1.94.0
- Platform: macOS (Apple Silicon)
- Image resize: Uses sharp library for actual file resizing

## Upgrade Notes

1. Download RiteMark.dmg from GitHub Releases
2. Drag to Applications (replace existing)
3. Launch RiteMark

Your existing documents and settings are preserved.
