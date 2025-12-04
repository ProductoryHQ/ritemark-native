# VS Code UI Components Research

**Sprint 04 Research Phase**
**Date:** 2025-12-01

---

## Summary Table

| Component | File Path | Hide/Remove Strategy |
|-----------|-----------|---------------------|
| **Accounts Icon** | `globalCompositeBar.ts:106` | Comment out `accountAction` push |
| **Manage/Settings Icon** | `globalCompositeBar.ts:109` | Skip `globalActivityAction` push |
| **Language Mode** | `editorStatus.ts` | `updateEntryVisibility(id, false)` |
| **Encoding** | `editorStatus.ts` | `updateEntryVisibility(id, false)` |
| **EOL (Line Endings)** | `editorStatus.ts` | `updateEntryVisibility(id, false)` |
| **Spaces/Tabs** | `editorStatus.ts` | `updateEntryVisibility(id, false)` |
| **Debug/Run Menu** | `debug.contribution.ts:242-249` | Comment `MenuRegistry.appendMenuItem` |
| **Terminal Menu** | `menubarControl.ts:98-106` | Comment menu registration |
| **Terminal Panel** | `terminal.contribution.ts:127-152` | Comment `registerViewContainer` |
| **Window Title** | `product.json` | Already branded "RiteMark" |

---

## 1. Activity Bar (Left Sidebar Icons)

**Location:** `/vscode/src/vs/workbench/browser/parts/activitybar/`

### Key Files
- `activitybarPart.ts` - Main activity bar container
- `globalCompositeBar.ts` - Global items (Accounts, Settings)

### Accounts Icon
- **File:** `globalCompositeBar.ts` line 51
- **Icon:** `registerIcon('accounts-view-bar-icon', Codicon.account, ...)`
- **Activity ID:** `ACCOUNTS_ACTIVITY_ID = 'workbench.actions.accounts'`
- **Hide:** Comment line 106 (accountAction push)

### Settings/Manage Icon (Gear)
- **File:** `globalCompositeBar.ts`
- **Activity ID:** `GLOBAL_ACTIVITY_ID = 'workbench.actions.manage'`
- **Hide:** Comment line 109 (globalActivityAction push)

---

## 2. Status Bar (Bottom Bar)

**Location:** `/vscode/src/vs/workbench/browser/parts/statusbar/`

### Key Files
- `statusbarPart.ts` - Main status bar
- `statusbarModel.ts` - Entry visibility
- `editorStatus.ts` - Language, encoding, EOL, indent indicators

### Status Bar Items in editorStatus.ts
All registered via `StatusbarViewModel`:
- Language Mode (right side)
- Encoding (right side)
- EOL / Line Endings (right side)
- Indent / Spaces/Tabs (right side)

### How to Hide
```typescript
statusbarService.updateEntryVisibility(id, false)
```

Or comment out entry registration in `editorStatus.ts`.

### Global Status Bar
- Config: `workbench.statusBar.visible`
- Toggle: `ToggleStatusbarVisibilityAction` in `layoutActions.ts`

---

## 3. Menus (Top Menu Bar)

**Location:** `/vscode/src/vs/workbench/browser/parts/titlebar/menubarControl.ts`

### Menu Structure (lines 48-127)
```
File (order 1)      → MenuId.MenubarFileMenu
Edit (order 2)      → MenuId.MenubarEditMenu
Selection (order 3) → MenuId.MenubarSelectionMenu
View (order 4)      → MenuId.MenubarViewMenu
Go (order 5)        → MenuId.MenubarGoMenu
Run (order 6)       → MenuId.MenubarDebugMenu  ← "Debug" renamed to "Run"
Terminal (order 7)  → MenuId.MenubarTerminalMenu
Help (order 8)      → MenuId.MenubarHelpMenu
```

### Debug/Run Menu
- **File:** `debug.contribution.ts` lines 242-249
- **Hide:** Comment out `MenuRegistry.appendMenuItem()` call

### Terminal Menu
- **File:** `menubarControl.ts` lines 98-106
- **Hide:** Comment out registration

---

## 4. Panel Area (Terminal, Problems, Output)

**Location:** `/vscode/src/vs/workbench/browser/parts/panel/`

### Terminal Panel Registration
- **File:** `terminal.contribution.ts` lines 127-152
- **View ID:** `TERMINAL_VIEW_ID` from `terminal/common/terminal.ts`

### How to Disable Terminal
Comment out in `terminal.contribution.ts`:
```typescript
// registerViewContainer()
// registerViews()
```

---

## 5. Title Bar

**Location:** `/vscode/src/vs/workbench/browser/parts/titlebar/`

### Key Files
- `titlebarPart.ts` - Layout
- `windowTitle.ts` - Title text

### Window Title Template (windowTitle.ts:33-49)
```typescript
// macOS native:
'${activeEditorShort}${separator}${rootName}${separator}${profileName}'

// Other platforms:
'${dirty}${activeEditorShort}${separator}${rootName}...${appName}'
```

### Branding
**Already done in product.json:**
```json
{
  "nameShort": "RiteMark",
  "nameLong": "RiteMark Native",
  "applicationName": "ritemark",
  "appName": "RiteMark"
}
```

---

## Implementation Priority for RiteMark

### HIDE (High Priority)
1. Accounts icon - `globalCompositeBar.ts:106`
2. Debug/Run menu - `debug.contribution.ts:242-249`
3. Terminal menu - `menubarControl.ts:98-106`
4. Terminal panel - `terminal.contribution.ts:127-152`
5. Status bar items: Language, Encoding, EOL - `editorStatus.ts`

### KEEP
- Activity bar (Explorer, Search, SCM)
- File, Edit, View, Help menus
- Status bar (line/column, git branch)

### CONSIDER
- Settings gear - keep for now (useful for users)
- Panel area - keep but without Terminal

---

## Files to Modify

```
vscode/src/vs/workbench/browser/parts/
├── activitybar/
│   └── globalCompositeBar.ts      ← Accounts, Settings icons
├── statusbar/
│   └── editorStatus.ts            ← Language, Encoding, EOL, Indent
├── titlebar/
│   └── menubarControl.ts          ← Terminal menu
└── panel/
    └── (already handled by view hiding)

vscode/src/vs/workbench/contrib/
├── debug/browser/
│   └── debug.contribution.ts      ← Debug/Run menu
└── terminal/browser/
    └── terminal.contribution.ts   ← Terminal panel
```
