# Patch 002 after Sprint 132's fold

The after-state that `PATCH-RULES.md` §8 asks for, against [002-before.md](002-before.md). Recorded 2026-10-17.

- Files: **25** (before: 31)
- Hunks: **78** (before: 88)

The technical plan expected "about 22" files. It is 25: six files leave (the two size files and the four terminal-guard files), and `terminal.contribution.ts` stays for its shortcut removal (R8, revised).

## Every file accounted for

| File | Before | After | Why |
|---|---|---|---|
| `src/vs/workbench/api/browser/viewsExtensionPoint.ts` | 3 | 4 | Changed: the 2.0 orders of the places (Home, Documents, Tasks, Browser, Agents, Transcribe) |
| `src/vs/workbench/browser/parts/auxiliarybar/auxiliaryBarPart.ts` | 3 | 3 | Unchanged |
| `src/vs/workbench/browser/actions/layoutActions.ts` | 6 | 6 | Changed: the title bar's left-column toggle is off (the column's strip holds it); View > Advanced loses Terminal (R8, revised) |
| `src/vs/workbench/browser/media/part.css` | 1 | 1 | Unchanged |
| `src/vs/workbench/browser/part.ts` | 1 | 1 | Unchanged |
| `src/vs/workbench/browser/parts/activitybar/activitybarPart.ts` | 2 | 2 | Unchanged |
| `src/vs/workbench/browser/parts/activitybar/media/activityaction.css` | 5 | 5 | Unchanged |
| `src/vs/workbench/browser/parts/activitybar/media/activitybarpart.css` | 2 | 2 | Unchanged |
| `src/vs/workbench/browser/parts/auxiliarybar/auxiliaryBarActions.ts` | 4 | 4 | Unchanged |
| `src/vs/workbench/browser/parts/auxiliarybar/media/auxiliaryBarPart.css` | 1 | 1 | Unchanged |
| `src/vs/workbench/browser/parts/editor/editorTabsControl.ts` | 1 | — | Left: the tab height is a size, owned by 019 (44, the strip; tabs 36 within it) |
| `src/vs/workbench/browser/parts/editor/media/editorgroupview.css` | 1 | 1 | Unchanged |
| `src/vs/workbench/browser/parts/compositeBar.ts` | 3 | 6 | Changed: the 2.0 order once per profile, new Ritemark places in their spot, Copilot Chat's launcher always in More; the v1.14 Tasks and Agent Library move replaced |
| `src/vs/workbench/browser/parts/globalCompositeBar.ts` | 8 | 8 | Unchanged |
| `src/vs/workbench/browser/parts/media/paneCompositePart.css` | 4 | 4 | Unchanged |
| `src/vs/workbench/browser/parts/paneCompositePart.ts` | 4 | 3 | Changed: the injected 40px places-bar styles left for 018's stylesheet; the AI default stays |
| `src/vs/workbench/browser/parts/panel/panelActions.ts` | 3 | 3 | Unchanged |
| `src/vs/workbench/browser/parts/sidebar/media/sidebarpart.css` | 1 | 1 | Unchanged |
| `src/vs/workbench/browser/parts/titlebar/media/titlebarpart.css` | 3 | 3 | Unchanged |
| `src/vs/workbench/browser/parts/titlebar/titlebarPart.ts` | 3 | 3 | Unchanged |
| `src/vs/workbench/browser/workbench.contribution.ts` | 2 | 2 | Unchanged |
| `src/vs/workbench/contrib/files/browser/explorerViewlet.ts` | 6 | 6 | Unchanged |
| `src/vs/workbench/contrib/files/browser/media/explorerviewlet.css` | 2 | 2 | Changed: the row-height lines are upstream again (018 sets 32); the tree's styling stays |
| `src/vs/workbench/contrib/files/browser/views/explorerView.ts` | 3 | 3 | Unchanged |
| `src/vs/workbench/contrib/files/browser/views/explorerViewer.ts` | 1 | — | Left: the row height is a size, owned by 018 (32) |
| `src/vs/workbench/contrib/terminal/browser/terminal.contribution.ts` | 4 | 3 | Kept: only the removal of the Toggle Terminal shortcut and View-menu entry; the location and `hideIfEmpty` lines are upstream again |
| `src/vs/workbench/contrib/terminal/browser/terminalConfigurationService.ts` | 3 | — | Left: terminal guard removed (`defaultLocation` honoured; a terminal is a tab) |
| `src/vs/workbench/contrib/terminal/browser/terminalEditorSerializer.ts` | 3 | — | Left: terminal guard removed (terminal tabs restore as tabs) |
| `src/vs/workbench/contrib/terminal/browser/terminalView.ts` | 1 | — | Left: terminal guard removed (`showPanel` as upstream) |
| `src/vs/workbench/contrib/terminal/test/browser/terminalConfigurationService.test.ts` | 3 | — | Left: its guard's test, back to upstream with it |
| `src/vs/workbench/services/userDataProfile/common/userDataProfileIcons.ts` | 1 | 1 | Unchanged |

## Checks

- Files before 31, after 25: the six that left are listed above, and every other file's section is byte-identical to before except the six marked Changed.
- The whole stack applies to pristine VS Code 1.117.0 in a temporary index, and the resulting tree equals the working tree the patches were generated from (only the branding assets `apply-patches.sh` copies differ).
- `node scripts/check-patch-stacking.mjs` passes.
