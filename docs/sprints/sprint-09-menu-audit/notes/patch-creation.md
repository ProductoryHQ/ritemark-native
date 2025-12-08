# Sprint 09: Patch Creation Notes

## Created Patches

### 003-remove-edit-menu-code-items.patch
**Purpose:** Remove code-focused items from Edit menu

**Changes:**
- Removed "Emmet: Expand Abbreviation" menu item (HTML/CSS tool, not for markdown)
- Removed "Toggle Line Comment" menu item (code comments, not markdown comments)
- Removed "Toggle Block Comment" menu item (code comments, not markdown comments)

**Files modified:**
- `src/vs/editor/contrib/comment/browser/comment.ts`
- `src/vs/workbench/contrib/emmet/browser/actions/expandAbbreviation.ts`

**Note:** Keyboard shortcuts still work, only menu items removed

---

### 004-hide-debug-view.patch
**Purpose:** Remove Debug views from View menu

**Changes:**
- Removed "Debug Console" panel from View menu
- Removed "Run and Debug" sidebar from View menu
- Commented out `openCommandActionDescriptor` for both views

**Files modified:**
- `src/vs/workbench/contrib/debug/browser/debug.contribution.ts`

**Note:** Views already have `hideIfEmpty: true` and Run/Debug menu was already hidden

---

### 005-hide-testing-view.patch
**Purpose:** Remove Testing view from View menu

**Changes:**
- Removed "Testing" sidebar from View menu
- Commented out `openCommandActionDescriptor`

**Files modified:**
- `src/vs/workbench/contrib/testing/browser/testing.contribution.ts`

**Note:** View container already had `hideIfEmpty: true`

---

### 006-hide-problems-panel.patch
**Purpose:** Remove Problems panel from View menu

**Changes:**
- Removed "Problems" panel from View menu
- Commented out `openCommandActionDescriptor`

**Files modified:**
- `src/vs/workbench/contrib/markers/browser/markers.contribution.ts`

**Note:** Problems panel shows code linting errors, not relevant for markdown

---

### 007-hide-extensions-view.patch
**Purpose:** Remove Extensions view from View menu

**Changes:**
- Removed "Extensions" sidebar from View menu
- Commented out `openCommandActionDescriptor`

**Files modified:**
- `src/vs/workbench/contrib/extensions/browser/extensions.contribution.ts`

**Note:** Marketplace is already hidden in product.json, so this view is not useful

---

## Pattern Used

All patches follow the same pattern:
1. Add RiteMark comment explaining why the change was made
2. Comment out the menu registration code (don't delete it)
3. Keep the view container registration intact
4. Use `hideIfEmpty: true` where applicable
5. Keep functionality intact (keyboard shortcuts still work)

## Rationale

These changes support RiteMark's goal of being a **focused markdown editor**, not a general-purpose code editor. By removing code-specific menu items:

- Edit menu shows only text editing commands
- View menu shows only markdown-relevant views (Explorer, Search, Source Control)
- Terminal menu is kept (useful for git commands and scripts)
- Command Palette remains accessible for power users

## What's Kept

**From Edit Menu:**
- Undo/Redo
- Cut/Copy/Paste
- Find/Replace
- All text editing commands

**From View Menu:**
- Command Palette
- Explorer
- Search
- Source Control
- Output
- Terminal (kept as requested)

**From Go Menu:**
- Removed entirely (was code navigation focused)

## Next Steps

1. Apply patches: `./scripts/apply-patches.sh`
2. Test in dev mode: `cd vscode && ./scripts/code.sh`
3. Verify menus show only relevant items
4. Build production version
5. Test production build
6. Document changes
