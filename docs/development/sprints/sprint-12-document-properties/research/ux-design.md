# UX Design: Document Properties

## User Story

As a **non-technical writer**, I want to **add and view document metadata** (title, tags, date, etc.) so that I can **organize my documents and prepare them for publishing** without having to learn YAML syntax.

---

## Terminology Decision

Based on research across Notion, Obsidian, Bear, Ulysses, Ghost, and WordPress:

| Term to USE | Why |
|-------------|-----|
| **"Properties"** | Notion & Obsidian use this; familiar to modern users |
| **"Document Properties"** | Full form when needed for clarity |

| Term to AVOID | Why |
|---------------|-----|
| "Front-matter" | Technical jargon |
| "YAML" | Code terminology |
| "Metadata" | Too abstract |

---

## Design Options Evaluated

### Option A: Top Header Panel (Recommended)

**Concept**: Collapsible panel at the top of the document, above the editor content.

```
┌──────────────────────────────────────────────────────────┐
│ [⌄] Properties (3)                              [+ Add]  │ ← Collapsed state
└──────────────────────────────────────────────────────────┘
│                                                          │
│  Your document content starts here...                    │
│                                                          │

              ↓ Click to expand ↓

┌──────────────────────────────────────────────────────────┐
│ [⌃] Properties                                  [+ Add]  │
├──────────────────────────────────────────────────────────┤
│  Title    │ My Document Title                       │    │
│  Author   │ Jarmo Tuisk                             │    │
│  Tags     │ [blog] [tutorial] [+]                   │    │
│  Date     │ 📅 2025-12-13                           │    │
│  Status   │ ○ Draft  ● Published                    │    │
└──────────────────────────────────────────────────────────┘
```

**Pros**:
- Always visible context
- Matches Obsidian's familiar pattern
- Properties are part of document flow
- Easy to scan before editing

**Cons**:
- Takes vertical space
- May feel cluttered for simple notes

**Discoverability**:
- Properties icon in toolbar
- Keyboard shortcut: `Cmd+Shift+P`
- Auto-show when file has existing properties

---

### Option B: Right Sidebar Panel

**Concept**: Properties appear in a slide-out panel on the right side.

```
┌────────────────────────────┬──────────────────┐
│                            │ Properties   [×] │
│  Document content here     │                  │
│                            │ Title:           │
│                            │ ┌──────────────┐ │
│                            │ │ My Document  │ │
│                            │ └──────────────┘ │
│                            │                  │
│                            │ Tags:            │
│                            │ [blog] [+]       │
│                            │                  │
└────────────────────────────┴──────────────────┘
```

**Pros**:
- Doesn't interrupt writing flow
- Familiar pattern from Ghost/WordPress
- Can stay open while editing

**Cons**:
- Reduces editor width
- Competes with AI sidebar
- Properties feel "separate" from document

---

### Option C: Modal Dialog

**Concept**: Properties open in a centered modal overlay.

```
┌────────────────────────────────────────────┐
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │       Document Properties            │  │
│  │                                      │  │
│  │  Title: [_________________]          │  │
│  │  Tags:  [blog] [tutorial] [+]        │  │
│  │  Date:  📅 2025-12-13                │  │
│  │                                      │  │
│  │        [Cancel]  [Save]              │  │
│  └──────────────────────────────────────┘  │
│                                            │
└────────────────────────────────────────────┘
```

**Pros**:
- No layout changes
- Clear focus on properties
- Existing dialog pattern in codebase

**Cons**:
- Requires explicit open/close
- Can't see properties while editing
- More clicks to access

---

## Recommendation: Option A (Header Panel)

**Why Header Panel wins**:

1. **Context**: Properties are logically "about" the document, so they belong at the top
2. **Persistence**: Can see properties while editing (collapsed shows count)
3. **Familiar**: Matches Obsidian, which many markdown users know
4. **Non-intrusive**: Collapsed by default = minimal impact on writing
5. **Integration**: Fits naturally in webview architecture

---

## Detailed Interaction Design

### 1. Entry Points

| Trigger | Action |
|---------|--------|
| Properties icon in toolbar | Toggle panel open/closed |
| `Cmd+Shift+P` | Toggle panel open/closed |
| File has existing properties | Panel shown collapsed with count |
| New file | No panel shown until user adds property |

### 2. Collapsed State

```
┌──────────────────────────────────────────────────────────┐
│ [⌄] Properties (3)                              [+ Add]  │
└──────────────────────────────────────────────────────────┘
```

- Shows property count
- Click chevron OR panel to expand
- `[+ Add]` button visible even when collapsed
- Subtle background color (light gray) to distinguish from content

### 3. Expanded State

```
┌──────────────────────────────────────────────────────────┐
│ [⌃] Properties                                  [+ Add]  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Title         My Document Title                    [×]  │
│  ─────────────────────────────────────────────────────── │
│  Author        Jarmo Tuisk                          [×]  │
│  ─────────────────────────────────────────────────────── │
│  Tags          [blog] [tutorial] [2025]             [×]  │
│  ─────────────────────────────────────────────────────── │
│  Date          📅 December 13, 2025                 [×]  │
│  ─────────────────────────────────────────────────────── │
│  Status        ○ Draft  ● Published                 [×]  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

- Each row: Label | Value | Delete button
- Click value to edit inline
- Thin separator lines between properties
- Delete (`×`) removes property from document

### 4. Adding a Property

Click `[+ Add]` → Dropdown appears:

```
┌─────────────────────┐
│ Common              │
│  ├ Title            │
│  ├ Author           │
│  ├ Date             │
│  ├ Tags             │
│  └ Status           │
├─────────────────────┤
│ Custom              │
│  └ Custom field...  │
└─────────────────────┘
```

- **Common properties**: Pre-defined with appropriate input types
- **Custom field**: Opens inline input for key name, then value

### 5. Property Types & Inputs

| Property | Input Type | Example |
|----------|------------|---------|
| Title | Text input | "My Blog Post" |
| Author | Text input | "Jarmo Tuisk" |
| Date | Date picker | 📅 2025-12-13 |
| Tags | Tag chips + autocomplete | [blog] [tutorial] [+] |
| Status | Radio buttons | ○ Draft ● Published |
| Custom | Text input (key: value) | description: "..." |

### 6. Tags Input UX

```
Tags: [blog ×] [tutorial ×] [_______]
                              ↑ Type to add
```

- Existing tags shown as chips with × to remove
- Empty input for adding new tags
- Autocomplete from existing tags in workspace
- Press Enter or comma to add tag
- Click chip to edit

### 7. Visual States

**Empty state** (no properties yet):
```
┌──────────────────────────────────────────────────────────┐
│          Add properties to organize your document        │
│                      [+ Add Property]                    │
└──────────────────────────────────────────────────────────┘
```

**Error state** (invalid YAML in source):
```
┌──────────────────────────────────────────────────────────┐
│ ⚠️ Properties couldn't be read         [Edit as text]    │
└──────────────────────────────────────────────────────────┘
```

---

## Keyboard Navigation

| Key | Action |
|-----|--------|
| `Cmd+Shift+P` | Toggle properties panel |
| `Tab` | Move to next property field |
| `Shift+Tab` | Move to previous property field |
| `Enter` | Confirm edit / Add tag |
| `Escape` | Cancel edit / Close dropdown |
| `Backspace` (on empty tag input) | Delete last tag |

---

## Accessibility

1. **Screen readers**: Panel has proper ARIA labels ("Document Properties")
2. **Keyboard**: Full keyboard navigation
3. **Focus**: Auto-focus first field when panel opens
4. **Contrast**: Labels and values meet WCAG AA contrast

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Very long title | Truncate with ellipsis, full text on hover/focus |
| Many tags (10+) | Wrap to multiple rows, scroll if needed |
| Empty property value | Show placeholder text, still saves as key: "" |
| Invalid date format | Show picker, prevent manual invalid input |
| Duplicate property key | Prevent, show error "Property already exists" |
| File has raw YAML user didn't create | Parse and show in panel, preserve on save |

---

## Technical Integration Points

Based on editor architecture research:

1. **Message types** to add:
   - `loadProperties` (extension → webview)
   - `propertiesChanged` (webview → extension)

2. **React component**: `PropertiesPanel.tsx`
   - Placed above `<EditorContent>` in `Editor.tsx`
   - Uses existing Radix UI components (Dialog for dropdowns)

3. **Storage**: YAML front-matter in file
   - Parse on load, reconstruct on save
   - Maintain markdown compatibility

4. **Existing patterns to reuse**:
   - Dialog/dropdown patterns from `FormattingBubbleMenu.tsx`
   - Button styles from `ui/button.tsx`
   - Bridge messaging from `bridge.ts`
