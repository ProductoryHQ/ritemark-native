# Block Types

> Structure your documents with headings, lists, code blocks, tables, and more.

Every piece of content in Ritemark is a "block" - a paragraph, heading, list, or other element. You can insert, reorder, and delete blocks.

---

## Available Blocks

| Block | Slash Command | Description |
|-------|---------------|-------------|
| Text | `/text` | Regular paragraph |
| Heading 1 | `/heading1` | Large section title |
| Heading 2 | `/heading2` | Subsection title |
| Heading 3 | `/heading3` | Minor heading |
| Bullet List | `/bullet` | Unordered list |
| Numbered List | `/numbered` | Ordered list |
| Task List | `/task` | Checklist with checkboxes |
| Blockquote | `/quote` | Quoted text |
| Code Block | `/code` | Syntax-highlighted code |
| Table | `/table` | Grid of rows and columns |
| Divider | `/divider` | Horizontal line |

---

## Headings

Three heading levels for document structure:

| Level | Size | Use For |
|-------|------|---------|
| H1 | Largest | Document title, major sections |
| H2 | Medium | Subsections |
| H3 | Small | Minor headings within sections |

**Insert a heading:**
- Type `/heading1`, `/heading2`, or `/heading3`
- Or select text and use the bubble menu

**Markdown equivalent:**
```
# Heading 1
## Heading 2
### Heading 3
```

---

## Lists

### Bullet Lists

Unordered lists for items without sequence:

- Item one
- Item two
- Item three

**Create:**
- Type `/bullet` and start typing
- Or type `- ` at the start of a line

**Shortcut:** Cmd+Shift+8

### Numbered Lists

Ordered lists for sequential items:

1. First step
2. Second step
3. Third step

**Create:**
- Type `/numbered` and start typing
- Or type `1. ` at the start of a line

**Shortcut:** Cmd+Shift+7

### Task Lists

Checklists with toggleable checkboxes:

- [ ] Todo item
- [x] Completed item

**Create:**
- Type `/task` and start typing
- Or type `- [ ] ` at the start of a line

**Toggle checkbox:** Click the checkbox

### Nested Lists

Indent list items to create hierarchy:
1. Press Tab to indent
2. Press Shift+Tab to outdent

---

## Blockquotes

For quoted text or callouts:

> This is a blockquote.
> It can span multiple lines.

**Create:**
- Type `/quote`
- Or type `> ` at the start of a line

Blockquotes appear in gray italic styling.

---

## Code Blocks

For code with syntax highlighting:

```javascript
function hello() {
  console.log("Hello, world!");
}
```

**Create:**
- Type `/code`
- Or type ``` (three backticks) and press Enter

**Features:**
- Syntax highlighting for common languages
- Copy button in the corner
- Monospace font

**Specify language:**
Type the language name after the opening backticks:
````
```javascript
// your code here
```
````

---

## Tables

Grid of rows and columns for structured data.

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Cell A1 | Cell B1 | Cell C1 |
| Cell A2 | Cell B2 | Cell C2 |

### Create a Table

1. Type `/table` or use the bubble menu
2. A grid picker appears
3. Hover to select dimensions (up to 10x10)
4. Click to insert

### Edit Cells

- Click any cell to edit
- Tab moves to next cell
- Enter confirms and moves down

### Table Shortcuts

| Action | Shortcut |
|--------|----------|
| Add row above | Cmd+Shift+Up |
| Add row below | Cmd+Shift+Down |
| Add column left | Cmd+Shift+Left |
| Add column right | Cmd+Shift+Right |
| Delete row | Cmd+Backspace |
| Delete column | Cmd+Delete |

### Notes

- First row is always the header
- Columns cannot be resized (known limitation)
- Tables export correctly to PDF and Word

---

## Dividers

Horizontal lines to separate sections:

---

**Create:**
- Type `/divider`
- Or type `---` on its own line

---

## Working with Blocks

### Insert a Block

1. Click the `+` button next to any block
2. Or type `/` to open the command menu
3. Select the block type

### Reorder Blocks

1. Hover over a block to see the drag handle (left side)
2. Click and drag to new position
3. Release to drop

### Delete a Block

1. Hover over the block
2. Click the trash icon
3. Or select all content in the block and press Backspace

---

## Tips

- **Quick lists** - Just type `- ` or `1. ` to start a list
- **Exit a block** - Press Enter twice to exit a list or quote
- **Convert blocks** - Use slash commands to change block type

---

## Related

- [Core Editor](editor.md) - Basic editing
- [Text Formatting](formatting.md) - Bold, italic, links
- [Keyboard Shortcuts](keyboard-shortcuts.md) - All shortcuts
