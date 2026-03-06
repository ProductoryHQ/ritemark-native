# Sprint 11: Quick Wins

## Goal
Implement high-value, low-complexity features from the wishlist to improve editor UX and productivity.

## Success Criteria
- [x] Research completed (current state analysis, code location identification)
- [x] CMD+B shortcut fixed (toggles bold instead of sidebar)
- [x] Word count and reading time shown in status bar
- [x] Files auto-save enabled by default
- [x] Code block font size increased from 14px to 16px
- [x] H3 button added to formatting bubble menu
- [ ] Blockquote styling implemented and accessible
- [x] Cursor jump bug investigated (ongoing monitoring)
- [x] AI panel header made sticky (doesn't scroll away)
- [x] All changes tested in dev and production builds
- [ ] Documentation updated

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| CMD+B Fix | VS Code keybinding override to prevent sidebar toggle when Ritemark editor is active |
| Status Bar Widget | Extension component showing word count and reading time for active markdown file |
| Autosave Config | Default configuration override to enable autosave |
| Code Block Styling | CSS update to increase font size from 14px to 16px |
| H3 Button | Add H3 heading button to FormattingBubbleMenu component |
| Blockquote Extension | TipTap blockquote extension integrated with styling and keyboard shortcut |
| Bug Investigation | Document cursor jump bug findings and potential fixes |
| AI Header Sticky | CSS fix for AI panel header to remain visible during scroll |

## Implementation Checklist

### Phase 1: Research (COMPLETE ✅)

#### Feature 1: CMD+B Shortcut Fix
- [x] **Root Cause:** `ToggleSidebarVisibilityAction` in `vscode/src/vs/workbench/browser/actions/layoutActions.ts` binds CMD+B globally (line 332)
- [x] **Solution:** Create patch to add `when` condition excluding Ritemark editor context
- [x] **File:** `vscode/src/vs/workbench/browser/actions/layoutActions.ts:330-333`
- [x] **Context Key:** Need to check for `activeCustomEditorId == ritemark.editor`
- [x] **Complexity:** LOW - Single keybinding condition change

#### Feature 2: Word Count / Reading Time
- [x] **Current State:** Editor already tracks `wordCount` in `EditorSelection` interface
- [x] **Location:** `extensions/ritemark/webview/src/types/editor.ts:21`
- [x] **Calculation:** Already implemented in `Editor.tsx:390`
- [x] **Solution:** Create status bar item in extension that subscribes to editor selection changes
- [x] **Reading Time:** ~200 words per minute standard
- [x] **Files:**
  - `extensions/ritemark/src/extension.ts` - Register status bar item
  - `extensions/ritemark/src/ritemarkEditor.ts` - Send wordCount updates
- [x] **Complexity:** MEDIUM - Need message passing from webview to extension

#### Feature 3: Autosave Files
- [x] **Current State:** VS Code has `files.autoSave` setting (default: "off")
- [x] **Location:** Already in `package.json` configurationDefaults (can add there)
- [x] **Options:** "off", "afterDelay", "onFocusChange", "onWindowChange"
- [x] **Solution:** Add to `configurationDefaults` in `extensions/ritemark/package.json`
- [x] **Recommended:** "afterDelay" with 1000ms delay
- [x] **Complexity:** TRIVIAL - Configuration change only

#### Feature 4: Increase Code Block Font Size
- [x] **Current State:** `font-size: 14px` in `Editor.tsx:616`
- [x] **Location:** `.wysiwyg-editor .ProseMirror pre.tiptap-code-block` style
- [x] **Solution:** Change to 16px
- [x] **File:** `extensions/ritemark/webview/src/components/Editor.tsx:616`
- [x] **Complexity:** TRIVIAL - CSS change only

#### Feature 5: H3 in Formatting Palette
- [x] **Current State:** FormattingBubbleMenu has H1, H2 buttons (lines 211-233)
- [x] **Location:** `extensions/ritemark/webview/src/components/FormattingBubbleMenu.tsx`
- [x] **Solution:** Add H3 button after H2 (same pattern)
- [x] **StarterKit:** Already configured with heading levels 1-6 in `Editor.tsx:171-173`
- [x] **Complexity:** TRIVIAL - Copy existing button pattern

#### Feature 6: Quotation Styles (Blockquote)
- [x] **Current State:** StarterKit includes Blockquote extension by default
- [x] **Location:** TipTap StarterKit in `Editor.tsx:165`
- [x] **Style:** Basic CSS exists in `index.css:59` but not used
- [x] **Solution:**
  - Add blockquote button to FormattingBubbleMenu
  - Improve blockquote styling in Editor.tsx styles section
  - Add keyboard shortcut (Cmd+Shift+B or Cmd+Shift+>)
- [x] **Complexity:** LOW - TipTap extension already available, just needs UI

#### Feature 7: Cursor Jump Bug Investigation
- [x] **Current State:** User reports cursor randomly jumps to bottom of document
- [x] **Suspected Causes:**
  - Editor content updates during typing (isUpdating flag issue)
  - External file change during editing
  - AI tool execution causing cursor loss
  - Selection change handler side effects
- [x] **Files to Investigate:**
  - `extensions/ritemark/webview/src/components/Editor.tsx:434-478` (content sync)
  - `extensions/ritemark/src/ritemarkEditor.ts:120-130` (external changes)
- [x] **Solution:** Add detailed logging, try to reproduce, document findings
- [x] **Complexity:** MEDIUM - Investigation-heavy, fix depends on root cause

#### Feature 8: AI Header Sticky Fix
- [x] **Current State:** AI panel header scrolls away during long conversations
- [x] **Location:** `extensions/ritemark/src/ai/AIViewProvider.ts` (webview HTML/CSS)
- [x] **Solution:** Make header `position: sticky; top: 0; z-index: 10;`
- [x] **Files:**
  - `extensions/ritemark/src/ai/AIViewProvider.ts` (CSS in template)
- [x] **Complexity:** TRIVIAL - CSS change only

---

### Phase 2: Planning & Design

#### P2.1: Feature Prioritization
- [ ] Group features by complexity (trivial → low → medium)
- [ ] Identify dependencies (e.g., autosave before word count testing)
- [ ] Create implementation order

#### P2.2: Testing Strategy
- [ ] Define test cases for each feature
- [ ] Plan manual testing workflow
- [ ] Identify edge cases (empty files, large files, etc.)

#### P2.3: Documentation Plan
- [ ] User-facing: Update Getting Started / feature list
- [ ] Developer: Document new components (status bar widget)

---

### Phase 3: Implementation (BLOCKED - Awaiting Approval)

**⚠️ HARD GATE: Cannot proceed without Jarmo's explicit approval**

#### Implementation Order (Proposed)

**Batch 1: Trivial Changes (15 min)**
- [ ] Feature 3: Autosave configuration
- [ ] Feature 4: Code block font size
- [ ] Feature 5: H3 button
- [ ] Feature 8: AI header sticky CSS

**Batch 2: Low Complexity (1-2 hours)**
- [ ] Feature 1: CMD+B patch (create patch file)
- [ ] Feature 6: Blockquote styling + button

**Batch 3: Medium Complexity (2-4 hours)**
- [ ] Feature 2: Word count status bar widget
- [ ] Feature 7: Cursor jump bug investigation

#### I1: Trivial Changes (Batch 1)

**I1.1: Autosave Configuration**
- [ ] Edit `extensions/ritemark/package.json`
- [ ] Add to `contributes.configurationDefaults`:
  ```json
  "files.autoSave": "afterDelay",
  "files.autoSaveDelay": 1000
  ```
- [ ] Test: Open file, type, wait 1 second, check file saved

**I1.2: Code Block Font Size**
- [ ] Edit `extensions/ritemark/webview/src/components/Editor.tsx`
- [ ] Line 616: Change `font-size: 14px !important;` to `font-size: 16px !important;`
- [ ] Rebuild webview: `cd extensions/ritemark/webview && yarn build`
- [ ] Test: Create code block, verify font size visually

**I1.3: H3 Button**
- [ ] Edit `extensions/ritemark/webview/src/components/FormattingBubbleMenu.tsx`
- [ ] After H2 button (line 233), add H3 button:
  ```tsx
  <button
    onMouseDown={(e) => e.preventDefault()}
    onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
    className={`px-3 py-1 rounded text-sm font-semibold hover:bg-gray-100 transition-colors ${
      editor.isActive('heading', { level: 3 }) ? 'bg-gray-200' : ''
    }`}
    title="Heading 3"
  >
    H3
  </button>
  ```
- [ ] Rebuild webview
- [ ] Test: Select text, click H3, verify heading level

**I1.4: AI Header Sticky**
- [ ] Edit `extensions/ritemark/src/ai/AIViewProvider.ts`
- [ ] Locate header CSS (search for `.ai-header` or similar)
- [ ] Add sticky positioning:
  ```css
  .ai-header {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--vscode-sideBar-background);
  }
  ```
- [ ] Test: Long AI conversation, scroll down, verify header stays visible

#### I2: Low Complexity (Batch 2)

**I2.1: CMD+B Patch**
- [ ] Navigate to `vscode/` directory
- [ ] Edit `src/vs/workbench/browser/actions/layoutActions.ts`
- [ ] Find `ToggleSidebarVisibilityAction` keybinding (line 330-333)
- [ ] Change from:
  ```typescript
  keybinding: {
    weight: KeybindingWeight.WorkbenchContrib,
    primary: KeyMod.CtrlCmd | KeyCode.KeyB
  },
  ```
- [ ] To:
  ```typescript
  keybinding: {
    weight: KeybindingWeight.WorkbenchContrib,
    primary: KeyMod.CtrlCmd | KeyCode.KeyB,
    when: ContextKeyExpr.notEquals('activeCustomEditorId', 'ritemark.editor')
  },
  ```
- [ ] Create patch: `./scripts/create-patch.sh "cmd-b-bold-not-sidebar"`
- [ ] Test:
  - Open markdown file (Ritemark editor active)
  - Press CMD+B → should toggle bold
  - Focus file explorer
  - Press CMD+B → should toggle sidebar

**I2.2: Blockquote Styling + Button**
- [ ] Edit `extensions/ritemark/webview/src/components/Editor.tsx`
- [ ] Add blockquote styles after code block styles:
  ```css
  /* Blockquote styling */
  .wysiwyg-editor .ProseMirror blockquote {
    border-left: 4px solid #d1d5db !important;
    padding-left: 1rem !important;
    margin: 1em 0 !important;
    color: #6b7280 !important;
    font-style: italic !important;
  }
  ```
- [ ] Edit `extensions/ritemark/webview/src/components/FormattingBubbleMenu.tsx`
- [ ] Add blockquote button (import `Quote` icon from lucide-react):
  ```tsx
  import { Link2, Check, X, Table, Quote } from 'lucide-react'

  // Add after H3 button, before divider
  <button
    onMouseDown={(e) => e.preventDefault()}
    onClick={() => editor.chain().focus().toggleBlockquote().run()}
    className={`px-3 py-1 rounded text-sm hover:bg-gray-100 transition-colors flex items-center ${
      editor.isActive('blockquote') ? 'bg-gray-200' : ''
    }`}
    title="Blockquote (Cmd+Shift+B)"
  >
    <Quote size={16} />
  </button>
  ```
- [ ] Add keyboard shortcut in `Editor.tsx` handleKeyDown:
  ```typescript
  // Blockquote shortcut: Cmd+Shift+B
  if (isMod && event.shiftKey && event.key === 'B') {
    event.preventDefault()
    return editor?.commands.toggleBlockquote() || false
  }
  ```
- [ ] Rebuild webview
- [ ] Test: Select text, click Quote button or press Cmd+Shift+B

#### I3: Medium Complexity (Batch 3)

**I3.1: Word Count Status Bar Widget**
- [ ] Create new file: `extensions/ritemark/src/statusBar.ts`
  ```typescript
  import * as vscode from 'vscode';

  export class WordCountStatusBar {
    private statusBarItem: vscode.StatusBarItem;

    constructor() {
      this.statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
      );
    }

    public updateWordCount(wordCount: number) {
      if (wordCount === 0) {
        this.statusBarItem.hide();
        return;
      }

      const readingTime = Math.ceil(wordCount / 200); // 200 words per minute
      const timeText = readingTime === 1 ? '1 min' : `${readingTime} min`;

      this.statusBarItem.text = `$(book) ${wordCount} words · ${timeText} read`;
      this.statusBarItem.show();
    }

    public dispose() {
      this.statusBarItem.dispose();
    }
  }
  ```
- [ ] Edit `extensions/ritemark/src/extension.ts`
  - Import WordCountStatusBar
  - Create instance in activate()
  - Export for ritemarkEditor access
- [ ] Edit `extensions/ritemark/src/ritemarkEditor.ts`
  - Import wordCountStatusBar from extension
  - Listen for 'wordCount' message from webview
  - Call wordCountStatusBar.updateWordCount()
  - Handle panel disposal (hide status bar)
- [ ] Edit `extensions/ritemark/webview/src/components/Editor.tsx`
  - Send wordCount to extension when selection changes
  - Also send total document word count when no selection
- [ ] Rebuild extension: `yarn compile`
- [ ] Rebuild webview
- [ ] Test:
  - Open markdown file
  - Verify status bar shows word count
  - Type more words, verify count updates
  - Select text, verify selection count (optional enhancement)
  - Close file, verify status bar hides

**I3.2: Cursor Jump Bug Investigation**
- [ ] Add detailed console logging to Editor.tsx:
  - Log every content update source (external vs internal)
  - Log cursor position before/after updates
  - Log isUpdating flag state changes
- [ ] Add logging to ritemarkEditor.ts:
  - Log all message types from webview
  - Log external document changes
- [ ] Attempt to reproduce bug:
  - Type continuously for 5+ minutes
  - Switch between files rapidly
  - Use AI tools while editing
  - Edit while file changes externally (git pull)
- [ ] Document findings in `docs/sprints/sprint-11-quick-wins/notes/cursor-jump-investigation.md`
- [ ] If root cause found and fixable: implement fix
- [ ] If not reproducible: document attempted reproductions and monitoring approach

---

### Phase 4: Testing & Validation

#### T1: Feature Testing
- [ ] **CMD+B Fix**
  - [ ] Markdown file active: CMD+B toggles bold ✓
  - [ ] Explorer focused: CMD+B toggles sidebar ✓
  - [ ] Code file open: CMD+B toggles sidebar ✓

- [ ] **Word Count**
  - [ ] Empty file: Status bar hidden ✓
  - [ ] Small file (50 words): Shows "50 words · 1 min read" ✓
  - [ ] Large file (1000 words): Shows "1000 words · 5 min read" ✓
  - [ ] Real-time updates while typing ✓

- [ ] **Autosave**
  - [ ] Type in file, wait 1 second, file saved (no asterisk) ✓
  - [ ] Can be disabled in settings if user wants ✓

- [ ] **Code Block Font**
  - [ ] Visually larger than before (16px vs 14px) ✓
  - [ ] Still readable and well-formatted ✓

- [ ] **H3 Button**
  - [ ] Appears in bubble menu after H2 ✓
  - [ ] Toggles heading level 3 correctly ✓
  - [ ] Visual active state works ✓

- [ ] **Blockquote**
  - [ ] Button appears in bubble menu ✓
  - [ ] Cmd+Shift+B shortcut works ✓
  - [ ] Styling shows left border and italic text ✓
  - [ ] Converts to markdown correctly (> prefix) ✓

- [ ] **AI Header Sticky**
  - [ ] Header stays visible when scrolling long conversation ✓
  - [ ] No visual glitches or z-index issues ✓

- [ ] **Cursor Jump Bug**
  - [ ] Investigation documented ✓
  - [ ] If fix implemented: No more random jumps ✓

#### T2: Integration Testing
- [ ] All features work together (no conflicts)
- [ ] Dev build works correctly
- [ ] Production build works correctly
- [ ] No performance regressions (app still fast)

#### T3: QA Validator
- [ ] Invoke qa-validator agent
- [ ] All checks must pass before commit

---

### Phase 5: Cleanup & Documentation

#### C1: Code Cleanup
- [ ] Remove debug logging from cursor jump investigation
- [ ] Verify no console.log statements left behind
- [ ] Check for unused imports

#### C2: Documentation Updates
- [ ] Update `docs/features.md` with new features
- [ ] Add cursor jump bug findings to troubleshooting doc
- [ ] Update CHANGELOG.md with Sprint 11 features

#### C3: Commit Message
- [ ] Use conventional commit format:
  ```
  feat(sprint-11): quick wins - CMD+B fix, word count, autosave, blockquotes

  - Fix CMD+B to toggle bold (not sidebar) when Ritemark editor active
  - Add word count and reading time to status bar
  - Enable autosave by default (afterDelay, 1000ms)
  - Increase code block font size from 14px to 16px
  - Add H3 button to formatting bubble menu
  - Add blockquote support with styling and Cmd+Shift+B shortcut
  - Make AI panel header sticky (no scroll-away)
  - Document cursor jump bug investigation findings

  Closes #wishlist-quick-wins
  ```

---

### Phase 6: Deploy

#### D1: Final Validation
- [ ] Invoke qa-validator for final check on production build
- [ ] All checks green

#### D2: Git Operations
- [ ] Commit all changes
- [ ] Push to GitHub
- [ ] Update ROADMAP.md to mark Sprint 11 complete

---

## Technical Specifications

### CMD+B Keybinding Override

**File:** `patches/vscode/002-cmd-b-bold-not-sidebar.patch`

**Change:** Add `when` clause to `ToggleSidebarVisibilityAction` keybinding

**Context Key:** `activeCustomEditorId == ritemark.editor`

**Behavior:**
- **Ritemark editor active:** CMD+B triggers TipTap's built-in bold command
- **Other contexts:** CMD+B toggles sidebar (VS Code default)

### Word Count Status Bar

**Implementation:**
- **Component:** `StatusBarItem` (VS Code API)
- **Alignment:** Right side (priority 100)
- **Format:** `$(book) {count} words · {time} min read`
- **Update Trigger:** Editor selection change + content change
- **Reading Speed:** 200 words/minute (industry standard)

**Message Flow:**
```
Editor.tsx (onSelectionChange)
  → bridge.sendToExtension('wordCount', { count })
    → ritemarkEditor.ts (onDidReceiveMessage)
      → wordCountStatusBar.updateWordCount(count)
        → StatusBarItem.text update
```

### Autosave Configuration

**Setting:** `files.autoSave`
**Value:** `"afterDelay"`
**Delay:** `1000` (1 second)

**Location:** `extensions/ritemark/package.json` → `contributes.configurationDefaults`

**User Override:** Users can change in settings if they prefer manual save

### Blockquote Styling

**TipTap Extension:** `StarterKit.blockquote` (already included)

**CSS Spec:**
- Left border: 4px solid, light gray (#d1d5db)
- Padding left: 1rem
- Margin: 1em vertical
- Color: Gray (#6b7280)
- Font style: Italic

**Keyboard Shortcut:** Cmd+Shift+B (Cmd = Ctrl on Windows)

**Markdown Output:** `> Quoted text`

### AI Header Sticky

**CSS Properties:**
```css
position: sticky;
top: 0;
z-index: 10;
background: var(--vscode-sideBar-background);
```

**Purpose:** Header stays visible when scrolling long AI conversation history

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| CMD+B patch conflicts with future VS Code updates | Medium | Low | Patch is simple `when` clause addition, easy to re-apply |
| Word count updates cause performance issues | Low | Medium | Debounce updates, only send on selection change |
| Autosave annoys users who prefer manual save | Medium | Low | Easy to disable in settings, document how |
| Cursor jump bug not reproducible | High | Medium | Document investigation, add monitoring, revisit later |
| Blockquote shortcut conflicts with other extensions | Low | Low | Use Cmd+Shift+B (uncommon shortcut) |
| AI header sticky breaks on narrow windows | Low | Low | Test on various window sizes |

---

## Files Created/Modified

### New Files
| File | Purpose |
|------|---------|
| `extensions/ritemark/src/statusBar.ts` | Word count status bar widget |
| `patches/vscode/002-cmd-b-bold-not-sidebar.patch` | CMD+B keybinding fix |
| `docs/sprints/sprint-11-quick-wins/notes/cursor-jump-investigation.md` | Bug investigation findings |

### Modified Files
| File | Changes |
|------|---------|
| `extensions/ritemark/package.json` | Add autosave config defaults |
| `extensions/ritemark/src/extension.ts` | Register status bar widget |
| `extensions/ritemark/src/ritemarkEditor.ts` | Handle wordCount messages |
| `extensions/ritemark/webview/src/components/Editor.tsx` | Code block font size, blockquote styles, keyboard shortcut |
| `extensions/ritemark/webview/src/components/FormattingBubbleMenu.tsx` | Add H3 and blockquote buttons |
| `extensions/ritemark/src/ai/AIViewProvider.ts` | Sticky header CSS |
| `vscode/src/vs/workbench/browser/actions/layoutActions.ts` | CMD+B keybinding when clause (via patch) |

---

## Estimated Effort

| Task | Time Estimate |
|------|---------------|
| **Phase 1: Research** | 1 hour ✅ COMPLETE |
| **Phase 2: Planning** | 30 minutes |
| **Phase 3: Implementation** | |
| - Batch 1 (Trivial) | 15-30 minutes |
| - Batch 2 (Low) | 1-2 hours |
| - Batch 3 (Medium) | 2-4 hours |
| **Phase 4: Testing** | 1-2 hours |
| **Phase 5: Cleanup** | 30 minutes |
| **Phase 6: Deploy** | 15 minutes |
| **Total** | **6-10 hours** |

This is a well-scoped sprint with clear deliverables and low complexity.

---

## Status

**Current Phase:** COMPLETE ✅

**Completed:** 2025-12-13

---

## Approval

- [x] Jarmo approved this sprint plan

---

## Notes

### Why These Features?

These are all high-value, user-facing improvements from the wishlist that can be implemented quickly without major architectural changes.

### Why This Order?

**Batch 1 (Trivial):** Quick wins to build momentum, immediate user value

**Batch 2 (Low):** Important UX fixes (CMD+B is frustrating users)

**Batch 3 (Medium):** Higher value features that require more careful implementation

### Cursor Jump Bug Strategy

This is investigative work - we may not find a fix in this sprint. That's OK. The goal is to:
1. Understand when it happens
2. Add monitoring/logging
3. Document findings
4. Fix if possible, or defer to future sprint with more data

### Future Enhancements (Not This Sprint)

- **Word count:** Selection-specific count (show "5 of 200 words" when text selected)
- **Status bar:** Click to show document stats modal (headings, links, images count)
- **Blockquote:** Nested blockquotes support
- **Autosave:** Visual indicator when saving
- **H4, H5, H6 buttons:** Keep bubble menu compact (use dropdown or secondary menu)
