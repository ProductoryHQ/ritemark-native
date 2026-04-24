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
