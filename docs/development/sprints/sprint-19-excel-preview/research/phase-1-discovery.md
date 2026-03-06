# Sprint 19 - Phase 1: Discovery & Research

**Date:** 2026-01-12
**Sprint:** 19 - Excel Preview
**Phase:** 1 (Research)

---

## Research Objectives

1. Understand why `CustomTextEditorProvider` fails for binary files
2. Research `CustomEditorProvider` API and requirements
3. Analyze existing Sprint 17 implementation (CSV support)
4. Identify exact changes needed for Excel support
5. Document risks and mitigations

---

## Key Discovery: CustomTextEditorProvider vs CustomEditorProvider

### The Problem (from Sprint 17)

When we attempted to add Excel support in Sprint 17 alongside CSV, VS Code blocked `.xlsx` files with:

```
File seems to be binary and cannot be opened as text
```

**Root Cause:**
- `CustomTextEditorProvider` is designed for **text files only**
- VS Code's `TextFileService` detects binary files and refuses to open them
- This happens **before** our extension code runs - we cannot bypass it
- Our `resolveCustomTextEditor` method is never called for binary files

### Current Architecture (Sprint 17 Implementation)

```typescript
// src/ritemarkEditor.ts (current)
export class RitemarkEditorProvider implements CustomTextEditorProvider {
  async resolveCustomTextEditor(
    document: vscode.TextDocument,  // ← Only works for text files!
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // ...
  }
}
```

**Registration in package.json:**
```json
"customEditors": [
  {
    "viewType": "ritemark.editor",
    "selector": [
      {"filenamePattern": "*.md"},
      {"filenamePattern": "*.markdown"},
      {"filenamePattern": "*.csv"}  // ← Works (CSV is text)
    ]
  }
]
```

**Why CSV works but Excel doesn't:**
- CSV files are text-based (comma-separated values)
- VS Code's `TextDocument` can read CSV files as text
- Excel files (.xlsx, .xls) are binary (ZIP archives with XML)
- `TextDocument` refuses to open binary files

---

## Solution: CustomEditorProvider for Binary Files

### API Comparison

| Provider | Use Case | Document Type | Editability |
|----------|----------|---------------|-------------|
| `CustomTextEditorProvider` | Text files (md, csv, txt) | `TextDocument` (managed by VS Code) | Read-write |
| `CustomEditorProvider` | Binary files (xlsx, images, pdf) | Custom `CustomDocument` (we manage) | Full control |
| `CustomReadonlyEditorProvider` | Read-only binary files | Custom `CustomDocument` (we manage) | Read-only |

**For Sprint 19, we use `CustomReadonlyEditorProvider` because:**
1. Excel preview is read-only (no editing in scope)
2. Simpler implementation - no save/revert handling required
3. No need to implement `saveCustomDocument`, `revertCustomDocument`, `backupCustomDocument`

### Architecture: Two Separate Providers

We'll have **two providers** with **two viewTypes**:

```
ritemark.editor           → CustomTextEditorProvider (existing)
├── *.md                  → TipTap markdown editor
├── *.markdown            → TipTap markdown editor
└── *.csv                 → SpreadsheetViewer (text mode)

ritemark.excelViewer      → CustomReadonlyEditorProvider (new)
├── *.xlsx                → SpreadsheetViewer (binary mode)
└── *.xls                 → SpreadsheetViewer (binary mode)
```

**Why separate providers:**
- Cannot mix text and binary files in the same `CustomTextEditorProvider`
- Clean separation of concerns
- Different document lifecycle management
- Easier to maintain and debug

---

## Existing Components (from Sprint 17)

The good news: **All webview components are ready!** Sprint 17 built the infrastructure with Excel support in mind.

### Ready-to-Use Components

| Component | Status | Notes |
|-----------|--------|-------|
| `SpreadsheetViewer.tsx` | ✅ Ready | Already handles both CSV and Excel |
| `DataTable.tsx` | ✅ Ready | TanStack Table + Virtual scrolling |
| xlsx library | ✅ Installed | ~400KB, parses Base64 natively |
| App.tsx routing | ✅ Ready | Routes `fileType: 'xlsx'` to SpreadsheetViewer |

**Evidence from SpreadsheetViewer.tsx:**
```typescript
export interface SpreadsheetViewerProps {
  content: string
  filename: string
  fileType: 'csv' | 'xlsx'  // ← Already supports xlsx!
  encoding?: string
  // ...
}

const parseExcel = (content: string, encoding?: string) => {
  // Base64 parsing for Excel
  const wb = XLSX.read(content, { type: encoding || 'base64' })
  // ... works perfectly!
}
```

**Testing note:** The parseExcel function was tested in Sprint 17 and confirmed working. Only the provider infrastructure needs to be added.

---

## Technical Implementation Plan

### Step 1: Create ExcelDocument Class

```typescript
// src/excelDocument.ts (new file)
import * as vscode from 'vscode';

export class ExcelDocument implements vscode.CustomDocument {
  constructor(
    readonly uri: vscode.Uri,
    readonly buffer: Buffer
  ) {}

  dispose(): void {
    // Cleanup if needed (we don't hold external resources)
  }
}
```

**Why this design:**
- Minimal implementation (no edit tracking needed)
- Holds the raw binary buffer
- Implements VS Code's `CustomDocument` interface
- Disposed automatically when editor closes

### Step 2: Create ExcelEditorProvider

```typescript
// src/excelEditorProvider.ts (new file)
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ExcelDocument } from './excelDocument';

export class ExcelEditorProvider implements vscode.CustomReadonlyEditorProvider<ExcelDocument> {

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      'ritemark.excelViewer',
      new ExcelEditorProvider(context),
      { webviewOptions: { retainContextWhenHidden: true } }
    );
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<ExcelDocument> {
    // Read binary file directly from filesystem
    const buffer = fs.readFileSync(uri.fsPath);
    return new ExcelDocument(uri, buffer);
  }

  async resolveCustomEditor(
    document: ExcelDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // Setup webview (same as RitemarkEditorProvider)
    const scriptUri = webviewPanel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview.js')
    );

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'media')
      ]
    };

    webviewPanel.webview.html = this.getHtml(webviewPanel.webview, scriptUri);

    // Handle messages
    webviewPanel.webview.onDidReceiveMessage(
      message => {
        if (message.type === 'ready') {
          // Send Excel file as Base64
          const base64 = document.buffer.toString('base64');
          const filename = path.basename(document.uri.fsPath);
          const ext = path.extname(document.uri.fsPath).toLowerCase();

          webviewPanel.webview.postMessage({
            type: 'load',
            fileType: ext === '.xlsx' ? 'xlsx' : 'xls',
            content: base64,
            encoding: 'base64',
            filename: filename
          });
        }
      },
      undefined,
      this.context.subscriptions
    );
  }

  private getHtml(webview: vscode.Webview, scriptUri: vscode.Uri): string {
    // Same HTML as RitemarkEditorProvider
    // (Could be extracted to shared utility)
    const nonce = this.getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
  <title>Excel Preview</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #root { height: 100%; width: 100%; overflow: hidden; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--vscode-editor-background, #ffffff);
      color: var(--vscode-editor-foreground, #333333);
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
```

**Key differences from RitemarkEditorProvider:**
- Implements `CustomReadonlyEditorProvider<ExcelDocument>` (not `CustomTextEditorProvider`)
- Has `openCustomDocument` method (reads binary file)
- Has `resolveCustomEditor` (not `resolveCustomTextEditor`)
- No document change tracking (read-only)
- Sends Base64-encoded content to webview

### Step 3: Update package.json

```json
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
    "displayName": "Excel Preview",
    "selector": [
      {"filenamePattern": "*.xlsx"},
      {"filenamePattern": "*.xls"}
    ],
    "priority": "default"
  }
]
```

### Step 4: Register Provider in extension.ts

```typescript
// src/extension.ts
import { ExcelEditorProvider } from './excelEditorProvider';

export function activate(context: vscode.ExtensionContext) {
  // ... existing code ...

  // Register markdown/CSV editor
  context.subscriptions.push(
    RitemarkEditorProvider.register(context, aiViewProvider)
  );

  // Register Excel viewer (new)
  context.subscriptions.push(
    ExcelEditorProvider.register(context)
  );
}
```

---

## Files to Create/Modify

### New Files
- `src/excelDocument.ts` (~20 lines)
- `src/excelEditorProvider.ts` (~150 lines)

### Modified Files
- `package.json` - Add new customEditor entry
- `src/extension.ts` - Register ExcelEditorProvider

### No Changes Needed
- `webview/src/components/SpreadsheetViewer.tsx` - Already supports Excel
- `webview/src/components/DataTable.tsx` - Already supports large datasets
- `webview/src/App.tsx` - Already routes xlsx to SpreadsheetViewer
- `package.json` dependencies - xlsx library already installed

---

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Large Excel files (100MB+) cause slowdown | High | Medium | Add file size warning (already in SpreadsheetViewer), limit to 10k rows |
| Multi-sheet workbooks need UI | Medium | High | Start with Sheet 1 only, add sheet selector in future sprint |
| Binary file corruption crashes extension | Medium | Low | Add try-catch in openCustomDocument, show error UI |
| CSV regression (existing functionality breaks) | High | Low | Test CSV files after Excel changes, keep providers separate |
| HTML generation in getHtml duplicated | Low | Low | Extract to shared utility later (polish sprint) |

---

## Testing Strategy

### Unit Testing (Manual)
1. Test with small Excel file (< 1MB, < 100 rows)
2. Test with large Excel file (5MB, 10k+ rows)
3. Test with multi-sheet workbook (verify Sheet 1 loads)
4. Test with corrupted Excel file (should show error, not crash)
5. Test CSV files still work (regression test)
6. Test markdown files still work (regression test)

### Edge Cases
- Empty Excel file (0 rows)
- Excel file with formulas (should show calculated values)
- Excel file with images (may not display - acceptable)
- Excel file from different Office versions (.xls vs .xlsx)

---

## Dependencies

**Already Installed (from Sprint 17):**
- `xlsx@0.18.5` - Parses Excel files, handles Base64 input
- `papaparse@5.5.3` - CSV parsing (not needed for Excel, but already there)
- `@tanstack/react-table@8.21.3` - Table rendering
- `@tanstack/react-virtual@3.13.18` - Virtual scrolling for large datasets

**No new dependencies needed for Sprint 19.**

---

## Success Criteria for Phase 1

- [x] Understand CustomTextEditorProvider limitation
- [x] Research CustomReadonlyEditorProvider API
- [x] Document architectural approach (two providers)
- [x] Identify exact files to create/modify
- [x] Verify existing webview components support Excel
- [x] Document risks and testing strategy
- [x] Confirm no new dependencies needed

---

## Next Phase: Planning

Phase 2 will create the detailed sprint plan with implementation checklist, including:
- Step-by-step implementation tasks
- Test cases
- Rollback plan
- Approval gate

**GATE: Phase 1→2 is automatic (research complete)**
**GATE: Phase 2→3 requires Jarmo's approval before implementation**
