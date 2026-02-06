# Sprint 32: UX Design — PDF/DOCX Preview & CSV Editing

## Design Philosophy

PDF and DOCX viewers are part of the **Text Editor** feature family — not separate standalone tools. They must feel like natural extensions of the Ritemark writing experience.

**Core principles:**
- **Document-focused**: Minimal chrome, maximum content
- **Content fidelity**: PDF and DOCX content renders **as-is** — we do NOT restyle document content. The original author's formatting must remain intact
- **Consistent chrome**: Toolbars, buttons, loading states, error states follow Ritemark visual language — the UI _around_ the document is Ritemark, the document itself is untouched
- **Ghost button UI**: Transparent buttons, subtle hover states, 6px border-radius
- **40px sticky toolbars**: Consistent header pattern across all viewer types
- **shadcn/ui from day one**: Use shadcn components for all new UI

* * *

## Ritemark Visual DNA (Existing Patterns)

| Element | Value |
|---------|-------|
| Editor body font | 18px, line-height 1.7 |
| Content max-width | 900px, centered |
| Primary action color | `#4338ca` (indigo-700) |
| Heading color | `#111827` (gray-900) |
| Body text color | `#374151` (gray-700) |
| Muted text | `#9ca3af` (gray-400) |
| Borders | `var(--vscode-panel-border)` |
| Button style | Ghost, transparent, hover background |
| Toolbar height | 40px, sticky, border-bottom |

**Existing shadcn/ui components already in use:** Button, Dialog, Input, Select, Label, Progress, Alert, plus `cn()` utility.

* * *

## PDF Viewer Design

### Concept: "Document Reader" Mode

The PDF viewer feels like a read-only version of the markdown editor — same visual weight, same document focus, minimal chrome.

### Layout

```
┌─────────────────────────────────────────────────────────┐
│ [report.pdf]          [1] / 24  [-] [100%] [+]    [⟳]  │  ← Toolbar (40px)
├─────────────────────────────────────────────────────────┤
│                                                          │
│    ┌────────────────────────────────────────┐            │
│    │         [PDF Page 1 Content]           │            │  ← Page with shadow
│    │         Rendered as canvas             │            │
│    └────────────────────────────────────────┘            │
│                                                          │
│    ─────────────────────────────────────────             │  ← Page divider
│                                                          │
│    ┌────────────────────────────────────────┐            │
│    │         [PDF Page 2 Content]           │            │
│    └────────────────────────────────────────┘            │
│                                                          │
│    (Continuous scroll — pages lazy-loaded)               │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Toolbar Controls (left → right)

1. **Filename** (left, gray text — matches SpreadsheetToolbar)
2. **Spacer**
3. **Page navigation** (center-right): Editable page input `[1]` + total `/ 24`
4. **Zoom controls**: `[-]` `[100%]` `[+]` — percentage clickable for dropdown (50%, 75%, 100%, 125%, 150%, 200%, Fit Width, Fit Page)
5. **Refresh button** (rightmost, with file-changed badge)

### Rendering: Continuous Scroll (recommended)

- All pages in a single scrolling container (like reading a document)
- Pages separated by subtle shadow + gap
- Lazy rendering as user scrolls (performance)
- Matches Ritemark's "document reading" paradigm

### Page Styling

```css
.pdf-page {
  margin-bottom: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--vscode-panel-border);
  background: white;  /* PDF canvas always white */
}
```

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Arrow Up/Down | Scroll |
| Page Up/Down | Jump to prev/next page boundary |
| Cmd/Ctrl+0 | Reset zoom to 100% |
| Cmd/Ctrl+Plus/Minus | Zoom in/out |

### shadcn components: Button (ghost), DropdownMenu (zoom), Input (page number), Tooltip (icon hints)

* * *

## DOCX Viewer Design

### Concept: Faithful Document Rendering

DOCX content renders **as-is** — the original author's formatting must remain intact. We do NOT apply Ritemark editor styles to the document content. mammoth converts DOCX to HTML preserving the document's own structure, and we render that HTML with minimal, neutral styling.

The Ritemark touch is in the **chrome** (toolbar, loading states, error handling) — not the content.

### Layout

```
┌─────────────────────────────────────────────────────────┐
│ [draft.docx]                          [Open in Word] [⟳] │  ← Minimal toolbar
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Meeting Notes                                           │
│                                                          │
│  Date: January 15, 2026                                  │
│  Attendees: Alice, Bob, Charlie                          │
│                                                          │
│  Action Items                                            │
│                                                          │
│  • Review Q4 results                                     │
│  • Prepare budget proposal                               │
│                                                          │
│  (Content rendered faithfully from DOCX)                 │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Toolbar (simpler than PDF)

1. **Filename** (left)
2. **Spacer**
3. **"Open in Word" button** (if Word installed — matches CSV external app pattern)
4. **Refresh button** (rightmost)

### Content Styling

Minimal container styling only — do NOT override document formatting:

```css
.docx-viewer-content {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
  overflow-wrap: break-word;
}

/* Only provide sensible defaults where mammoth output has none */
.docx-viewer-content img {
  max-width: 100%;  /* Prevent images from overflowing */
  height: auto;
}

.docx-viewer-content table {
  border-collapse: collapse;
  width: 100%;
}

.docx-viewer-content table td,
.docx-viewer-content table th {
  border: 1px solid var(--vscode-panel-border);
  padding: 0.5rem;
}
```

mammoth's HTML output carries the document's own semantic structure. We provide sensible defaults for elements that need them (images, tables) but do NOT force fonts, colors, or spacing.

### Edge Cases

- Complex formatting: Show subtle banner if unsupported features detected
- Large images: Auto-scale to max-width (prevent overflow)
- Tables: Minimal border styling only where DOCX has none
- Links: Cmd+Click opens in browser
- Embedded fonts: Not supported — system fonts used as fallback (acceptable)

### shadcn components: Button (ghost), Alert (formatting warning)

* * *

## CSV Editing Improvements

### 1. Column Sorting

**Click header to sort:**
- Click once → ascending (↑ arrow)
- Click again → descending (↓ arrow)
- Click third time → remove sort (no arrow)
- Arrow appears inline with header text
- Uses TanStack Table built-in sorting

```
│ #  │ Name ↑  │ Age  │ Email              │
```

### 2. Add/Delete Rows & Columns

**Toolbar buttons for common actions:**

```
┌───────────────────────────────────────────────────────┐
│ contacts.csv       [+ Row] [+ Column]       [⟳] [↑]  │
└───────────────────────────────────────────────────────┘
```

**Context menu for detailed operations:**

Right-click column header:
```
┌─────────────────────┐
│ Sort Ascending  ↑   │
│ Sort Descending ↓   │
│ ────────────────    │
│ Insert Left         │
│ Insert Right        │
│ Rename...           │
│ ────────────────    │
│ Delete Column       │
└─────────────────────┘
```

Right-click row number:
```
┌─────────────────────┐
│ Insert Row Above    │
│ Insert Row Below    │
│ ────────────────    │
│ Delete Row          │
└─────────────────────┘
```

### 3. Multi-line Cell Editing

Replace `<input>` with `<textarea>` in EditableCell:

- **Enter**: Save and exit cell
- **Shift+Enter**: Insert newline
- **Escape**: Cancel edit
- Textarea auto-sizes based on content (min 2rem height, max 10 lines)
- Non-editing cells show `whitespace-pre-wrap` to preserve newlines

### shadcn components: Button (toolbar), DropdownMenu (column actions), ContextMenu (row right-click), Dialog (rename column), Textarea (multi-line cells)

* * *

## Shared Toolbar Pattern

All viewer toolbars use consistent structure:

```tsx
<header className="h-10 sticky top-0 z-60 border-b flex items-center px-3">
  {/* Left: Filename */}
  <span className="text-muted-foreground text-sm">{filename}</span>

  {/* Center: Spacer */}
  <div className="flex-1" />

  {/* Right: Viewer-specific controls + Refresh */}
  {viewerControls}
  <Button variant="ghost" size="icon">
    <RefreshCw size={16} />
  </Button>
</header>
```

* * *

## shadcn/ui Adoption Plan

### New Components for Sprint 32

| Component | Use Case |
|-----------|----------|
| DropdownMenu | PDF zoom picker, CSV column actions |
| ContextMenu | CSV row right-click menu |
| Textarea | CSV multi-line cell editing |
| Tooltip | All icon-only toolbar buttons |

### Existing Components to Reuse

| Component | Already Available |
|-----------|-------------------|
| Button | Yes (ghost variant for toolbars) |
| Dialog | Yes (rename column modal) |
| Input | Yes (PDF page number) |
| Alert | Yes (DOCX formatting warning) |
| Progress | Yes (loading states) |

* * *

## File Structure

```
webview/src/components/
├── viewers/
│   ├── PDFViewer.tsx           # New
│   ├── DOCXViewer.tsx          # New
│   └── SpreadsheetViewer.tsx   # Existing (enhanced)
├── header/
│   ├── DocumentHeader.tsx      # Existing (markdown)
│   ├── SpreadsheetToolbar.tsx  # Existing (enhanced with + Row/Column)
│   ├── PDFToolbar.tsx          # New
│   └── DOCXToolbar.tsx         # New
├── ui/                         # shadcn components
│   ├── button.tsx              # Existing
│   ├── dialog.tsx              # Existing
│   ├── dropdown-menu.tsx       # New
│   ├── context-menu.tsx        # New
│   ├── textarea.tsx            # New
│   └── tooltip.tsx             # New
└── DataTable.tsx               # Existing (enhanced with sort + context menus)
```

* * *

## Loading & Error States

### Loading
```
Centered: [Progress bar] Loading {filename}...
```

### Error
```
[AlertCircle icon]
Failed to load {filename}
{error message}
[Try Again button]
```

### Empty
- PDF: "This PDF appears to be empty"
- DOCX: "This document appears to be empty"

* * *

*Last updated: 2026-02-05*
