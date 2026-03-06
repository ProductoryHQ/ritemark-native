# Sprint 19.5 Implementation Notes

**Status:** COMPLETE
**Date:** 2026-01-13
**Phase:** 3 (Development)

## Overview

Successfully implemented a toolbar for Excel and CSV file previews with external app integration. Users can now open spreadsheet files directly in Microsoft Excel (if installed) or Apple Numbers (always available on macOS).

## Implementation Summary

### 1. SpreadsheetToolbar Component

**File:** `extensions/ritemark/webview/src/components/header/SpreadsheetToolbar.tsx`

Created a new React component following the DocumentHeader pattern:

- **Primary Button:** "Open in Excel" (shown when Excel is detected)
- **Fallback Dropdown:** "Open in Numbers" (shown when Excel is not installed)
- **Styling:** Ghost button design with VS Code theme integration
- **Positioning:** Sticky at top with z-index 60 (consistent with DocumentHeader)
- **Responsive:** Button text hides on narrow screens (<500px)

Key features:
- Dropdown menu with proper click-outside handling
- ExternalLink icons from lucide-react
- VS Code theme variables for seamless integration

### 2. SpreadsheetViewer Integration

**File:** `extensions/ritemark/webview/src/components/SpreadsheetViewer.tsx`

Added toolbar integration to the spreadsheet viewer:

- Import SpreadsheetToolbar and bridge utilities
- State management for Excel installation detection (`hasExcel`)
- Message handlers for external app actions
- On mount: Send `checkExcel` message to extension
- Receive `excelStatus` message with installation status
- Toolbar handlers: `handleOpenInExcel()` and `handleOpenInNumbers()`
- Toolbar replaces filename in status bar (filename now shown in toolbar)

### 3. Excel Editor Provider Updates

**File:** `extensions/ritemark/src/excelEditorProvider.ts`

Added external app integration for Excel files:

- Import `child_process` exec and promisify
- New message handlers in `resolveCustomEditor()`:
  - `checkExcel`: Detect Excel installation
  - `openInExternalApp`: Open file in Excel or Numbers
- Helper methods:
  - `checkExcelInstalled()`: Uses `open -Ra "Microsoft Excel"` to detect installation
  - `openInExternalApp(filePath, app)`: Opens file with `open -a "AppName" "file"`
- User feedback via VS Code notifications

### 4. Ritemark Editor Provider Updates

**File:** `extensions/ritemark/src/ritemarkEditor.ts`

Added CSV support for external app integration:

- Import `child_process` exec and promisify
- New message handlers in `resolveCustomTextEditor()`:
  - `checkExcel`: Detect Excel installation
  - `openInExternalApp`: Open CSV in Excel or Numbers
- Same helper methods as ExcelEditorProvider:
  - `checkExcelInstalled()`
  - `openInExternalApp(filePath, app)`
- Prevents accessing disposed webviews with `isDisposed` check

### 5. Component Exports

**File:** `extensions/ritemark/webview/src/components/header/index.ts`

Added SpreadsheetToolbar to exports for clean imports.

## Technical Details

### Excel Detection

Uses macOS `open -Ra` command to check if an app exists without launching it:

```typescript
await execAsync('open -Ra "Microsoft Excel"');
```

- Returns successfully if Excel is installed
- Throws error if Excel is not found
- Non-blocking, runs async

### Opening Files

Uses macOS `open -a` command to open files with specific applications:

```typescript
await execAsync(`open -a "${appName}" "${filePath}"`);
```

- `appName`: "Microsoft Excel" or "Numbers"
- `filePath`: Absolute path to the file
- Both Excel and Numbers can open .xlsx, .xls, and .csv files

### Message Flow

1. **Webview → Extension:**
   - `checkExcel` → Check if Excel is installed
   - `openInExternalApp` → Open file in specified app

2. **Extension → Webview:**
   - `excelStatus` → Send Excel installation status

## Files Changed

### Created
- `extensions/ritemark/webview/src/components/header/SpreadsheetToolbar.tsx`

### Modified
- `extensions/ritemark/webview/src/components/SpreadsheetViewer.tsx`
- `extensions/ritemark/src/excelEditorProvider.ts`
- `extensions/ritemark/src/ritemarkEditor.ts`
- `extensions/ritemark/webview/src/components/header/index.ts`

## Testing Checklist

- [ ] Open .xlsx file → Toolbar appears with correct button (Excel or Numbers)
- [ ] Open .xls file → Toolbar appears with correct button
- [ ] Open .csv file → Toolbar appears with correct button
- [ ] Click "Open in Excel" → File opens in Excel (if installed)
- [ ] Click "Open in..." dropdown → Numbers option appears
- [ ] Click "Open in Numbers" → File opens in Numbers
- [ ] Test on system WITHOUT Excel → "Open in..." dropdown shown
- [ ] Test on system WITH Excel → "Open in Excel" button shown
- [ ] Verify toolbar styling matches VS Code theme
- [ ] Test responsive behavior (narrow screens hide button text)
- [ ] Verify status bar info still shows row/column counts

## Edge Cases Handled

1. **Excel not installed:** Toolbar shows dropdown with Numbers option
2. **Disposed webview:** Message handlers check `isDisposed` flag
3. **Click outside dropdown:** Event listener closes dropdown
4. **Missing app:** Error notification shown to user
5. **File path with spaces:** Properly quoted in shell command

## Future Enhancements (Out of Scope)

- Support for other spreadsheet apps (LibreOffice Calc, Google Sheets)
- Windows/Linux support (different shell commands)
- "Open in default app" option
- Recent apps list

## Sprint Completion

All checklist items from sprint-plan.md implemented:

✅ Phase 1: Research (Excel detection, macOS commands)
✅ Phase 2: Planning (Architecture documented)
✅ Phase 3: Implementation
- ✅ SpreadsheetToolbar component
- ✅ SpreadsheetViewer integration
- ✅ Extension message handlers
- ✅ Excel detection logic
- ✅ External app opening

Ready for Phase 4: Testing & Validation
