# Sprint 26: Text Editor - Image & UI Polish

**Status:** Phase 1 (Research) - COMPLETE, awaiting approval for Phase 3 (Development)

## Overview

This sprint enhances the Ritemark text editor with image management, UI refinements, and reliability improvements. All changes are additive or polish-focused (no breaking changes).

## Goals

1. **Image Management:** Insert images from file system via slash command
2. **Image Selection:** Visual feedback when images are selected
3. **UI Polish:** Add blockquote to bubble menu, remove table (move to block menu)
4. **Reliability:** Add stale state indicator when file changes externally

## Quick Links

- **Sprint Plan:** [sprint-plan.md](./sprint-plan.md)
- **Research Findings:** [research/architecture-findings.md](./research/architecture-findings.md)
- **Implementation Notes:** [notes/](./notes/) (created during Phase 3+)

## Sprint Phases

| Phase | Name | Status | Gate |
|-------|------|--------|------|
| 1 | Research | ✅ Complete | Auto |
| 2 | Plan | ✅ Complete | 🔒 **Awaiting Jarmo Approval** |
| 3 | Develop | ⏸️ Blocked | Approval required |
| 4 | Test & Validate | ⏳ Pending | qa-validator required |
| 5 | Cleanup | ⏳ Pending | Auto |
| 6 | Deploy | ⏳ Pending | qa-validator required |

## What's Ready

### Research Complete
- ✅ Analyzed bubble menu architecture
- ✅ Mapped slash command patterns
- ✅ Documented existing image paste flow
- ✅ Reviewed stale state pattern from Data Editor
- ✅ Identified all implementation points

### Plan Complete
- ✅ 6-phase implementation checklist
- ✅ Success criteria defined
- ✅ Deliverables documented
- ✅ Risks identified with mitigations
- ✅ Estimated effort: ~9 hours (1-2 days)

## What's Needed

**🔒 GATE: Jarmo Approval Required**

Please review [sprint-plan.md](./sprint-plan.md) and confirm:
- [ ] Approach is correct (table removal, blockquote addition, image insertion, stale state)
- [ ] Scope is appropriate (defer image resize to future sprint)
- [ ] No concerns with file watcher for markdown files

**Approval phrase:** "approved" or "proceed"

## Key Features

### 1. Image Upload from Slash Command
- Type `/image` in editor
- File picker opens (PNG, JPG, JPEG, GIF, WEBP)
- Image saves to `./images/` folder (relative to markdown file)
- Image inserted with relative path

### 2. Image Selection State
- Click image → visual border/highlight
- Investigate resize capability (may defer to future sprint)

### 3. Bubble Menu Refinement
- **Remove:** Table button (insertion, not formatting)
- **Add:** Blockquote button (formatting toggle)
- Table still available via `/table` and block menu

### 4. Stale State Indicator
- File watcher detects external changes
- Banner appears: "File changed on disk. [Refresh Now]"
- Auto-dismiss after 10s (if no unsaved changes)
- Consistent with Data Editor UX

## Technical Approach

### No New Dependencies
- All required packages already installed
- Reuses existing patterns (image save, file watcher, notifications)

### Implementation Strategy
1. Quick wins first (table removal, blockquote addition)
2. Image upload (new VS Code command + message flow)
3. Image selection (CSS or NodeView investigation)
4. Stale state (extend existing file watcher to markdown)

### Risk Mitigation
- Image NodeView complexity → Fallback to CSS-only selection
- File watcher conflicts → Debouncing + non-blocking UI
- Path updates on file move → Document limitation (future sprint)

## Files to be Modified

**Extension (TypeScript):**
- `extensions/ritemark/src/extension.ts` - New command registration
- `extensions/ritemark/src/ritemarkEditor.ts` - File watcher extension, image command handler

**Webview (React/TypeScript):**
- `extensions/ritemark/webview/src/components/FormattingBubbleMenu.tsx` - Remove table, add blockquote
- `extensions/ritemark/webview/src/extensions/SlashCommands.tsx` - Implement image command
- `extensions/ritemark/webview/src/components/Editor.tsx` - Integrate FileChangeNotification
- `extensions/ritemark/webview/src/extensions/imageExtensions.ts` - Add selection state (CSS or NodeView)
- `extensions/ritemark/webview/src/bridge.ts` - New message types

## Next Steps

1. **Awaiting:** Jarmo's approval of sprint plan
2. **Then:** Phase 3 (Development) - Implementation starts
3. **Testing:** Dev mode validation, then production build
4. **QA:** Invoke qa-validator before final commit

---

**Created:** 2026-01-28
**Sprint Manager:** Claude (sprint-manager agent)
**Approval Status:** Pending
