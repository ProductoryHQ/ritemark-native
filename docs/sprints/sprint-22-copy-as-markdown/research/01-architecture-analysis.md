# Architecture Analysis: Copy as Markdown Feature

## Current Export System

### Export Menu Component
- **Location**: `extensions/ritemark/webview/src/components/header/ExportMenu.tsx`
- **Current Options**: Export PDF, Export Word
- **UI Pattern**: Dropdown menu positioned below Export button
- **Props Interface**:
  ```typescript
  interface ExportMenuProps {
    isOpen: boolean
    onClose: () => void
    onExportPDF: () => void
    onExportWord: () => void
    anchorElement: HTMLElement | null
  }
  ```

### Export Flow

#### Current Word Export Flow
1. User clicks "Export Word" in menu
2. `App.tsx` handles click: `handleExportWord()`
3. Sends message to extension: `sendToExtension('exportWord', { markdown: content, properties })`
4. Extension (`ritemarkEditor.ts`) receives message
5. Calls `exportToWord()` function which:
   - Shows save dialog
   - Converts markdown to Word format
   - Saves file to disk

#### Current PDF Export Flow
Similar to Word, but sends HTML content instead of markdown.

## Markdown Serialization System

### TurndownService
- **Library**: `turndown` + `turndown-plugin-gfm`
- **Location**: `extensions/ritemark/webview/src/components/Editor.tsx` (lines 28-193)
- **Purpose**: Converts TipTap HTML to GitHub Flavored Markdown

### Custom Markdown Rules
TurndownService has custom rules for:
1. **Task Lists**: TipTap format → GFM `- [ ]` / `- [x]` syntax
2. **Tables**: Removes `<colgroup>` and unwraps `<p>` tags for GFM compatibility
3. **Images**: Preserves relative paths stored in title attribute
4. **Pipe Escaping**: Escapes `|` in table cells

### Serialization Functions

```typescript
// Get full document as HTML (line 378)
const html = editor.getHTML()

// Clean table HTML for GFM conversion (line 86-108)
const cleanedHTML = preprocessTableHTML(html)

// Convert to markdown (line 382)
const markdown = turndownService.turndown(cleanedHTML)
```

## Selection Handling

### Current Selection Tracking
- **Location**: `Editor.tsx` lines 530-555
- **Hook**: `useEditorState` with selector
- **Selection Object**:
  ```typescript
  interface EditorSelection {
    text: string      // Plain text content
    from: number      // Start position
    to: number        // End position
    isEmpty: boolean  // No selection (cursor only)
    wordCount: number // For UI display
  }
  ```

### Getting Selected Content

#### Plain Text (Currently Used)
```typescript
const { from, to } = editor.state.selection
const text = editor.state.doc.textBetween(from, to, ' ')
```

#### HTML Slice (Needed for Markdown)
TipTap/ProseMirror provides methods to extract HTML from selection:
```typescript
const { from, to, empty } = editor.state.selection

if (!empty) {
  // Get selected fragment
  const fragment = editor.state.doc.slice(from, to).content

  // Method 1: Create temporary view to get HTML
  // (TipTap should provide editor.getHTML({ from, to }) but doesn't)

  // Method 2: Use ProseMirror serializer
  // editor.state.doc.content has serialization capabilities
}
```

**Note**: Need to verify exact TipTap API for getting HTML of selection range.

## Clipboard API

### Browser API
```typescript
// Copy text to clipboard (line 31 in CodeBlockWithCopy.tsx)
await navigator.clipboard.writeText(text)
```

### Error Handling
```typescript
try {
  await navigator.clipboard.writeText(text)
  // Show success feedback
} catch (err) {
  console.error('Failed to copy:', err)
  // Show error feedback
}
```

### UI Feedback Pattern (from CodeBlockWithCopy)
- Show "Copied!" message for 2 seconds
- Use lucide-react icons: `Copy` / `Check`
- Prevent editor focus loss: `onMouseDown={(e) => e.preventDefault()}`

## Implementation Approach Decision

### Option 1: Handle in Webview (RECOMMENDED)
**Pros**:
- No extension message passing needed
- Simpler implementation
- Faster response (no IPC)
- Clipboard API available in webview
- Follows pattern of CodeBlockWithCopy

**Cons**:
- None significant

### Option 2: Handle in Extension
**Pros**:
- Consistent with PDF/Word export
- Could integrate with VS Code clipboard API

**Cons**:
- More complex (message passing)
- Slower (IPC overhead)
- Extension doesn't need to be involved (no file I/O)

**Decision**: Option 1 (handle entirely in webview)

## Integration Points

### Files to Modify

1. **ExportMenu.tsx**
   - Add "Copy as Markdown" menu item
   - Add `onCopyMarkdown` prop
   - Add icon (clipboard icon from lucide-react)

2. **App.tsx**
   - Add `handleCopyMarkdown` function
   - Pass handler to ExportMenu
   - Access editor ref to get content/selection
   - Use turndownService for serialization

3. **Editor.tsx**
   - Expose editor ref (already done via `editorRef`)
   - May need helper function to get selection HTML
   - Share turndownService instance (currently private)

## Technical Challenges

### Challenge 1: Getting HTML from Selection
TipTap's `editor.getHTML()` returns full document. Need to:
- Research TipTap API for partial HTML extraction
- Or use ProseMirror's slice + DOMSerializer
- Or create temp editor instance with selection content

### Challenge 2: Sharing TurndownService
Currently created inside Editor.tsx as module-level constant.
- **Option A**: Export it for use in App.tsx
- **Option B**: Create utility function `convertToMarkdown(html: string)`
- **Option C**: Pass serialization function via props

**Recommendation**: Option B (utility function) - most maintainable

### Challenge 3: UI Feedback
Need to show "Copied!" feedback to user.
- **Option A**: Toast notification (if available)
- **Option B**: Temporary text in menu item (like CodeBlockWithCopy)
- **Option C**: VS Code notification (requires extension message)

**Recommendation**: Option B (temporary menu item text change)

## Dependencies

### Existing Libraries
- `turndown`: Installed ✓
- `turndown-plugin-gfm`: Installed ✓
- `lucide-react`: Installed ✓ (for icons)

### New Libraries Needed
None

## Success Criteria

1. Export menu has "Copy as Markdown" option
2. With selection: copies only selected content as markdown
3. Without selection: copies entire document as markdown
4. Clean markdown output (consistent with Word export)
5. User sees "Copied!" feedback
6. Works with all markdown features (tables, task lists, images, etc.)
