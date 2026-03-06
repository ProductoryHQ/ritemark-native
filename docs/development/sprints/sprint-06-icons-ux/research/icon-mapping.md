# Ritemark Icon Mapping Plan

## Lucide Icons to Use

Source: https://lucide.dev/icons/

### Core File Types

| Category | Extensions | Lucide Icon | Notes |
|----------|-----------|-------------|-------|
| **Markdown** | .md, .mdx | `file-text` | Primary focus - Ritemark's core |
| **JSON** | .json | `braces` | Could also use `file-json-2` |
| **JavaScript** | .js, .mjs, .cjs | `file-code` | |
| **TypeScript** | .ts, .tsx | `file-code-2` | Differentiate from JS |
| **HTML** | .html, .htm | `file-code` | |
| **CSS** | .css, .scss, .less | `paintbrush` or `palette` | |
| **Config** | .yaml, .yml, .toml | `settings` | |

### Image Files

| Extension | Lucide Icon |
|-----------|-------------|
| .png, .jpg, .jpeg, .gif, .webp | `image` |
| .svg | `file-code` (it's code!) |
| .ico | `image` |

### Folders

| State | Lucide Icon |
|-------|-------------|
| Closed | `folder` |
| Open | `folder-open` |

### Special Files

| Filename | Lucide Icon |
|----------|-------------|
| package.json | `package` |
| README.md | `book-open` |
| .gitignore | `git-branch` |
| LICENSE | `scale` |
| Dockerfile | `container` |

### Generic Fallback

| Type | Lucide Icon |
|------|-------------|
| Unknown file | `file` |

---

## Implementation Approach

### Phase 1: Minimal Set (Sprint 6)
Focus on most common file types for a markdown-focused editor:
- Markdown (.md) - **branded icon**
- Folders (open/closed)
- JSON, JS, TS, HTML, CSS
- Images
- Generic fallback

### Phase 2: Extended (Future)
- More languages
- Special folder icons (node_modules, .git, src)
- Root folder variants

---

## Brand Colors

Consider using Ritemark brand colors for the markdown icon:
- Primary: (from existing branding)
- Could tint the Lucide icons with brand accent

---

## SVG Export Settings

When downloading from Lucide:
- Size: 24x24 (standard)
- Stroke width: 2 (default)
- Format: SVG
- Color: Can be customized per icon in theme

---

## Decision Needed

**Question for Jarmo:** Should the markdown icon:
1. Use standard Lucide `file-text` icon
2. Use a custom Ritemark-branded icon (would need design)
3. Use Lucide icon with Ritemark brand color applied
