# RiteMark v1.0.3

**Released:** 2026-01-23
**Type:** Minor (significant feature addition)
**Download:** [GitHub Release](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/RiteMark.dmg)

## Highlights

RiteMark v1.0.3 introduces voice dictation - local, private speech-to-text powered by whisper.cpp. Dictate in Estonian or 50+ other languages without any data leaving your machine. This release also adds a "Copy as Markdown" export option and fixes a UI scrolling issue.

## What's New

### Voice Dictation

The headline feature of this release. Click the mic button in the editor toolbar and start speaking. Your words appear in real-time as you dictate.

**Key details:**

- Powered by whisper.cpp, bundled directly into RiteMark (no installation steps)
- Runs entirely on your machine - no cloud services, no API calls, no data leaves your computer
- Estonian language support out of the box, with 50+ languages available
- Real-time streaming: text appears as you speak, not after you stop
- Whisper model downloads on first use (~244MB), then stored locally for offline use
- Toggle on/off with the mic button in the toolbar

**Why it matters:**

Most speech-to-text tools send your audio to cloud servers. RiteMark's voice dictation is completely local. Your voice data never leaves your machine, making it suitable for sensitive writing, private notes, and environments without internet access.

### Copy as Markdown

A new option in the Export menu lets you copy your document (or selection) as clean markdown text.

- With text selected: copies only the selection as markdown
- Without selection: copies the entire document
- Properly handles tables, lists, images, and other formatting
- Useful for pasting into GitHub, email, or other markdown-aware tools

## Bug Fixes

- **Properties Dialog Scroll:** Fixed an issue where the Properties dialog would overflow when a document has many frontmatter properties (15+). The dialog content now scrolls within a bounded area.

## Technical Notes

- Base: VS Code OSS 1.94.0
- Extension version: 1.0.3
- Platform: macOS (Apple Silicon / darwin-arm64)
- Bundled: whisper.cpp binary + dynamic libraries (darwin-arm64 native)
- Voice dictation is gated behind a feature flag (experimental, opt-in via Settings)

## Upgrade Notes

Standard upgrade process:

1. Download RiteMark.dmg from GitHub Releases
2. Open the DMG
3. Drag RiteMark to Applications (replace existing)
4. Launch RiteMark

Voice dictation requires enabling in Settings (experimental feature). The Whisper model will download on first use.
