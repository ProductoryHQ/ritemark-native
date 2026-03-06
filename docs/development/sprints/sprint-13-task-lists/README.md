# Sprint 13: Task List Checkboxes

**Priority:** HIGH - "mul on neid väga vaja!" (I really need these!)

## Quick Links

- [Sprint Plan](./sprint-plan.md) - Full implementation checklist
- [Research Findings](./research/initial-findings.md) - Technical analysis

## Overview

Add GitHub Flavored Markdown (GFM) task list support to Ritemark with interactive checkboxes.

**User Story:**
> As a markdown user, I want to create task lists with `- [ ]` syntax that render as clickable checkboxes, so I can manage my to-do items directly in the editor.

## What's Included

### Core Features
- ✅ Interactive checkboxes for `- [ ]` and `- [x]` syntax
- ✅ Click to toggle checkbox state
- ✅ Slash command: `/task` or `/checklist`
- ✅ Command palette: "Ritemark: Insert Task List"
- ✅ Keyboard navigation and editing
- ✅ Nested task lists support

### Technical Implementation
- Install `@tiptap/extension-task-list`
- Install `@tiptap/extension-task-item`
- Configure turndown-plugin-gfm for task list serialization
- Add CSS styling for checkboxes and indentation

## Current Status

**Phase:** 1 - Research (COMPLETE ✅)

**Gate:** HARD GATE - Awaiting Jarmo's approval

**Blocking Decision:**
1. Should we add a toolbar button to FormattingBubbleMenu?
2. What keyboard shortcut (if any) should we use?
3. Do we need numbered task lists (`1. [ ]`) or just bulleted?

## Key Findings

### Extensions Not Yet Installed
```bash
npm install @tiptap/extension-task-list@^2.1.0
npm install @tiptap/extension-task-item@^2.1.0
```

### GFM Plugin Already Supports Task Lists!
The `turndown-plugin-gfm` package (already installed) has a `taskListItems` export we're not using yet. Just need to enable it:

```typescript
import { tables, taskListItems } from 'turndown-plugin-gfm'
turndownService.use(taskListItems) // Add this line
```

### Low Complexity Implementation
This is a relatively straightforward sprint:
- 2 npm packages to install
- ~50 lines of configuration code
- ~30 lines of CSS styling
- ~20 lines for slash command
- ~15 lines for VS Code command registration

**Estimated Effort:** 2-3 hours (small sprint)

## Example Output

### Markdown Input/Output
```markdown
- [ ] Research task list implementation
- [x] Create sprint plan
- [ ] Get Jarmo's approval
  - [ ] Answer open questions
  - [ ] Review priorities
```

### Rendered Output
- Interactive checkboxes users can click
- Proper indentation for nested lists
- Visual styling consistent with Ritemark theme

## Next Actions

**For Jarmo:**
1. Review [sprint-plan.md](./sprint-plan.md)
2. Answer open questions (toolbar button, keyboard shortcut, numbered lists)
3. Approve sprint plan to unlock Phase 3 (Development)

**For Claude:**
1. ⏸️ BLOCKED - Waiting for approval
2. Cannot proceed to implementation without explicit approval

---

**Sprint Created:** 2025-12-15
**Approval Status:** ⏳ Pending
