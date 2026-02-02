# Sprint 19: Excel Preview - Phase 1 Summary

**Date:** 2026-01-12
**Prepared by:** sprint-manager
**Status:** Phase 1 Research COMPLETE ✅

---

## Executive Summary

Sprint 19 will add read-only Excel file preview (.xlsx, .xls) to Ritemark Native. This was deferred from Sprint 17 when we discovered that `CustomTextEditorProvider` cannot handle binary files.

**Effort:** Small (2 new files, 2 modified files, ~200 lines of code)
**Risk:** Low (proven solution, existing components ready)
**Dependencies:** None (xlsx library already installed)

---

## What We Learned in Phase 1

### The Core Problem

VS Code's `CustomTextEditorProvider` (what we currently use) **refuses to open binary files**:

```
File seems to be binary and cannot be opened as text
```

This happens *before* our extension code runs - we can't work around it.

**Why CSV works but Excel doesn't:**
- CSV = text file (VS Code opens it as `TextDocument`)
- Excel = binary file (ZIP archive with XML inside)
- `TextDocument` won't open binary files

### The Solution

Use `CustomReadonlyEditorProvider` with a separate viewType:

```
Current: ritemark.editor (CustomTextEditorProvider)
├── *.md        → TipTap editor
├── *.markdown  → TipTap editor
└── *.csv       → SpreadsheetViewer

New: ritemark.excelViewer (CustomReadonlyEditorProvider)
├── *.xlsx      → SpreadsheetViewer
└── *.xls       → SpreadsheetViewer
```

**Why separate providers:**
- Cannot mix text and binary files in the same `CustomTextEditorProvider`
- Clean separation of concerns (text vs binary lifecycle)
- No risk of breaking existing markdown/CSV functionality

---

## Good News: Components Already Built

In Sprint 17, we built Excel support into the webview with the CSV feature. These are **already working**:

| Component | Status | Notes |
|-----------|--------|-------|
| `SpreadsheetViewer.tsx` | ✅ Ready | Handles CSV and Excel parsing |
| `DataTable.tsx` | ✅ Ready | TanStack Table with virtual scrolling |
| `App.tsx` routing | ✅ Ready | Routes `fileType: 'xlsx'` to SpreadsheetViewer |
| xlsx library | ✅ Installed | ~400KB, parses Base64 natively |

**Sprint 19 is just the plumbing** - we only need to create the binary file provider to connect VS Code to the existing UI.

---

## Implementation Plan (High-Level)

### What We'll Create

**New Files:**
1. `src/excelDocument.ts` (~20 lines)
   - Implements VS Code's `CustomDocument` interface
   - Holds the binary buffer

2. `src/excelEditorProvider.ts` (~150 lines)
   - Implements `CustomReadonlyEditorProvider`
   - Reads binary file in `openCustomDocument`
   - Sets up webview in `resolveCustomEditor`
   - Sends Base64-encoded content to webview

**Modified Files:**
1. `package.json`
   - Add new `customEditors` entry for `ritemark.excelViewer`

2. `src/extension.ts`
   - Register `ExcelEditorProvider` on activation

**No Changes Needed:**
- Webview components (already support Excel)
- Build scripts
- Dependencies (xlsx already installed)

---

## Architecture Diagram

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
  - Handle 'ready' message from webview
  - Send Base64 content to webview
        ↓
Webview receives 'load' message
  - fileType: 'xlsx'
  - content: Base64 string
  - encoding: 'base64'
        ↓
App.tsx routes to SpreadsheetViewer
        ↓
SpreadsheetViewer.parseExcel()
  - XLSX.read(content, { type: 'base64' })
  - Extract rows and columns
        ↓
DataTable renders with virtualization
```

---

## Real-World Example

VS Code's built-in image preview uses the exact same pattern:

```typescript
// From vscode/extensions/media-preview/src/imagePreview/index.ts
export class PreviewManager implements vscode.CustomReadonlyEditorProvider {

  async openCustomDocument(uri: vscode.Uri) {
    return { uri, dispose: () => { } };
  }

  async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    // Setup webview, send image data
  }
}
```

We'll follow this proven VS Code pattern.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large files (>5MB) cause slowdown | Medium | SpreadsheetViewer already has size warning and 10k row limit |
| Multi-sheet workbooks need UI | Low | Start with Sheet 1, add selector in future sprint |
| CSV regression after changes | High | Keep providers completely separate, test CSV after implementation |
| Corrupted Excel files crash extension | Low | Add try-catch in openCustomDocument, show error UI |

---

## Testing Strategy

**Regression Tests:**
- [ ] Open .md file → Should open in TipTap editor (no change)
- [ ] Open .csv file → Should open in SpreadsheetViewer (no change)

**New Functionality:**
- [ ] Open .xlsx file → Should open in Excel preview
- [ ] Open .xls file → Should open in Excel preview
- [ ] Open large .xlsx (5MB, 10k rows) → Should show size warning
- [ ] Open multi-sheet workbook → Should display Sheet 1
- [ ] Open corrupted .xlsx → Should show error (not crash)

**Performance:**
- [ ] Bundle size remains under 2MB (currently 1.41MB, no new deps)
- [ ] Large file (10k rows) scrolls smoothly (virtual scrolling)

---

## Bundle Size Impact

**Current:** 1.41MB (webview.js)
**After Sprint 19:** 1.41MB (no change)

**Why no change:**
- xlsx library already installed in Sprint 17
- No new dependencies needed
- Provider code is extension-side (not bundled in webview)

---

## Documentation Created

Phase 1 produced comprehensive documentation:

1. **`research/phase-1-discovery.md`** - Deep dive into the problem and solution
2. **`research/vscode-api-reference.md`** - VS Code API patterns and examples
3. **`lessons-learned.md`** - Sprint 17 learnings (why Excel was deferred)
4. **`STATUS.md`** - Current sprint status and gates
5. **This document** - Phase 1 summary for approval

All documents are in `/docs/sprints/sprint-19-excel-preview/`.

---

## Next Steps

### ✅ Phase 1: Research - COMPLETE

- [x] Understand CustomTextEditorProvider limitation
- [x] Research CustomReadonlyEditorProvider API
- [x] Document architectural approach
- [x] Identify files to create/modify
- [x] Verify existing components support Excel
- [x] Document risks and testing strategy

### ⏸️ Phase 2: Planning - READY TO START

Will create detailed implementation plan with:
- Step-by-step checklist (Phase 3 tasks)
- File-by-file implementation guide
- Test scenarios and acceptance criteria
- Rollback plan

**GATE: Phase 2→3 requires your approval**

Once you approve the sprint plan, we'll proceed to Phase 3 (Implementation).

---

## Recommendation

**This is a low-risk, high-value sprint:**

✅ Small scope (2 new files, 2 edits)
✅ Proven solution (VS Code's own pattern)
✅ No new dependencies
✅ UI already built and tested
✅ Clean architecture (no hacks)

**Proceed to Phase 2:** Create the detailed sprint plan.

---

## Questions for Review

Before proceeding to Phase 2, please confirm:

1. **Scope:** Read-only Excel preview only (no editing)?
2. **Multi-sheet:** Start with Sheet 1, add selector later?
3. **File size limit:** Keep 10k row limit from SpreadsheetViewer?
4. **Priority:** Should this sprint happen before Sprint 20 (Lightweight Updates)?

---

## File Locations

All Sprint 19 documentation is in:
```
/Users/jarmotuisk/Projects/ritemark-native/docs/sprints/sprint-19-excel-preview/
├── STATUS.md                        # Sprint status tracker
├── PHASE-1-SUMMARY.md               # This document
├── lessons-learned.md               # Sprint 17 context
├── research/
│   ├── phase-1-discovery.md         # Deep technical analysis
│   └── vscode-api-reference.md      # API patterns and examples
└── notes/
    └── .gitkeep                     # For Phase 3 notes
```

---

**Sprint Manager Status:**
```
Sprint: 19 - Excel Preview
Phase: 1 - Research (COMPLETE ✅)
Gate: Phase 1→2 is AUTO (research documented)
Next Gate: Phase 2→3 requires Jarmo's approval
Status: Awaiting review to proceed to Phase 2 (Planning)
```
