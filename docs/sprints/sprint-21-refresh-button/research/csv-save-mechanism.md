# Research: CSV Save Mechanism

**Date:** 2026-01-17
**Sprint:** 21 - Refresh Button

---

## CSV Save Flow (COMPLETE TRACE)

### 1. User Edits Cell
```
User clicks cell in DataTable
  ↓
DataTable.onCellChange(rowIndex, columnId, value)
  ↓
SpreadsheetViewer.handleCellChange(rowIndex, columnId, value)
```

**Code:** `SpreadsheetViewer.tsx` lines 179-200
```typescript
const handleCellChange = useCallback((rowIndex: number, columnId: string, value: string) => {
  if (!parsedData || !onChange) return

  // Update the row data (local state)
  const newRows = [...parsedData.rows]
  newRows[rowIndex] = {
    ...newRows[rowIndex],
    [columnId]: value,
  }

  // Update local state
  setParsedData({
    ...parsedData,
    rows: newRows,
  })

  // Serialize back to CSV and notify parent
  const csvString = Papa.unparse(newRows, {
    columns: parsedData.columns,
  })
  onChange(csvString)  // ← This is the key!
}, [parsedData, onChange])
```

### 2. onChange Callback Invoked
The `onChange` prop comes from `App.tsx` line 226:
```typescript
onChange={fileType === 'csv' ? handleCSVChange : undefined}
```

### 3. App.tsx handleCSVChange
**Code:** `App.tsx` lines 171-174
```typescript
const handleCSVChange = useCallback((newContent: string) => {
  setContent(newContent)
  sendToExtension('contentChanged', { content: newContent })
}, [])
```

### 4. Extension Receives Message
**Code:** `ritemarkEditor.ts` lines 236-244
```typescript
case 'contentChanged':
  // Content changed in editor, update document with front-matter (markdown only)
  if (!isUpdating && this.getFileType(document.uri.fsPath) === 'markdown') {
    const fullContent = this.serializeFrontMatter(
      message.properties as DocumentProperties | undefined,
      message.content as string
    );
    this.updateDocument(document, fullContent);
  }
  return;
```

**WAIT!** This only handles markdown! CSV is filtered out by the `=== 'markdown'` check!

### 5. CRITICAL DISCOVERY: CSV Doesn't Save!

Looking more carefully... CSV files might be using a DIFFERENT message type.

Let me check if there's a CSV-specific handler...

**SEARCHING...**

No `contentChanged` handler for CSV exists!

**HYPOTHESIS:** CSV might be saving through a different mechanism, OR there's a bug where CSV edits don't persist!

---

## Testing Required

**ACTION FOR JARMO:** Please test in current version:
1. Open a CSV file in RiteMark
2. Edit a cell value
3. Close the file (without using Cmd+S)
4. Reopen the file

**Question:** Are the changes saved?

If YES → Find the save mechanism (might be auto-save)
If NO → CSV editing is broken (separate bug)

---

## Alternative Hypothesis: VS Code Auto-Save

VS Code has auto-save settings:
- `files.autoSave`: "off" | "afterDelay" | "onFocusChange" | "onWindowChange"
- Default: "off"

If auto-save is enabled, changes might be saved automatically even without explicit handler.

BUT: `handleCSVChange` calls `sendToExtension('contentChanged', ...)` which is IGNORED by the extension for CSV files!

**CONCLUSION:** CSV editing is either:
1. Not working (bug)
2. Working through a mechanism I haven't found yet
3. Relying on auto-save (unlikely, since contentChanged is ignored)

---

## Impact on Sprint 21

### If CSV Saves Work:
- Need to understand the save mechanism to detect conflicts
- Dirty state detection is critical
- Must prevent data loss on refresh

### If CSV Saves Don't Work:
- Sprint 21 must FIX CSV saving first
- Then implement refresh with conflict detection
- This changes sprint scope significantly

---

## Recommendation

**Before proceeding to Phase 2:**
1. Jarmo tests CSV editing in current build
2. If broken → Sprint 21 scope expands to fix CSV saves first
3. If working → Find the save mechanism (hidden handler? auto-save?)

**Alternative:** Create a mini-sprint to fix CSV saving BEFORE Sprint 21

---

## Next Steps

1. Wait for Jarmo's test results
2. If CSV saves work → investigate VS Code's TextDocument API for dirty tracking
3. Update sprint plan with actual save mechanism
4. Proceed to Phase 2 (Planning) with complete understanding
