# TipTap Selection API Research

## Goal
Determine the best method to extract HTML content from a TipTap editor selection.

## TipTap Editor Methods

### Full Document Methods
```typescript
editor.getHTML()        // Returns full document HTML
editor.getText()        // Returns full document plain text
editor.getJSON()        // Returns full document as ProseMirror JSON
```

### Selection Methods (State API)
```typescript
// Selection boundaries
editor.state.selection.from    // Start position (number)
editor.state.selection.to      // End position (number)
editor.state.selection.empty   // Boolean: true if no selection

// Plain text from range
editor.state.doc.textBetween(from, to, separator)

// Get document slice
editor.state.doc.slice(from, to)  // Returns Slice object
```

## ProseMirror Fragment to HTML

### Method 1: DOMSerializer (Most Direct)
```typescript
import { DOMSerializer } from '@tiptap/pm/model'

const { from, to } = editor.state.selection
const fragment = editor.state.doc.slice(from, to).content

// Serialize fragment to DOM
const schema = editor.schema
const serializer = DOMSerializer.fromSchema(schema)
const dom = serializer.serializeFragment(fragment)

// Convert DOM to HTML string
const div = document.createElement('div')
div.appendChild(dom)
const html = div.innerHTML
```

### Method 2: Create Temporary Document (Clean Approach)
```typescript
import { Node } from '@tiptap/pm/model'

const { from, to } = editor.state.selection
const slice = editor.state.doc.slice(from, to)

// Create temporary document with selection content
const tempDoc = Node.fromJSON(editor.schema, {
  type: 'doc',
  content: slice.content.toJSON()
})

// Use TipTap's HTML serializer
// Note: TipTap wraps ProseMirror's serializer with extension logic
// We need to use editor's serialization, not raw ProseMirror
```

### Method 3: Chain Commands (If Supported)
```typescript
// Check if TipTap provides this (likely not for reading)
editor.chain()
  .setTextSelection({ from, to })
  .getHTML() // UNVERIFIED - need to check API
```

## Recommended Approach

Based on TipTap architecture (wraps ProseMirror with extensions):

### Solution: Helper Function in Editor.tsx
```typescript
/**
 * Get HTML content from editor selection
 * If no selection (empty), returns full document HTML
 */
export function getSelectionHTML(editor: TipTapEditor): string {
  const { from, to, empty } = editor.state.selection

  // If no selection, return full document
  if (empty) {
    return editor.getHTML()
  }

  // Get selected fragment
  const fragment = editor.state.doc.slice(from, to).content

  // Serialize to HTML using ProseMirror DOMSerializer
  const schema = editor.schema
  const serializer = DOMSerializer.fromSchema(schema)
  const dom = serializer.serializeFragment(fragment)

  // Convert DOM to HTML string
  const div = document.createElement('div')
  div.appendChild(dom)
  return div.innerHTML
}
```

## Testing Strategy

Test with various content types:
1. Plain text paragraph
2. Formatted text (bold, italic, code)
3. Headings
4. Lists (bullet, ordered, task)
5. Tables
6. Code blocks
7. Images
8. Mixed content

Verify:
- HTML structure matches TipTap's full document HTML
- Attributes are preserved (e.g., `data-type="taskItem"`)
- Extension-specific HTML is maintained

## Alternative: Export TurndownService

If we export the turndownService instance from Editor.tsx, App.tsx can use it directly:

### Editor.tsx Changes
```typescript
// Export turndownService for reuse
export const markdownSerializer = turndownService
```

### App.tsx Usage
```typescript
import { markdownSerializer, getSelectionHTML } from './components/Editor'

const handleCopyMarkdown = useCallback(() => {
  if (!editorRef.current) return

  // Get HTML (full or selection)
  const html = getSelectionHTML(editorRef.current)

  // Clean HTML (same preprocessing as onUpdate)
  const cleanedHTML = preprocessTableHTML(html)

  // Convert to markdown
  const markdown = markdownSerializer.turndown(cleanedHTML)

  // Copy to clipboard
  navigator.clipboard.writeText(markdown)
}, [])
```

## Implementation Notes

1. **Import ProseMirror Types**: TipTap exports ProseMirror modules
   - `import { DOMSerializer } from '@tiptap/pm/model'`
   - Verify this import path in TipTap v2.x

2. **Preprocessing**: Must apply same HTML cleaning as in `onUpdate`
   - `preprocessTableHTML()` to fix table formatting
   - Any other custom preprocessing

3. **Schema Compatibility**: Using `editor.schema` ensures TipTap extensions are respected

4. **Edge Cases**:
   - Empty document → return empty string or single paragraph?
   - Selection at document start/end → test boundary handling
   - Cross-node selections (e.g., selecting from middle of one paragraph to middle of another)

## Reference Files

- **TipTap React**: `extensions/ritemark/webview/node_modules/@tiptap/react`
- **ProseMirror Model**: `extensions/ritemark/webview/node_modules/@tiptap/pm`
- **Current Serialization**: `Editor.tsx` lines 376-390 (onUpdate handler)

## Action Items for Phase 2 (Planning)

1. Verify ProseMirror import paths in package.json
2. Create utility module for markdown serialization
3. Decide on helper function placement (Editor.tsx or new util file)
4. Plan UI feedback mechanism
