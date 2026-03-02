# White Cursor Issue on Windows (D1)

## Problem
On Windows, the typing cursor (caret) appears white between paragraphs/lines in the editor.

## Root Cause Analysis

### ProseMirror CSS
TipTap's core styles (from `@tiptap/core/src/style.ts`) include:
```css
.ProseMirror-hideselection * {
  caret-color: transparent;
}
```

When the selection is not visible (`sel.visible === false`), ProseMirror adds `.ProseMirror-hideselection` class, which sets `caret-color: transparent`.

### Windows-Specific Behavior
Windows' text rendering engine may handle `caret-color: transparent` differently than macOS:
- On macOS: transparent caret is truly invisible
- On Windows: transparent caret may fall back to white or system default color

### Editor Styles
In `Editor.tsx` (lines 904-918):
- ProseMirror paragraphs use dark text colors (#374151, #111827)
- No explicit `caret-color` is set for normal editing state
- The white cursor is visible against the editor's light/white background

## Fix Approach

Add explicit `caret-color` override in `Editor.tsx`:
```css
.ProseMirror {
  caret-color: #374151; /* Match paragraph text color */
}

/* Override TipTap's transparent caret only when needed */
.ProseMirror-hideselection * {
  caret-color: transparent !important;
}
```

This ensures:
1. Normal editing: caret matches text color (dark gray)
2. Hidden selection: caret is properly hidden
3. Works consistently across Windows and macOS

## Files to Modify
- `extensions/ritemark/webview/src/components/Editor.tsx` — Add caret-color CSS
- Rebuild webview bundle after change
