# Sprint 26: Text Editor - Image & UI Polish

## Goal
Enhance the text editor with image management capabilities, refine the formatting UI, and add stale state detection for better reliability.

## Feature Flag Check
- [ ] Does this sprint need a feature flag?
  - Platform-specific? **No** - All features work on darwin-arm64
  - Experimental? **No** - UI refinements and core editor features
  - Large download? **No** - No additional dependencies
  - Premium? **No** - Core editor functionality
  - Kill-switch? **No** - Low-risk UI changes
  - **Decision: NO feature flag needed** - Bug fixes, UI polish, and core editor improvements

## Success Criteria
- [ ] Users can insert images from file system via slash command
- [ ] Images show visual selection state when clicked
- [ ] Image resize capability is investigated and documented
- [ ] Bubble menu shows blockquote button (no table button)
- [ ] Text editor shows stale state warning when file changes externally (like Data Editor)
- [ ] All features work in both dev and production builds

## Deliverables
| Deliverable | Description |
|-------------|-------------|
| Image insertion from slash command | User types `/image`, selects file from system, file is saved to `./images/` folder, image inserted into editor |
| Image selection state | Clicking on image shows visual selection (border/highlight), investigate TipTap NodeView for resize handles |
| Blockquote in bubble menu | Add Quote button to FormattingBubbleMenu (between lists and link) |
| Remove Table from bubble menu | Move table insertion to BlockMenu only (it's about insertion, not formatting) |
| Stale state indicator | FileChangeNotification component integrated into text editor (currently only in Data Editor) |

## Implementation Checklist

### Phase 1: Remove Table from Bubble Menu (Quick Win)
**Pattern:** `FormattingBubbleMenu.tsx` currently shows Table button after Link button. Remove it since tables are insertable via BlockMenu and slash commands.

- [ ] Remove Table icon import from FormattingBubbleMenu.tsx
- [ ] Remove table button and divider from bubble menu JSX (lines ~323-334)
- [ ] Remove table dialog state management (lines ~86, ~424-438)
- [ ] Verify table insertion still works via:
  - [ ] Slash command `/table`
  - [ ] BlockMenu (+ button on drag handle) - check if table is there
  - [ ] If not in BlockMenu, add it there

### Phase 2: Add Blockquote to Bubble Menu
**Pattern:** StarterKit includes Blockquote extension by default. FormattingBubbleMenu uses `editor.chain().focus().toggleX().run()` pattern.

**Reference:** Screenshot at `docs/sprints/images/image-1769619933029.png` shows desired placement

- [ ] Add Quote icon import from lucide-react (already used in BlockMenu.tsx)
- [ ] Add blockquote button between task list and link (after divider)
- [ ] Use pattern: `editor.chain().focus().toggleBlockquote().run()`
- [ ] Add active state check: `editor.isActive('blockquote')`
- [ ] Style button consistently with existing buttons
- [ ] Test toggling blockquote on selected text

### Phase 3: Image Upload from Slash Command
**Pattern:**
- SlashCommands.tsx line ~141-151 has placeholder "Image" command (currently just console.log)
- Existing paste flow: Editor.tsx line ~412-432 handles clipboard images via `saveImage` message to extension
- Extension: ritemarkEditor.ts line ~306-309 handles `saveImage` message, saves to `./images/` folder

**Implementation:**
- [ ] Add new VS Code command `ritemark.selectImageFile` in extension.ts
  - [ ] Use `vscode.window.showOpenDialog` with image filters (.png, .jpg, .jpeg, .gif, .webp)
  - [ ] Return selected file path to webview
- [ ] Update SlashCommands.tsx image command:
  - [ ] Send message to extension requesting file selection
  - [ ] Wait for response with file path
  - [ ] Read file as Data URL (use existing `readFileAsBase64` helper)
  - [ ] Send `saveImage` message to extension (reuse existing flow)
  - [ ] Wait for response with relative path
  - [ ] Insert image node with relative path
- [ ] Update bridge.ts message types for new flow
- [ ] Test: Select image, verify saved to `./images/`, verify inserted with correct path

### Phase 4: Image Selection State
**Pattern:**
- TipTap Image extension: `webview/src/extensions/imageExtensions.ts` (currently just config)
- TipTap NodeView pattern: `@tiptap/react` provides `NodeViewWrapper` component (already imported in node_modules)
- Selection tracking: Editor provides `editor.state.selection` and update events

**Investigation:**
- [ ] Research TipTap Image NodeView implementation:
  - [ ] Check if TipTap core Image supports `selectable: true` attribute
  - [ ] Review TipTap docs for NodeView selection patterns
  - [ ] Look for existing resize plugins (tiptap-extension-resize-image)
- [ ] Create custom ImageNodeView component:
  - [ ] Use `NodeViewWrapper` from `@tiptap/react`
  - [ ] Add selected state CSS (blue border like VS Code selection)
  - [ ] Listen to editor selection changes
  - [ ] Highlight image when ProseMirror selection includes it
- [ ] Investigate resize capability:
  - [ ] Check if drag handles are feasible (similar to table resize)
  - [ ] Document technical limitations (ProseMirror NodeView constraints)
  - [ ] Consider alternative: right-click context menu with "Resize" option
  - [ ] Document findings in sprint notes for future sprint decision

**Fallback:** If NodeView is too complex, use simpler approach:
- Add CSS class `.ProseMirror img.ProseMirror-selectednode` for selection border
- Document that resize is not feasible without major extension work

### Phase 5: Text Editor Stale State Indicator
**Pattern:**
- Data Editor (ExcelEditorProvider) uses file watcher pattern (lines ~250-312)
- File watcher sends `fileChanged` message to webview (line ~302-306)
- Webview component `FileChangeNotification.tsx` displays banner with "Refresh Now" button
- Text editor (ritemarkEditor.ts) already has file watcher for CSV/Excel (line ~236-247) but NOT for markdown

**Implementation:**
- [ ] Extend ritemarkEditor.ts file watcher to include markdown files:
  - [ ] Move `createFileWatcher` call outside CSV/Excel check (apply to all file types)
  - [ ] For markdown: Compare file modification time vs. document dirty state
  - [ ] Send `fileChanged` message with `{ filename, isDirty }` to webview
- [ ] Integrate FileChangeNotification into Editor.tsx:
  - [ ] Import FileChangeNotification component
  - [ ] Add state for banner visibility and filename
  - [ ] Listen for `fileChanged` message from extension
  - [ ] Show banner at top of editor (above DocumentHeader)
  - [ ] Handle "Refresh Now": Send `refresh` message to extension, reload content
  - [ ] Handle "Dismiss": Hide banner
- [ ] Test scenarios:
  - [ ] External edit while document is clean → Show "Refresh Now" (auto-dismiss 10s)
  - [ ] External edit while document is dirty → Show "You have unsaved changes" (persistent)
  - [ ] Verify refresh reloads content without losing cursor position

### Phase 6: Testing & Validation
- [ ] Test in dev mode (`npm run watch`)
  - [ ] Bubble menu shows blockquote, no table
  - [ ] Blockquote toggle works on selected text
  - [ ] Image insertion via `/image` opens file picker
  - [ ] Selected image saves to `./images/` and inserts with relative path
  - [ ] Clicking image shows selection border
  - [ ] External file edit triggers stale state banner
  - [ ] Refresh button reloads content
- [ ] Build production app and test
  - [ ] All features work in `VSCode-darwin-arm64.app`
  - [ ] Image paths resolve correctly (relative to markdown file)
  - [ ] File watcher works in production build

## Status
**Current Phase:** 3 (Development - COMPLETE)
**Approval Required:** No - Ready for Phase 4 (Testing & Validation)

## Approval
- [x] Jarmo approved this sprint plan

---

## Research Notes

### Current Architecture Findings

**Bubble Menu (FormattingBubbleMenu.tsx):**
- Currently has: Bold, Italic, H1, H2, H3, Bullet List, Ordered List, Task List, Link, **Table**
- Table button opens dialog with TablePicker component
- Pattern: `editor.chain().focus().toggleX().run()` for formatting toggles
- Active state: `editor.isActive('type')` adds gray background
- Blockquote is available (StarterKit includes it) but not exposed in UI

**Slash Commands (SlashCommands.tsx):**
- Commands: Headings, Lists, Code Block, Table, **Image (placeholder)**
- Image command currently just console.log "not yet supported"
- Pattern: `editor.chain().focus().deleteRange(range).insertX().run()`
- Rendered via tippy.js dropdown with CommandsList component

**Image Paste Flow (Editor.tsx line ~412-432):**
1. User pastes image (Cmd+V with screenshot)
2. `handlePaste` hook intercepts clipboard
3. Read file as Data URL with `readFileAsBase64`
4. Generate filename with timestamp
5. Send `saveImage` message to extension with { dataUrl, filename }
6. Extension saves to `./images/` folder (ritemarkEditor.ts ~306-309)
7. Extension responds with relative path `./images/filename.png`
8. Webview inserts image node with relative path

**Image Extension (imageExtensions.ts):**
- Simple config: `inline: true`, `allowBase64: true`
- Uses TipTap core Image extension
- CSS class: `.tiptap-image`
- No custom NodeView (just default img rendering)

**Stale State Pattern (Data Editor):**
1. ExcelEditorProvider creates FileSystemWatcher for specific file
2. On file change: Debounce 500ms, send `fileChanged` message
3. FileChangeNotification component shows banner with:
   - Not dirty: "Refresh Now" button (auto-dismiss 10s)
   - Dirty: "You have unsaved changes" warning (persistent)
4. Refresh handler: Send `refresh` message, extension re-reads file, sends fresh content

**Text Editor File Watcher Status:**
- CSV/Excel: Has file watcher (ritemarkEditor.ts line ~236-247)
- Markdown: **NO file watcher** (VS Code handles markdown conflict detection, but no visual indicator in webview)
- Need to extend watcher to markdown for consistency

### Technical Decisions

**Table Button Removal:**
- Rationale: Table is an insertion operation (like headings, lists), not text formatting
- Table still available via:
  - Slash command `/table` (existing)
  - BlockMenu (need to verify if present, add if not)
- Bubble menu should focus on text-level formatting (bold, italic, headings, quote, link)

**Blockquote Button Addition:**
- Blockquote is a formatting toggle (like headings)
- Already supported by StarterKit, just needs UI exposure
- Placement: After task list, before link (logical grouping)

**Image Selection & Resize:**
- Selection: Achievable with CSS or custom NodeView
- Resize: Requires significant work (drag handles, ProseMirror node attributes)
- Recommendation: Implement selection in this sprint, defer resize to future sprint
- Alternative resize approach: Context menu "Set size..." dialog

**Stale State for Markdown:**
- Data Editor pattern is proven and user-tested
- Markdown needs same UX for consistency
- File watcher is lightweight (no performance concern)
- Integration point: Top of Editor.tsx (above DocumentHeader)

### Dependencies & Risks

**No New Dependencies:**
- All required packages already installed (TipTap, lucide-react, VS Code API)
- FileChangeNotification component is already built and tested

**Risks:**
- Image NodeView complexity might require more time than estimated
- File watcher for markdown might conflict with VS Code's built-in conflict detection
- Image file paths might break if user moves markdown file (future sprint: update paths on move)

**Mitigation:**
- Phase 4 includes investigation time and fallback plan
- Test file watcher behavior with VS Code's conflict UI
- Document path update limitation in user-facing docs

### Estimated Effort
- Phase 1: 0.5 hour (trivial removal)
- Phase 2: 0.5 hour (simple button addition)
- Phase 3: 2 hours (file picker integration, message flow)
- Phase 4: 3 hours (investigation + basic selection, defer resize)
- Phase 5: 2 hours (file watcher extension, component integration)
- Phase 6: 1 hour (testing, validation)
- **Total: ~9 hours** (1-2 days)
