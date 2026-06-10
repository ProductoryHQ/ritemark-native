# Sprint 82 Scenarios — Draw.io Diagram Embedding

---

## Feature: DrawioEditorProvider — open and edit `.drawio.svg` files (R1, R3)

### Scenario: Open existing `.drawio.svg` — happy path

Given a `.drawio.svg` file exists in the workspace
When the user opens it (double-click in explorer or `vscode.openWith`)
Then a webview panel opens with the title matching the filename
And the draw.io iframe loads from the vendored local bundle (no network request)
And the diagram XML from the file is loaded into the draw.io canvas

### Scenario: Save from draw.io editor

Given the draw.io editor panel is open with a diagram
When the user makes a change and triggers save (Ctrl+S or the draw.io Save button)
Then the editor webview sends `drawio:save` to the extension host
And the extension host writes the new SVG string to the `.drawio.svg` file on disk
And a file-change event triggers re-render in any open markdown previews referencing that file

### Scenario: Open new (empty) `.drawio.svg` file

Given a new file `diagram.drawio.svg` has just been created (e.g. via the Insert Diagram command)
When the draw.io editor panel opens
Then the draw.io canvas shows an empty diagram (not an error or blank white screen)
And the user can add shapes immediately

### Scenario: Editor webview uses only local resources (CSP)

Given the draw.io editor webview is open
When the browser developer tools inspect network requests
Then no requests go to `diagrams.net`, `cloudflare.com`, or any external CDN
And all scripts load from `vscode-resource:` (webviewUri) pointing to `media/drawio/`

### Scenario: Malformed `.drawio.svg` file

Given a `.drawio.svg` file whose embedded XML is corrupt or missing
When the user opens it in the draw.io editor
Then the editor does not crash
And the draw.io canvas shows an empty diagram (graceful fallback)
And no error dialog is thrown at the VS Code level (error is caught and logged)

---

## Feature: draw.io bundle vendoring (R2)

### Scenario: Vendor script produces a working bundle

Given a developer runs `scripts/vendor-drawio.sh` (or follows the manual steps in `research/drawio-bundle-audit.md`)
When the script completes
Then `extensions/ritemark/media/drawio/` contains the draw.io bundle files
And `extensions/ritemark/media/drawio/VERSION` contains the pinned version string
And opening a `.drawio.svg` in the draw.io editor works without errors

### Scenario: Bundle version is recorded

Given the draw.io bundle is vendored at version `v24.7.17` (example)
When a developer reads `extensions/ritemark/media/drawio/VERSION`
Then the file contains exactly `v24.7.17`

---

## Feature: TipTap inline rendering and click-to-edit (R4)

### Scenario: `.drawio.svg` renders inline in markdown preview

Given a markdown file contains `![My Diagram](./diagrams/architecture.drawio.svg)`
And `architecture.drawio.svg` exists in `./diagrams/` relative to the markdown file
When the markdown file is open in Ritemark
Then the diagram renders as an inline image in the TipTap editor
And the rendered image shows the diagram content (not a broken image icon)

### Scenario: Clicking a `.drawio.svg` image opens the draw.io editor

Given a markdown file with an embedded `.drawio.svg` diagram rendered in TipTap
When the user clicks the diagram image
Then the extension receives `openDrawioDiagram` with the correct relative path
And `vscode.openWith` is called to open the `.drawio.svg` in `ritemark.drawioEditor`
And the draw.io editor panel opens (or gains focus if already open)

### Scenario: Clicking a regular `.png` or `.jpg` image does NOT trigger the draw.io flow

Given a markdown file with a regular PNG image
When the user clicks it
Then the normal resize-handle flow activates (existing ResizableImage behavior)
And `openDrawioDiagram` is NOT sent to the extension host

### Scenario: Draw.io diagram image in a subdirectory

Given a markdown file at `/workspace/docs/readme.md`
And it references `![](./assets/flow.drawio.svg)`
When the user clicks the diagram
Then `openDrawioDiagram` sends `relativePath: './assets/flow.drawio.svg'`
And the extension host resolves the absolute path correctly relative to the markdown file's directory
And the draw.io editor opens `flow.drawio.svg`

---

## Feature: Insert Diagram slash command (R5)

### Scenario: `/diagram` creates a new file and inserts a reference

Given a markdown file is open in Ritemark
And the cursor is on an empty line
When the user types `/diagram` and selects "Diagram" from the slash command popup
Then the webview sends `insertDiagram` to the extension host
And the extension host creates `diagram.drawio.svg` in the same directory as the markdown file
And the file is initialized with a valid empty draw.io SVG template
And the editor inserts `![](./diagram.drawio.svg)` at the cursor position
And the draw.io editor opens automatically for the new file

### Scenario: Auto-incrementing filename to avoid collision

Given `diagram.drawio.svg` already exists in the current directory
When the user inserts a new diagram via `/diagram`
Then the new file is named `diagram-2.drawio.svg`
And the markdown reference inserted is `![](./diagram-2.drawio.svg)`

### Scenario: Second auto-increment

Given `diagram.drawio.svg` and `diagram-2.drawio.svg` both exist
When the user inserts a new diagram via `/diagram`
Then the new file is named `diagram-3.drawio.svg`

### Scenario: Insert Diagram when no markdown file is active

Given no markdown file is open
When the `insertDiagram` message arrives at the extension host
Then the extension host logs a warning and takes no action (no crash, no file created)

### Scenario: Slash command item appears in the command palette

Given the user opens the slash command popup with `/`
When they type `dia`
Then the "Diagram" item appears in the filtered list with the graph icon and description "Insert a draw.io diagram"

---

## Feature: Feature flag and architecture gate (cross-cutting)

### Scenario: Feature flag exists and is on by default

Given the extension has loaded
When `isEnabled('drawio-diagrams')` is called
Then it returns `true` (flag status is `stable` or `experimental`, not `disabled`)

### Scenario: Draw.io editor is not registered when flag is disabled

Given the `drawio-diagrams` flag is set to `status: 'disabled'` in `flags.ts`
And the extension is reloaded
Then `ritemark.drawioEditor` is not registered as a custom editor provider
And `.drawio.svg` files fall back to VS Code's default text editor

### Scenario: No draw.io code enters `media/webview.js`

Given the production build has completed
When a developer measures `media/webview.js` size
Then the size has not increased by the draw.io bundle size (~10 MB)
And a grep for `mxGraph` or `drawio` in `media/webview.js` returns no matches
