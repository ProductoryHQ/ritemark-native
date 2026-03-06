# Existing Features Analysis

## Features Gated

| Feature | Flag ID | Status | Platforms | Gate Location |
|---------|---------|--------|-----------|---------------|
| Voice Dictation | `voice-dictation` | experimental | darwin | `ritemarkEditor.ts` (early return) |
| Markdown Export | `markdown-export` | stable | all | `flags.ts` only (no runtime gate) |

## Voice Dictation

- Uses native whisper.cpp binaries (macOS only)
- Requires 75MB model download
- Gated with single early return before all `dictation:*` message handlers
- User enables via Settings toggle: `ritemark.features.voice-dictation`

## Markdown Export

- Uses pdfkit (PDF) and docx (Word) libraries
- Cross-platform, stable
- Flag defined for future kill-switch capability
- No runtime gate needed (stable = always on)

## Features NOT Gated (by design)

| Feature | Reason |
|---------|--------|
| AI Assistant | Already opt-in via API key requirement |
| Excel/CSV Viewer | Core functionality, no reason to gate |
| Update Checker | Has its own `ritemark.updates.enabled` setting |
