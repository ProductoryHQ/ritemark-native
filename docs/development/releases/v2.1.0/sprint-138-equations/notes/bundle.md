# Bundle and weight (E2, A6, R13, S42)

Measured on 26 October 2026. "Before" is `b5ae122f` (Sprint 137's pipeline extraction, the branch's base); "after" is the branch's head.

| File | Before | After | Change |
|---|---|---|---|
| `media/webview.js` | 8,612,316 | 8,648,733 | **+36,417 bytes (35.6 KiB)**, under the plan's 40 KB |
| `media/office-preview.js` | 2,576,131 | 2,582,480 | +6,349 (the shared `ui/Icon.tsx` and editor modules it also imports) |
| `out/extension.js` | 5,650,663 | 5,678,780 | +28,117 (the PDF layout, the Word wrapper, Google Docs' math) |
| `media/katex/` (new) | — | 282,600 bytes in 23 files | `katex.min.css` (woff2 only), 20 woff2 faces (259,792 bytes), `LICENSE`, `VERSION` |
| `node_modules/mathml2omml` (new, esbuild external) | — | 628 KB on disk | unmodified, loaded only when a Word copy has an equation |

**One KaTeX.** `webview/package.json` names `"katex": "0.16.47"` exactly, the version Mermaid already brought; the lockfile still has one `katex`. `media/webview.js` holds one copy: KaTeX's "KaTeX parse error" string appears once. The Vite plugin (`katexAssets` in `webview/vite.config.ts`) fails the build if a second copy or another version appears, and writes the version to `media/katex/VERSION`.

**What the editor loads.** A document without math loads nothing new: no stylesheet, no fonts. A document with math adds one `<link>` to `media/katex/katex.min.css`, and the browser fetches only the faces the equations use (the analyst report: `KaTeX_Math-Italic` and `KaTeX_Main-Regular`, 42,712 bytes, after the 21,693-byte stylesheet). The JavaScript that typesets is the copy Mermaid already shipped, imported on demand.

**What a release must carry.** `media/katex/` is outside the files an extension release ships (`out/**/*.js`, `media/webview.js`, `media/office-preview.js`), and `mathml2omml` is an esbuild external in `node_modules`, so this sprint is a shell release (the tier rule in `CLAUDE.md`). `scripts/validate-build-output.sh` checks for the stylesheet, its licence, the 20 faces, the version marker in `webview.js`, and `node_modules/mathml2omml/dist/index.js` with its licence in the built app.
