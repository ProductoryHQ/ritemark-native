# Sprint 14: Block Interactions

## Goal
Enhance editor block-level interactions with clickable links, copy code buttons, and Notion-style drag handles for a more polished editing experience.

## Success Criteria
- [ ] Clicking a link opens the edit dialog (Cmd+click opens in browser)
- [ ] Code blocks have a copy button with "Copied!" text feedback
- [ ] Blocks show drag handle on hover for reordering
- [ ] + button shows block insertion menu (paragraph, heading, list, etc.)
- [ ] All features work with existing markdown roundtrip

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| Link Click Handler | Click on link opens edit dialog, Cmd+click opens in browser |
| Copy Code Button | Button overlay on code blocks with "Copied!" feedback |
| Drag Handle Extension | Install and configure global drag handle |
| Block Menu (+ button) | Add block insertion menu alongside drag handle |

## Implementation Checklist

### Phase 1: Research

#### Link Click → Edit (DONE in research)
- [x] Confirmed `openOnClick: false` already configured (Editor.tsx:299)
- [x] Confirmed link dialog exists in FormattingBubbleMenu.tsx
- [x] Identified `handleOpenLinkDialog()` function to reuse
- [ ] Determine best approach: ProseMirror plugin vs Link extension override

#### Copy Code Button
- [ ] Review CodeBlockLowlight configuration (Editor.tsx:262-268)
- [ ] Research TipTap NodeView pattern for custom rendering
- [ ] Identify CSS positioning for button overlay
- [ ] Choose copy feedback approach (tooltip vs button state change)

#### Drag Handle
- [ ] Review `@tiptap/extension-drag-handle` documentation
- [ ] Compare with `tiptap-extension-global-drag-handle` (third-party)
- [ ] Check React variant: `@tiptap/extension-drag-handle-react`
- [ ] Design handle appearance (icon, position, hover behavior)

### Phase 2: Link Click to Edit

#### Implementation
- [ ] Create ProseMirror plugin to intercept link clicks
- [ ] Store clicked link node reference for editing
- [ ] Trigger existing `handleOpenLinkDialog()` with link data
- [ ] Ensure cursor placement after edit

#### Testing
- [ ] Click link → dialog opens with correct URL
- [ ] Edit URL → link updates correctly
- [ ] Remove link → text preserved
- [ ] Cancel → no changes made

### Phase 3: Copy Code Button

#### Extension Setup
- [ ] Create `CodeBlockWithCopy.tsx` custom NodeView component
- [ ] Extend CodeBlockLowlight with custom nodeViewRenderer
- [ ] Add copy button with Lucide `Copy` or `Clipboard` icon
- [ ] Position button in top-right corner of code block

#### Copy Functionality
- [ ] Implement `navigator.clipboard.writeText()` for copy
- [ ] Add visual feedback (icon change to checkmark, 2s duration)
- [ ] Handle copy failure gracefully (fallback or error state)

#### Styling
- [ ] Button appears on code block hover
- [ ] Button has semi-transparent background
- [ ] Smooth fade transition on hover
- [ ] Matches dark theme of code blocks

### Phase 4: Drag Handle

#### Installation
- [ ] Install `@tiptap/extension-drag-handle` in webview
- [ ] Or install `tiptap-extension-global-drag-handle` (community)
- [ ] Verify version compatibility with TipTap ^2.1.0

#### Configuration
- [ ] Add DragHandle extension to Editor.tsx
- [ ] Configure handle positioning (left side of blocks)
- [ ] Set up hover behavior (show on block hover)
- [ ] Configure which node types show handles

#### Styling
- [ ] Create `.drag-handle` CSS styles
- [ ] Use grip/drag icon (Lucide `GripVertical`)
- [ ] Match Ritemark design language (indigo accent)
- [ ] Add hover state styling

#### Optional: + Button Menu
- [ ] Add "+" button alongside drag handle
- [ ] On click, show block type menu (similar to slash commands)
- [ ] Insert selected block type at position
- [ ] This is a stretch goal - can defer to future sprint

### Phase 5: Testing & Validation

#### Link Click Testing
- [ ] Single click on link opens edit dialog
- [ ] Cmd+click still opens link in browser (if desired)
- [ ] Works with internal links (relative paths)
- [ ] Works with external links (http/https)

#### Copy Button Testing
- [ ] Copy button visible on hover
- [ ] Click copies all code in block
- [ ] Works with syntax-highlighted code
- [ ] Works with multi-line code
- [ ] Feedback animation plays correctly

#### Drag Handle Testing
- [ ] Handle appears on block hover
- [ ] Drag and drop reorders blocks
- [ ] Works with paragraphs, headings, lists
- [ ] Works with code blocks, tables, images
- [ ] Undo restores original order

#### Roundtrip Testing
- [ ] All features preserve markdown on save
- [ ] No HTML artifacts introduced
- [ ] Document structure unchanged after interactions

## Status

**Current Phase:** Phase 2 - Implementation (approved 2025-12-19)

## Risks & Considerations

| Risk | Mitigation |
|------|------------|
| Link click conflicts with selection | Use mousedown vs click events carefully |
| NodeView complexity for code blocks | Start simple, iterate |
| Drag handle only works on top-level nodes | Document limitation, acceptable for v1 |
| Performance with many blocks | Test with large documents |

## Decisions Made

1. **Link click behavior:** Cmd+click opens link in browser, regular click opens edit dialog ✅
2. **Copy button feedback:** Show "Copied!" text feedback (not just icon change) ✅
3. **+ button:** Include in this sprint ✅
4. **Drag handle scope:** All top-level blocks (default behavior)

## Technical Notes

### Link Click Implementation Options

**Option 1: ProseMirror Plugin**
```typescript
// Add plugin to handleClick
new Plugin({
  props: {
    handleClick(view, pos, event) {
      const link = view.state.doc.nodeAt(pos)?.marks.find(m => m.type.name === 'link')
      if (link) {
        // Open edit dialog
        return true
      }
      return false
    }
  }
})
```

**Option 2: Extend Link Extension**
```typescript
Link.extend({
  addProseMirrorPlugins() {
    return [
      ...this.parent?.() || [],
      // Custom click handler plugin
    ]
  }
})
```

### Copy Button Component Pattern

```typescript
// CodeBlockWithCopy.tsx
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import { Copy, Check } from 'lucide-react'

export function CodeBlockWithCopy({ node }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(node.textContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <NodeViewWrapper as="pre" className="tiptap-code-block relative">
      <button onClick={handleCopy} className="copy-button">
        {copied ? <Check /> : <Copy />}
      </button>
      <NodeViewContent as="code" />
    </NodeViewWrapper>
  )
}
```

### Drag Handle Package Options

| Package | Pros | Cons |
|---------|------|------|
| `@tiptap/extension-drag-handle` | Official, maintained | May need React wrapper |
| `@tiptap/extension-drag-handle-react` | Official React support | Check availability |
| `tiptap-extension-global-drag-handle` | 1,500+ dependents, proven | Third-party maintenance |

## References

- [TipTap Link Extension](https://tiptap.dev/docs/editor/extensions/marks/link)
- [TipTap Drag Handle](https://tiptap.dev/docs/editor/extensions/functionality/drag-handle)
- [TipTap React NodeViews](https://tiptap.dev/docs/editor/extensions/custom-extensions/node-views/react)
- [tiptap-extension-global-drag-handle](https://github.com/NiclasDev63/tiptap-extension-global-drag-handle)
- [ProseMirror Plugin API](https://prosemirror.net/docs/ref/#state.Plugin)

## Approval

- [x] Jarmo approved this sprint plan ✅ (2025-12-19)
- [x] Phase 1 research complete
- [x] Solutions reviewed and approved

---

*Sprint plan created: 2025-12-19*
