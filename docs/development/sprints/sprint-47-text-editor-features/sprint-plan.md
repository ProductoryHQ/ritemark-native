# Sprint 47: Text Editor New Features

## Goal

Add three practical text editor features users expect from a markdown editor: native spellcheck, in-document CMD+F search, and a table of contents / heading navigation panel — all with lean, minimal UI.

## Feature Flag Check

- **Spellcheck:** No feature flag needed. This is a straightforward editor enhancement. Default ON. Users can toggle in Settings.
- **CMD+F Search:** No feature flag needed. Standard editor feature, no platform restriction, no download. Replaces non-functional VS Code CMD+F in webview.
- **Table of Contents:** No feature flag needed. Pure UI feature, no AI/platform dependency, not experimental.

## Success Criteria

- [ ] Spellcheck is active by default in the TipTap editor (red underlines from OS spell checker, right-click corrections work)
- [ ] Spellcheck toggle exists in the Settings page under a new "Editor" section
- [ ] CMD+F opens a find bar overlaid at the top of the editor; VS Code's native find widget does NOT open
- [ ] Find bar: search input, match count (e.g. "3 of 12"), prev/next navigation, close button
- [ ] Find bar closes on Escape; CMD+F while open navigates to next match
- [ ] Search highlights are visible in the editor
- [ ] Table of Contents panel shows all H1-H6 headings from the current document
- [ ] Clicking a heading in the TOC scrolls the editor to that heading
- [ ] TOC auto-updates as the user types (debounced)
- [ ] TOC is triggered from a header button; dismisses on click-outside or Escape
- [ ] All three features have lean, minimal UI consistent with existing design language

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| Spellcheck attribute | `spellcheck` attr on ProseMirror contenteditable, driven by setting |
| `ritemark.editor.spellcheck` setting | VS Code config setting, default `true`, wired to editor |
| Settings toggle | New "Editor" section in RitemarkSettings.tsx with spellcheck toggle |
| `@tiptap/extension-search-and-replace` | New npm dependency for search/highlight |
| `FindBar.tsx` | New component: search input, match counter, prev/next, close |
| CMD+F intercept | ProseMirror handleKeyDown intercepts Mod+F, shows FindBar |
| `TableOfContents.tsx` | New component: heading list, click-to-scroll |
| TOC header button | "Outline" button in DocumentHeader to toggle TOC panel |

## Implementation Checklist

### Phase 1: Spellcheck

- [ ] Add `ritemark.editor.spellcheck` to `extensions/ritemark/package.json` configuration properties (type: boolean, default: true)
- [ ] Read setting in `RitemarkSettingsProvider.sendCurrentSettings()` and include in settings payload
- [ ] Include `spellcheck` boolean in the `features` object sent in the editor `load` message (`ritemarkEditor.ts`)
- [ ] Add `spellcheck` to `Features` interface in `App.tsx`
- [ ] Thread `spellcheck` to `Editor` component as a prop
- [ ] Add `spellcheck` prop to `EditorProps` in `Editor.tsx`
- [ ] Apply `spellcheck: spellcheck ? 'true' : 'false'` to `editorProps.attributes` in `useEditor`
- [ ] Add "Editor" section to `RitemarkSettings.tsx` with a spellcheck toggle (reuse existing toggle pattern)

### Phase 2: CMD+F Search

- [ ] Add `@tiptap/extension-search-and-replace` to `extensions/ritemark/webview/package.json` and run `npm install`
- [ ] Import and register `SearchAndReplace` extension in `Editor.tsx` `useEditor` extensions array
- [ ] Intercept `Mod+F` in `editorProps.handleKeyDown` — call `event.preventDefault()` and emit internal event `editor:find-open`
- [ ] Create `extensions/ritemark/webview/src/components/FindBar.tsx` with:
  - Search input (auto-focused on open)
  - Match count display ("X of Y" or "No results")
  - Previous match button (up arrow icon)
  - Next match button (down arrow icon)
  - Close button (X icon)
  - Keyboard: Enter → next match, Shift+Enter → prev match, Escape → close
- [ ] In `App.tsx`: add `showFindBar` state, listen for `editor:find-open` internal event, render `FindBar` overlaid above editor content
- [ ] Wire FindBar to editor ref's search commands (`editor.commands.setSearchTerm`, `editor.commands.nextSearchResult`, `editor.commands.previousSearchResult`)
- [ ] Add CSS for search highlight marks (yellow background, scoped to editor)
- [ ] Ensure closing FindBar clears the search term to remove highlights

### Phase 3: Table of Contents

- [ ] Create `extensions/ritemark/webview/src/components/TableOfContents.tsx`:
  - Receives `editor: TipTapEditor | null` and `onClose: () => void` as props
  - Extracts headings via `editor.state.doc.descendants()` on mount and `editor.on('update', ...)` with debounce
  - Renders heading list with visual indentation by level (H1 full left, H2 indented, H3 more indented)
  - Click handler: `editor.commands.setTextSelection(pos)` + `scrollIntoView`
  - Empty state: "No headings found"
  - Panel style: fixed/absolute overlay, white background, subtle shadow, max-height with scroll, min-width 240px
  - Escape key → calls `onClose`
  - Click outside → calls `onClose`
- [ ] Add "Outline" button to `DocumentHeader.tsx` (icon: `List` from lucide-react, label: "Outline")
- [ ] Add `showTOC` state and `onTOCClick` callback to `App.tsx`
- [ ] Render `TableOfContents` in App.tsx conditionally, passing `editorRef.current` and close handler
- [ ] Position TOC panel correctly (anchored below the Outline header button, not obscuring full editor)

## Status

**Current Phase:** 2 (PLAN)
**Approval Required:** Yes — waiting for Jarmo's approval before Phase 3

## Approval

- [ ] Jarmo approved this sprint plan
