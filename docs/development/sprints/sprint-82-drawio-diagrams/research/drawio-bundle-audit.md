# Draw.io Bundle Audit — Sprint 82

**Status:** PENDING — must complete before Phase 3 implementation begins

**Purpose:** Verify that the draw.io single-file release artifact (`draw.io-x.y.z.html`) works inside a VS Code webview iframe under the constraints Ritemark imposes (CSP, offline-only, `webview.asWebviewUri` resource URIs). Also confirms the `proto=json` embed API round-trips needed by R3.

---

## Questions to Answer

| # | Question | Answer |
|---|---|---|
| A1 | Does `draw.io-x.y.z.html` load in a VS Code webview `<iframe>` via `asWebviewUri`? | PENDING |
| A2 | What is the exact release filename pattern on GitHub releases? | PENDING |
| A3 | Does the single-file HTML use inline `<script>` (needs `'unsafe-inline'`)? | PENDING |
| A4 | Does `{ action: 'load', xml: '...' }` via `postMessage` update the canvas? | PENDING |
| A5 | Does `{ action: 'export', format: 'svg' }` return a full SVG with embedded `<mxGraphModel>` XML? | PENDING |
| A6 | Does pressing Ctrl+S inside the iframe fire `{ event: 'save', xml: '...' }` on the outer page? | PENDING |
| A7 | Measured file size (MB) | PENDING |
| A8 | Can `frame-src` in the outer page's CSP be limited to the webview resource origin? | PENDING |

---

## Test Procedure

1. Download latest release from https://github.com/jgraph/drawio/releases.
2. Place at `extensions/ritemark/media/drawio/draw.io.html`.
3. Write a minimal `DrawioTestProvider` (throwaway, not committed) that opens a webview with an iframe pointing to `asWebviewUri(drawioHtml)`.
4. Open a `.drawio.svg` file with the test provider.
5. Open VS Code DevTools (Help → Toggle Developer Tools) and observe:
   - Console errors (CSP violations, missing resources).
   - Network tab (confirm zero external requests).
6. Add a test script to the webview that sends `postMessage` commands to the iframe and logs responses.

---

## Decision

_To be filled in after the audit:_

- [ ] **Ship with single-file approach** — proceed with `W1` as designed
- [ ] **Fall back to `webapp/` directory** — update `W2` and `W1` CSP handling accordingly
- [ ] **Defer** — document blockers here; sprint scope reduced to R2 + R3 protocol design only

---

## Findings

_(To be filled in during Phase 0)_
