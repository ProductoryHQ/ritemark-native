# Sprint 26 Research: Architecture Findings

## Bubble Menu Architecture

**File:** `extensions/ritemark/webview/src/components/FormattingBubbleMenu.tsx`

### Current Structure
- **Purpose:** Context-sensitive formatting toolbar on text selection
- **Trigger:** Appears when text is selected (not in code blocks)
- **Current buttons:**
  - Text formatting: Bold, Italic
  - Headings: H1, H2, H3
  - Lists: Bullet, Ordered, Task
  - Content: Link, **Table**

### Code Patterns
```typescript
// Toggle pattern for formatting marks/nodes
<button
  onClick={() => editor.chain().focus().toggleX().run()}
  className={editor.isActive('x') ? 'bg-gray-200' : ''}
>
```

### Table Button Details
- Lines ~326-334: Table button with icon
- Lines ~86, ~424-438: Table dialog state management
- Opens TablePicker component in Radix Dialog
- **Issue:** Table is insertion (like heading), not text formatting

## Slash Commands Architecture

**File:** `extensions/ritemark/webview/src/extensions/SlashCommands.tsx`

### Current Commands
1. Heading 1, 2, 3 - Set block type
2. Bullet List, Numbered List, Task List - Convert to list
3. Code Block - Insert code block
4. Table - Insert 3x3 table
5. **Image - PLACEHOLDER** (line ~141-151)

### Image Command Current State
```typescript
{
  title: 'Image',
  description: 'Insert an image (coming soon)',
  icon: Image,
  command: ({ editor, range }: any) => {
    editor.chain().focus().deleteRange(range).run()
    // TODO: Implement local image handling for VS Code (future sprint)
    console.log('Image insertion not yet supported in VS Code extension')
  },
}
```

### Command Execution Pattern
1. User types `/` → Suggestion plugin activates
2. Filter commands by query
3. Render CommandsList in tippy.js popup
4. On selection: Execute command with `{ editor, range }`
5. Pattern: `editor.chain().focus().deleteRange(range).insertX().run()`

## Image Paste Flow

**File:** `extensions/ritemark/webview/src/components/Editor.tsx` (line ~412-432)

### Current Flow (Clipboard Paste)
1. User pastes screenshot (Cmd+V)
2. `handlePaste` hook checks for image in clipboard
3. Guard: Skip if HTML content present (let TipTap handle rich text)
4. Read image file as base64 Data URL
5. Generate filename: `image-${Date.now()}.png`
6. Send to extension: `saveImage` message with `{ dataUrl, filename }`

**Extension Handler:** `ritemarkEditor.ts` line ~306-309

### Extension `saveImage` Handler
```typescript
case 'saveImage':
  // Save image to ./images/ folder relative to markdown file
  this.saveImage(document, message.dataUrl, message.filename, webview);
  return;
```

**Implementation:** `ritemarkEditor.ts` line ~550-600 (approx)

### Save Flow
1. Create `./images/` folder if missing (relative to markdown file)
2. Extract base64 data from Data URL
3. Write buffer to `./images/${filename}`
4. Generate relative path: `./images/${filename}`
5. Send response to webview: `imageUploaded` message with relative path
6. Webview inserts image node with relative path

## Image Extension

**File:** `extensions/ritemark/webview/src/extensions/imageExtensions.ts`

### Current Configuration
```typescript
import Image from '@tiptap/extension-image'

export const ImageExtension = Image.configure({
  inline: true,
  allowBase64: true,
  HTMLAttributes: {
    class: 'tiptap-image',
    loading: 'lazy',
    decoding: 'async',
  },
})
```

### Limitations
- Uses TipTap core Image extension (no custom NodeView)
- No selection state handling
- No resize capability
- Just renders: `<img src="..." class="tiptap-image">`

### Upgrade Path (Phase 4)
Options for selection state:
1. **CSS-only:** Add `.ProseMirror-selectednode` styles (simplest)
2. **Custom NodeView:** React component with selection detection (flexible)
3. **Plugin:** tiptap-extension-resize-image (overkill for MVP)

## Stale State Pattern (Data Editor)

**Files:**
- `extensions/ritemark/src/excelEditorProvider.ts` (line ~250-312)
- `extensions/ritemark/webview/src/components/notifications/FileChangeNotification.tsx`

### File Watcher Pattern (Extension Side)
```typescript
// Create watcher
const watcher = vscode.workspace.createFileSystemWatcher(
  new vscode.RelativePattern(dirname, basename)
)

// Handle change (debounced 500ms)
watcher.onDidChange(() => {
  // Clear existing timer, set new 500ms debounce
  setTimeout(() => {
    webview.postMessage({
      type: 'fileChanged',
      filename,
      isDirty: false // Excel is read-only
    })
  }, 500)
})
```

### Notification Component (Webview Side)
**States:**
1. **Not Dirty:** "File changed. [Refresh Now] [Dismiss]" (auto-dismiss 10s)
2. **Dirty:** "File changed. You have unsaved changes. [Review]" (persistent)

**Actions:**
- Refresh Now: Send `refresh` message to extension
- Review: Same as Refresh (opens dialog if conflicts)
- Dismiss: Hide banner
- Auto-dismiss: Countdown from 10s (if not dirty)

### Text Editor Status
**Current:** NO file watcher for markdown files
- CSV/Excel: Has watcher (ritemarkEditor.ts line ~236-247)
- Markdown: Relies on VS Code built-in conflict detection

**Why Needed:**
- Consistency: Data Editor has visual indicator, text editor should too
- User expectation: Both editors should behave similarly
- VS Code conflict UI is modal (blocks workflow), banner is non-blocking

## Blockquote Extension

**Source:** TipTap StarterKit

### StarterKit Configuration (Editor.tsx line ~295)
```typescript
StarterKit.configure({
  // ... other config
  // Blockquote is INCLUDED by default (not disabled)
})
```

### Current UI Exposure
- **BlockMenu:** Has "Quote" button (BlockMenu.tsx line ~85-89)
  - Icon: `<Quote size={18} />`
  - NodeType: `blockquote`
  - Inserts: `{ type: 'blockquote', content: [{ type: 'paragraph' }] }`
- **Bubble Menu:** NOT present (only in block insertion menu)

### Toggle Pattern (Expected)
```typescript
// Should work (StarterKit includes blockquote)
editor.chain().focus().toggleBlockquote().run()
editor.isActive('blockquote') // true when cursor is in blockquote
```

## Technical Constraints

### ProseMirror Selection
- Selection is NodeSelection (single node) or TextSelection (range)
- Images can be selected as nodes (click image → NodeSelection)
- CSS class `.ProseMirror-selectednode` auto-applied by ProseMirror

### NodeView Complexity
- Requires React component with `NodeViewWrapper`
- Must handle node updates, selection changes, destroy lifecycle
- Overkill for simple selection border (CSS sufficient)

### File Watcher Conflicts
- VS Code has built-in file system watcher
- Multiple watchers on same file = redundant events
- Debouncing (500ms) prevents spam
- Our watcher is for UI notification (non-blocking), VS Code's is for conflict resolution (blocking)

### Image Path Resolution
- Relative paths: `./images/file.png` (relative to markdown file)
- Absolute paths: `/full/path/to/image.png` (breaks portability)
- **Current:** Always relative (correct approach)
- **Future risk:** User moves markdown file → paths break (future sprint: path updates)

## Performance Considerations

### File Watcher Overhead
- One watcher per open editor
- Disposed when editor closes
- Debouncing prevents excessive events
- Minimal CPU impact (OS-level file system events)

### Image Loading
- Lazy loading: `loading="lazy"` attribute
- Async decoding: `decoding="async"` attribute
- No impact on editor responsiveness

### Message Passing
- Extension ↔ Webview communication is async
- File picker dialog blocks UI (expected behavior)
- Image save is I/O bound (async in Node.js)
- No UI blocking concerns

## Conclusion

All required infrastructure exists:
- Blockquote extension: Already in StarterKit
- Image save flow: Already implemented for paste
- File watcher pattern: Already proven in Data Editor
- Bubble menu: Just needs button additions/removals

Estimated complexity: **Low to Medium**
- Phases 1-2: Trivial (UI changes only)
- Phase 3: Medium (new command, file picker integration)
- Phase 4: Medium (investigation + CSS/NodeView decision)
- Phase 5: Low (copy existing pattern)
