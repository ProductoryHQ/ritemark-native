# Sprint 05: Polish & Fixes

**Goal:** Fix production build issues, enforce light mode, and ensure Ritemark extension loads

**Status:** IN PROGRESS - Development started

---

## Exit Criteria (Jarmo Validates)

- [ ] Ritemark extension loads in production build (WYSIWYG editor works)
- [ ] Ritemark AI sidebar is visible and functional
- [ ] App boots in light mode by default
- [ ] App works in light mode only (dark mode disabled/hidden)
- [ ] Welcome page logo displays correctly in production build
- [ ] Unknown VS Code chat interface removed
- [ ] macOS app icon follows Apple HIG (rounded superellipse with depth)
- [ ] DMG installer works correctly

---

## Phase Checklist

### Phase 1: RESEARCH

#### Issue 1: Ritemark Extension Not Loading in Production - Root Cause Found

**Problem:** The Ritemark extension exists as a symlink in `vscode/extensions/ritemark` pointing to `../extensions/ritemark`. The production build process does NOT follow symlinks, resulting in an empty `.build/extensions/ritemark/` folder.

**Evidence:**
- Symlink: `vscode/extensions/ritemark -> /Users/jarmotuisk/Projects/ritemark-native/extensions/ritemark`
- `.build/extensions/ritemark/` is empty (only 64 bytes - just `.` and `..`)
- Production app has no ritemark extension installed

**Web Research Findings:**
- VS Code has documented issues with symlinks during builds ([GitHub Issue #124820](https://github.com/microsoft/vscode/issues/124820))
- VS Code's gulp build process uses file copying that doesn't preserve symlinks
- VSCodium and other forks solve this by either:
  1. Copying actual files into `extensions/` folder before build
  2. Adding extensions to `builtInExtensions` array in `product.json`
- Local extensions in `extensions/` folder are built directly by gulp, while remote extensions need metadata in `product.json`

**Solution:** Copy actual extension files instead of using symlink. The extension must exist as real files in `vscode/extensions/ritemark/` for the gulp build to properly include it.

**Sources:**
- [VS Code Symlink Issues](https://github.com/microsoft/vscode/issues/124820)
- [VSCodium Extensions Docs](https://github.com/VSCodium/vscodium/blob/master/docs/extensions.md)
- [Using Extensions in Compiled VSCode](https://stackoverflow.com/questions/44057402/using-extensions-in-compiled-vscode)

---

#### Issue 2: Logo Not Displaying - Root Cause Found

**Problem:** The production build only includes media files from `welcomeGettingStarted/common/media/` but our logo is in `welcomeGettingStarted/browser/media/`.

**Location:** `build/gulpfile.vscode.js` line 98
```javascript
'out-build/vs/workbench/contrib/welcomeGettingStarted/common/media/**/*.{svg,png}',
```

**Solution Options:**
1. Move logo to `common/media/` folder (follows existing pattern) ✓ RECOMMENDED
2. Add browser/media to build glob pattern

**Recommended:** Option 1 - Move to common/media folder. This follows VS Code's existing conventions and is less invasive than modifying build scripts.

---

#### Issue 3: Unknown Chat Interface Visible

**Problem:** VS Code has a built-in chat/copilot interface showing in the sidebar that needs to be hidden/removed.

**Location:** `vscode/src/vs/workbench/contrib/chat/`

**Web Research Findings:**
- As of late 2024, GitHub Copilot features are built directly into VS Code core, not just as extensions
- Microsoft integrated chat functionality into the core product starting around VS Code 1.95
- The `chat.disableAIFeatures` setting can disable these features
- Key settings to disable:
  ```json
  {
    "github.copilot.enable": { "*": false },
    "github.copilot.editor.enableAutoCompletions": false,
    "github.copilot.editor.enableCodeActions": false,
    "chat.commandCenter.enabled": false,
    "chat.agent.enabled": false
  }
  ```
- For a fork, we can either:
  1. Set these defaults in `configurationDefaults` in our extension's package.json
  2. Modify the chat contribution registration to not register at all
  3. Hide the chat views programmatically

**Sources:**
- [Disable Copilot in VS Code](https://stackoverflow.com/questions/75377406/how-can-i-disable-github-copilot-in-vs-code)
- [Turning off Copilot in VSCode](https://chriswiegman.com/2024/11/turning-off-copilot-in-vscode/)
- [VS Code Copilot FAQ](https://code.visualstudio.com/docs/copilot/faq)

---

#### Issue 4: Force Light Mode Only

**Problem:** App currently respects system dark/light mode. Need to force light mode only.

**Web Research Findings:**
- VS Code uses `window.autoDetectColorScheme` to follow OS theme
- Key settings for theme control:
  - `workbench.colorTheme` - the active theme
  - `workbench.preferredLightColorTheme` - theme when system is in light mode
  - `workbench.preferredDarkColorTheme` - theme when system is in dark mode
  - `window.autoDetectColorScheme` - whether to follow OS theme
- VS Code 1.89 (April 2024) changed behavior: when `autoDetectColorScheme` is enabled, `colorTheme` is ignored
- For a fork, we should:
  1. Set `"window.autoDetectColorScheme": false` as default
  2. Set `"workbench.colorTheme": "Default Light Modern"` as default
  3. Hide theme picker or limit available themes

**Sources:**
- [VS Code Themes Documentation](https://code.visualstudio.com/docs/getstarted/themes)
- [Auto Detect Color Scheme Settings](https://stackoverflow.com/questions/64470252/how-do-i-automatically-change-from-dark-to-light-themes-and-back-again-in-vs-cod)

---

#### Issue 5: macOS App Icon Doesn't Match System Style

**Problem:** The Ritemark dock icon appears flat/simple compared to other macOS icons which have depth, shadows, and rounded-rectangle style (macOS Big Sur+).

**Current icon location:** `branding/icons/icon.icns`

**Web Research Findings - Apple Human Interface Guidelines:**
- macOS Big Sur (11.0+) introduced new icon design language requiring:
  - **Squircle shape** (superellipse with n=4) - not a simple rounded rectangle
  - **Consistent drop shadow**: 28px radius, 12px Y-offset, 50% black opacity
  - **Front-facing perspective** with subtle depth
  - **Icon canvas**: 1024x1024 pixels, with icon fitting in ~824x824 area (100px gutter)
  - **Continuous curvature**: The corners have smooth, continuous curve (not circular arcs)
- macOS does NOT auto-mask icons like iOS does - we must create the shape ourselves
- Elements can "float" above the base squircle layer for added depth
- Recommended tools:
  - Mike Swanson's Photoshop script for correct squircle shape
  - Figma/Sketch templates for Big Sur icons
  - iconutil command to generate .icns from iconset

**Technical Specs for .icns:**
- Required sizes: 16x16, 32x32, 64x64, 128x128, 256x256, 512x512, 1024x1024
- Both @1x and @2x versions needed
- Drop shadow parameters: `blur: 28px, y: 12px, opacity: 50%`

**Sources:**
- [Apple Icon Shape Quest](https://liamrosenfeld.com/posts/apple_icon_quest/)
- [Creating App Icons for macOS 11+](https://medium.com/design-bootcamp/creating-app-icons-for-macos-11-and-up-1132ccd479bc)
- [Design for macOS Big Sur - Design+Code](https://designcode.io/ios-design-handbook-design-for-macos-big-sur/)
- [Syncthing macOS Icon Issue](https://github.com/syncthing/syncthing-macos/issues/153)

### Phase 2: PLAN

#### Task 1: Fix Ritemark Extension in Production Build (CRITICAL)
- [ ] Remove symlink from `vscode/extensions/ritemark`
- [ ] Copy actual extension files to `vscode/extensions/ritemark/`
- [ ] Verify extension builds correctly with gulp
- [ ] Test WYSIWYG editor works in production

#### Task 2: Fix Logo in Production Build
- [ ] Move `ritemark-logo.svg` from `browser/media/` to `common/media/`
- [ ] Update TypeScript reference in `gettingStarted.ts`
- [ ] Verify logo displays in dev mode
- [ ] Rebuild production app and verify

#### Task 3: Force Light Mode
- [ ] Set `window.autoDetectColorScheme: false` in configurationDefaults
- [ ] Set `workbench.colorTheme: "Default Light Modern"` as default
- [ ] Consider hiding theme picker from settings (optional, may be complex)
- [ ] Test that app stays in light mode regardless of OS setting

#### Task 4: Remove VS Code Chat Interface
- [ ] Add chat-disabling settings to configurationDefaults in ritemark extension
- [ ] Set `chat.commandCenter.enabled: false`
- [ ] Set `chat.agent.enabled: false`
- [ ] Set `github.copilot.enable: {"*": false}`
- [ ] Test that no VS Code chat/copilot UI appears
- [ ] Ensure Ritemark AI sidebar is the only AI interface

#### Task 5: Welcome Page - Start Buttons
- [ ] Remove "New File..." button (or change to create .md by default)
- [ ] Keep "Open..." button
- [ ] Default new file should be markdown

#### Task 6: Redesign macOS App Icon
- [ ] Design icon following Apple HIG (rounded superellipse)
- [ ] Add depth, shadows, gradient to match macOS Big Sur+ style
- [ ] Generate all required sizes for icon.icns
- [ ] Replace `branding/icons/icon.icns`

#### Task 7: Production Build Validation
- [ ] Rebuild macOS app
- [ ] Create new DMG
- [ ] Test fresh install
- [ ] Verify all features work

### Phase 3: DEVELOP
_Implementation pending approval_

### Phase 4: TEST & VALIDATE
- [ ] Ritemark extension loads and WYSIWYG works
- [ ] AI sidebar visible and functional
- [ ] Logo displays in production
- [ ] App always in light mode
- [ ] No dark mode access
- [ ] No VS Code chat interface visible
- [ ] macOS app icon looks native (matches system style)
- [ ] Fresh install works

### Phase 5: CLEANUP
- [ ] Document changes
- [ ] Update sprint plan

### Phase 6: CI/CD DEPLOY
- [ ] Commit all changes
- [ ] Push to GitHub
- [ ] Create release build

---

## Files to Modify

### Extension Fix
```
vscode/extensions/ritemark/           ← Replace symlink with actual files
├── package.json
├── out/extension.js
├── media/
└── ...
```

### Logo Fix
```
vscode/src/vs/workbench/contrib/welcomeGettingStarted/
├── browser/media/ritemark-logo.svg    ← MOVE FROM
└── common/media/ritemark-logo.svg     ← MOVE TO

vscode/src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts
└── Update FileAccess path
```

### Light Mode
```
vscode/src/vs/workbench/browser/workbench.contribution.ts
└── Default theme setting

vscode/product.json (or product.ts)
└── Theme configuration
```

### Chat Interface Removal
```
vscode/src/vs/workbench/contrib/chat/
└── Disable or hide chat contribution
```

---

## Notes

_Sprint 5 focuses on production-ready polish before wider testing_

**Priority Order:**
1. Ritemark extension loading (CRITICAL - app is useless without it)
2. Remove unknown chat interface
3. Fix logo
4. Force light mode
5. macOS app icon redesign
6. Welcome page buttons
