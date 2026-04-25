# Sprint 53 Phase 1 — Chrome Audit

**Date:** 2026-04-24
**Baseline:** `main` @ `45863aa` (Sprint 52 merge)
**Purpose:** Factual inventory of the chrome surfaces Sprint 53 will touch — patches, theme keys, Lucide residue, view containers, static assets. This file satisfies PATCH-RULES §8 (before-state file counts) and the Phase 1 audit deliverable. No design recommendations here — those belong in Phase 2.

---

## 1. Patch baseline (PATCH-RULES §8 compliance)

Patch file counts as of `main` @ `45863aa`:

| Patch | Files | Relevant to Sprint 53? |
|---|---|---|
| `001-ritemark-branding.patch` | **14** | YES — contains Lucide font registration + 20 icon definitions that must be migrated. |
| `002-ritemark-ui-layout.patch` | **22** | YES — this is where activity-bar / titlebar / tabs / sidebar css live. |
| `003-ritemark-menu-cleanup.patch` | **14** | MAYBE — menubar/titlebar controls; verify no regression during chrome work. |
| `004-ritemark-build-system.patch` | (n/a) | NO — build-system only. |
| `005-ritemark-windows-and-oss-fixes.patch` | (n/a) | NO. |
| `006-ritemark-dev-launch-fallback.patch` | (n/a) | NO. |

After Sprint 53, patches 001 and 002 will gain files/hunks. Patch 003 should gain zero. Before any patch edit, re-run `grep '^diff --git' patches/vscode/NNN-*.patch | wc -l` and record the new count in `notes/validation-log.md`.

### Patch 001 — files touched

```
build/gulpfile.vscode.ts
build/lib/optimize.ts
src/vs/base/browser/ui/codicons/codicon/codicon.css
src/vs/code/electron-browser/workbench/workbench.ts
src/vs/platform/dialogs/electron-browser/dialog.ts
src/vs/platform/theme/common/iconRegistry.ts
src/vs/platform/theme/electron-main/themeMainServiceImpl.ts
src/vs/workbench/browser/media/style.css
src/vs/workbench/browser/parts/editor/breadcrumbsControl.ts
src/vs/workbench/browser/parts/editor/media/editortitlecontrol.css
src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.contribution.ts
src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts
src/vs/workbench/contrib/welcomeGettingStarted/browser/media/gettingStarted.css
src/vs/workbench/contrib/welcomeGettingStarted/browser/media/gettingStartedGuide.css
```

Sprint 53-relevant files in this patch:
- `src/vs/platform/theme/common/iconRegistry.ts` — holds 20 `lucide-*` IconDefinitions + `iconRegistry.registerIconFont('lucide', …)` call.
- `src/vs/base/browser/ui/codicons/codicon/codicon.css` — `@font-face { font-family: "lucide"; src: url("./lucide.woff2") format("woff2"); }`.
- The two referenced above are the entire chrome-side Lucide footprint in patch 001.

### Patch 002 — files touched

```
src/vs/workbench/api/browser/viewsExtensionPoint.ts
src/vs/workbench/browser/actions/layoutActions.ts
src/vs/workbench/browser/media/part.css
src/vs/workbench/browser/part.ts
src/vs/workbench/browser/parts/auxiliarybar/auxiliaryBarActions.ts
src/vs/workbench/browser/parts/editor/editorTabsControl.ts
src/vs/workbench/browser/parts/editor/media/editorgroupview.css
src/vs/workbench/browser/parts/media/paneCompositePart.css
src/vs/workbench/browser/parts/paneCompositePart.ts
src/vs/workbench/browser/parts/panel/panelActions.ts
src/vs/workbench/browser/parts/sidebar/media/sidebarpart.css
src/vs/workbench/browser/parts/titlebar/media/titlebarpart.css
src/vs/workbench/browser/parts/titlebar/titlebarPart.ts
src/vs/workbench/browser/workbench.contribution.ts
src/vs/workbench/contrib/files/browser/explorerViewlet.ts
src/vs/workbench/contrib/files/browser/media/explorerviewlet.css
src/vs/workbench/contrib/files/browser/views/explorerViewer.ts
src/vs/workbench/contrib/files/browser/views/explorerView.ts
src/vs/workbench/contrib/terminal/browser/terminal.contribution.ts
src/vs/workbench/contrib/terminal/browser/terminalConfigurationService.ts
src/vs/workbench/contrib/terminal/browser/terminalEditorSerializer.ts
src/vs/workbench/contrib/terminal/test/browser/terminalConfigurationService.test.ts
```

Sprint 53-relevant files in this patch (chrome surfaces):
- **Activity bar placement:**
  - `src/vs/workbench/api/browser/viewsExtensionPoint.ts` — `case 'auxiliarybar'` addition enabling custom `auxiliarybar` location in package.json contribution points.
  - `src/vs/workbench/browser/actions/layoutActions.ts` — `activityBarLeftIcon` / `activityBarRightIcon` registrations (for layout toggles).
  - `src/vs/workbench/browser/parts/paneCompositePart.ts` — pane composite plumbing (where activity bar items are rendered).
  - `src/vs/workbench/browser/parts/auxiliarybar/auxiliaryBarActions.ts` — auxiliary bar action wiring (four icon registrations currently commented out).
- **Titlebar:** `src/vs/workbench/browser/parts/titlebar/titlebarPart.ts` + `titlebarpart.css`. Accounts + global activity actions already commented out per Sprint 38 work.
- **Tabs:** `src/vs/workbench/browser/parts/editor/editorTabsControl.ts` + `editorgroupview.css`. Patch already sets tab height 40px and border-radius 6px.
- **Panel toggle:** `src/vs/workbench/browser/parts/panel/panelActions.ts` — LayoutControlMenu panel toggle commented out; stays hidden.
- **Sidebar:** `src/vs/workbench/browser/parts/sidebar/media/sidebarpart.css` + `paneCompositePart.css` — current sidebar styling surface.
- **Explorer:** `src/vs/workbench/contrib/files/browser/views/explorerView.ts` + `explorerviewlet.css` — Sprint 52 added 28px row / inset accent bar / hidden indent guides here.

### Patch 003 — files touched (no Sprint 53 work expected)

14 files covering Edit/View/Go/Terminal/Run menu cleanup and defaultChatAgent null-safety. Sprint 53 must verify these stay intact (PATCH-RULES §2 holds the authoritative list). Any regression here is a ship-blocker.

---

## 2. Theme JSON baseline

**Scope:** `extensions/ritemark/themes/ritemark-light.json` vs `extensions/ritemark/themes/ritemark-dark.json`.

**73 chrome-related keys** are currently set in BOTH files (full light/dark symmetry). 70 keys have distinct light↔dark values; 3 keys are identical in both files (`activityBar.inactiveForeground`, `statusBar.debuggingForeground`, `statusBarItem.remoteForeground`).

By category (numbers are keys present, not files):

| Category | Count | Keys |
|---|---|---|
| `activityBar.*` | 6 | activeBorder, activeForeground, background, border, foreground, inactiveForeground |
| `activityBarBadge.*` | 2 | background, foreground |
| `activityBarTop.*` | 6 | activeBackground, activeBorder, background, dropBorder, foreground, inactiveForeground |
| `statusBar.*` | 7 | background, border, debuggingBackground, debuggingForeground, focusBorder, foreground, noFolderBackground |
| `statusBarItem.*` | 5 | errorBackground, focusBorder, prominentBackground, remoteBackground, remoteForeground |
| `tab.*` | 13 | activeBackground, activeBorder, activeBorderTop, activeForeground, border, hoverBackground, inactiveBackground, inactiveForeground, lastPinnedBorder, selectedBorderTop, unfocusedActiveBorder, unfocusedActiveBorderTop, unfocusedHoverBackground, unfocusedInactiveForeground |
| `titleBar.*` | 5 | activeBackground, activeForeground, border, inactiveBackground, inactiveForeground |
| `sideBar.*` | 3 | background, border, foreground |
| `sideBarActivityBarTop.*` | 1 | border |
| `sideBarSectionHeader.*` | 3 | background, border, foreground |
| `sideBarTitle.*` | 1 | foreground |
| `list.*` | 14 | activeSelectionBackground/Foreground/IconForeground, dropBackground, focusAndSelectionOutline, focusBackground, focusForeground, focusHighlightForeground, focusOutline, highlightForeground, hoverBackground, hoverForeground, inactiveSelectionBackground/Foreground/IconForeground |
| `tree.*` | 3 | indentGuidesStroke, inactiveIndentGuidesStroke, tableColumnsBorder |

**Implication for Sprint 53:** The surface coverage is already broad. Phase 3 does not need to *add* whole new key sets; it needs to:
- **Verify values** against the rebalanced dark tokens in `sprint-52-design-foundations/notes/dark-mode-rebalance.md`.
- **Audit** specific keys called out in Sprint 53 success criteria: `tab.activeBorderTop` (must be 2px indigo), `statusBar.background` (must not be VS Code blue), `activityBar.activeBorder` (2px indigo left-rail indicator).
- Inventory diffs are small: 5–15 keys likely need value adjustments, not wholesale additions.

---

## 3. Lucide chrome residue

**Three remaining Lucide footprints in chrome** (all must be removed/migrated in Phase 3):

### 3a. Font face in patch 001
```
src/vs/base/browser/ui/codicons/codicon/codicon.css:
@font-face { font-family: "lucide"; src: url("./lucide.woff2") format("woff2"); }
```

### 3b. Icon registry registrations in patch 001
```
src/vs/platform/theme/common/iconRegistry.ts:
const lucideFontDefinition: IconFontDefinition = {
  src: [{ location: URI.parse('lucide.woff2'), format: 'woff2' }]
};
iconRegistry.registerIconFont('lucide', lucideFontDefinition);

// 20 ThemeIcon registrations:
//   lucide-folder, lucide-folderOpen, lucide-files, lucide-file,
//   lucide-fileText, lucide-search, lucide-gitBranch, lucide-settings,
//   lucide-user, lucide-sparkle, lucide-bookOpen, lucide-fileOutput,
//   lucide-terminal, lucide-triangleAlert, lucide-clock, lucide-list,
//   (+ 4 more)
```

### 3c. Font asset copy in `scripts/apply-patches.sh`
```
LUCIDE_FONT_SRC="$VSCODE_DIR/extensions/ritemark/node_modules/lucide-static/font/lucide.woff2"
(fallback) "$ROOT_DIR/extensions/ritemark/node_modules/lucide-static/font/lucide.woff2"
cp "$LUCIDE_FONT_SRC" "$VSCODE_DIR/src/vs/base/browser/ui/codicons/codicon/lucide.woff2"
```

### 3d. `lucide-static` dependency
```
extensions/ritemark/package.json:
"lucide-static": "^0.555.0"
```

### 3e. What is NOT Lucide (already clean)
- `extensions/ritemark/media/` contains **no** `lucide-*.woff2` or `lucide-*.svg`. Only activity-bar SVGs (see §5) and generic extension icons.
- `extensions/ritemark/webview/` — zero Lucide imports (completed in Sprint 52).

### 3f. Surface the chrome actually uses
The Sprint 52 webview migration did NOT touch chrome icons; chrome still uses the `lucide-*` ThemeIcons registered in 3b. Without Phase 3 migration, Sprint 53's "no Lucide in chrome" success criterion fails. Phase 2 owes a concrete migration path decision — see Open Decisions §7 below.

---

## 4. View containers (activity-bar + auxiliary-bar)

From `extensions/ritemark/package.json` `contributes.viewsContainers`:

| ID | Title | Icon | Location | Role in Sprint 53 |
|---|---|---|---|---|
| `ritemark-flows` | Flows | `media/flows-icon.svg` (331B) | `activitybar` | **Preserve** — existing Flow button, moves into vertical rail. |
| `ritemark-ai` | Ritemark AI | `media/sparkles-icon.svg` (546B) | `auxiliarybar` | **Keep as-is** — right Agent Chat Panel, Sprint 53 must not redesign. |

Additional wiring:
- Activation: `onView:ritemark.unifiedView`, `onCommand:ritemark.showAIPanel`.
- No other Ritemark activity-bar or auxiliary-bar contributions.
- The Explorer / Search / Source Control / Extensions entries in the activity bar come from VS Code core (not contributed here).

**Implication for Sprint 53 layout work:** The physical "button order" referenced by `designer-questions.md` Q2 is:
- VS Code core entries (Explorer, Search, Source Control, Extensions) — controlled by their default order in core.
- Ritemark contributions (`ritemark-flows`) — ordered by contribution time.
- Auxiliary: `ritemark-ai` — stays in auxiliary bar.

Moving "the activity bar" from horizontal-over-sidebar to vertical-left-of-sidebar does NOT change the button set; it changes the orientation/placement of the `ViewContainerLocation.Sidebar` activity bar. Phase 2 must decide whether the rail is the native `ViewContainerLocation.Sidebar` activity bar rendered vertically (standard VS Code behavior on most platforms — Ritemark has custom horizontal placement via patch 002 that must be reverted/reshaped).

---

## 5. Static activity-bar SVG assets

| File | Size | Purpose |
|---|---|---|
| `flows-icon.svg` | 331 B | `ritemark-flows` activity-bar icon |
| `sparkles-icon.svg` | 546 B | `ritemark-ai` auxiliary-bar icon |
| `bot-icon.svg` | 357 B | AI panel UI element (internal, not activity-bar) |
| `icon.svg` | 422 B | Generic extension icon (marketplace) |
| `logo.svg` | 0 B | Placeholder (empty file) |

**Visual style check for Phase 2:** Both active activity-bar SVGs (`flows-icon.svg`, `sparkles-icon.svg`) predate the Sprint 52 Phosphor rule. Phase 2 must decide whether to replace them with Phosphor-aligned SVGs (weight 100, thin, 1px-equivalent stroke) or keep them (if they already match Phosphor's visual language). Do not remove — they're referenced from `package.json`.

**Note on `logo.svg`:** Empty file. Do not edit in Sprint 53 unless a specific task requires it.

---

## 6. product.json overrides (chrome-affecting)

Both `branding/product.json` and `vscode/product.json` carry identical chrome-related config:

```json
"workbench.colorTheme": "ritemark-light",
"workbench.preferredLightColorTheme": "ritemark-light",
"workbench.preferredDarkColorTheme": "ritemark-dark",
"window.autoDetectColorScheme": true,
"workbench.layoutControl.enabled": true,
"workbench.layoutControl.type": "toggles"
```

**Observations:**
- `autoDetectColorScheme: true` means Ritemark respects OS dark-mode preference. Sprint 53 chrome changes must work in both modes.
- `layoutControl.type: toggles` is what gives us the three-icon titlebar. Sprint 53 must preserve this.
- No per-platform (`windows`/`darwin`/`linux`) chrome overrides. Any platform-specific chrome behavior is handled by VS Code core or patches.
- No `defaultViewContainerLocations` — activity-bar/auxiliary-bar positions come from package.json `contributes.viewsContainers` alone.

---

## 7. Titlebar invariant state (CLAUDE.md Layout Invariants)

Patch 002 hunks touching titlebar hierarchy:

| File | Hunk | Role |
|---|---|---|
| `layoutActions.ts` | `@@ -41,9 +41,10 @@` | Icon definitions for menubar / activityBar / panelLeft toggles — custom `LayoutControlMenu` lives here. |
| `titlebarPart.ts` | `@@ -33,7 +33,8 @@` | Imports `ACCOUNTS_ACTIVITY_ID`, `GLOBAL_ACTIVITY_ID`, `CommandCenterControl`, `WorkbenchToolBar`. The hunk commenting out accounts icon is in this file. |
| `panelActions.ts` | `@@ -9,7 +9,7 @@` | MenuId/MenuRegistry imports — panel toggle registration is commented out in a later hunk. |
| `titlebarpart.css` | `@@ -462,3 +462,40 @@` | 40 lines of appended CSS (Sprint 38 titlebar customizations). |

**Invariant verification:** Current state matches CLAUDE.md:
- Only three titlebar controls (left sidebar toggle, right sidebar toggle, settings gear) — wired via `LayoutControlMenu` (custom) + gear icon.
- Accounts icon: hidden.
- Panel toggle: hidden.

**Sprint 53 ship-blocker:** Any hunk that re-enables accounts icon or panel toggle = regression. Phase 3 must not touch these hunks unless deliberately expanding the invariant (which it shouldn't).

---

## 8. Preview HTML baseline

`.claude/skills/ritemark-design/preview/` currently has **no chrome-surface preview**:
- `tokens.html` — design-token swatches only; a line mentions `sidebar, titlebar, panels` as token-usage context but renders no chrome.
- `components.html` — dialogs, buttons, pills, badges, filter-chips; no chrome.
- `typography.html` — type scale only.

**Implication for Sprint 53:** The Phase 5 "update skill preview to match new chrome" line in the sprint plan has nothing to extend — it's a new preview (`chrome.html` would need to be created). Lift that to a Phase 5 explicit deliverable.

---

## 9. Keyboard-navigation baseline (Phase 1 checklist item)

**Not yet walked.** A keyboard walk from repo root in dev mode needs to happen as a live step. Recording audit findings here when Jarmo walks through:
- (TBD) Can the vertical activity bar be tabbed into from the editor?
- (TBD) Are all three titlebar icons keyboard-reachable?
- (TBD) Does the auxiliary bar (Agent Chat Panel) receive focus via keyboard?
- (TBD) Are focus rings visible on each chrome control?

This will be completed in the Phase 4 keyboard audit — listed as TBD here rather than blocking Phase 2→3.

---

## 10. Contrast baseline (Phase 1 checklist item)

**Not yet computed.** The 73 chrome theme keys give us the color pairs needed; the contrast check is a follow-up pass that can run against the theme JSONs mathematically (no app needed). Delegating to Phase 4 accessibility sweep is fine — the Phase 1 audit establishes *what* to check, the Phase 4 work computes the ratios.

---

## 11. Open decisions for Phase 2 (gate items)

These are decisions the audit surfaces that Jarmo + engineering must close before Phase 2→3 approval:

1. **Chrome Lucide migration path.** Three options:
   - **(a) Phosphor web font** — register `phosphor.woff2` in `iconRegistry.ts` the same way Lucide is registered, rename 20 `lucide-*` ThemeIcons → `phosphor-*`. Requires shipping a Phosphor web font.
   - **(b) Static SVG assets** — replace each `lucide-*` ThemeIcon with a static SVG asset in `extensions/ritemark/media/`, update every callsite to `$(custom-icon-name)` referencing the asset.
   - **(c) VS Code ThemeIcon substitution** — replace `lucide-*` with core Codicon equivalents (e.g. `$(folder)`, `$(search)`, `$(gear)`). Loses Phosphor brand consistency in chrome.
   - **Recommendation:** (a) if Phosphor publishes a web font; (b) if not. (c) is last resort.

2. **Exact migrated button order.** Depends on VS Code core's activity-bar default order + where `ritemark-flows` lands. Phase 2 must lock this by reading the current app in dev mode.

3. **Activity-bar orientation mechanism.** RESOLVED. The horizontal activity bar is NOT a patch 002 customization. It's a single-line VS Code user-setting override in `extensions/ritemark/package.json:434`:
   ```
   "workbench.activityBar.location": "top"
   ```
   Phase 3 change: edit this line to `"default"` (or remove it entirely — VS Code's default is the left-vertical rail). No patch 002 work needed for orientation. Note: this interacts with the SQLite cache risk — existing users may have cached `"top"` in `views.customizations` even after the package.json change; mitigation protocol in the risk register applies.

4. **Remaining designer-questions defaults.** Q8, Q9, Q11 in `designer-questions.md` — Jarmo needs to explicitly accept the written defaults or override them.

---

## 12. Summary for Phase 2 gate

- **Patch baselines recorded.** Patch 001 = 14 files, patch 002 = 22 files, patch 003 = 14 files.
- **Theme coverage is broad** (73 keys) — Phase 3 mostly adjusts values, doesn't add keys.
- **Lucide chrome residue is finite** (1 font-face CSS block, 1 icon registry file, 1 script copy, 1 dep entry) — finite migration scope.
- **View containers are 2** (`ritemark-flows`, `ritemark-ai`) — minimal contribution footprint.
- **Titlebar invariant holds** — 3-icon state confirmed in patch 002.
- **Open decisions:** Lucide migration path, exact button order, activity-bar orientation mechanism, designer Q8/Q9/Q11 acceptance.

Phase 2 plan must resolve all four open decisions before Phase 3 begins.
