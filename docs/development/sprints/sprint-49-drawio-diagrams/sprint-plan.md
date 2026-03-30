# Sprint 49: Draw.io Diagram Embeds

## Goal

Allow users to embed `.drawio.svg` diagrams inline in Ritemark's markdown editor, see them rendered as SVG images, click to open for editing in Draw.io, and have the image auto-refresh when the file changes on disk.

## Feature Flag Check

- [ ] Does this sprint need a feature flag?
  - This is new user-facing functionality (new UI overlay, new slash command, new bridge messages, new file watcher).
  - It is not platform-specific or premium, but it involves a soft dependency on an external VS Code extension (Draw.io). If the Draw.io extension is not installed, the "Edit Diagram" button still works (opens file in text editor as fallback).
  - **Decision: No flag at launch.** The feature degrades gracefully without Draw.io installed. No network calls, no permissions, no bundle size increase (SVG renders natively). The slash command and overlay are purely additive. Document why: additive UI only, graceful degradation, zero risk of data loss or regressions to existing behavior.

## Success Criteria

- [ ] A `.drawio.svg` file referenced in markdown renders as an inline SVG image (same as today — already works)
- [ ] When a `.drawio.svg` image is selected in the editor, an "Edit Diagram" button/overlay appears on the image
- [ ] Clicking "Edit Diagram" opens the `.drawio.svg` file in the VS Code editor (Draw.io visual editor if extension is installed, text editor otherwise)
- [ ] If the Draw.io VS Code extension is not installed, a notification appears with an "Install Draw.io" action that triggers extension install
- [ ] When a `.drawio.svg` file is saved externally (by Draw.io), the image in the editor refreshes automatically (cache-busted) without a full editor reload
- [ ] A `/Draw.io Diagram` slash command creates a blank `.drawio.svg` file in `./diagrams/` relative to the current markdown file and inserts the image link at the cursor
- [ ] Markdown roundtrip is preserved: save and reopen yields unchanged `![alt](path.drawio.svg)` syntax
- [ ] Webview bundle builds without error (`vite build`)

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| Updated `ResizableImage.tsx` | Detect `.drawio.svg`/`.drawio.png`; show "Edit Diagram" overlay when selected |
| New bridge message `openDrawioFile` | Webview → extension: open a `.drawio.svg` by relative path |
| New bridge message `createDrawioFile` | Webview → extension: create blank `.drawio.svg` and return relative path |
| New bridge message `drawioFileChanged` | Extension → webview: notify that a `.drawio.svg` changed on disk |
| Extension host handlers in `ritemarkEditor.ts` | Handle `openDrawioFile`, `createDrawioFile`; create `.drawio.svg` file watcher |
| `DrawioVersionContext` (React context) | Hold `Map<relativePath, number>` cache-buster; consumed by `ResizableImage` |
| Slash command entry | `/Draw.io Diagram` in `SlashCommands.tsx` |
| Blank `.drawio.svg` template | Minimal valid mxGraph SVG used when creating new diagram files |

## Implementation Checklist

### Phase 1: Extension Host — Message Handlers

- [ ] In `extensions/ritemark/src/ritemarkEditor.ts`, add case `openDrawioFile`:
  - Resolve `message.relativePath` relative to `document.uri.fsPath` parent directory
  - Call `vscode.commands.executeCommand('vscode.open', resolvedUri)`
  - If Draw.io extension is not installed (check via `vscode.extensions.getExtension('hediet.vscode-drawio')`), post `drawioExtensionMissing` message back to webview

- [ ] In `ritemarkEditor.ts`, add case `createDrawioFile`:
  - Accept optional `message.filename` (default: `diagram.drawio.svg`)
  - Resolve target path: `<docDir>/diagrams/<filename>` — create `diagrams/` subfolder if absent
  - If file already exists, auto-increment: `diagram-2.drawio.svg`, etc.
  - Write blank `.drawio.svg` template to disk
  - Post `drawioFileCreated` message back with `{ relativePath: './diagrams/<filename>' }`

- [ ] In `ritemarkEditor.ts`, extend `createFileWatcher()` or add a companion method to watch `**/*.drawio.svg` files in the document's directory:
  - On change → post `{ type: 'drawioFileChanged', relativePath }` to webview
  - Store watcher in `fileWatchers` Map (key: `drawio:<docPath>`) so it's disposed with the editor

### Phase 2: Webview — Cache-Bust Context

- [ ] Create `extensions/ritemark/webview/src/context/DrawioVersionContext.tsx`:
  - `DrawioVersionContext` with `Map<string, number>` state and `bumpVersion(relativePath)` action
  - `DrawioVersionProvider` wraps the app; listens for `drawioFileChanged` bridge messages and calls `bumpVersion`
  - Export `useDrawioVersion(relativePath: string): number` hook

- [ ] Wrap the editor root (in `App.tsx` or `Editor.tsx`) with `<DrawioVersionProvider>`

### Phase 3: Webview — ResizableImage Overlay

- [ ] In `ResizableImage.tsx`, detect Draw.io files:
  - `const isDrawio = title?.endsWith('.drawio.svg') || title?.endsWith('.drawio.png')`
  - Use `useDrawioVersion(title)` to get current version number
  - Compute effective src: `isDrawio && version > 0 ? src + '?v=' + version : src`

- [ ] Add "Edit Diagram" button overlay:
  - Only visible when `isDrawio && selected`
  - Positioned bottom-right inside the image container (similar to resize handles)
  - On click: `sendToExtension('openDrawioFile', { relativePath: title })`
  - Style: small pill button, `var(--vscode-button-background)` / `var(--vscode-button-foreground)`

- [ ] Handle `drawioExtensionMissing` message from extension:
  - Show an info notification inside the webview (toast or inline) with "Install Draw.io extension" link
  - Link action: `sendToExtension('installExtension', { extensionId: 'hediet.vscode-drawio' })`

- [ ] Add case `installExtension` in `ritemarkEditor.ts`:
  - `vscode.commands.executeCommand('workbench.extensions.installExtension', message.extensionId)`

### Phase 4: Slash Command

- [ ] In `extensions/ritemark/webview/src/extensions/SlashCommands.tsx`, add "Draw.io Diagram" entry:
  - Icon: `Share2` or `Network` from lucide-react (diagram-like icon)
  - On select: `sendToExtension('createDrawioFile', {})` and listen for `drawioFileCreated` response
  - On `drawioFileCreated`: insert `![diagram](relativePath)` at cursor using `editor.chain().focus().deleteRange(range).setImage({ src: resolvedSrc, alt: 'diagram', title: relativePath }).run()`
  - Note: listen for the `drawioFileCreated` response via a one-time `onMessage` handler registered before sending

### Phase 5: Build Verification

- [ ] Run `npx tsc --noEmit` in `extensions/ritemark/` — no TypeScript errors
- [ ] Run `npm run build` in `extensions/ritemark/webview/` — bundle builds cleanly
- [ ] Verify bundle size delta is negligible (no new large dependencies added)

## Technical Constraints

- `.drawio.svg` files render as standard `<img src="...">` — no special handling needed for display.
- Cache-busting must use query param (`?v=N`) not URL fragment — VS Code webview URI handling strips fragments.
- The `DrawioVersionContext` must be a React context (not prop drilling) because `ResizableImage` is a TipTap NodeView rendered outside the normal React tree.
- `createFileWatcher` uses `RelativePattern` — for watching all `.drawio.svg` in a directory, use `new vscode.RelativePattern(dirUri, '**/*.drawio.svg')`.
- The slash command's `createDrawioFile` is asynchronous: message goes to extension, file is created, response comes back. Use a one-time `onMessage` listener (similar to `selectImageFile` → `imageFileSelected` pattern already in the codebase) to receive the path before inserting.
- Do NOT use `display: none` on the NodeViewContent in ResizableImage — TipTap loses the editable reference. This is N/A here since we are not hiding content, only adding an overlay button.

## Risks

| Risk | Mitigation |
|------|------------|
| Draw.io extension not installed — button opens file as text | Show notification with install prompt; text editor fallback is still functional |
| Multiple `.drawio.svg` files in same dir — watcher fires generically | Extension resolves the changed file's absolute path and sends exact `relativePath` |
| Cache-busting triggers unnecessary re-renders on unrelated images | Context Map is keyed by exact relativePath; React only re-renders components that call `useDrawioVersion(thatPath)` |
| Slash command race condition (response arrives before listener registered) | Register the one-time `onMessage` listener BEFORE calling `sendToExtension` |
| Blank template SVG not accepted by older Draw.io versions | Template uses minimal standard mxGraph XML — compatible with all Draw.io versions |
| `diagrams/` folder creation fails (permissions) | Wrap in try/catch; show VS Code error notification with the caught message |

## Status

**Current Phase:** 2 (PLAN)
**Approval Required:** Yes — waiting for Jarmo's approval before Phase 3

## Approval

- [ ] Jarmo approved this sprint plan
