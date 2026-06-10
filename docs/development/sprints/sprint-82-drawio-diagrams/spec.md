# Sprint 82 Spec — Draw.io Diagram Embedding

**Track:** SDD
**Branch:** `sprint-82-drawio-diagrams`
**Architecture doc:** `docs/development/architecture.md`

---

## Purpose

Users can create and embed draw.io diagrams directly in `.md` files. The workflow is: type `/diagram` in the editor to create a new `.drawio.svg` file beside the markdown file and insert an image reference; click the diagram in the preview to open the draw.io editor; save to update the file and re-render the preview inline. The implementation uses the Apache 2.0 draw.io JS library directly — no GPL-3.0 code is copied or bundled.

---

## Principles

- **Clean-room implementation.** The hediet/vscode-drawio extension (GPL-3.0) may be read for approach and inspiration only. No code is copied. All implementation is original.
- **Portable markdown.** Diagrams live as `.drawio.svg` files beside the `.md`. The markdown image reference `![](diagram.drawio.svg)` is standard and renders anywhere SVG is supported — GitHub, Obsidian, VS Code preview, etc.
- **Separate bundle.** The draw.io JS bundle (~10 MB) is loaded only by the draw.io editor webview. It must never enter `media/webview.js`. This is a hard constraint from GH#107.
- **Offline-first.** The draw.io bundle is vendored locally — no CDN, no network required at runtime.
- **Feature is ON by default** per CLAUDE.md HARD RULE #2. A feature flag exists as a kill-switch only.
- **No VS Code patches.** The entire feature lives in `extensions/ritemark/src/` and `extensions/ritemark/webview/`. No changes to `patches/vscode/`.

---

## Requirements

### R1: `DrawioEditorProvider` — custom editor for `.drawio.svg`

As a user, I want `.drawio.svg` files to open in a draw.io editing panel inside Ritemark so I can edit diagrams without leaving the app.

Acceptance criteria:
- `extensions/ritemark/src/drawioEditorProvider.ts` registers a `CustomTextEditorProvider` for `*.drawio.svg` (viewType `ritemark.drawioEditor`).
- Opening a `.drawio.svg` file shows a webview containing the draw.io iframe editor.
- The draw.io iframe is loaded from a **vendored local bundle** (`media/drawio/`) via `webview.asWebviewUri` — no external network calls at runtime.
- Editing a diagram and clicking Save (or Ctrl+S) writes the updated SVG+XML back to the `.drawio.svg` file on disk.
- The file is read/written as UTF-8 text (SVG with embedded XML in `<mxGraphModel>` element).
- The editor webview has its own HTML page (`media/drawio-editor.html` or generated inline) separate from `media/webview.js`. The shared TipTap webview bundle is NOT loaded by this editor.
- `package.json` `customEditors` gains an entry for `*.drawio.svg` with `priority: "default"`.
- `extension.ts` registers the provider via `DrawioEditorProvider.register(context)`.

### R2: draw.io bundle vendoring strategy

As a developer building Ritemark, I want a documented, reproducible way to vendor the draw.io JS bundle so any developer can update it and the offline bundle always reflects a pinned draw.io version.

Acceptance criteria:
- A pinned draw.io release artifact is downloaded and placed at `extensions/ritemark/media/drawio/` (the exact file — see Technical Plan for the recommended artifact).
- The vendored bundle version is recorded in `extensions/ritemark/media/drawio/VERSION` (single line, e.g. `v24.7.17`).
- The draw.io bundle files are added to `.gitignore` if > 5 MB (consistent with the `binaries/agents/` pattern) — or committed if small enough. Decision and rationale recorded in Technical Plan.
- The draw.io editor webview CSP allows `script-src` for the bundle served from `webview.cspSource` only — no `unsafe-inline` script, no `cdnjs.cloudflare.com`, no remote origin.
- A `scripts/vendor-drawio.sh` script (or inline instructions in `docs/development/sprints/sprint-82-drawio-diagrams/research/drawio-bundle-audit.md`) documents the exact download + placement steps so any developer can re-vendor.

### R3: webview ↔ host message protocol for draw.io editor

As a developer, I want a documented message protocol between the draw.io editor webview and the extension host so the save/load cycle is explicit and traceable.

Acceptance criteria:
- Extension → editor webview messages:
  - `{ type: 'drawio:load', xml: string }` — sent after the editor signals ready; `xml` is the current `<mxGraphModel>` content extracted from the `.drawio.svg` file, or an empty diagram XML string for new files.
- Editor webview → extension host messages:
  - `{ type: 'drawio:ready' }` — sent by the webview JS when the draw.io iframe signals it is ready to receive diagram data.
  - `{ type: 'drawio:save', svg: string }` — sent when the user triggers save; `svg` is the full SVG string exported by draw.io (with embedded XML).
- The draw.io iframe ↔ editor webview bridge uses `window.postMessage` with the draw.io documented embed API (`load`, `export`, `save` actions). This bridge code is written from scratch using the published draw.io embed API documentation — not copied from hediet/vscode-drawio.
- Message shapes are documented as TypeScript interfaces in `drawioEditorProvider.ts` (as internal types, not exported from `runtime/`).

### R4: TipTap image node — SVG rendering and click-to-edit

As a user editing a markdown file, I want `.drawio.svg` references to render as diagrams inline in the TipTap preview, and clicking a draw.io diagram to open its editor panel.

Acceptance criteria:
- `.drawio.svg` image references render visually in the TipTap editor (the existing `ImageExtension` / `ResizableImage` component renders SVG `src` values via `<img>` — confirm this works for `.drawio.svg` paths resolved to `webviewUri`).
- Clicking a `.drawio.svg` image in the editor sends `sendToExtension('openDrawioDiagram', { relativePath: string })` to the extension host.
- The extension host handles `openDrawioDiagram` in `ritemarkEditor.ts` by opening the `.drawio.svg` file using VS Code's `vscode.commands.executeCommand('vscode.openWith', uri, 'ritemark.drawioEditor')`.
- Clicking opens the draw.io editor in a new tab (or existing tab if already open for that file), not a side panel.
- This works regardless of whether the diagram is in the current document's directory or a subdirectory.

### R5: "Insert Diagram" slash command and toolbar button

As a user, I want to type `/diagram` in the editor or click an Insert Diagram button in the toolbar to create a new diagram file and insert a reference in the markdown.

Acceptance criteria:
- `blockItems.ts` gains a new item: `{ title: 'Diagram', description: 'Insert a draw.io diagram', icon: 'graph', nodeType: 'drawio' }`.
- When the user triggers the slash command, the webview sends `sendToExtension('insertDiagram', { insertPos: number })` to the extension host.
- The extension host (`ritemarkEditor.ts` handler for `insertDiagram`) creates a new `.drawio.svg` file beside the current markdown file, named `diagram.drawio.svg` (or `diagram-2.drawio.svg`, etc., auto-incrementing to avoid collisions).
- The new file is initialised with a minimal empty draw.io SVG template (see Technical Plan for the template content).
- The extension host sends `{ type: 'insertImageAtPos', relativePath: string, pos: number }` back to the webview (reusing the existing image insertion flow, or a close equivalent).
- The TipTap editor inserts `![](./diagram.drawio.svg)` (the relative path) at the cursor position.
- After insertion, the extension host opens the new `.drawio.svg` file in the draw.io editor panel automatically (`vscode.openWith`).

---

## Non-Requirements

- No `.drawio` (raw XML) or `.drawio.png` file format support in this sprint. `.drawio.svg` only.
- No export of diagrams to PNG/PDF from within Ritemark.
- No inline base64 embedding of diagram content in markdown (file-beside-md is the only mode).
- No multi-page diagram support (draw.io supports pages; the editor may show them but Ritemark renders only the first page via `<img>`).
- No diagram toolbar or property panel beyond what draw.io's own UI provides.
- No collaboration or co-editing.
- No drag-and-drop of existing `.drawio.svg` files from the OS into the editor (future sprint).
- No integration with the AI agent (no "generate diagram from prompt" — future sprint).
- No changes to the VS Code submodule or patches.

---

## Resolved Questions

- **File placement:** `.drawio.svg` beside the `.md` file (not inline base64). Rationale: self-contained, portable, same pattern as image attachments, standard markdown image syntax. Decision: binding (Jarmo comment on GH#111).
- **Library choice:** Apache 2.0 draw.io JS library (jgraph/drawio), not hediet/vscode-drawio (GPL-3.0). Decision: binding (Jarmo comment on GH#111).
- **TipTap SVG rendering:** The existing `ImageExtension` uses `<img src=...>` which renders SVG files correctly as long as the source URI is a valid `webviewUri`. The `ResizableImage` component does not special-case SVG. A `.drawio.svg` image reference resolves to a `webviewUri` during document load (the same mechanism as other local images), so it renders inline without changes to the TipTap image node. Confirmed by reading `imageExtensions.ts` and `ResizableImage.tsx` — no TipTap extension changes are needed for rendering. Click-to-edit requires a small addition to `ResizableImage` (detect `.drawio.svg` in `src` and send `openDrawioDiagram` instead of resize handles).
- **Offline bundle artifact:** The draw.io project ships a self-contained `drawio-desktop` release bundle. The recommended vendoring target is the `draw.io-x.y.z.html` file from the GitHub release of jgraph/drawio — a single self-contained HTML file that can be loaded in an iframe. Alternatively, `src/main/webapp/` (the web app directory from the draw.io repo) can be used; the audit in `research/drawio-bundle-audit.md` will determine which artifact is smaller and simpler to vendor.

## Open Questions

| # | Question | Owner | Default if unresolved |
|---|---|---|---|
| Q1 | Which specific draw.io artifact to vendor: single-file `draw.io.html` from release page, or `webapp/` directory from source? Size, CSP compatibility, and iframe embed API support differ. | Audit in `research/drawio-bundle-audit.md` before Phase 3 | Use `draw.io.html` single-file approach — simpler CSP, one file |
| Q2 | Should the `media/drawio/` bundle be gitignored (like `binaries/agents/`) or committed? If gitignored, the CI/build process must vendor it. If committed, git history grows ~10 MB. | Jarmo decision at approval gate | Gitignore it; add vendoring step to dev setup docs |
| Q3 | The `drawio-diagrams` feature flag: `status: 'experimental'` (shows in settings toggle) or `status: 'stable'` (ON, no toggle needed)? Given this is a new feature with a 10 MB vendored bundle, `experimental` seems appropriate for the first sprint. | Jarmo decision at approval gate | `experimental` |
| Q4 | Should `.drawio.svg` files appear in the Ritemark file explorer sidebar, or only be accessible from the markdown preview? | Jarmo decision | Appear in explorer (no special hiding needed — VS Code shows all files by default) |
