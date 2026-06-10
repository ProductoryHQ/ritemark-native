# Sprint 82 Tasks — Draw.io Diagram Embedding

---

## Phase 0: Audit (W0 — gate for Phase 3)

- [ ] Read draw.io embed API documentation at https://www.drawio.com/doc/faq/embed-mode
- [ ] Download draw.io latest release `draw.io-x.y.z.html` from https://github.com/jgraph/drawio/releases
- [ ] Build minimal VS Code webview test: load the single-file HTML as iframe `src` via `webview.asWebviewUri`
- [ ] Test `proto=json` embed mode: send `{ action: 'load', xml: '<mxGraphModel>...' }` via `postMessage` — confirm canvas updates
- [ ] Test `export` action: send `{ action: 'export', format: 'svg' }` — confirm `{ event: 'export', data: '<svg>...' }` arrives
- [ ] Test `save` event: press Ctrl+S inside iframe — confirm `{ event: 'save', xml: '...' }` arrives at outer page
- [ ] Check CSP: does the single-file HTML require `'unsafe-inline'` in `script-src`? Document finding.
- [ ] Measure vendored file size (MB)
- [ ] Write findings in `research/drawio-bundle-audit.md` with decision: single-file / webapp-dir / defer
- [ ] If single-file approach is blocked: document fallback plan and update W1 scope accordingly

---

## Phase 3: Implementation

### W2: Bundle vendoring (R2)

- [ ] Create `extensions/ritemark/media/drawio/` directory
- [ ] Write `scripts/vendor-drawio.sh` with the exact download + placement steps from W0 audit
- [ ] Run the vendor script; verify `draw.io.html` is present and loads in a browser
- [ ] Create `extensions/ritemark/media/drawio/VERSION` with the pinned version string
- [ ] Add `extensions/ritemark/media/drawio/draw.io.html` to `.gitignore` (if gitignore approach confirmed by Jarmo — Q2)
- [ ] Verify pre-commit hook check: if bundle is gitignored, add a check that fails with a clear message if `media/drawio/draw.io.html` is missing

### W1: `DrawioEditorProvider` (R1, R3)

- [ ] Create `extensions/ritemark/src/drawioEditorProvider.ts`
  - [ ] `DrawioEditorProvider` class implements `vscode.CustomTextEditorProvider`
  - [ ] `static register(context)` method returning a Disposable
  - [ ] `resolveCustomEditor`: sets up webview options with `localResourceRoots` including `media/drawio/`
  - [ ] `getEditorHtml(webview)`: generates HTML with draw.io iframe, nonce, correct CSP
  - [ ] Message handler: `drawio:ready` → read document, extract XML, send `drawio:load`
  - [ ] Message handler: `drawio:save` → apply workspace edit writing full SVG to document
  - [ ] `extractXmlFromSvg(svgText)` helper with empty-diagram fallback
  - [ ] `getNonce()` helper (or import shared utility if one exists)
- [ ] Update `extensions/ritemark/package.json`:
  - [ ] Add `customEditors` entry for `*.drawio.svg` (`ritemark.drawioEditor`, `priority: "default"`)
  - [ ] Add `activationEvents` entry `"onCustomEditor:ritemark.drawioEditor"`
- [ ] Update `extensions/ritemark/src/extension.ts`:
  - [ ] Import `DrawioEditorProvider`
  - [ ] Register in `activate()` gated by `isEnabled('drawio-diagrams')`

### W3: `ritemarkEditor.ts` handlers (R4, R5)

- [ ] Read existing image insertion flow (`selectImageFile` → `imageSelected` → TipTap) to understand the `insertImageAtPos` integration point
- [ ] Add `getUniqueDrawioPath(dir)` helper function
- [ ] Add `EMPTY_DRAWIO_SVG_TEMPLATE` constant
- [ ] Add `case 'openDrawioDiagram'` handler in `resolveCustomEditor` message switch
- [ ] Add `case 'insertDiagram'` handler in `resolveCustomEditor` message switch
- [ ] Confirm `insertImageAtPos` response is handled by the webview (or add handler if missing — see W4)

### W4: TipTap webview (R4, R5)

- [ ] `extensions/ritemark/webview/src/extensions/blockItems.ts`:
  - [ ] Add `{ title: 'Diagram', description: 'Insert a draw.io diagram', icon: 'graph', nodeType: 'drawio' }` to `blockItems` array
  - [ ] Add `drawio` branch to `executeSlashCommand`: delete range, send `insertDiagram` with `insertPos`
  - [ ] Add `drawio` branch to `executeBlockInsert`: send `insertDiagram` with `pos`
- [ ] `extensions/ritemark/webview/src/components/ResizableImage.tsx`:
  - [ ] Detect `.drawio.svg` in `src` or `title`
  - [ ] Add `onClick` handler: if `isDrawioDiagram`, call `sendToExtension('openDrawioDiagram', { relativePath: title })`
  - [ ] Suppress resize handles for `.drawio.svg` images (no `isLocalImage && selected` resize UI)
- [ ] Verify `insertImageAtPos` message is handled by App.tsx or equivalent — add handler if missing

### W5: Feature flag + architecture doc prep (cross-cutting)

- [ ] `extensions/ritemark/src/features/flags.ts`:
  - [ ] Add `'drawio-diagrams'` to `FlagId` union type
  - [ ] Add flag entry with `status: 'experimental'` (or `'stable'` — confirmed by Jarmo Q3), platforms all three
- [ ] Confirm `docs/development/architecture.md` update is queued for sprint close (do NOT update until all code is done — sprint architecture gate runs at close)

---

## Phase 4: Integration Testing

Manual test matrix — each row maps to a scenario in `scenarios.md`.

- [ ] S1: Open existing `.drawio.svg` — draw.io editor opens, diagram renders, no network requests
- [ ] S2: Edit diagram, Ctrl+S — file on disk is updated, re-render fires in open markdown preview
- [ ] S3: Open new empty `.drawio.svg` — blank canvas loads, no error
- [ ] S4: CSP — dev tools network tab shows zero external requests from draw.io editor webview
- [ ] S5: Malformed `.drawio.svg` — editor opens with empty canvas, no crash
- [ ] S6: Vendor script — clean checkout, run `scripts/vendor-drawio.sh`, open draw.io editor — works
- [ ] S7: `.drawio.svg` renders inline in markdown preview (TipTap `<img>`)
- [ ] S8: Click `.drawio.svg` in preview — draw.io editor panel opens for that file
- [ ] S9: Click regular PNG — resize handles appear, `openDrawioDiagram` NOT sent
- [ ] S10: Click `.drawio.svg` in subdirectory path — editor opens the correct file
- [ ] S11: `/diagram` slash command — creates `diagram.drawio.svg`, inserts `![](./diagram.drawio.svg)`, editor opens
- [ ] S12: Auto-increment — `diagram.drawio.svg` exists, `/diagram` creates `diagram-2.drawio.svg`
- [ ] S13: Second auto-increment — `diagram.drawio.svg` and `diagram-2.drawio.svg` exist, result is `diagram-3.drawio.svg`
- [ ] S14: Feature flag — `isEnabled('drawio-diagrams')` returns true by default
- [ ] S15: No drawio code in `media/webview.js` — grep `mxGraph` returns no match
- [ ] S16: Windows path test — open `.drawio.svg` referenced from subdirectory on win32 (if win32-x64 build is available for testing; else document as deferred)

---

## Phase 5: QA Gate

- [ ] TypeScript compiles cleanly (`tsc --noEmit` from `extensions/ritemark/`)
- [ ] Pre-commit hook passes (`.claude/hooks/pre-commit-validator.sh`)
- [ ] `qa-validator` sign-off (route via main session — sprint-manager cannot invoke agents directly)
- [ ] `media/webview.js` size check: confirm bundle size has NOT increased by draw.io bundle size
- [ ] `docs/development/architecture.md` updated — `Last updated` = 2026-06-10 or sprint close date, Sprint 82 entry in Version History, `[editors]` line updated to include `drawioEditorProvider.ts`
- [ ] `research/drawio-bundle-audit.md` complete and decision recorded
- [ ] Q2 (gitignore vs commit) resolved and implemented
- [ ] Q3 (flag status) resolved and implemented
