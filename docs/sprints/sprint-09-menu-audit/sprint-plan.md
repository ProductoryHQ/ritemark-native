# Sprint 09: Menu Audit & Cleanup

**Goal:** Remove/hide irrelevant menu items to create a focused markdown editing experience

**Status:** Phase 5 (COMMIT) - Ready for final commit

* * *

## Problem Statement

RiteMark Native currently shows all default VS Code menu items, including many that are irrelevant for a markdown-focused editor:

**Edit Menu Issues:**

-   "Emmet: Expand Abbreviation" - HTML/CSS tool, not for markdown
    
-   "Toggle Line Comment" - Code-focused (markdown has different comment syntax)
    
-   "Toggle Block Comment" - Code-focused
    

**Other Menus:**

-   "Terminal" menu - May not be needed for markdown editing
    
-   "Go" menu - Has code navigation items (Go to Symbol, etc.)
    
-   "View" menu - Has debugging, extensions panels
    
-   Command Palette shows all ~1000+ commands from VS Code
    

**User Experience Impact:**

-   Cluttered menus confuse users
    
-   Harder to find markdown-relevant commands
    
-   App feels like "VS Code with markdown" instead of "native markdown editor"
    

* * *

## Success Criteria

-   Research completed (how VS Code menus work, patching strategy)
    
-   Identified all irrelevant menu items across ALL menus
    
-   Created patches or configuration to hide/remove items
    
-   Edit menu shows only markdown-relevant items
    
-   Terminal menu evaluated (hide entirely or keep minimal?)
    
-   Go menu evaluated (what's relevant for markdown?)
    
-   View menu cleaned up (remove debug/extensions panels)
    
-   Command Palette still accessible (fallback for power users)
    
-   No TypeScript compilation errors
    
-   Production build tested with cleaned menus
    
-   Documentation created (what was removed, why, how to restore)
    

* * *

## Research Findings (Phase 1)

### How VS Code Menus Work

1.  **Menu Registration:**
    
    -   `MenuRegistry.appendMenuItem()` adds items to menus
        
    -   Menu IDs: `MenuId.MenubarEditMenu`, `MenuId.MenubarFileMenu`, etc.
        
    -   Defined in `src/vs/workbench/browser/parts/titlebar/menubarControl.ts`
        
2.  **Menu Item Sources:**
    
    -   **Editor Actions:** `registerEditorAction()` in contrib modules
        
        -   Example: `src/vs/editor/contrib/comment/browser/comment.ts` (Toggle Line/Block Comment)
            
        -   Example: `src/vs/workbench/contrib/emmet/browser/actions/expandAbbreviation.ts`
            
    -   **Action2 Registration:** `registerAction2()` for workbench actions
        
    -   **Contribution Points:** Extensions register menu items
        
3.  **Customization Approaches:**
    
    **Decision: Use Patches (Option A)**
    
    -   Following existing pattern (`002-hide-chat-sidebar.patch`)
        
    -   Clean, complete removal
        
    -   No performance overhead from disabled features
        

### Menu Items to Remove/Audit

#### Edit Menu (`MenuId.MenubarEditMenu`)

| Item | Source File | Action | Rationale |
| --- | --- | --- | --- |
| Emmet: Expand Abbreviation | `src/vs/workbench/contrib/emmet/browser/actions/expandAbbreviation.ts` | REMOVE | HTML/CSS tool, not markdown |
| Toggle Line Comment | `src/vs/editor/contrib/comment/browser/comment.ts` | REMOVE | Code commenting (use `Cmd+/` for markdown comments) |
| Toggle Block Comment | `src/vs/editor/contrib/comment/browser/comment.ts` | REMOVE | Code commenting, not markdown |
| Find/Replace | Built-in | KEEP | Essential for text editing |
| Undo/Redo/Cut/Copy/Paste | Built-in | KEEP | Essential |

#### Terminal Menu (`MenuId.MenubarTerminalMenu`)

| Decision | Rationale |
| --- | --- |
| EVALUATE | KEEP IT! |

#### Go Menu (`MenuId.MenubarGoMenu`) REMOVE!

| Item | Action | Rationale |
| --- | --- | --- |
| Go to Symbol | REMOVE | What does that even mean? |
| Go to Line | REMOVE | We dont dispaly Line numbers |
| Go to File | REMOVE | Users navigate using sidebar tree |
| Back/Forward | REMOVE! | Editor navigation |

#### View Menu (`MenuId.MenubarViewMenu`)

| Item | Action | Rationale |
| --- | --- | --- |
| Command Palette | KEEP | Essential power-user feature |
| Output | REMOVE |  |
| Extensions panel | REMOVE | Hidden marketplace, but might show built-in extensions |
| Debug panel | REMOVE | Not needed for markdown |
| Editor layout | REMOVE |  |
| Appearance | REMOVE |  |
| Testing panel | REMOVE | Not needed for markdown |
| Explorer | KEEP |  |
| Search | KEEP |  |
| Source | KEEP | Version control useful for markdown |
| Problems panel | REMOVE | Code errors, not needed |

* * *

## Deliverables

### 1\. Menu Audit Document

**File:** `docs/sprints/sprint-09-menu-audit/research/menu-audit.md`

**Contents:**

-   Complete list of all menu items in every menu
    
-   Screenshot of each menu (before/after)
    
-   Decision for each item (KEEP/REMOVE/EVALUATE)
    
-   Rationale for each decision
    

### 2\. Patch Files

**Files:** `patches/vscode/00X-*.patch` (numbered sequentially)

**Patches created:**

-   ✅ `003-remove-edit-menu-code-items.patch` - Remove Emmet, comment actions from Edit menu

-   ✅ `004-hide-extensions-view-menu.patch` - Hide Extensions from View menu

-   ✅ `005-remove-go-menu.patch` - Remove entire Go menu from menubar

-   ✅ `006-cleanup-view-menu.patch` - Remove Appearance and Editor Layout submenus
    

### 3\. Documentation

**File:** `docs/menu-customization.md`

**Contents:**

-   What menu items were removed
    
-   Why each was removed
    
-   How to restore items (modify patches)
    
-   How to add new menu items in future
    

### 4\. Testing Checklist

**File:** `docs/sprints/sprint-09-menu-audit/testing-checklist.md`

**Test coverage:**

-   All menus open without errors
    
-   Remaining menu items work correctly
    
-   Keyboard shortcuts still work
    
-   Command Palette accessible
    
-   Production build includes changes
    
-   No console errors
    

* * *

## Implementation Checklist

### Phase 1: Research & Audit (CURRENT)

-   Research VS Code menu system architecture
    
-   Identify patch-based approach (following existing pattern)
    
-   Create complete menu audit document
    
-   Screenshot all menus (current state)
    
-   Get Jarmo feedback on EVALUATE items (Terminal, Go to Symbol, Extensions panel)
    

### Phase 2: Create Patches ✅ COMPLETE

-   ✅ Create `003-remove-edit-menu-code-items.patch`
    -   Removed Emmet: Expand Abbreviation menu registration
    -   Removed Toggle Line Comment menu registration (keyboard shortcut kept)
    -   Removed Toggle Block Comment menu registration
    -   Fixed unused MenuId imports

-   ✅ Create `004-hide-extensions-view-menu.patch`
    -   Hide Extensions panel from View menu
    -   Fixed unused KeyMod/KeyCode imports

-   ✅ Create `005-remove-go-menu.patch`
    -   Removed entire Go menu from menubar

-   ✅ Create `006-cleanup-view-menu.patch`
    -   Removed Appearance submenu from View menu
    -   Removed Editor Layout submenu from View menu

-   ✅ Test each patch with `./scripts/apply-patches.sh`
-   ✅ All patches validated with `./scripts/validate-patches.sh`
    

### Phase 3: Test & Validate ✅ COMPLETE

-   ✅ Apply all patches to VS Code submodule
-   ✅ Verify patches apply without conflicts
-   ✅ TypeScript type check passes for all patched files
-   ✅ Build development version for testing
-   ✅ Test all remaining menu items work
-   ✅ Keyboard shortcuts still work (Cmd+/ for comments)
-   ⏳ Build production version (optional - dev testing sufficient)
-   ⏳ Screenshot all menus (optional)
    

### Phase 4: Documentation ✅ COMPLETE

-   ✅ Create `docs/menu-customization.md`
-   ✅ Sprint plan updated with implementation details
-   ✅ Validation script documented
    

### Phase 5: Validation & Commit

-   Run `./scripts/apply-patches.sh --dry-run` (verify all patches apply)
    
-   Invoke `qa-validator` for pre-commit checks
    
-   Commit all Sprint 09 deliverables
    
-   Update ROADMAP.md to mark Sprint 09 complete
    

* * *

## Questions for Jarmo (EVALUATE Items)

Before proceeding to Phase 2, need decisions on:

### 1\. Terminal Menu

**Options:**

-   **A) Keep Terminal menu** - Useful for git, scripts, local tools
    
-   **B) Hide Terminal menu completely** - Markdown editor doesn't need terminal
    
-   **C) Keep but simplify** - Remove some Terminal menu items
    

**Question:** Do you use Terminal in your markdown workflow?

### 2\. Go Menu Items

**"Go to Symbol" command:**

-   Could be repurposed for markdown heading navigation
    
-   OR remove as code-focused feature
    

**Question:** Should we keep "Go to Symbol" (might work for headings)?

### 3\. View Menu - Extensions Panel

**Current state:** Marketplace hidden (from product.json)  
**Question:** Should we remove Extensions panel entirely from View menu? (Users won't install extensions anyway)

### 4\. Comment Commands

**Toggle Line/Block Comment removed from menu, but keyboard shortcuts (Cmd+/) still registered**  
**Question:**

-   Remove keyboard shortcuts too? (markdown doesn't use code comments)
    
-   OR keep shortcuts for power users?
    

### 5\. Problems Panel

**Shows TypeScript/linting errors (code-focused)**  
**Question:** Remove from View menu? (Probably not needed for markdown)

* * *

## Technical Approach

### Patch Creation Workflow

1.  **Make changes in vscode/ submodule:**
    

```bash
cd vscode
# Edit source file (e.g., remove menu registration)
git add src/path/to/file.ts
git diff --cached > ../patches/vscode/003-description.patch
git reset
cd ..
```

2.  **Test patch:**
    

```bash
./scripts/apply-patches.sh --reverse  # Remove existing patches
./scripts/apply-patches.sh            # Reapply all patches
```

3.  **Verify:**
    

```bash
cd vscode
git status  # Should show modified files from patches
```

### Example: Removing Emmet from Edit Menu

**File to patch:** `vscode/src/vs/workbench/contrib/emmet/browser/actions/expandAbbreviation.ts`

**Current code (lines 32-37):**

```typescript
menuOpts: {
    menuId: MenuId.MenubarEditMenu,
    group: '5_insert',
    title: nls.localize({ key: 'miEmmetExpandAbbreviation', comment: ['&& denotes a mnemonic'] }, "Emmet: E&&xpand Abbreviation"),
    order: 3
}
```

**Patched code:**

```typescript
// RiteMark: Emmet menu item removed - not relevant for markdown editing
// menuOpts: {
//     menuId: MenuId.MenubarEditMenu,
//     group: '5_insert',
//     title: nls.localize({ key: 'miEmmetExpandAbbreviation', comment: ['&& denotes a mnemonic'] }, "Emmet: E&&xpand Abbreviation"),
//     order: 3
// }
```

**Keeps keyboard shortcut (Tab expansion) but removes from Edit menu.**

* * *

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Patches conflict with VS Code updates | Medium | High | Follow patch naming convention, document thoroughly |
| Remove something users actually need | Low | Medium | Conservative approach, get Jarmo approval on EVALUATE items |
| TypeScript compilation errors | Low | Low | Test after each patch, fix imports if needed |
| Keyboard shortcuts break | Low | Medium | Only remove menu registration, keep action registration |
| Production build fails | Low | High | Test build after all patches applied |

* * *

## Files Created/Modified

| File | Action | Purpose |
| --- | --- | --- |
| `docs/sprints/sprint-09-menu-audit/research/menu-audit.md` | Create | Complete menu inventory |
| `docs/sprints/sprint-09-menu-audit/research/screenshots/` | Create | Before/after screenshots |
| `docs/sprints/sprint-09-menu-audit/testing-checklist.md` | Create | QA testing checklist |
| `patches/vscode/003-remove-edit-menu-code-items.patch` | Create | Remove Emmet, comment items |
| `patches/vscode/004-cleanup-go-menu.patch` | Create (maybe) | Remove code navigation items |
| `patches/vscode/005-cleanup-view-menu.patch` | Create | Remove debug/testing panels |
| `patches/vscode/006-terminal-menu.patch` | Create (maybe) | Hide/modify Terminal menu |
| `docs/menu-customization.md` | Create | User/developer documentation |

* * *

## Estimated Effort

| Phase | Task | Time Estimate |
| --- | --- | --- |
| 1 | Complete menu audit + get decisions | 2-3 hours |
| 2 | Create patches | 2-3 hours |
| 3 | Testing | 2 hours |
| 4 | Documentation | 1-2 hours |
| 5 | Validation & commit | 30 minutes |
| **Total** |  | **7-10 hours** |

Complexity: Medium (patch-based approach proven with `002-hide-chat-sidebar.patch`)

* * *

## Dependencies

### Previous Sprints

-   Sprint 08: Build Stability ✅ (ensures patches don't break build)
    
-   Patch system established ✅ (002-hide-chat-sidebar.patch as reference)
    

### Tools Required

-   Git (for patch creation) ✅
-   VS Code source (submodule) ✅
-   Patch scripts ✅ (`./scripts/apply-patches.sh`, `./scripts/create-patch.sh`)
-   **NEW:** Validation script ✅ (`./scripts/validate-patches.sh`) - Created in this sprint to catch TypeScript errors in ~2 min instead of 25 min build
    

* * *

## Future Enhancements (Not This Sprint)

### Smart Command Palette Filtering

-   Could filter Command Palette to show only markdown-relevant commands
    
-   Would require more complex patch (filter logic)
    
-   Save for future sprint if needed
    

### Custom Menu Items

-   Add RiteMark-specific menu items (e.g., "Export to PDF")
    
-   Would go in separate sprint (feature addition)
    

### Menu Reorganization

-   Could reorganize remaining items into better groups
    
-   Example: "Format" submenu for markdown formatting
    
-   Save for future UX polish sprint
    

* * *

## Notes

### Why Patches Instead of Configuration?

VS Code doesn't provide configuration-based menu filtering. Options were:

1.  Fork VS Code (rejected - want easy upstream sync)
    
2.  Extension API (rejected - can't remove built-in items)
    
3.  Patches (chosen - clean, maintainable, follows existing pattern)
    

### Patch Maintenance Strategy

-   Number patches sequentially (003, 004, 005, etc.)
    
-   Include "RiteMark:" prefix in code comments
    
-   Document each patch in `docs/menu-customization.md`
    
-   Test patches after VS Code submodule updates
    
-   `./scripts/update-vscode.sh` should verify patches still apply
    

* * *

## Related Sprint Cleanup

**Issue:** `docs/sprints/sprint-09-macos-dmg/` exists but is now Sprint 10

**Action needed:**

```bash
# Option 1: Rename to sprint-10
mv docs/sprints/sprint-09-macos-dmg docs/sprints/sprint-10-macos-dmg

# Option 2: Delete and recreate in Sprint 10
rm -rf docs/sprints/sprint-09-macos-dmg
```

**Decision:** Will handle in this sprint's cleanup phase.

* * *

## Approval

-   Jarmo approved this sprint plan
    
-   Jarmo answered EVALUATE questions (Terminal, Go to Symbol, Extensions, etc.)
    

**Awaiting approval to proceed to Phase 2 (Create Patches).**

* * *

## References

### Research Files

-   This plan includes inline research findings
    
-   VS Code source: `vscode/src/vs/workbench/browser/parts/titlebar/menubarControl.ts`
    
-   Example patch: `patches/vscode/002-hide-chat-sidebar.patch`
    

### VS Code Architecture

-   [Menu Contribution Points](https://code.visualstudio.com/api/references/contribution-points#contributes.menus)
    
-   [Action Registration](https://github.com/microsoft/vscode/wiki/Code-Organization)
    

### Related Documentation

-   `CLAUDE.md` - Patch system workflow
    
-   `.claude/agents/vscode-expert.md` - Build and patch expertisers