# Patch Rules -- Lessons from the Consolidation Disaster

This document captures hard-won knowledge from the patch consolidation incident where 38 of 45 patched files were silently lost during a merge of patch 007 into patch 003, causing a full day of UI regressions.

---

## 1. Patch Architecture (Current State)

Six patches, numbered 001 through 006, each owning a specific domain:

| Patch | Domain | Summary |
|-------|--------|---------|
| `001-ritemark-branding.patch` | Branding | Theme, fonts, icons, welcome page, about dialog, breadcrumbs |
| `002-ritemark-ui-layout.patch` | UI Layout | Sidebar, titlebar, tabs, explorer, panels, Cmd+B removal |
| `003-ritemark-menu-cleanup.patch` | Menu Cleanup + OSS Fixes | 14 files -- Go/Terminal/Run menus hidden, Edit menu cleaned, Chat/Debug/Extensions hidden, defaultChatAgent null-safety |
| `004-ritemark-build-system.patch` | Build System | jschardet, microphone permission, integrity check skip |
| `005-ritemark-windows-and-oss-fixes.patch` | Windows + OSS | Windows-specific and OSS compatibility fixes |
| `006-ritemark-dev-launch-fallback.patch` | Dev Launch | Development launch fallback behavior |

**Rule:** Patches must not overlap in domain. Each file belongs to exactly one patch.

---

## 2. Patch 003 Complete File Inventory (14 Files)

This is the authoritative reference. If ANY file is missing after a future patch change, it is a regression.

| # | File Path | What It Does |
|---|-----------|-------------|
| 1 | `src/vs/editor/contrib/comment/browser/comment.ts` | Removes Toggle Line Comment and Toggle Block Comment from Edit menu. Removes `MenuId` import. |
| 2 | `src/vs/platform/actions/common/actions.ts` | Adds `MenubarViewMenuAdvanced` MenuId for advanced submenu in View menu. |
| 3 | `src/vs/platform/extensionManagement/common/abstractExtensionManagementService.ts` | Null-safety: `defaultChatAgent?.extensionId` (prevents crash when defaultChatAgent is undefined in OSS builds). |
| 4 | `src/vs/platform/extensionManagement/common/extensionGalleryService.ts` | Null-safety: `defaultChatAgent?.extensionId` in gallery filtering and deprecation logic. Three separate locations patched. |
| 5 | `src/vs/workbench/browser/parts/editor/editor.contribution.ts` | Removes Editor Layout submenu from View menu (not relevant for markdown editing). |
| 6 | `src/vs/workbench/browser/parts/titlebar/menubarControl.ts` | Removes Go menu and Terminal menu from the menu bar. Comments out both `MenuRegistry.appendMenuItem` calls. |
| 7 | `src/vs/workbench/contrib/chat/browser/chatParticipant.contribution.ts` | Disables Chat view: sets `isDefault=false`, hides via `ritemark.chatDisabled` context key, unregisters view from ViewsRegistry. Uses `void` to suppress unused variable errors. |
| 8 | `src/vs/workbench/contrib/chat/browser/chatStatus/chatStatusEntry.ts` | Hides Copilot status bar icon. Disposes entry immediately in `update()`. Renames `getEntryProps` to `_getEntryProps`, removes `StatusbarAlignment` import. |
| 9 | `src/vs/workbench/contrib/debug/browser/debug.contribution.ts` | Hides Run/Debug menu from menu bar. Adds `hideIfEmpty: true` to debug view container. Changes debug welcome view condition from `'simple'` to `'never-show'` to prevent Run and Debug from appearing in activity bar. |
| 10 | `src/vs/workbench/contrib/emmet/browser/actions/expandAbbreviation.ts` | Removes Emmet: Expand Abbreviation from Edit menu. Removes `MenuId` import. |
| 11 | `src/vs/workbench/contrib/extensions/browser/extensions.contribution.ts` | Removes Extensions entry from View menu by commenting out `openCommandActionDescriptor`. Removes unused `KeyCode`, `KeyMod` imports. |
| 12 | `src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts` | Null-safety: `defaultChatAgent?.extensionId` in uninstall logic. |
| 13 | `src/vs/workbench/services/extensionManagement/browser/extensionEnablementService.ts` | Null-safety: `extensionId?.toLowerCase()` and `chatExtensionId?.toLowerCase()` to prevent crash in OSS builds. |
| 14 | `src/vs/workbench/services/inlineCompletions/common/inlineCompletionsUnification.ts` | Null-safety: same `extensionId?.toLowerCase()` pattern as #13. |

**Verification command:**
```bash
grep '^diff --git' patches/vscode/003-ritemark-menu-cleanup.patch | wc -l
# Must show: 14
```

---

## 3. Menu Bar Expected State

| Menu | Visible? | Notes |
|------|----------|-------|
| Ritemark (app menu) | YES | macOS app menu |
| File | YES | Standard file operations |
| Edit | YES | Cleaned: no Toggle Comment, no Block Comment, no Emmet Expand Abbreviation |
| Selection | YES | Standard selection operations |
| View | YES | Cleaned: no Appearance submenu, no Editor Layout submenu, no Extensions entry |
| Go | NO | Entire menu removed (menubarControl.ts) |
| Run | NO | Entire menu removed (debug.contribution.ts) |
| Terminal | NO | Entire menu removed (menubarControl.ts) |
| Window | YES | Standard window operations |
| Help | YES | Cleaned of VS Code specific items |

---

## 4. Title Bar Expected State

| Element | Visible? | Notes |
|---------|----------|-------|
| Left sidebar toggle | YES | File explorer toggle |
| Right sidebar toggle | YES | AI panel / terminal toggle |
| Settings gear | YES | Opens settings |
| Chat sparkle icon | NO (goal) | Currently still visible -- known issue. Patch 003 sets `isDefault=false` and unregisters view, but icon may persist from cache. |
| Accounts icon | NO | Hidden by patch 002 |
| Panel toggle | NO | Hidden by patch 002 |

---

## 5. Sidebar Expected State

| Item | Visible? | Notes |
|------|----------|-------|
| Explorer / Project | YES | Primary navigation |
| Search | YES | Full-text search |
| Run and Debug | NO | `hideIfEmpty: true` + welcome view condition set to `'never-show'` (patch 003) |
| Extensions | YES | Marketplace works, but removed from View menu |

---

## 6. Status Bar Expected State

| Element | Visible? | Notes |
|---------|----------|-------|
| Copilot icon | NO | `chatStatusEntry.ts` disposes entry immediately (patch 003) |

---

## 7. Keybinding Overrides

| Keybinding | Default VS Code Behavior | Ritemark Behavior | Enforced By |
|------------|--------------------------|-------------------|-------------|
| Cmd+B | Toggle sidebar | Bold text (TipTap) | Patch 002 removes the keybinding |

---

## 8. Consolidation Rules (NEVER VIOLATE)

These rules exist because violating them caused a full day of regressions.

### Before consolidation

1. **Count files in old patch:** `grep '^diff --git' patches/vscode/OLD.patch | wc -l`
2. **List every file in old patch:** `grep '^diff --git' patches/vscode/OLD.patch`
3. **Save these counts and lists** -- you will compare against the new patch.

### During consolidation

4. **For EVERY file in the old patch, verify the change is preserved in the new patch.** Do not assume any change is "handled by another patch" without explicitly checking.
5. **Never silently drop files.** If a file is intentionally removed, document why.
6. **Test-apply before committing:** `git apply --check patches/vscode/NEW.patch`

### After consolidation

7. **Count files in new patch** and compare against the sum of old patches.
8. **Diff the file lists** -- old vs new. Every file must be accounted for.
9. **Test the FULL UI** (see Section 10 below).

### Why this matters

The consolidation disaster happened because `git diff` was run on a subset of files, silently dropping 38 of 45 patched files. There was no validation step to compare old vs new file counts. The loss was not detected until visual testing revealed menus reappearing, keybindings breaking, and sidebar icons returning.

---

## 9. Common Build Failures

### "declared but never read"

VS Code's strict TypeScript build treats unused imports and variables as errors. The build takes approximately 22 minutes, so catching these early is critical.

**When commenting out code in patches:**
- ALWAYS remove imports that become unused
- ALWAYS remove variables/methods that become unused
- Check for cascading unused references (removing one call may leave its imports unused)

### Suppressing unused errors

| Technique | Works? | Example |
|-----------|--------|---------|
| Remove the import | YES | Delete the import line entirely |
| `void variable;` | YES | `void chatViewContainer;` |
| Underscore prefix on constructor DI params | YES | `private readonly _statusbarService` |
| Underscore prefix on local variables | NO | Does NOT suppress in VS Code's build config |

### `out/` directory gotcha

In dev mode (`./scripts/code.sh`), VS Code serves from `out/`, not `src/`. TypeScript auto-compiles to `out/`, but CSS and static assets do NOT auto-copy. After editing CSS or adding fonts, you must manually copy them:
```bash
cp src/vs/path/to/file.css out/vs/path/to/file.css
```

### Numeric constants in `out/`

Compiled JS in `out/` uses numeric constants instead of enum names:
- `KeyMod.CtrlCmd | KeyCode.KeyB` becomes `2048 | 32`
- When debugging keybinding issues in `out/`, remember to decode these values

---

## 10. Testing Protocol After Any Patch Change

Before declaring ANY patch change complete, verify ALL of the following. Do not skip items.

### Menu Bar Checklist

- [ ] File menu visible
- [ ] Edit menu visible, NO Toggle Comment, NO Block Comment, NO Emmet
- [ ] Selection menu visible
- [ ] View menu visible, NO Appearance submenu, NO Editor Layout submenu, NO Extensions
- [ ] Go menu NOT visible
- [ ] Run menu NOT visible
- [ ] Terminal menu NOT visible
- [ ] Window menu visible
- [ ] Help menu visible

### Title Bar Checklist

- [ ] Left sidebar toggle visible
- [ ] Right sidebar toggle visible
- [ ] Settings gear visible
- [ ] Accounts icon NOT visible
- [ ] Panel toggle NOT visible

### Sidebar Checklist

- [ ] Explorer visible
- [ ] Search visible
- [ ] Run and Debug NOT visible (no icon in activity bar)
- [ ] Extensions visible

### Status Bar Checklist

- [ ] Copilot icon NOT visible

### Keybinding Checklist

- [ ] Cmd+B does NOT toggle sidebar
- [ ] Cmd+B triggers Bold in editor

### Build Checklist

- [ ] `grep '^diff --git' patches/vscode/003-ritemark-menu-cleanup.patch | wc -l` shows 14
- [ ] `./scripts/apply-patches.sh --dry-run` shows all patches "Already applied"
- [ ] TypeScript compiles without "declared but never read" errors

---

## Appendix: The Consolidation Disaster (2026-03-22)

### What happened

During Sprint 39, patch 007 (defaultChatAgent null-safety, 7 files) was consolidated into patch 003 (menu cleanup, 7 files at the time). The goal was to reduce patch count from 7 to 6.

### What went wrong

1. A `git diff` was generated for the consolidated patch, but it only captured changes from files that were currently modified in the working tree.
2. 38 of 45 total patched files across ALL patches were silently lost.
3. No validation was performed to compare old file count vs new file count.
4. The patch was committed and applied without testing.

### What broke

- Go, Terminal, and Run menus reappeared in the menu bar
- Cmd+B started toggling the sidebar again (conflicting with Bold)
- Run and Debug icon reappeared in the activity bar
- Copilot status bar icon reappeared
- Extensions entry reappeared in View menu
- Editor Layout submenu reappeared in View menu
- Toggle Comment and Block Comment reappeared in Edit menu
- Emmet Expand Abbreviation reappeared in Edit menu

### How it was fixed

Each of the 14 files had to be manually re-patched, one at a time, with careful attention to import removal and `void` suppression patterns. The fix took an entire working day.

### Root cause

No validation step existed to verify that a consolidated patch preserved all files from the original patches. The consolidation rules in Section 8 now prevent this from recurring.
