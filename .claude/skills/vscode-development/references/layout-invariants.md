# Layout Invariants

Ritemark 2.0's frame (Sprint 132) is three patches, each owning one kind of change:

| Patch | Owns |
| --- | --- |
| `002-ritemark-ui-layout.patch` | Placement: where each part and place lives, and in what order |
| `018-ritemark-surfaces.patch` | Sizes and drawing: no title row, the strips, the sheets and their gaps, Ritemark's menus, zoom |
| `019-ritemark-tab-row.patch` | The tab row: tab heights and widths, the +, folded tabs, the permanent tabs, terminals as tabs |

These rules must stay true after every upstream sync. Breaking any of them is visible to users at once.
`scripts/qa/frame-geometry.mjs` measures the frame on a running dev instance (over CDP); run it after any change here.

## Required positions

| Element | Required position | Enforced by |
| --- | --- | --- |
| Title row | None in the main window on the Mac and Windows; floating windows keep one | 018: `window.ts` (`RITEMARK_FRAME_WITHOUT_TITLE_ROW`), `layoutService.ts` (`shouldShowCustomTitleBar` false for the main window) |
| Strips | 44 high at the top of the left column, the desk and the AI's column; every control on the line at 26 | 018: `window.ts` (`RITEMARK_FRAME_*`), `ritemarkFrameStrip.ts`, `ritemarkSurfaces.css` |
| Traffic lights (Mac) | On the line at 26, unscaled, placed again after a restore, full screen and a zoom | 018: electron-browser `titlebarPart.ts` (`placeRitemarkWindowControls`), `windowImpl.ts` |
| Window buttons (Windows) | Over the AI's strip, or the desk's when the AI is hidden; 44 high on the ground colour | 018: `window.ts`, electron-browser `titlebarPart.ts` |
| Places row | On top of the left column: Home, Documents, Tasks, Browser, Agents, Transcribe, then other places in their own order, then More (⋯) | Extension default `workbench.activityBar.location: top`; 002: `viewsExtensionPoint.ts` (`RITEMARK_PLACE_ORDERS`), `compositeBar.ts` (`RITEMARK_OWN_PLACES`, applied once per profile under `ritemark.places.order.v2`) |
| Documents | Always a place, and a fresh window opens on it | 002: `explorerViewlet.ts` (`hideIfEmpty: false`: with Outline and Timeline hidden by 003, Documents holds no view early in start-up, and the bar would open Search instead) |
| Copilot Chat | First in More, opening as a tab on the desk; not shown unless installed. View → Copilot Chat and Ctrl+Alt+I (⌃⌘I) open the same tab, never the panel | 002: `compositeBar.ts` (`RITEMARK_ALWAYS_IN_MORE`); 007: `paneCompositeBar.ts`, `chatSetupContributions.ts`; 003: `chatParticipant.contribution.ts` (no View-menu entry for the panel's chat view) |
| Ritemark AI | The right column, alone | 002: `viewsExtensionPoint.ts` (`case 'auxiliarybar'`, `ritemark-ai` first); 018: `auxiliaryBarPart.ts` (`RitemarkAiColumnGuard` sends other containers home, chat to the panel) |
| Desks | 8 apart, 8 from the window's edge when a column is hidden, 8 above the 24 status bar; no separator line between them | 018: `editorPart.ts`, `ritemarkSurfaces.css`; 019: `editorGroupView.ts` (gaps from `findGroup`) |
| Pinned Home and Task board tabs | First in the row; never closed, unpinned or moved by a person or a command; only the extension disposes them | 019: `editorGroupView.ts` (`RITEMARK_PERMANENT_VIEW_TYPES`); test `ritemarkPermanentTabs.test.ts` |
| Terminal | A tab on the desk, never the panel or the AI column; Ctrl+` (⌃` on the Mac) opens a new one; no Terminal entry in the View menu; a terminal tab's menu adds only Rename to the usual tab items | Extension defaults `terminal.integrated.defaultLocation: editor`, `hideOnStartup: always`, the keybinding; 019: `ritemarkTerminalTabs.ts` moves panel terminals onto the desk; 019: `terminalMenus.ts` (the tab's menu); 002: `terminal.contribution.ts` drops the Toggle Terminal shortcut; test `ritemarkTerminalTabs.test.ts` |
| Default column widths | Left 256, AI 400 | 018: `layout.ts` (`RITEMARK_LEFT_COLUMN_SIZE`, `RITEMARK_AI_COLUMN_SIZE`) |
| Window sizes | Below 1400 the AI's column narrows to 336 (sheet 320), below 1200 the left column hides, below 960 the AI's column hides; crossing back up undoes only what the crossing down did | 018: `ritemarkWindowSizes.ts` (loaded by `desktop.contribution.ts`, memory in workspace storage `ritemark.windowSizes`); test `ritemarkWindowSizes.test.ts` |

## Key technical facts

- **Container ID prefixing.** Extension container IDs get prefixed automatically: `ritemark-ai` becomes `workbench.view.extension.ritemark-ai`. Reference the prefixed form when reaching into VS Code state.
- **View positions are persisted in SQLite.** VS Code caches view positions in `views.customizations` (state DB). The `package.json` value is only the default; once a person (or an older Ritemark) moved a view, the cache wins. The AI column's guard (018) and the once-per-profile places order (002) are what bring a v1.x profile into the 2.0 layout.
- **Terminals were the opposite in 1.x.** 1.x guarded the terminal into the right sidebar in three places (002); 2.0 removed those guards. If an upstream sync brings back a terminal in the panel, `ritemarkTerminalTabs.ts` moves it; check its test first.
- **Zoom.** The strips keep 44 and the line at any zoom (counter-zoom through `--ritemark-zoom-factor`, layout at 44 / factor); the columns' content and the desks zoom. `frame-geometry.mjs` measures at zoom 0, so check zoom from native window captures.
- **Ritemark's menus.** More, You, the +, "N ⌄" and the left column head's menus are Ritemark menus (`ritemarkMenu.ts`); one rule closes them on a press outside them, on the window's blur (a press inside a webview) and on a second press of their button.
- **The screenshot baseline.** `docs/development/frame-baseline/` holds the frame in 9 scenes, light and dark. After a VS Code update or a change to 002, 018 or 019, run `scripts/qa/frame-screenshots.mjs --compare docs/development/frame-baseline` and `frame-geometry.mjs` on a fresh profile with its sample project; a changed scene is fixed, or Jarmo approves a new baseline.
- **Chat icon is a moving target.** Every upstream sync may add a new entry surface (`MenuId.TitleBar`, `MenuId.CommandCenter`, etc.). On each sync, re-grep for `Codicon.chatSparkle` registrations and extend patch 003 if needed.

## When patching layout

1. Put a change in the patch that owns its kind (table above); `scripts/check-patch-stacking.mjs` (pre-commit Check 14) blocks a hunk that builds on another patch's lines.
2. Always check the cached state, not just the default. View positions in particular.
3. If you remove a UI surface, also remove its registrations across ALL the menu IDs it could be added to.
4. After commenting out code, **always remove unused imports** — VS Code's strict TypeScript build fails after 22 minutes otherwise (see SKILL.md ## Gotchas).
