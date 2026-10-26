# KaTeX, the bundle and the fonts

Measured on 2026-10-26 against the main checkout's last webview build (20 October) and its installed packages. The question the shape left open: do KaTeX's fonts need a shell release?

## KaTeX's code is already in webview.js

- `media/webview.js` is **8,608,131 bytes** (#107).
- Mermaid 11.17.1 depends on **KaTeX 0.16.47** (`npm ls katex`: only through Mermaid) and imports it dynamically for math in diagram labels. The Vite build is one IIFE with `inlineDynamicImports: true`, so that import is inlined: `webview.js` contains KaTeX's version string `"0.16.47"`, its `KaTeX parse error` class and its symbol tables.
- KaTeX's **stylesheet and fonts are not** in it: no `KaTeX_Main` or `KaTeX_AMS` font name anywhere in the bundle. Mermaid uses KaTeX without its CSS.

So typesetting in the editor costs no new KaTeX code, as long as the editor imports **the same KaTeX** Mermaid already brings. A different version would be a second copy, about 270 KB more. The plan pins `katex` to `0.16.47` as a direct dependency of the webview and adds a check that `webview.js` holds one KaTeX, at the version `media/katex/` was copied from.

What is new in `webview.js`: the Markdown rules, two nodes and their views, the export preparation and a loader. Estimate 15–30 KB; the bound in the spec is 40 KB.

## The stylesheet and fonts

| KaTeX 0.16.47 `dist/` | Size |
|---|---|
| `katex.min.js` | 272,537 bytes (already in `webview.js`) |
| `katex.min.css` | 23,827 bytes |
| `fonts/*.woff2` (20 faces) | 296 KB |
| the same faces as `.woff` and `.ttf` | about 800 KB more |

KaTeX and its fonts are MIT (one licence for the package, `node_modules/katex/LICENSE`).

**The trap:** `vite.config.ts` has `assetsInlineLimit: 50000` ("Inline fonts as base64"), which is how Sofia Sans gets into `webview.js`. Importing `katex/dist/katex.min.css` into the webview would inline every font file that stylesheet names, in all three formats, as base64: about 1.5 MB more in a bundle already at 8.6 MB. The editor must never import KaTeX's CSS.

## Do the fonts need a shell release? Yes.

An extension release ships only `out/**/*.js`, `media/webview.js`, `media/office-preview.js` (with its notices) and `package.json` (`CLAUDE.md`, *Release Tiers*; `scripts/release-extension.sh` 204–207). Anything else under `extensions/ritemark/` reaches people only with an app release. So the fonts can travel in an extension release only inside `webview.js`: at least 400 KB of base64 for the woff2 faces alone, on every view that loads the bundle, whether it shows math or not. #107 argues against that.

**Decided in this plan:**
- KaTeX's stylesheet and its 20 woff2 faces live as files in `extensions/ritemark/media/katex/`, about 320 KB, with KaTeX's licence beside them, as `media/drawio/` carries its own. The webview build copies them from the pinned package and rewrites the stylesheet to name only the woff2 files, so nothing else is ever requested.
- The editor adds one `<link>` to that stylesheet the first time a document with math is shown, and never for a document without math. The URL is derived from `webview.js`'s own URL, so the host's HTML does not change. The editor's CSP already allows it: `style-src` and `font-src` include the webview's source, and `media/` is a local resource root.
- They reach people with the **2.1.0 shell release**, which the shape's decision 1 already makes. `scripts/validate-build-output.sh` gains a check that the built app has the stylesheet and all 20 faces.
- If the stylesheet cannot load (an extension-only update to an app without these files, or a broken path), the editor shows each equation as its source, never as unstyled glyphs. So the math code is safe in any app, but it looks right only in 2.1.0 and later.
- An extension release that changes `media/katex/` will be listed by `release-extension-preflight.sh` as unshipped and stop, as it does for every other such file.

**Audit A2** checks the `<link>` and the fonts load from `media/katex/` in a dev instance and in a production build, on the Mac and on Windows, and that the service worker serves woff2. If URL loading fails, the plan B keeps the files out of `webview.js` still: the host reads the faces once and sends them as `data:` URLs in an injected stylesheet (the CSP's `font-src` allows `data:`).

## Images of equations, for PDF, Google Docs and Word's fallback

The exporters run in the host and draw from HTML, so they need each equation as a picture. Only the webview can typeset.

**Plan A (recommended): KaTeX in the webview.** Typeset the equation off screen at the export's text size, measure its width, height and depth below the baseline, then draw it into a canvas through an SVG `foreignObject` that carries KaTeX's stylesheet and the faces it uses as `data:` URLs, at 4× (about 380 dpi at 11 pt), and save a PNG. The existing `rasterizeSvgToPngDataUrl` (`webview/src/lib/mermaid.ts`) does the last step for Mermaid and SVG images already. The fonts are KaTeX's, so the PDF and the Word fallback look like the editor, which the shape asks for ("KaTeX's fonts included").

**Plan B: MathJax 4, which Ritemark already ships for draw.io.** `media/drawio/math4/es5/` holds MathJax 4's TeX input, its SVG output and its TeX font as paths (`fonts/mathjax-tex-font/svg.js`, 1.4 MB), loaded only by draw.io today. Its SVG needs no font embedding and rasterizes through the same existing path, and could later give vector math in the PDF. The cost: a second typesetter whose output differs slightly from the editor's, and a dependency on draw.io's copy.

**Audit A3** decides: 30 equations through plan A in a dev instance, checked for sharpness at 100% and 200% zoom in a PDF viewer, for baselines inline, for the fonts (no fallback glyphs) and for time (100 equations in under 3 seconds). Plan B only if A fails.

## The host bundle

`out/extension.js` is 5,422,937 bytes. The host needs no KaTeX. `mathml2omml` stays outside it ([word-equations.md](word-equations.md)). The new host code (PDF inline layout, the Word wrapper, the Google Docs mapper cases) is an estimated 10–20 KB.
