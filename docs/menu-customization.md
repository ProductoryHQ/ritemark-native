# RiteMark Menu Customization

This document describes menu items removed from RiteMark Native to create a focused markdown editing experience.

## Overview

RiteMark Native removes code-focused menu items that aren't relevant for markdown editing. Changes are implemented via patch files in `patches/vscode/`.

## Removed Items

### Go Menu (Removed Entirely)
**Patch:** `005-remove-go-menu.patch`

The entire Go menu was removed as it contains code navigation features not relevant for markdown:
- Go to File
- Go to Symbol
- Go to Line
- Go to Definition
- Back/Forward navigation

### Edit Menu
**Patch:** `003-remove-edit-menu-code-items.patch`

| Removed Item | Reason |
|--------------|--------|
| Emmet: Expand Abbreviation | HTML/CSS tool, not for markdown |
| Toggle Line Comment | Code commenting (Cmd+/ still works) |
| Toggle Block Comment | Code commenting |

### View Menu
**Patches:** `004-hide-extensions-view-menu.patch`, `006-cleanup-view-menu.patch`

| Removed Item | Reason |
|--------------|--------|
| Extensions | Marketplace hidden, extensions not user-installable |
| Appearance submenu | Visual clutter, not essential |
| Editor Layout submenu | Split editor layouts not needed |

## Kept Items

### File Menu
All items kept - essential for file operations.

### Edit Menu (remaining)
- Undo/Redo
- Cut/Copy/Paste
- Find/Replace
- Select All

### View Menu (remaining)
- Command Palette (power user access)
- Explorer
- Search
- Source Control

### Terminal Menu
Kept entirely - useful for git commands and scripts.

### Help Menu
All items kept.

## How to Restore Items

To restore a removed item:

1. Find the relevant patch in `patches/vscode/`
2. Locate the commented-out code (marked with `// RiteMark:`)
3. Uncomment the relevant section
4. Regenerate the patch:
   ```bash
   cd vscode
   git diff path/to/file.ts > ../patches/vscode/XXX-name.patch
   git checkout path/to/file.ts
   ```
5. Reapply patches: `./scripts/apply-patches.sh`

## Adding New Menu Items

To add a RiteMark-specific menu item:

1. Create a new patch file
2. Use `MenuRegistry.appendMenuItem()` with the appropriate `MenuId`
3. Follow existing patterns in VS Code source

## Patch Files Reference

| Patch | Purpose |
|-------|---------|
| `003-remove-edit-menu-code-items.patch` | Remove Emmet/comment items from Edit menu |
| `004-hide-extensions-view-menu.patch` | Hide Extensions from View menu |
| `005-remove-go-menu.patch` | Remove entire Go menu |
| `006-cleanup-view-menu.patch` | Remove Appearance/Layout from View menu |

## Validation

Before building, run the validation script to catch errors:
```bash
./scripts/validate-patches.sh
```

This catches TypeScript errors in ~2 minutes instead of waiting for a 25-minute build.
