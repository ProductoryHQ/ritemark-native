# The splash while switching: the audit (W8, R9)

Checked 2026-10-19 on `sprint-134-project-at-the-centre` (`145d86e7`). Line numbers are this branch's; `vscode/` paths are VS Code 1.117.0 (pin `10c8e557`) with the 18 patches applied.

The stored splash was read from a copy of the installed v1.14.0's real profile (`User/globalStorage/storage.json`) and from local 2.0 test profiles in the temp folder. A splash holds theme colours and part sizes only.

## The result

- **Today a switch shows the desk's colour, not the ground's.** VS Code saves `editor.background` as the window's background and as the splash's body. In Ritemark Dark that is `#1E1B4B` between two `#16132F` columns: the "dark block". In Ritemark Light it is white between two `#F1F5F9` columns.
- **One small hunk fixes it.** 018 makes `partsSplash.ts` save `ritemark.ground` in those two places. The main process and the reloading page already use what is saved, so nothing else changes.
- **001 keeps its hunk,** with both auto-detect defaults moved to the two grounds.

## 1. How the splash works

Three things paint before the workbench does:

| When | What paints | Its colour | Code |
|---|---|---|---|
| A new window, before its page | The native window | `getBackgroundColor()`: the stored `themeBackground`, else a default for the base theme | `vscode/src/vs/platform/windows/electron-main/windows.ts:138`; `platform/theme/electron-main/themeMainServiceImpl.ts:191–210` |
| A switch, between the old page and the new | The native window | The last `setBackgroundColor`, made each time the splash is saved | `themeMainServiceImpl.ts:235–238, 329–336` |
| The new page, until the workbench lays out | `workbench.ts`: the body, then a box for each part | The stored splash, or defaults | `code/electron-browser/workbench/workbench.ts:31–276` |

The splash is removed when the workbench first lays out (`workbench/contrib/splash/browser/partsSplash.ts:45–48, 110–121`).

**What is saved** (`partsSplash.ts:71–104`):
- `colorInfo`: `foreground`; `background`, the hex of `editor.background` (or the workbench's background); `editorBackground`, `editor.background` again; the title bar's, activity bar's, side bar's and status bar's backgrounds and borders; the status bar with no folder; the window border.
- `layoutInfo`: the parts' sizes (title bar, activity bar, side bar, AI column, status bar), the side bar's side and the window border. Left out in full screen, while developing an extension, and after `window.titleBarStyle` changed (`:106–108`).
- `baseTheme` (`vs`, `vs-dark`, `hc-black`, `hc-light`) and the zoom.

**When.** Once the workbench is restored. Then after a full-screen change, a layout of the main editor part or a colour theme change, each when the window is next idle, at most 2.5 s later (`:50–57`). At once when `window.titleBarStyle` changes (`:59–64`). Not at shutdown.

**Where.** The page sends it to the main process (`platform/native/electron-main/nativeHostMainService.ts:459–463`), which writes four keys of its state file, `<user-data>/User/globalStorage/storage.json` (`platform/environment/common/environmentService.ts:65`; `themeMainServiceImpl.ts:28–32, 222–242`):
- `theme`: the base theme;
- `themeBackground`: `colorInfo.background`;
- `windowSplash`: all of it;
- `windowSplashWorkspaceOverride`: each folder's columns, shown or hidden, for up to 50 folders (`:73, 244–327`).

There is one splash for every window: the last to save wins. Only the columns are kept per folder.

**How a loading window uses it.** Each time a window loads (a new window, a reload, a switch), main hands the page `getWindowSplash(workspace)`: the stored splash with that folder's columns (`platform/windows/electron-main/windowImpl.ts:1284`; `themeMainServiceImpl.ts:338–399`). The page (`workbench.ts`):
- drops it when the OS changed between light and dark since it was saved and auto-detect is on (`:38–42`), or when high contrast changed (`:34–37`);
- paints the body with `colorInfo.editorBackground` (`:54–57, 84–87`);
- draws the title bar, activity bar, side bar, AI column (in the side bar's colour) and status bar as boxes at their saved sizes (`:95–275`).

With nothing stored: high contrast gives black or white; auto-detect gives 001's colours (§2); otherwise 001's light default.

**Main only knows auto-detect from `settings.json`.** In the main process the setting's default is `false` (`themeMainServiceImpl.ts:42–44`; `windowsMainService.ts:1577`). Patch 013 brings `product.json`'s defaults to the workbench only (`patches/vscode/013-ritemark-configuration-defaults.patch`, its one hunk in `workbench/services/configuration/browser/configuration.ts`). Ritemark writes `window.autoDetectColorScheme: true` into `settings.json` 1.5 s after a profile's first start (`extensions/ritemark/src/extension.ts:296–308`). Ritemark Settings writes `false` when the person picks a theme there (`src/settings/RitemarkSettingsProvider.ts:342–346`).

## 2. What 001 and 018 change here

**001** (`patches/vscode/001-ritemark-branding.patch`):
- `workbench.ts`, the hunk at patch lines 83–102 (file lines 68–82):
  - the auto-detect dark default becomes `#1E1B4B` with ink `#F8FAFC` (VS Code: `#1E1E1E`, `#CCCCCC`);
  - a new last branch, for auto-detect off with nothing stored: light, `#FFFFFF` with ink `#15141A` (VS Code sets nothing);
  - the auto-detect light default stays `#FFFFFF`.
- `workbench.ts`, the hunk at patch line 103 (file line 100): the splash's class defaults to `vs`, not `vs-dark`.
- `themeMainServiceImpl.ts`, the hunk at patch lines 228–238 (file lines 212–220): the stored base theme defaults to `vs`, not `vs-dark`. So `getBackgroundColor()` with nothing stored gives `DEFAULT_BG_LIGHT`, `#FFFFFF`. `DEFAULT_BG_DARK` is still VS Code's `#1F1F1F` (`:23–24`).

**018** (`patches/vscode/018-ritemark-surfaces.patch`) has no hunk in `partsSplash.ts`, `workbench.ts` or `themeMainServiceImpl.ts`. It reaches the splash in two ways:
- With no title row and the places on top, the saved sizes change: title bar 0 and activity bar 0. The local 2.0 test profiles show it: title 0, activity bar 0, side bar 256, AI column 400 (or 333), status bar 24.
- On Windows, the window buttons' background is `ritemark.ground` once the page runs (`workbench/electron-browser/parts/titlebar/titlebarPart.ts:275`; patch line 3986). Before that, main colours them with the stored `titleBarBackground` (`windows.ts:226`), which is the ground in both Ritemark themes.

## 3. The ground's colour

- **`ritemark.ground`** is a colour the extension contributes: Light `#F1F5F9`, Dark `#16132F`, high contrast `#000000`, high contrast light `#FFFFFF` (`extensions/ritemark/package.json:947`).
- Neither theme file sets it (`extensions/ritemark/themes/ritemark-light.json`, `ritemark-dark.json`), so any theme gets these defaults by its type (`workbench/services/themes/common/colorThemeData.ts:151–163`).
- **018 paints the ground with it**: `--rm-ground: var(--vscode-ritemark-ground, var(--vscode-sideBar-background))` (`workbench/browser/media/ritemarkSurfaces.css:26`), on the workbench (`:39`) and on every part around the work (`:77`).

The themes' own keys around it, each the same line in both files (`ritemark-light.json:28, 54, 123, 128, 133, 162`):

| Key | Ritemark Light | Ritemark Dark |
|---|---|---|
| `editor.background` (the desk, as `ritemark.desk`) | `#ffffff` | `#1E1B4B` |
| `activityBar`, `sideBar`, `statusBar` (and its no-folder colour), `titleBar.activeBackground` | `#F1F5F9` | `#16132F` |
| Their borders | none | none |

So VS Code saves today, in a 2.0 window: a body of `#ffffff` (Light) or `#1e1b4b` (Dark), and every box `#f1f5f9` or `#16132f`. The local 2.0 test profiles hold exactly these values.

**What a switch shows today**, reasoned from the code and the stored values (not yet recorded):
- Light: the native window white; the new page's body white, with the left column, the AI column and the status bar in the ground; then the frame (the ground, the white desk).
- Dark: the native window `#1E1B4B`; the body `#1E1B4B` between two `#16132F` columns; then the frame. The `#1E1B4B` area is the dark block the Experience lead's analysis names ("today a dark `#1E1B4B`", `ritemark-dev`: `product/design/experience/technical/README.md:217`).
- 001's own `#1E1B4B` shows only when nothing usable is stored: when the OS changed between light and dark since the last save, with auto-detect on.

## 4. On the real v1.14.0 profile, and a fresh one

**Stored** in `storage.json` (read from a copy):
- `theme`: `vs`; `themeBackground`: `#ffffff`.
- `windowSplash`: base theme `vs`, zoom 0.
  - Colours: foreground `#1e1b4b`; background and editor background `#ffffff`; title bar, activity bar, side bar, status bar and no-folder status bar `#f8fafc`; title bar, activity bar, side bar and status bar borders `#e2e8f0`. These are 1.x's Ritemark Light.
  - Sizes: title bar 32, activity bar 40 on the left, side bar 195, AI column 379, status bar 22, no window border.
- `windowSplashWorkspaceOverride`: side bar 195, AI column 379, 50 folders (the limit).
- `settings.json` holds `window.autoDetectColorScheme: true`, written by 1.x's same first-start step. The Mac is in Light.

So **the first 2.0 start after the update** shows 1.x's splash once: its title row, its activity bar and its colours. 2.0 saves its own a few seconds later. With the Mac in Dark, the stored `vs` splash would be dropped and 001's `#1E1B4B` shown.

**A fresh profile's first window:**
- `storage.json` has no `theme`, `themeBackground` or `windowSplash`, and `settings.json` has no `window.autoDetectColorScheme` yet. So main takes auto-detect to be off.
- The native window: `getBackgroundColor()` finds no preference, a stored base of `vs` (001's default) and no stored background, so `#FFFFFF` (`themeMainServiceImpl.ts:204–205`).
- The page: nothing stored and auto-detect off, so 001's last branch: `#FFFFFF` (`workbench.ts:78–82`).
- The workbench then follows the OS: its own configuration has auto-detect on, from `product.json` through 013 (`branding/product.json:189–192`). Light gives the ground `#F1F5F9` with the white desk; Dark gives `#16132F` with the `#1E1B4B` desk.
- In Light: white, then the ground, a small step. In Dark: a white flash before the first dark paint, once per profile. From the second window on, the stored splash is used.

## 5. The smallest change

### 018: save the ground

`vscode/src/vs/workbench/contrib/splash/browser/partsSplash.ts`, new to 018, in `_savePartsSplash()` (lines 71–104). After line 72 (`const theme = …`):

```ts
// Ritemark 2.0: the window's ground, as ritemarkSurfaces.css paints it (--rm-ground), so a reload shows the ground, not the desk
const ground = theme.getColor('ritemark.ground') ?? theme.getColor(themes.SIDE_BAR_BACKGROUND);
```

Lines 79–80 become:

```ts
background: Color.Format.CSS.formatHex(ground || theme.getColor(editorBackground) || themes.WORKBENCH_BACKGROUND(theme)),
editorBackground: (ground ?? theme.getColor(editorBackground))?.toString(),
```

Everything after it already uses these two values:
- main stores `background` as `themeBackground`, and the whole as `windowSplash` (`themeMainServiceImpl.ts:228–233`);
- main sets `background` on the open window at once (`:235–238, 329–336`), so the native window shows the ground during a switch's reload;
- every new window starts on it (`getBackgroundColor`, `:196–200`; `windows.ts:138`), Open in a new window included;
- the reloaded page paints its body with `editorBackground` (`workbench.ts:56, 87`). The boxes are already the ground in both Ritemark themes.

The result: the whole splash is `#F1F5F9` in Light and `#16132F` in Dark.
- The fallback to `sideBar.background` is what 018's CSS falls back to when the colour isn't registered (the extension not loaded). It is the same colour in both Ritemark themes.
- In high contrast the ground's defaults equal the editor's, so nothing changes there.
- `editorBackground` is read nowhere else in a desktop window. (The agent sessions window's `vs/sessions/electron-browser/sessions.ts:48–49` reads it; Ritemark doesn't use that window.)
- With a theme that isn't Ritemark's, the boxes keep that theme's bar colours, close to the ground. Saving the ground for those keys too would be four more lines; not needed.
- Not chosen: drawing the desk as a sheet in the splash. That is a new box in `workbench.ts` for a frame that lasts a fraction of a second.

### 001: the grounds as the defaults

In 001's `workbench.ts` hunk:
- line 71: `#1E1B4B` becomes `#16132F`, the dark ground;
- line 75: `#FFFFFF` becomes `#F1F5F9`, the light ground;
- the inks stay.

These show when the OS changed between light and dark while Ritemark was closed. A comment names `ritemark.ground` (`extensions/ritemark/package.json:947`) as their source: the page can't read the extension's colour before the workbench loads, so a change to the ground must change both. Keep the hunk, as the plan asked: it also carries the light last branch and the `vs` class.

### Optional: a fresh profile's first window (not needed for R9)

- 001's last branch (`workbench.ts:78–82`) could follow `configuration.colorScheme.dark` with the two grounds. It is reached only with nothing stored and main not yet knowing auto-detect: a fresh profile's first window, whose workbench does follow the OS.
- The native window would still be white for a moment. Changing that needs main to know Ritemark's auto-detect default (`themeMainServiceImpl.ts:44`; `windowsMainService.ts:1577`) and `DEFAULT_BG_LIGHT` and `DEFAULT_BG_DARK` (`:23–24`) set to the grounds: three more lines, in two files, one of them new to 001.
- Worth doing only if the recording (§6, check 5) shows the white flash.

## 6. What must be checked live

1. **A switch in Light and in Dark, recorded** with QuickTime or `screencapture -v` at 60 fps and stepped frame by frame, on the Mac and on Windows. Only the ground may show between the old window and the new: no white, no `#1E1B4B`. CDP can't see this phase: the native window and the splash come before the workbench and are gone by `code/didRemovePartsSplash`.
2. **What shows between the two pages:** the native window's colour, or the old page's last frame held until the new one paints. The recording settles it; the change covers both.
3. **The stored values:** after a theme change and 3 s, `storage.json`'s `themeBackground`, `windowSplash.colorInfo.background` and `windowSplash.colorInfo.editorBackground` are `#f1f5f9` in Light and `#16132f` in Dark. This one can be a scripted check in `scripts/qa/`.
4. **The OS changed between light and dark while Ritemark was closed:** the first window shows the new scheme's ground (001's branch).
5. **A fresh profile's first window,** in Light and in Dark. Today: white in both.
6. **A v1.14.0 profile's first 2.0 start:** 1.x's splash once, then 2.0's.
7. **Open in a new window (⌥ click)** starts on the ground. On Windows, the window buttons keep the ground before and after the page loads.
8. **A switch within 2.5 s of a theme change** still shows the previous theme's ground, since the save waits for the window to be idle. Acceptable; noted.

**Spec R9:** no change. W8's expectation holds, with one addition: 001's light auto-detect default moves to the light ground too.
