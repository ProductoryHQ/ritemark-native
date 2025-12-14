# Sprint 11 Feature Analysis & Research

This document contains the detailed research findings for each Quick Win feature.

---

## Feature 1: CMD+B Shortcut Fix

### Problem
CMD+B currently triggers VS Code's "Toggle Sidebar Visibility" command, which hides/shows the primary sidebar. This conflicts with the universal markdown editor expectation that CMD+B should make text **bold**.

### Root Cause
**File:** `vscode/src/vs/workbench/browser/actions/layoutActions.ts`
**Lines:** 315-356

The `ToggleSidebarVisibilityAction` registers a global keybinding:
```typescript
keybinding: {
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyMod.CtrlCmd | KeyCode.KeyB
}
```

This binding has no `when` clause, so it fires in ALL contexts, including when the RiteMark editor is active.

### Solution
Add a `when` clause to exclude RiteMark editor context:

```typescript
keybinding: {
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyMod.CtrlCmd | KeyCode.KeyB,
  when: ContextKeyExpr.notEquals('activeCustomEditorId', 'ritemark.editor')
}
```

### Context Key
VS Code's Custom Editor API automatically sets the `activeCustomEditorId` context key when a custom editor is focused. Our editor is registered with `viewType: 'ritemark.editor'` in `package.json`.

### Implementation Method
**Patch file:** `patches/vscode/002-cmd-b-bold-not-sidebar.patch`

We'll use the patch system (not direct edit) to ensure the change survives VS Code updates.

### Testing
1. Open markdown file (RiteMark editor active)
2. Select text
3. Press CMD+B
4. **Expected:** Text becomes bold (TipTap handles it)
5. **Expected:** Sidebar remains visible

6. Click file explorer (RiteMark editor NOT active)
7. Press CMD+B
8. **Expected:** Sidebar toggles (VS Code default behavior)

---

## Feature 2: Word Count / Reading Time

### Current State
The editor already tracks word count internally:

**File:** `extensions/ritemark/webview/src/types/editor.ts`
```typescript
export interface EditorSelection {
  text: string
  from: number
  to: number
  isEmpty: boolean
  wordCount: number  // Already tracked!
}
```

**Calculation:** `extensions/ritemark/webview/src/components/Editor.tsx:390`
```typescript
wordCount: text.trim() ? text.split(/\s+/).filter(Boolean).length : 0
```

This is currently used only for AI panel context display.

### Solution
Create a **Status Bar Item** (VS Code API) that shows:
- Total document word count
- Estimated reading time (200 words/minute standard)

### Architecture

**Message Flow:**
```
Editor.tsx (webview)
  → sends 'wordCount' message via bridge
    → ritemarkEditor.ts receives message
      → updates WordCountStatusBar instance
        → StatusBarItem displays: "$(book) 245 words · 2 min read"
```

### Implementation Files

**New File:** `extensions/ritemark/src/statusBar.ts`
- Export `WordCountStatusBar` class
- Wraps `vscode.StatusBarItem`
- Methods: `updateWordCount(count)`, `dispose()`

**Modified:** `extensions/ritemark/src/extension.ts`
- Create `WordCountStatusBar` instance in `activate()`
- Export for use by `ritemarkEditor.ts`

**Modified:** `extensions/ritemark/src/ritemarkEditor.ts`
- Listen for `wordCount` message from webview
- Call `wordCountStatusBar.updateWordCount(count)`
- Hide status bar when editor panel closes

**Modified:** `extensions/ritemark/webview/src/components/Editor.tsx`
- Send total document word count (not just selection) to extension
- Trigger on content change and selection change

### Reading Time Calculation
```typescript
const readingTime = Math.ceil(wordCount / 200); // 200 words/min
const timeText = readingTime === 1 ? '1 min' : `${readingTime} min`;
```

### Edge Cases
- **Empty file:** Hide status bar (wordCount = 0)
- **Very short file:** Show "1 min read" minimum
- **Very long file:** Show accurate count (e.g., "5000 words · 25 min read")

---

## Feature 3: Autosave Files

### Current State
VS Code's default autosave setting is `"off"` (user must press CMD+S to save).

RiteMark Native already has `configurationDefaults` in `package.json` that override other settings:
```json
"configurationDefaults": {
  "workbench.sideBar.location": "left",
  "workbench.colorTheme": "Default Light Modern",
  // ... etc
}
```

### Solution
Add autosave settings to `configurationDefaults`:

```json
"files.autoSave": "afterDelay",
"files.autoSaveDelay": 1000
```

### Autosave Options
VS Code supports 4 modes:
- `"off"` - Manual save only (default)
- `"afterDelay"` - Save after typing stops for X ms ← **We'll use this**
- `"onFocusChange"` - Save when switching files/apps
- `"onWindowChange"` - Save when switching windows

**Why "afterDelay"?**
- Balances data safety with performance
- 1000ms delay = saves after 1 second of inactivity
- Feels natural (like Google Docs, Notion, etc.)
- Doesn't interrupt typing flow

### User Override
Users can still disable autosave in Settings UI if they prefer manual save:
1. Open Settings (CMD+,)
2. Search "autosave"
3. Change to "off"

### Testing
1. Open markdown file
2. Type some text
3. Wait 1 second (no typing)
4. **Expected:** File tab loses asterisk (file saved)
5. Check file on disk (external editor/terminal)
6. **Expected:** Changes are saved

---

## Feature 4: Increase Code Block Font Size

### Current State
**File:** `extensions/ritemark/webview/src/components/Editor.tsx:616`

```css
.wysiwyg-editor .ProseMirror pre.tiptap-code-block {
  /* ... */
  font-size: 14px !important;
  /* ... */
}
```

Body text is 18px, so code blocks are noticeably smaller.

### User Feedback
"Increase codeblock font size" - wishlist item

### Solution
Change to **16px** (still smaller than body text, but more readable)

```css
font-size: 16px !important;
```

### Rationale
- 14px is too small for comfortable reading
- 16px maintains hierarchy (body = 18px > code = 16px)
- Follows common editor conventions (VS Code default code size is 14px, but our body is larger)

### Testing
Visual comparison before/after:
- Create code block with JavaScript/Python example
- Verify font is larger and more readable
- Ensure syntax highlighting still works
- Check on smaller displays (13" laptop)

---

## Feature 5: H3 in Formatting Palette

### Current State
**File:** `extensions/ritemark/webview/src/components/FormattingBubbleMenu.tsx`

Bubble menu currently shows:
- Bold (B)
- Italic (I)
- H1
- H2
- Link
- Table

H3-H6 are supported by TipTap (configured in `Editor.tsx:171-173`) but not exposed in UI.

### Solution
Add H3 button after H2 button.

**Location:** After line 233 (H2 button)

```tsx
{/* Heading 3 Button - Small heading */}
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

### Why Only H3?
- **H1, H2:** Most common in markdown documents (primary, secondary structure)
- **H3:** Useful for sub-sections (tertiary structure)
- **H4-H6:** Rare in practice, would clutter bubble menu

If users need H4-H6, they can use markdown syntax (`####`, `#####`, `######`) or slash commands.

### Current H3 Styling
Already defined in `Editor.tsx:531-536`:
```css
.wysiwyg-editor .ProseMirror h3 {
  font-size: 1.25rem !important;
  font-weight: 600 !important;
  margin: 1em 0 0.5em 0 !important;
  color: #111827 !important;
}
```

### Testing
1. Select text
2. Bubble menu appears
3. Click H3 button
4. **Expected:** Text becomes H3 heading (1.25rem, bold)
5. Click H3 again
6. **Expected:** Text reverts to paragraph

---

## Feature 6: Quotation Styles (Blockquote)

### Current State
TipTap's `StarterKit` includes a Blockquote extension by default, but:
- No button in formatting menu
- No keyboard shortcut configured
- Minimal CSS styling

**File:** `extensions/ritemark/webview/src/index.css:59`
```css
.ProseMirror blockquote {
  /* Basic styling exists but not used in Editor.tsx inline styles */
}
```

### Solution
1. **Add blockquote button** to FormattingBubbleMenu
2. **Add keyboard shortcut:** CMD+Shift+B
3. **Improve styling** (left border, italic, gray color)

### Blockquote Styling Spec

**Design Inspiration:** Common markdown editors (Typora, Bear, Notion)

```css
.wysiwyg-editor .ProseMirror blockquote {
  border-left: 4px solid #d1d5db !important;  /* Light gray border */
  padding-left: 1rem !important;
  margin: 1em 0 !important;
  color: #6b7280 !important;                  /* Gray text */
  font-style: italic !important;              /* Italic for distinction */
}
```

### Button Implementation

**Import icon:**
```typescript
import { Link2, Check, X, Table, Quote } from 'lucide-react'
```

**Add button (after H3, before divider):**
```tsx
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

### Keyboard Shortcut

**File:** `extensions/ritemark/webview/src/components/Editor.tsx`
**Location:** `handleKeyDown` function (after line 285)

```typescript
// Blockquote shortcut: Cmd+Shift+B
if (isMod && event.shiftKey && event.key === 'B') {
  event.preventDefault()
  return editor?.commands.toggleBlockquote() || false
}
```

**Why CMD+Shift+B?**
- CMD+B = Bold (primary B action)
- CMD+Shift+B = Block quote (logical extension)
- Not conflicting with any VS Code shortcuts in markdown context

### Markdown Output
TipTap's blockquote extension converts to standard markdown:
```markdown
> This is a quoted paragraph.
> It can span multiple lines.
```

### Testing
1. Select paragraph
2. Click Quote button (or press CMD+Shift+B)
3. **Expected:** Left border appears, text becomes italic and gray
4. Save file, check markdown source
5. **Expected:** Lines prefixed with `>`

---

## Feature 7: Cursor Jump Bug Investigation

### User Report
"Bug: Randomly jumps cursor to the bottom of page!!!!"

### Suspected Causes

#### 1. Content Update Loop
**File:** `extensions/ritemark/webview/src/components/Editor.tsx:434-478`

The editor synchronizes content bidirectionally:
- User types → `onUpdate` → sends markdown to extension
- Extension loads file → sends content → `useEffect` updates editor

**Potential Issue:** If `isUpdating` flag isn't working correctly, external updates could reset cursor position.

**Code to Investigate:**
```typescript
const isUpdating = useRef(false)

// Line 89: Content changed in editor
if (!isUpdating.current) {
  this.updateDocument(document, message.content);
}

// Line 121: External document change
if (e.document.uri.toString() === document.uri.toString() && !isUpdating.current) {
  isUpdating.current = true;
  // Update editor content
  setTimeout(() => { isUpdating.current = false; }, 100);
}
```

**Risk:** 100ms timeout might not be enough, causing race conditions.

#### 2. External File Changes
**File:** `extensions/ritemark/src/ritemarkEditor.ts:120-130`

If the file changes on disk (git pull, external edit), VS Code triggers `onDidChangeTextDocument`, which updates the editor content, potentially moving cursor.

#### 3. AI Tool Execution
**File:** `extensions/ritemark/src/ritemarkEditor.ts:27-41`

When AI tools execute (insert/replace text), the editor content updates. If cursor position isn't preserved, it might jump.

#### 4. Selection Change Handler Side Effects
**File:** `extensions/ritemark/webview/src/components/Editor.tsx:375-402`

The selection change handler fires frequently. If it triggers re-renders that lose cursor position, that could cause jumps.

### Investigation Strategy

**Step 1: Add Logging**
Add detailed console.log statements:
```typescript
console.log('[Editor] Content update from:', source, 'Cursor:', cursorPos);
console.log('[Editor] isUpdating:', isUpdating.current);
console.log('[Editor] External change detected:', documentUri);
```

**Step 2: Attempt Reproduction**
- Type continuously for 5+ minutes in a long document
- Switch between files rapidly (file explorer navigation)
- Use AI tools while editing (Rephrase, Expand)
- Edit file, then git pull to trigger external change
- Paste large blocks of text
- Use undo/redo extensively

**Step 3: Document Patterns**
If reproduced, note:
- What action triggered it?
- How long after the action?
- Cursor position before/after?
- Was `isUpdating` flag set correctly?

**Step 4: Fix or Monitor**
- If root cause found: Implement fix
- If not reproducible: Add permanent monitoring (Sentry, error tracking)
- If intermittent: Add defensive cursor restoration logic

### Possible Fixes (Pending Investigation)

**Fix 1: Preserve Cursor on External Updates**
```typescript
const currentPos = editor.view.state.selection.from;
editor.commands.setContent(newContent);
editor.commands.setTextSelection(currentPos);
```

**Fix 2: Increase isUpdating Timeout**
```typescript
setTimeout(() => { isUpdating.current = false; }, 500); // Was 100ms
```

**Fix 3: Prevent AI Tool Cursor Jumps**
```typescript
// When AI tool executes, save cursor, apply change, restore cursor
```

### Deliverable
**File:** `docs/sprints/sprint-11-quick-wins/notes/cursor-jump-investigation.md`

Document findings even if bug not fixed:
- Reproduction attempts
- Logging added
- Hypothesis tested
- Next steps (if unresolved)

---

## Feature 8: AI Header Sticky Fix

### Problem
The AI panel header (title, API key status, etc.) scrolls away during long conversations. User has to scroll back to top to see status or change settings.

### Current State
**File:** `extensions/ritemark/src/ai/AIViewProvider.ts`

The AI panel uses a webview with HTML/CSS template. The header is currently in the normal document flow (not sticky).

### Solution
Make header `position: sticky` so it stays visible when scrolling conversation history.

**CSS Change:**
```css
.ai-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--vscode-sideBar-background); /* Ensure background covers content */
  padding: 1rem; /* Maintain spacing */
}
```

### Implementation
1. Locate header element in `AIViewProvider.ts` HTML template
2. Add CSS class `ai-header` if not present
3. Add sticky positioning styles

### Z-Index Considerations
- **z-index: 10** ensures header stays above conversation content
- VS Code webviews have their own stacking context (safe to use low z-index)

### Background Color
Must match sidebar background to prevent text showing through when scrolling:
```css
background: var(--vscode-sideBar-background);
```

This adapts to user's theme automatically.

### Testing
1. Open AI panel
2. Have long conversation (10+ messages)
3. Scroll down to bottom
4. **Expected:** Header remains visible at top
5. Scroll back up
6. **Expected:** No visual glitches, header seamlessly integrated

---

## Summary

All 8 features have been researched and are ready for implementation:

| Feature | Complexity | Estimated Time | Files Modified |
|---------|-----------|----------------|----------------|
| CMD+B Fix | LOW | 30 min | 1 patch file |
| Word Count | MEDIUM | 2-3 hours | 4 files (1 new) |
| Autosave | TRIVIAL | 5 min | 1 file |
| Code Block Font | TRIVIAL | 2 min | 1 file |
| H3 Button | TRIVIAL | 5 min | 1 file |
| Blockquote | LOW | 1 hour | 2 files |
| Cursor Jump | MEDIUM | 2-4 hours | Investigation + doc |
| AI Sticky Header | TRIVIAL | 10 min | 1 file |

**Total Estimated Time:** 6-10 hours (including testing and documentation)

This is a well-scoped sprint with clear deliverables and low risk.
