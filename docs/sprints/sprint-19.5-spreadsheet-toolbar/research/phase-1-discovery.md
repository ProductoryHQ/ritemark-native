# Phase 1: Research - Sprint 19.5

**Date:** 2026-01-13
**Sprint:** 19.5 - Spreadsheet Toolbar
**Phase:** 1 (Research & Discovery)

---

## Research Objective

Understand how to add a toolbar to SpreadsheetViewer with external app integration (Excel/Numbers) on macOS.

---

## Key Findings

### 1. Existing Toolbar Pattern (Sprint 18)

**File:** `extensions/ritemark/webview/src/components/header/DocumentHeader.tsx`

**Pattern discovered:**
- Sticky header at top (40px height)
- Ghost button style (transparent with hover)
- Uses VS Code theme variables
- Responsive: hides button text on narrow screens
- Inline `<style>` tag for scoped CSS

**Key CSS variables used:**
```css
--vscode-editor-background
--vscode-panel-border
--vscode-foreground
--vscode-toolbar-hoverBackground
--vscode-toolbar-activeBackground
```

**Button structure:**
```tsx
<button className="header-btn">
  <Icon size={16} />
  <span className="header-btn-text">Label</span>
</button>
```

**Conclusion:** This pattern is proven and should be replicated for SpreadsheetToolbar.

---

### 2. SpreadsheetViewer Architecture (Sprint 19)

**File:** `extensions/ritemark/webview/src/components/SpreadsheetViewer.tsx`

**Current structure:**
```tsx
<div className="flex flex-col h-screen">
  {/* Status bar - 40px height */}
  <div className="flex items-center justify-between px-3 py-1 border-b">
    <span>{filename}</span>
    <span>{rowCount} × {colCount}</span>
  </div>

  {/* Sheet selector (Excel only) */}
  {fileType === 'xlsx' && cachedWorkbook && ...}

  {/* DataTable - takes remaining space */}
  <div className="flex-1 overflow-hidden">
    <DataTable ... />
  </div>
</div>
```

**Integration point:** Add toolbar BEFORE status bar.

**Communication pattern:**
- Uses `sendToExtension()` from `bridge.ts` to send messages
- Example: `sendToExtension('contentChanged', { content })`

**Conclusion:** We have a clear integration point and communication pattern.

---

### 3. Extension Message Handling (Sprint 19)

**Excel files:** `extensions/ritemark/src/excelEditorProvider.ts`

**Message handler pattern:**
```typescript
webviewPanel.webview.onDidReceiveMessage(
  message => {
    switch (message.type) {
      case 'ready':
        this.sendExcelData(webviewPanel.webview, document);
        break;

      case 'error':
        vscode.window.showErrorMessage(`Excel Preview: ${message.message}`);
        break;
    }
  },
  undefined,
  this.context.subscriptions
);
```

**CSV files:** `extensions/ritemark/src/ritemarkEditor.ts`

- Same pattern used for markdown/CSV editor
- Already handles messages like `contentChanged`, `exportPDF`, etc.

**Conclusion:** We need to add TWO message handlers:
1. `checkAppAvailability` - Detect Excel installation
2. `openInApp` - Open file in external app

---

### 4. macOS App Detection and Opening

**Research via Terminal:**

```bash
# Test 1: Detect if Excel is installed
$ open -Ra "Microsoft Excel"
# Exit code 0 = installed, non-zero = not installed

# Test 2: Detect Numbers (always present on macOS)
$ open -Ra "Numbers"
# Exit code 0 (always succeeds)

# Test 3: Open file in Excel
$ open -a "Microsoft Excel" ~/Documents/test.xlsx
# Launches Excel with file open

# Test 4: Open file in Numbers
$ open -a "Numbers" ~/Documents/test.xlsx
# Launches Numbers with file open

# Test 5: CSV files work too
$ open -a "Numbers" ~/Documents/data.csv
# Opens CSV in Numbers
```

**Key learnings:**
- `-Ra` flag = "Reveal in Finder" (used for detection only)
- `-a` flag = "Application" (used for opening)
- App names are case-sensitive
- Numbers is ALWAYS present on macOS (no detection needed)
- File paths with spaces must be quoted

**Implementation in Node.js:**
```typescript
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Detect app
try {
  await execAsync('open -Ra "Microsoft Excel"');
  return true; // Excel installed
} catch {
  return false; // Excel not installed
}

// Open file
exec(`open -a "Microsoft Excel" "${filePath}"`, (error) => {
  if (error) {
    vscode.window.showErrorMessage(`Failed to open: ${error.message}`);
  }
});
```

**Conclusion:** Implementation is straightforward with Node.js `child_process`.

---

### 5. Message Flow Analysis

**Flow 1: App Detection (on component mount)**
```
SpreadsheetToolbar mounts
  ↓
useEffect sends 'checkAppAvailability' message
  ↓
Extension receives message
  ↓
Extension runs: open -Ra "Microsoft Excel"
  ↓
Extension sends back 'appDetection' { hasExcel: true/false }
  ↓
Toolbar updates state (shows/hides Excel button)
```

**Flow 2: Opening File**
```
User clicks "Open in Excel" button
  ↓
Toolbar calls onOpenInApp('excel')
  ↓
SpreadsheetViewer sends 'openInApp' { app: 'excel', filename }
  ↓
Extension receives message
  ↓
Extension runs: open -a "Microsoft Excel" /path/to/file
  ↓
Excel launches with file open
  ↓
Extension shows error if command fails
```

**Conclusion:** Two-way message flow is well-defined.

---

### 6. Dropdown Menu Implementation

**Research: How to build dropdown menu in React**

**Pattern:**
```tsx
const [showDropdown, setShowDropdown] = useState(false)
const dropdownRef = useRef<HTMLDivElement>(null)

// Close on outside click
useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
      setShowDropdown(false)
    }
  }
  document.addEventListener('mousedown', handleClickOutside)
  return () => document.removeEventListener('mousedown', handleClickOutside)
}, [])

// Render
<div ref={dropdownRef}>
  <button onClick={() => setShowDropdown(!showDropdown)}>
    <ExternalLink />
    <ChevronDown />
  </button>
  {showDropdown && (
    <div className="dropdown-menu">
      <button onClick={() => handleOpenClick('numbers')}>
        Open in Numbers
      </button>
    </div>
  )}
</div>
```

**Styling:**
```css
.dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: var(--vscode-menu-background);
  border: 1px solid var(--vscode-menu-border);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
}
```

**Conclusion:** Standard React dropdown pattern, well-supported.

---

### 7. Icons Available (Lucide React)

**Already imported in codebase:**
- `ExternalLink` - Perfect for "Open in..." actions
- `ChevronDown` - Standard dropdown indicator

**From:** `lucide-react` package (already installed)

**Conclusion:** No new dependencies needed.

---

### 8. Responsive Behavior

**DocumentHeader pattern:**
```css
/* Button text - hidden on narrow viewports */
.header-btn-text {
  display: inline;
}

@media (max-width: 500px) {
  .header-btn-text {
    display: none;
  }
}
```

**Result:** On narrow screens, only icons show (saves space).

**Conclusion:** Same pattern should be applied to SpreadsheetToolbar.

---

### 9. Risk Analysis

| Risk | Mitigation |
|------|------------|
| Excel not installed | Show only Numbers option (always available) |
| File path with special chars | Properly quote file path in shell command |
| `open` command fails | Show error notification to user |
| Toolbar overlaps content | Use same sticky positioning as DocumentHeader |
| Dropdown menu z-index conflict | Set z-index: 100 (above table) |

**Conclusion:** All risks have clear mitigations.

---

### 10. Performance Considerations

**App detection timing:**
- Run on component mount (one-time cost)
- Cache result in component state
- ~50ms overhead (acceptable)

**Opening external app:**
- Async shell command (non-blocking)
- VS Code remains responsive
- External app launch time: ~1-2 seconds (OS responsibility)

**Bundle size impact:**
- New component: ~80 lines (~2KB minified)
- No new dependencies (Lucide icons already in bundle)
- Extension-side logic: not bundled in webview

**Conclusion:** Negligible performance impact.

---

## Architecture Decisions

### Decision 1: Toolbar Placement
**Options:**
- A) Before status bar (top of SpreadsheetViewer)
- B) After status bar (below filename info)
- C) Integrated into status bar

**Choice:** A (Before status bar)

**Rationale:**
- Matches DocumentHeader pattern (sticky at top)
- Clean separation of concerns (actions vs info)
- Easier to style independently

---

### Decision 2: Excel Button Visibility
**Options:**
- A) Always show, error on click if not installed
- B) Auto-detect on mount, conditionally render

**Choice:** B (Auto-detect, conditional render)

**Rationale:**
- Better UX (no misleading buttons)
- Detection is fast (~50ms)
- Users expect only available options to show

---

### Decision 3: Numbers Button Style
**Options:**
- A) Separate button next to Excel button
- B) Dropdown menu with "Open in..." options

**Choice:** B (Dropdown)

**Rationale:**
- Scalable (can add Google Sheets, LibreOffice later)
- Saves toolbar space
- Standard pattern (users expect dropdowns for multiple options)

---

### Decision 4: Error Handling
**Options:**
- A) Silent failure (log to console)
- B) VS Code error notification
- C) Inline error in toolbar

**Choice:** B (VS Code notification)

**Rationale:**
- Consistent with existing error handling (see excelEditorProvider.ts line 81)
- Non-intrusive (doesn't block UI)
- User can easily dismiss

---

### Decision 5: Message Handler Location
**Options:**
- A) Create new shared utility for shell commands
- B) Implement separately in excelEditorProvider and ritemarkEditor

**Choice:** B (Implement separately)

**Rationale:**
- Each provider manages its own lifecycle
- Small amount of code (~30 lines each)
- No need for premature abstraction

---

## Files to Create/Modify

### New Files (1)
1. **`extensions/ritemark/webview/src/components/SpreadsheetToolbar.tsx`**
   - Toolbar component with Excel/Numbers buttons
   - Dropdown menu logic
   - App detection state management
   - ~80 lines

### Modified Files (3)
1. **`extensions/ritemark/webview/src/components/SpreadsheetViewer.tsx`**
   - Import SpreadsheetToolbar
   - Add toolbar before status bar
   - Implement `onOpenInApp` callback
   - ~15 lines added

2. **`extensions/ritemark/src/excelEditorProvider.ts`**
   - Add message handlers: `checkAppAvailability`, `openInApp`
   - Implement `isAppInstalled()` helper
   - Implement `openInExternalApp()` helper
   - ~40 lines added

3. **`extensions/ritemark/src/ritemarkEditor.ts`**
   - Add same message handlers for CSV files
   - ~40 lines added

---

## Code Snippets from Research

### 1. DocumentHeader Style Pattern
```css
.document-header {
  position: sticky;
  top: 0;
  height: 40px;
  background: var(--vscode-editor-background);
  border-bottom: 1px solid var(--vscode-panel-border);
  z-index: 60;
}

.header-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.header-btn:hover {
  background: var(--vscode-toolbar-hoverBackground);
}
```

### 2. Message Sending Pattern (Webview)
```typescript
import { sendToExtension } from '../bridge'

const handleOpenInApp = useCallback((app: 'excel' | 'numbers') => {
  sendToExtension('openInApp', { app, filename })
}, [filename])
```

### 3. Message Handling Pattern (Extension)
```typescript
webviewPanel.webview.onDidReceiveMessage(
  message => {
    switch (message.type) {
      case 'openInApp':
        this.openInExternalApp(document.uri.fsPath, message.app);
        break;
    }
  },
  undefined,
  this.context.subscriptions
);
```

### 4. Shell Command Execution (Extension)
```typescript
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

---

## Dependencies Check

### Required Packages
- ✅ `lucide-react` - Already installed (ExternalLink, ChevronDown icons)
- ✅ `child_process` - Node.js built-in (no install needed)
- ✅ `util` - Node.js built-in (no install needed)
- ✅ VS Code API types - Already available

### No New Dependencies Required

---

## Testing Strategy

### Manual Test Cases

**Test Group 1: Excel Installed**
1. Open .xlsx file → Toolbar shows "Open in Excel" button
2. Click "Open in Excel" → File opens in Excel
3. Open .csv file → Toolbar shows "Open in Excel" button
4. Click "Open in Excel" → CSV opens in Excel

**Test Group 2: Excel Not Installed**
1. Open .xlsx file → Toolbar shows only dropdown
2. Click dropdown → Shows "Open in Numbers" option
3. Click "Open in Numbers" → File opens in Numbers

**Test Group 3: Dropdown Behavior**
1. Click dropdown button → Menu opens
2. Click outside dropdown → Menu closes
3. Click "Open in Numbers" → File opens, menu closes

**Test Group 4: UI Consistency**
1. Toolbar style matches DocumentHeader
2. Buttons use ghost style (transparent with hover)
3. Responsive: narrow viewport hides button text

**Test Group 5: Error Handling**
1. File path with spaces → Opens correctly
2. File in deep directory → Opens correctly
3. Simulate Excel crash → Error notification shows

---

## Open Questions for Approval

1. **Button placement:** Right-aligned toolbar acceptable? (Alternative: left-aligned)
   - **Recommendation:** Right-aligned (matches DocumentHeader export button)

2. **Dropdown vs buttons:** Dropdown for Numbers acceptable? (Alternative: two separate buttons)
   - **Recommendation:** Dropdown (scalable for future apps)

3. **Excel detection:** Auto-detect on load acceptable? (Alternative: show both, handle missing app on click)
   - **Recommendation:** Auto-detect (better UX)

4. **Error handling:** Show VS Code error notification if app fails to open?
   - **Recommendation:** Yes (consistent with existing error handling)

---

## Conclusion

**Research Complete:** All technical unknowns resolved.

**Ready for Phase 2:** Sprint plan can be finalized with confidence.

**Key Insights:**
1. Existing DocumentHeader pattern provides perfect template
2. macOS `open` command is reliable and well-tested
3. Message flow is straightforward (two new message types)
4. No new dependencies required
5. Implementation is low-risk (proven patterns)

**Estimated Effort:** 2-3 hours total
- Component creation: 1 hour
- Extension handlers: 30 minutes
- Testing: 30 minutes
- Cleanup: 30 minutes

**Go/No-Go for Phase 2:** ✅ GO

---

**Next Steps:**
1. Finalize sprint plan (Phase 2)
2. Get Jarmo's approval
3. Proceed to implementation (Phase 3)
