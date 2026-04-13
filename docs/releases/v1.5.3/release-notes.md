# Ritemark v1.5.3

**Status:** Draft
**Type:** Minor release
**Focus:** Text Editor Quality of Life — in-document search and table of contents

---

## Downloads

| Platform | Download |
|----------|----------|
| macOS Apple Silicon (M1/M2/M3) | [Ritemark-arm64.dmg](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-arm64.dmg) |
| macOS Intel | [Ritemark-x64.dmg](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-x64.dmg) |
| Windows | [Ritemark-Setup.exe](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-1.5.3-win32-x64-setup.exe) |

---

## Summary

Ritemark v1.5.3 adds two quality-of-life features that users expect from any serious markdown editor: **in-document CMD+F search** with live match navigation, and a **Table of Contents panel** that lists every heading in the current document and lets you jump straight to it.

Both features are implemented with lean, minimal UI and no new dependencies — just native ProseMirror extensions and React components.

---

## What's New

### CMD+F Find in Document

Pressing CMD+F (Ctrl+F on Windows) now opens a find bar at the top of the editor instead of triggering VS Code's native find widget.

- **Live match highlighting:** Every occurrence of the search term is highlighted as you type, with the active match shown in a brighter color
- **Match counter:** See "3 of 12" at a glance; "No results" when nothing matches
- **Keyboard navigation:** Enter moves to the next match, Shift+Enter to the previous
- **Cycle from inside the find bar:** Press CMD+F again while the bar is open to advance to the next match
- **Escape closes:** Dismiss the find bar with the Escape key; highlights clear automatically
- **Survives edits:** Search highlights are implemented as ProseMirror decorations so they stay in the right place as you type, and they rebuild automatically when the document changes while search is active

### Table of Contents

A new **Contents** button in the document header opens a panel listing every heading in the current document.

- **Full heading tree:** All H1-H6 headings are shown with visual indentation and styling: H1 bold, H2 muted, H3+ italic and more indented
- **Click to jump:** Clicking a heading scrolls the editor straight to that section
- **Auto-update:** The panel refreshes as you add, remove, or edit headings (300ms debounced)
- **Empty state:** Documents with no headings show "No headings yet. Start a line with # to create one."
- **Dismiss on click-outside or Escape:** The panel behaves like a standard dropdown

---

## Improvements

### Unified block menus

The slash command menu (`/`) and the `+` button block menu now share a single source of truth for all block types. Both menus offer the same 13 block types (Text, Heading 1-3, Bullet List, Numbered List, Task List, Quote, Code Block, Table, Mermaid Diagram, Image, Divider) with consistent styling.

### Search fixes

- **CMD+F restricted to markdown editor:** The CMD+F shortcut no longer intercepts search in PDF, DOCX, and Spreadsheet viewers — those viewers keep their native find behavior.
- **Cross-node search:** Search now finds matches that span formatting boundaries (e.g. a phrase split between plain and **bold** text).

### Editor robustness

- **No-op transactions skipped in onUpdate:** The editor now ignores meta-only transactions (used by search and future extensions) in its `onUpdate` handler, preventing unnecessary `contentChanged` round-trips to the extension host.
- **Search extension is document-change aware:** While a search is active, edits to the document automatically rebuild decorations instead of leaving stale highlights behind.

### Developer experience

- **TypeScript type checking:** Added `npm run typecheck` (`tsc --noEmit`) to the webview project for catching type errors before they reach production.
- **CI hardening:** Windows build workflow hardened against EMFILE errors.

---

## Deferred

### Spell check

Spell check was originally part of this sprint but has been deferred to a dedicated follow-up sprint.

Three approaches were tried during development and all were blocked:

1. **Native HTML `spellcheck` attribute** — disabled globally by VS Code core at the Electron process level.
2. **Patching VS Code core to enable native spell check** — works for rendering red squiggles, but macOS's `NSSpellChecker` is driven by the system language and cannot be overridden per document or per app. Ritemark's target users frequently mix Estonian and English in the same document and need per-document language control.
3. **In-webview Hunspell via `nspell` + on-demand dictionary downloads with a Web Worker** — designed end-to-end and partially shipped, but repeated editor blank-screen regressions could not be isolated in time. Reverted entirely to avoid shipping a broken feature.

The groundwork (dictionary download, per-document language storage, language picker UX) is documented in the sprint post-mortem and will be revisited in a dedicated spell-check sprint with a proper architecture investigation first.

---

## User Impact

Markdown authors who work with long documents get two features they've been missing:

- **CMD+F inside the document** instead of the distracting VS Code file-search overlay
- **Jump to any heading** without scrolling through hundreds of paragraphs

Both features require zero configuration and work out of the box on all platforms.

---

## Technical Notes

New files:

- `extensions/ritemark/webview/src/extensions/SearchExtension.ts` — custom TipTap extension using ProseMirror `DecorationSet` + `Plugin` API
- `extensions/ritemark/webview/src/components/FindBar.tsx` — find bar React component
- `extensions/ritemark/webview/src/components/header/TableOfContents.tsx` — TOC panel React component

Modified:

- `extensions/ritemark/webview/src/App.tsx` — find bar state, TOC state, CMD+F capture-phase listener
- `extensions/ritemark/webview/src/components/Editor.tsx` — register SearchExtension, skip no-op transactions in `onUpdate`
- `extensions/ritemark/webview/src/components/header/DocumentHeader.tsx` — add "Contents" header button
- `extensions/ritemark/webview/src/components/header/index.ts` — export TableOfContents

No new dependencies. No new VS Code settings. No extension-host changes.

---

## Included Work

- `feat: add CMD+F search and table of contents`
- `fix(sprint-47): rewrite FindBar with ProseMirror decorations + ref/spellcheck fixes`
- `revert(sprint-47): remove spellcheck feature entirely`
- `fix(sprint-47): unify block menus, fix Codex review issues, add typecheck`
- `ci: harden windows build against EMFILE`
