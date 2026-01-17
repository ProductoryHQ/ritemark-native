# Sprint 21 Implementation Progress

**Date:** 2026-01-17
**Phase:** 3 (DEVELOP)

---

## Completed

### Phase 3.1: Fix CSV Save Bug ✅
**Status:** COMPLETE - Ready for testing

**Files Modified:**
- `extensions/ritemark/src/ritemarkEditor.ts` (lines 237-256)

**Changes:**
- Fixed `contentChanged` handler to process CSV file edits
- Added CSV branch that calls `updateDocument` with raw content
- Markdown flow unchanged (still uses front-matter serialization)

**Before:**
```typescript
case 'contentChanged':
  if (!isUpdating && this.getFileType(document.uri.fsPath) === 'markdown') {
    // Only handled markdown
  }
```

**After:**
```typescript
case 'contentChanged':
  if (!isUpdating) {
    const fileType = this.getFileType(document.uri.fsPath);
    if (fileType === 'markdown') {
      // Markdown with front-matter
    } else if (fileType === 'csv') {
      // CSV direct update (NEW!)
      this.updateDocument(document, message.content as string);
    }
  }
```

**Testing Required:**
1. Open CSV file in RiteMark
2. Edit a cell
3. Save (Cmd+S)
4. Verify dirty indicator clears
5. Close and reopen → verify changes persist

---

### Phase 3.2: Add Refresh Button UI ✅
**Status:** COMPLETE

**Files Modified:**
- `extensions/ritemark/webview/src/components/header/SpreadsheetToolbar.tsx`
- `extensions/ritemark/webview/src/components/SpreadsheetViewer.tsx`

**Changes:**
- Added `onRefresh` prop to SpreadsheetToolbar
- Added Refresh button with RotateCw icon
- Button positioned before external app buttons
- Handles `refreshDisabled` prop (for future use)
- Wired `handleRefresh` callback in SpreadsheetViewer
- Sends 'refresh' message to extension

---

### Phase 3.3: Excel Refresh (Simple) ✅
**Status:** COMPLETE

**Files Modified:**
- `extensions/ritemark/src/excelEditorProvider.ts`

**Changes:**
- Added `handleRefresh` method
- Re-reads file from disk using `fs.readFile`
- Sends fresh Base64 content via 'load' message
- Shows success notification: "Refreshed [filename]"
- SpreadsheetViewer clears `cachedWorkbook` on content change (forces re-parse)

**Flow:**
1. User clicks Refresh button
2. Webview sends 'refresh' message
3. Extension re-reads file from disk
4. Extension sends 'load' message with fresh content
5. Webview clears cache and re-parses
6. User sees updated data

---

### Phase 3.4: CSV Conflict Detection ✅
**Status:** COMPLETE

**Files Modified:**
- `extensions/ritemark/src/ritemarkEditor.ts`

**Changes:**
- Added `fileLoadTimes` Map for tracking file modification times
- Added `updateFileLoadTime()` - stores mtime on file load
- Added `hasFileChangedOnDisk()` - compares current mtime with stored mtime
- Added `handleRefresh()` - decision tree for conflict detection:
  - **Dirty + File Changed:** Show conflict dialog (true conflict)
  - **Dirty + File Unchanged:** Show discard warning
  - **Not Dirty:** Reload immediately
- Added `reloadFile()` - performs actual file reload from disk
- Added message handlers for 'refresh', 'confirmRefresh', 'cancelRefresh'

**Decision Tree:**
```
CSV Refresh Clicked
  ↓
Is document.isDirty?
  ├─ YES → Has file changed on disk?
  │         ├─ YES → showConflictDialog (true conflict)
  │         └─ NO  → confirmDiscard (simple warning)
  └─ NO  → reloadFile() immediately
```

---

### Phase 3.5: Build Conflict UI Components ✅
**Status:** COMPLETE

**Files Created:**
- `extensions/ritemark/webview/src/components/dialogs/ConflictDialog.tsx` (NEW)

**Files Modified:**
- `extensions/ritemark/webview/src/components/SpreadsheetViewer.tsx`

**Changes:**
- Created ConflictDialog component with two variants:
  1. **True Conflict** (`isDiskConflict=true`): Local + disk changes
  2. **Simple Discard** (`isDiskConflict=false`): Local changes only
- Modal overlay with blur effect
- Warning icon (AlertTriangle) with color
- Clear messaging explaining consequences
- Two action buttons:
  - Destructive button (Discard/Refresh) - red styling
  - Secondary button (Keep Editing/Cancel) - safe option
- Keyboard support (Escape to cancel)
- Wired into SpreadsheetViewer:
  - Listen for 'showConflictDialog' and 'confirmDiscard' messages
  - Handle button callbacks (send confirmRefresh/cancelRefresh)
  - Manage dialog visibility state

**UX:**
- **True Conflict Message:**
  ```
  You have unsaved edits in RiteMark.
  The file [filename] has also been modified on disk by another program.
  Refreshing will discard your changes and load the version from disk.
  ```

- **Simple Discard Message:**
  ```
  You have unsaved changes.
  Refreshing will discard them.
  ```

---

### Phase 3.6: Implement File Watcher ✅
**Status:** COMPLETE

**Files Modified:**
- `extensions/ritemark/src/ritemarkEditor.ts`
- `extensions/ritemark/src/excelEditorProvider.ts`

**Files Created:**
- `extensions/ritemark/webview/src/components/notifications/FileChangeNotification.tsx` (NEW)

**Changes:**
- Added `fileWatchers` Map and `fileChangeDebounceTimers` Map to both providers
- Created `createFileWatcher()` method - uses VS Code FileSystemWatcher API
- Created `handleFileChange()` method - debounces changes (500ms)
- Created `disposeFileWatcher()` method - cleanup on webview dispose
- File watcher created on document open (CSV and Excel only, not markdown)
- Listens to `onDidChange` and `onDidDelete` events
- Sends 'fileChanged' message to webview with `isDirty` state
- Created FileChangeNotification component:
  - Banner style (non-intrusive)
  - Two variants based on dirty state
  - Auto-dismiss after 10s (only if not dirty)
  - "Refresh Now" button triggers refresh flow
  - "Dismiss" button hides banner
- Wired into SpreadsheetViewer with state management

**Message Flow:**
1. External app modifies file
2. FileSystemWatcher detects change (debounced 500ms)
3. Extension sends 'fileChanged' message with `isDirty` flag
4. Webview shows notification banner
5. User clicks "Refresh Now" → triggers refresh flow (with conflict detection)
6. User clicks "Dismiss" → hides banner

---

## Remaining Work

---

### Phase 3.7: Edge Cases and Polish (TODO)
**Status:** NOT STARTED

**Tasks:**
- [ ] Handle file deleted on disk
- [ ] Handle permission denied errors
- [ ] Prevent race conditions (save + refresh)
- [ ] Disable refresh during cell edit
- [ ] Multi-sheet Excel state preservation
- [ ] Large file handling during refresh

---

### Phase 3.8: Testing (TODO)
**Status:** NOT STARTED

**Manual Test Scenarios:**
1. CSV Save Fix validation
2. Excel simple refresh
3. CSV conflict detection (all paths)
4. Dialog interactions
5. Edge cases

---

## Technical Notes

### Message Protocol

**Extension → Webview:**
- `load` - Initial load or refresh with fresh content
- `showConflictDialog` - Display conflict dialog (disk + local changes)
- `confirmDiscard` - Display discard warning (local changes only)

**Webview → Extension:**
- `refresh` - User clicked Refresh button
- `confirmRefresh` - User confirmed discard in dialog
- `cancelRefresh` - User cancelled refresh

### File Change Detection

We track `fs.stat(file).mtimeMs` on initial load and compare it when refresh is triggered. This allows us to detect if the file was externally modified.

**Caveat:** mtime resolution varies by filesystem (1s for FAT32, 1ns for ext4). This is acceptable for RiteMark's use case.

### Why ExcelDocument.buffer is readonly

The `buffer` property in ExcelDocument is readonly by design (immutable document pattern). For Excel refresh, we just send new content directly without mutating the document. This is simpler and cleaner than trying to make it mutable.

---

## Next Steps

1. ✅ **Phase 3.1-3.5 Complete** - Core refresh functionality implemented
2. **Test CSV save fix** - Jarmo needs to validate this works
3. **Implement File Watcher** - Phase 3.6 (auto-detection of external changes)
4. **Polish edge cases** - Phase 3.7
5. **Manual testing** - Phase 3.8 (all scenarios from plan)

**Blocker:** Testing required before proceeding to file watcher implementation.
