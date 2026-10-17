# Patch 002 before Sprint 132

Recorded at Phase 0 (2026-10-17) from `origin/main` `17de26dc`, as `PATCH-RULES.md` §8 requires before hunks move out of a patch. The after-state is in [002-after.md](002-after.md).

- Files: **31**
- Hunks: **88**
- Lines: 1593 in the patch file

| File | Hunks | Lines |
|---|---|---|
| `src/vs/workbench/api/browser/viewsExtensionPoint.ts` | 3 | +18 / -2 |
| `src/vs/workbench/browser/parts/auxiliarybar/auxiliaryBarPart.ts` | 3 | +37 / -1 |
| `src/vs/workbench/browser/actions/layoutActions.ts` | 6 | +59 / -39 |
| `src/vs/workbench/browser/media/part.css` | 1 | +1 / -1 |
| `src/vs/workbench/browser/part.ts` | 1 | +2 / -2 |
| `src/vs/workbench/browser/parts/activitybar/activitybarPart.ts` | 2 | +4 / -4 |
| `src/vs/workbench/browser/parts/activitybar/media/activityaction.css` | 5 | +34 / -12 |
| `src/vs/workbench/browser/parts/activitybar/media/activitybarpart.css` | 2 | +11 / -1 |
| `src/vs/workbench/browser/parts/auxiliarybar/auxiliaryBarActions.ts` | 4 | +4 / -43 |
| `src/vs/workbench/browser/parts/auxiliarybar/media/auxiliaryBarPart.css` | 1 | +50 / -0 |
| `src/vs/workbench/browser/parts/editor/editorTabsControl.ts` | 1 | +1 / -1 |
| `src/vs/workbench/browser/parts/editor/media/editorgroupview.css` | 1 | +1 / -1 |
| `src/vs/workbench/browser/parts/compositeBar.ts` | 3 | +34 / -1 |
| `src/vs/workbench/browser/parts/globalCompositeBar.ts` | 8 | +10 / -21 |
| `src/vs/workbench/browser/parts/media/paneCompositePart.css` | 4 | +6 / -3 |
| `src/vs/workbench/browser/parts/paneCompositePart.ts` | 4 | +32 / -2 |
| `src/vs/workbench/browser/parts/panel/panelActions.ts` | 3 | +2 / -27 |
| `src/vs/workbench/browser/parts/sidebar/media/sidebarpart.css` | 1 | +4 / -4 |
| `src/vs/workbench/browser/parts/titlebar/media/titlebarpart.css` | 3 | +73 / -0 |
| `src/vs/workbench/browser/parts/titlebar/titlebarPart.ts` | 3 | +11 / -9 |
| `src/vs/workbench/browser/workbench.contribution.ts` | 2 | +2 / -2 |
| `src/vs/workbench/contrib/files/browser/explorerViewlet.ts` | 6 | +9 / -9 |
| `src/vs/workbench/contrib/files/browser/media/explorerviewlet.css` | 2 | +29 / -2 |
| `src/vs/workbench/contrib/files/browser/views/explorerView.ts` | 3 | +23 / -13 |
| `src/vs/workbench/contrib/files/browser/views/explorerViewer.ts` | 1 | +1 / -1 |
| `src/vs/workbench/contrib/terminal/browser/terminal.contribution.ts` | 4 | +4 / -13 |
| `src/vs/workbench/contrib/terminal/browser/terminalConfigurationService.ts` | 3 | +5 / -0 |
| `src/vs/workbench/contrib/terminal/browser/terminalEditorSerializer.ts` | 3 | +18 / -3 |
| `src/vs/workbench/contrib/terminal/browser/terminalView.ts` | 1 | +0 / -4 |
| `src/vs/workbench/contrib/terminal/test/browser/terminalConfigurationService.test.ts` | 3 | +28 / -4 |
| `src/vs/workbench/services/userDataProfile/common/userDataProfileIcons.ts` | 1 | +2 / -2 |

## The file list, as `grep '^diff --git'` prints it

```
diff --git a/src/vs/workbench/api/browser/viewsExtensionPoint.ts b/src/vs/workbench/api/browser/viewsExtensionPoint.ts
diff --git a/src/vs/workbench/browser/parts/auxiliarybar/auxiliaryBarPart.ts b/src/vs/workbench/browser/parts/auxiliarybar/auxiliaryBarPart.ts
diff --git a/src/vs/workbench/browser/actions/layoutActions.ts b/src/vs/workbench/browser/actions/layoutActions.ts
diff --git a/src/vs/workbench/browser/media/part.css b/src/vs/workbench/browser/media/part.css
diff --git a/src/vs/workbench/browser/part.ts b/src/vs/workbench/browser/part.ts
diff --git a/src/vs/workbench/browser/parts/activitybar/activitybarPart.ts b/src/vs/workbench/browser/parts/activitybar/activitybarPart.ts
diff --git a/src/vs/workbench/browser/parts/activitybar/media/activityaction.css b/src/vs/workbench/browser/parts/activitybar/media/activityaction.css
diff --git a/src/vs/workbench/browser/parts/activitybar/media/activitybarpart.css b/src/vs/workbench/browser/parts/activitybar/media/activitybarpart.css
diff --git a/src/vs/workbench/browser/parts/auxiliarybar/auxiliaryBarActions.ts b/src/vs/workbench/browser/parts/auxiliarybar/auxiliaryBarActions.ts
diff --git a/src/vs/workbench/browser/parts/auxiliarybar/media/auxiliaryBarPart.css b/src/vs/workbench/browser/parts/auxiliarybar/media/auxiliaryBarPart.css
diff --git a/src/vs/workbench/browser/parts/editor/editorTabsControl.ts b/src/vs/workbench/browser/parts/editor/editorTabsControl.ts
diff --git a/src/vs/workbench/browser/parts/editor/media/editorgroupview.css b/src/vs/workbench/browser/parts/editor/media/editorgroupview.css
diff --git a/src/vs/workbench/browser/parts/compositeBar.ts b/src/vs/workbench/browser/parts/compositeBar.ts
diff --git a/src/vs/workbench/browser/parts/globalCompositeBar.ts b/src/vs/workbench/browser/parts/globalCompositeBar.ts
diff --git a/src/vs/workbench/browser/parts/media/paneCompositePart.css b/src/vs/workbench/browser/parts/media/paneCompositePart.css
diff --git a/src/vs/workbench/browser/parts/paneCompositePart.ts b/src/vs/workbench/browser/parts/paneCompositePart.ts
diff --git a/src/vs/workbench/browser/parts/panel/panelActions.ts b/src/vs/workbench/browser/parts/panel/panelActions.ts
diff --git a/src/vs/workbench/browser/parts/sidebar/media/sidebarpart.css b/src/vs/workbench/browser/parts/sidebar/media/sidebarpart.css
diff --git a/src/vs/workbench/browser/parts/titlebar/media/titlebarpart.css b/src/vs/workbench/browser/parts/titlebar/media/titlebarpart.css
diff --git a/src/vs/workbench/browser/parts/titlebar/titlebarPart.ts b/src/vs/workbench/browser/parts/titlebar/titlebarPart.ts
diff --git a/src/vs/workbench/browser/workbench.contribution.ts b/src/vs/workbench/browser/workbench.contribution.ts
diff --git a/src/vs/workbench/contrib/files/browser/explorerViewlet.ts b/src/vs/workbench/contrib/files/browser/explorerViewlet.ts
diff --git a/src/vs/workbench/contrib/files/browser/media/explorerviewlet.css b/src/vs/workbench/contrib/files/browser/media/explorerviewlet.css
diff --git a/src/vs/workbench/contrib/files/browser/views/explorerView.ts b/src/vs/workbench/contrib/files/browser/views/explorerView.ts
diff --git a/src/vs/workbench/contrib/files/browser/views/explorerViewer.ts b/src/vs/workbench/contrib/files/browser/views/explorerViewer.ts
diff --git a/src/vs/workbench/contrib/terminal/browser/terminal.contribution.ts b/src/vs/workbench/contrib/terminal/browser/terminal.contribution.ts
diff --git a/src/vs/workbench/contrib/terminal/browser/terminalConfigurationService.ts b/src/vs/workbench/contrib/terminal/browser/terminalConfigurationService.ts
diff --git a/src/vs/workbench/contrib/terminal/browser/terminalEditorSerializer.ts b/src/vs/workbench/contrib/terminal/browser/terminalEditorSerializer.ts
diff --git a/src/vs/workbench/contrib/terminal/browser/terminalView.ts b/src/vs/workbench/contrib/terminal/browser/terminalView.ts
diff --git a/src/vs/workbench/contrib/terminal/test/browser/terminalConfigurationService.test.ts b/src/vs/workbench/contrib/terminal/test/browser/terminalConfigurationService.test.ts
diff --git a/src/vs/workbench/services/userDataProfile/common/userDataProfileIcons.ts b/src/vs/workbench/services/userDataProfile/common/userDataProfileIcons.ts
```
