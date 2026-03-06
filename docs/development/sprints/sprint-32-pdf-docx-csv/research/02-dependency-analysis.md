# Dependency Analysis

## Current Dependencies

### Extension Dependencies (package.json)
```json
{
  "docx": "^8.5.0",         // Word generation (not viewing)
  "pdfkit": "^0.17.2",      // PDF generation (not viewing)
  "papaparse": "^5.5.3",    // CSV parsing ✓ (already in use)
  "xlsx": "^0.18.5"         // Excel parsing ✓ (already in use)
}
```

### Webview Dependencies (webview/package.json)
```json
{
  "papaparse": "^5.5.3",    // CSV parsing ✓ (already in use)
  "xlsx": "^0.18.5"         // Excel parsing ✓ (already in use)
}
```

## Required New Dependencies

### PDF Viewing: pdfjs-dist

**Library:** [mozilla/pdf.js](https://github.com/mozilla/pdf.js)

**Package:** `pdfjs-dist`

**Latest version:** ^4.0.379 (check npm for current)

**Why this library:**
- Industry standard (Mozilla-maintained)
- Pure JavaScript (no native dependencies)
- Works in webview context
- Canvas-based rendering
- Text selection and search support
- Already used by VS Code internally

**Bundle size impact:**
- pdfjs-dist: ~2.5MB (includes worker)
- Will increase webview.js from ~900KB to ~3.4MB
- Acceptable for built-in viewer

**Installation:**
```bash
cd extensions/ritemark/webview
npm install pdfjs-dist
```

**Usage pattern:**
```typescript
import * as pdfjsLib from 'pdfjs-dist';

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '...';

// Load PDF
const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

// Render page
const page = await pdf.getPage(pageNumber);
const viewport = page.getViewport({ scale: 1.0 });
await page.render({ canvasContext, viewport }).promise;
```

### DOCX Viewing: mammoth

**Library:** [mammoth.js](https://github.com/mwilliamson/mammoth.js)

**Package:** `mammoth`

**Latest version:** ^1.8.0 (check npm for current)

**Why this library:**
- Converts DOCX to HTML (perfect for webview)
- Minimal dependencies
- Works in browser/webview
- Preserves formatting (headings, bold, italic, lists)
- Handles images (converts to data URLs or requires external handling)

**Alternative considered:**
- `docx-preview`: Heavier, requires DOM manipulation
- `docxtemplater`: For generation, not viewing
- **mammoth wins:** Lightweight, clean HTML output

**Bundle size impact:**
- mammoth: ~150KB
- Small impact on webview.js

**Installation:**
```bash
cd extensions/ritemark/webview
npm install mammoth
```

**Usage pattern:**
```typescript
import mammoth from 'mammoth';

// Convert to HTML
const result = await mammoth.convertToHtml({
  arrayBuffer: docxBuffer
});

// result.value contains HTML
// result.messages contains warnings
```

**HTML output example:**
```html
<h1>Document Title</h1>
<p>Paragraph with <strong>bold</strong> and <em>italic</em>.</p>
<ul>
  <li>List item 1</li>
  <li>List item 2</li>
</ul>
```

## CSV Editing: No New Dependencies

**Already have:**
- `papaparse` for parsing/serialization
- `@tanstack/react-table` for table rendering
- `@tanstack/react-virtual` for virtual scrolling

**Enhancements will use existing stack.**

## Dependency Summary

| Feature | Package | Size | Install Location |
|---------|---------|------|------------------|
| PDF Preview | pdfjs-dist | ~2.5MB | webview |
| DOCX Preview | mammoth | ~150KB | webview |
| CSV Editing | (existing) | 0 | - |

**Total webview bundle increase:** ~2.65MB (900KB → ~3.55MB)

**Risk assessment:**
- Bundle size acceptable for built-in app (not extension)
- Initial load time increase: ~1-2 seconds on slow connections
- Mitigation: Lazy loading PDF.js worker (async import)
- Webview caching helps after first load

## Installation Order

1. Install pdfjs-dist in webview
2. Install mammoth in webview
3. Update webview build to include new dependencies
4. Test bundle size (`npm run build` in webview/)
5. Verify webview.js is reasonable size (<5MB)

## Worker Configuration

**PDF.js requires a worker:**
- Worker file: `pdfjs-dist/build/pdf.worker.mjs`
- Must be accessible to webview
- Options:
  1. Copy worker to `media/` during build
  2. Use CDN (not suitable for offline app)
  3. Inline worker (increases bundle size)

**Recommended:** Copy worker to media/ as separate file
- Configure workerSrc to webview URI
- Keeps main bundle smaller
- Better performance

**Vite configuration:**
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.includes('pdf.worker')) {
            return 'pdf.worker.js';
          }
          return '[name].[ext]';
        }
      }
    }
  }
});
```

## Compatibility Check

### pdfjs-dist
- **Node version:** Works with Node 20 (current project)
- **Browser support:** Modern browsers (ES2017+)
- **Webview compatibility:** ✓ (VS Code webview is Electron/Chromium)

### mammoth
- **Node version:** Works with Node 20
- **Browser support:** Modern browsers
- **Webview compatibility:** ✓
- **Image handling:** Converts to data URLs (inline base64)

## No Extension-Side Dependencies Needed

Both PDF and DOCX viewing will happen **client-side in webview**.

Extension only needs to:
1. Read binary file
2. Convert to Base64
3. Send to webview

All parsing and rendering happens in React components.

This follows the Excel pattern established in sprint-19.
