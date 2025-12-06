# VS Code File Icon Theme Architecture

## Overview

File icon themes are extensions that define icon mappings via JSON. The Seti theme (built-in default) has 2300+ lines with 1500+ icon definitions.

## Package.json Structure

```json
{
  "contributes": {
    "iconThemes": [
      {
        "id": "ritemark-icons",
        "label": "RiteMark Icons",
        "path": "./fileicons/ritemark-icon-theme.json"
      }
    ]
  }
}
```

## Icon Theme JSON Schema

```json
{
  "iconDefinitions": {
    "_file": { "iconPath": "./icons/file.svg" },
    "_folder": { "iconPath": "./icons/folder.svg" }
  },
  "file": "_file",
  "folder": "_folder",
  "folderExpanded": "_folder_open",
  "fileExtensions": {
    "md": "_markdown",
    "json": "_json"
  },
  "fileNames": {
    "package.json": "_npm",
    "README.md": "_readme"
  },
  "languageIds": {
    "markdown": "_markdown"
  }
}
```

## Icon Resolution Priority

1. **fileNames** - Exact filename match (highest)
2. **languageIds** - Language identifier
3. **fileExtensions** - File extension
4. **file** - Default fallback (lowest)

## Font vs SVG Icons

| Approach | Pros | Cons |
|----------|------|------|
| Font (WOFF) | Compact, colorable via CSS | Complex to build, harder to update |
| SVG files | Easy to add/modify, native Lucide format | More files, separate per icon |

**Recommendation:** Use SVG icons directly - simpler, matches Lucide's native format.

## Setting Default Theme

Configure in product.json or via settings:
```json
{
  "workbench.iconTheme": "ritemark-icons"
}
```

## Key Files in VS Code

- `/vscode/extensions/theme-seti/` - Reference implementation
- `/vscode/extensions/theme-seti/icons/vs-seti-icon-theme.json` - Full mappings
- `/vscode/src/vs/workbench/services/themes/common/fileIconThemeSchema.ts` - Schema

## Gotchas

1. Theme ID must be unique and follow pattern: `{extension-name}-{theme-id}`
2. SVG paths are relative to the theme JSON file
3. File name matching is case-insensitive
4. Need light/dark variants for good UX
