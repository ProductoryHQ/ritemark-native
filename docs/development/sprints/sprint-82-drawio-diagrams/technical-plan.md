# Sprint 82 Technical Plan — Draw.io Diagram Embedding

---

## Architecture Overview

This sprint adds one new subsystem to `extensions/ritemark/src/`: a `DrawioEditorProvider` following the existing `docxEditorProvider` / `pdfEditorProvider` / `excelEditorProvider` pattern. It also adds a draw.io editor-specific HTML page and vendored JS bundle under `extensions/ritemark/media/drawio/`, touches `ritemarkEditor.ts` for two new message handlers, and makes small additions to the TipTap webview for click-to-edit and the slash command.

```
extensions/ritemark/
├── src/
│   ├── drawioEditorProvider.ts     ← NEW (R1, R3)
│   └── ritemarkEditor.ts           ← modified: two new message handlers (R4, R5)
├── media/
│   └── drawio/                     ← NEW vendored bundle dir (R2)
│       ├── draw.io.html            ← vendored draw.io iframe bundle
│       └── VERSION                 ← pinned version string
├── webview/src/
│   ├── extensions/blockItems.ts    ← modified: add 'drawio' item (R5)
│   └── components/ResizableImage.tsx ← modified: detect .drawio.svg, send openDrawioDiagram (R4)
└── package.json                    ← modified: customEditors entry + activationEvent (R1)
```

No changes to:
- `patches/vscode/` — confirmed, no VS Code patch needed.
- `src/runtime/`, `src/agent/`, `src/flows/`, `src/views/` — no agent or flow changes.
- `media/webview.js` build pipeline (Vite) — draw.io bundle is NOT imported by any webview source file.

**Architecture doc update required** (Sprint Architecture Gate): adding `drawioEditorProvider.ts` at the `src/` level is a structural change per the gate rules. `docs/development/architecture.md` must be updated before sprint close.

---

## Open Questions Resolution (from spec.md)

### Q1: Which draw.io artifact to vendor?

**Recommendation: `draw.io.html` single-file release artifact.**

The draw.io project publishes a self-contained `draw.io-x.y.z.html` file on each GitHub release (https://github.com/jgraph/drawio/releases). This file embeds all required JS and CSS inline and supports the iframe embed API (`window.postMessage` with `load`, `export`, `save` actions) documented at https://www.drawio.com/doc/faq/embed-mode.

Advantages over vendoring the full `src/main/webapp/` directory:
- Single file (~10 MB vs ~30 MB for the full webapp directory).
- No separate asset dependencies — no broken relative paths to manage under VS Code's webviewUri rewriting.
- The iframe embed URL for the single file is `drawioUri + '?embed=1&proto=json'`.

**Confirmed by audit:** see `research/drawio-bundle-audit.md`. The audit must verify: (a) the single-file approach works with VS Code's `webview.asWebviewUri`; (b) the `proto=json` embed mode supports `load`, `export`, and `save` messages as needed; (c) the CSP for the editor webview can accommodate the inline scripts in the bundled file (the single-file HTML uses inline `<script>` tags — this requires `'unsafe-inline'` in `script-src` for the editor webview only, or a nonce-based approach if feasible).

**If the audit finds the single-file approach is CSP-incompatible in the VS Code webview context**, fall back to vendoring a subset of `src/main/webapp/` with only the required JS entry points. The audit must decide before implementation begins (R2 is a Phase 0 audit gate for W1).

### Q2: Bundle gitignore vs commit — RESOLVED

**Decision (Jarmo, 2026-06-10): commit the bundle to git.**

The ~10 MB single-file bundle is committed for simpler onboarding — no `.gitignore` entry, no pre-commit presence check needed. `scripts/vendor-drawio.sh` still exists, but only as the documented path for bumping the pinned draw.io version.

### Q3: Feature flag status — RESOLVED

**Decision (Jarmo, 2026-06-10): `status: 'stable'`.**

The `drawio-diagrams` flag exists as a kill-switch only and is not surfaced in the Settings feature-toggle list. Feature is ON by default (HARD RULE #2).

---

## Workstream 0: Audit (R2 gate — must complete before W1)

### `research/drawio-bundle-audit.md`

Investigate and document:
1. Download the latest draw.io release `draw.io-x.y.z.html` from https://github.com/jgraph/drawio/releases.
2. Load it as an iframe `src` using `webview.asWebviewUri` in a minimal VS Code webview extension test. Confirm it renders the draw.io canvas.
3. Test the `proto=json` embed API: send `{ action: 'load', xml: '<mxGraphModel>...</mxGraphModel>' }` via `iframe.contentWindow.postMessage`. Confirm the canvas updates.
4. Test the `export` action: send `{ action: 'export', format: 'svg' }`, receive `{ event: 'export', data: '...' }`. Confirm the SVG contains embedded XML.
5. Test the `save` event (triggered by Ctrl+S inside the iframe): confirm `{ event: 'save', xml: '...' }` arrives on the outer webview's `window.addEventListener('message', ...)`.
6. Check CSP requirements: does the single-file HTML use inline `<script>` (requiring `'unsafe-inline'`) or is it nonce-compatible?
7. Measure file size of the vendored artifact.

**Decision output:** ship with single-file approach / fall back to webapp directory / defer with blockers documented.

---

## Workstream 1: `DrawioEditorProvider` (R1, R3)

### Extension host: `src/drawioEditorProvider.ts`

Structure follows `docxEditorProvider.ts` pattern:

```typescript
// Sprint 82 R1, R3
export class DrawioEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'ritemark.drawioEditor';

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      DrawioEditorProvider.viewType,
      new DrawioEditorProvider(context),
      { webviewOptions: { retainContextWhenHidden: true } }
    );
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  async resolveCustomEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> { ... }
}
```

Key implementation details:
- `document` is a `vscode.TextDocument` (not a `CustomDocument`) because `.drawio.svg` is a text file — use `CustomTextEditorProvider`, not `CustomReadonlyEditorProvider`. This matches `ritemarkEditor.ts` (the Ritemark editor also uses `CustomTextEditorProvider`).
- The webview HTML loads a minimal host page (`getEditorHtml()`) that contains an `<iframe>` pointing to `drawioUri` (the vendored bundle via `webview.asWebviewUri`).
- `localResourceRoots` includes `vscode.Uri.joinPath(context.extensionUri, 'media', 'drawio')`.
- On `webviewPanel.webview.onDidReceiveMessage`:
  - `drawio:ready` → read `document.getText()`, extract `<mxGraphModel>` XML, send `{ type: 'drawio:load', xml }`.
  - `drawio:save` → receive `{ type: 'drawio:save', svg: string }` → apply a workspace edit that replaces the full document text with the new SVG string.

### Message shapes (internal types)

```typescript
// Extension → webview
interface DrawioLoadMessage { type: 'drawio:load'; xml: string; }

// Webview → extension
interface DrawioReadyMessage { type: 'drawio:ready'; }
interface DrawioSaveMessage  { type: 'drawio:save'; svg: string; }
```

### `getEditorHtml()` — editor webview page

The host page is a minimal HTML shell:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             frame-src ${drawioFrameSrc};
             script-src 'nonce-${nonce}' ${webview.cspSource};
             style-src 'unsafe-inline';">
</head>
<body style="margin:0;padding:0;overflow:hidden;">
  <iframe id="drawio-frame"
    src="${drawioUri}?embed=1&proto=json"
    style="width:100%;height:100vh;border:none;">
  </iframe>
  <script nonce="${nonce}">
    // Bridge: VS Code webview ↔ draw.io iframe
    // Sprint 82 R3 — clean-room implementation of draw.io embed API bridge
    ...
  </script>
</body>
</html>
```

CSP note: `frame-src` allows the vendored draw.io URI (a `vscode-webview-resource:` URI). The inline bridge script uses a nonce. If W0 audit finds the draw.io HTML itself requires `'unsafe-inline'` inside the iframe, that is sandboxed inside the `<iframe>` and does not weaken the outer page's CSP.

### XML extraction helper

The `.drawio.svg` file is an SVG with the full diagram XML in a `<mxGraphModel>` element embedded in an `<svg:defs>` or as a top-level element. The extraction function:

```typescript
// Sprint 82 R3: extract mxGraphModel XML from .drawio.svg text
function extractXmlFromSvg(svgText: string): string {
  const match = svgText.match(/<mxGraphModel[\s\S]*?<\/mxGraphModel>/);
  return match ? match[0] : '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>';
}
```

The fallback empty-diagram XML is the minimal valid draw.io graph model.

### `package.json` changes

1. `customEditors` — add entry:
   ```json
   {
     "viewType": "ritemark.drawioEditor",
     "displayName": "Draw.io Editor",
     "selector": [{ "filenamePattern": "*.drawio.svg" }],
     "priority": "default"
   }
   ```
2. `activationEvents` — add `"onCustomEditor:ritemark.drawioEditor"`.

### `extension.ts` changes

```typescript
import { DrawioEditorProvider } from './drawioEditorProvider';
// in activate():
if (isEnabled('drawio-diagrams')) {
  context.subscriptions.push(DrawioEditorProvider.register(context));
}
```

---

## Workstream 2: Bundle vendoring (R2)

### `extensions/ritemark/media/drawio/` layout (after vendoring)

```
media/drawio/
├── draw.io.html     ← vendored single-file bundle (committed to git — Q2)
└── VERSION          ← e.g. "v24.7.17"
```

### `scripts/vendor-drawio.sh`

```bash
#!/usr/bin/env bash
# Sprint 82 R2: Download and vendor the draw.io bundle
# Usage: ./scripts/vendor-drawio.sh [version]
# Default version: v24.7.17

VERSION=${1:-v24.7.17}
DEST="extensions/ritemark/media/drawio"
mkdir -p "$DEST"
curl -L "https://github.com/jgraph/drawio/releases/download/${VERSION}/draw.io-${VERSION#v}.html" \
  -o "$DEST/draw.io.html"
echo "$VERSION" > "$DEST/VERSION"
echo "Vendored draw.io $VERSION to $DEST/"
```

Exact version and filename format to be confirmed by W0 audit; the script is updated accordingly.

### Git handling

Q2 resolved: the bundle is committed to git — no `.gitignore` entry. Both `draw.io.html` and `VERSION` are tracked.

---

## Workstream 3: `ritemarkEditor.ts` — new message handlers (R4, R5)

### Handler: `openDrawioDiagram` (R4)

Added to `resolveCustomEditor`'s `onDidReceiveMessage` switch in `ritemarkEditor.ts`:

```typescript
case 'openDrawioDiagram': {
  // Sprint 82 R4: click-to-edit draw.io diagram from markdown preview
  const { relativePath } = message as { relativePath: string };
  const docDir = path.dirname(document.uri.fsPath);
  const absPath = path.resolve(docDir, relativePath);
  const diagramUri = vscode.Uri.file(absPath);
  await vscode.commands.executeCommand('vscode.openWith', diagramUri, 'ritemark.drawioEditor');
  break;
}
```

### Handler: `insertDiagram` (R5)

```typescript
case 'insertDiagram': {
  // Sprint 82 R5: create new .drawio.svg and insert reference
  const { insertPos } = message as { insertPos: number };
  const docDir = path.dirname(document.uri.fsPath);
  const diagramPath = getUniqueDrawioPath(docDir);
  const relativePath = './' + path.basename(diagramPath);

  // Write empty diagram template
  await fsp.writeFile(diagramPath, EMPTY_DRAWIO_SVG_TEMPLATE, 'utf-8');

  // Insert image reference at cursor
  webview.postMessage({ type: 'insertImageAtPos', relativePath, pos: insertPos });

  // Open draw.io editor for the new file
  await vscode.commands.executeCommand(
    'vscode.openWith',
    vscode.Uri.file(diagramPath),
    'ritemark.drawioEditor'
  );
  break;
}
```

Helper functions added to `ritemarkEditor.ts`:

```typescript
// Sprint 82 R5: find a unique .drawio.svg filename in the given directory
function getUniqueDrawioPath(dir: string): string {
  const base = path.join(dir, 'diagram.drawio.svg');
  if (!fs.existsSync(base)) return base;
  let i = 2;
  while (true) {
    const candidate = path.join(dir, `diagram-${i}.drawio.svg`);
    if (!fs.existsSync(candidate)) return candidate;
    i++;
  }
}

// Sprint 82 R5: minimal valid draw.io SVG template
const EMPTY_DRAWIO_SVG_TEMPLATE = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="1" height="1" viewBox="-0.5 -0.5 1 1">
  <defs/>
  <mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>
</svg>`;
```

---

## Workstream 4: TipTap webview — click-to-edit and slash command (R4, R5)

### `ResizableImage.tsx` — click-to-edit detection (R4)

Add a click handler that checks if `src` ends with `.drawio.svg`:

```typescript
// Sprint 82 R4: detect draw.io diagrams and open editor on click
const isDrawioDiagram = src.endsWith('.drawio.svg') || title?.endsWith('.drawio.svg');

const handleClick = useCallback(() => {
  if (isDrawioDiagram && title) {
    sendToExtension('openDrawioDiagram', { relativePath: title });
  }
}, [isDrawioDiagram, title]);
```

- Resize handles are NOT shown for `.drawio.svg` images (a resized SVG has no meaning; the diagram's own size is set inside draw.io).
- The `title` attribute of the image node holds the relative path (same as for regular local images — see existing `ResizableImage` code).

### `blockItems.ts` — add Diagram item (R5)

```typescript
{ title: 'Diagram', description: 'Insert a draw.io diagram', icon: 'graph', nodeType: 'drawio' },
```

### `blockItems.ts` — `executeSlashCommand` and `executeBlockInsert` (R5)

```typescript
if (item.nodeType === 'drawio') {
  const insertPos = range.from;
  editor.chain().focus().deleteRange(range).run();
  sendToExtension('insertDiagram', { insertPos });
  return;
}
```

Same pattern as the existing `'image'` branch. `executeBlockInsert` gets the same guard.

### `webview/src/App.tsx` or `ritemarkEditor.ts` — handle `insertImageAtPos` response

The extension host sends `{ type: 'insertImageAtPos', relativePath, pos }` back to the webview. This needs to be received and the TipTap editor must insert an image node at `pos`. Check if the existing image insertion flow already handles `insertImageAtPos` — if yes, reuse it. If not, add a message handler in `App.tsx`:

```typescript
// Sprint 82 R5: insert image at position after diagram file creation
case 'insertImageAtPos': {
  const { relativePath, pos } = msg;
  // Use the same webviewUri resolution as existing image insertion
  // Reuse the existing 'imageInserted' / 'insertImage' flow if possible
  break;
}
```

The exact integration point (existing message vs. new handler) is determined during implementation by reading how `ritemarkEditor.ts` currently handles `selectImageFile` → `imageSelected` → TipTap image insertion.

---

## Workstream 5: Feature flag + architecture doc (cross-cutting)

### `src/features/flags.ts` — add flag

```typescript
export type FlagId =
  // ... existing ...
  | 'drawio-diagrams';

'drawio-diagrams': {
  id: 'drawio-diagrams',
  label: 'Draw.io Diagram Editing',
  description: 'Create and edit draw.io diagrams (.drawio.svg) embedded in markdown files. Requires vendored draw.io bundle (~10 MB).',
  status: 'stable',  // Q3 resolved (Jarmo, 2026-06-10) — kill-switch only
  platforms: ['darwin', 'win32', 'linux'],
},
```

### `docs/development/architecture.md`

Update at sprint close (Sprint Architecture Gate):
- Subsystem Map: add `drawioEditorProvider.ts` to the `[editors]` line.
- Version History: add Sprint 82 entry.

---

## Implementation Order

```
W0: Audit (research/drawio-bundle-audit.md) — gate for all other workstreams
  ↓
W2: Vendor bundle (scripts/vendor-drawio.sh, media/drawio/) — unblocks W1
  ↓
W1: DrawioEditorProvider (host-side: load/save cycle, message protocol)
  ↓
W3: ritemarkEditor.ts handlers (openDrawioDiagram, insertDiagram)
  ↓
W4: TipTap webview (ResizableImage click-to-edit, blockItems slash command)
  ↓
W5: Feature flag + architecture doc update
```

W1 and W3 can be developed in parallel once W2 is done (they don't depend on each other until integration test).

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| draw.io single-file HTML has inline scripts incompatible with VS Code webview CSP | Medium | Medium — would require vendoring webapp/ directory instead | W0 audit tests this directly before any code; fallback path is defined |
| `window.postMessage` embed API behavior differs between draw.io versions | Low | Medium — could break save/load silently | Pin to a specific draw.io version in VERSION file; test the API in W0 audit before committing to a version |
| draw.io bundle size exceeds 10 MB causing build / CI issues | Low | Low — bundle is committed (Q2), size lands in repo + DMG | W0 audit measures size; if materially larger than ~10 MB, surface to Jarmo before committing |
| `insertImageAtPos` reuse is blocked — existing flow doesn't support positional insert | Low | Low — add a new message handler; small addition | Read the image insertion flow during W4 to confirm before planning |
| `vscode.openWith` for `.drawio.svg` opens in wrong editor (e.g. Ritemark text editor picks it up before drawioEditor) | Low | Medium — `customEditors` priority ordering must be correct | Test `priority: "default"` for `*.drawio.svg`; VS Code resolves by file pattern specificity, and `*.drawio.svg` is more specific than `*.md` |
| Windows path handling: `path.resolve` with mixed separators for `relativePath` in `openDrawioDiagram` | Low | Low — win32-x64 build target | Use `path.resolve` (handles mixed separators); add a Windows path scenario to integration test |
