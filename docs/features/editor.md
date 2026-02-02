# Core Editor

> Write in rich text, save in markdown. Never lose your work.

Ritemark gives you a visual editor that feels like a word processor but saves everything as plain markdown files. Your documents stay portable, readable, and yours.

---

## What You Can Do

- **Write visually** - See formatting as you type, no preview pane needed
- **Auto-save** - Every change saves automatically after 1 second
- **Word count** - Live word count in the status bar
- **Slash commands** - Type `/` to insert any block type
- **Drag blocks** - Reorder paragraphs, lists, and other blocks
- **Work offline** - No internet required for editing

---

## How It Works

### Visual Editing

When you open a markdown file, Ritemark shows it as formatted text:
- **Bold text** appears bold (not `**bold**`)
- Headings appear large (not `# Heading`)
- Lists show bullets (not `- item`)

When you save, it converts back to standard markdown. Open your files in any text editor and they look normal.

### Auto-Save

Your document saves automatically:
1. Make any change
2. Wait 1 second
3. File saves to disk

No save button needed. No "unsaved changes" warnings. If Ritemark crashes, you lose at most 1 second of work.

### Slash Commands

Type `/` anywhere to open the command menu:

| Command | Inserts |
|---------|---------|
| `/heading1` | Large heading (H1) |
| `/heading2` | Medium heading (H2) |
| `/heading3` | Small heading (H3) |
| `/bullet` | Bullet list |
| `/numbered` | Numbered list |
| `/task` | Task list with checkboxes |
| `/code` | Code block |
| `/quote` | Blockquote |
| `/divider` | Horizontal line |
| `/table` | Table |

Start typing to filter. Press Enter to insert.

### Block Reordering

Every block (paragraph, heading, list, etc.) has a drag handle on the left:
1. Hover over a block to see the grip icon
2. Click and drag to move it
3. Drop where you want it

The `+` button next to the handle inserts a new block above.

### Word Count

The status bar at the bottom shows:
- Current word count
- Updates live as you type

---

## Supported File Types

| Extension | Mode | Description |
|-----------|------|-------------|
| `.md` | Edit | Full editing |
| `.markdown` | Edit | Full editing |
| `.csv` | Edit | [Spreadsheet view](spreadsheets.md) |
| `.xlsx`, `.xls` | Preview | [Excel preview](spreadsheets.md) |

---

## Tips

- **Quick formatting** - Select text to see the formatting bubble menu
- **Keyboard shortcuts** - Cmd+B for bold, Cmd+I for italic, Cmd+K for links
- **External changes** - If you edit the file outside Ritemark, it reloads automatically

---

## Related

- [Text Formatting](formatting.md) - Bold, italic, links
- [Block Types](blocks.md) - All block types explained
- [Keyboard Shortcuts](keyboard-shortcuts.md) - Full shortcut reference
