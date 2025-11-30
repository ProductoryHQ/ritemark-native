# Sprint 02: Full Editor Integration

**Goal:** Integrate real RiteMark TipTap editor by REUSING existing code from ritemark web app

**Status:** ✅ COMPLETED (2024-11-30)

**Approach:** Copy 80% of code from `ritemark-app`, adapt for VS Code webview

---

## Exit Criteria (Jarmo Validates)

- [x] Real TipTap editor renders in webview (same as web app)
- [x] Can open .md files and see formatted content
- [x] Can edit content (bold, italic, headings, lists, tables, code blocks)
- [x] Changes auto-save to disk
- [x] Image paste/drop support (bonus feature)
- [x] Jarmo: "I can do real work in this"

---

## Phase Checklist

### Phase 1: RESEARCH ✅
- [x] Analyze RiteMark web editor structure
- [x] Document TipTap/ProseMirror architecture
- [x] **Deep dive reusability analysis**
- [x] Identify exactly what to copy vs build

### Phase 2: PLAN ✅
- [x] Create sprint folder structure
- [x] Write sprint-plan.md (this file)
- [x] **Jarmo approval to proceed**

### Phase 3: DEVELOP ✅
- [x] **Task 1:** Set up webview project structure with Vite
- [x] **Task 2:** Copy reusable code from ritemark-app
- [x] **Task 3:** Adapt Editor.tsx (remove Drive deps)
- [x] **Task 4:** Create postMessage bridge
- [x] **Task 5:** Wire file read (extension → webview)
- [x] **Task 6:** Wire file save (webview → extension, auto-save)
- [x] **Task 7:** Compile and launch for testing

### Phase 4: TEST & VALIDATE ✅
- [x] Open various .md files
- [x] Edit with all formatting options
- [x] Verify saves persist to disk
- [x] Test undo/redo
- [x] Jarmo tests and approves

### Phase 5: CLEANUP ✅
- [x] Remove unused copied code (16 UI components removed)
- [x] Update documentation
- [x] Code review

### Phase 6: CI/CD DEPLOY
- [ ] Commit all changes
- [ ] Push to GitHub
- [ ] Tag: `v0.2.0-editor`

---

## Task Details

### Task 1: Set Up Webview Project Structure

Create React/Vite project inside extension:

```
extensions/ritemark/
├── src/                      # Extension code (Node.js)
│   ├── extension.ts
│   └── ritemarkEditor.ts
├── webview/                  # React app (copied + adapted)
│   ├── src/
│   │   ├── App.tsx          # Entry point
│   │   ├── components/
│   │   │   ├── ui/          # COPY from ritemark-app
│   │   │   ├── Editor.tsx   # COPY + MODIFY
│   │   │   ├── FormattingBubbleMenu.tsx  # COPY
│   │   │   └── TableOverlayControls.tsx  # COPY
│   │   ├── extensions/      # COPY from ritemark-app
│   │   ├── lib/
│   │   │   └── utils.ts     # COPY
│   │   ├── types/
│   │   │   └── editor.ts    # COPY
│   │   └── bridge.ts        # NEW - postMessage handler
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.ts   # COPY from ritemark-app
└── out/
    └── webview.js           # Built bundle
```

---

### Task 2: Copy Reusable Code

**From:** `/Users/jarmotuisk/Projects/ritemark/ritemark-app/src/`
**To:** `extensions/ritemark/webview/src/`

```bash
# UI Components (17 files)
cp -r components/ui/ → webview/src/components/ui/

# Editor Components
cp components/Editor.tsx → webview/src/components/
cp components/FormattingBubbleMenu.tsx → webview/src/components/
cp components/TableOverlayControls.tsx → webview/src/components/
cp components/TablePicker.tsx → webview/src/components/

# TipTap Extensions
cp -r extensions/ → webview/src/extensions/

# Utilities
cp lib/utils.ts → webview/src/lib/

# Types
cp types/editor.ts → webview/src/types/

# Config
cp tailwind.config.ts → webview/
```

---

### Task 3: Adapt Editor.tsx

**Remove:**
- `DriveImageUpload` import and usage
- `AIChatSidebar` component (defer to Sprint 03)
- Google Drive specific code
- Image upload to Drive

**Keep:**
- All TipTap configuration
- Markdown ↔ HTML conversion (marked, turndown)
- Formatting bubble menu
- Table controls
- Slash commands
- Keyboard shortcuts
- Selection tracking

**Add:**
- Props for VS Code integration:
  ```typescript
  interface EditorProps {
    initialContent: string
    onContentChange: (markdown: string) => void
  }
  ```

---

### Task 4: Create postMessage Bridge

**webview/src/bridge.ts:**
```typescript
const vscode = acquireVsCodeApi()

export function sendToExtension(type: string, data: any) {
  vscode.postMessage({ type, ...data })
}

export function onMessage(callback: (msg: any) => void) {
  window.addEventListener('message', e => callback(e.data))
}
```

**Extension side (ritemarkEditor.ts):**
```typescript
// Send content to webview
webviewPanel.webview.postMessage({
  type: 'load',
  content: markdownContent
})

// Receive changes
webviewPanel.webview.onDidReceiveMessage(msg => {
  if (msg.type === 'contentChanged') {
    this.updateDocument(document, msg.content)
  }
})
```

---

### Task 5: Wire File Read

1. Extension reads .md file from `vscode.TextDocument`
2. Send raw markdown to webview via postMessage
3. Webview converts to HTML using `marked` (already in Editor.tsx)
4. TipTap renders

---

### Task 6: Wire File Save

1. TipTap emits on content change
2. Editor.tsx converts HTML → markdown using `turndown` (already there)
3. Send markdown to extension via postMessage
4. Extension applies edit to document
5. VS Code handles actual file save (Cmd+S or auto-save)

**Debounce:** 300ms after last keystroke

---

### Task 7: Test All Formatting

Verify all features from web app work:
- [ ] Bold, Italic, Underline, Strike
- [ ] Headings H1-H6
- [ ] Bullet lists (with nesting)
- [ ] Numbered lists (with nesting)
- [ ] Code blocks (with syntax highlighting)
- [ ] Tables (create, add rows/cols, delete)
- [ ] Links
- [ ] Blockquotes
- [ ] Horizontal rules
- [ ] Slash commands
- [ ] Keyboard shortcuts

---

## Code Reuse Summary

| Category | Source | Action |
|----------|--------|--------|
| UI Components | ritemark-app | COPY (17 files) |
| Editor.tsx | ritemark-app | COPY + MODIFY |
| TipTap Extensions | ritemark-app | COPY (5 files) |
| Tailwind Config | ritemark-app | COPY |
| Utils | ritemark-app | COPY |
| Types | ritemark-app | COPY |
| postMessage Bridge | - | NEW |
| Vite Config | - | NEW |

**Estimated: 80% reuse, 20% new code**

---

## Dependencies

Same as ritemark-app (proven to work):

```json
{
  "@tiptap/react": "^3.4.3",
  "@tiptap/starter-kit": "^3.4.3",
  "@tiptap/extension-table": "^3.6.6",
  "@tiptap/extension-link": "^3.4.3",
  "@tiptap/extension-placeholder": "^3.4.3",
  "@tiptap/extension-code-block-lowlight": "^3.4.4",
  "@tiptap/extension-bubble-menu": "^3.6.6",
  "marked": "^16.3.0",
  "turndown": "^7.2.1",
  "turndown-plugin-gfm": "^1.0.2",
  "lowlight": "^3.3.0",
  "react": "^19.1.1",
  "react-dom": "^19.1.1",
  "lucide-react": "^0.544.0",
  "clsx": "^2.0.0",
  "tailwind-merge": "^2.0.0"
}
```

---

## Notes

_Implementation notes will be added during development_
