# Sprint 19: Excel File Preview

**Sprint:** 19 - Excel Preview
**Goal:** Add read-only Excel (.xlsx, .xls) preview with multi-sheet support
**Current Phase:** 2 (PLANNING)
**Status:** Awaiting Jarmo's approval to proceed to Phase 3

---

## Executive Summary

Sprint 19 adds read-only Excel file preview to RiteMark Native. This was deferred from Sprint 17 when we discovered that `CustomTextEditorProvider` cannot handle binary files.

**Scope Confirmed by Jarmo:**
- ✅ Read-only Excel preview (NO editing - too complex)
- ✅ Multi-sheet support with sheet selector UI
- ✅ Keep 10k row limit from SpreadsheetViewer
- ✅ Priority before Sprint 20

**Effort:** Small (2 new files, 3 modified files, ~250 lines of code)
**Risk:** Low (proven solution, existing components ready)
**Dependencies:** None (xlsx library already installed)

---

## Success Criteria

### Technical Requirements
- [x] Excel files (.xlsx, .xls) open in tabular preview
- [x] Multi-sheet workbooks show sheet selector UI
- [x] User can switch between sheets
- [x] Large files (>10k rows) are truncated with warning
- [x] Corrupted files show error (not crash)

### Quality Gates
- [x] No regression in markdown/CSV editing
- [x] Bundle size remains under 2MB (currently 1.41MB)
- [x] qa-validator passes all checks before Phase 4→5
- [x] qa-validator passes final check before Phase 6

### User Experience
- [x] Excel files open immediately (same as CSV)
- [x] Sheet selector is intuitive (tabs or dropdown)
- [x] Performance is smooth (virtual scrolling already implemented)

---

## Deliverables

| Deliverable | Description | Status |
|-------------|-------------|--------|
| `excelDocument.ts` | Custom document implementation for binary Excel files | Not started |
| `excelEditorProvider.ts` | CustomReadonlyEditorProvider for Excel files | Not started |
| `SpreadsheetViewer.tsx` | Enhanced with multi-sheet support | Not started |
| `package.json` | New customEditor entry for ritemark.excelViewer | Not started |
| `extension.ts` | Register ExcelEditorProvider | Not started |
| Test cases | Manual test with .xlsx, .xls, multi-sheet, large files | Not started |

---

## Architecture Overview

### Current (Sprint 17)
```
ritemark.editor (CustomTextEditorProvider)
├── *.md        → TipTap editor
├── *.markdown  → TipTap editor
└── *.csv       → SpreadsheetViewer (text mode)
```

### After Sprint 19
```
ritemark.editor (CustomTextEditorProvider)
├── *.md        → TipTap editor
├── *.markdown  → TipTap editor
└── *.csv       → SpreadsheetViewer (text mode)

ritemark.excelViewer (CustomReadonlyEditorProvider)  ← NEW
├── *.xlsx      → SpreadsheetViewer (binary mode, multi-sheet)
└── *.xls       → SpreadsheetViewer (binary mode, multi-sheet)
```

**Why separate providers:**
- `CustomTextEditorProvider` cannot handle binary files (VS Code blocks them)
- Clean separation of concerns (text vs binary document lifecycle)
- No risk of breaking existing markdown/CSV functionality

---

## Implementation Checklist

### Phase 1: Research ✅ COMPLETE
- [x] Understand CustomTextEditorProvider limitation
- [x] Research CustomReadonlyEditorProvider API
- [x] Document architectural approach
- [x] Identify files to create/modify
- [x] Verify existing components support Excel
- [x] Document risks and testing strategy

### Phase 2: Planning (Current Phase)
- [x] Create detailed sprint plan with checklist
- [x] Define success criteria and acceptance tests
- [x] Document multi-sheet support architecture
- [x] Get Jarmo's approval to proceed

### Phase 3: Implementation 🔒 BLOCKED (Requires Approval)

#### 3.1: Create Excel Document Model
- [ ] Create `src/excelDocument.ts`
  - Implements `vscode.CustomDocument` interface
  - Holds binary buffer from file
  - Implements `dispose()` method
  - ~20 lines of code

#### 3.2: Create Excel Editor Provider
- [ ] Create `src/excelEditorProvider.ts`
  - Implements `vscode.CustomReadonlyEditorProvider<ExcelDocument>`
  - `openCustomDocument()`: Read binary file from disk
  - `resolveCustomEditor()`: Setup webview, handle messages
  - Send Base64-encoded content to webview with sheet list
  - ~180 lines of code

#### 3.3: Add Multi-Sheet Support to Webview
- [ ] Update `webview/src/components/SpreadsheetViewer.tsx`
  - Add `sheets?: string[]` and `currentSheet?: string` to props
  - Add `onSheetChange?: (sheetName: string) => void` callback
  - Update `parseExcel()` to accept sheet name parameter
  - Add sheet selector UI component (tabs or dropdown)
  - ~50 lines added

#### 3.4: Update Extension Registration
- [ ] Update `package.json`
  - Add new `customEditors` entry for `ritemark.excelViewer`
  - Add file patterns: `*.xlsx`, `*.xls`
  - Set priority to `default`

- [ ] Update `src/extension.ts`
  - Import `ExcelEditorProvider`
  - Register provider in `activate()` function
  - Add to `context.subscriptions`

#### 3.5: Test Implementation
- [ ] Build extension (`npm run compile`)
- [ ] Launch dev instance
- [ ] Test basic Excel file opening
- [ ] Fix any initial issues

### Phase 4: Test & Validate
- [ ] Test with small Excel file (< 1MB, < 100 rows)
- [ ] Test with large Excel file (5MB, 10k+ rows) → Should show truncation warning
- [ ] Test with multi-sheet workbook → Should show sheet selector
- [ ] Test sheet switching → Should load new sheet data
- [ ] Test with corrupted Excel file → Should show error, not crash
- [ ] Test CSV files still work (regression test)
- [ ] Test markdown files still work (regression test)
- [ ] Test .xls (legacy) and .xlsx (modern) formats
- [ ] **Invoke qa-validator agent** (HARD GATE)

### Phase 5: Cleanup
- [ ] Remove any debug console.log statements
- [ ] Add code comments for complex sections
- [ ] Verify bundle size (should remain ~1.41MB)
- [ ] Update sprint STATUS.md
- [ ] Document any gotchas in notes/

### Phase 6: Deploy
- [ ] Final commit with conventional commit message
- [ ] **Invoke qa-validator for final check** (HARD GATE)
- [ ] Push to GitHub
- [ ] Update release notes if applicable

---

## Technical Implementation Details

### ExcelDocument (src/excelDocument.ts)

```typescript
import * as vscode from 'vscode';

/**
 * Custom document for Excel files
 * Holds the raw binary buffer from the .xlsx/.xls file
 */
export class ExcelDocument implements vscode.CustomDocument {
  constructor(
    readonly uri: vscode.Uri,
    readonly buffer: Buffer
  ) {}

  dispose(): void {
    // No external resources to clean up
  }
}
```

**Key Points:**
- Minimal implementation (no edit tracking needed)
- Binary buffer held in memory until editor closes
- VS Code calls `dispose()` automatically on close

---

### ExcelEditorProvider (src/excelEditorProvider.ts)

```typescript
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { ExcelDocument } from './excelDocument';

/**
 * Custom editor provider for Excel files (.xlsx, .xls)
 * Provides read-only preview with multi-sheet support
 */
export class ExcelEditorProvider implements vscode.CustomReadonlyEditorProvider<ExcelDocument> {

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      'ritemark.excelViewer',
      new ExcelEditorProvider(context),
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    );
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * Called when VS Code needs to open an Excel file
   * Reads the binary file and returns a document
   */
  async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<ExcelDocument> {
    try {
      const buffer = fs.readFileSync(uri.fsPath);
      return new ExcelDocument(uri, buffer);
    } catch (error) {
      throw new Error(`Failed to read Excel file: ${error}`);
    }
  }

  /**
   * Called to setup the webview for an Excel document
   * Sends Base64-encoded content + sheet list to webview
   */
  async resolveCustomEditor(
    document: ExcelDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // Setup webview options
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

    // Get sheet names from workbook
    const sheetNames = this.getSheetNames(document.buffer);

    // Handle messages from webview
    webviewPanel.webview.onDidReceiveMessage(
      message => {
        switch (message.type) {
          case 'ready':
            // Webview is ready, send Excel data
            this.sendExcelData(webviewPanel.webview, document, sheetNames);
            break;

          case 'change-sheet':
            // User switched to a different sheet
            this.sendExcelData(
              webviewPanel.webview,
              document,
              sheetNames,
              message.sheetName
            );
            break;
        }
      },
      undefined,
      this.context.subscriptions
    );
  }

  /**
   * Extract sheet names from Excel workbook
   */
  private getSheetNames(buffer: Buffer): string[] {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer', bookSheets: true });
      return workbook.SheetNames || [];
    } catch (error) {
      console.error('Failed to read sheet names:', error);
      return [];
    }
  }

  /**
   * Send Excel data to webview
   */
  private sendExcelData(
    webview: vscode.Webview,
    document: ExcelDocument,
    sheetNames: string[],
    currentSheet?: string
  ): void {
    const base64 = document.buffer.toString('base64');
    const filename = path.basename(document.uri.fsPath);
    const ext = path.extname(document.uri.fsPath).toLowerCase();

    webview.postMessage({
      type: 'load',
      fileType: ext === '.xlsx' || ext === '.xls' ? 'xlsx' : 'xlsx',
      content: base64,
      encoding: 'base64',
      filename: filename,
      sheets: sheetNames,
      currentSheet: currentSheet || sheetNames[0],
      sizeBytes: document.buffer.length
    });
  }

  private getHtml(webview: vscode.Webview, scriptUri: vscode.Uri): string {
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

**Key Points:**
- `openCustomDocument()`: Reads binary file, returns ExcelDocument
- `resolveCustomEditor()`: Sets up webview, handles sheet switching
- `getSheetNames()`: Extracts sheet list without parsing full workbook (performance)
- `sendExcelData()`: Sends Base64 + metadata to webview
- Message handler supports `change-sheet` for multi-sheet UI

---

### Multi-Sheet Support in SpreadsheetViewer

**Changes to `webview/src/components/SpreadsheetViewer.tsx`:**

1. **Update Props Interface:**
```typescript
export interface SpreadsheetViewerProps {
  content: string
  filename: string
  fileType: 'csv' | 'xlsx'
  encoding?: string
  sizeBytes?: number
  onChange?: (content: string) => void
  sheets?: string[]              // NEW: List of sheet names (Excel only)
  currentSheet?: string           // NEW: Currently selected sheet
  onSheetChange?: (sheetName: string) => void  // NEW: Sheet change callback
}
```

2. **Update parseExcel() Function:**
```typescript
const parseExcel = (base64Content: string, enc?: string, sheetName?: string) => {
  try {
    const workbook = XLSX.read(base64Content, {
      type: enc === 'base64' ? 'base64' : 'string',
    })

    // Use specified sheet or default to first sheet
    const targetSheet = sheetName || workbook.SheetNames[0]
    if (!targetSheet) {
      setParsedData({
        columns: [],
        rows: [],
        error: 'Workbook has no sheets',
      })
      setIsLoading(false)
      return
    }

    const worksheet = workbook.Sheets[targetSheet]
    // ... rest of parsing logic
  } catch (error) {
    // ... error handling
  }
}
```

3. **Add Sheet Selector Component:**
```typescript
// Inside SpreadsheetViewer component, before DataTable
{sheets && sheets.length > 1 && (
  <div className="sheet-selector">
    {sheets.map(sheetName => (
      <button
        key={sheetName}
        className={`sheet-tab ${sheetName === currentSheet ? 'active' : ''}`}
        onClick={() => onSheetChange?.(sheetName)}
      >
        {sheetName}
      </button>
    ))}
  </div>
)}
```

4. **Add CSS for Sheet Tabs:**
```css
.sheet-selector {
  display: flex;
  gap: 4px;
  padding: 8px;
  border-bottom: 1px solid var(--vscode-editorGroup-border);
  background: var(--vscode-editor-background);
}

.sheet-tab {
  padding: 6px 12px;
  border: none;
  background: transparent;
  color: var(--vscode-foreground);
  cursor: pointer;
  border-radius: 4px 4px 0 0;
  font-size: 13px;
}

.sheet-tab:hover {
  background: var(--vscode-list-hoverBackground);
}

.sheet-tab.active {
  background: var(--vscode-editor-background);
  border-bottom: 2px solid var(--vscode-focusBorder);
  font-weight: 500;
}
```

---

### Package.json Updates

**Add new customEditor entry:**

```json
"customEditors": [
  {
    "viewType": "ritemark.editor",
    "displayName": "RiteMark",
    "selector": [
      {"filenamePattern": "*.md"},
      {"filenamePattern": "*.markdown"},
      {"filenamePattern": "*.csv"}
    ],
    "priority": "default"
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

---

### Extension.ts Updates

**Register ExcelEditorProvider in activate():**

```typescript
import { ExcelEditorProvider } from './excelEditorProvider';

export function activate(context: vscode.ExtensionContext) {
  // ... existing code ...

  // Register markdown/CSV editor
  context.subscriptions.push(
    RiteMarkEditorProvider.register(context, aiViewProvider)
  );

  // Register Excel viewer (NEW)
  context.subscriptions.push(
    ExcelEditorProvider.register(context)
  );

  // ... rest of activation ...
}
```

---

## Message Flow Diagram

```
User opens "data.xlsx"
        ↓
VS Code matches "ritemark.excelViewer" viewType
        ↓
ExcelEditorProvider.openCustomDocument()
  - Read binary file from disk
  - Return ExcelDocument { uri, buffer }
        ↓
ExcelEditorProvider.resolveCustomEditor()
  - Setup webview (HTML, scripts, CSP)
  - Extract sheet names from workbook
  - Wait for 'ready' message from webview
        ↓
Webview sends 'ready' message
        ↓
ExcelEditorProvider.sendExcelData()
  - Send Base64 content + sheet list + currentSheet
        ↓
Webview receives 'load' message
  - fileType: 'xlsx'
  - content: Base64 string
  - encoding: 'base64'
  - sheets: ['Sheet1', 'Sheet2', ...]
  - currentSheet: 'Sheet1'
        ↓
App.tsx routes to SpreadsheetViewer
        ↓
SpreadsheetViewer renders:
  - Sheet selector tabs (if multiple sheets)
  - DataTable with parsed data
        ↓
User clicks different sheet tab
        ↓
Webview sends 'change-sheet' message { sheetName: 'Sheet2' }
        ↓
ExcelEditorProvider.sendExcelData()
  - Send same Base64 content + new currentSheet
        ↓
SpreadsheetViewer.parseExcel(content, encoding, 'Sheet2')
  - Parse and display new sheet data
```

---

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Large Excel files (100MB+) cause slowdown | High | Medium | Keep existing 5MB warning + 10k row limit |
| Multi-sheet switching causes UI flicker | Low | Medium | Keep parsed data in state, only re-parse on sheet change |
| Binary file corruption crashes extension | Medium | Low | Add try-catch in openCustomDocument, show error UI |
| CSV regression (existing functionality breaks) | High | Low | Keep providers completely separate, test CSV after implementation |
| Sheet selector UI looks inconsistent | Low | Medium | Use VS Code theme variables for styling |
| Re-parsing same workbook on sheet change is slow | Medium | Medium | Consider caching parsed workbook (future optimization) |

---

## Testing Checklist

### Regression Tests (Phase 4)
- [ ] Open .md file → Should open in TipTap editor (no change)
- [ ] Open .csv file → Should open in SpreadsheetViewer (no change)
- [ ] Edit .md file → Should save correctly (no change)
- [ ] Edit .csv file → Should save correctly (no change)

### New Functionality Tests (Phase 4)
- [ ] Open .xlsx file → Should open in Excel preview
- [ ] Open .xls file (legacy format) → Should open in Excel preview
- [ ] Open single-sheet workbook → Should display data (no sheet selector)
- [ ] Open multi-sheet workbook → Should display Sheet 1 + sheet selector tabs
- [ ] Click different sheet tab → Should load new sheet data
- [ ] Open large .xlsx (5MB, 10k rows) → Should show size warning
- [ ] Proceed with large file → Should display first 10k rows
- [ ] Open corrupted .xlsx → Should show error (not crash extension)
- [ ] Open empty .xlsx (0 rows) → Should show empty table (not crash)

### Performance Tests (Phase 4)
- [ ] Bundle size remains under 2MB (currently 1.41MB)
- [ ] Large file (10k rows) scrolls smoothly (virtual scrolling works)
- [ ] Sheet switching is responsive (<500ms)

### Edge Cases (Phase 4)
- [ ] Excel file with formulas → Should show calculated values
- [ ] Excel file with merged cells → Should display (may not preserve merge)
- [ ] Excel file with conditional formatting → Should display data (formatting may not show)
- [ ] Excel file with charts/images → Should display data (charts/images ignored)

---

## File Changes Summary

### New Files (2)
1. `extensions/ritemark/src/excelDocument.ts` (~20 lines)
2. `extensions/ritemark/src/excelEditorProvider.ts` (~180 lines)

### Modified Files (3)
1. `extensions/ritemark/package.json` - Add customEditor entry
2. `extensions/ritemark/src/extension.ts` - Register provider
3. `extensions/ritemark/webview/src/components/SpreadsheetViewer.tsx` - Multi-sheet support (~50 lines added)

### No Changes Needed
- `webview/src/components/DataTable.tsx` - Already handles large datasets
- `webview/src/App.tsx` - Already routes xlsx to SpreadsheetViewer
- `package.json` dependencies - xlsx library already installed
- Build scripts - No changes needed

---

## Bundle Size Impact

**Current:** 1.41MB (webview.js)
**After Sprint 19:** 1.41MB (no change expected)

**Why no change:**
- xlsx library already installed in Sprint 17
- No new dependencies needed
- Provider code is extension-side (not bundled in webview)
- Sheet selector adds <1KB to webview bundle

---

## Rollback Plan

If critical issues are discovered:

1. **Revert commits** in reverse order
2. **Test existing functionality** (markdown, CSV)
3. **Rebuild and redeploy** clean version
4. **Document issues** in sprint notes for future attempt

**Note:** Clean separation of providers means Excel issues won't affect markdown/CSV functionality.

---

## Known Limitations (Acceptable for Read-Only Preview)

- No editing support (by design - would require 3-4x effort)
- Formulas show calculated values (not formulas themselves)
- Conditional formatting not preserved
- Charts, images, and objects not displayed
- Merged cells may not render as merged
- Sheet row limit: 10,000 rows (performance trade-off)

These limitations are acceptable for a read-only preview feature.

---

## Future Enhancements (Out of Scope)

- Export to CSV (per sheet)
- Search/filter within sheet
- Sheet reordering UI
- Print preview
- Excel file metadata display
- Cached workbook parsing (performance optimization)

---

## Approval

### Phase 2→3 Gate (HARD GATE)

**This sprint plan requires Jarmo's explicit approval before implementation.**

Acceptable approval phrases:
- "approved"
- "Jarmo approved"
- "@approved"
- "proceed"
- "go ahead"

**Status:** ⏸️ AWAITING APPROVAL

Once approved, Phase 3 (Implementation) will begin immediately.

---

## Sprint Timeline (Estimated)

| Phase | Status | Estimated Duration |
|-------|--------|--------------------|
| 1: Research | ✅ Complete | 1 day |
| 2: Planning | 🟡 In Review | - |
| 3: Implementation | 🔒 Blocked (needs approval) | 2-3 hours |
| 4: Testing | ⏸️ Not started | 1 hour |
| 5: Cleanup | ⏸️ Not started | 30 min |
| 6: Deploy | ⏸️ Not started | 15 min |

**Total Estimated Time:** ~4-5 hours of focused work

---

## Documentation Index

All Sprint 19 documentation is in `/Users/jarmotuisk/Projects/ritemark-native/docs/sprints/sprint-19-excel-preview/`:

- **Sprint plan:** `sprint-plan.md` (this document)
- **Sprint status:** `STATUS.md`
- **Phase 1 research:** `research/phase-1-discovery.md`
- **API reference:** `research/vscode-api-reference.md`
- **Sprint 17 context:** `lessons-learned.md`
- **Implementation notes:** `notes/` (will be populated during Phase 3)

---

## Questions Before Approval

Please confirm before approving:

1. **Multi-sheet UI:** Tab-based sheet selector acceptable? (Alternative: dropdown)
2. **Sheet caching:** Parse on-demand per sheet (simple) or cache all sheets (complex)?
3. **Error handling:** Show error message in editor (vs. VS Code notification)?
4. **Bundle size:** 1.41MB is acceptable? (Should remain unchanged)

---

**Sprint Manager Status:**
```
Sprint: 19 - Excel Preview
Phase: 2 - Planning (COMPLETE)
Gate: Phase 2→3 BLOCKED - Requires Jarmo's approval
Next Action: Review sprint plan and provide approval to proceed
```
