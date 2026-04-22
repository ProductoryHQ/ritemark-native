# Sprint 51: Inline ToC + CSV-to-Excel Handoff

## Goal

Fix two user-facing rough edges: (A) CSV files opening as a single unreadable column in Excel — fixed by always prepending a UTF-8 BOM and `sep=` hint to a temp file before handing off to the OS; (B) add a persistent inline Table of Contents panel that appears at wide viewports, tracks the active heading as the user scrolls, and gracefully collapses to the existing dropdown at narrow widths.

---

## Feature Flag Check

- [ ] Does this sprint need a feature flag?
  - Item A is a bug fix — 100% consistent behavior improvement, no flag needed.
  - Item B is a visible layout change, but not experimental, not platform-specific, and not premium. The panel appears only at wide viewports where it adds genuine value and falls back gracefully.
  - **Decision: No feature flags for this sprint.** Both items are small, targeted, and revertable via git if needed.

---

## Success Criteria

- [ ] Opening a semicolon-delimited CSV in Excel shows data in multiple columns (not a single column).
- [ ] Opening a comma-delimited CSV in Excel is unaffected.
- [ ] Opening a `.xlsx` file in Excel is unaffected — no temp file, no hint line.
- [ ] Opening a CSV in Numbers is unaffected — original file opened directly.
- [ ] The inline ToC panel is visible at wide viewport widths and shows the document's headings.
- [ ] The active heading in the inline ToC updates as the user scrolls.
- [ ] Clicking a heading in the inline ToC scrolls the editor to that heading.
- [ ] At narrow viewport widths, the inline panel is hidden and the "Contents" dropdown button reappears.
- [ ] When the document has fewer than 2 headings, the inline ToC panel is not rendered.
- [ ] The "Contents" button is hidden when the inline ToC is visible.
- [ ] Opening/closing the VS Code sidebar triggers the threshold re-evaluation.

---

## Deliverables

| Deliverable | Description |
|---|---|
| `openCsvInExcelWithHints()` in `openExternal.ts` | New exported function. BOM + `sep=` detection + temp file write + cleanup. No new files. |
| Updated call sites in `ritemarkEditor.ts` + `excelEditorProvider.ts` | 2-line branch at each call site. |
| `lib/headingUtils.ts` (new) | Extracted `getHeadings()` and `scrollToHeading()` from `TableOfContents.tsx`. Single source of truth. |
| Updated `TableOfContents.tsx` | Import from `headingUtils.ts`. Zero behavior change — pure refactor. |
| `InlineTableOfContents.tsx` (new) | Display-only component. Heading list, active indicator, scroll-to-heading on click. |
| Updated `App.tsx` | `ResizeObserver` + `IntersectionObserver` wired directly in `useEffect`. Layout wrapper. State. |

**Total files touched: 5 (2 new, 3 modified). No changes to `DocumentHeader.tsx`.**

---

## Item A: CSV Handoff — Surgical Implementation Plan

### Files touched: 3

**File 1 — `extensions/ritemark/src/utils/openExternal.ts`**

Add new exported async function `openCsvInExcelWithHints(filePath: string, appName: string): Promise<void>`.

Implementation steps:
1. `fs.readFileSync(filePath, 'utf8')` — read as string.
2. Strip existing UTF-8 BOM if present (check first char `'﻿'`).
3. Strip existing `sep=` line if present (check if first line matches `/^sep=/i`, slice it out).
4. Detect delimiter: count `;` / `,` / `\t` in the first non-empty line. Winner by highest count. Tiebreak: `,` > `;` > `\t`. If all zero, default to `,`.
5. Build content: `'﻿' + 'sep=' + delimiter + '\n' + strippedContent`.
6. Write to temp: `path.join(os.tmpdir(), \`ritemark-csv-${Date.now()}-${path.basename(filePath)}\`)` via `fs.writeFileSync(tempPath, content, 'utf8')`.
7. Call existing `openInExternalApp(tempPath, appName)`.
8. `setTimeout(() => { try { fs.unlinkSync(tempPath); } catch {} }, 5000)` — matches `whisperCpp.ts` cleanup pattern.

Add `import * as os from 'os'` (not currently imported). `path` and `fs` are already imported.

Keep existing `openInExternalApp` unchanged.

**File 2 — `extensions/ritemark/src/ritemarkEditor.ts` (at line 1042 method)**

Change the `openInExternalApp` call to branch:
```ts
if (filePath.toLowerCase().endsWith('.csv') && app === 'excel') {
  await openCsvInExcelWithHints(filePath, appName);
} else {
  await openInExternalApp(filePath, appName);
}
```

**File 3 — `extensions/ritemark/src/excelEditorProvider.ts` (at line 229 method)**

Same 2-line branch as File 2. Note: this provider handles both CSV and XLSX — the `app === 'excel'` guard ensures XLSX files keep the original raw call.

### Edge cases

| Case | Handling |
|---|---|
| Existing UTF-8 BOM at start | Strip before re-prepending. No double-BOM. |
| Existing `sep=` line | Strip before re-prepending. No stacked hints. |
| Empty file | First-line scan finds no delimiters → default `,`. Writes `sep=,` hint. Opens in Excel as empty — correct. |
| Non-UTF-8 input bytes | Passed through unchanged. Encoding fix is out of scope. |
| `app !== 'excel'` (Numbers, etc.) | Bypass the helper. Original file opened directly. Numbers does not need `sep=`. |
| `.xlsx` file extension | Branch condition `endsWith('.csv')` false → original call. Helper never reached. |

---

## Item B: Inline ToC — Surgical Implementation Plan

### Files touched: 5 (2 new, 3 modified)

### Patterns reused — no invention

| Pattern | Source location | Reuse in sprint |
|---|---|---|
| Heading extraction via `doc.descendants()` | `TableOfContents.tsx:16–28` | Extracted to `headingUtils.ts`, imported everywhere |
| Scroll-to-heading via `coordsAtPos()` + `.closest('.overflow-y-auto')` | `TableOfContents.tsx:78–101` | Extracted to `headingUtils.ts`, imported everywhere |
| `IntersectionObserver` direct in `useEffect` | `PDFViewer.tsx:37–50` | `App.tsx` active-heading tracking |
| Observer cleanup in `useEffect` return | `PDFViewer.tsx:37–50` | `App.tsx` observer teardown |
| CSS variables | Existing ToC | `InlineTableOfContents.tsx` |
| Typography scale | `TableOfContents.tsx` | `InlineTableOfContents.tsx` |
| `onContentsClick` undefined = button hidden | `DocumentHeader.tsx` existing guard | `App.tsx` passes `undefined` when inline ToC visible |

**`ResizeObserver` is new to the webview codebase** but follows the same "direct observer inside `useEffect`" shape. No custom hook is introduced.

---

### File 1 (NEW): `extensions/ritemark/webview/src/lib/headingUtils.ts`

Extracted from `TableOfContents.tsx` — not duplicated:

```ts
export type Heading = { level: number; text: string; pos: number; id?: string }
export function getHeadings(editor: Editor): Heading[]    // moved from TableOfContents.tsx:16–28
export function scrollToHeading(editor: Editor, pos: number): void  // moved from TableOfContents.tsx:78–101
```

---

### File 2 (MODIFIED): `extensions/ritemark/webview/src/components/header/TableOfContents.tsx`

Replace inline `getHeadings()` and scroll logic with imports from `headingUtils.ts`. Zero behavior change. This is the refactor prerequisite that enables reuse.

---

### File 3 (NEW): `extensions/ritemark/webview/src/components/InlineTableOfContents.tsx`

Display-only component. Props:
- `editor: Editor`
- `activeHeadingPos: number | null`

Behavior:
- Reads headings via `getHeadings(editor)`.
- Navigates via `scrollToHeading(editor, pos)` on click.
- If `headings.length < 2`, returns `null` (defensive; parent also guards).

Styling (Jarmo-approved values):
- Column width: **180px fixed** (constant `INLINE_TOC_WIDTH = 180`).
- Right border: **borderless** (no right border; relies on column separation + whitespace).
- Active heading: **2px left accent bar `--vscode-focusBorder`**.
- Typography matches existing `TableOfContents.tsx`: H1 13px/500, H2 12px/400, H3+ italic/opacity.
- Indentation ladder: H1 12px, H2 22px, H3 32px, H4+ 42px.
- Hover: `--vscode-toolbar-hoverBackground`.
- `position: sticky; top: 0` within its flex cell. Internal `overflow-y: auto` when ToC overflows.
- Each item is a `<button>` — keyboard focusable.
- `aria-current="true"` on active item. Column has `aria-label="Table of contents"`.

---

### File 4 (MODIFIED): `extensions/ritemark/webview/src/App.tsx` (around line 461)

**Layout change — wrap the scroll container:**

```tsx
// Before:
<div className="flex-1 overflow-y-auto" style={{ position: 'relative' }}>
  {/* FindBar, Editor */}
</div>

// After:
<div className="flex-1 flex overflow-hidden" style={{ position: 'relative' }}>
  {inlineTocVisible && headings.length >= 2 && (
    <InlineTableOfContents
      editor={editorRef.current}
      activeHeadingPos={activeHeadingPos}
    />
  )}
  <div ref={editorScrollRef} className="flex-1 overflow-y-auto" style={{ position: 'relative' }}>
    {/* FindBar, Editor — unchanged */}
  </div>
</div>
```

**New state (no new hooks files):**

- `editorScrollRef` — ref on the inner scroll container.
- `inlineTocVisible: boolean` — set by `ResizeObserver` on `editorScrollRef`'s parent element. Threshold: `INLINE_TOC_MIN_WIDTH = 960` (named constant, tuned in T7).
- `activeHeadingPos: number | null` — set by `IntersectionObserver` on heading DOM nodes (`editor.view.dom.querySelectorAll('h1,h2,h3,h4,h5,h6')`). rootMargin starts at `'-10% 0px -80% 0px'` — tuned in T6.
- `headings` — array from `getHeadings(editor)`, refreshed on `editor.on('update', ...)`.

**Contents button hiding — zero DocumentHeader.tsx changes:**

```tsx
<DocumentHeader
  onContentsClick={inlineTocVisible ? undefined : handleContentsClick}
  ...
/>
```

`DocumentHeader.tsx` already hides the button when `onContentsClick` is undefined. No prop changes needed.

---

### File 5: nothing else

- No changes to `DocumentHeader.tsx`.
- No new hooks directory.
- No new CSS files — inline styles match existing `TableOfContents.tsx`.

---

### Drag-handle (Sprint 14) conflict check

The `+` drag handle uses `position: fixed` and tracks cursor position via `editor.view.coordsAtPos()`, which returns viewport coordinates. When the editor column shifts right by ~200px, the viewport coordinates remain accurate. **No regression expected**, but verified explicitly in Phase 3 (T6).

---

## UX Decisions (Jarmo-approved)

| # | Decision | Final value |
|---|---|---|
| 1 | Inline ToC column width | **180px** |
| 2 | Right border | **Borderless** |
| 3 | Active heading indicator | **2px left accent bar `--vscode-focusBorder`** |
| 4 | Threshold constant | **`INLINE_TOC_MIN_WIDTH = 960`** starting value (tunable in T7) |
| 5 | Zero-heading case | **Hide Contents button entirely** |

---

## Phase 3 Task Breakdown

Tasks are ordered — each is a single focused implementation pass.

- [x] **T1.** Add `openCsvInExcelWithHints` to `openExternal.ts` + update both call sites (`ritemarkEditor.ts`, `excelEditorProvider.ts`). Extension typecheck clean.
- [ ] **T2.** Manual test CSV handoff: semicolon, comma, tab delimiters; pre-existing BOM; pre-existing `sep=` line; Numbers bypass; XLSX bypass. *(Jarmo tests in running app)*
- [x] **T3.** Extract `getHeadings()` and `scrollToHeading()` to `lib/headingUtils.ts`. Update `TableOfContents.tsx` to import from there. Zero behavior change — refactor only.
- [x] **T4.** Create `InlineTableOfContents.tsx` using imported utilities and confirmed visual design.
- [x] **T5.** Wire `ResizeObserver` + `IntersectionObserver` + layout change in `App.tsx`. Webview typecheck clean.
- [ ] **T6.** Verify drag-handle alignment with inline ToC visible. Tune `rootMargin` for active-heading tracking. Check dark and light themes. *(Jarmo tests in running app)*
- [ ] **T7.** Tune `INLINE_TOC_MIN_WIDTH` across common sidebar-open/closed widths. *(Jarmo's call, starting value 960)*

---

## Test Plan (Manual)

### Item A — CSV handoff

| Test | Expected |
|---|---|
| Semicolon-delimited CSV → Open in Excel | Excel shows data in multiple columns |
| Comma-delimited CSV → Open in Excel | Excel shows data correctly (unchanged) |
| Tab-delimited CSV (.csv extension) → Open in Excel | Excel shows data in columns |
| CSV with existing UTF-8 BOM → Open in Excel | Opens correctly, BOM not doubled |
| CSV whose first line is `sep=;` → Open in Excel | Opens correctly, hint not doubled |
| `.xlsx` file → Open in Excel | Original file opened, no temp file |
| CSV → Open in Numbers | Original file opened, no temp file |

### Item B — Inline ToC

| Test | Expected |
|---|---|
| Wide window, 3+ headings | Inline ToC visible left, Contents button hidden |
| Resize below threshold | Inline panel gone, Contents button reappears |
| Resize back above threshold | Inline panel reappears, Contents button hidden |
| 0 headings | No inline panel, editor full width, Contents button hidden |
| 1 heading | No inline panel, editor full width |
| Add 2nd heading to 1-heading doc | Panel appears without reload |
| Remove headings to 1 remaining | Panel disappears, editor expands |
| Scroll through long document | Active heading updates as sections pass the rootMargin line |
| Click heading in inline ToC | Editor scrolls to that heading |
| Open/close VS Code sidebar | Container width changes, threshold re-evaluated |
| Drag handle visible with inline ToC | Handle remains aligned with cursor |
| Dark theme | CSS variables resolve correctly |
| Light theme | CSS variables resolve correctly |
| FindBar open | FindBar and inline ToC coexist without layout issues |

---

## Risk List

| Risk | Likelihood | Mitigation |
|---|---|---|
| Temp file deleted before Excel opens it (5s timeout too short) | Low | 5s matches whisperCpp precedent. Increase to 10s if reports come in. |
| `sep=` not respected on older Excel | Low | Supported since Excel 2003. No action needed. |
| Numbers shows `sep=;` as first data row | Certain | Documented acceptable tradeoff. Numbers is bypassed via `app !== 'excel'` check. |
| `IntersectionObserver` fires during scroll animations causing active-heading flicker | Medium | `rootMargin` tuning in T6; click-suppress ref (100–300ms) for post-click case. |
| `ResizeObserver` fires on every pixel of resize (perf) | Low | Debounce 50ms `setTimeout` inside the observer callback. |
| Drag-handle misalignment when ToC column visible | Low | Explicitly verified in T6; coordsAtPos returns viewport coordinates which are unaffected by DOM layout shifts. |
| Heading DOM nodes queried before TipTap renders | Low | Observer setup depends on `headings.length > 0` which is only true after first `editor.on('update')` fires. |

---

## Status

**Current Phase:** 2 (PLAN)
**Approval Required:** YES — cannot begin Phase 3 until Jarmo approves this plan.

## Approval

- [ ] Jarmo approved this sprint plan
