# Sprint 32: Independent Review Findings & Research

## Review Summary

An independent review of the sprint plan identified critical blockers and scope issues. Additional web research was conducted to validate solutions.

* * *

## Critical Finding 1: PDF.js Worker + CSP

### The Problem

The webview uses `default-src 'none'` CSP with no `worker-src` directive. PDF.js requires a web worker for rendering. The Vite config uses `format: 'iife'` with `inlineDynamicImports: true` — conflicting with PDF.js worker loading.

### How Existing VS Code PDF Extensions Solve This

**vscode-pdf (tomoki1207):**
- Bundles PDF.js's `viewer.html` + `pdf.worker.js` as local extension resources
- Loads via `webview.asWebviewUri()` (mapped to VS Code's internal resource protocol)
- CSP needs `worker-src ${webview.cspSource} blob:` to permit worker instantiation
- Uses PDF.js's built-in viewer UI (not a custom React component)

**Modern PDF Preview (chocolatedesue):**
- Uses WASM-based rendering (not standard PDF.js worker)
- Svelte-based webview (not React)
- HTML template with `{{CSP_SOURCE}}` placeholder replaced at runtime
- Separate WASM URI for the rendering engine

### Our Solution

**Option A: Load worker as separate file (recommended)**
1. Copy `pdf.worker.min.mjs` to `media/` directory during build
2. Pass worker URI from extension to webview via `webview.asWebviewUri()`
3. Set `GlobalWorkerOptions.workerSrc = workerUri` in the webview
4. CSP: `worker-src ${webview.cspSource} blob:;`

**Option B: Disable worker (fallback)**
- Set `GlobalWorkerOptions.workerSrc = ''` — runs on main thread
- Simpler but causes UI freezes on large PDFs
- Acceptable for PoC, not for production

**Action: PoC required before full implementation.**

### Consider react-pdf

`react-pdf` wraps `pdfjs-dist` with React components (`<Document>`, `<Page>`). Handles worker configuration, canvas rendering, and provides built-in components. Would simplify implementation significantly for a React webview.

* * *

## Critical Finding 2: mammoth Does NOT Preserve Visual Formatting

### The Problem

The UX design promises "original author's formatting must remain intact." mammoth intentionally discards visual formatting in favor of semantic HTML. It does NOT preserve:
- Custom fonts or font sizes
- Colors or highlighting
- Text alignment (centered, right-aligned)
- Page breaks or page layout
- Headers/footers
- Table cell widths/heights
- Columns
- Most image positioning

### Solution: Switch to docx-preview

**docx-preview** (npm package by VolodymyrBaydalka):
- Renders DOCX with styles, fonts, margins, and colors preserved
- Used by the existing [Docx Renderer VS Code extension](https://marketplace.visualstudio.com/items?itemName=AdamRaichu.docx-viewer) (AdamRaichu)
- API: `renderAsync(document, bodyContainer, styleContainer, options)`
- Key option: `useBase64URL: true` (required for VS Code webview — blob: URLs restricted)
- Size: ~400KB (vs mammoth ~150KB) — acceptable tradeoff for visual fidelity
- Dependencies: JSZip (already a transitive dependency via xlsx)

**AdamRaichu's Docx Renderer extension** confirms this works in VS Code webview:
- Loads `jszip.min.js` + `docx-preview.min.js` as webview resources
- Uses `postMessage()` to send document data to webview
- Container div receives rendered HTML+CSS

### CSP Consideration for docx-preview

docx-preview generates inline styles for the document. The CSP needs:
- `style-src ${webview.cspSource} 'unsafe-inline'` (already in our existing CSP)
- `img-src ${webview.cspSource} data:` (for base64-encoded images via `useBase64URL: true`)
- `font-src ${webview.cspSource} data:` (for embedded fonts)

* * *

## Critical Finding 3: Incomplete Tailwind Theme Tokens

The tailwind.config.ts only defines a subset of shadcn theme tokens. Missing:
- `accent` / `accent-foreground` (used by ghost button hover)
- `destructive` (used by destructive variant)
- `secondary` / `secondary-foreground`
- `ring` (used in focus-visible styles)
- `input` (used in outline variant)

**Action:** Fix CSS variables in `index.css` and add colors to `tailwind.config.ts` before adding new shadcn components.

* * *

## Finding 4: Scope Is Over-Engineered

### Original Scope (10 phases, 90+ items)
- PDF viewer with continuous scroll + zoom + page nav
- DOCX viewer
- CSV sort
- CSV add/delete rows with context menus
- CSV add/delete/rename columns with dropdown menus
- CSV multi-line cell editing
- 4 new shadcn components

### Revised Scope (cut to achievable)

**Keep:**
1. PDF viewer (core viewer — PoC first)
2. DOCX viewer (using docx-preview)
3. CSV column sorting (clickable headers)
4. CSV add row (toolbar button)

**Cut to follow-up sprint:**
- CSV context menus (ContextMenu component)
- CSV column operations (add/delete/rename)
- CSV multi-line cells
- CSV delete row (complex edge cases)

### Why Cut?
- Context menus require `@radix-ui/react-context-menu` (not installed) and may conflict with VS Code's built-in context menu
- Column operations have many edge cases (delete all, rename conflicts)
- Multi-line cells need careful keyboard handling (Enter vs Shift+Enter)
- Each of these is a good mini-sprint on its own

* * *

## Finding 5: Base64 for Large PDFs

A 50MB PDF becomes ~67MB Base64, consuming ~134MB RAM. The Excel pattern works because Excel files are typically small. PDFs can be 100MB+.

**Mitigation:** Add file size warnings and consider streaming/chunked approach for files over 10MB. For V1, set a reasonable warning threshold.

* * *

## Finding 6: Missing Text Selection in PDF

Canvas-rendered PDFs are just images — users can't select/copy text. PDF.js supports a text layer overlay for selection, but requires extra implementation.

**Action:** Include text layer in implementation (not optional for a "Text Editor family" tool).

* * *

## Finding 7: No components.json for shadcn

No `components.json` exists for shadcn CLI. Components need manual copy-paste. This is workable but slower.

**Action:** Create `components.json` during setup phase.

* * *

## Updated Dependency Recommendations

| Library | Purpose | Notes |
|---------|---------|-------|
| ~~mammoth~~ | ~~DOCX → HTML~~ | **REPLACED** — doesn't preserve formatting |
| **docx-preview** | DOCX rendering | Visual fidelity, used by existing VS Code extension |
| **pdfjs-dist** or **react-pdf** | PDF rendering | react-pdf simplifies React integration |
| **@radix-ui/react-context-menu** | ~~CSV context menus~~ | **CUT from scope** |

* * *

## Sources

- [vscode-pdf extension (tomoki1207)](https://github.com/tomoki1207/vscode-pdfviewer)
- [Modern PDF Preview (chocolatedesue)](https://github.com/chocolatedesue/vscode-pdf)
- [AdamRaichu PDF Viewer](https://github.com/AdamRaichu/vscode-pdf-viewer)
- [AdamRaichu Docx Renderer](https://github.com/AdamRaichu/vscode-docx-viewer)
- [docx-preview npm](https://www.npmjs.com/package/docx-preview)
- [docxjs GitHub (VolodymyrBaydalka)](https://github.com/VolodymyrBaydalka/docxjs)
- [VS Code Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [PDF.js CSP issue #9676](https://github.com/mozilla/pdf.js/issues/9676)
- [PDF.js Vite worker discussion #19520](https://github.com/mozilla/pdf.js/discussions/19520)
- [VS Code webview CSP issue #79340](https://github.com/microsoft/vscode/issues/79340)

*Last updated: 2026-02-05*
