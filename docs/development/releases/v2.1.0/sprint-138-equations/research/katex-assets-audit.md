# Audit A2: KaTeX's stylesheet and fonts from `media/katex/`

Run on 26 October 2026. The question: does a stylesheet and its fonts next to `webview.js` load by `<link>` inside the editor's webview, through VS Code's webview service worker, without the host sending them?

**Result: plan A works in a dev instance on the Mac.** The host sends nothing; plan B (`data:` faces from the host) is not needed.

## How it loads

- `main.tsx` records `webview.js`'s own URL at start (`lib/webviewAssets.ts`), before anything else can change `document.currentScript`.
- The first time a document holds an equation, `mathRender.ts` adds `<link rel="stylesheet">` to `katex/katex.min.css` beside that URL, and imports KaTeX (Mermaid's copy) on demand. Until the stylesheet loads, equations hold their space invisibly; if it fails within 10 s, equations show their source rather than unstyled HTML.
- The stylesheet is rewritten at build time to name only the woff2 faces, so the browser asks for one file per face it draws with, and nothing else.

## What was seen

| Check | Result |
|---|---|
| A document with math | requests `katex.min.css`, then only the faces in use: for the analyst report `KaTeX_Math-Italic.woff2` and `KaTeX_Main-Regular.woff2`, served by the service worker |
| A document without math | no KaTeX request at all |
| The webview's CSP and resource roots | unchanged: `media/katex/` is under the extension's existing root |
| Equations typeset with the stylesheet | yes, the drawing's sizes (inline 1.08em, display 1.18em) |
| A production build (clean-room worktree) | **not run**: after the merge, with S43 |
| Windows | **not run**: the Windows session, before Gate 1 |

The production check is the same files reaching the built app, which `scripts/validate-build-output.sh` now checks (the stylesheet, its licence, 20 faces, and the version marker in `webview.js`).
