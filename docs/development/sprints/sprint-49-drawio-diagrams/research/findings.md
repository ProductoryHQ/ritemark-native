# Sprint 49: Draw.io Diagrams — Research Findings

## Summary

Ritemark can support inline Draw.io diagram previews with minimal new infrastructure by leveraging the `.drawio.svg` dual-format: a file that is simultaneously valid SVG (renderable as an `<img>`) and editable Draw.io XML (the SVG `<metadata>` tag contains the full diagram source).

---

## 1. File Format — `.drawio.svg`

A `.drawio.svg` file is a standard SVG with Draw.io diagram XML embedded inside `<metadata>`. It is:

- Renderable in any browser `<img>` tag as a normal SVG image — no special parser needed.
- Editable by Draw.io desktop / Draw.io VS Code extension — they read the `<metadata>` section.
- Round-trippable: Draw.io saves back to the same `.drawio.svg` file in place.

Standard markdown syntax works unchanged:

```markdown
![Architecture](./diagrams/arch.drawio.svg)
```

TipTap's existing image node and `ResizableImage.tsx` handle this automatically — the `src` resolves to the webview URI and renders.

---

## 2. Existing Infrastructure Reuse

### 2a. ResizableImage.tsx

`extensions/ritemark/webview/src/components/ResizableImage.tsx`

- Already detects "local image" via `title` attr containing `./` or `../` relative paths.
- Already has a `selected` prop that shows contextual UI (resize handles).
- Draw.io overlay can use the same `selected` pattern: show an "Edit Diagram" button when selected, only for `.drawio.svg` / `.drawio.png` files.
- Detection: `title.endsWith('.drawio.svg') || title.endsWith('.drawio.png')`

### 2b. Bridge (`sendToExtension`)

`extensions/ritemark/webview/src/bridge.ts`

- `sendToExtension(type, data)` sends a typed message to the extension host.
- Extension host dispatches on `message.type` in `ritemarkEditor.ts` `switch(message.type)`.
- Pattern is well established (e.g., `resizeImage`, `saveImage`, `selectImageFile`).
- New message type needed: `openDrawioFile` with payload `{ relativePath: string }`.

### 2c. Extension Host — `ritemarkEditor.ts`

- `case 'resizeImage':` at line 327 shows the exact pattern for handling a new message type.
- `openDrawioFile` handler needs to resolve `relativePath` relative to the open document's directory, then call `vscode.commands.executeCommand('vscode.open', uri)`. This opens the file with whatever editor is registered for `.drawio.svg` — if Draw.io VS Code extension is installed it opens there, otherwise it falls back to the text editor (still useful).

### 2d. File Watcher

`ritemarkEditor.ts` already has `createFileWatcher()` (line 838) for the main `.md` file. The same `vscode.workspace.createFileSystemWatcher` pattern can watch a glob for `**/*.drawio.svg` files relative to the document directory. On change → post `drawioFileChanged` message to webview → webview busts the image cache by appending `?t=timestamp` to the `src`.

### 2e. Slash Commands

`extensions/ritemark/webview/src/extensions/SlashCommands.tsx` already has a "Mermaid Diagram" entry from Sprint 46 as a direct pattern to follow.

The "Insert Draw.io Diagram" slash command needs to:
1. Send `createDrawioFile` message to extension (with a default filename like `diagram.drawio.svg`).
2. Extension creates the file from a minimal blank `.drawio.svg` template and returns the relative path.
3. Webview inserts `![diagram](./diagrams/diagram.drawio.svg)` at cursor.

---

## 3. Draw.io VS Code Extension

The official extension is `hediet.vscode-drawio` (marketplace ID). It registers as an editor for `.drawio`, `.drawio.svg`, `.drawio.png`. When installed, `vscode.open` on a `.drawio.svg` file opens it in the Draw.io visual editor.

Ritemark's marketplace is hidden (no user-facing extension store), so bundling is the only reliable path. However, bundling adds significant complexity (license, build, maintenance). Simpler approach for Sprint 49: show a notification/tooltip "Install Draw.io extension to edit visually" with a button that runs `vscode.commands.executeCommand('workbench.extensions.installExtension', 'hediet.vscode-drawio')`.

Decision to make at plan stage: bundle vs. prompt-to-install vs. defer.

---

## 4. Cache-Busting for Image Refresh

Browsers cache `<img src="...">` aggressively. When a `.drawio.svg` is modified externally by Draw.io and saved, the webview must reload the image. Pattern: keep a `Map<relativePath, cacheBusterKey>` in React state or a context. When the extension sends `drawioFileChanged`, increment the key for that path, and any `ResizableImage` whose `title` matches appends `?v=N` to the `src`.

The cleanest approach: extension sends `{ type: 'drawioFileChanged', relativePath: './diagrams/arch.drawio.svg' }`. The webview App component listens and updates a `drawioVersions` state map. `ResizableImage` takes this map (via context or prop drilling) and computes effective `src`.

---

## 5. Minimal Blank `.drawio.svg` Template

A valid empty Draw.io SVG that Draw.io can open and edit:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="640px" height="480px" viewBox="-0.5 -0.5 640 480">
  <defs/>
  <g/>
  <metadata><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></metadata>
</svg>
```

This is a blank 640×480 diagram that Draw.io desktop and VS Code extension can open and edit.

---

## 6. What Is NOT Needed

- No new TipTap extension — standard image node works.
- No changes to markdown parsing / serialization — `![alt](path)` round-trips as-is.
- No new npm dependency for rendering — browser renders SVG natively.
- No changes to patches or VS Code core.
- No new webview entry point.

---

## 7. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Draw.io extension not installed — click does nothing visible | Medium | Show notification with install prompt |
| Multiple `.drawio.svg` files in same directory — watcher fires for all | Low | Extension sends `relativePath` in event; webview matches exact path |
| Cache-busting prop causes unnecessary re-renders on unrelated images | Low | Use React context with path-keyed Map; only matching images re-render |
| Blank template SVG rejected by Draw.io versions | Low | Template is minimal valid mxGraph XML — supported since Draw.io v1 |
| `createDrawioFile` collides with existing filename | Low | Extension checks if file exists, prompts user or auto-increments name |
