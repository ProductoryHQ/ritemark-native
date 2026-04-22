# Sprint 51: Inline ToC + CSV-to-Excel Handoff — Phase 1 Research

**Date:** 2026-04-21 (updated with deep codebase review findings)
**Status:** Phase 1 COMPLETE. Ready for Phase 2 planning.
**No code has been written.**

---

## Scope Decision (Confirmed by Jarmo)

Sprint 51 covers **Items A and B only**. Items C, D, E, F were confirmed already complete and moved to Completed in `docs/WISHLIST.md`.

Sprint title: **Sprint 51 — Inline ToC + CSV-to-Excel Handoff**

---

## Item A: CSV "Open in Excel" — Semicolon Delimiter Problem

### Problem

EU-locale CSV files use `;` as the column separator. When a user clicks "Open in Excel", the raw file is handed to the OS. Excel's heuristic delimiter detection fails on non-English locales, rendering the file as a single column.

### Current code path (confirmed by code review)

1. Webview: user clicks the "Open in Excel" / "Open in Numbers" split-button in `SpreadsheetToolbar.tsx`.
2. Webview sends `{ type: 'openInExternalApp', app: 'excel' | 'numbers' }` via `sendToExtension`.
3. Two providers handle CSV:
   - `extensions/ritemark/src/ritemarkEditor.ts` line 447 → private `openInExternalApp` method at line 1042
   - `extensions/ritemark/src/excelEditorProvider.ts` line 107 → private `openInExternalApp` method at line 229
   - (`docxEditorProvider.ts` handles Word — not CSV, not touched.)
4. `extensions/ritemark/src/utils/openExternal.ts` exports `openInExternalApp(filePath, appName)`:
   - macOS: `open -a "Microsoft Excel" "/path/to/file.csv"`
   - Windows: `start "" "/path/to/file.csv"`
5. Raw `.csv` bytes reach Excel unchanged.

### Existing utility confirmed

`openExternal.ts` already imports `fs`, `path`, and `child_process`. It does NOT import `os`. The `os` import needs to be added for `os.tmpdir()`.

### Temp-file cleanup pattern — existing codebase precedent

`extensions/ritemark/src/utils/whisperCpp.ts` uses `setTimeout(() => { try { fs.unlinkSync(tempPath); } catch {} }, 5000)` to clean up temp files after handing them to an external process. This is the exact pattern to copy for the CSV temp file — 5 seconds matches the whisperCpp precedent (not 3 seconds as originally estimated).

### LOCKED Decision

Always write a UTF-8 BOM + `sep=<delimiter>` hint line to a temp file. Open the temp file instead of the original. Gate on `.csv` extension AND `app === 'excel'` — Numbers and XLSX bypass the helper entirely.

Jarmo's framing: "make life easier" — consistent behavior, works regardless of locale, no regression for comma CSVs.

### Surgical scope: 3 file touches, NO new files

The helper function goes inside the existing `openExternal.ts` — not in a separate `csvTempFile.ts`. Two call-site changes in `ritemarkEditor.ts` and `excelEditorProvider.ts` (2 lines each).

### Platform scope

Both macOS and Windows. Excel on both platforms respects UTF-8 BOM + `sep=` the same way. Numbers on macOS treats the `sep=` line as a first data row — acceptable tradeoff.

---

## Item B: Inline Table of Contents

### Problem

The current ToC is a dropdown overlay. It does not track scroll position, does not highlight the active heading, and closes on click. Unused horizontal space exists when the window is wide enough.

### Deep codebase review findings

#### Existing patterns to reuse (confirmed locations)

**1. Heading extraction and scroll — `TableOfContents.tsx`**

- `getHeadings()` at lines 16–28: uses `editor.state.doc.descendants()`. Currently not exported. Must be extracted to a shared utility.
- Scroll-to-heading logic at lines 78–101: uses `editor.view.coordsAtPos()` + `.closest('.overflow-y-auto')` to find the scroll container. Same approach must be reused verbatim.
- Both functions go into a new `extensions/ritemark/webview/src/lib/headingUtils.ts` — this is a pure extraction (move, not copy) that unblocks reuse by `InlineTableOfContents.tsx` without duplication.

**2. IntersectionObserver pattern — `PDFViewer.tsx` lines 37–50**

Pattern: `new IntersectionObserver(callback, options)` created directly inside a `useEffect`, observed elements queried from the DOM, `observer.disconnect()` in the cleanup return. No custom hook. `InlineTableOfContents.tsx` and `App.tsx` use this exact shape.

**3. Window/container resize pattern — `ExportMenu.tsx` lines 73–94**

Pattern: `window.addEventListener('resize', handler)` directly inside `useEffect`. However, for the inline ToC visibility threshold, `window.resize` is insufficient — VS Code's sidebar open/close shrinks the editor container without changing the window width. Must use `ResizeObserver` on the scroll container's parent instead. `ResizeObserver` is new to the webview codebase but follows the same "direct observer in useEffect" shape as the existing IntersectionObserver usage — no precedent break, just a different observer type.

**4. CSS variables — reuse confirmed**

Confirmed variables in use across existing ToC and editor components:
- `--vscode-toolbar-hoverBackground` (hover states)
- `--vscode-panel-border` (dividers)
- `--vscode-focusBorder` (focus/active states)
- `--vscode-descriptionForeground` (secondary text)
- `--vscode-foreground` (primary text)
- `--vscode-editor-background` (panel backgrounds)

**5. Typography scale — confirmed from `TableOfContents.tsx`**

H1: 13px/500, H2: 12px/400, H3+: italic + reduced opacity. Same indentation ladder. `InlineTableOfContents.tsx` matches this scale exactly.

**6. DocumentHeader hide mechanism — confirmed**

`DocumentHeader.tsx` already guards: `{onContentsClick && <button>Contents</button>}`. Passing `onContentsClick={undefined}` from `App.tsx` when the inline ToC is visible hides the button with **zero changes to `DocumentHeader.tsx`**.

#### shadcn/ui inventory check

The `webview/src/components/ui/` folder was reviewed. `InlineTableOfContents.tsx` is a list of styled buttons — it does not need a shadcn/ui Dialog or other composite component. Styling via inline CSS matching the existing `TableOfContents.tsx` approach is correct here.

#### Drag-handle conflict check (Sprint 14)

The `+` drag handle uses `position: fixed` and tracks cursor position via `editor.view.coordsAtPos()`, which returns viewport coordinates. When the editor column shifts right by ~200px (ToC column appearing), the viewport coordinates remain accurate because `coordsAtPos` returns coordinates relative to the viewport, not the editor DOM. **No regression expected**, but this must be verified in Phase 3 with the ToC column visible.

#### App.tsx layout — confirmed current structure (lines ~455–470)

```
<div class="h-screen flex flex-col">
  <DocumentHeader />
  <div class="flex-1 overflow-y-auto">   ← this div gets the flex-row wrapper
    <FindBar />
    <Editor />
  </div>
  <TableOfContents />   ← currently outside flow, position: fixed
</div>
```

The layout change wraps the `flex-1 overflow-y-auto` div in a `flex-1 flex overflow-hidden` row container. The scroll div retains `flex-1 overflow-y-auto`. Minimal surgery.

### LOCKED Decisions

1. **Shared utilities:** Extract `getHeadings()` and `scrollToHeading()` to `lib/headingUtils.ts`. Update `TableOfContents.tsx` to import from there. `InlineTableOfContents.tsx` also imports from there.
2. **Layout:** `flex flex-row overflow-hidden` wrapper around the scroll container. ToC column: 200px fixed width. Editor column: `flex-1`.
3. **Threshold mechanism:** `ResizeObserver` on the scroll container's parent. Named constant `INLINE_TOC_MIN_WIDTH = 960` (starting value — Jarmo adjusts during Phase 3 testing).
4. **Active-heading tracking:** `IntersectionObserver` on heading DOM nodes, set up in `App.tsx` (not inside `InlineTableOfContents.tsx`). `activeHeadingPos` passed as prop. Re-established when heading count changes.
5. **Contents button:** Hidden by passing `onContentsClick={undefined}` when inline ToC visible. Zero `DocumentHeader.tsx` changes.
6. **Empty-state:** `headings.length < 2` → no inline ToC, editor full width.
7. **No new hooks files.** All observers go directly inside `useEffect` in `App.tsx`, matching existing codebase patterns.

---

## Items Removed from Scope (C/D/E/F)

Items C (DataTable column max-width), D (Windows save notification), E (CSV row deletion), and F (Welcome tab icon) confirmed by Jarmo as already complete.

---

## Items NOT Included (Out of Scope)

Large-scope features deferred to dedicated sprints: Export V2, AI Agent Mode Picker, Chat Histories, @ Mentions, VS Code upstream update, Homebrew Cask, i18n, RAG integration.

---

*Phase 1 complete. Deep codebase review complete. No code written. Proceeding to Phase 2 sprint plan.*
