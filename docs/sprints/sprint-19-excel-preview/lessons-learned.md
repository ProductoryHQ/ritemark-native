# Sprint 19: Excel File Preview

## Status
**Planned** - Deferred from Sprint 17

## Goal
Add read-only Excel (.xlsx, .xls) preview to Ritemark Native.

---

## Lessons Learned from Sprint 17

### The Problem: CustomTextEditorProvider Can't Handle Binary Files

**Discovery:** When we tried to add Excel support alongside CSV in Sprint 17, VS Code blocked xlsx files with:
```
File seems to be binary and cannot be opened as text
```

**Root Cause:**
- `CustomTextEditorProvider` is designed for **text files only**
- VS Code's `TextFileService` detects binary files and refuses to open them
- This happens **before** our extension code runs - we can't bypass it

### What We Tried (and Failed)

```typescript
// This approach DOES NOT WORK:
// We tried bypassing TextDocument by reading the file directly
if (ext === '.xlsx') {
  const buffer = fs.readFileSync(document.uri.fsPath);  // Never gets here!
  const base64 = buffer.toString('base64');
  // ...
}
```

The problem: `resolveCustomTextEditor` is never called for binary files because VS Code fails earlier in the pipeline.

### The Solution: CustomEditorProvider

For binary files, we need `CustomEditorProvider` instead of `CustomTextEditorProvider`.

| Provider | Use Case | Document Type |
|----------|----------|---------------|
| `CustomTextEditorProvider` | Text files (md, csv, txt) | `TextDocument` |
| `CustomEditorProvider` | Binary files (xlsx, images, pdf) | Custom `CustomDocument` |

---

## Implementation Approach for Sprint 19

### 1. Create Separate Provider for Excel

```typescript
// src/excelEditorProvider.ts
export class ExcelEditorProvider implements vscode.CustomReadonlyEditorProvider {

  openCustomDocument(uri: vscode.Uri): Promise<ExcelDocument> {
    // Read binary file directly
    const buffer = fs.readFileSync(uri.fsPath);
    return new ExcelDocument(uri, buffer);
  }

  resolveCustomEditor(
    document: ExcelDocument,
    webviewPanel: vscode.WebviewPanel
  ): void {
    // Send Base64 to webview
    const base64 = document.buffer.toString('base64');
    webviewPanel.webview.postMessage({
      type: 'load',
      fileType: 'xlsx',
      content: base64,
      encoding: 'base64'
    });
  }
}

class ExcelDocument implements vscode.CustomDocument {
  constructor(
    readonly uri: vscode.Uri,
    readonly buffer: Buffer
  ) {}

  dispose() {}
}
```

### 2. Register Separate viewType

```json
// package.json
"customEditors": [
  {
    "viewType": "ritemark.editor",
    "selector": [
      {"filenamePattern": "*.md"},
      {"filenamePattern": "*.markdown"},
      {"filenamePattern": "*.csv"}
    ]
  },
  {
    "viewType": "ritemark.excelViewer",
    "selector": [
      {"filenamePattern": "*.xlsx"},
      {"filenamePattern": "*.xls"}
    ],
    "priority": "default"
  }
]
```

### 3. Reuse Existing Webview Components

The good news: `SpreadsheetViewer.tsx` and `DataTable.tsx` from Sprint 17 work perfectly. Only the extension-side provider needs to change.

---

## What's Already Done (from Sprint 17)

These components are ready and working:

| Component | Status | Notes |
|-----------|--------|-------|
| `SpreadsheetViewer.tsx` | ✅ Ready | Handles both CSV and Excel |
| `DataTable.tsx` | ✅ Ready | TanStack Table + Virtual |
| xlsx library | ✅ Installed | ~400KB, parses Base64 natively |
| App.tsx routing | ✅ Ready | Routes `fileType: 'xlsx'` to SpreadsheetViewer |

---

## Checklist for Sprint 19

### Phase 1: Provider Implementation
- [ ] Create `ExcelDocument` class implementing `CustomDocument`
- [ ] Create `ExcelEditorProvider` implementing `CustomReadonlyEditorProvider`
- [ ] Register new viewType in package.json
- [ ] Register provider in extension.ts

### Phase 2: Integration
- [ ] Test with small Excel files
- [ ] Test with large Excel files (10k+ rows)
- [ ] Test with multi-sheet workbooks
- [ ] Verify CSV still works (regression test)

### Phase 3: Polish
- [ ] Add sheet selector for multi-sheet workbooks (optional)
- [ ] Handle corrupted Excel files gracefully
- [ ] Update bundle size documentation

---

## Technical Notes

### Why CustomReadonlyEditorProvider?

We use `CustomReadonlyEditorProvider` (not `CustomEditorProvider`) because:
1. Excel preview is read-only in our scope
2. Simpler implementation - no save/revert handling
3. `CustomEditorProvider` requires implementing `saveCustomDocument`, `revertCustomDocument`, etc.

### Bundle Size

xlsx library is already installed (~400KB). No additional bundle size impact for Sprint 19.

### Testing Binary File Handling

Verified in Sprint 17 that Base64 approach works:
```javascript
const buffer = fs.readFileSync('test.xlsx');
const base64 = buffer.toString('base64');
const wb = XLSX.read(base64, { type: 'base64' });  // ✅ Works!
```

---

## References

- VS Code Custom Editors Guide: https://code.visualstudio.com/api/extension-guides/custom-editors
- CustomReadonlyEditorProvider API: https://code.visualstudio.com/api/references/vscode-api#CustomReadonlyEditorProvider
- SheetJS Base64 docs: https://docs.sheetjs.com/docs/api/parse-options#input-type
