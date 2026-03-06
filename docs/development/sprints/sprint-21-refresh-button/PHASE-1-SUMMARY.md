# Sprint 21 - Phase 1 Summary (COMPLETE)

**Sprint:** 21 - Refresh Button for Excel/CSV Editors
**Phase:** 1 (RESEARCH) - COMPLETE
**Date:** 2026-01-17
**Status:** Transitioned to Phase 2 (PLAN)

---

## Research Findings

### Critical Discovery: CSV Save Bug

**Problem:** CSV edits are NOT saved when user edits cells!

**Root Cause:** `ritemarkEditor.ts` line 237 filters CSV files:
```typescript
case 'contentChanged':
  if (this.getFileType(document.uri.fsPath) === 'markdown') {
    // Only handles markdown - CSV is ignored!
```

**Impact:** This is a CRITICAL bug that must be fixed as part of Sprint 21.

**Test Results (Jarmo):** Confirmed - CSV edits do not persist to disk.

---

## Jarmo's Decisions

Based on Phase 1 research, Jarmo made the following decisions for Sprint 21:

### 1. CSV Save Bug
**Decision:** FIX IT as part of this sprint (prerequisite for refresh feature)

### 2. Conflict Dialog Style
**Decision:** Simple warning dialog (no diff preview)
- Clear messaging about what will be lost
- Two buttons: "Discard My Changes" (destructive) / "Keep Editing" (safe)
- Nicely designed but not complex

### 3. File Change Detection
**Decision:** Include file watcher (MAXIMUM SCOPE)
- Automatic detection of external file changes
- Notification banner when file changes on disk
- Better UX for the workflow: edit in Excel → Ritemark detects change

### 4. Unsaved Changes Warning
**Decision:** Always warn before discarding
- Even if file hasn't changed on disk
- Respect user data - never silently discard edits

### 5. Sprint Scope
**Decision:** MAXIMUM - Include all features:
1. Fix CSV save bug (CRITICAL)
2. Add Refresh button
3. Implement conflict detection (CSV)
4. Simple reload for Excel (read-only)
5. File watcher with notifications
6. Nicely designed conflict dialogs

**Rationale:** Complete the feature properly in one sprint rather than splitting across multiple sprints.

---

## Architecture Insights

### Excel Files
- **Provider:** `ExcelEditorProvider` (CustomReadonlyEditorProvider)
- **Editable:** NO (read-only viewer)
- **Conflict Risk:** NONE
- **Refresh Strategy:** Simple reload from disk

### CSV Files
- **Provider:** `RitemarkEditorProvider` (CustomTextEditorProvider)
- **Editable:** YES (cell editing via DataTable)
- **Conflict Risk:** HIGH (unsaved changes + external edits)
- **Refresh Strategy:** Conflict detection required

### Current Save Flow (CSV - BROKEN)
```
1. User edits cell in DataTable
2. SpreadsheetViewer.handleCellChange() updates local state
3. Papa.unparse() serializes to CSV string
4. onChange() callback sends 'contentChanged' to extension
5. Extension receives message BUT IGNORES IT (only handles markdown)
6. ❌ Changes are NOT saved to disk!
```

### VS Code Capabilities Available
- `document.isDirty` - Tracks unsaved changes
- `fs.stat(uri).mtime` - File modification time
- `vscode.workspace.createFileSystemWatcher()` - Auto-detect file changes
- `vscode.window.showInformationMessage()` - User notifications

---

## Research Documents

All research documents are located in:
```
docs/sprints/sprint-21-refresh-button/research/
├── csv-save-mechanism.md          # Analysis of CSV save flow
└── conflict-detection-strategy.md # Conflict scenarios and UX design
```

---

## Phase 1→2 Transition

**Phase 1 Status:** COMPLETE
**Gate:** Auto-transition (Phase 1→2 has no approval gate)
**Next Phase:** Phase 2 (PLAN)

Phase 2 deliverables:
- Detailed implementation checklist (20 steps)
- Architecture changes documented
- Risk assessment
- Testing strategy
- Sprint plan ready for approval

---

## What's Next

Phase 2 (PLAN) is now complete. The sprint plan is ready at:
```
docs/sprints/sprint-21-refresh-button/sprint-plan.md
```

**GATE: Phase 2→3 - BLOCKED**

Jarmo must approve the sprint plan before implementation can begin.

Acceptable approval phrases:
- "approved"
- "Jarmo approved"
- "@approved"
- "proceed"
- "go ahead"

---

## Sprint Manager Status

```
Sprint: 21 - Refresh Button
Phase: 2 - PLAN (COMPLETE)
Status: Awaiting Jarmo's approval
Gate: BLOCKED - Requires approval phrase
Next Action: Jarmo reviews sprint-plan.md and approves
```
