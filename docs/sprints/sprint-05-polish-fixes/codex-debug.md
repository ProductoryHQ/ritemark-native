# RiteMark Native – Debug Notes (Production Build)

## Issue 1: Dark mode flashes before switching to light
- Observation: `extensions/ritemark/package.json` sets `configurationDefaults.workbench.colorTheme` to `Default Light Modern`, but the first paint still uses dark.
- Likely cause: VS Code paints the workbench before extensions load; extension-level defaults apply only after activation/scan. Product default remains dark (`ThemeSettingDefaults.COLOR_THEME_DARK`).
- Recommendation: Set product-level defaults in `VSCode-darwin-arm64/RiteMark Native.app/Contents/Resources/app/product.json`:
  - `workbench.colorTheme`: `Default Light Modern`
  - `workbench.preferredLightColorTheme`: `Default Light Modern`
  - `window.autoDetectColorScheme`: `false`
  - Keep extension `configurationDefaults` as a fallback.
- Validation: Start with a fresh profile; no theme flash should occur.

## Issue 2: RiteMark custom editor webview blank
- Observation: Opening `.md` shows white area; `ritemarkEditor.js` and `media/webview.js` are present.
- Root cause: `extensions/ritemark/package.json` has `"activationEvents": []`, so the extension never activates; `RiteMarkEditorProvider.register` is not run, and no `load` message reaches the webview.
- Fix:
  - Add activation events: `onCustomEditor:ritemark.editor`, `onView:ritemark.aiView`, `onCommand:ritemark.configureApiKey`, `onCommand:ritemark.showAIPanel`, `onCommand:ritemark.openSearch`, optionally `onStartupFinished`.
  - Rebuild extension and package into the app.
- Checks:
  - Extension Host log: confirm activation (no “no activation events” warning).
  - Webview DevTools: should see `ready` → `load` message flow from `resolveCustomTextEditor` in `src/ritemarkEditor.ts`.
  - HTML should include `media/webview.js`; CSP already allows nonce’d script/style.

## Pre-build validation (add to CI/build pipeline)
- Script (suggested `scripts/prebuild-validate.js`):
  - Fail on zero-byte files in `extensions/ritemark/src` and `extensions/ritemark/webview/src`.
  - Run `npm run compile -- --noEmit` in `extensions/ritemark` (TypeScript check).
  - Run `npm run build -- --sourcemap` in `extensions/ritemark/webview`.
  - Assert `extensions/ritemark/media/webview.js` size > 10 KB (missing build guard).
- Hook script before packaging to catch corrupted files, TS failures, or missing webview bundle.

## Other notes
- `media/webview.js` is ~65 KB and built via Vite (`webview/vite.config.ts` targets `media/webview.js`, `webview.js.map`).
- `ritemarkEditor.ts` CSP: `default-src 'none'`, script nonce; local resources allowed from `media` and markdown directory. Should be fine once activation is fixed.
