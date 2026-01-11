# Sprint 18 Research: Document Header & Export

## Research Date
2026-01-11

## Overview
RiteMark needs a sticky header bar with Properties toggle and Export functionality. This addresses two UX issues:
1. Properties panel feels "awkward" hanging inline
2. Missing export functionality (PDF, Word)

## Current State Analysis

### Properties Panel
- **Location**: `extensions/ritemark/webview/src/components/properties/PropertiesPanel.tsx`
- **Current behavior**: Inline at top of editor, collapsible with chevron
- **Empty state**: Small "+ Add properties" button in top-right
- **Populated state**: Header bar with "Properties (N)" and Add button
- **Data flow**:
  - Properties stored in frontmatter (YAML)
  - Managed by `ritemarkEditor.ts` via `gray-matter` package
  - Synced via bridge messages: `propertiesChanged` and `contentChanged`

### Editor Structure
- **Main component**: `extensions/ritemark/webview/src/App.tsx`
- **Editor component**: `extensions/ritemark/webview/src/components/Editor.tsx`
- **Layout**: Full-height container with editor content
- **Communication**: Bridge pattern (`bridge.ts`) for extension ↔ webview messages

### Current Message Types (bridge.ts)
```typescript
// Webview → Extension
- 'ready': Initial load
- 'contentChanged': Content + properties update
- 'propertiesChanged': Properties-only update
- 'saveImage': Image paste/drop handler
- 'selectionChanged': Text selection for AI
- 'wordCountChanged': Word count updates
- 'ai-configure-key': Open settings

// Extension → Webview
- 'load': Document content + properties + imageMappings
- 'ai-widget': AI tool execution
- 'imageSaved': Image save success
- 'imageError': Image save failure
```

## Technical Research

### Export to PDF

#### Option 1: Electron's printToPDF (RECOMMENDED)
**Pros:**
- Built into Electron, no dependencies
- Native print-to-PDF functionality
- Good quality output
- Can use CSS for styling

**Cons:**
- Must be called from extension (main process)
- Requires webview content to be printable

**Implementation:**
```typescript
// In extension (ritemarkEditor.ts)
const result = await webview.postMessage({ type: 'exportPDF' })
// Use Electron's BrowserWindow.webContents.printToPDF()
```

**VS Code API:**
- VS Code extensions run in Electron environment
- Can access Electron APIs if available
- May need to check `process` object for Electron APIs

#### Option 2: Puppeteer
**Pros:**
- High-quality PDF rendering
- Full Chrome engine

**Cons:**
- Heavy dependency (~300MB)
- Requires bundling Chromium
- Overkill for this use case

**Decision:** Use Electron's printToPDF for simplicity and zero dependencies.

### Export to Word (.docx)

#### Recommended: `docx` npm package
**Package:** `docx` (https://www.npmjs.com/package/docx)
**Current downloads:** ~1M/week
**Size:** ~200KB

**Pros:**
- Pure JavaScript, works in Node.js
- Programmatic DOCX creation
- Good API for paragraphs, headings, lists, tables
- Active maintenance

**Implementation approach:**
1. Convert markdown → JSON structure (already have markdown)
2. Build DOCX using `docx` library
3. Save via VS Code's file system API

**Code sketch:**
```typescript
import { Document, Paragraph, TextRun, HeadingLevel } from 'docx'
import { Packer } from 'docx'

// Parse markdown into structure
const blocks = parseMarkdownBlocks(markdown)

// Build DOCX
const doc = new Document({
  sections: [{
    children: blocks.map(block => convertBlockToDocx(block))
  }]
})

// Generate buffer
const buffer = await Packer.toBuffer(doc)

// Save via VS Code
await vscode.workspace.fs.writeFile(uri, buffer)
```

**Alternative considered:** `officegen`
- Less maintained
- Older API
- Decision: Use `docx`

### Markdown to DOCX Conversion Challenges

**What needs conversion:**
- [x] Headings (H1-H6) → Heading styles
- [x] Paragraphs → Normal text
- [x] Bold/italic → Text runs with formatting
- [x] Lists (bullet, ordered, task) → List items
- [x] Links → Hyperlinks
- [x] Code blocks → Monospace paragraphs
- [x] Tables → Table objects
- [x] Images → Image references (may need to embed)
- [x] Blockquotes → Indented paragraphs

**Potential parser:**
- Option 1: Use existing `marked` library (already in project)
- Option 2: Use TipTap editor's JSON output (cleaner)
- **Decision:** Use TipTap's `editor.getJSON()` - it's already structured

## UI Design

### Proposed Header Layout
```
┌─────────────────────────────────────────────┐
│ [📋 Properties]                 [⬇ Export] │  ← Sticky header
├─────────────────────────────────────────────┤
│                                             │
│              Editor                         │
```

**Header specs:**
- Position: `position: sticky; top: 0; z-index: 10`
- Height: ~40px
- Background: VS Code editor background
- Border-bottom: 1px solid divider color
- Padding: 8px 16px
- Layout: Flexbox with space-between

**Properties button:**
- Icon: 📋 or similar (lucide-react has `FileText`)
- Text: "Properties"
- Opens modal on click

**Export button:**
- Icon: ⬇ (lucide-react has `Download`)
- Text: "Export"
- Dropdown menu with:
  - Export PDF
  - Export Word

### Properties Modal

**Why modal instead of inline:**
- Frontmatter can be large (10+ properties)
- Current inline panel interrupts reading flow
- Modal provides dedicated space

**Modal specs:**
- Overlay: Semi-transparent backdrop
- Container: Centered, max-width 600px
- Content: Existing PropertiesPanel component (reuse!)
- Close: X button, ESC key, click outside

**Component structure:**
```tsx
<PropertiesModal
  isOpen={showProperties}
  onClose={() => setShowProperties(false)}
  properties={properties}
  hasProperties={hasProperties}
  onChange={handlePropertiesChange}
/>
```

## Export Dropdown Menu

**Component:** Custom dropdown or use existing VS Code-style menu
- Trigger: Export button
- Menu items:
  1. Export PDF
  2. Export Word

**Behavior:**
1. User clicks "Export PDF" or "Export Word"
2. Show VS Code save dialog
3. Generate file
4. Save to chosen location
5. Show success notification

## Implementation Strategy

### Phase 1: Header Infrastructure
1. Create `DocumentHeader.tsx` component
2. Add to `App.tsx` above Editor
3. Style with sticky positioning
4. Wire up properties toggle (opens existing panel in modal)

### Phase 2: Properties Modal
1. Create `PropertiesModal.tsx` wrapper
2. Reuse existing `PropertiesPanel` content
3. Add modal overlay and close handlers
4. Test with existing properties data

### Phase 3: Export PDF
1. Add "exportPDF" message handler in extension
2. Use Electron's printToPDF API
3. Show save dialog
4. Generate PDF from webview content
5. Save to disk

### Phase 4: Export Word
1. Install `docx` package
2. Create markdown→docx converter
3. Add "exportWord" message handler
4. Show save dialog
5. Generate and save .docx file

## Dependencies to Add

```json
{
  "dependencies": {
    "docx": "^8.5.0"  // For Word export
  }
}
```

Note: PDF export uses Electron APIs (no new deps needed)

## File Changes Summary

**New files:**
- `extensions/ritemark/webview/src/components/DocumentHeader.tsx`
- `extensions/ritemark/webview/src/components/PropertiesModal.tsx`
- `extensions/ritemark/webview/src/components/ExportMenu.tsx`
- `extensions/ritemark/src/export/pdfExporter.ts`
- `extensions/ritemark/src/export/wordExporter.ts`

**Modified files:**
- `extensions/ritemark/webview/src/App.tsx` (add header)
- `extensions/ritemark/webview/src/components/Editor.tsx` (remove inline properties)
- `extensions/ritemark/src/ritemarkEditor.ts` (add export handlers)
- `extensions/ritemark/webview/src/bridge.ts` (add export message types)
- `extensions/ritemark/package.json` (add docx dependency)

## Risks & Considerations

### Risk 1: Electron API Access
**Issue:** VS Code extensions may not have direct Electron API access
**Mitigation:** Test Electron availability, fallback to HTML export if needed

### Risk 2: DOCX Quality
**Issue:** Complex markdown (nested lists, tables) may not convert perfectly
**Mitigation:** Start with basic formatting, iterate on edge cases

### Risk 3: Image Handling in Exports
**Issue:** Images with relative paths need to be resolved and embedded
**Mitigation:** Use existing image path resolution logic from editor

### Risk 4: Header Z-Index Conflicts
**Issue:** Sticky header may conflict with editor menus (bubble menu, block menu)
**Mitigation:** Set appropriate z-index hierarchy, test all menu interactions

## Success Criteria

1. Sticky header visible at all times when scrolling
2. Properties button opens modal with existing properties UI
3. Export PDF generates readable PDF with formatting preserved
4. Export Word generates .docx file that opens in Word/GDocs
5. No regressions in existing editor functionality
6. All tests pass

## Next Steps (Phase 2: Plan)

After Jarmo reviews this research, proceed to create detailed sprint plan with:
1. Component hierarchy diagram
2. Step-by-step implementation checklist
3. Test scenarios
4. Rollback plan if needed
