# Sprint 30: Draw.io Embed - Architecture Findings

## Overview

Research for embedding Draw.io diagrams inline in Ritemark's markdown editor.

## Key Finding: .drawio.svg Dual-Format

`.drawio.svg` files are valid SVG files that also contain the full Draw.io XML diagram embedded as metadata. This means:
- They render as images in any SVG-capable renderer (including Ritemark's existing image pipeline)
- They are opened and edited natively by Draw.io Desktop (or the draw.io VS Code extension)
- Standard markdown syntax works: `![arch](./diagrams/arch.drawio.svg)`
- No format conversion needed at display time

## Existing Infrastructure (What We Build On)

### 1. Image Pipeline — Already Works for .drawio.svg

`ritemarkEditor.ts` `transformImagePaths()` resolves relative paths for ALL image extensions matched by the regex `!\[([^\]]*)\]\(([^)]+)\)`. Since `.drawio.svg` is a valid SVG, it will already be displayed by the webview if the file exists.

Action needed: Verify the webview `localResourceRoots` includes the document directory (it does — line 226 of ritemarkEditor.ts).

### 2. ResizableImage.tsx — Where to Add the Overlay

`extensions/ritemark/webview/src/components/ResizableImage.tsx` is the React NodeView that renders every image. It already:
- Detects local images via `title` attribute (relative path stored there)
- Shows resize handles for local images when selected

Detection pattern for Draw.io: check if `title` ends with `.drawio.svg` or `.drawio.png`.

### 3. Bridge Communication — Established Pattern

`sendToExtension(type, data)` in `bridge.ts` is the webview→extension channel.
Existing `openExternal` message type opens URLs in browser. We need a new `openFile` message type that uses `vscode.commands.executeCommand('vscode.open', uri)` to open the .drawio.svg in VS Code (where Draw.io extension can handle it).

Message handler pattern (ritemarkEditor.ts switch block):
```
case 'openFile':
  vscode.commands.executeCommand('vscode.open', vscode.Uri.file(absolutePath));
```

### 4. File Watcher — Already Exists for Conflict Detection

`ritemarkEditor.ts` has `createFileWatcher()` for the markdown document itself. We can follow this same pattern to watch `.drawio.svg` files referenced in the document. On change → send `imageMappings` refresh message.

### 5. Slash Commands — Extension Point is SlashCommands.tsx

`extensions/ritemark/webview/src/extensions/SlashCommands.tsx` contains the `/` command registry with Image, Mermaid, Table etc. This is where "Draw.io Diagram" command goes.

The Image command pattern:
1. Emits `image:pending-position` internal event with cursor position
2. Calls `sendToExtension('selectImageFile')`

For Draw.io, the pattern differs: we call `sendToExtension('createDrawioFile')` which:
1. Shows a VS Code save dialog for the `.drawio.svg` filename
2. Creates a minimal blank `.drawio.svg` template on disk
3. Sends back the relative path
4. Webview inserts `![diagram](./path/to/file.drawio.svg)` at cursor

### 6. Mermaid as Pattern

Mermaid is a code block with `language: 'mermaid'` — a simpler case (no external file). Draw.io uses an external file, which is closer to the Image pattern, but with the creation step built in.

## Implementation Scope

### Core (Phase 3 deliverables)

1. **Detection in ResizableImage.tsx** — `isDrawioFile` boolean, "Edit Diagram" overlay button on hover/select
2. **`openFile` bridge message** — webview sends path, extension resolves to absolute and executes `vscode.open`
3. **File watcher for .drawio.svg** — on external change, refresh `imageMappings` in webview so image reloads
4. **Slash command "Draw.io Diagram"** — prompts for filename, creates blank .drawio.svg, inserts markdown link

### Out of Scope

- Bundling Draw.io VS Code extension (user installs separately if desired)
- .drawio.png support (optional, .drawio.svg is the standard)
- Editing within the Ritemark webview itself (Draw.io has its own editor)

## File Watcher Refresh Design

When a `.drawio.svg` file changes on disk, the webview needs to reload the image. The challenge is the webview caches images by URL. Options:
1. Send a full `load` message (rebuilds all imageMappings, editor reloads content — too heavy)
2. Send a targeted `imageRefresh` message with the updated webviewUri for just that path (lightweight)

Option 2 is preferred. In the webview, App.tsx / Editor.tsx listens for `imageRefresh` and updates the `<img>` src by appending a cache-bust query param.

## Draw.io Blank Template

A minimal blank `.drawio.svg` file for new diagrams:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="1px" height="1px" viewBox="-0.5 -0.5 1 1" content="&lt;mxfile&gt;&lt;diagram&gt;jZLBbsIwDIafJtcqBQ7cmHRoJ2YdJk9RSqA...&lt;/diagram&gt;&lt;/mxfile&gt;">
  <defs/>
  <g/>
</svg>
```

The actual Draw.io XML is stored in the `content` attribute of the `<svg>` element. When Draw.io opens the file, it reads this attribute.

The blank template will be stored as a static string in the extension host code (not the webview).

## No Feature Flag Needed

This is a stable, cross-platform feature with no experimental risk:
- macOS, Windows, Linux all support SVG display
- The "Edit" button only appears for `.drawio.svg` files (no effect on other images)
- No network calls, no binary downloads
- Falls back gracefully if Draw.io is not installed (file opens in text editor instead)
