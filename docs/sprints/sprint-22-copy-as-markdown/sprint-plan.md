# Sprint 22: Copy as Markdown

## Goal
Add "Copy as Markdown" feature to the Export menu that copies selected content (or full document if no selection) as clean markdown to the clipboard.

## Success Criteria
- [ ] Export menu displays "Copy as Markdown" option
- [ ] With text selection: copies only selected content as markdown
- [ ] Without selection: copies entire document as markdown
- [ ] Copied markdown is clean and properly formatted (tables, lists, images, etc.)
- [ ] User sees visual feedback ("Copied!" message)
- [ ] Works in both dev and production builds
- [ ] No new dependencies required

## Deliverables
| Deliverable | Description |
|-------------|-------------|
| ExportMenu UI | Add "Copy as Markdown" menu item with clipboard icon |
| Selection HTML Helper | Function to extract HTML from editor selection or full document |
| Markdown Copy Handler | Function that converts HTML to markdown and copies to clipboard |
| User Feedback | Visual indication when content is successfully copied |
| Documentation | Update any relevant docs about the feature |

## Implementation Checklist

### Phase 1: Research (COMPLETE)
- [x] Analyze current Export menu implementation
- [x] Research TipTap selection API
- [x] Investigate markdown serialization (TurndownService)
- [x] Verify clipboard API availability
- [x] Verify dependencies (no new packages needed)
- [x] Document findings in research/

### Phase 2: Core Implementation
- [ ] Create selection HTML helper in Editor.tsx
  - [ ] Import DOMSerializer from @tiptap/pm/model
  - [ ] Implement `getSelectionHTML(editor)` function
  - [ ] Handle both selection and full document cases
  - [ ] Export for use in App.tsx
- [ ] Add markdown copy handler in App.tsx
  - [ ] Create `handleCopyAsMarkdown()` function
  - [ ] Use selection HTML helper
  - [ ] Apply table HTML preprocessing
  - [ ] Convert to markdown with TurndownService
  - [ ] Copy to clipboard with navigator.clipboard.writeText()
  - [ ] Handle errors gracefully
- [ ] Update ExportMenu component
  - [ ] Add `onCopyAsMarkdown` prop to interface
  - [ ] Import Clipboard icon from lucide-react
  - [ ] Add menu item between PDF and Word options
  - [ ] Wire up click handler
- [ ] Wire components in App.tsx
  - [ ] Pass `handleCopyAsMarkdown` to ExportMenu
  - [ ] Ensure editor ref is available

### Phase 3: User Feedback
- [ ] Add copied state to ExportMenu
  - [ ] Track "copied" state in component
  - [ ] Show "Copied!" text and Check icon temporarily
  - [ ] Reset after 2 seconds (like CodeBlockWithCopy)
  - [ ] Update menu item styling for success state
- [ ] Test feedback in various scenarios
  - [ ] Quick successive clicks
  - [ ] Copy while menu is open
  - [ ] Menu closing behavior after copy

### Phase 4: Testing & Validation
- [ ] Test with various content types
  - [ ] Plain text paragraphs
  - [ ] Formatted text (bold, italic, code)
  - [ ] Headings (all levels)
  - [ ] Lists (bullet, ordered, task/checkboxes)
  - [ ] Tables (simple and complex)
  - [ ] Code blocks with syntax highlighting
  - [ ] Images with relative paths
  - [ ] Mixed content
- [ ] Test selection scenarios
  - [ ] No selection (full document)
  - [ ] Partial paragraph selection
  - [ ] Multi-paragraph selection
  - [ ] Selection spanning different content types
  - [ ] Empty document
- [ ] Test error scenarios
  - [ ] Clipboard API blocked/unavailable
  - [ ] Empty editor
  - [ ] Network images (if any)
- [ ] Verify markdown quality
  - [ ] Compare output with Word export markdown
  - [ ] Test in external markdown editor
  - [ ] Verify GFM compatibility (GitHub, etc.)
- [ ] Cross-browser testing (if applicable)
  - [ ] VS Code webview (primary target)
- [ ] Performance check
  - [ ] Large documents (1000+ lines)
  - [ ] Complex tables
  - [ ] Response time acceptable

### Phase 5: Cleanup & Documentation
- [ ] Code review
  - [ ] Remove any debug logging
  - [ ] Ensure consistent code style
  - [ ] Add JSDoc comments to new functions
  - [ ] Verify TypeScript types are correct
- [ ] Update documentation
  - [ ] Add feature to changelog (if needed)
  - [ ] Update any user-facing docs
- [ ] Commit changes
  - [ ] Use conventional commit format
  - [ ] Include sprint reference in commit message

### Phase 6: QA & Deploy
- [ ] Invoke qa-validator agent for final checks
- [ ] Test in production build
  - [ ] Run `gulp vscode-darwin-arm64` (via vscode-expert)
  - [ ] Verify feature works in built app
- [ ] Push changes to GitHub
- [ ] Update sprint status

## Technical Approach

### Architecture Decision
Handle entirely in webview (no extension involvement):
- Simpler implementation (no IPC)
- Faster response
- Clipboard API available in webview
- Consistent with CodeBlockWithCopy pattern

### Key Functions

#### 1. Selection HTML Helper (Editor.tsx)
```typescript
export function getSelectionHTML(editor: TipTapEditor): string {
  const { from, to, empty } = editor.state.selection

  if (empty) {
    return editor.getHTML()
  }

  // Use ProseMirror DOMSerializer for selection
  const fragment = editor.state.doc.slice(from, to).content
  const schema = editor.schema
  const serializer = DOMSerializer.fromSchema(schema)
  const dom = serializer.serializeFragment(fragment)

  const div = document.createElement('div')
  div.appendChild(dom)
  return div.innerHTML
}
```

#### 2. Markdown Copy Handler (App.tsx)
```typescript
const handleCopyAsMarkdown = useCallback(async () => {
  if (!editorRef.current) return

  try {
    const html = getSelectionHTML(editorRef.current)
    const cleanedHTML = preprocessTableHTML(html)
    const markdown = markdownSerializer.turndown(cleanedHTML)

    await navigator.clipboard.writeText(markdown)
    // Trigger success feedback
  } catch (error) {
    console.error('Failed to copy:', error)
    // Show error feedback
  }
}, [])
```

### Files to Modify

1. `extensions/ritemark/webview/src/components/Editor.tsx`
   - Add DOMSerializer import
   - Add getSelectionHTML helper
   - Export for App.tsx

2. `extensions/ritemark/webview/src/App.tsx`
   - Import getSelectionHTML
   - Add handleCopyAsMarkdown
   - Pass to ExportMenu

3. `extensions/ritemark/webview/src/components/header/ExportMenu.tsx`
   - Add onCopyAsMarkdown prop
   - Add Clipboard icon import
   - Add menu item with feedback state

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| ProseMirror import path incorrect | Low | High | Verify early in Phase 2; TipTap docs confirm `@tiptap/pm` path |
| Selection HTML incomplete | Medium | High | Test thoroughly with various content types; compare with full doc |
| Clipboard API fails | Low | Medium | Add try/catch and user-friendly error message |
| TurndownService produces bad markdown | Low | Medium | Reuse existing preprocessing; already validated in Word export |
| Performance issues with large docs | Low | Low | HTML serialization is fast; defer optimization if needed |

## Status
**Current Phase:** 2 (PLAN)
**Approval Required:** Yes

## Approval
- [ ] Jarmo approved this sprint plan

---

## Notes

### Why No Extension Involvement?
- Clipboard operations don't require file I/O
- Webview has full access to navigator.clipboard API
- Simpler architecture, fewer moving parts
- Pattern already established with CodeBlockWithCopy

### Markdown Serialization Consistency
Reuse existing TurndownService configuration from Editor.tsx to ensure:
- Same output format as Word export
- Custom rules for task lists, tables, images applied
- GFM compatibility maintained

### Future Enhancements (Out of Scope)
- Copy as HTML option
- Copy selection as plain text (separate from markdown)
- Keyboard shortcut (Cmd+Shift+C)
- Copy with frontmatter properties included
