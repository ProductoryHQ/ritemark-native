# Draw.io Bundle Audit — Sprint 82

**Status:** COMPLETE (2026-06-10) — protocol verified in headless Chromium; final in-VS-Code verification happens at S-test time (S1–S4)

**Purpose:** Verify that the draw.io release artifact works inside a VS Code webview iframe under the constraints Ritemark imposes (CSP, offline-only, `webview.asWebviewUri` resource URIs). Also confirms the `proto=json` embed API round-trips needed by R3.

---

## Questions Answered

| # | Question | Answer |
|---|---|---|
| A1 | Does the artifact load in an `<iframe>`? | **YES** — full editor UI (menubar, toolbar, canvas) renders in Chromium iframe served from local origin. VS Code webview uses the same engine; resource-origin specifics verified at S-test. |
| A2 | What is the exact release filename pattern? | **`draw.war` only.** The assumed single-file `draw.io-x.y.z.html` DOES NOT EXIST on jgraph/drawio releases (checked v30.0.4, 2026-06-10). The WAR is a zip of the deployable webapp. → **Fallback path taken: vendored webapp subset.** |
| A3 | Inline `<script>` (needs `'unsafe-inline'`)? | **NO** — `index.html` loads only external `js/bootstrap.js` + `js/main.js`; one inline `<style>` block (style-src, not script-src). The iframe is a separate document with its own CSP context, so the outer webview CSP does not constrain the iframe's scripts; outer CSP only needs `frame-src` for the webview resource origin. |
| A4 | `{ action: 'load', xml }` updates canvas? | **YES** — `load` event fired; subsequent export contained the loaded shapes. |
| A5 | `{ action: 'export', format: 'xmlsvg' }` returns SVG with embedded XML? | **YES** — returns `data:image/svg+xml;base64,...`; decoded SVG contains `content="..."` attribute with the mxfile XML. This IS the `.drawio.svg` file content — no manual XML-into-SVG writing needed; the export format does it. |
| A6 | Ctrl+S inside iframe fires `{ event: 'save', xml }`? | **YES** — save event received with xml payload. |
| A7 | Measured size | Full WAR: 52 MB (151 MB extracted). **Verified minimal subset: 36 MB uncompressed / 17.6 MB gzip.** Breakdown: js/ 23 MB (app.min 9.3 + stencils.min 7.6 + extensions.min 4.6 + shapes 1.4), images/ 6.4 MB, math4/ 3.4 MB (MathJax), mxgraph/ 3.1 MB, styles+resources+html < 0.3 MB. |
| A8 | `frame-src` limited to webview resource origin? | Verified at S-test (S4). Expected to work: iframe `src` = `asWebviewUri(...)` resolves to the webview resource origin, which `frame-src` can allowlist exactly. |

## Subset contents (verified passing)

```
index.html  favicon.ico
js/{bootstrap,main,PreConfig,PostConfig,app.min,stencils.min,shapes-14-6-5.min,extensions.min}.js
styles/  mxgraph/  images/  math4/  resources/dia.txt
```

Both `extensions.min.js` and `math4/` are loaded eagerly by the app — omitting either prevents `init` from firing (verified empirically).

**Excluded** (and the consequence):
- `stencils/` (42 MB) + `img/lib` (11 MB) — extended "More Shapes" libraries and their preview images. Basic shape set (in `stencils.min.js`) works; opening exotic shape categories may show load errors. v1 limitation, documented.
- `templates/` (5.6 MB) — new-file template picker; not shown in embed mode.
- `js/integrate.min.js` (22 MB), `js/viewer*.js`, unminified source dirs (`js/diagramly`, `js/grapheditor`), `js/mermaid` — not used by embed flow.
- 60 of 61 i18n files — `lang=en` forced; `resources/dia.txt` kept.
- Cloud-integration html shims (dropbox/github/onedrive/teams), `service-worker.js` — not used with `offline=1`.

## Protocol test evidence (headless Chromium 1.56, 2026-06-10)

Embed URL: `index.html?embed=1&proto=json&offline=1&lang=en&spin=1`

```
events: init → load → export → save
export: data:image/svg+xml;base64,... with embedded content XML  ✓
Ctrl+S → save event with xml                                      ✓
external network requests: 0                                      ✓
404s against the 36 MB subset: 0                                  ✓
```

Test scripts: `/tmp/drawio-protocol-test.js`, `/tmp/shot.js` (throwaway, per audit procedure — not committed). Screenshot confirmed editor chrome renders.

---

## Decision

- [ ] ~~Ship with single-file approach~~ — **impossible, artifact does not exist (A2)**
- [x] **Ship with webapp-subset approach** — vendor the 36 MB verified subset extracted from `draw.war` v30.0.4; `scripts/vendor-drawio.sh` downloads the WAR and extracts exactly the subset list above
- [ ] Defer

### Impact on plan

1. **R3 simplification:** `export` with `format: 'xmlsvg'` already returns the complete `.drawio.svg` file content (SVG with embedded XML). The "writing XML into SVG is slightly manual" risk is GONE — we save the export output directly.
2. **W2 change:** `vendor-drawio.sh` downloads `draw.war`, unzips, copies the subset list, writes `VERSION`.
3. **Size deviation:** 36 MB vs the ~10 MB assumed when Q2 (commit to git) was decided. ESCALATED to Jarmo before committing the bundle (risk-register mitigation).
4. **v1 limitation:** "More Shapes" extended libraries not bundled.
