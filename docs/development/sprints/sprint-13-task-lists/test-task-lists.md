# Task List Testing Document

This file contains test cases for Sprint 13 - Task List Checkboxes feature.

## Basic Task Lists

### Unchecked Items
- [ ] First unchecked item
- [ ] Second unchecked item
- [ ] Third unchecked item

### Checked Items
- [x] First checked item
- [x] Second checked item
- [x] Third checked item

### Mixed States
- [ ] Todo: Review code
- [x] Done: Write tests
- [ ] Todo: Update documentation
- [x] Done: Create examples

## Nested Task Lists

- [ ] Parent task 1
  - [ ] Child task 1.1
  - [x] Child task 1.2 (completed)
  - [ ] Child task 1.3
- [x] Parent task 2 (completed)
  - [x] Child task 2.1
  - [x] Child task 2.2
- [ ] Parent task 3
  - [ ] Child task 3.1
    - [ ] Grandchild task 3.1.1
    - [x] Grandchild task 3.1.2

## Task Lists with Formatting

### Bold Text
- [ ] **Important task** (bold)
- [x] **Completed important task**

### Italic Text
- [ ] *Emphasized task* (italic)
- [x] *Completed emphasized task*

### Code Inline
- [ ] Install `npm` packages
- [x] Run `npm install`
- [ ] Execute `npm run build`

### Links
- [ ] Read [TipTap docs](https://tiptap.dev)
- [x] Review [GFM spec](https://github.github.com/gfm/)
- [ ] Check [MDN reference](https://developer.mozilla.org)

### Mixed Formatting
- [ ] **Important:** Review the *code* and run `npm test`
- [x] **Done:** Updated [documentation](https://example.com) with examples

## Edge Cases

### Empty Task Item
- [ ]

### Very Long Task Text
- [ ] This is a very long task item that should wrap to multiple lines properly. The text should remain aligned with the checkbox and should be readable even when it spans multiple lines. Let's add even more text to ensure the wrapping works correctly in all scenarios.

### Task Item with Multiple Paragraphs (if supported)
- [ ] First line of task

- [ ] Another task after blank line

### Task Items in Blockquote (if supported)
> - [ ] Quoted task 1
> - [x] Quoted task 2

## Mixed List Types

Regular bullet list:
- First bullet
- Second bullet

Task list:
- [ ] First task
- [x] Second task

Numbered list:
1. First item
2. Second item

Back to task list:
- [ ] Another task
- [x] Completed task

## Test Checklist

Use this section to manually verify all features work:

### Basic Functionality
- [ ] Slash command `/task` creates task list
- [ ] Typing `- [ ]` renders checkbox
- [ ] Typing `- [x]` renders checked checkbox
- [ ] Clicking checkbox toggles state
- [ ] Uppercase `[X]` also works

### Keyboard Navigation
- [ ] Enter key creates new task item
- [ ] Backspace on empty task exits list
- [ ] Tab indents task item (nested)
- [ ] Shift+Tab unindents task item

### Persistence
- [ ] Save file preserves checkbox states
- [ ] Reload file shows correct states
- [ ] Markdown output uses `- [ ]` or `- [x]`

### Styling
- [ ] Checkboxes are properly sized
- [ ] Hover state shows visual feedback
- [ ] Checked boxes show checkmark
- [ ] Text aligns properly with checkbox
- [ ] Nested lists have proper indentation

### Compatibility
- [ ] Copy/paste from GitHub works
- [ ] Export to markdown is valid GFM
- [ ] Mixed with other list types works

## Notes

Add test results and observations below:

---

**Test Date:**
**Tester:**
**Build Version:**
**Results:**
