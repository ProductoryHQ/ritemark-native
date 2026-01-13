# Sprint 19.5 - Ready for Approval

**Date:** 2026-01-13
**Sprint:** 19.5 - Spreadsheet Toolbar with External App Integration

---

## Quick Summary

**What:** Add toolbar to Excel/CSV previews with "Open in Excel/Numbers" buttons

**Why:** Users want to quickly open spreadsheets in native apps for advanced features

**Effort:** 2-3 hours total (small enhancement)

**Risk:** Low (proven patterns, simple shell commands)

---

## Visual Mockup

```
┌─────────────────────────────────────────────────────────────┐
│ SpreadsheetToolbar (NEW - 40px height, sticky)             │
│                                  [Open in Excel ↗] [▼]     │ ← Toolbar
├─────────────────────────────────────────────────────────────┤
│ report.xlsx                          1,234 rows × 8 columns│ ← Status bar
├─────────────────────────────────────────────────────────────┤
│ Sheet1 | Sheet2 | Sheet3                                   │ ← Sheet selector
├─────────────────────────────────────────────────────────────┤
│ Name     | Age | City    | ...                             │
│ John Doe | 30  | Seattle | ...                             │ ← DataTable
│ Jane Doe | 28  | Portland| ...                             │
└─────────────────────────────────────────────────────────────┘
```

**Toolbar features:**
- Right-aligned (matches DocumentHeader from Sprint 18)
- "Open in Excel" button (only if Excel installed)
- Dropdown menu with "Open in Numbers" option
- Ghost button style (transparent, hover shows background)

---

## Technical Approach

### 1. New Component: SpreadsheetToolbar
- Similar to DocumentHeader (Sprint 18)
- Props: `filename`, `fileType`, `onOpenInApp(app)`
- Auto-detects Excel installation on mount
- ~80 lines of code

### 2. Update SpreadsheetViewer
- Add toolbar before status bar
- Pass callback to handle "Open in..." actions
- ~15 lines added

### 3. Extension Message Handlers
- Add to `excelEditorProvider.ts` (Excel files)
- Add to `ritemarkEditor.ts` (CSV files)
- Handle: `checkAppAvailability`, `openInApp`
- ~40 lines each

### 4. macOS Shell Commands
```bash
# Detect Excel
open -Ra "Microsoft Excel"  # Exit 0 = installed

# Open file
open -a "Microsoft Excel" /path/to/file.xlsx
open -a "Numbers" /path/to/file.xlsx
```

---

## What You'll See

### When Excel is installed:
```
[Open in Excel ↗] [▼]
                   └─ Dropdown: "Open in Numbers"
```

### When Excel is NOT installed:
```
[▼]
 └─ Dropdown: "Open in Numbers"
```

### Behavior:
1. Click "Open in Excel" → File opens in Microsoft Excel
2. Click dropdown → Shows "Open in Numbers" option
3. Click "Open in Numbers" → File opens in Apple Numbers

---

## Files to Create/Modify

### New (1)
- `webview/src/components/SpreadsheetToolbar.tsx`

### Modified (3)
- `webview/src/components/SpreadsheetViewer.tsx`
- `src/excelEditorProvider.ts`
- `src/ritemarkEditor.ts`

---

## Questions Before Approval

Please confirm your preferences:

### 1. Button Placement
- **Proposed:** Right-aligned (matches DocumentHeader)
- **Alternative:** Left-aligned

**Your choice:**

---

### 2. Numbers Button Style
- **Proposed:** Dropdown menu (scalable for future apps)
- **Alternative:** Separate button next to Excel

**Your choice:**

---

### 3. Excel Detection
- **Proposed:** Auto-detect on load (hide button if not installed)
- **Alternative:** Always show, error on click if missing

**Your choice:**

---

### 4. Error Handling
- **Proposed:** VS Code error notification (consistent with existing code)
- **Alternative:** Inline error in toolbar

**Your choice:**

---

## Testing Plan

### Manual Tests (Phase 4)
- ✅ Toolbar appears for .xlsx files
- ✅ Toolbar appears for .csv files
- ✅ "Open in Excel" button (if Excel installed)
- ✅ "Open in Numbers" dropdown option
- ✅ Files open correctly in external apps
- ✅ Toolbar style matches DocumentHeader
- ✅ Responsive behavior (narrow screens)
- ✅ No regression in spreadsheet display/editing

### Automated (qa-validator)
- Bundle size check
- No console errors
- Extension compiles
- Production build works

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Excel not installed | Show only Numbers option (always available on macOS) |
| File path with spaces | Properly quote shell command arguments |
| Command fails | Show error notification to user |
| Toolbar overlaps content | Use same sticky positioning as DocumentHeader |

**All risks have clear mitigations.**

---

## Timeline

| Phase | Duration | When |
|-------|----------|------|
| Research | 30 min | ✅ Complete |
| Planning | 15 min | 🟡 Awaiting approval |
| Development | 1.5 hours | After approval |
| Testing | 30 min | After development |
| Cleanup | 15 min | After testing |
| Deploy | 15 min | After cleanup |

**Total:** 2.5-3 hours

---

## Documentation Created

All research and planning is complete:

1. **Sprint Plan** (`sprint-plan.md`) - Detailed implementation plan
2. **Phase 1 Discovery** (`research/phase-1-discovery.md`) - Technical research
3. **macOS Integration** (`research/macos-app-integration.md`) - Shell command reference
4. **Status Tracker** (`STATUS.md`) - Sprint progress

---

## Approval

**To approve this sprint, reply with one of:**
- "approved"
- "Jarmo approved"
- "@approved"
- "proceed"
- "go ahead"

**Or, if you have concerns:**
- Ask questions
- Request changes to the plan
- Suggest alternative approaches

---

## Why This Sprint is Low-Risk

1. ✅ Follows proven DocumentHeader pattern (Sprint 18)
2. ✅ macOS `open` command is reliable and well-tested
3. ✅ No new dependencies required
4. ✅ Small code footprint (~175 lines total)
5. ✅ No changes to existing spreadsheet functionality
6. ✅ Easy to rollback if needed

---

**Sprint Manager Confidence:** 🟢 High (all research complete, clear plan)

**Ready to implement immediately upon approval.**
