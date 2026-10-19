# Audit: a file's extension in muted ink (R13)

Done 2026-10-18 on `sprint-133-welcome`, VS Code 1.117.0 at `10c8e557` with patches 001–019. `V` = `vscode/src/vs`.

## The render path

- **Explorer rows:** `explorerViewer.ts:879` makes each row's label with `{ supportHighlights: true }` (a `LabelWithHighlights`); `renderStat` (`:993–1030`) calls `setResource` (`:1013–1020`) with `name`, `fileKind`, `extraClasses: ['explorer-item', …]`, `fileDecorations`, `matches` (the filter) and `separator`.
- **`labels.ts`:** `setResource` (`:447–571`) adds prefix and suffix; `render()` rebuilds the options from scratch (`:632–646`), so a new option must be copied there or it is lost; then `setLabel(name, description, options)` (`:724`).
- **`iconLabel.ts`:** `setLabel` (`:133–216`) puts extra classes on `.monaco-icon-label`, the `aria-label` from `title`, the hover from `title` (`:195`), and the name at `:197`:
  - tabs use `Label` (`:295–298`, `textContent = label`);
  - Explorer rows use `LabelWithHighlights` (`:365–368`, a `HighlightedLabel`); array labels (compressed folders) go through `splitMatches` (`:318–336`).
- **Tabs:** `multiEditorTabsControl.ts:850` (no highlights), `redrawTabLabel` → `setResource` (`:1656–1670`); `singleEditorTabsControl.ts:53`, `setResource` (`:307–323`).
- There is no upstream option that splits a name from its extension.

## Surfaces that must not change

Search results (`searchResultsView.ts`), quick picks (`quickInputList.ts`, `quickInputTreeRenderer.ts`), breadcrumbs, Open Editors, SCM, Outline, Problems, the modal editor and the chat views all use the same label classes. So the split is **opt-in**.

## The decision

- **`iconLabel.ts` and `labels.ts` (018):** a new option `splitExtension?: boolean` on `IIconLabelValueOptions` (so `IResourceLabelOptions` has it too), copied through in `labels.ts`'s `render()`. `labels.ts` decides from the **resource**, not the string: only a file (not a folder), with a single-string name, whose `extname(resource)` is longer than `.` and with which the name ends. This keeps `.gitignore` whole (`extname` is empty), never splits a prefixed or suffixed name (`1: …`, `a.md (Working Tree)`), and never splits a browser tab (its resource path has no extension).
- **The split, in `iconLabel.ts`**, at the last dot (`dot > 0`), string names only:
  - `Label` (tabs): the name's text, then `span.label-extension` with the extension, inside the same `.label-name`;
  - `LabelWithHighlights` (rows): two `HighlightedLabel`s, the stem in the existing one and the extension in a `span.label-extension` created on demand, with the filter's matches split by the existing `splitMatches([stem, ext], '', matches)`. The extension span is removed when a later render does not split: tree row templates are reused between folders and files.
  - `.label-extension` stays **inside** `.label-name`, so the element count, the boxes the Explorer's mouse handling walks (`explorerViewer.ts:2072–2093`) and `scripts/qa/frame-geometry.mjs` see the same structure. `textContent` is unchanged (no space is added); the row's and the tab's accessible names come from `element.name` and `computeEditorAriaLabel`, not the DOM.
- **Who opts in:** the Explorer's `renderStat` (018, which already owns `explorerViewer.ts`'s row height), and the two tab controls' `setResource` calls (019, the tab row's patch). No other caller passes it.
- **CSS (018, `ritemarkSurfaces.css`):** `.label-extension` takes `--rm-muted` (`descriptionForeground`: `#617187` Light, `#94A3B8` Dark); it goes back to `color: inherit` on the chosen tab (`.tab.active`), the open row (`.monaco-list-row.selected`), a pointed-at row or tab, in high contrast (`.hc-black`, `.hc-light`), and wherever a file decoration colours the name (`.monaco-icon-label[class*="monaco-decoration-itemColor-"]`), so git and problem colours win. Filter highlights keep their own colour.
- **Contrast:** muted on the ground is 4.54:1 in Light and 7.0:1 in Dark. On the hover fill it would drop to about 3.8:1 in Light, which is why a pointed-at row or tab shows the extension in the name's ink.

## Stacking

No patch touches `iconLabel.ts`, `labels.ts`, `highlightedLabel.ts` or `singleEditorTabsControl.ts`. 018's two hunks in `explorerViewer.ts` (`ITEM_HEIGHT`, the `.ritemark` filter) are far from `renderStat`. 019's hunks in `multiEditorTabsControl.ts` do not touch `redrawTabLabel` (`:1624–1680`).

## Test

A new `V/base/test/browser/iconLabel.test.ts`, beside `highlightedLabel.test.ts`: the split for `Brief.md`, `report.final.md` (only `.md`), `README` (none), `.gitignore` (none), a highlight across the dot, a reused row going from a file to a folder; run with `./scripts/test.sh --grep IconLabel` in `vscode/`.
