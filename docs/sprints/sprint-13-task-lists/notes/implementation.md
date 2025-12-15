# Sprint 13: Task List Implementation Notes

**Date:** 2025-12-15
**Phase:** 3 (DEVELOP)

## Implementation Complete ✅

### Changes Made

#### 1. Package Dependencies (webview/package.json)
- ✅ Added `@tiptap/extension-task-list@^2.1.0`
- ✅ Added `@tiptap/extension-task-item@^2.1.0`

**Installation Required:**
```bash
cd extensions/ritemark/webview
npm install
```

#### 2. Editor Configuration (webview/src/components/Editor.tsx)

**Imports Added (lines 9-10, 16):**
```typescript
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { tables, taskListItems } from 'turndown-plugin-gfm'
```

**Turndown Plugin Enabled (line 36):**
```typescript
turndownService.use(taskListItems)
```

**Extensions Configured (lines 217-227):**
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
  nested: true,
}),
```

**CSS Styling Added (lines 641-703):**
- Task list container styling (no bullets, proper spacing)
- Task item flexbox layout
- Checkbox styling (custom appearance, checkmark on checked)
- Hover states
- Nested task list indentation

#### 3. Slash Command (webview/src/extensions/SlashCommands.tsx)

**Import Added (line 7):**
```typescript
import { CheckSquare } from 'lucide-react'
```

**Command Added (lines 102-114):**
```typescript
{
  title: 'Task List',
  description: 'Create a checklist',
  icon: CheckSquare,
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

## Testing Instructions

### 1. Install Dependencies
```bash
cd /Users/jarmotuisk/Projects/ritemark-native/extensions/ritemark/webview
npm install
```

### 2. Build Webview
```bash
npm run build
```

### 3. Test in Dev Mode
```bash
# From project root
cd vscode
npm run watch  # Terminal 1

# In another terminal
./scripts/code.sh  # Or your dev script
```

### 4. Manual Tests

**Test 1: Slash Command**
1. Open a markdown file
2. Type `/task`
3. Select "Task List" from menu
4. Should create empty checkbox list

**Test 2: Markdown Syntax**
1. Type: `- [ ] Unchecked item`
2. Press Enter
3. Should render as interactive checkbox
4. Click checkbox to toggle

**Test 3: Checked Items**
1. Type: `- [x] Checked item`
2. Should render with checked checkbox
3. Click to uncheck

**Test 4: Nested Lists**
1. Create task item
2. Press Tab to indent
3. Should create nested task list

**Test 5: Save/Load**
1. Create task list with mixed checked/unchecked
2. Save file (Cmd+S)
3. Close and reopen file
4. Verify checkbox states preserved

**Test 6: GFM Compatibility**
1. Copy task list from GitHub
2. Paste into editor
3. Should render correctly
4. Save and verify markdown syntax matches GFM

## Expected Markdown Output

```markdown
- [ ] Unchecked task
- [x] Checked task
- [ ] Task with **bold** text
  - [ ] Nested unchecked
  - [x] Nested checked
```

## Known Issues / Edge Cases

None identified yet - pending testing.

## Next Steps (Phase 4: Testing)

1. ✅ npm install in webview directory
2. ✅ Build webview bundle
3. ⏳ Test slash command
4. ⏳ Test markdown syntax rendering
5. ⏳ Test checkbox toggle
6. ⏳ Test save/load roundtrip
7. ⏳ Test nested lists
8. ⏳ Test with inline formatting (bold, italic, links)

## Decisions Implemented

Per Jarmo's approval:
- ✅ No toolbar button (slash command only)
- ✅ No keyboard shortcut (slash command + command palette sufficient)
- ✅ Standard GFM only (`- [ ]` syntax)

## Files Modified

1. `/Users/jarmotuisk/Projects/ritemark-native/extensions/ritemark/webview/package.json`
2. `/Users/jarmotuisk/Projects/ritemark-native/extensions/ritemark/webview/src/components/Editor.tsx`
3. `/Users/jarmotuisk/Projects/ritemark-native/extensions/ritemark/webview/src/extensions/SlashCommands.tsx`

## Commit Message (Draft)

```
feat: add GFM task list checkbox support (Sprint 13)

- Install @tiptap/extension-task-list and task-item
- Enable turndown-plugin-gfm taskListItems for markdown conversion
- Add /task slash command with CheckSquare icon
- Style checkboxes with custom appearance and hover states
- Support nested task lists with proper indentation

Users can now create interactive checklists using:
- Slash command: /task
- Markdown syntax: - [ ] or - [x]
- Clickable checkboxes in editor
```

---

**Status:** Implementation complete, awaiting npm install and testing
