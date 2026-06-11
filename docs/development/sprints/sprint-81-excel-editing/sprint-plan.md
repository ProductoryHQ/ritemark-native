# Sprint 81: Excel Editing + Issue #110 Fix

## Goal

Upgrade the Excel editor from read-only to basic editing for .xlsx files, and fix the multi-sheet selector regression (GitHub issue #110).

## Success Criteria

- [x] Multi-sheet selector is always visible for multi-sheet workbooks (issue #110 fixed)
- [x] Selecting a sheet renders its contents; default view is the first sheet; single-sheet workbooks show no selector bar
- [x] .xlsx files open with an editable grid (cell values can be changed and saved)
- [x] .xls files remain read-only (saving would re-encode the legacy format as xlsx)
- [x] Edited .xlsx files save via Cmd/Ctrl+S (dirty tracking, save-as, revert, hot-exit backup/restore)
- [x] Untouched cells preserve formulas and values after an edit-save round-trip
- [x] Add-row and add-column extend the sheet `!ref` range correctly
- [x] Empty sheet does not hide the toolbar or sheet selector (other sheets stay reachable)
- [x] Extension tsc compiles clean; webview `tsc --noEmit` clean; webview bundle rebuilt
- [x] Pre-commit hook passes
- [ ] Jarmo local test with a real multi-sheet workbook (e.g. `pakkumine-kalkulaator.xlsx`) — Gate 2, pending

## Research Findings (inline, no research/ dir — lightweight track)

- **#110 root cause:** in `SpreadsheetViewer.tsx` the single parse effect both cleared
  `cachedWorkbook` and listed `selectedSheet` as a dependency. Setting the default sheet
  re-ran the effect, which nulled the cache, so the selector condition
  (`cachedWorkbook && SheetNames.length > 1`) stayed false permanently.
- **Editing capability decision:** `CustomDocumentContentChangeEvent` (dirty/save, no
  undo-redo stack) chosen over `CustomDocumentEditEvent` — appropriate for basic editing scope.
- **Fidelity limits (SheetJS community edition):** editing a cell that contains a formula
  replaces it with the typed value; cell styles (colors/fonts) are not preserved on save.
  Untouched cells keep formulas/values — verified by a round-trip test (multi-sheet read,
  direct cell edit, formula preservation in neighboring cells, add-row semantics).

## Implementation Checklist

- [x] Fix #110: split workbook-parse effect and sheet-extraction effect in `SpreadsheetViewer.tsx`
- [x] Upgrade `excelEditorProvider.ts` from `CustomReadonlyEditorProvider` to full
      `CustomEditorProvider` (dirty tracking, `saveCustomDocument`, `saveCustomDocumentAs`,
      `revertCustomDocument`, `backupCustomDocument` with hot-exit restore; own saves
      suppressed from the file watcher)
- [x] Make `excelDocument.ts` buffer mutable with `update()`
- [x] Webview: cell edits write directly into cached workbook worksheet cells; workbook
      serialized via `XLSX.write` (base64) and sent to extension as `contentChanged`
- [x] Webview: add-row / add-column extend sheet `!ref` range
- [x] Webview: render sheets as a true grid (A/B/C column letters, first row as data,
      blank rows preserved) so row/col indexes map 1:1 to cell addresses — also fixes the
      degraded "4 rows × 1 columns" shape for settings-style sheets noted in #110
- [x] Webview: empty sheet no longer hides toolbar/sheet selector
- [x] `App.tsx`: pass `onChange` for .xlsx files only
- [x] `package.json`: displayName "Excel Preview" → "Excel Editor"
- [x] One-time info notice on first edit about formula/formatting fidelity limits
- [x] SheetJS round-trip verification test (run ad hoc, not committed)
- [x] Architecture doc updated (provider contract change)

### PR #115 review fixes (Codex)

- [x] P1: Refresh on a dirty .xlsx now routes through the existing ConflictDialog
      (`confirmDiscard` → `confirmRefresh`/`cancelRefresh`) instead of silently
      discarding unsaved edits; confirmed discard reverts via VS Code so the
      dirty indicator clears
- [x] P2: Empty sheets are editable — "Add a row to start editing" action in the
      empty state seeds the sheet's `!ref` (1×1 grid), after which the normal
      add-row/add-column controls render

### Follow-up (Jarmo request)

- [x] Grid anchored at A1: leading blank rows/columns are visible and grid row
      numbers / column letters match Excel's actual cell addresses (e.g. data
      starting at B3 displays at row 3, not row 1); edits in leading blank
      rows expand the sheet's `!ref` so they survive saving

## Status

**Track:** Lightweight
**Phase:** Implementation complete — committed as `d918b80` on branch `claude/excel-editing-issue-110-8o1ou1`

**Known deviations (retroactive record):**
- Work was implemented before this sprint doc was created; this plan is a retroactive record.
- Branch naming: harness-designated session branch `claude/excel-editing-issue-110-8o1ou1`
  used instead of `sprint-81-excel-editing` (remote session branch is fixed; sprint code is
  correctly NOT on `main`).

## Approval

- [x] Jarmo approved this sprint plan ("plan approved", 2026-06-10)
- [x] qa-validator pass before merge (2026-06-10 — PASS; one pre-existing warning:
      debug console.log at excelEditorProvider.ts:87-89, pre-dates Sprint 81, cleanup deferred)
- [ ] Gate 2: Jarmo tested locally before release
