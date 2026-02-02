# Research: Conflict Detection Strategy

**Date:** 2026-01-17
**Sprint:** 21 - Refresh Button

---

## Conflict Scenarios

### Scenario 1: Excel Files (Read-Only)
**Conflict Potential:** NONE

- Excel files are opened with `CustomReadonlyEditorProvider`
- No editing capability in Ritemark
- Refresh is always safe (just reload from disk)
- Must preserve `selectedSheet` state across refresh

**Implementation:** Simple reload, no conflict check

---

### Scenario 2: CSV Files (Editable) - No External Changes
**Conflict Potential:** NONE

User flow:
1. Open `data.csv` in Ritemark
2. Edit cell value in Ritemark
3. Click Refresh button

**Expected behavior:** No conflict (file unchanged on disk)
- Check: File modification time hasn't changed
- Action: Reload file (discards local unsaved changes)
- Alternative: Show warning "Unsaved changes will be lost"

**Implementation:** Check `document.isDirty`, show confirmation if dirty

---

### Scenario 3: CSV Files - External Changes Only
**Conflict Potential:** LOW (no data loss risk)

User flow:
1. Open `data.csv` in Ritemark (read-only viewing)
2. Edit file in external app (Excel, Numbers, etc.)
3. Click Refresh button in Ritemark

**Expected behavior:** Safe reload
- Check: `document.isDirty` is false (no local edits)
- Action: Reload file immediately
- Result: User sees updated content from disk

**Implementation:** Simple reload if not dirty

---

### Scenario 4: CSV Files - Both Local AND External Changes (TRUE CONFLICT)
**Conflict Potential:** CRITICAL

User flow:
1. Open `data.csv` in Ritemark
2. Edit cell A1 in Ritemark (value: "Ritemark Edit")
3. External app edits cell B1 (value: "Excel Edit")
4. Click Refresh button in Ritemark

**Problem:** Both versions have changes:
- Ritemark version: A1 changed (unsaved)
- Disk version: B1 changed
- Cannot merge automatically (no merge algorithm for CSV)

**Expected behavior:** Show conflict dialog
- Detect: `document.isDirty` AND file `mtime` changed since load
- Show dialog: "Unsaved changes detected. File also changed on disk."
- Options:
  - "Discard My Changes" → Reload from disk (lose A1 edit)
  - "Keep My Changes" → Cancel refresh (lose B1 edit from disk)

**Implementation:** Conflict detection + modal dialog

---

## Detection Mechanisms

### Method 1: VS Code's `document.isDirty`
**Pros:**
- Built-in, reliable
- Matches VS Code's dirty indicator (dot in tab)
- Works with undo/redo

**Cons:**
- Only tracks local changes, not disk changes
- Need additional mechanism to detect disk changes

**Code:**
```typescript
const isDirty = document.isDirty; // true if unsaved changes exist
```

### Method 2: File Modification Time (mtime)
**Pros:**
- Reliable detection of disk changes
- Works across all file systems
- No active watching required

**Cons:**
- Need to store `lastLoadedMtime` somewhere
- Filesystem resolution varies (1s on some systems)
- Race condition if external save happens during same second

**Code:**
```typescript
import * as fs from 'fs/promises';

// On load:
const stats = await fs.stat(document.uri.fsPath);
const loadedMtime = stats.mtime.getTime();

// On refresh:
const currentStats = await fs.stat(document.uri.fsPath);
const currentMtime = currentStats.mtime.getTime();
const fileChanged = currentMtime > loadedMtime;
```

### Method 3: VS Code's FileSystemWatcher
**Pros:**
- Real-time detection of changes
- Can show proactive notifications
- Better UX (user doesn't need to click Refresh)

**Cons:**
- Adds complexity
- Performance impact if many files watched
- Notification spam if external app auto-saves frequently

**Code:**
```typescript
const watcher = vscode.workspace.createFileSystemWatcher(
  new vscode.RelativePattern(document.uri, '*')
);

watcher.onDidChange(uri => {
  if (uri.toString() === document.uri.toString()) {
    // File changed on disk
    this.notifyFileChanged(webview);
  }
});
```

---

## Recommended Approach

### Phase 1: Manual Refresh with Conflict Detection
**Complexity:** Medium
**Risk:** Low
**UX:** Good

1. **Refresh button clicked:**
   - Check `document.isDirty` (unsaved local changes?)
   - Check file `mtime` vs stored `lastLoadedMtime` (disk changed?)

2. **Decision tree:**
   ```
   IF dirty AND file changed:
     → Show conflict dialog (destructive choice required)

   IF dirty AND file unchanged:
     → Show warning: "Unsaved changes will be lost. Continue?"

   IF not dirty AND file changed:
     → Reload immediately (safe, no data loss)

   IF not dirty AND file unchanged:
     → Reload immediately (no-op, but harmless)
   ```

3. **Store `lastLoadedMtime`:**
   - On initial load: Save mtime
   - After refresh: Update mtime
   - Store in: Instance variable in provider class

### Phase 2 (Optional): File Watcher with Notifications
**Complexity:** High
**Risk:** Medium (notification fatigue)
**UX:** Best (proactive)

1. **Create watcher on file open**
2. **On file change event:**
   - Check if document is dirty
   - If dirty: Show persistent notification banner
   - If not dirty: Show temporary "Refresh available" banner
3. **Banner actions:**
   - "Refresh Now" → Trigger refresh flow
   - "Dismiss" → Hide banner until next change

---

## Conflict Dialog Design

### Layout
```
┌─────────────────────────────────────────────────────┐
│  ⚠️  Unsaved Changes Conflict                        │
├─────────────────────────────────────────────────────┤
│                                                      │
│  You have unsaved edits in Ritemark.                │
│  The file "data.csv" has also been modified on      │
│  disk by another program.                           │
│                                                      │
│  What would you like to do?                         │
│                                                      │
│  ⚠️  Either action will lose some changes!          │
│                                                      │
│  ┌──────────────────────┐  ┌────────────────────┐  │
│  │ Discard My Changes   │  │  Keep Editing      │  │
│  │ (Load from disk)     │  │  (Cancel refresh)  │  │
│  └──────────────────────┘  └────────────────────┘  │
│         Destructive              Safe              │
└─────────────────────────────────────────────────────┘
```

### Button Semantics
- **"Discard My Changes"**
  - Action: Reload file from disk
  - Result: Lose local edits, gain disk changes
  - Style: Destructive (red)
  - Keyboard: Enter key (after confirmation focus)

- **"Keep Editing"**
  - Action: Cancel refresh
  - Result: Keep local edits, don't see disk changes
  - Style: Secondary (neutral)
  - Keyboard: Escape key

### Optional Enhancement: Show Diff
If we want to show what changed:
```
┌─────────────────────────────────────────────────────┐
│  ⚠️  Unsaved Changes Conflict                        │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Your changes:                                      │
│    • Cell A1: "old" → "new"                         │
│    • Cell B3: "data" → "updated"                    │
│                                                      │
│  Changes on disk:                                   │
│    • Cell C2: Added "external edit"                 │
│    • Row 5: Deleted                                 │
│                                                      │
│  ... (buttons same as above)                        │
└─────────────────────────────────────────────────────┘
```

**Cost:** Requires CSV diff algorithm (compare old vs new, local vs disk)
**Benefit:** User can make informed decision
**Recommendation:** Defer to future sprint (v2)

---

## Implementation Checklist

### 1. Add mtime Tracking to Providers

**ExcelEditorProvider:**
```typescript
private fileLoadTimes = new Map<string, number>();

async openCustomDocument(uri: vscode.Uri, ...): Promise<ExcelDocument> {
  const stats = await fs.stat(uri.fsPath);
  this.fileLoadTimes.set(uri.toString(), stats.mtime.getTime());
  // ... rest of implementation
}
```

**RitemarkEditorProvider:**
```typescript
private fileLoadTimes = new Map<string, number>();

async resolveCustomTextEditor(document: vscode.TextDocument, ...): Promise<void> {
  const stats = await fs.stat(document.uri.fsPath);
  this.fileLoadTimes.set(document.uri.toString(), stats.mtime.getTime());
  // ... rest of implementation
}
```

### 2. Implement Refresh Handler

**Message from webview:**
```typescript
sendToExtension('refresh', {})
```

**Handler in provider:**
```typescript
case 'refresh':
  await this.handleRefresh(document, webview);
  break;
```

**Refresh logic (CSV):**
```typescript
private async handleRefresh(
  document: vscode.TextDocument,
  webview: vscode.Webview
): Promise<void> {
  const isDirty = document.isDirty;

  // Check if file changed on disk
  const currentStats = await fs.stat(document.uri.fsPath);
  const currentMtime = currentStats.mtime.getTime();
  const lastMtime = this.fileLoadTimes.get(document.uri.toString());
  const fileChanged = lastMtime && currentMtime > lastMtime;

  if (isDirty && fileChanged) {
    // TRUE CONFLICT: Ask user what to do
    webview.postMessage({
      type: 'showConflictDialog',
      filename: path.basename(document.uri.fsPath)
    });
    return;
  }

  if (isDirty && !fileChanged) {
    // LOCAL CHANGES ONLY: Warn before discarding
    webview.postMessage({
      type: 'confirmDiscard',
      filename: path.basename(document.uri.fsPath)
    });
    return;
  }

  // Safe to reload (not dirty, or file changed but not dirty)
  this.reloadFile(document, webview);
}

private async reloadFile(
  document: vscode.TextDocument,
  webview: vscode.Webview
): Promise<void> {
  // Update mtime
  const stats = await fs.stat(document.uri.fsPath);
  this.fileLoadTimes.set(document.uri.toString(), stats.mtime.getTime());

  // Send fresh content to webview
  webview.postMessage(this.buildLoadMessage(document, webview));

  // Show success notification
  vscode.window.showInformationMessage(
    `Refreshed ${path.basename(document.uri.fsPath)}`
  );
}
```

### 3. Handle Conflict Resolution from Webview

**User clicks "Discard My Changes":**
```typescript
// Webview sends:
sendToExtension('confirmRefresh', {})

// Extension handler:
case 'confirmRefresh':
  await this.reloadFile(document, webview);
  break;
```

**User clicks "Keep Editing":**
```typescript
// Webview sends:
sendToExtension('cancelRefresh', {})

// Extension handler:
case 'cancelRefresh':
  // Just close the dialog, do nothing
  break;
```

---

## Edge Cases

### Edge Case 1: Refresh During Cell Edit
**Problem:** User is typing in a cell, clicks Refresh

**Solution:** Disable Refresh button while cell is being edited
- Track `isEditingCell` state in SpreadsheetViewer
- Pass to toolbar: `<SpreadsheetToolbar disabled={isEditingCell} />`

### Edge Case 2: File Deleted on Disk
**Problem:** External app deletes the file, user clicks Refresh

**Solution:** Catch error in `fs.stat()`, show error message
```typescript
try {
  const stats = await fs.stat(document.uri.fsPath);
} catch (error) {
  webview.postMessage({
    type: 'error',
    message: 'File no longer exists on disk'
  });
  return;
}
```

### Edge Case 3: Permission Denied
**Problem:** File becomes read-only, can't reload

**Solution:** Handle EACCES error
```typescript
catch (error) {
  if (error.code === 'EACCES') {
    vscode.window.showErrorMessage('Permission denied to read file');
  }
}
```

### Edge Case 4: Race Condition (Save + Refresh)
**Problem:** User hits Cmd+S and Refresh simultaneously

**Solution:** Use lock flag
```typescript
private isRefreshing = new Set<string>();

async handleRefresh(document, webview) {
  const key = document.uri.toString();
  if (this.isRefreshing.has(key)) {
    return; // Already refreshing
  }

  this.isRefreshing.add(key);
  try {
    // ... refresh logic
  } finally {
    this.isRefreshing.delete(key);
  }
}
```

---

## Testing Strategy

### Manual Test Cases

1. **Excel - Simple Refresh**
   - Open Excel file
   - Edit in external app
   - Click Refresh → Should reload

2. **CSV - No Changes**
   - Open CSV file
   - Click Refresh → Should reload (no-op)

3. **CSV - Local Changes Only**
   - Open CSV file
   - Edit cell
   - Click Refresh → Warn "Unsaved changes", then reload

4. **CSV - External Changes Only**
   - Open CSV file
   - Edit in external app
   - Click Refresh → Should reload immediately

5. **CSV - Conflict (Both Changed)**
   - Open CSV file
   - Edit cell A1 in Ritemark
   - Edit cell B1 in external app
   - Click Refresh → Show conflict dialog
   - Click "Discard" → Reload from disk
   - Verify: See B1 change, lost A1 change

6. **CSV - Conflict Resolution (Keep)**
   - Same setup as #5
   - Click "Keep Editing" → Stay in dirty state
   - Click Save → Persist local changes
   - Click Refresh → Now see B1 change is lost

7. **Edge - File Deleted**
   - Open CSV file
   - Delete file externally
   - Click Refresh → Show error

8. **Edge - Multi-Sheet Excel**
   - Open multi-sheet Excel
   - Switch to Sheet2
   - Edit in external app
   - Click Refresh → Should stay on Sheet2

---

## Recommendations

1. **Start with Phase 1** (manual refresh + conflict detection)
   - Simpler to implement
   - Lower risk
   - Covers 90% of use cases

2. **Defer Phase 2** (file watcher) to Sprint 22
   - More complex
   - Needs careful UX design to avoid notification fatigue
   - Can be added incrementally

3. **Fix CSV Save Bug First** (if confirmed)
   - If CSV edits don't persist, that's a blocker
   - Must fix before implementing conflict detection

4. **Use VS Code's Dirty Tracking**
   - Don't reinvent the wheel
   - `document.isDirty` is reliable and matches user expectations

---

## Open Questions for Jarmo

1. **CSV Save Status:** Do CSV edits currently persist? (Test needed)

2. **Conflict UX Preference:**
   - Simple dialog (Phase 1)?
   - Or notification banner (Phase 2)?

3. **File Watcher:** Include in Sprint 21 or defer?
   - Include → Longer sprint, better UX
   - Defer → Faster delivery, iterate later

4. **Default Behavior for Dirty Files:**
   - Always show warning?
   - Or only show warning if file also changed on disk?
