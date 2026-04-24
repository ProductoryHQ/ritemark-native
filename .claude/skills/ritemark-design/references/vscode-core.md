# VS Code Core — Theming Rules

Surfaces VS Code renders directly (tabs, activity bar, status bar, titlebar, native dialogs, explorer) cannot be themed from the webview. They're themed through two mechanisms:

1. **Theme JSON** — color overrides per VS Code "color key." Lives in `extensions/ritemark/themes/*.json`.
2. **Patches** — when theme JSON is not enough (e.g., hiding a feature, adding a layout rule), we patch VS Code core under `patches/vscode/`.

This file covers theming; patches are covered in [CLAUDE.md](/Users/jarmotuisk/Projects/ritemark-native/CLAUDE.md) "VS Code Patch System."

## Current state

| File | Purpose | Status |
|---|---|---|
| `themes/ritemark-light.json` | Ritemark light theme | **Exists, ships today.** Uses the Indigo-current palette (`#4338CA`, `#1E1B4B`, slate neutrals). |
| `themes/ritemark-dark.json` | Ritemark dark theme | **Does not exist.** Ritemark falls back to VS Code's default dark. This file specifies the palette to create it. |
| `themes/light_vs.json`, `themes/light_plus.json` | Inherited base themes | Included by `ritemark-light.json` via `"include"` — don't edit these. |

## The light theme (exists — reference only)

`ritemark-light.json` uses the role colors below. When you extend it, resolve to these — don't introduce new colors.

```
focusBorder         = #4338CA  (--ritemark-indigo)
foreground          = #1E1B4B  (--ritemark-ink-strong, "Deep Space")
descriptionForeground = #64748B  (--ritemark-ink-muted)
errorForeground     = #EF4444  (--ritemark-error)

button.background   = #4338CA
button.hoverBackground = #3730A3  (--ritemark-indigo-deep)
button.secondaryBackground = #F1F5F9  (--ritemark-surface-soft)

activityBar.background = #F8FAFC  (--ritemark-surface-muted)
activityBar.foreground = #4338CA
activityBarBadge.background = #4338CA
activityBarBadge.foreground = #FFFFFF

sideBar.background  = #F8FAFC
sideBar.border      = #E2E8F0
sideBar.foreground  = #64748B

statusBar.background = #F8FAFC
statusBar.foreground = #64748B

tab.activeBackground = #FFFFFF
tab.activeBorderTop  = #4338CA  (the indigo accent)
tab.activeForeground = #1E1B4B
tab.inactiveBackground = #F8FAFC
tab.inactiveForeground = #94A3B8

editor.background    = #FFFFFF
editor.foreground    = #1E1B4B
editor.lineHighlightBackground = #F8FAFC
editorCursor.foreground = #4338CA  (indigo cursor)

list.activeSelectionBackground = #E0E7FF  (--ritemark-indigo-soft)
list.activeSelectionForeground = #1E1B4B
list.hoverBackground = #F1F5F9
```

## Surface-state mapping tables (the bridge between spec and theme JSON)

`references/components.md` describes webview components in CSS-class language (`ritemark-sidebar-item.is-active`). But VS Code core surfaces (Explorer tree, Search, Outline, Quick Pick, Tabs, inputs, menus, Status Bar) are **not webview**. They're painted directly by VS Code and driven by **theme-key language** in `themes/*.json`. The two languages do not translate automatically. Every state of every core surface has a dedicated theme key — if you leave it unset, VS Code falls back to the base theme (`light_plus.json` / `dark_plus.json`) which is not Ritemark.

The tables below are the **single source of truth** for which theme key drives which state. When a new core surface drifts (Explorer selection reads blue, tab hover reads default grey, quick-pick highlight reads VS Code selection-blue), open the relevant table, confirm the key is set, and fix the mapping.

### Explorer / Search / Outline / Tree-style lists

Every tree in VS Code (Explorer, Search results, Outline, Problems, npm-scripts, Timeline, custom views from extensions) shares the `list.*` and `tree.*` vocabulary. There are **7 distinct visual states**, plus drag-and-drop.

| # | State | When visible | Background key | Foreground key | Border / outline key |
|---|---|---|---|---|---|
| 1 | **Idle** (not hovered, not selected, tree has no focus) | Most rows most of the time | (inherits `sideBar.background`) | `sideBar.foreground` = `#64748B` `--ritemark-ink-muted` | — |
| 2 | **Hover** | Mouse over a row | `list.hoverBackground` = `#F1F5F9` `--ritemark-surface-soft` | `list.hoverForeground` = `#1E1B4B` `--ritemark-ink-strong` | — |
| 3 | **Selected — tree has focus** | Click a file; tree owns keyboard focus | `list.activeSelectionBackground` = `#E0E7FF` `--ritemark-indigo-soft` | `list.activeSelectionForeground` = `#1E1B4B` | `list.focusAndSelectionOutline` = `#4338CA` `--ritemark-indigo` |
| 4 | **Selected — tree lost focus** (inactive selection) | File picked, then focus moves to editor or another view | `list.inactiveSelectionBackground` = `#F1F5F9` `--ritemark-surface-soft` | `list.inactiveSelectionForeground` = `#1E1B4B` | — |
| 5 | **Focused unselected** (keyboard arrow moved but no commit yet) | Rare — typed search flow | `list.focusBackground` (unset by default → falls back to hover) | `list.focusForeground` (unset → inherits selection-fg) | `list.focusOutline` = `#4338CA` |
| 6 | **Icon tint — active selection** | File/folder icon on selected focused row | — | `list.activeSelectionIconForeground` = `#4338CA` `--ritemark-indigo` | — |
| 7 | **Icon tint — inactive selection** | File/folder icon on selected unfocused row | — | `list.inactiveSelectionIconForeground` = `#64748B` | — |
| 8 | **Drag-over** (drop target) | Dragging a file into a folder | `list.dropBackground` = `#E0E7FF` | — | — |
| 9 | **Highlight match** | Search match inside row text | — | `list.highlightForeground` = `#4338CA` | — |
| 10 | **Focused highlight match** | Search match inside focused row | — | `list.focusHighlightForeground` = `#3730A3` `--ritemark-indigo-deep` | — |
| — | Indent guides — passive | Vertical guide lines in tree | — | `tree.indentGuidesStroke` = `#E2E8F0` `--ritemark-hairline` | — |
| — | Indent guides — active | Guide line in the active tree branch | — | `tree.inactiveIndentGuidesStroke` (unset → uses passive) | — |

**Non-negotiables for tree states:**

- **Keys 3 + 4 must BOTH be set.** If you only set `activeSelection*`, clicking an explorer file then switching to the editor makes the selection *disappear*. The inactive variant preserves context.
- **`list.focusAndSelectionOutline` is the 1px indigo ring** that appears around the selected row when the tree has keyboard focus. This is the tree's equivalent of the webview's `ritemark-sidebar-item.is-active` left-border — except VS Code paints it as a full ring, not a left-border. Do **not** try to convert it to a left-border via CSS hacks in patches; the tree uses canvas-like rendering and respects only the theme key.
- **Icon foreground keys (6, 7) are easy to miss.** If unset, the file icons on the selected row render in VS Code's default dark blue — a dead giveaway that the theme is half-done.
- **Drag-over (8)** uses `list.dropBackground`. Without it, dragging looks identical to hover and the user can't tell if the drop target is valid.
- **Highlight match (9, 10)** drives search-result highlighting inside file names. Unset keys fall back to the base theme's bright blue, which collides with the indigo selection ring and reads wrong.

### Tabs (editor tabs + pinned tabs)

| # | State | Background key | Foreground key | Border |
|---|---|---|---|---|
| 1 | **Active — focus** | `tab.activeBackground` = `#FFFFFF` | `tab.activeForeground` = `#1E1B4B` | `tab.activeBorderTop` = `#4338CA` (2px indigo top border) |
| 2 | **Active — unfocused** | `tab.unfocusedActiveBorderTop` = `#E2E8F0` | (inherits) | border-top turns hairline grey when editor group loses focus |
| 3 | **Inactive** | `tab.inactiveBackground` = `#F8FAFC` | `tab.inactiveForeground` = `#94A3B8` `--ritemark-ink-faint` | `tab.border` = `#E2E8F0` |
| 4 | **Hover** | `tab.hoverBackground` = `#FFFFFF` | (inherits) | — |
| 5 | **Unfocused hover** | `tab.unfocusedHoverBackground` = `#F8FAFC` | `tab.unfocusedInactiveForeground` = `#94A3B8` | — |
| 6 | **Selected pinned** | `tab.selectedBorderTop` = `#4338CA` | — | border-top matches active |
| — | Last pinned divider | — | — | `tab.lastPinnedBorder` = `#E2E8F0` |

**Non-negotiables for tabs:**

- Active tab always has a **2px indigo top border** (`tab.activeBorderTop`). This is Ritemark's signature — not the background change, the top border.
- The unfocused pair (`tab.unfocusedActiveBorder*`, `tab.unfocusedHoverBackground`, `tab.unfocusedInactiveForeground`) must be set, otherwise when the user clicks into the terminal or another editor group, the current editor's tab looks *identical* to the active one and keyboard focus is invisible.

### Inputs, dropdowns, checkboxes

| Surface | Background | Foreground | Border | Focus |
|---|---|---|---|---|
| `input.*` | `input.background` = `#FFFFFF` | `input.foreground` = `#1E1B4B` | `input.border` = `#E2E8F0` | `focusBorder` = `#4338CA` |
| `input.placeholderForeground` | — | `#94A3B8` `--ritemark-ink-faint` | — | — |
| `inputOption.active*` (toggle chips inside search) | `#E0E7FF` | `#1E1B4B` | `#4338CA` | inherits focus |
| `dropdown.*` | `dropdown.background` = `#FFFFFF` | `dropdown.foreground` = `#1E1B4B` | `dropdown.border` = `#E2E8F0` | `focusBorder` |
| `checkbox.*` | `checkbox.background` = `#FFFFFF` | inherits `foreground` | `checkbox.border` = `#E2E8F0` | `focusBorder` |

### Menu + Quick Pick + Command Palette

| Surface | Background | Foreground | Selection bg | Selection fg |
|---|---|---|---|---|
| `menu.*` | `menu.background` = `#FFFFFF` | `menu.foreground` = `#1E1B4B` | `menu.selectionBackground` = `#4338CA` | `menu.selectionForeground` = `#FFFFFF` |
| `menu.separatorBackground` | `#E2E8F0` | — | — | — |
| `quickInput.*` | `quickInput.background` = `#FFFFFF` | `quickInput.foreground` = `#1E1B4B` | (uses `list.active*` keys) | (uses `list.active*` keys) |
| `pickerGroup.*` (group headers in quick pick) | — | `pickerGroup.foreground` = `#94A3B8` | — | — |
| `pickerGroup.border` | — | — | `#E2E8F0` | — |

**Gotcha:** Quick Pick uses the same `list.*` keys as the Explorer tree for its result rows. Setting them once fixes both surfaces.

### Status Bar

| State | Background | Foreground | Border |
|---|---|---|---|
| **Idle** (folder open, no action) | `statusBar.background` = `#F8FAFC` | `statusBar.foreground` = `#64748B` | `statusBar.border` = `#E2E8F0` |
| **No folder** (empty window) | `statusBar.noFolderBackground` = `#F8FAFC` | inherits | — |
| **Debugging** | `statusBar.debuggingBackground` = `#EF4444` | `statusBar.debuggingForeground` = `#FFFFFF` | — |
| **Focus ring** | — | — | `statusBar.focusBorder` = `#4338CA` |
| Item **error** | `statusBarItem.errorBackground` = `#EF4444` | inherits | — |
| Item **warning** | `statusBarItem.warningBackground` (set if needed) | inherits | — |
| Item **prominent** (default remote) | `statusBarItem.prominentBackground` = `#E2E8F040` | inherits | — |
| Item **remote** | `statusBarItem.remoteBackground` = `#4338CA` | `statusBarItem.remoteForeground` = `#FFFFFF` | — |

### Activity Bar (left rail)

| State | Background | Foreground | Indicator |
|---|---|---|---|
| **Idle** | `activityBar.background` = `#F8FAFC` | `activityBar.foreground` = `#4338CA` | — |
| **Inactive slot** | inherits | `activityBar.inactiveForeground` = `#94A3B8` | — |
| **Active slot** | inherits | `activityBar.foreground` | `activityBar.activeBorder` = `#4338CA` (2px indigo left-border) |
| **Badge** | `activityBarBadge.background` = `#4338CA` | `activityBarBadge.foreground` = `#FFFFFF` | — |
| Separator | — | — | `activityBar.border` = `#E2E8F0` |

**Activity Bar Top** (the alternative horizontal layout when user enables it) uses a parallel `activityBarTop.*` vocabulary — those keys are set identically in the light theme today; don't let drift separate them.

### Git decorations (tint-only, not color-coded)

Ritemark deliberately breaks from VS Code's default amber / green / red palette here. We have **one brand accent** (indigo) and everything else is ink-tones. Seeing four fluorescent status colors in a file tree is mental overload. The status letter (M · U · A · D · !) carries the semantic; the tint says "dirty".

| State | Row fill | Left border | Filename | Letter |
|---|---|---|---|---|
| **Modified** (M) | `--ritemark-surface-soft` `#F1F5F9` | `--ritemark-hairline-strong` `#CBD5E1` (2px) | `--ritemark-ink-body` | `--ritemark-ink-muted` |
| **Untracked** (U) | same as M | same as M | same as M | same as M |
| **Added / staged** (A) | same as M | same as M | same as M | same as M |
| **Deleted** (D) | same as M | same as M | `--ritemark-ink-faint` + strikethrough | `--ritemark-ink-muted` |
| **Conflict** (!) — the exception | `--ritemark-error-soft` `#FEE2E2` | `--ritemark-error` `#EF4444` (2px) | `--ritemark-ink-strong` (weight 600) | `--ritemark-error` |
| **Ignored** / submodule | — (no tint) | — | `--ritemark-ink-disabled` italic | — |

**The theme-key bindings (what you actually write in `ritemark-light.json`):**

```jsonc
"gitDecoration.modifiedResourceForeground":     "#64748B",  // ink-muted (NOT amber)
"gitDecoration.untrackedResourceForeground":    "#64748B",  // ink-muted (NOT green)
"gitDecoration.addedResourceForeground":        "#64748B",  // ink-muted (NOT green)
"gitDecoration.deletedResourceForeground":      "#94A3B8",  // ink-faint, rendered with strikethrough by core
"gitDecoration.renamedResourceForeground":      "#64748B",  // ink-muted
"gitDecoration.stageModifiedResourceForeground":"#64748B",  // ink-muted
"gitDecoration.stageDeletedResourceForeground": "#94A3B8",  // ink-faint
"gitDecoration.conflictingResourceForeground":  "#EF4444",  // error — the ONLY colored git state
"gitDecoration.ignoredResourceForeground":      "#CBD5E1",  // ink-disabled
"gitDecoration.submoduleResourceForeground":    "#CBD5E1"   // ink-disabled
```

**Non-negotiables:**

- **Do not color-code git status.** Modified, untracked, added, deleted all share the same ink-muted letter. The letter is the semantic; color is noise.
- **Conflict is the only exception** — it blocks the user's work; a red "!" is earned.
- **Dirty = subtle tint, not a bright flag.** If Jarmo opens the Explorer and it looks like a traffic light, revert — we're back to VS Code defaults.
- See `docs-internal/design/ritemark-ui.pen` node `57gPj` (sidebarTree) for the canonical render of this rule, and the "VS Code surface states → Git decorations" section for each state in isolation.

### The audit checklist

When a core surface reads wrong:

1. **Open `themes/ritemark-light.json` (or `ritemark-dark.json`).**
2. **Find the surface's table above.** Confirm every key in the "theme key" column is set.
3. **If a key is missing**, add it — pick the correct `--ritemark-*` token from the table, copy the hex value (themes don't support CSS variables).
4. **If a key is set but renders wrong**, either the hex is stale (mismatch with `tokens.css`) or the key is being overridden by `light_plus.json` / `dark_plus.json` (the included base theme). Overrides in our file take precedence — check spelling.
5. **If the surface is a webview component**, this table does not apply — check `references/components.md` instead.

This is the loop: theme key → token → hex, every state, every surface, both light + dark. Anything outside that loop is drift.

## The dark theme (to be created)

Create `extensions/ritemark/themes/ritemark-dark.json`. Structure:

```json
{
  "$schema": "vscode://schemas/color-theme",
  "name": "Ritemark Dark",
  "include": "./dark_plus.json",
  "colors": {
    "focusBorder": "#818CF8",
    "foreground": "#F8FAFC",
    "descriptionForeground": "#94A3B8",
    "errorForeground": "#F87171",

    "button.background": "#4338CA",
    "button.hoverBackground": "#3730A3",
    "button.foreground": "#FFFFFF",
    "button.secondaryBackground": "#251F5C",
    "button.secondaryForeground": "#F8FAFC",
    "button.secondaryHoverBackground": "#2D2570",

    "activityBar.background": "#191635",
    "activityBar.foreground": "#818CF8",
    "activityBar.inactiveForeground": "#64748B",
    "activityBar.activeBorder": "#818CF8",
    "activityBar.border": "#3730A3",
    "activityBarBadge.background": "#818CF8",
    "activityBarBadge.foreground": "#1E1B4B",

    "sideBar.background": "#191635",
    "sideBar.border": "#3730A3",
    "sideBar.foreground": "#C7D2FE",
    "sideBarSectionHeader.background": "#191635",
    "sideBarSectionHeader.foreground": "#F8FAFC",
    "sideBarSectionHeader.border": "#3730A3",
    "sideBarTitle.foreground": "#F8FAFC",

    "statusBar.background": "#191635",
    "statusBar.foreground": "#C7D2FE",
    "statusBar.border": "#3730A3",
    "statusBar.debuggingBackground": "#F87171",
    "statusBar.debuggingForeground": "#1E1B4B",
    "statusBar.focusBorder": "#818CF8",

    "titleBar.activeBackground": "#191635",
    "titleBar.activeForeground": "#F8FAFC",
    "titleBar.inactiveBackground": "#191635",
    "titleBar.inactiveForeground": "#94A3B8",
    "titleBar.border": "#3730A3",

    "tab.activeBackground": "#1E1B4B",
    "tab.activeBorder": "#1E1B4B",
    "tab.activeBorderTop": "#818CF8",
    "tab.activeForeground": "#F8FAFC",
    "tab.inactiveBackground": "#191635",
    "tab.inactiveForeground": "#94A3B8",
    "tab.border": "#3730A3",
    "tab.hoverBackground": "#1E1B4B",
    "tab.selectedBorderTop": "#818CF8",

    "editor.background": "#1E1B4B",
    "editor.foreground": "#F8FAFC",
    "editor.inactiveSelectionBackground": "rgba(129,140,248,0.16)",
    "editor.selectionHighlightBackground": "rgba(129,140,248,0.28)",
    "editor.lineHighlightBackground": "#251F5C",
    "editorCursor.foreground": "#818CF8",
    "editorGroup.border": "#3730A3",
    "editorGroupHeader.tabsBackground": "#191635",
    "editorGroupHeader.tabsBorder": "#3730A3",
    "editorIndentGuide.background1": "#3730A3",
    "editorLineNumber.foreground": "#64748B",
    "editorLineNumber.activeForeground": "#818CF8",
    "editorOverviewRuler.border": "#3730A3",
    "editorWidget.background": "#1E1B4B",
    "editorWidget.border": "#3730A3",
    "editorSuggestWidget.background": "#1E1B4B",

    "input.background": "#251F5C",
    "input.border": "#3730A3",
    "input.foreground": "#F8FAFC",
    "input.placeholderForeground": "#94A3B8",
    "inputOption.activeBackground": "rgba(129,140,248,0.16)",
    "inputOption.activeBorder": "#818CF8",
    "inputOption.activeForeground": "#F8FAFC",

    "list.activeSelectionBackground": "rgba(129,140,248,0.16)",
    "list.activeSelectionForeground": "#F8FAFC",
    "list.activeSelectionIconForeground": "#818CF8",
    "list.hoverBackground": "#251F5C",
    "list.focusAndSelectionOutline": "#818CF8",
    "list.inactiveSelectionBackground": "#251F5C",
    "list.inactiveSelectionForeground": "#F8FAFC",

    "menu.background": "#1E1B4B",
    "menu.border": "#3730A3",
    "menu.foreground": "#F8FAFC",
    "menu.selectionBackground": "#4338CA",
    "menu.selectionForeground": "#FFFFFF",
    "menu.separatorBackground": "#3730A3",

    "notificationCenterHeader.background": "#1E1B4B",
    "notificationCenterHeader.foreground": "#F8FAFC",
    "notifications.background": "#1E1B4B",
    "notifications.border": "#3730A3",
    "notifications.foreground": "#F8FAFC",

    "panel.background": "#191635",
    "panel.border": "#3730A3",
    "panelTitle.activeBorder": "#818CF8",
    "panelTitle.activeForeground": "#F8FAFC",
    "panelTitle.inactiveForeground": "#94A3B8",

    "pickerGroup.border": "#3730A3",
    "pickerGroup.foreground": "#94A3B8",

    "progressBar.background": "#818CF8",

    "quickInput.background": "#1E1B4B",
    "quickInput.foreground": "#F8FAFC",

    "scrollbarSlider.background": "rgba(129,140,248,0.24)",
    "scrollbarSlider.hoverBackground": "rgba(129,140,248,0.36)",
    "scrollbarSlider.activeBackground": "rgba(129,140,248,0.48)",

    "settings.dropdownBackground": "#1E1B4B",
    "settings.dropdownBorder": "#3730A3",
    "settings.headerForeground": "#F8FAFC",
    "settings.modifiedItemIndicator": "#818CF8",
    "settings.numberInputBorder": "#3730A3",
    "settings.textInputBorder": "#3730A3",

    "tree.indentGuidesStroke": "#3730A3",

    "terminal.foreground": "#F8FAFC",
    "terminal.tab.activeBorder": "#818CF8",
    "terminalCursor.foreground": "#818CF8",

    "textBlockQuote.background": "#191635",
    "textBlockQuote.border": "#3730A3",
    "textCodeBlock.background": "#191635",
    "textLink.foreground": "#818CF8",
    "textLink.activeForeground": "#A5B4FC",
    "textPreformat.foreground": "#F8FAFC",
    "textPreformat.background": "#251F5C",
    "textSeparator.foreground": "#3730A3",

    "welcomePage.tileBackground": "#191635",
    "widget.border": "#3730A3",
    "widget.shadow": "#00000040",

    "breadcrumb.foreground": "#94A3B8",
    "breadcrumb.focusForeground": "#818CF8",
    "breadcrumb.activeSelectionForeground": "#F8FAFC",

    "minimap.selectionHighlight": "rgba(129,140,248,0.32)"
  }
}
```

## The principle that makes the dark theme work

**Deep Space `#1E1B4B` is the surface, not a chrome accent.**

In the light theme, `#1E1B4B` is the *ink* (body text). In dark, it becomes the *surface* (editor, dialog, panel background). This single move is what makes the dark theme feel like Ritemark's — every other dark theme uses a neutral charcoal (`#1E1E1E` or similar), and the result is indistinguishable VS Code chrome. Using Deep Space instead keeps the brand tone in every pixel.

Supporting rules:

- **Chrome surfaces** (sidebar, status bar, tabs, activity bar) go one step darker: `#191635`. This gives the editor the lightest-in-the-room feel, which makes the writing pop.
- **Hairlines** stay indigo (`#3730A3`), not neutral grey. A grey hairline on Deep Space reads generic; an indigo hairline keeps the mood.
- **Accent** steps up from `#4338CA` (light) to `#818CF8` (Indigo 400, dark). The lighter hue passes AA contrast on `#1E1B4B` and avoids the "dim button on dark" problem common in dark themes.
- **Body text** on dark is `#C7D2FE` (indigo-fainter), not ivory grey. This is deliberate — grey body on deep indigo reads muddy. Indigo-fainter gives the copy warmth.
- **Cursor** stays indigo (`#818CF8` in dark).

## Registering the dark theme

Add to `extensions/ritemark/package.json` (contributes → themes):

```json
{
  "label": "Ritemark Dark",
  "uiTheme": "vs-dark",
  "path": "./themes/ritemark-dark.json"
}
```

## Patching the theme-switch defaults

The Ritemark Light theme is the ship-default today. Once the dark theme exists, users can switch freely; but the *initial* appearance when a new user launches Ritemark depends on a VS Code core patch (see `patches/vscode/001-ritemark-branding.patch` — it sets the default theme to `ritemark-light`).

If Ritemark should default to dark in some cases (e.g., matching OS appearance), that's a patch change, not a theme change. Out of scope for Sprint 52; document as an open question if it comes up.

## Testing

After creating the dark theme:

1. Build Ritemark in dev mode (`./vscode/scripts/code.sh` per CLAUDE.md).
2. Cmd+K Cmd+T → select "Ritemark Dark."
3. Check every chrome surface in order:
   - Activity bar (indigo icon on `#191635`)
   - Sidebar (background `#191635`, ink body `#C7D2FE`, active item uses `rgba(129,140,248,0.16)` + indigo 400)
   - Editor (background `#1E1B4B`, cursor `#818CF8`, text `#F8FAFC`)
   - Tab strip (active tab has `#1E1B4B` background, `#818CF8` top border)
   - Status bar (`#191635` background, muted ink)
   - Titlebar (`#191635` background, strong ink for title)
4. Open a dialog (Settings → Editor Preferences). Webview dark tokens should kick in via the body `.ritemark-dark` class. Confirm the dialog uses Deep Space surface, not VS Code's `#252526`.
5. Compare against the `design-study/option-d-indigo-current.html` mock's Scene 05 — the *current* dark state (VS Code default). The difference before/after is the quality bar.

## Anti-patterns in theme JSON

- ❌ `"editor.background": "#1E1E1E"` — that's VS Code default; lose the brand entirely.
- ❌ `"editor.background": "#000000"` — too harsh, crushes the Deep Space tone.
- ❌ `"activityBar.background": "#1E1B4B"` — same as editor; loses the chrome/content contrast.
- ❌ Mixing `#94A3B8` (slate muted) as body text on `#1E1B4B` — muddy. Use `#C7D2FE` (indigo-fainter) instead.
- ❌ Reaching for a second accent color (teal, amber) to "warm up" dark mode. Dark mode's warmth comes from using indigo-fainter for body text, not from a second accent.
