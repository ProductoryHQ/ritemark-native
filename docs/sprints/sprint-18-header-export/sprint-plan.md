# Sprint 18: Document Header & Export

## Goal
Add a minimal sticky header with Properties toggle and Export menu, enabling PDF and Word export functionality for RiteMark documents.

## Success Criteria
- [ ] Sticky header appears at top of editor and remains visible when scrolling
- [ ] Properties button opens modal (not inline panel)
- [ ] Export PDF generates readable PDF with preserved formatting
- [ ] Export Word generates .docx file that opens correctly in Word/Google Docs
- [ ] All existing editor features work without regression
- [ ] Modal closes on ESC, click outside, and X button
- [ ] Export menus show appropriate save dialogs

## Deliverables
| Deliverable | Description |
|-------------|-------------|
| DocumentHeader component | Sticky header with Properties and Export buttons |
| PropertiesModal component | Modal wrapper for existing PropertiesPanel |
| ExportMenu component | Dropdown menu for PDF/Word export options |
| PDF exporter | Electron printToPDF integration in extension |
| Word exporter | Markdown to .docx converter using `docx` package |
| Updated Editor layout | Remove inline properties, add header |
| Bridge message handlers | New message types for export actions |
| Documentation | Export feature user guide |

## Implementation Checklist

### Phase 1: Research & Discovery
- [x] Analyze current PropertiesPanel implementation
- [x] Research PDF export options (Electron vs Puppeteer)
- [x] Research Word export libraries (docx vs officegen)
- [x] Document current bridge message types
- [x] Identify file changes needed
- [x] Document risks and mitigations

### Phase 2: Header Infrastructure
- [ ] Create `DocumentHeader.tsx` component
  - [ ] Sticky positioning with proper z-index
  - [ ] Properties button (icon + text)
  - [ ] Export button (icon + text)
  - [ ] VS Code theme integration
- [ ] Update `App.tsx` to include header
- [ ] Test header stickiness with long documents
- [ ] Verify no z-index conflicts with menus

### Phase 3: Properties Modal
- [ ] Create `PropertiesModal.tsx` component
  - [ ] Modal overlay with backdrop
  - [ ] Close handlers (ESC, click outside, X button)
  - [ ] Center positioning
  - [ ] Reuse existing PropertiesPanel content
- [ ] Wire up modal state in App.tsx
- [ ] Test modal open/close behavior
- [ ] Test properties data flow (no regressions)
- [ ] Remove inline PropertiesPanel from Editor.tsx

### Phase 4: Export Menu UI
- [ ] Create `ExportMenu.tsx` dropdown component
  - [ ] Menu items: Export PDF, Export Word
  - [ ] VS Code styling
  - [ ] Click outside to close
  - [ ] Proper positioning below button
- [ ] Wire up menu to Export button
- [ ] Test menu interactions
- [ ] Add loading states for exports

### Phase 5: PDF Export Backend
- [ ] Add `exportPDF` message type to bridge.ts
- [ ] Create `export/pdfExporter.ts` in extension
  - [ ] Check Electron API availability
  - [ ] Implement printToPDF workflow
  - [ ] Show VS Code save dialog
  - [ ] Handle file save errors
- [ ] Test PDF generation with various documents
  - [ ] Headings, paragraphs, lists
  - [ ] Tables
  - [ ] Code blocks
  - [ ] Images (if supported)
- [ ] Add success/error notifications

### Phase 6: Word Export Backend
- [ ] Install `docx` package (`npm install docx` in extensions/ritemark)
- [ ] Add `exportWord` message type to bridge.ts
- [ ] Create `export/wordExporter.ts` in extension
  - [ ] Parse markdown to structure
  - [ ] Convert to docx format
    - [ ] Headings (H1-H6)
    - [ ] Paragraphs
    - [ ] Bold/italic
    - [ ] Lists (bullet, ordered, task)
    - [ ] Tables
    - [ ] Code blocks (monospace)
    - [ ] Links
    - [ ] Images (embed or reference)
  - [ ] Show VS Code save dialog
  - [ ] Save .docx file
  - [ ] Handle errors
- [ ] Test Word export with various documents
  - [ ] Simple formatting
  - [ ] Complex nested lists
  - [ ] Tables with many columns
  - [ ] Code blocks
  - [ ] Mixed content
- [ ] Add success/error notifications

### Phase 7: Testing & Validation
- [ ] Test header with empty document
- [ ] Test header with long document (scrolling)
- [ ] Test properties modal with no properties
- [ ] Test properties modal with many properties
- [ ] Test properties modal with AI panel open
- [ ] Test PDF export on all document types
- [ ] Test Word export on all document types
- [ ] Verify exports preserve frontmatter properties
- [ ] Test save dialog cancellation
- [ ] Test file system permission errors
- [ ] Check memory usage (large documents)

### Phase 8: Cleanup & Documentation
- [ ] Remove debug logging
- [ ] Add JSDoc comments to new components
- [ ] Update TypeScript types
- [ ] Create user documentation
  - [ ] How to export PDF
  - [ ] How to export Word
  - [ ] Known limitations
- [ ] Update CHANGELOG
- [ ] Final code review

## Technical Architecture

### Component Hierarchy
```
App.tsx
├── DocumentHeader.tsx
│   ├── PropertiesButton → opens PropertiesModal
│   └── ExportButton → opens ExportMenu
│       ├── Export PDF → sends 'exportPDF' message
│       └── Export Word → sends 'exportWord' message
├── PropertiesModal.tsx (conditional)
│   └── PropertiesPanel.tsx (existing, reused)
└── Editor.tsx (no inline PropertiesPanel)
```

### Message Flow

**Properties:**
```
User clicks "Properties" button
  → App sets showModal = true
  → PropertiesModal renders with PropertiesPanel
  → User edits properties
  → PropertiesPanel onChange → App.handlePropertiesChange
  → sendToExtension('propertiesChanged', { properties })
  → Extension updates document frontmatter
```

**PDF Export:**
```
User clicks "Export PDF" in menu
  → sendToExtension('exportPDF', { content, properties })
  → Extension shows save dialog
  → Extension uses Electron printToPDF
  → Extension saves file
  → Extension sends success/error notification
```

**Word Export:**
```
User clicks "Export Word" in menu
  → sendToExtension('exportWord', { markdown, properties })
  → Extension shows save dialog
  → Extension converts markdown to docx
  → Extension saves file
  → Extension sends success/error notification
```

## New Bridge Message Types

```typescript
// Webview → Extension
interface ExportPDFMessage {
  type: 'exportPDF'
  content: string        // Current markdown content
  properties: DocumentProperties
}

interface ExportWordMessage {
  type: 'exportWord'
  markdown: string       // Current markdown content
  properties: DocumentProperties
}

// Extension → Webview (reuse existing notification system)
```

## UI Design Specification

### 1. Document Header

**Asukoht:** Editori ülaosas, sticky (jääb paigale scrollimisel)

```
┌─────────────────────────────────────────────────────────────────┐
│ [📋 Properties]                                    [⬇ Export] │
└─────────────────────────────────────────────────────────────────┘
  ↑                                                        ↑
  Vasak serv, 16px padding                    Parem serv, 16px padding
```

**Mõõtmed:**
- Kõrgus: 40px
- Padding: 16px vasakul/paremal
- Border-bottom: 1px solid `var(--vscode-panel-border)`

**Stiil:**
- Background: `var(--vscode-editor-background)` (sama mis editor)
- Nupud: Ghost style (transparent bg, hover'il nähtav)

**Nupud:**

| Nupp | Ikoon | Tekst | Hover |
|------|-------|-------|-------|
| Properties | `FileText` (lucide) | "Properties" | Light gray background |
| Export | `Download` (lucide) | "Export" | Light gray background |

```css
/* Nupu stiil */
.header-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--vscode-foreground);
  font-size: 13px;
  cursor: pointer;
}

.header-btn:hover {
  background: var(--vscode-toolbar-hoverBackground);
}
```

### 2. Properties Modal

**Trigger:** Click "Properties" nupul

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    ┌─────────────────────────┐                  │
│                    │ Properties          [✕] │ ← Header         │
│                    ├─────────────────────────┤                  │
│                    │                         │                  │
│                    │  Title: [............]  │                  │
│                    │                         │                  │
│                    │  Tags:  [work] [q1] [+] │ ← Olemasolev     │
│                    │                         │    PropertiesPanel│
│                    │  Status: [Draft    ▾]   │                  │
│                    │                         │                  │
│                    │  [+ Add property]       │                  │
│                    │                         │                  │
│                    └─────────────────────────┘                  │
│                                                                 │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ ← Backdrop
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Mõõtmed:**
- Modal laius: 400px
- Max-height: 80vh
- Border-radius: 12px

**Backdrop:**
- Background: `rgba(0, 0, 0, 0.4)`
- Click = sulgeb modali

**Sulgemisviisid:**
- ✕ nupp üleval paremal
- ESC klahv
- Click backdrop'il

**Animatsioon:**
- Fade in: 150ms ease-out
- Fade out: 100ms ease-in

```css
/* Modal stiil */
.properties-modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 400px;
  max-height: 80vh;
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.24);
  z-index: 1000;
  overflow: hidden;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 999;
}
```

### 3. Export Menu (Dropdown)

**Trigger:** Click "Export" nupul

```
                                              ┌─────────────────┐
                                              │  [⬇ Export]     │ ← Nupp
                                              └────────┬────────┘
                                                       │
                                              ┌────────▼────────┐
                                              │ 📄 Export PDF   │
                                              │ 📝 Export Word  │
                                              └─────────────────┘
```

**Mõõtmed:**
- Laius: 160px
- Item height: 36px

**Positsioneering:**
- Dropdown avaneb nupu all
- Joondatud paremale (nupu paremast servast)

**Sulgemine:**
- Click menüü itemil
- Click väljaspool menüüd
- ESC klahv

```css
/* Dropdown stiil */
.export-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 160px;
  background: var(--vscode-menu-background);
  border: 1px solid var(--vscode-menu-border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
  overflow: hidden;
}

.export-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  color: var(--vscode-menu-foreground);
  cursor: pointer;
}

.export-menu-item:hover {
  background: var(--vscode-menu-selectionBackground);
}
```

### 4. Export Flow (UX)

**PDF Export:**
```
1. User clicks "Export PDF"
2. Menu closes
3. VS Code "Save As" dialog opens
   - Default filename: [document-name].pdf
   - Default location: same folder as .md file
4. User confirms save
5. Notification: "✓ Exported to meeting-notes.pdf"
   OR
   Error notification: "✗ Export failed: [reason]"
```

**Word Export:**
```
1. User clicks "Export Word"
2. Menu closes
3. VS Code "Save As" dialog opens
   - Default filename: [document-name].docx
   - Default location: same folder as .md file
4. User confirms save
5. Notification: "✓ Exported to meeting-notes.docx"
   OR
   Error notification: "✗ Export failed: [reason]"
```

### 5. Full Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ [📋 Properties]                                    [⬇ Export] │ ← HEADER (sticky)
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                                                                 │
│     # Meeting Notes                                             │
│                                                                 │
│     Today we discussed the following topics...                  │
│                                                                 │
│     ## Action Items                                             │
│                                                                 │
│     - [ ] Send follow-up email                                  │
│     - [ ] Schedule next meeting                                 │
│                                                                 │
│                                                                 │ ← EDITOR (scrolls)
│                                                                 │
│                                                                 │
│                                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
│                 VS Code Status Bar (word count etc)             │
└─────────────────────────────────────────────────────────────────┘
```

### 6. Z-index Hierarchy

| Element | Z-index |
|---------|---------|
| Editor content | 1 |
| Drag handle, + button | 50 |
| Document Header | 60 |
| Export dropdown | 100 |
| Bubble menu | 200 |
| Modal backdrop | 999 |
| Properties Modal | 1000 |

### 7. Responsive Behavior

**Kui webview on kitsas (<500px):**
- Nupud näitavad ainult ikoone (ilma tekstita)
- Modal võtab 90% laiusest

```
┌─────────────────────────────┐
│ [📋]               [⬇]     │  ← Ainult ikoonid
├─────────────────────────────┤
│                             │
│        Editor               │
│                             │
└─────────────────────────────┘
```

### 8. Dark/Light Mode

Kasutame VS Code CSS muutujaid, nii et automaatselt töötab mõlemas:

| Element | Light | Dark |
|---------|-------|------|
| Header bg | `#ffffff` | `#1e1e1e` |
| Button hover | `#e8e8e8` | `#2d2d2d` |
| Modal bg | `#ffffff` | `#252526` |
| Backdrop | `rgba(0,0,0,0.4)` | `rgba(0,0,0,0.6)` |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Electron API not available in VS Code | High - PDF export won't work | Check for Electron, fallback to HTML export or browser print |
| DOCX conversion quality | Medium - Poor Word output | Start with basic formatting, iterate based on testing |
| Image embedding in exports | Medium - Broken images | Use existing image resolution logic, embed as base64 |
| Header z-index conflicts | Low - UI overlaps | Test all menus, set proper z-index hierarchy |
| Large document performance | Low - Slow exports | Add loading indicators, consider streaming for PDF |

## Rollback Plan

If critical issues found:
1. Keep DocumentHeader but disable Export button
2. Keep PropertiesModal available via header
3. Remove export message handlers from extension
4. Commit working state
5. Debug export functionality in separate branch

## Dependencies

**New packages:**
```json
{
  "docx": "^8.5.0"
}
```

**Existing packages used:**
- `gray-matter` (frontmatter parsing)
- `lucide-react` (icons)
- VS Code API (file dialogs, notifications)

## Status
**Current Phase:** 1 (Research - Complete)
**Next Phase:** 2 (Header Infrastructure)
**Approval Required:** Yes

## Approval
- [ ] Jarmo approved this sprint plan

---

## Notes

### Design Decisions
1. **Sticky header over floating toolbar**: More predictable, always accessible
2. **Modal for properties**: Dedicated space, doesn't interrupt reading flow
3. **Electron printToPDF over Puppeteer**: Simpler, zero dependencies
4. **docx package over officegen**: Better maintained, modern API

### Future Enhancements (Not in this sprint)
- Export to HTML with styles
- Batch export multiple files
- Custom PDF templates
- Word export with custom styles
- Export keyboard shortcuts
