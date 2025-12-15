# Sprint 13: Task Lists - Initial Research Findings

**Date:** 2025-12-15
**Status:** Phase 1 - Research Complete

## Current State Analysis

### TipTap Extensions Status

**Not Installed:**
- `@tiptap/extension-task-list` - NOT in webview/package.json
- `@tiptap/extension-task-item` - NOT in webview/package.json

**Currently Installed List Extensions:**
- `@tiptap/extension-bullet-list` (v2.1.0) ✅
- `@tiptap/extension-ordered-list` (v2.1.0) ✅
- `@tiptap/extension-list-item` (v2.1.0) ✅

**Action Required:** Install both TaskList and TaskItem extensions

### Existing Code Patterns

#### 1. List Configuration Pattern (Editor.tsx)

```typescript
// Lines 199-213 in Editor.tsx
BulletList.configure({
  HTMLAttributes: {
    class: 'tiptap-bullet-list',
  },
}),
OrderedList.configure({
  HTMLAttributes: {
    class: 'tiptap-ordered-list',
  },
}),
ListItem.configure({
  HTMLAttributes: {
    class: 'tiptap-list-item',
  },
}),
```

**Pattern to Follow:**
```typescript
TaskList.configure({
  HTMLAttributes: {
    class: 'tiptap-task-list',
  },
}),
TaskItem.configure({
  HTMLAttributes: {
    class: 'tiptap-task-item',
  },
}),
```

#### 2. Slash Command Pattern (SlashCommands.tsx)

```typescript
// Lines 76-100 - Bullet List Example
{
  title: 'Bullet List',
  description: 'Create a bulleted list',
  icon: List,
  command: ({ editor, range }: any) => {
    editor
      .chain()
      .focus()
      .deleteRange(range)
      .toggleBulletList()
      .run()
  },
},
```

**Pattern to Follow:**
```typescript
{
  title: 'Task List',
  description: 'Create a checklist',
  icon: CheckSquare, // or ListCheck
  command: ({ editor, range }: any) => {
    editor
      .chain()
      .focus()
      .deleteRange(range)
      .toggleTaskList()
      .run()
  },
},
```

#### 3. Command Registration Pattern (extension.ts)

```typescript
// Lines 52-56 - Existing command example
context.subscriptions.push(
  vscode.commands.registerCommand('ritemark.openSearch', () => {
    vscode.commands.executeCommand('workbench.view.search');
  })
);
```

**Pattern to Follow:**
```typescript
context.subscriptions.push(
  vscode.commands.registerCommand('ritemark.insertTaskList', () => {
    // Send message to active webview
    RiteMarkEditorProvider.executeEditorCommand('toggleTaskList');
  })
);
```

#### 4. Package.json Command Contribution

```json
// Existing pattern in package.json
"commands": [
  {
    "command": "ritemark.configureApiKey",
    "title": "RiteMark: Configure OpenAI API Key"
  },
  // ...
]
```

**Pattern to Follow:**
```json
{
  "command": "ritemark.insertTaskList",
  "title": "RiteMark: Insert Task List",
  "category": "RiteMark"
}
```

### Turndown GFM Plugin Support

**Current Usage:**
```typescript
// Editor.tsx line 14
import { tables } from 'turndown-plugin-gfm'

// Editor.tsx lines 124-135
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
})
turndownService.use(tables)
```

**GFM Plugin Features:**
- ✅ Tables (currently used)
- ✅ Strikethrough
- ✅ Task lists (available but not enabled!)

**Action Required:**
```typescript
import { tables, taskListItems } from 'turndown-plugin-gfm'

turndownService.use(tables)
turndownService.use(taskListItems) // Add this
```

### Icon Options (lucide-react)

Available icons for task lists:
- `CheckSquare` - Square with checkmark (common choice)
- `ListCheck` - List with checkmarks (alternative)
- `ListTodo` - Task list specific icon (newer)

**Recommendation:** Use `CheckSquare` (consistent with FormattingBubbleMenu icon style)

## Installation Commands

```bash
# Navigate to webview directory
cd /Users/jarmotuisk/Projects/ritemark-native/extensions/ritemark/webview

# Install TaskList extensions
npm install @tiptap/extension-task-list@^2.1.0
npm install @tiptap/extension-task-item@^2.1.0
```

## Key Files to Modify

| File | Changes Required | Complexity |
|------|------------------|------------|
| `webview/package.json` | Add 2 dependencies | Trivial (npm install) |
| `webview/src/components/Editor.tsx` | Import + configure extensions, add styles | Medium |
| `webview/src/extensions/SlashCommands.tsx` | Add task list command | Low |
| `extensions/ritemark/package.json` | Add command contribution | Low |
| `extensions/ritemark/src/extension.ts` | Register command handler | Low |
| `extensions/ritemark/src/ritemarkEditor.ts` | Handle webview message | Low |

## Styling Requirements

### Expected CSS Structure

```css
/* Task List Container */
.tiptap-task-list {
  list-style: none;
  padding-left: 0;
}

/* Individual Task Item */
.tiptap-task-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

/* Checkbox Input */
.tiptap-task-item input[type="checkbox"] {
  width: 1rem;
  height: 1rem;
  margin-top: 0.25rem;
  cursor: pointer;
}

/* Nested Task Lists */
.tiptap-task-item .tiptap-task-list {
  margin-top: 0.5rem;
  padding-left: 1.5rem;
}
```

## TipTap API Reference

### TaskList Commands

```typescript
// Toggle task list on/off
editor.chain().focus().toggleTaskList().run()

// Check if task list is active
editor.isActive('taskList')

// Check if command can run
editor.can().toggleTaskList()
```

### TaskItem Commands

```typescript
// Toggle individual task item checkbox
editor.chain().focus().toggleTaskItem().run()

// Check if task item is checked
editor.getAttributes('taskItem').checked

// Split task item (Enter key behavior)
editor.chain().focus().splitListItem('taskItem').run()
```

## GFM Markdown Syntax

### Valid Formats

```markdown
- [ ] Unchecked task
- [x] Checked task
- [X] Also checked (uppercase X)
* [ ] Alternative list marker
+ [ ] Another alternative

Nested:
- [ ] Parent task
  - [ ] Child task
  - [x] Completed child
```

### Invalid Formats (should not match)

```markdown
-[ ] No space after marker
- [] No space in checkbox
- [ x ] Space around X
-[x] No space after marker
```

## Testing Checklist

### Manual Tests
1. Type `- [ ]` and verify it converts to checkbox
2. Type `- [x]` and verify it renders as checked
3. Click checkbox to toggle state
4. Use slash command `/task` to insert task list
5. Use command palette to insert task list
6. Create nested task lists (Tab/Shift+Tab)
7. Press Enter on task item to create new item
8. Press Backspace on empty task item to exit list

### Roundtrip Tests
1. Create task list → save → reload → verify preserved
2. Load existing GFM file with `- [ ]` syntax
3. Toggle checkboxes → save → verify markdown updated
4. Copy/paste from GitHub → verify renders correctly

### Edge Cases
1. Task item with inline code: `- [ ] Install \`npm\` package`
2. Task item with link: `- [ ] Read [docs](https://example.com)`
3. Task item with bold/italic: `- [x] **Important** task`
4. Empty task item: `- [ ]` (no text)
5. Very long task text (multi-line wrapping)

## Open Questions for Jarmo

1. **Toolbar Button:** Add checkbox icon to FormattingBubbleMenu?
   - Pro: More discoverable for new users
   - Con: Toolbar is already dense (B, I, H1, H2, H3, Link, Table)

2. **Keyboard Shortcut:** Assign a keybinding?
   - Suggestion: Cmd+Shift+K (K for checklist)
   - Alternative: Command palette only (reduce shortcut conflicts)

3. **Numbered Task Lists:** Support `1. [ ]` syntax?
   - GFM spec only covers bulleted lists
   - Could implement as extension, but non-standard

## Potential Gotchas

1. **TipTap Version Compatibility:** Ensure TaskList/TaskItem work with TipTap 2.1.0
2. **Turndown Plugin Version:** May need to update turndown-plugin-gfm to latest
3. **VS Code Conflicts:** Some keyboard shortcuts may conflict with VS Code defaults
4. **Nested List Indent:** CSS indentation must handle multiple nesting levels
5. **Checkbox Click Events:** May interfere with text selection (test carefully)

## Next Steps (Phase 2)

1. Install npm packages
2. Configure extensions in Editor.tsx
3. Add turndown task list plugin
4. Test basic rendering in dev mode
5. **STOP and wait for Jarmo approval before Phase 3**

---

**Research Phase Complete** ✅
Ready to create installation plan and seek approval.
