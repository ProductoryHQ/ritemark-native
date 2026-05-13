---
date: ''
title: 'Ritemark v1.7.1'
author: Jarmo Tuisk
tags:
  - bugfix
  - patch
draft: true
---

# Ritemark v1.7.1

**Status:** In progress
**Type:** Patch release
**Focus:** Bug fixes

* * *

## Downloads

| Platform | Download |
| --- | --- |
| macOS Apple Silicon (M1/M2/M3) | [Ritemark-arm64.dmg](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-arm64.dmg) |

* * *

## Bug Fixes

### Copy button and clipboard operations now work correctly

The Copy button on code blocks, "Copy as Markdown" in the export menu, and Cmd+C/Cmd+V in table cells were silently failing — nothing was copied to the clipboard. Fixed by routing all clipboard operations through the VS Code extension host instead of the sandboxed webview browser API.

**Affected in previous versions:**
- Code block Copy button
- Export menu → Copy as Markdown
- Table cell Cmd+C (copy cell value)
- Table cell Cmd+V (paste into cell)

Fixes [#66](https://github.com/ProductoryHQ/ritemark-native/issues/66)

### Chat History now shows all past conversations

Chat History was always showing only one entry — the most recent conversation. All older conversations were saved correctly but never loaded into the panel. Fixed. History is workspace-scoped: conversations from one project never appear when working in another.

The "New Chat" button was also removed from the history panel (the + button in the toolbar does the same thing).

Fixes [#65](https://github.com/ProductoryHQ/ritemark-native/issues/65)

### HTML files now open correctly in the integrated browser on cold start

Opening an `.html` file directly from Finder or CLI (when Ritemark wasn't already running) could leave the file stuck as a blank text editor tab instead of routing to the integrated browser. Fixed.

Fixes [#63](https://github.com/ProductoryHQ/ritemark-native/issues/63)
