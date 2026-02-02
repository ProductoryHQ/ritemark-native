# Ritemark Native - Production Build Debug Report

**Date:** 2025-12-05  
**Build:** Production DMG (`VSCode-darwin-arm64/`)

* * *

## Issue Summary

| Issue | Severity | Root Cause | Status |
| --- | --- | --- | --- |
| Custom editor shows blank | CRITICAL | Empty `activationEvents` | Ready to fix |
| Dark mode on startup | Medium | VS Code theme init timing | Deferred |
| No build validation | Medium | Missing validation script | Ready to fix |

* * *

## Issue 1: Custom Editor Not Loading (CRITICAL)

### Symptoms

-   Opening any `.md` file shows empty/white editor area
    
-   Extension files present in app bundle (ritemarkEditor.js = 9847 bytes, webview.js = 65KB)
    
-   No visible errors in main UI
    

### Root Cause

`extensions/ritemark/package.json` **has** `"activationEvents": []` **(empty array)**

The extension NEVER activates because there are no activation events configured.

### Why This Matters

1.  User opens `.md` file
    
2.  VS Code sees `customEditors` contribution with `selector: {filenamePattern: "*.md"}`
    
3.  VS Code looks for activation event to start extension → **NONE FOUND**
    
4.  Extension's `activate()` function never called
    
5.  Custom editor provider never registered
    
6.  Webview never created
    
7.  **Result: Blank editor area**
    

### Code Verification

All downstream code is correct:

-   `src/extension.ts:activate()` - Properly registers custom editor provider
    
-   `src/ritemarkEditor.ts:getHtml()` - Generates valid HTML with CSP and nonce
    
-   `webview/src/main.tsx` - Correctly mounts React to `#root`
    
-   `webview/src/App.tsx` - TipTap editor component works
    
-   `webview/src/bridge.ts` - VS Code API communication works
    

**The issue is purely that the extension never starts.**

### Fix

```json
"activationEvents": [
  "onStartupFinished"
]
```

Alternative: VS Code can lazily activate based on `customEditors` contribution, but explicit `onStartupFinished` ensures reliable activation.

* * *

## Issue 2: Dark Mode Flash on Startup

### Symptoms

-   App starts showing dark theme briefly
    
-   Then switches to light theme
    
-   Even with fresh user profile deleted
    

### Root Cause

VS Code's theme initialization in `workbenchThemeService.ts:140-165`:

1.  **Phase 1 (Synchronous):** VS Code detects system theme via `environmentService.options.initialColorTheme`
    
2.  macOS is in dark mode → VS Code picks `ColorScheme.DARK`
    
3.  Dark theme colors applied to DOM immediately
    
4.  **Phase 2 (After Extensions Load):** Extension's `configurationDefaults` finally read
    
5.  `"workbench.colorTheme": "Default Light Modern"` applied
    
6.  **Result: Dark-to-light flash**
    

### Key Code Path

```typescript
// workbenchThemeService.ts:140-165
let themeData = ColorThemeData.fromStorageData(this.storageService);
if (!themeData) {
  const initialColorTheme = environmentService.options?.initialColorTheme;
  if (initialColorTheme) {
    themeData = ColorThemeData.createUnloadedThemeForThemeType(
      initialColorTheme.themeType,  // <-- System dark mode detected here
      ...
    );
  }
}
```

### Extension configurationDefaults (Currently Set)

```json
"configurationDefaults": {
  "workbench.colorTheme": "Default Light Modern",
  "window.autoDetectColorScheme": false,
  "workbench.preferredLightColorTheme": "Default Light Modern",
  "workbench.preferredDarkColorTheme": "Default Light Modern"
}
```

These are applied TOO LATE - after initial dark theme render.

### Potential Fixes (Requires Further Investigation)

**Option A: CSS Flash Prevention**

-   Add inline CSS in workbench HTML forcing white background
    
-   Cosmetic fix, doesn't address root cause
    

**Option B: Override VS Code Initialization**

-   Modify `initialColorTheme` detection to respect Ritemark settings
    
-   Requires touching VS Code core in `vscode/` submodule
    

**Option C: Pre-populate Storage**

-   Write light theme preference to storage before first run
    
-   Makes `fromStorageData()` succeed, skipping system detection
    

### Status

**DEFERRED** - Focus on critical editor loading issue first.

* * *

## Issue 3: No Build Validation

### Symptoms

-   12 source files were corrupted (0 bytes) without detection
    
-   `webview.js.map` is currently 0 bytes
    
-   Build completes without warning about invalid outputs
    

### Current Build Process

```plaintext
build-mac.sh:
1. npm run compile (extension TypeScript)
2. Copy extension to vscode/extensions/
3. Copy branding/product.json
4. npm run gulp vscode-darwin-arm64
```

No validation at any step.

### Files That Should Be Validated

**Pre-compilation (Source Files):**

-   `extensions/ritemark/src/**/*.ts` - All > 0 bytes
    
-   `extensions/ritemark/webview/src/**/*.tsx` - All > 0 bytes
    
-   `extensions/ritemark/tsconfig.json` - Exists
    
-   `extensions/ritemark/webview/vite.config.ts` - Exists
    

**Post-compilation (Build Outputs):**

-   `extensions/ritemark/out/extension.js` - > 1KB
    
-   `extensions/ritemark/out/ritemarkEditor.js` - > 5KB
    
-   `extensions/ritemark/media/webview.js` - > 50KB (currently 65KB)
    
-   `extensions/ritemark/media/webview.js.map` - > 0 bytes (currently 0!)
    

### Recommended Validation Script

```bash
#!/bin/bash
# scripts/validate-build.sh

# Check source files
for f in extensions/ritemark/src/*.ts; do
  if [ ! -s "$f" ]; then
    echo "ERROR: Empty source file: $f"
    exit 1
  fi
done

# Check build outputs
check_file_size() {
  local file=$1
  local min_size=$2
  local size=$(stat -f%z "$file" 2>/dev/null || echo 0)
  if [ "$size" -lt "$min_size" ]; then
    echo "ERROR: $file is too small ($size bytes, expected > $min_size)"
    exit 1
  fi
}

check_file_size "extensions/ritemark/out/extension.js" 1000
check_file_size "extensions/ritemark/media/webview.js" 50000
check_file_size "extensions/ritemark/media/webview.js.map" 1
```

* * *

## Debugging Reference

### Check Extension Activation

1.  Open Ritemark Native
    
2.  Help → Toggle Developer Tools
    
3.  Console should show: `"RitemarkEditor activated"`
    
4.  If not shown, extension didn't activate
    

### Check Webview Loading

1.  Open any `.md` file
    
2.  Right-click in editor area → "Developer: Open Webview Developer Tools"
    
3.  Or: Cmd+Shift+P → "Developer: Open Webview Developer Tools"
    
4.  Check Console for JavaScript errors
    
5.  Check Network tab - `webview.js` should load successfully
    

### Check HTML Generation

If webview DevTools opens but shows blank:

1.  In Elements tab, verify `<div id="root">` exists
    
2.  Check if React component tree is inside
    
3.  If empty, React didn't mount (check console errors)
    

### CSP Issues

If script blocked by Content Security Policy:

1.  Check Network tab for blocked requests
    
2.  Current CSP allows:
    
    -   `script-src 'nonce-{generated}'`
        
    -   `style-src 'unsafe-inline'`
        
    -   `img-src data:`
        

* * *

## Files Reference

| File | Purpose |
| --- | --- |
| `extensions/ritemark/package.json` | Extension manifest (activationEvents here) |
| `extensions/ritemark/src/extension.ts` | Extension entry point |
| `extensions/ritemark/src/ritemarkEditor.ts` | Custom editor provider |
| `extensions/ritemark/webview/src/main.tsx` | Webview React entry |
| `extensions/ritemark/webview/src/App.tsx` | Main editor component |
| `extensions/ritemark/media/webview.js` | Bundled webview |
| `vscode/src/vs/workbench/services/themes/browser/workbenchThemeService.ts` | Theme init |