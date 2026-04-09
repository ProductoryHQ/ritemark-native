# Sprint 47: Text Editor New Features

## Goal

Add two practical text editor features users expect from a markdown editor: in-document CMD+F search and a table of contents / heading navigation panel — both with lean, minimal UI.

**Spell check was originally part of this sprint but was deferred** — see the "Deferred: Spell Check" section at the bottom for the post-mortem and follow-up plan.

## Feature Flag Check

- **CMD+F Search:** No feature flag needed. Standard editor feature, no platform restriction, no download. Replaces non-functional VS Code CMD+F in webview.
- **Table of Contents:** No feature flag needed. Pure UI feature, no AI/platform dependency, not experimental.

## Success Criteria

### CMD+F Search
- [x] CMD+F opens a find bar overlaid at the top of the editor; VS Code's native find widget does NOT open
- [x] Find bar: search input, match count (e.g. "3 of 12"), prev/next navigation, close button
- [x] Find bar closes on Escape; CMD+F while open navigates to next match
- [x] Search highlights are visible in the editor
- [x] Highlights are implemented as ProseMirror decorations (not DOM manipulation) so they survive edits
- [x] Decorations auto-rebuild when the document changes while a search is active

### Table of Contents
- [x] Table of Contents panel shows all H1-H6 headings from the current document
- [x] Clicking a heading in the TOC scrolls the editor to that heading
- [x] TOC auto-updates as the user types (300ms debounce)
- [x] TOC is triggered from a "Contents" header button; dismisses on click-outside or Escape
- [x] Visual hierarchy: H1 bold, H2 muted, H3+ more indented / italic
- [x] Empty state for documents with no headings

### General
- [x] Both features have lean, minimal UI consistent with existing design language
- [x] No regressions to existing editor features (bubble menu, drag handles, slash commands, etc.)

## Deliverables

| Deliverable | Description | Status |
|-------------|-------------|--------|
| `SearchExtension.ts` | Custom TipTap extension using ProseMirror `DecorationSet` + `Plugin` API for search highlighting. No external dependencies. | ✅ Shipped |
| `FindBar.tsx` | React component: search input, match counter, prev/next, close | ✅ Shipped |
| CMD+F intercept | Window-level capture-phase keydown listener in `App.tsx` | ✅ Shipped |
| `TableOfContents.tsx` | Panel component using TipTap's `editor.state.doc.descendants()` + `editor.on('update')` with debounce | ✅ Shipped |
| "Contents" header button | New button in `DocumentHeader` to toggle TOC panel | ✅ Shipped |

## Implementation Notes

### CMD+F Search
- Built as a custom TipTap extension (`SearchExtension.ts`) using ProseMirror's native `DecorationSet` + `Plugin` API. The original sprint plan proposed `@tiptap/extension-search-and-replace` but that package does **not exist** on npm — only unofficial community forks.
- The extension owns plugin state `{ searchTerm, results, activeIndex, decorations }` and exposes commands `setSearchTerm`, `nextSearchResult`, `previousSearchResult`, `clearSearch`.
- On document changes while a search is active, decorations are rebuilt automatically to keep positions valid.
- FindBar is rendered at the top of the editor scroll container, scrolls the active match into view via `coordsAtPos`.

### Table of Contents
- Uses `editor.state.doc.descendants()` to walk heading nodes on mount and on every editor update (300ms debounced).
- Click handler uses `editor.view.coordsAtPos()` to find the DOM location, then scrolls the closest `.overflow-y-auto` container. Falls back to `domAtPos().scrollIntoView()` if coords resolution fails.
- Panel positioning: `position: fixed` anchored to the "Contents" header button's `getBoundingClientRect()` captured on mount. Header is sticky so repositioning on scroll is unnecessary.

### Shared
- Both features live in the webview only — no extension host changes.
- No new dependencies installed.
- No new VS Code settings added.
- `Editor.tsx`'s `onUpdate` handler already skips no-op transactions via the `markdown !== lastOnChangeValue` guard, so search/TOC decoration updates do not round-trip through the extension host.

## Status

**Current Phase:** 6 (Complete)
**Delivered:** CMD+F Search + Table of Contents
**Deferred:** Spell Check (see below)

## Approval

- [x] Jarmo approved scope reduction (spellcheck deferred)
- [x] Local dev mode testing confirmed CMD+F and TOC work without regressions

---

## Deferred: Spell Check

The spell check feature from the original sprint plan was deferred after multiple implementation attempts failed. This section is kept as a post-mortem to inform the follow-up sprint.

### What was tried

1. **HTML `spellcheck="true"` attribute on ProseMirror contenteditable**
   - Works in plain browsers, but VS Code's Electron main process sets `webPreferences.spellcheck: false` globally (in `vscode/src/vs/platform/windows/electron-main/windows.ts`), so the browser spell checker is disabled for all webviews.

2. **Patching VS Code core to enable `spellcheck: true`**
   - Technically works: red squiggles appeared and the native macOS context menu offered suggestions.
   - **Blocker:** On macOS, Electron uses `NSSpellChecker` which is driven by the system language. There is no per-app or per-document language override. Jarmo writes in Estonian + English and needs to pick the document language from inside Ritemark.

3. **In-webview `nspell` + per-language Hunspell dictionaries**
   - Designed a full extension: `DictionaryManager` on the Node side to download `.aff`/`.dic` from `unpkg.com` into `context.globalStorageUri`, an `nspell`-based `SpellcheckExtension` with ProseMirror decorations, a language pill in `DocumentHeader`, a per-document language stored in workspace state (not front-matter, to avoid document-mutation round-trips).
   - **Blocker:** Parsing the Estonian dictionary (4.5 MB Hunspell) on the main thread froze the editor for several seconds and then the editor went blank. Moving parsing to a Web Worker resolved the freeze but the blank-screen regression persisted and root cause was not isolated. Disabling the extension plugin entirely did not recover the editor, which pointed at something deeper in the controller or message flow.
   - Decision: revert entirely and tackle in a dedicated sprint rather than keep fighting it inside sprint 47.

### What a follow-up sprint needs to decide

- **Where does spell checking run?** Main-thread nspell is off the table. Options: (a) Web Worker nspell with async scanning and careful editor-state isolation; (b) run nspell in the extension host (Node) and exchange word lists via messages; (c) use a different library entirely (e.g., pre-computed word-set lookup, no morphology).
- **Per-document language UX:** the language pill + dropdown design from this sprint is sound and can be reused.
- **Dictionary distribution:** on-demand download from `unpkg.com` with local caching in `globalStorageUri` was working in the deferred branch and is a good pattern to keep.
- **Root cause of the blank editor:** before writing new spell-check code, reproduce the blank-screen bug in a minimal branch and find out what actually broke. Candidates: (a) decoration rebuild dispatched during React render, (b) forceUpdate loop, (c) ProseMirror view in an invalid state when a module-level refs set dispatches transactions.
