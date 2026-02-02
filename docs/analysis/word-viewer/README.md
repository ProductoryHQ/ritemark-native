# Word Document Viewer - Integration Analysis

**Date:** 2025-12-15
**Purpose:** Evaluate OSS libraries for .docx preview in Ritemark extension

---

## Executive Summary

| Library | Fidelity | Bundle Size | License |
|---------|----------|-------------|---------|
| **docx-preview** | Good (HTML-based) | ~240KB | Apache-2.0 |
| **Mammoth.js** | Low (semantic only) | ~300KB | BSD-2-Clause |

**Reality check:** Perfect fidelity requires server/cloud solutions (MS Office Online, ONLYOFFICE, Collabora) which don't fit local-first architecture. For client-side only, **docx-preview** is the best available option.

---

## Rejected Options

| Option | Why Rejected |
|--------|--------------|
| **MS Office Web Apps** | Requires public URL + internet |
| **MS Graph API** | Requires OneDrive/SharePoint + auth |
| **ONLYOFFICE** | Requires server, AGPL, commercial for SaaS |
| **Collabora Online** | Requires server |
| **ZetaOffice** | 300MB+ WASM, beta, poor performance |

---

## Client-Side Options (Local-First Compatible)

### 1. docx-preview (RECOMMENDED)

**Repository:** [github.com/VolodymyrBaydalka/docxjs](https://github.com/VolodymyrBaydalka/docxjs)
**NPM:** [docx-preview](https://www.npmjs.com/package/docx-preview)
**License:** Apache-2.0
**Stars:** 1.8k

Best pure-JS option for HTML-based rendering.

#### Features
- Renders DOCX to semantic HTML
- Headers, footers, footnotes
- Page breaks, fonts, tables
- Comments (experimental)
- ~240KB total (with JSZip)

#### API
```typescript
import { renderAsync } from 'docx-preview';

await renderAsync(docxBlob, containerElement, null, {
  className: 'docx',
  inWrapper: true,
  breakPages: true,
  useBase64URL: true,  // For webview CSP
});
```

#### Limitations
- HTML-based, not pixel-perfect
- Complex layouts may differ from Word
- No Table of Contents field parsing
- Performance degrades on large docs

---

### 2. Mammoth.js

**Repository:** [github.com/mwilliamson/mammoth.js](https://github.com/mwilliamson/mammoth.js)
**License:** BSD-2-Clause
**Stars:** 6k

Converts DOCX to clean semantic HTML. Loses visual formatting.

#### Best For
- Content extraction
- DOCX → Markdown conversion
- When layout doesn't matter

#### API
```typescript
import mammoth from 'mammoth';

const result = await mammoth.convertToHtml({ arrayBuffer });
console.log(result.value);  // HTML string
```

---

## Comparison

| Criteria | docx-preview | Mammoth.js |
|----------|--------------|------------|
| Fidelity | Good | Low |
| Bundle size | ~240KB | ~300KB |
| Layout preservation | Yes | No |
| Markdown output | No | Yes |
| License | Apache-2.0 | BSD-2-Clause |

---

## Alternative Approaches ("Ebaharilikud")

### 1. DOCX → PDF → PDF.js (High Fidelity)

Convert locally via LibreOffice, then display with PDF.js.

**Requires:** LibreOffice installed on user's machine

```typescript
// Node.js with libreoffice-convert
import libre from 'libreoffice-convert';
import { promisify } from 'util';
const convertAsync = promisify(libre.convert);

const docxBuffer = await fs.readFile('document.docx');
const pdfBuffer = await convertAsync(docxBuffer, '.pdf', undefined);
// Display with PDF.js in webview
```

**CLI alternative:**
```bash
libreoffice --headless --convert-to pdf --outdir /tmp document.docx
```

| Pros | Cons |
|------|------|
| Perfect fidelity | Requires LibreOffice |
| Free, OSS | Slower (spawns process) |
| Works offline | ~500MB LibreOffice install |

**npm:** [libreoffice-convert](https://www.npmjs.com/package/libreoffice-convert)

---

### 2. Pandoc (DOCX → Markdown/HTML)

Universal document converter. Perfect for **import** workflow.

```bash
# DOCX to Markdown
pandoc -f docx -t gfm document.docx -o document.md

# DOCX to HTML
pandoc -s -f docx -t html5 document.docx -o document.html
```

| Pros | Cons |
|------|------|
| Excellent Markdown output | Requires Pandoc install |
| Preserves structure | Loses complex formatting |
| Free, OSS | Not for visual preview |

**Best for:** "Import DOCX as Markdown" feature in Ritemark

---

### 3. macOS Quick Look (Native Preview)

Use system's Quick Look for preview. Works with DOCX out of box.

```bash
# Generate preview image
qlmanage -t -s 1000 -o /tmp document.docx

# Open Quick Look panel
qlmanage -p document.docx
```

**Programmatic (Swift/Obj-C):**
- Use `QLPreviewController` or `QLPreviewPanel`
- Requires native code bridge

| Pros | Cons |
|------|------|
| Perfect fidelity | macOS only |
| No dependencies | Requires native bridge |
| Already installed | Can't embed in webview |

---

### 4. shell.openPath (Delegate to Native App)

Simplest option - just open in Word/LibreOffice/Pages.

```typescript
import { shell } from 'electron';

// Opens in default .docx handler
await shell.openPath('/path/to/document.docx');
```

| Pros | Cons |
|------|------|
| Zero effort | No preview in Ritemark |
| Perfect fidelity | Leaves the app |
| Works everywhere | Bad UX |

---

## Recommendation

### docx-preview for Preview
- Use docx-preview as primary renderer
- Add disclaimer: "Preview may differ from original"
- Offer "Open in Word/LibreOffice" button for complex docs

### Pandoc for Import
- Use Pandoc for "Import DOCX to Markdown" feature (if installed)
- Fallback to Mammoth.js if Pandoc not available

### LibreOffice PDF (Optional Premium)
- Detect if LibreOffice installed
- Offer "High-fidelity preview" option
- Convert to PDF, display with PDF.js

---

## VS Code Extension References

| Extension | Library | Notes |
|-----------|---------|-------|
| [Docx-Viewer](https://github.com/skfrost19/Docx-Viewer) | Mammoth.js | Theme integration, search, zoom |
| [Docx Renderer](https://marketplace.visualstudio.com/items?itemName=AdamRaichu.docx-viewer) | docx-preview | Read-only |
| [Office Viewer](https://marketplace.visualstudio.com/items?itemName=cweijan.vscode-office) | Unknown | Full suite |

---

## Sources

- [docx-preview](https://github.com/VolodymyrBaydalka/docxjs)
- [Mammoth.js](https://github.com/mwilliamson/mammoth.js)
- [libreoffice-convert npm](https://www.npmjs.com/package/libreoffice-convert)
- [Pandoc](https://pandoc.org/)
- [macOS Quick Look](https://developer.apple.com/documentation/quicklook)
- [Electron shell API](https://www.electronjs.org/docs/latest/api/shell)
- [MS Office Web Apps](https://view.officeapps.live.com)
- [MS Graph API](https://learn.microsoft.com/en-us/graph/api/driveitem-preview)
