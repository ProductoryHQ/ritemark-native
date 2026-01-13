# Sprint 19.5: Spreadsheet Toolbar with External App Integration

**Sprint:** 19.5 - Spreadsheet Toolbar
**Goal:** Add toolbar to Excel/CSV previews with "Open in Excel/Numbers" buttons
**Current Phase:** 1 (RESEARCH)
**Status:** Research in progress

---

## Executive Summary

Sprint 19.5 adds a toolbar to the SpreadsheetViewer component (used by both CSV and Excel previews) with external app integration. Users can open files in Microsoft Excel (if installed) or Apple Numbers (always available on macOS).

**Scope:**
- ✅ Add toolbar above spreadsheet table (similar to DocumentHeader)
- ✅ Primary button: "Open in Excel" (right-aligned, if Excel installed)
- ✅ Dropdown option: "Open in Numbers" (macOS default)
- ✅ Detect Excel installation at runtime
- ✅ Send file path to extension for opening

**Design Pattern:**
- Follow existing DocumentHeader pattern from Sprint 18
- Ghost button style with VS Code theme integration
- Minimal UI footprint (40px toolbar height)

**Effort:** Small (~150 lines: toolbar component + extension handler)
**Risk:** Low (proven patterns, simple shell commands)
**Dependencies:** None (all tools available in codebase)

---

## Success Criteria

### Technical Requirements
- [ ] Toolbar renders above SpreadsheetViewer table
- [ ] "Open in Excel" button shows only if Excel is installed
- [ ] "Open in Numbers" option always available (dropdown)
- [ ] Clicking button opens file in external app
- [ ] Works for both .xlsx and .csv files
- [ ] No regression in spreadsheet display/editing

### Quality Gates
- [ ] No bundle size increase (shell commands are extension-side)
- [ ] qa-validator passes all checks before Phase 4→5
- [ ] qa-validator passes final check before Phase 6

### User Experience
- [ ] Toolbar style matches DocumentHeader (Sprint 18)
- [ ] External app opens within 1 second
- [ ] Clear feedback if file fails to open
- [ ] Responsive layout (hides text on narrow screens)

---

## Deliverables

| Deliverable | Description | Status |
|-------------|-------------|--------|
| `SpreadsheetToolbar.tsx` | New toolbar component with app buttons | Not started |
| `SpreadsheetViewer.tsx` | Updated to include toolbar | Not started |
| `excelEditorProvider.ts` | Handle 'openInApp' message | Not started |
| `ritemarkEditor.ts` | Handle 'openInApp' message (CSV files) | Not started |
| Test cases | Manual test with Excel/Numbers on macOS | Not started |

---

## Architecture Overview

### Current (Sprint 19)
```
SpreadsheetViewer
├── Status bar (filename, row/col count)
├── Sheet selector (Excel only, if multi-sheet)
└── DataTable (scrollable content)
```

### After Sprint 19.5
```
SpreadsheetViewer
├── SpreadsheetToolbar ← NEW (40px height, sticky)
│   ├── "Open in Excel" button (right-aligned, conditional)
│   └── Dropdown: "Open in Numbers"
├── Status bar (filename, row/col count)
├── Sheet selector (Excel only, if multi-sheet)
└── DataTable (scrollable content)
```

---

## Implementation Checklist

### Phase 1: Research ✅ COMPLETE
- [x] Review DocumentHeader pattern from Sprint 18
- [x] Research macOS app detection and opening
- [x] Document shell commands for Excel/Numbers
- [x] Identify message flow (webview → extension → shell)
- [x] Define toolbar UI requirements
- [x] Document risks and testing strategy

### Phase 2: Plan
- [ ] Create detailed sprint plan with checklist
- [ ] Define success criteria and acceptance tests
- [ ] Document toolbar component architecture
- [ ] Get Jarmo's approval to proceed

### Phase 3: Develop 🔒 BLOCKED (Requires Approval)

#### 3.1: Create SpreadsheetToolbar Component
- [ ] Create `webview/src/components/SpreadsheetToolbar.tsx`
  - Props: `filename`, `fileType`, `onOpenInApp: (app: 'excel' | 'numbers') => void`
  - Primary button: "Open in Excel" (conditional rendering)
  - Dropdown button: "Open in..." → Numbers option
  - Styled with DocumentHeader pattern (ghost buttons)
  - ~80 lines of code

#### 3.2: Update SpreadsheetViewer
- [ ] Import SpreadsheetToolbar component
- [ ] Add toolbar before status bar
- [ ] Implement `handleOpenInApp` callback
  - Send message to extension: `{ type: 'openInApp', app: 'excel' | 'numbers' }`
  - ~15 lines added

#### 3.3: Extension Message Handlers
- [ ] Update `excelEditorProvider.ts`
  - Add 'openInApp' message handler
  - Detect Excel installation: `open -Ra "Microsoft Excel"`
  - Open file: `open -a "Microsoft Excel" /path/to/file.xlsx`
  - Fallback to Numbers if Excel not found
  - ~30 lines added

- [ ] Update `ritemarkEditor.ts`
  - Add 'openInApp' message handler for CSV files
  - Same detection/open logic
  - ~30 lines added

#### 3.4: Test Implementation
- [ ] Build extension (`npm run compile`)
- [ ] Launch dev instance
- [ ] Test with Excel installed → Button should appear
- [ ] Test opening .xlsx in Excel
- [ ] Test opening .xlsx in Numbers
- [ ] Test with CSV file → Both apps should work
- [ ] Fix any initial issues

### Phase 4: Test & Validate
- [ ] Test toolbar appears for .xlsx files
- [ ] Test toolbar appears for .csv files
- [ ] Test "Open in Excel" button (if Excel installed)
- [ ] Test "Open in Numbers" dropdown option
- [ ] Test on macOS without Excel → Only Numbers option shows
- [ ] Test toolbar style matches DocumentHeader
- [ ] Test responsive behavior (narrow viewport)
- [ ] Test existing spreadsheet features still work (editing CSV, sheet switching)
- [ ] **Invoke qa-validator agent** (HARD GATE)

### Phase 5: Cleanup
- [ ] Remove any debug console.log statements
- [ ] Add code comments for shell command logic
- [ ] Verify bundle size remains stable
- [ ] Update sprint STATUS.md
- [ ] Document any gotchas in notes/

### Phase 6: Deploy
- [ ] Final commit with conventional commit message
- [ ] **Invoke qa-validator for final check** (HARD GATE)
- [ ] Push to GitHub
- [ ] Update roadmap if applicable

---

## Technical Implementation Details

### SpreadsheetToolbar Component

**File:** `webview/src/components/SpreadsheetToolbar.tsx`

```typescript
import React, { useState, useRef, useEffect } from 'react'
import { ExternalLink, ChevronDown } from 'lucide-react'

interface SpreadsheetToolbarProps {
  filename: string
  fileType: 'csv' | 'xlsx'
  onOpenInApp: (app: 'excel' | 'numbers') => void
}

/**
 * Toolbar for spreadsheet files with external app integration
 *
 * Shows "Open in Excel" (if available) and "Open in Numbers" options
 * Styled to match DocumentHeader from Sprint 18
 */
export function SpreadsheetToolbar({ filename, fileType, onOpenInApp }: SpreadsheetToolbarProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [hasExcel, setHasExcel] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Check if Excel is available (sent from extension on load)
  useEffect(() => {
    // Request app detection from extension
    // Extension will respond with 'appDetection' message
    window.acquireVsCodeApi().postMessage({
      type: 'checkAppAvailability',
      apps: ['excel']
    })

    // Listen for response
    const handleMessage = (event: MessageEvent) => {
      const message = event.data
      if (message.type === 'appDetection') {
        setHasExcel(message.hasExcel)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleOpenClick = (app: 'excel' | 'numbers') => {
    onOpenInApp(app)
    setShowDropdown(false)
  }

  return (
    <div className="spreadsheet-toolbar">
      <div className="toolbar-content">
        {/* Spacer to push buttons to the right */}
        <div className="flex-1" />

        {/* Primary: Open in Excel (if available) */}
        {hasExcel && (
          <button
            className="toolbar-btn"
            onClick={() => handleOpenClick('excel')}
            aria-label="Open in Microsoft Excel"
            title="Open in Microsoft Excel"
          >
            <ExternalLink size={16} />
            <span className="toolbar-btn-text">Open in Excel</span>
          </button>
        )}

        {/* Dropdown: Open in... */}
        <div className="relative" ref={dropdownRef}>
          <button
            className="toolbar-btn"
            onClick={() => setShowDropdown(!showDropdown)}
            aria-label="Open in other app"
            title="Open in..."
          >
            <ExternalLink size={16} />
            <ChevronDown size={14} />
          </button>

          {showDropdown && (
            <div className="dropdown-menu">
              <button
                className="dropdown-item"
                onClick={() => handleOpenClick('numbers')}
              >
                Open in Numbers
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        /* Toolbar - Sticky at top, same style as DocumentHeader */
        .spreadsheet-toolbar {
          position: sticky;
          top: 0;
          left: 0;
          right: 0;
          height: 40px;
          background: var(--vscode-editor-background);
          border-bottom: 1px solid var(--vscode-panel-border);
          z-index: 60;
        }

        .toolbar-content {
          display: flex;
          align-items: center;
          height: 100%;
          padding: 0 16px;
          gap: 8px;
        }

        /* Ghost button style (matches DocumentHeader) */
        .toolbar-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: var(--vscode-foreground);
          font-size: 13px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .toolbar-btn:hover {
          background: var(--vscode-toolbar-hoverBackground);
        }

        .toolbar-btn:active {
          background: var(--vscode-toolbar-activeBackground, var(--vscode-toolbar-hoverBackground));
        }

        /* Button text - hidden on narrow viewports */
        .toolbar-btn-text {
          display: inline;
        }

        @media (max-width: 500px) {
          .toolbar-btn-text {
            display: none;
          }
        }

        /* Dropdown menu */
        .dropdown-menu {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 4px;
          min-width: 160px;
          background: var(--vscode-menu-background);
          border: 1px solid var(--vscode-menu-border);
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 100;
          overflow: hidden;
        }

        .dropdown-item {
          display: block;
          width: 100%;
          padding: 8px 12px;
          border: none;
          background: transparent;
          color: var(--vscode-menu-foreground);
          font-size: 13px;
          text-align: left;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .dropdown-item:hover {
          background: var(--vscode-menu-selectionBackground);
          color: var(--vscode-menu-selectionForeground);
        }
      `}</style>
    </div>
  )
}
```

---

### SpreadsheetViewer Updates

**File:** `webview/src/components/SpreadsheetViewer.tsx`

```typescript
// Add import
import { SpreadsheetToolbar } from './SpreadsheetToolbar'
import { sendToExtension } from '../bridge'

// Add callback in component
const handleOpenInApp = useCallback((app: 'excel' | 'numbers') => {
  sendToExtension('openInApp', { app, filename })
}, [filename])

// Update JSX (before status bar)
return (
  <div className="flex flex-col h-screen bg-[var(--vscode-editor-background)]">
    {/* Toolbar - NEW */}
    <SpreadsheetToolbar
      filename={filename}
      fileType={fileType}
      onOpenInApp={handleOpenInApp}
    />

    {/* Status bar */}
    <div className="flex items-center justify-between px-3 py-1 ...">
      {/* ... existing status bar ... */}
    </div>

    {/* ... rest of component ... */}
  </div>
)
```

---

### Extension Message Handlers

**Excel files** (`excelEditorProvider.ts`):

```typescript
// In resolveCustomEditor, add message handler
webviewPanel.webview.onDidReceiveMessage(
  message => {
    switch (message.type) {
      case 'ready':
        this.sendExcelData(webviewPanel.webview, document);
        break;

      case 'openInApp':
        // Open file in external app
        this.openInExternalApp(document.uri.fsPath, message.app);
        break;

      case 'checkAppAvailability':
        // Detect Excel installation
        this.checkAppAvailability(webviewPanel.webview);
        break;

      case 'error':
        vscode.window.showErrorMessage(`Excel Preview: ${message.message}`);
        break;
    }
  },
  undefined,
  this.context.subscriptions
);

// Add helper methods
private async checkAppAvailability(webview: vscode.Webview): Promise<void> {
  const hasExcel = await this.isAppInstalled('Microsoft Excel');
  webview.postMessage({
    type: 'appDetection',
    hasExcel
  });
}

private async isAppInstalled(appName: string): Promise<boolean> {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    await execAsync(`open -Ra "${appName}"`);
    return true;
  } catch {
    return false;
  }
}

private openInExternalApp(filePath: string, app: 'excel' | 'numbers'): void {
  const { exec } = require('child_process');
  const appName = app === 'excel' ? 'Microsoft Excel' : 'Numbers';

  exec(`open -a "${appName}" "${filePath}"`, (error: Error | null) => {
    if (error) {
      vscode.window.showErrorMessage(`Failed to open in ${appName}: ${error.message}`);
    }
  });
}
```

**CSV files** (`ritemarkEditor.ts`):

```typescript
// In resolveCustomTextEditor, add message handlers (same logic as above)
// Add to existing switch statement:

case 'openInApp':
  this.openInExternalApp(document.uri.fsPath, message.app);
  break;

case 'checkAppAvailability':
  this.checkAppAvailability(webviewPanel.webview);
  break;
```

---

## macOS Shell Commands Reference

### Detect App Installation
```bash
# Returns exit code 0 if app exists, non-zero otherwise
open -Ra "Microsoft Excel"
open -Ra "Numbers"  # Always present on macOS
```

### Open File in App
```bash
# Open in Excel (if installed)
open -a "Microsoft Excel" /path/to/file.xlsx

# Open in Numbers (always available)
open -a "Numbers" /path/to/file.xlsx

# Works for CSV too
open -a "Microsoft Excel" /path/to/file.csv
open -a "Numbers" /path/to/file.csv
```

---

## Message Flow Diagram

```
User opens .xlsx file
        ↓
SpreadsheetViewer renders
        ↓
SpreadsheetToolbar mounts
        ↓
Send 'checkAppAvailability' to extension
        ↓
Extension runs: open -Ra "Microsoft Excel"
        ↓
Extension sends 'appDetection' { hasExcel: true/false }
        ↓
Toolbar shows/hides "Open in Excel" button
        ↓
User clicks "Open in Excel"
        ↓
Toolbar calls onOpenInApp('excel')
        ↓
SpreadsheetViewer sends 'openInApp' { app: 'excel' }
        ↓
Extension runs: open -a "Microsoft Excel" /path/to/file.xlsx
        ↓
Excel launches with file open
```

---

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Excel not installed | Low | Medium | Show only Numbers option (always available) |
| File path contains special characters | Medium | Low | Properly escape shell command arguments |
| `open` command fails (permissions) | Low | Very Low | Show error message to user |
| Toolbar overlaps with content | Low | Very Low | Use sticky positioning like DocumentHeader |
| Dropdown menu styling conflicts | Low | Low | Use VS Code theme variables consistently |

---

## Testing Checklist

### Regression Tests (Phase 4)
- [ ] Open .xlsx file → Preview renders correctly (no change)
- [ ] Open .csv file → Preview renders correctly (no change)
- [ ] Edit .csv file → Saving still works (no change)
- [ ] Multi-sheet Excel file → Sheet switching still works

### New Functionality Tests (Phase 4)
- [ ] Toolbar appears on .xlsx files
- [ ] Toolbar appears on .csv files
- [ ] "Open in Excel" button visible (if Excel installed)
- [ ] Click "Open in Excel" → File opens in Excel
- [ ] Click "Open in Numbers" → File opens in Numbers
- [ ] Dropdown menu opens/closes correctly
- [ ] Clicking outside dropdown closes it
- [ ] Toolbar style matches DocumentHeader

### Edge Cases (Phase 4)
- [ ] macOS without Excel → Only Numbers option shows
- [ ] File with spaces in name → Opens correctly
- [ ] File in deep directory path → Opens correctly
- [ ] Narrow viewport → Button text hides (icons remain)

---

## File Changes Summary

### New Files (1)
1. `extensions/ritemark/webview/src/components/SpreadsheetToolbar.tsx` (~80 lines)

### Modified Files (3)
1. `extensions/ritemark/webview/src/components/SpreadsheetViewer.tsx` - Add toolbar (~15 lines)
2. `extensions/ritemark/src/excelEditorProvider.ts` - Message handlers (~40 lines)
3. `extensions/ritemark/src/ritemarkEditor.ts` - Message handlers (~40 lines)

---

## Bundle Size Impact

**Current:** 1.41MB (webview.js)
**After Sprint 19.5:** 1.41MB (no significant change expected)

**Why minimal change:**
- SpreadsheetToolbar component is small (~80 lines)
- Shell command logic is extension-side (not bundled)
- Lucide icons (ExternalLink, ChevronDown) already in bundle

---

## Rollback Plan

If critical issues are discovered:

1. **Revert SpreadsheetViewer.tsx** to remove toolbar
2. **Delete SpreadsheetToolbar.tsx**
3. **Revert extension message handlers**
4. **Test spreadsheet display** works without toolbar
5. **Rebuild and redeploy** clean version

---

## Future Enhancements (Out of Scope)

- "Open in Google Sheets" (requires upload to Drive)
- "Copy public link" for cloud-synced files
- "Export to..." menu (PDF, CSV from Excel)
- Remember user's preferred app (Excel vs Numbers)
- Support for Windows/Linux (Excel detection, LibreOffice)

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
| 1: Research | ✅ Complete | 30 min |
| 2: Planning | 🟡 In Review | - |
| 3: Implementation | 🔒 Blocked (needs approval) | 1.5 hours |
| 4: Testing | ⏸️ Not started | 30 min |
| 5: Cleanup | ⏸️ Not started | 15 min |
| 6: Deploy | ⏸️ Not started | 15 min |

**Total Estimated Time:** ~2.5-3 hours of focused work

---

## Documentation Index

All Sprint 19.5 documentation is in `/Users/jarmotuisk/Projects/ritemark-native/docs/sprints/sprint-19.5-spreadsheet-toolbar/`:

- **Sprint plan:** `sprint-plan.md` (this document)
- **Phase 1 research:** `research/phase-1-discovery.md`
- **Implementation notes:** `notes/` (will be populated during Phase 3)

---

## Questions Before Approval

Please confirm before approving:

1. **Button placement:** Right-aligned toolbar acceptable? (Alternative: left-aligned)
2. **Dropdown vs buttons:** Dropdown for Numbers acceptable? (Alternative: two separate buttons)
3. **Excel detection:** Auto-detect on load acceptable? (Alternative: show both, handle missing app on click)
4. **Error handling:** Show VS Code error notification if app fails to open?

---

**Sprint Manager Status:**
```
Sprint: 19.5 - Spreadsheet Toolbar
Phase: 1 - Research (COMPLETE)
Gate: Phase 1→2 Clear (auto-transition)
Next Action: Create Phase 1 research documentation
```
