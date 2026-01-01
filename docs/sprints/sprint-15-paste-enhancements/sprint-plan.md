# Sprint 15: Paste Enhancements

## Goal
Improve HTML paste handling to automatically convert web content (especially tables) into clean markdown, and optionally handle inline images from clipboard.

## Success Criteria
- [ ] Pasting HTML tables from web pages converts to markdown tables
- [ ] Table structure (headers, rows, columns) preserved correctly
- [ ] Pasted content integrates cleanly with existing document
- [ ] No HTML artifacts remain after paste

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| HTML Table Paste Handler | Intercept HTML paste, convert tables to markdown |
| Paste Preprocessing | Clean and normalize HTML before conversion |
| Table Detection | Identify tables in mixed HTML content |
| Optional: Inline Image Paste | Convert pasted inline images (data URLs) to files |

## Implementation Checklist

### Phase 1: Research

#### Current Paste Handling
- [ ] Review existing `handlePaste` in Editor.tsx (lines 349-365)
- [ ] Understand current image paste flow
- [ ] Review turndown configuration for tables (lines 136-150)
- [ ] Test current behavior: paste HTML table from browser

#### HTML Table Sources
- [ ] Test paste from common sources:
  - [ ] Google Docs tables
  - [ ] Microsoft Word tables
  - [ ] Web page tables (Wikipedia, etc.)
  - [ ] Excel/Google Sheets
  - [ ] Notion tables
- [ ] Document HTML structure variations

#### Conversion Pipeline
- [ ] Review marked.js for HTML → markdown (if needed)
- [ ] Review turndown for HTML → markdown (already configured)
- [ ] Check if TipTap has built-in paste transformers
- [ ] Research `@tiptap/extension-paste-rules` or similar

### Phase 2: Paste Handler Enhancement

#### Detect HTML Content
- [ ] Check `event.clipboardData.types` for 'text/html'
- [ ] Extract HTML content: `clipboardData.getData('text/html')`
- [ ] Detect if HTML contains `<table>` elements
- [ ] Fall back to default paste if no tables

#### HTML Preprocessing
- [ ] Create `preprocessPastedHTML(html: string)` function
- [ ] Remove Word-specific markup (mso-* styles, etc.)
- [ ] Remove Google Docs wrapper divs
- [ ] Strip excessive styling attributes
- [ ] Normalize table structure (ensure thead/tbody)

#### Table Conversion
- [ ] Use existing turndown instance for conversion
- [ ] Apply `preprocessTableHTML()` (already exists, line 84-106)
- [ ] Convert cleaned HTML to markdown via turndown
- [ ] Parse markdown back to TipTap JSON via marked

#### Insert Content
- [ ] Use `editor.commands.insertContent()` with parsed content
- [ ] Ensure cursor position is correct after insert
- [ ] Handle mixed content (table + surrounding text)

### Phase 3: Edge Cases & Polish

#### Complex Table Handling
- [ ] Tables with merged cells (colspan/rowspan)
- [ ] Tables without headers (no `<th>`)
- [ ] Nested tables (flatten or warn)
- [ ] Tables with images in cells
- [ ] Tables with links in cells

#### Mixed Content
- [ ] HTML with tables AND paragraphs
- [ ] Multiple tables in one paste
- [ ] Tables inside lists or blockquotes
- [ ] Preserve text before/after tables

#### Source-Specific Fixes
- [ ] Google Docs: Remove docs-internal-* classes
- [ ] Word: Strip mso-* and o:p elements
- [ ] Notion: Handle their specific markup
- [ ] Excel: Convert cell formats appropriately

### Phase 4: Optional - Inline Image Handling

#### Scope Decision
- [ ] Decide if inline images (data URLs) should be handled
- [ ] Option A: Convert to files like current drag/drop
- [ ] Option B: Keep as data URLs (larger file size)
- [ ] Option C: Defer to future sprint

#### If Included
- [ ] Detect `<img src="data:image/...">` in pasted HTML
- [ ] Extract base64 data from data URL
- [ ] Reuse existing `sendToExtension('saveImage', ...)` flow
- [ ] Replace data URL with saved file path

### Phase 5: Testing & Validation

#### Table Paste Testing
- [ ] Paste simple 2x2 table → correct markdown
- [ ] Paste table with headers → first row is header
- [ ] Paste table with bold/italic text → formatting preserved
- [ ] Paste table with links → links preserved
- [ ] Paste table with code → inline code preserved

#### Source Testing
- [ ] Google Docs table paste
- [ ] Microsoft Word table paste
- [ ] Web browser (Chrome) table paste
- [ ] Web browser (Safari) table paste
- [ ] Excel table paste (if different from web)

#### Roundtrip Testing
- [ ] Paste table → save → reload → table intact
- [ ] Paste table → edit cells → save → changes preserved
- [ ] Paste table → add rows via TipTap → save → correct markdown

#### Edge Case Testing
- [ ] Very wide table (many columns)
- [ ] Very tall table (many rows)
- [ ] Table with empty cells
- [ ] Table with pipe characters in content
- [ ] Table followed by more content

## Status

**Current Phase:** Phase 1 - Research (Pending Sprint 14 completion)

## Risks & Considerations

| Risk | Mitigation |
|------|------------|
| HTML variations across sources | Test extensively, normalize aggressively |
| Merged cells not supported in GFM | Flatten or warn user |
| Large tables cause performance issues | Consider size limits or progressive insert |
| Data loss on complex formatting | Preserve as much as reasonable, document limitations |

## Open Questions

1. **Merged cells:** How to handle colspan/rowspan?
   - **Option A:** Flatten to simple cells (may lose structure)
   - **Option B:** Show warning, paste as-is
   - **Option C:** Convert to nested content somehow

2. **Inline images:** Include in this sprint?
   - **Option A:** Yes, reuse existing image save flow
   - **Option B:** No, defer to dedicated image sprint

3. **Non-table HTML:** Should we improve general HTML paste?
   - **Option A:** Focus only on tables (this sprint)
   - **Option B:** Improve all HTML paste handling

## Technical Notes

### Paste Handler Pattern

```typescript
// In editorProps.handlePaste
handlePaste: (view, event, slice) => {
  const html = event.clipboardData?.getData('text/html')

  if (html && html.includes('<table')) {
    event.preventDefault()

    // Preprocess and convert
    const cleaned = preprocessPastedHTML(html)
    const markdown = turndownService.turndown(cleaned)
    const tiptapJson = marked.parse(markdown)

    editor.commands.insertContent(tiptapJson)
    return true
  }

  // Fall through to default handling
  return false
}
```

### HTML Preprocessing Example

```typescript
function preprocessPastedHTML(html: string): string {
  const temp = document.createElement('div')
  temp.innerHTML = html

  // Remove Word-specific elements
  temp.querySelectorAll('[class*="mso-"]').forEach(el => {
    el.removeAttribute('class')
    el.removeAttribute('style')
  })

  // Remove Google Docs wrappers
  temp.querySelectorAll('[id^="docs-internal"]').forEach(el => el.remove())

  // Normalize tables
  temp.querySelectorAll('table').forEach(table => {
    // Ensure proper structure
    // Remove colgroup, fix cells, etc.
  })

  return temp.innerHTML
}
```

### Existing Infrastructure to Reuse

| Component | Location | Purpose |
|-----------|----------|---------|
| `turndownService` | Editor.tsx:26-32 | HTML → Markdown |
| `preprocessTableHTML()` | Editor.tsx:84-106 | Clean TipTap tables |
| `marked()` | Editor.tsx:229-237 | Markdown → HTML |
| `handlePaste` | Editor.tsx:349-365 | Image paste handler |

## References

- [TipTap Clipboard Handling](https://tiptap.dev/docs/editor/core-concepts/prosemirror#clipboard-handling)
- [Turndown - HTML to Markdown](https://github.com/mixmark-io/turndown)
- [turndown-plugin-gfm](https://github.com/mixmark-io/turndown-plugin-gfm)
- [Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API)
- [GFM Tables Spec](https://github.github.com/gfm/#tables-extension-)

## Approval

- [ ] Jarmo approved this sprint plan

**Decisions Needed:**
1. Merged cell handling approach
2. Inline image inclusion (yes/no/defer)
3. Scope of general HTML paste improvements

---

*Sprint plan created: 2025-12-19*
