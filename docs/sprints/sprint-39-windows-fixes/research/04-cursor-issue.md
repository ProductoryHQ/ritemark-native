# Sprint 39 Research: White Cursor Between Paragraphs (D1)

## Problem

On Windows, a white typing cursor appears between paragraphs in the editor.
This is a visual artifact — the cursor appears in the gap between paragraph blocks rather than within the text.

## Likely Causes

### Hypothesis 1: CSS line-height / padding gap

TipTap renders paragraphs as `<p>` elements. If adjacent paragraphs have a gap between them (from `margin-bottom` or `padding`), the caret can visually appear "between" paragraphs when positioned at the end of one paragraph.

On macOS the cursor may be hidden by the macOS caret rendering (blends with background). On Windows the caret is rendered differently (white flashing bar via the OS) and can be visible in gaps.

**Check:** `webview/src/styles/editor.css` or `webview/src/App.css` for paragraph margins/padding.

### Hypothesis 2: ProseMirror gap cursor

TipTap/ProseMirror has a concept of a "gap cursor" that activates when clicking between block nodes. This shows as a cursor positioned outside of text nodes, between block elements.

ProseMirror renders this with `.ProseMirror-gapcursor` CSS class. If this class has no color or uses a color that's invisible on macOS but visible on Windows (e.g., white), the gap cursor would appear.

**Check:** Whether `GapCursor` extension is enabled in the TipTap editor config and how `.ProseMirror-gapcursor` is styled.

### Hypothesis 3: Theme variable mismatch

The cursor color on Windows may be controlled by a CSS variable that resolves differently. VS Code's webview color variables may have different defaults on Windows.

**Check:** `--vscode-editor-foreground` and `--vscode-editorCursor-foreground` CSS variables in the webview context on Windows vs macOS.

## Investigation Steps

1. Check `webview/src/styles/` for `.ProseMirror-gapcursor` CSS
2. Check `webview/src/extensions/` or editor setup for `GapCursor` extension registration
3. Review paragraph CSS for margin/padding gaps
4. Ask Jarmo for a screenshot of the exact behavior if possible

## Files to Check

| File | What to look for |
|------|-----------------|
| `webview/src/App.css` or equivalent | Paragraph margins, cursor color |
| `webview/src/styles/editor.css` | `.ProseMirror`, `.ProseMirror-gapcursor` |
| `webview/src/extensions/` | GapCursor extension registration |
| `webview/src/components/RitemarkEditor.tsx` | TipTap `useEditor` config |

## Likely Fix

If it is the gap cursor:
```css
.ProseMirror-gapcursor {
  display: none;
}
```
Or set the gap cursor color to match the editor background.

If it is paragraph margin creating a clickable gap:
- Ensure caret-color CSS property is set on `.ProseMirror` to the correct foreground color

## Note

This issue is listed as "investigating separately" in the audit and is still classified as must-fix before Windows release. Treat as Phase 1 investigation first — fix approach depends on what we find.
