# Sprint 21: Refresh Button for Excel/CSV Editors

**Sprint:** 21 - Refresh Button
**Goal:** Add Refresh button with conflict detection, file watcher, and fix CSV save bug
**Current Phase:** 3 (DEVELOP)
**Status:** In progress - Core features implemented

---

## Executive Summary

Sprint 21 adds a Refresh button to the SpreadsheetViewer toolbar that allows users to reload Excel and CSV files from disk. The sprint has MAXIMUM SCOPE based on Jarmo's decisions:

1. **Fix CSV save bug** - CRITICAL: CSV edits are NOT currently saved (prerequisite)
2. **Add Refresh button** - Manual reload capability
3. **Conflict detection** - Warn when unsaved changes will be lost
4. **File watcher** - Automatic detection of external file changes
5. **Conflict dialog** - Simple but nicely designed UI for conflict resolution

**Effort:** 8-12 hours (Medium-large sprint)
**Risk:** Medium (CSV save fix + conflict detection)
**Dependencies:** None (VS Code FileSystemWatcher API available)

---

## Jarmo's Decisions (2026-01-17)

### Q1: CSV Save Test Results
**ANSWER:** CSV edits are **NOT saved** - This is a bug that must be fixed first!

**Root Cause:** `ritemarkEditor.ts` line 237 filters out CSV files from `contentChanged` handler:
```typescript
case 'contentChanged':
  if (this.getFileType(document.uri.fsPath) === 'markdown') {
    // Only handles markdown!
```

CSV changes are sent from webview but ignored by extension.

### Q2: Conflict Dialog Style
**ANSWER:** Option A - Simple warning (no diff preview)

### Q3: File Change Detection
**ANSWER:** Option 2 - Include file watcher (MAXIMUM SCOPE)

### Q4: Unsaved Changes Warning
**ANSWER:** Option A - Always warn before discarding

### Q5: Sprint 21 Scope
**ANSWER:** MAXIMUM - Include all features (CSV fix + Refresh + File watcher)

---

## Success Criteria

### Technical Requirements
- [ ] **CSV Save Fix:** CSV edits persist to disk when user edits cells
- [ ] **Refresh Button:** Appears in SpreadsheetToolbar for both Excel and CSV
- [ ] **Excel Refresh:** Reload from disk (read-only, no conflicts)
- [ ] **CSV Conflict Detection:** Detect dirty state + disk changes
- [ ] **Conflict Dialog:** Simple, clear UI with "Discard" and "Keep Editing" options
- [ ] **Unsaved Changes Warning:** Warn before discarding even if file unchanged on disk
- [ ] **File Watcher:** Auto-detect external file changes
- [ ] **Notification Banner:** Show "File changed on disk" with Refresh action
- [ ] **Multi-Sheet Excel:** Preserve selected sheet across refresh

### Quality Gates
- [ ] All CSV edits are saved correctly
- [ ] No data loss in any scenario
- [ ] qa-validator passes all checks before Phase 4→5
- [ ] qa-validator passes final check before Phase 6

### User Experience
- [ ] Refresh button has clear icon (RotateCw) and tooltip
- [ ] Conflict dialog is simple but nicely designed
- [ ] Warning dialogs explain what will happen clearly
- [ ] Fast reload (<500ms for typical files)
- [ ] No UI flicker during reload
- [ ] File change notifications are non-intrusive

---

## Deliverables

| Deliverable | Description | Priority |
|-------------|-------------|----------|
| `ritemarkEditor.ts` | **FIX:** Handle CSV contentChanged messages | CRITICAL |
| `SpreadsheetToolbar.tsx` | Add Refresh button | HIGH |
| `SpreadsheetViewer.tsx` | Handle refresh logic + conflict detection | HIGH |
| `ConflictDialog.tsx` | NEW: Simple conflict resolution UI | HIGH |
| `FileChangeNotification.tsx` | NEW: Banner for file watcher alerts | HIGH |
| `excelEditorProvider.ts` | Implement file reload + file watcher | HIGH |
| `ritemarkEditor.ts` | Implement file reload + conflict detection + file watcher | HIGH |
| Test cases | Manual test with all conflict scenarios | HIGH |

---

## Implementation Checklist

### Phase 3.1: Fix CSV Save Bug (CRITICAL - Do First!)

#### Step 1: Fix contentChanged Handler ✅ COMPLETED
- [x] Modify `ritemarkEditor.ts` line 237 to handle CSV files
- [x] Update condition from `=== 'markdown'` to include CSV
- [x] Implement CSV-specific updateDocument logic
- [ ] Test: Edit CSV cell, verify it saves to disk

**Fix Applied:**
- Modified `contentChanged` handler to check file type
- Added CSV branch that calls `updateDocument` with raw content (no front-matter)
- Markdown branch unchanged (still uses `serializeFrontMatter`)

#### Step 2: Test CSV Dirty State (NEEDS TESTING)
- [ ] Verify `document.isDirty` correctly reflects CSV edits
- [ ] Test: Edit cell, check VS Code dirty indicator (dot in tab)
- [ ] Test: Edit + Save (Cmd+S), verify dirty state clears

**Gate:** CSV saving must work before proceeding to refresh implementation.

---

### Phase 3.2: Add Refresh Button UI

#### Step 3: Update SpreadsheetToolbar Component
- [ ] Add Refresh button to toolbar (leftmost position)
- [ ] Icon: `RotateCw` from lucide-react
- [ ] Tooltip: "Refresh from disk"
- [ ] Callback prop: `onRefresh: () => void`
- [ ] Styling: Consistent with existing toolbar buttons

#### Step 4: Wire Refresh in SpreadsheetViewer
- [ ] Add `handleRefresh` callback in SpreadsheetViewer
- [ ] Send 'refresh' message to extension
- [ ] Pass `onRefresh={handleRefresh}` to toolbar

---

### Phase 3.3: Implement Excel Refresh (Simple)

#### Step 5: Add Refresh Handler to ExcelEditorProvider
- [ ] Add message handler for 'refresh' in `excelEditorProvider.ts`
- [ ] Re-read file from disk using existing load logic
- [ ] Re-send Base64 content to webview with 'load' message
- [ ] Preserve `selectedSheet` state (pass back to webview)
- [ ] Show success notification: "Refreshed [filename]"

#### Step 6: Handle Refresh in Webview
- [ ] Clear cachedWorkbook on refresh (force re-parse)
- [ ] Maintain selectedSheet state during reload
- [ ] Test: Open Excel, edit externally, refresh, verify changes appear

---

### Phase 3.4: Implement CSV Conflict Detection

#### Step 7: Add File Metadata Tracking
- [ ] Add `fileLoadTimes: Map<string, number>` to RiteMarkEditorProvider
- [ ] On file load: Store `fs.stat(uri).mtime.getTime()`
- [ ] On refresh: Compare current mtime with stored mtime

#### Step 8: Implement Refresh Logic with Conflict Detection
- [ ] Check `document.isDirty` (unsaved local changes?)
- [ ] Check `currentMtime > lastMtime` (file changed on disk?)
- [ ] Decision tree:
  - **Dirty + File Changed:** Send 'showConflictDialog' to webview
  - **Dirty + File Unchanged:** Send 'confirmDiscard' to webview
  - **Not Dirty:** Reload immediately
- [ ] Implement `reloadFile()` method: Update mtime, send fresh content

#### Step 9: Handle Conflict Resolution Messages
- [ ] Add handler for 'confirmRefresh' (user chose "Discard")
- [ ] Add handler for 'cancelRefresh' (user chose "Keep Editing")
- [ ] Test all paths: dirty+changed, dirty+unchanged, not dirty

---

### Phase 3.5: Build Conflict UI Components

#### Step 10: Create ConflictDialog Component
- [ ] Modal overlay with blur background
- [ ] Warning icon (AlertTriangle) with appropriate color
- [ ] Clear text: "You have unsaved edits. File changed on disk."
- [ ] Two buttons:
  - "Discard My Changes" (destructive styling)
  - "Keep Editing" (secondary styling)
- [ ] Handle keyboard: Escape = cancel, Enter = discard (with focus)
- [ ] Props: `isOpen`, `onDiscard`, `onCancel`, `filename`

#### Step 11: Create Simple Discard Warning Dialog
- [ ] Similar to ConflictDialog but simpler message
- [ ] Text: "You have unsaved changes. Refresh will discard them."
- [ ] Buttons: "Discard & Refresh" / "Cancel"
- [ ] Props: `isOpen`, `onConfirm`, `onCancel`

#### Step 12: Wire Dialogs in SpreadsheetViewer
- [ ] Add state for `showConflictDialog` and `showDiscardWarning`
- [ ] Listen for 'showConflictDialog' and 'confirmDiscard' messages
- [ ] Handle dialog callbacks (send confirmRefresh/cancelRefresh)

---

### Phase 3.6: Implement File Watcher

#### Step 13: Add FileSystemWatcher to Providers
- [ ] Create watcher on file open: `vscode.workspace.createFileSystemWatcher()`
- [ ] Listen to `onDidChange` event
- [ ] Filter: Only watch current file (not entire directory)
- [ ] Dispose watcher when document closes

#### Step 14: Handle File Change Events
- [ ] Debounce file changes (500ms) to avoid spam
- [ ] Check if document is dirty when file changes
- [ ] Send 'fileChanged' message to webview with dirty state
- [ ] Show appropriate notification based on dirty state

#### Step 15: Create FileChangeNotification Component
- [ ] Banner style (not modal) - appears at top of spreadsheet
- [ ] Icon: File icon or refresh icon
- [ ] Text variants:
  - Not dirty: "data.csv changed on disk. [Refresh Now] [Dismiss]"
  - Dirty: "data.csv changed on disk. You have unsaved changes. [Review]"
- [ ] Actions: "Refresh Now" button, "Dismiss" button
- [ ] Auto-dismiss after 10 seconds (only if not dirty)

#### Step 16: Wire File Change Notifications
- [ ] Add state for notification visibility and message
- [ ] Listen for 'fileChanged' message from extension
- [ ] Show notification with appropriate text
- [ ] Handle "Refresh Now" click (trigger refresh flow)
- [ ] Handle "Dismiss" click (hide notification)

---

### Phase 3.7: Edge Cases and Polish

#### Step 17: Handle Edge Cases
- [ ] File deleted on disk: Show error "File no longer exists"
- [ ] Permission denied: Show error "Permission denied to read file"
- [ ] Race condition (save + refresh): Add lock flag to prevent
- [ ] Refresh during cell edit: Disable refresh button while editing
- [ ] Large files: Refresh respects size warnings

#### Step 18: Multi-Sheet Excel State
- [ ] Store `selectedSheet` in extension provider
- [ ] Pass selectedSheet back in refresh 'load' message
- [ ] Webview applies selectedSheet after refresh
- [ ] Test: Switch sheets, refresh, verify correct sheet still selected

#### Step 19: Notifications and Feedback
- [ ] Success: "Refreshed [filename]"
- [ ] Error: "Failed to refresh [filename]: [reason]"
- [ ] Conflict resolved: "Loaded latest version from disk"
- [ ] Refresh cancelled: Silent (no notification)

---

### Phase 3.8: Testing

#### Step 20: Manual Test All Scenarios
- [ ] **CSV Save Fix:** Edit cell, close, reopen → Changes persist
- [ ] **Excel Simple Refresh:** Edit externally, refresh → See changes
- [ ] **CSV No Changes:** Open, refresh → Reloads cleanly
- [ ] **CSV Local Changes Only:** Edit, refresh → Warn, then reload
- [ ] **CSV External Changes Only:** Edit externally, refresh → Reload immediately
- [ ] **CSV Conflict:** Edit in both places, refresh → Show dialog
- [ ] **Conflict Dialog - Discard:** Verify disk version loads
- [ ] **Conflict Dialog - Keep:** Verify local edits preserved
- [ ] **File Watcher - Clean:** Edit externally → Show notification → Refresh works
- [ ] **File Watcher - Dirty:** Edit externally while having local changes → Show warning notification
- [ ] **Excel Multi-Sheet:** Refresh preserves selected sheet
- [ ] **Edge - File Deleted:** Delete file, refresh → Error message
- [ ] **Edge - Large File:** Refresh respects size warnings

---

## Architecture Changes

### Extension Side (TypeScript)

**ritemarkEditor.ts:**
```typescript
// NEW: File metadata tracking
private fileLoadTimes = new Map<string, number>();
private fileWatchers = new Map<string, vscode.FileSystemWatcher>();
private isRefreshing = new Set<string>();

// MODIFIED: contentChanged handler (fix CSV save bug)
case 'contentChanged':
  if (this.getFileType(document.uri.fsPath) === 'markdown') {
    // Existing markdown logic
  } else if (this.getFileType(document.uri.fsPath) === 'csv') {
    // NEW: Handle CSV saves
    this.updateDocument(document, message.content as string);
  }
  return;

// NEW: Refresh handler
case 'refresh':
  await this.handleRefresh(document, webviewPanel.webview);
  return;

// NEW: Conflict resolution handlers
case 'confirmRefresh':
  await this.reloadFile(document, webviewPanel.webview);
  return;

case 'cancelRefresh':
  // Just close dialog, no action
  return;

// NEW: Methods
private async handleRefresh(document, webview): Promise<void>
private async reloadFile(document, webview): Promise<void>
private createFileWatcher(document, webview): void
private disposeFileWatcher(documentUri): void
```

**excelEditorProvider.ts:**
```typescript
// Similar structure for Excel (simpler - no conflict detection)
private fileLoadTimes = new Map<string, number>();
private fileWatchers = new Map<string, vscode.FileSystemWatcher>();

// NEW: Refresh handler (simpler than CSV)
private async handleRefresh(document, webview): Promise<void>
private createFileWatcher(document, webview): void
```

### Webview Side (React/TypeScript)

**SpreadsheetToolbar.tsx:**
```typescript
interface SpreadsheetToolbarProps {
  // ... existing props
  onRefresh?: () => void;  // NEW
  refreshDisabled?: boolean;  // NEW (disable during cell edit)
}

// NEW: Refresh button (leftmost)
<button onClick={onRefresh} disabled={refreshDisabled} title="Refresh from disk">
  <RotateCw size={16} />
</button>
```

**SpreadsheetViewer.tsx:**
```typescript
// NEW: State
const [showConflictDialog, setShowConflictDialog] = useState(false);
const [showDiscardWarning, setShowDiscardWarning] = useState(false);
const [showFileChangeNotification, setShowFileChangeNotification] = useState(false);
const [fileChangeMessage, setFileChangeMessage] = useState('');
const [isEditingCell, setIsEditingCell] = useState(false);

// NEW: Message handlers
useEffect(() => {
  onMessage((message) => {
    switch (message.type) {
      case 'showConflictDialog':
        setShowConflictDialog(true);
        break;
      case 'confirmDiscard':
        setShowDiscardWarning(true);
        break;
      case 'fileChanged':
        setFileChangeMessage(message.message);
        setShowFileChangeNotification(true);
        break;
    }
  });
}, []);

// NEW: Handlers
const handleRefresh = () => sendToExtension('refresh', {});
const handleConfirmDiscard = () => {
  sendToExtension('confirmRefresh', {});
  setShowConflictDialog(false);
  setShowDiscardWarning(false);
};
const handleCancelRefresh = () => {
  sendToExtension('cancelRefresh', {});
  setShowConflictDialog(false);
  setShowDiscardWarning(false);
};
```

**ConflictDialog.tsx (NEW):**
```typescript
export function ConflictDialog({
  isOpen,
  filename,
  onDiscard,
  onCancel
}: ConflictDialogProps) {
  // Modal overlay with simple warning
  // Two buttons: Discard (destructive) / Keep Editing (safe)
}
```

**FileChangeNotification.tsx (NEW):**
```typescript
export function FileChangeNotification({
  isVisible,
  message,
  onRefreshNow,
  onDismiss
}: FileChangeNotificationProps) {
  // Banner at top of viewer
  // Auto-dismiss after 10s
}
```

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| CSV save fix breaks markdown | **CRITICAL** | Low | Test markdown editing thoroughly after fix |
| Data loss on refresh (CSV conflict) | **CRITICAL** | Medium | Robust conflict detection with confirmation dialogs |
| File watcher performance issues | Medium | Low | Debounce events, watch only current file |
| File watcher notification spam | Medium | Medium | Auto-dismiss after 10s, debounce changes |
| Refresh breaks multi-sheet state (Excel) | Medium | Medium | Store and restore `selectedSheet` |
| Race condition: save during refresh | High | Low | Lock document during refresh operation |
| File watcher doesn't clean up | Low | Low | Dispose watcher in document close handler |

---

## Conflict Resolution UX

### Scenario 1: CSV - Both Local AND Disk Changes (True Conflict)

```
User clicks Refresh
  ↓
Check: document.isDirty = true
Check: file mtime changed = true
  ↓
Show ConflictDialog:

  ┌──────────────────────────────────────────────┐
  │  ⚠️  Unsaved Changes Conflict                 │
  ├──────────────────────────────────────────────┤
  │                                              │
  │  You have unsaved edits in RiteMark.        │
  │  The file "data.csv" has also been modified │
  │  on disk by another program.                │
  │                                              │
  │  Refreshing will discard your changes.      │
  │                                              │
  │  ┌────────────────────┐  ┌────────────────┐ │
  │  │ Discard My Changes │  │  Keep Editing  │ │
  │  │ (Load from disk)   │  │  (Cancel)      │ │
  │  └────────────────────┘  └────────────────┘ │
  │      Destructive              Safe          │
  └──────────────────────────────────────────────┘
```

### Scenario 2: CSV - Local Changes, No Disk Changes

```
User clicks Refresh
  ↓
Check: document.isDirty = true
Check: file mtime changed = false
  ↓
Show Discard Warning:

  ┌──────────────────────────────────────────────┐
  │  ⚠️  Unsaved Changes                          │
  ├──────────────────────────────────────────────┤
  │                                              │
  │  You have unsaved changes.                  │
  │  Refreshing will discard them.              │
  │                                              │
  │  ┌────────────────────┐  ┌────────────────┐ │
  │  │ Discard & Refresh  │  │     Cancel     │ │
  │  └────────────────────┘  └────────────────┘ │
  └──────────────────────────────────────────────┘
```

### Scenario 3: File Changed on Disk (File Watcher)

```
External app saves file
  ↓
FileSystemWatcher detects change
  ↓
Check: document.isDirty = false
  ↓
Show FileChangeNotification (banner at top):

  ┌──────────────────────────────────────────────┐
  │  📄 data.csv changed on disk.                │
  │     [Refresh Now]  [Dismiss]                 │
  └──────────────────────────────────────────────┘
        (Auto-dismiss after 10s)

User clicks "Refresh Now" → Trigger refresh flow
```

---

## Testing Strategy

### Phase 4: Test & Validate Checklist

#### CSV Save Fix Tests
1. Edit CSV cell, don't save → Close tab → Reopen = PASS if changes persist
2. Edit CSV cell → Cmd+S → Verify dirty indicator clears = PASS
3. Edit CSV cell → Edit in external app → No conflict = PASS

#### Refresh Button Tests
4. Excel file → Edit externally → Refresh → See changes = PASS
5. CSV file → Click Refresh (no changes) → Reloads = PASS
6. Multi-sheet Excel → Switch to Sheet2 → Refresh → Still on Sheet2 = PASS

#### Conflict Detection Tests
7. CSV → Edit cell in RiteMark → Refresh → Show warning → Discard → Reload = PASS
8. CSV → Edit externally (no local edits) → Refresh → Immediate reload = PASS
9. CSV → Edit in both places → Refresh → Show conflict dialog = PASS
10. CSV → Conflict dialog → Click "Discard" → Loads disk version = PASS
11. CSV → Conflict dialog → Click "Keep Editing" → Stays dirty = PASS

#### File Watcher Tests
12. CSV → Edit externally → See notification banner = PASS
13. CSV → Notification → Click "Refresh Now" → Reloads = PASS
14. CSV → Notification → Click "Dismiss" → Hides = PASS
15. CSV → Edit locally + edit externally → Notification shows warning = PASS
16. File watcher → Auto-dismiss after 10s (if not dirty) = PASS

#### Edge Case Tests
17. Delete file externally → Refresh → Show error = PASS
18. Permission denied → Refresh → Show error = PASS
19. Refresh during cell edit → Button disabled = PASS
20. Large file → Refresh → Respects size warning = PASS

---

## Approval Status

**Current Phase:** 2 (PLAN)
**Gate:** Phase 2→3 - Requires Jarmo's approval

**Sprint Plan Checklist:**
- [x] Goal clearly defined
- [x] Success criteria documented
- [x] Implementation checklist created (20 steps)
- [x] Risk assessment complete
- [x] UX flows documented
- [x] Testing strategy defined
- [x] Architecture changes specified

---

## Approval Required

**GATE: Phase 2→3 - Cannot proceed without approval**

This sprint plan includes:
- CSV save bug fix (CRITICAL prerequisite)
- Refresh button with conflict detection
- File watcher with notifications
- Simple but nicely designed conflict dialogs
- Comprehensive testing strategy

The implementation is broken down into 20 clear steps with testable outcomes.

**To proceed to Phase 3 (DEVELOP), Jarmo must respond with:**
- "approved"
- "Jarmo approved"
- "@approved"
- "proceed"
- "go ahead"

Otherwise, I will not write any implementation code.

---

## Sprint Manager Status

```
Sprint: 21 - Refresh Button
Phase: 2 - PLAN (COMPLETE)
Status: Awaiting Jarmo's approval
Gate: BLOCKED - Requires approval phrase to proceed to Phase 3
Next Action: Jarmo reviews plan and approves
```
