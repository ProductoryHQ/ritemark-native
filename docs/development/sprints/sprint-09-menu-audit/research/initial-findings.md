# Initial Menu Audit Findings

**Sprint:** 09 - Menu Audit & Cleanup
**Date:** 2025-12-08
**Status:** Phase 1 (Research)

---

## Research Summary

### How VS Code Menus Work

VS Code uses a **menu registry system** where components register menu items programmatically:

1. **Menu Registration Points:**
   - `MenuRegistry.appendMenuItem()` - Core API
   - `registerEditorAction()` - Editor-specific actions (with optional menu registration)
   - `registerAction2()` - Workbench actions

2. **Menu IDs (from `menubarControl.ts`):**
   - `MenuId.MenubarFileMenu`
   - `MenuId.MenubarEditMenu`
   - `MenuId.MenubarSelectionMenu`
   - `MenuId.MenubarViewMenu`
   - `MenuId.MenubarGoMenu`
   - `MenuId.MenubarTerminalMenu`
   - `MenuId.MenubarHelpMenu`
   - `MenuId.MenubarPreferencesMenu` (macOS only)

3. **Menu Item Structure:**
```typescript
menuOpts: {
    menuId: MenuId.MenubarEditMenu,  // Which menu
    group: '5_insert',                // Grouping (with separators)
    title: localize(...),             // Display text
    order: 3                          // Position in group
}
```

---

## Customization Strategy: Patches

**Decision:** Use patch files (following `002-hide-chat-sidebar.patch` pattern)

### Why Patches?

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Patches** | Clean removal, no runtime cost, follows existing pattern | Needs maintenance on VS Code updates | ✅ CHOSEN |
| **Context Keys** | Non-destructive, toggleable | Items still registered, runtime overhead | ❌ Not needed |
| **product.json** | Simple config | Doesn't support menu filtering | ❌ Not possible |

### Patch Creation Process

1. Edit file in `vscode/` submodule
2. Create patch: `git diff --cached > ../patches/vscode/00X-name.patch`
3. Apply patches: `./scripts/apply-patches.sh`
4. Test build

---

## Menu Items Analysis

### Edit Menu - Items to Remove

#### 1. Emmet: Expand Abbreviation
- **Source:** `vscode/src/vs/workbench/contrib/emmet/browser/actions/expandAbbreviation.ts`
- **Purpose:** HTML/CSS abbreviation expansion (e.g., `div>ul>li` → HTML)
- **Relevant to Markdown?** ❌ No
- **Action:** REMOVE from menu (lines 32-37)
- **Note:** Keep keyboard shortcut (Tab) - might be disabled anyway

#### 2. Toggle Line Comment
- **Source:** `vscode/src/vs/editor/contrib/comment/browser/comment.ts`
- **Purpose:** Toggle `//` or `#` comments for code
- **Relevant to Markdown?** ❌ Markdown uses HTML comments `<!-- -->`
- **Action:** REMOVE from menu (line 94-98)
- **Keyboard:** Cmd+/ - Decision needed (remove or keep?)

#### 3. Toggle Block Comment
- **Source:** `vscode/src/vs/editor/contrib/comment/browser/comment.ts`
- **Purpose:** Toggle `/* */` block comments for code
- **Relevant to Markdown?** ❌ No
- **Action:** REMOVE from menu (line 149-154)
- **Keyboard:** Shift+Alt+A (macOS) - Decision needed

### Edit Menu - Items to Keep

- Find/Replace (essential)
- Undo/Redo (essential)
- Cut/Copy/Paste (essential)
- Select All (essential)

---

## Other Menus - Needs Jarmo Input

### Terminal Menu
**Current:** Full Terminal menu with all commands

**Options:**
- **Keep:** Useful for git, local scripts, markdown processors
- **Remove:** Markdown editor doesn't need terminal
- **Simplify:** Keep basic terminal, remove advanced features

**Question for Jarmo:** Do you use Terminal for markdown workflow?

---

### Go Menu
**Current:** Code-focused navigation (Go to Symbol, etc.)

**Items to evaluate:**
- **Go to Symbol** - Could work for markdown headings OR remove
- **Go to Line** - KEEP (useful for long docs)
- **Go to File** - KEEP (essential)
- **Back/Forward** - KEEP (navigation)

**Question for Jarmo:** Should Go to Symbol work for markdown headings?

---

### View Menu
**Current:** Shows all panels (Debug, Testing, Extensions, Problems, etc.)

**Items to remove:**
- Debug panel ❌ (not needed)
- Testing panel ❌ (not needed)
- Problems panel ❌ (code linting, not needed)

**Items to evaluate:**
- Extensions panel - Marketplace hidden, but panel still shows built-in extensions
  - **Question:** Remove completely?

**Items to keep:**
- Command Palette ✅ (essential)
- SCM/Git panel ✅ (version control)
- Explorer ✅ (file browser)

---

## Source File Locations

### Files to Patch

| Menu Item | Source File | Lines |
|-----------|-------------|-------|
| Emmet: Expand Abbreviation | `vscode/src/vs/workbench/contrib/emmet/browser/actions/expandAbbreviation.ts` | 32-37 |
| Toggle Line Comment | `vscode/src/vs/editor/contrib/comment/browser/comment.ts` | 94-98 |
| Toggle Block Comment | `vscode/src/vs/editor/contrib/comment/browser/comment.ts` | 149-154 |
| Terminal menu items | `vscode/src/vs/workbench/contrib/terminal/browser/terminalMenus.ts` | TBD |
| View menu panels | Multiple contribution files | TBD |
| Go menu items | `vscode/src/vs/workbench/browser/parts/editor/editorActions.ts` | TBD |

---

## Example Patch (Emmet Removal)

**Before:**
```typescript
menuOpts: {
    menuId: MenuId.MenubarEditMenu,
    group: '5_insert',
    title: nls.localize({ key: 'miEmmetExpandAbbreviation', comment: ['&& denotes a mnemonic'] }, "Emmet: E&&xpand Abbreviation"),
    order: 3
}
```

**After:**
```typescript
// Ritemark: Emmet menu item removed - not relevant for markdown editing
// menuOpts: {
//     menuId: MenuId.MenubarEditMenu,
//     group: '5_insert',
//     title: nls.localize({ key: 'miEmmetExpandAbbreviation', comment: ['&& denotes a mnemonic'] }, "Emmet: E&&xpand Abbreviation"),
//     order: 3
// }
```

**Effect:** Action still registered (keyboard shortcut works if configured), but removed from Edit menu.

---

## Next Steps

1. **Get Jarmo decisions on:**
   - Terminal menu (keep/remove/simplify)
   - Go to Symbol (keep for headings or remove)
   - Extensions panel in View menu
   - Comment keyboard shortcuts (Cmd+/, Shift+Alt+A)
   - Problems panel (remove?)

2. **Create detailed menu audit:**
   - Screenshot all menus (before state)
   - List every item in every menu
   - Document final decision for each

3. **Create patches:**
   - `003-remove-edit-menu-code-items.patch`
   - `004-cleanup-view-menu.patch`
   - Others based on decisions

4. **Test and validate:**
   - Apply patches
   - Build dev + production
   - Verify menus work correctly
   - Screenshot after state

---

## Reference: Existing Patch Pattern

From `patches/vscode/002-hide-chat-sidebar.patch`:

**Pattern observed:**
- Comment out registration code
- Add "Ritemark:" prefix to comments
- Keep code readable (commented, not deleted)
- Can be easily reversed if needed

**Example:**
```typescript
// Ritemark: Chat sidebar registration removed - not needed without Copilot
// this._viewContainer = this.registerViewContainer();
// this.registerDefaultParticipantView();
```

**We'll follow this same pattern for menu cleanup.**

---

## Technical Notes

### Menu Groups
Menus use groups with numeric prefixes for ordering:
- `1_` - First group
- `2_` - Second group
- `5_insert` - Insert group in Edit menu
- etc.

### Localization
All menu titles use `nls.localize()` for i18n:
```typescript
title: nls.localize({ key: 'miEmmet...', comment: [...] }, "Label")
```

### Context Keys
Menu items can have `when` clauses:
```typescript
when: EditorContextKeys.writable
```

We're removing items completely, so don't need context key filtering.

---

## Files Created This Phase

- `docs/sprints/sprint-09-menu-audit/sprint-plan.md` ✅
- `docs/sprints/sprint-09-menu-audit/research/initial-findings.md` ✅ (this file)

**Next:** Await Jarmo approval + decisions on EVALUATE items.
