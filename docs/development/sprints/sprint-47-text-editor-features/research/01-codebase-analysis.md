# Research: Codebase Analysis for Text Editor Features

**Sprint:** 47 - Text Editor New Features
**Date:** 2026-03-28
**Phase:** 1 - Research

---

## 1. TipTap Editor Setup

### Extensions Currently Loaded (Editor.tsx)

The editor is built with TipTap v2.1.x and loads the following extensions:

| Extension | Notes |
|-----------|-------|
| `StarterKit` | Configured with heading levels 1-6; bulletList/orderedList/codeBlock/link disabled in StarterKit (custom versions used) |
| `CodeBlockWithCopyExtension` | Custom extension using lowlight for syntax highlighting |
| `BulletList`, `OrderedList`, `ListItem` | Separate from StarterKit, styled with class attributes |
| `TaskList`, `TaskItem` | Nested support enabled |
| `Placeholder` | Configurable placeholder text |
| `CustomLink` | Opens external links via extension host; validates http/https only |
| `tableExtensions` | Multi-extension array for table support |
| `ImageExtension` | Custom image handling with webview URI mapping |
| `SlashCommands` | `/` slash command menu |
| `GlobalDragHandle` | Drag-and-drop block reordering |
| `AutoJoiner` | Auto-joins adjacent lists |

### Key Props

```typescript
interface EditorProps {
  value: string           // Markdown content
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  onEditorReady?: (editor: TipTapEditor) => void
  onSelectionChange?: (selection: EditorSelection) => void
  imageMappings?: Record<string, string>
}
```

### Editor `editorProps.attributes`

```typescript
{ class: 'prose prose-lg max-w-none focus:outline-none' }
```

The ProseMirror element gets these HTML attributes. This is where `spellcheck="true"` can be injected.

### Existing keyboard shortcuts in `handleKeyDown`

The editor handles these in `editorProps.handleKeyDown`:
- `Mod+Shift+C` → toggle code block
- `Mod+Shift+↑/↓/←/→` → table row/column operations
- `Mod+Backspace` → delete table row
- `Mod+Delete` → delete table column
- `Mod+Shift+7` → ordered list
- `Mod+Shift+8` → bullet list
- Tab/Shift+Tab → list indent/outdent
- Enter → empty list item exits list

**CMD+F is NOT handled at all.** This means CMD+F currently propagates to VS Code, which opens VS Code's native find widget. This is the conflict to resolve.

---

## 2. Webview Structure

### Component Hierarchy (for markdown files)

```
App.tsx
├── DocumentHeader (sticky header: Properties, Voice Dictation, Export)
├── div.flex-1.overflow-y-auto
│   └── Editor (value, onChange, onSelectionChange, onEditorReady, imageMappings)
│       ├── EditorContent (TipTap ProseMirror)
│       ├── FormattingBubbleMenu
│       ├── TableOverlayControls
│       └── BlockMenu (conditional)
├── PropertiesModal
└── ExportMenu
```

### App Layout

The App renders `h-screen flex flex-col`. The editor lives in a `flex-1 overflow-y-auto` div. This means a TOC panel could be added as a sibling, or integrated alongside the editor area.

### Message Bridge

`bridge.ts` provides:
- `sendToExtension(type, data)` — sends to VS Code extension host
- `onMessage(callback)` — receives messages from extension host
- `emitInternalEvent(type, data)` — webview-internal events
- `onInternalEvent(...)` — listen to internal events

For spellcheck and search (pure webview features), no bridge communication is needed. For settings persistence, `vscode.postMessage({ type: 'setSetting', key, value })` is the established pattern.

---

## 3. CMD+F: Current Behavior and Conflict

### Current State

CMD+F in the webview currently does nothing in the webview. The keydown event propagates and VS Code's native find widget intercepts it. This opens VS Code's file-search overlay, which is not contextually relevant for a markdown editor.

### No `enableFindWidget` Found

VS Code's webview API has an `enableFindWidget` option that shows a native browser-like find bar within the webview. It is **not currently enabled** in `ritemarkEditor.ts`. The webview options only set `retainContextWhenHidden: true`.

### Strategy for CMD+F

To intercept CMD+F before VS Code sees it, the webview must call `event.preventDefault()` inside a `keydown` handler. Since the editor's `handleKeyDown` (ProseMirror level) receives events first, the intercept should happen there.

**Approach:** Add `Mod+F` handling in `Editor.tsx`'s `handleKeyDown` that:
1. Calls `event.preventDefault()`
2. Emits an internal event `editor:find-open`
3. The find bar component (in App.tsx or as overlay) shows in response

The find bar must trap further CMD+F presses to cycle to next match, and Escape to close.

### TipTap Search Extension

TipTap v2 does NOT include a search-and-replace extension in its core. The community package `@tiptap/extension-search-and-replace` exists but is **not in the webview's package.json** and not installed. Options:

1. **Install `@tiptap/extension-search-and-replace`** — provides `setSearchTerm`, `nextSearchResult`, `previousSearchResult`, `replaceAll` commands. Handles highlighting via CSS decorations.
2. **Implement custom search** — use ProseMirror decorations manually. More work, full control.
3. **Use browser's built-in `window.find()`** — least effort, but no match count or navigation control.

Recommendation: Install `@tiptap/extension-search-and-replace` — this is the right tool for the job.

---

## 4. Spellcheck

### Browser Native Spellcheck

TipTap's ProseMirror contenteditable divs support browser native spellcheck via the `spellcheck` HTML attribute:
- `spellcheck="true"` — enables OS/browser spellcheck (red underlines, right-click corrections)
- `spellcheck="false"` — disables it (current default in most browsers for contenteditable)

### Implementation

Add `spellcheck: 'true'` (or `'false'` based on setting) to `editorProps.attributes` in `useEditor`:

```typescript
attributes: {
  class: 'prose prose-lg max-w-none focus:outline-none',
  spellcheck: 'true',  // or pass as prop
}
```

### Settings Toggle

The settings system uses:
1. VS Code `workspace.getConfiguration('ritemark')` for reading
2. `config.update(key, value, Global)` for writing
3. Settings are sent to webview via `postMessage({ type: 'settings', data: { ... } })`
4. Webview sends `{ type: 'setSetting', key, value }` to update

A `ritemark.editor.spellcheck` boolean setting (default: `true`) would:
- Be read in `RitemarkSettingsProvider.sendCurrentSettings()`
- Be sent in the `load` message to the editor webview
- The `Editor` component receives it as a prop (threaded through App.tsx)
- `editorProps.attributes.spellcheck` is set accordingly

The settings page (`RitemarkSettings.tsx`) would show a toggle in a new "Editor" section.

---

## 5. Table of Contents / Heading Navigation

### No Existing TOC Code

No TOC, outline, or heading navigation code exists anywhere in the webview. This is a net-new feature.

### Heading Data from TipTap

TipTap's document model provides full access to heading nodes. The pattern to extract headings:

```typescript
editor.state.doc.descendants((node, pos) => {
  if (node.type.name === 'heading') {
    const level = node.attrs.level  // 1-6
    const text = node.textContent   // heading text
    // pos can be used to scroll to this heading
  }
})
```

### Scrolling to Heading

TipTap + ProseMirror provides `editor.commands.setTextSelection(pos)` to move cursor. For visual scroll-into-view, the DOM element can be queried:

```typescript
editor.view.domAtPos(pos).node  // → DOM node at position
domNode.scrollIntoView({ behavior: 'smooth', block: 'start' })
```

### Where to Show TOC

Options:
1. **Panel in DocumentHeader** — click a "Outline" icon, TOC appears as a dropdown/popover below header
2. **Side panel** — fixed sidebar alongside the editor scroll area
3. **Floating overlay** — appears on demand, dismisses on click

Given "lean design" requirement and the App layout (`h-screen flex flex-col` with a `flex-1 overflow-y-auto` editor area), the cleanest approach is a **fixed overlay panel** anchored to the top-right of the editor area, triggered from a header button. It disappears when clicking outside or pressing Escape.

### Auto-Update on Typing

TipTap's `editor.on('update', callback)` fires on every document change. A debounced heading scan can update the TOC in real-time.

---

## 6. Settings System Summary

### Current Flow

1. VS Code `package.json` declares settings under `contributes.configuration`
2. Extension reads via `config.get('features.voice-dictation', false)`
3. Settings sent to webview in `load` message under `features` key and to settings panel
4. Features sent to editor as `{ voiceDictation: boolean, markdownExport: boolean }`
5. Settings page sends `{ type: 'setSetting', key: 'features.voice-dictation', value: true }` to update

### Adding Spellcheck Setting

Three files need changes:
1. `extensions/ritemark/package.json` — add `ritemark.editor.spellcheck` setting
2. `extensions/ritemark/src/settings/RitemarkSettingsProvider.ts` — include in `sendCurrentSettings()`
3. `extensions/ritemark/src/ritemarkEditor.ts` — include in `load` message `features` payload
4. `App.tsx` — thread `spellcheck` through Features interface and Editor props
5. `Editor.tsx` — accept and apply `spellcheck` prop
6. `RitemarkSettings.tsx` — add toggle in new "Editor" section

---

## 7. Key Constraints and Risks

| Risk | Mitigation |
|------|-----------|
| CMD+F intercept breaks VS Code find | `event.preventDefault()` in ProseMirror `handleKeyDown` prevents propagation |
| `@tiptap/extension-search-and-replace` version mismatch | Use `^2.x` matching existing TipTap packages |
| Search highlight CSS conflicts with existing editor styles | Scope CSS to `.ritemark-search-result` class |
| TOC panel covers editor content | Use overlay with dismiss-on-click-outside, or animate in from right |
| Spellcheck underlines clutter code blocks | Can disable with CSS: `pre code { spell-check: false }` attribute on CodeBlock |
| Settings page stub risk (see v1.3.0 incident) | Settings page is full implementation (400+ lines) — only adding a toggle, not replacing anything |

---

## 8. Files to Modify

### Spellcheck
- `extensions/ritemark/package.json` — add setting declaration
- `extensions/ritemark/src/settings/RitemarkSettingsProvider.ts` — read/send setting
- `extensions/ritemark/src/ritemarkEditor.ts` — include in load message
- `extensions/ritemark/webview/src/App.tsx` — thread Features.spellcheck
- `extensions/ritemark/webview/src/components/Editor.tsx` — accept spellcheck prop, apply to editorProps.attributes
- `extensions/ritemark/webview/src/components/settings/RitemarkSettings.tsx` — add toggle

### CMD+F Search
- `extensions/ritemark/webview/package.json` — add `@tiptap/extension-search-and-replace`
- `extensions/ritemark/webview/src/components/Editor.tsx` — add extension, intercept CMD+F, expose search state/commands via ref or callback
- `extensions/ritemark/webview/src/components/FindBar.tsx` — NEW: search UI component
- `extensions/ritemark/webview/src/App.tsx` — render FindBar, handle show/hide

### Table of Contents
- `extensions/ritemark/webview/src/components/TableOfContents.tsx` — NEW: TOC panel component
- `extensions/ritemark/webview/src/components/header/DocumentHeader.tsx` — add TOC toggle button
- `extensions/ritemark/webview/src/App.tsx` — thread editor ref to TOC, manage show/hide state

---

## 9. Existing Related Code

- `handleKeyDown` in `Editor.tsx` (line 532) — where CMD+F intercept goes
- `editorProps.attributes` in `useEditor` (line 495) — where `spellcheck` attribute goes
- `editor.state.doc.descendants()` used already in `App.tsx` for document traversal — same API for TOC
- `sendToExtension` / `onMessage` in `bridge.ts` — settings pattern to follow
- `DocumentHeader.tsx` — header buttons pattern (ghost buttons with icon + label)
- `VoiceDictationButton` in header — example of feature-gated header button
