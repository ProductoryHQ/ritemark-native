# Sprint 26 UI Reference

## Blockquote Button Design

**Reference Screenshot:** `docs/sprints/images/image-1769619933029.png`

### Current Bubble Menu Layout
```
[B] [I] | [H1] [H2] [H3] | [•] [1.] [✓] | [🔗] | [📋]
 ↑       ↑                 ↑              ↑      ↑
Bold    Headings          Lists         Link   Table
Italic                                          (REMOVE)
```

### Desired Bubble Menu Layout
```
[B] [I] | [H1] [H2] [H3] | [•] [1.] [✓] | ["] | [🔗]
 ↑       ↑                 ↑              ↑     ↑
Bold    Headings          Lists         Quote  Link
Italic                                  (NEW)
```

### Implementation Notes

**Blockquote Icon:**
- Lucide icon: `Quote` (already used in BlockMenu.tsx)
- Size: 16px (consistent with other icons)
- Visual: Speech bubble quote mark

**Button Placement:**
- **After:** Task List button
- **Before:** Link button
- **Between dividers:** `<div className="w-px h-6 bg-gray-300 mx-1" />`

**Button Code Pattern:**
```tsx
{/* Blockquote Button - Toggle blockquote formatting */}
<button
  onMouseDown={(e) => e.preventDefault()}
  onClick={() => editor.chain().focus().toggleBlockquote().run()}
  className={`px-3 py-1 rounded text-sm hover:bg-gray-100 transition-colors flex items-center ${
    editor.isActive('blockquote') ? 'bg-gray-200' : ''
  }`}
  title="Quote"
>
  <Quote size={16} />
</button>
```

### Visual Design Details

**Active State (when cursor is in blockquote):**
- Background: `bg-gray-200` (light gray)
- Border: None (consistent with other buttons)

**Hover State:**
- Background: `bg-gray-100` (lighter gray)
- Transition: `transition-colors` (smooth fade)

**Icon Color:**
- Default: Inherits text color (dark gray)
- Active: Same (no color change, just background)

### Behavior

**Toggle Pattern:**
- First click: Wraps selected text/paragraph in blockquote
- Second click: Unwraps blockquote (returns to paragraph)
- Empty selection: Converts current paragraph to blockquote

**Keyboard Shortcut:**
- None (avoid conflicts, TipTap doesn't define default)
- User can use bubble menu or BlockMenu (+ button)

### Accessibility

**ARIA Labels:**
- `title="Quote"` (shows on hover)
- Consider adding `aria-label="Toggle blockquote"` for screen readers

**Focus States:**
- Browser default focus outline (blue ring)
- Tab navigation: Yes (button is in natural tab order)

## Table Button Removal

### Current Table Button Location
- **Position:** After Link button
- **Divider:** Has divider before it (`<div className="w-px h-6 bg-gray-300 mx-1" />`)
- **Icon:** `<Table size={16} />`
- **Dialog:** Opens TablePicker in Radix Dialog

### Lines to Remove (FormattingBubbleMenu.tsx)

**1. Icon Import (line ~3):**
```tsx
import { Link2, Check, X, Table, List, ... } from 'lucide-react'
//                          ^^^^^ REMOVE
```

**2. Table Dialog State (line ~86):**
```tsx
const [showTableDialog, setShowTableDialog] = useState(false)
// REMOVE entire line
```

**3. Divider + Button (lines ~323-334):**
```tsx
{/* Visual divider between links and tables */}
<div className="w-px h-6 bg-gray-300 mx-1" />

{/* Table Button - Opens Dialog */}
<button
  onClick={() => setShowTableDialog(true)}
  onMouseDown={(e) => e.preventDefault()}
  className="px-3 py-1 rounded text-sm hover:bg-gray-100 transition-colors flex items-center"
  title="Insert Table"
>
  <Table size={16} />
</button>
// REMOVE entire block (divider + button)
```

**4. Table Dialog JSX (lines ~424-438):**
```tsx
{/* Table Dialog - Separate modal for table insertion */}
<Dialog.Root open={showTableDialog} onOpenChange={setShowTableDialog}>
  <Dialog.Portal>
    <Dialog.Overlay className="..." />
    <Dialog.Content className="...">
      <Dialog.Title>Insert Table</Dialog.Title>
      <TablePicker editor={editor} onClose={() => setShowTableDialog(false)} />
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
// REMOVE entire Dialog.Root block
```

### Table Insertion Alternatives (Verify/Add if Missing)

**Slash Command:** `/table` (SlashCommands.tsx line ~128-140)
- Already exists, inserts 3x3 table with header row

**BlockMenu:** Check if present (BlockMenu.tsx)
- Need to verify if table is in block items list
- If missing, add to blockItems array:
  ```tsx
  {
    title: 'Table',
    description: 'Insert a 3x3 table',
    icon: <Table size={18} />,
    nodeType: 'table',
    // Special handling: Use insertTable command
  }
  ```

## Screenshot Reference

**File:** `docs/sprints/images/image-1769619933029.png`

**Shows:**
- Bubble menu with checkmark icon (task list)
- Annotation: "Add quote style to bubble menu"
- Context: Task list item is shown with checkmark icon

**Interpretation:**
- User wants blockquote in the formatting toolbar
- Checkmark icon is for task lists (already present)
- Quote icon should be added in similar style

**Visual Consistency:**
- All icons are 16px Lucide icons
- Gray on white background
- Simple, minimal design
- Consistent spacing and padding
