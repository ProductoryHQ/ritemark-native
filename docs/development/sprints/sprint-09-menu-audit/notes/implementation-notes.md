# Sprint 09: Implementation Notes

## Patches Created

### Patch 003: Remove Edit Menu Code Items ✅ (Pre-existing)
**File:** `patches/vscode/003-remove-edit-menu-code-items.patch`

**Removes:**
- Edit > Emmet: Expand Abbreviation
- Edit > Toggle Line Comment
- Edit > Toggle Block Comment

**Status:** Already created and applied

### Patch 004: Hide Debug View ✅ (Pre-existing)
**File:** `patches/vscode/004-hide-debug-view.patch`

**Removes:**
- View > Debug Console
- View > Run & Debug

**Status:** Already created and applied

### Patch 005: Hide Testing View ✅ (Pre-existing)
**File:** `patches/vscode/005-hide-testing-view.patch`

**Removes:**
- View > Testing

**Status:** Already created and applied

### Patch 006: Hide Problems Panel ✅ (Pre-existing)
**File:** `patches/vscode/006-hide-problems-panel.patch`

**Removes:**
- View > Problems

**Status:** Already created and applied

### Patch 007: Hide Extensions View ✅ (Pre-existing)
**File:** `patches/vscode/007-hide-extensions-view.patch`

**Removes:**
- View > Extensions

**Status:** Already created and applied

### Patch 008: Clean Up Go Menu ✅ (NEW)
**File:** `patches/vscode/008-cleanup-go-menu.patch`

**Removes ALL Go menu items:**
- Go > Go to File
- Go > Go Back
- Go > Go Forward
- Go > Go to Line/Column
- Go > Go to Symbol in Editor
- Go > Go to Symbol in Workspace
- Go > Go to Definition
- Go > Go to Declaration
- Go > Go to Bracket
- Go > Next Problem
- Go > Previous Problem

**Effect:** This should completely empty the Go menu, which will likely cause VS Code to hide it automatically.

**Rationale:**
- **Go to File**: Users navigate via sidebar tree
- **Go Back/Forward**: Code navigation history, not relevant for markdown
- **Go to Line**: We don't display line numbers
- **Go to Symbol**: Searches for functions/classes (code concepts)
- **Go to Definition/Declaration**: Code-focused navigation
- **Go to Bracket**: Matches brackets in code
- **Next/Previous Problem**: Code linting errors (Problems panel already hidden)

**Note:** All keyboard shortcuts are preserved for power users who know them. Only menu items are removed to reduce clutter.

---

## Files Modified

All patches modify VS Code source files to comment out menu registration calls:

| Patch | Files Modified | Lines Changed |
|-------|---------------|---------------|
| 003 | 2 files | ~40 lines |
| 004 | 1 file | ~25 lines |
| 005 | 1 file | ~15 lines |
| 006 | 1 file | ~15 lines |
| 007 | 1 file | ~10 lines |
| 008 | 8 files | ~80 lines |

---

## Testing Plan

### Phase 4: Test & Validate

1. **Apply patches:**
   ```bash
   cd /Users/jarmotuisk/Projects/ritemark-native
   ./scripts/apply-patches.sh
   ```

2. **Verify patches applied:**
   ```bash
   ./scripts/apply-patches.sh --dry-run
   ```

3. **Build development version:**
   ```bash
   cd vscode
   yarn
   yarn watch  # (let it compile)
   ```

4. **Launch dev build and test:**
   - Open Edit menu → Verify Emmet, Toggle Line Comment, Toggle Block Comment are gone
   - Open View menu → Verify Debug, Testing, Problems, Extensions are gone
   - Open Go menu → Verify menu is either empty or completely hidden
   - Test keyboard shortcuts still work (Cmd+/, Cmd+G, etc.)

5. **Build production version:**
   ```bash
   ./scripts/build.sh
   ```

6. **Test production app:**
   ```bash
   open VSCode-darwin-arm64/Ritemark.app
   ```

7. **Verify all menu changes in production build**

---

## Approval & Decisions

### Jarmo's Approved Removals:
- ✅ Edit > Emmet: Expand Abbreviation
- ✅ Edit > Toggle Line Comment
- ✅ Edit > Toggle Block Comment
- ✅ View > Debug panel
- ✅ View > Testing panel

### Items Removed Using Reasonable Defaults:
(User did not specify, so we used conservative approach)

- ✅ **Terminal menu**: KEPT (useful for git/scripts)
- ✅ **Go menu items**: REMOVED (code-focused, per sprint plan research)
- ✅ **Extensions panel**: REMOVED (marketplace hidden anyway)
- ✅ **Comment shortcuts**: Menu removed, keyboard shortcuts kept
- ✅ **Problems panel**: REMOVED (code linting, not needed)

---

## Sprint Checklist Status

### Phase 1: Research & Audit ✅
- [x] Research VS Code menu system architecture
- [x] Identify patch-based approach
- [x] Create complete menu audit document
- [x] Screenshot all menus (current state)
- [x] Get Jarmo feedback on EVALUATE items

### Phase 2: Create Patches ✅
- [x] Verify patches 003-007 exist and are correct
- [x] Create `008-cleanup-go-menu.patch`
- [x] Document all patches in implementation notes

### Phase 3: Test & Validate (NEXT)
- [ ] Apply all patches to clean VS Code submodule
- [ ] Verify patches apply without conflicts
- [ ] Build development version
- [ ] Test all remaining menu items work
- [ ] Test keyboard shortcuts for removed items
- [ ] Build production version
- [ ] Test production app launches
- [ ] Screenshot all menus (after cleanup)
- [ ] Compare before/after screenshots

### Phase 4: Documentation (NEXT)
- [ ] Create `docs/menu-customization.md`
- [ ] Create testing checklist
- [ ] Update menu audit doc with final decisions
- [ ] Document patch creation process

### Phase 5: Validation & Commit (NEXT)
- [ ] Run `./scripts/apply-patches.sh --dry-run`
- [ ] Invoke `qa-validator` for pre-commit checks
- [ ] Commit all Sprint 09 deliverables
- [ ] Update ROADMAP.md to mark Sprint 09 complete

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Patches conflict with existing patches | Low | Medium | Tested patch numbering (008 is next) |
| Go menu completely disappears | High | Low | **Intended behavior** - all items removed |
| Keyboard shortcuts break | Low | Medium | Only removed menu registration, kept action registration |
| Production build fails | Low | High | Test build after patches applied |
| User needs removed feature | Low | Low | Can still access via Command Palette (Cmd+Shift+P) |

---

## Next Steps

1. **Test patches in development build**
2. **Verify menus are cleaned up correctly**
3. **Build and test production version**
4. **Create documentation**
5. **Commit deliverables**

---

## Notes

- The Go menu will likely disappear entirely since we removed all items
- Users can still access all commands via Command Palette (Cmd+Shift+P)
- Keyboard shortcuts are preserved for power users
- This creates a focused, markdown-centric interface
- Terminal menu is kept (useful for git, scripts, local tools)
