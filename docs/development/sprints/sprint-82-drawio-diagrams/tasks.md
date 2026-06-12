# Sprint 82 Tasks — Draw.io Diagram Embedding

---

## Phase 0: Audit (W0 — gate for Phase 3) — COMPLETE 2026-06-10

- [x] Read draw.io embed API documentation
- [x] Check release artifacts — **finding: single-file `draw.io-x.y.z.html` does NOT exist; only `draw.war`** → webapp-subset fallback taken
- [x] Build protocol test harness (headless Chromium + local static server over the extracted WAR)
- [x] Test `proto=json` embed mode: `load` action updates canvas (also verified `load` accepts full `.drawio.svg` file content directly)
- [x] Test `export` action: `format: 'xmlsvg'` returns base64 SVG with embedded XML — complete `.drawio.svg` file content
- [x] Test `save` event: Ctrl+S inside iframe fires `{ event: 'save', xml }` on outer page
- [x] Check CSP: `index.html` has NO inline scripts; iframe is a separate CSP document — outer page needs only `frame-src`
- [x] Measure size: full WAR 151 MB extracted; verified minimal subset **36 MB** (17.6 MB gzip)
- [x] Findings + decision recorded in `research/drawio-bundle-audit.md`: **ship with webapp-subset**
- [x] Size deviation (36 MB vs ~10 MB assumed) escalated to Jarmo — **approved, commit to git** (2026-06-10)

---

## Phase 3: Implementation — COMPLETE 2026-06-10

### W2: Bundle vendoring (R2)

- [x] Create `extensions/ritemark/media/drawio/` with the verified subset (index.html, js/, styles/, mxgraph/, images/, math4/, resources/dia.txt)
- [x] Write `scripts/vendor-drawio.sh` — downloads `draw.war`, extracts exactly the audited subset
- [x] `extensions/ritemark/media/drawio/VERSION` = `v30.0.4`
- [x] Bundle committed to git (Q2 resolved: commit, no `.gitignore` entry)

### W1: `DrawioEditorProvider` (R1, R3)

- [x] `extensions/ritemark/src/drawioEditorProvider.ts`
  - [x] `DrawioEditorProvider implements vscode.CustomTextEditorProvider` (`resolveCustomTextEditor`)
  - [x] `static register(context)` returning a Disposable
  - [x] Webview options: `localResourceRoots` scoped to `media/drawio/` only
  - [x] `getEditorHtml`: iframe to `index.html?embed=1&proto=json&offline=1&lang=en&spin=1`, nonce'd bridge script, CSP `default-src 'none'; frame-src cspSource; script-src nonce`
  - [x] `drawio:ready` → send full `document.getText()` as `drawio:load` (no XML extraction needed — verified by audit; `extractXmlFromSvg` dropped as unnecessary)
  - [x] `drawio:save` → workspace edit replaces document text + `document.save()` + `drawio:saved` clears the editor's modified flag
  - [x] init/load race guard + overlapping-save guard
- [x] `package.json`: `customEditors` entry for `*.drawio.svg` + `onCustomEditor:ritemark.drawioEditor` activation event
- [x] `extension.ts`: import + register gated by `isEnabled('drawio-diagrams')`

### W3: `ritemarkEditor.ts` handlers (R4, R5)

- [x] Read existing image insertion flow — **finding: `imageSaved {path, displaySrc}` + `image:pending-position` flow covers positional insert fully; no `insertImageAtPos` message needed**
- [x] `getUniqueDrawioPath(dir)` helper
- [x] `EMPTY_DRAWIO_SVG_TEMPLATE` — uncompressed-mxfile SVG, load + round-trip verified in audit harness
- [x] `case 'openDrawioDiagram'` — resolves relative path, existence check, `vscode.openWith` → `ritemark.drawioEditor`
- [x] `case 'insertDiagram'` — creates `images/diagram[-N].drawio.svg` (mkdir recursive), posts `imageSaved`, opens editor

### W4: TipTap webview (R4, R5)

- [x] `blockItems.ts`: Diagram item (`icon: 'graph'`) + `drawio` branches in `executeSlashCommand` and `executeBlockInsert` (reuse `image:pending-position`)
- [x] `ResizableImage.tsx`: `.drawio.svg` detection (title or src), click → `openDrawioDiagram`, resize handles suppressed, pointer cursor + hover outline + "Click to edit diagram" tooltip
- [x] `ui/Icon.tsx`: added Phosphor `Graph` icon as `'graph'`
- [x] `insertImageAtPos` not needed — existing `imageSaved` handler in `Editor.tsx` consumes the flow unchanged

### W5: Feature flag + architecture doc prep (cross-cutting)

- [x] `flags.ts`: `'drawio-diagrams'` in `FlagId` union + registry entry (`status: 'stable'`, all platforms)
- [x] `docs/development/architecture.md` updated at close (see Phase 5)

---

## Phase 4: Integration Testing

Automated/host-verifiable rows done in the remote container; UI rows (S1–S13, S16) require the built app — **Jarmo's local test pass**.

- [ ] S1: Open existing `.drawio.svg` — draw.io editor opens, diagram renders, no network requests *(protocol verified in Chromium harness; VS Code pass pending)*
- [ ] S2: Edit diagram, Ctrl+S — file on disk is updated, re-render fires in open markdown preview
- [ ] S3: Open new empty `.drawio.svg` — blank canvas loads, no error *(template load verified in harness)*
- [ ] S4: CSP — dev tools network tab shows zero external requests *(zero external requests verified in harness)*
- [ ] S5: Malformed `.drawio.svg` — editor opens with empty canvas, no crash
- [ ] S6: Vendor script — clean checkout, run `scripts/vendor-drawio.sh`, open draw.io editor — works
- [ ] S7: `.drawio.svg` renders inline in markdown preview (TipTap `<img>`)
- [ ] S8: Click `.drawio.svg` in preview — draw.io editor panel opens for that file
- [ ] S9: Click regular PNG — resize handles appear, `openDrawioDiagram` NOT sent
- [ ] S10: Click `.drawio.svg` in subdirectory path — editor opens the correct file
- [ ] S11: `/diagram` slash command — creates `images/diagram.drawio.svg` (folder created if missing), inserts `![](./images/diagram.drawio.svg)`, editor opens
- [ ] S12: Auto-increment — `images/diagram.drawio.svg` exists, `/diagram` creates `images/diagram-2.drawio.svg`
- [ ] S13: Second auto-increment — result is `images/diagram-3.drawio.svg`
- [x] S14: Feature flag — `isEnabled('drawio-diagrams')` returns true by default (stable status; featureGate tests pass)
- [x] S15: No drawio code in `media/webview.js` — bundle rebuilt at 7.99 MB, drawio loads only in the dedicated editor webview
- [ ] S16: Windows path test — deferred to win32 build availability

---

## Phase 5: QA Gate — PASSED 2026-06-10

- [x] TypeScript compiles cleanly (`tsc -p ./` exit 0; webview `tsc --noEmit` exit 0)
- [x] Pre-commit hook passes (`.claude/hooks/pre-commit-validator.sh`)
- [x] `qa-validator` sign-off — READY TO COMMIT, zero sprint-82 regressions (1 pre-existing console.log warning, 1 pre-existing vscode-module integration-test env limitation)
- [x] `media/webview.js` size check — 7.99 MB, NOT increased by the draw.io bundle
- [x] `docs/development/architecture.md` updated — Last updated 2026-06-10, Sprint 82 Version History entry, `[editors]` line includes `drawioEditorProvider.ts`
- [x] `research/drawio-bundle-audit.md` complete and decision recorded
- [x] Q2 resolved (commit to git) — implemented
- [x] Q3 resolved (`stable` flag) — implemented
