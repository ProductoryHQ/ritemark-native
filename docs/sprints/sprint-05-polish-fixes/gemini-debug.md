# Ritemark Native - Debugging Report

## Issue 1: Dark Mode Flash on Startup
**Root Cause Theory:**
The `configurationDefaults` in `extensions/ritemark/package.json` are applied during the extension activation phase. When Ritemark Native launches, it initially loads the workbench with the cached or default system theme (often Dark) *before* the extension host has fully started and applied the `ritemark` extension's overrides. This causes the visual "flash" from dark to light.

**Recommended Fix:**
Move the configuration defaults from the extension's `package.json` to the application's global `product.json`. In a VS Code fork, `product.json` settings are applied at the application bootstrap level, ensuring the theme is set before the UI renders.

**Action:**
Modify `branding/product.json` to include:
```json
"configurationDefaults": {
    "workbench.colorTheme": "Default Light Modern",
    "workbench.preferredLightColorTheme": "Default Light Modern",
    "workbench.preferredDarkColorTheme": "Default Light Modern"
}
```

---

## Issue 2: Custom Editor Webview is Blank
**Investigation Findings:**
1.  **File Existence:** `webview.js` exists in `extensions/ritemark/media/` and is ~65KB, indicating the build is likely succeeding.
2.  **HTML Structure:** The `RitemarkEditorProvider.ts` generates HTML where `<div id="root"></div>` precedes the `<script>` tag. This is generally correct for synchronous execution.
3.  **CSP:** The Content Security Policy includes `script-src 'nonce-${nonce}'`, and the script tag uses this nonce. This looks correct.
4.  **Mount Point:** The React app uses `ReactDOM.createRoot(document.getElementById('root')!)`.

**Potential Causes:**
1.  **Runtime Error:** The React application might be throwing an error immediately upon execution (e.g., a missing import or syntax error incompatible with the webview environment), halting the render.
2.  **Path Resolution:** While `webview.js` exists, the `asWebviewUri` conversion might be resulting in a 404 if the base path isn't resolving correctly in the built app.
3.  **CSS Injection:** The styling is injected via JavaScript. If the JS fails, no styles load, potentially leaving content invisible (though typically unstyled content would still appear).

**Debugging Steps (for user):**
1.  **Inspect Webview:** inside Ritemark Native, run the command `Developer: Open Webview Developer Tools` while the blank editor is open. This is distinct from the main window's DevTools.
2.  **Check Console:** Look for red errors in the Webview DevTools console.
    *   *Likely error:* "Target container is not a DOM element" (if script runs too early) or generic Syntax Errors.
3.  **Verify Loading:** In the Network tab of Webview DevTools, reload the webview (Cmd+R) and verify `webview.js` returns status 200.

---

## Pre-build Validation Script
To prevent corrupted builds, a script `scripts/validate-build.js` is recommended.

**Proposed Logic:**
1.  **Scan Source:** Recursively check `src/` and `extensions/` for files with 0 bytes size.
2.  **Check Artifacts:** specific check for `extensions/ritemark/media/webview.js` existence and min-size (>1KB).
3.  **TypeScript Check:** Run `tsc --noEmit` to verify type integrity before packaging.

**Draft Script (`scripts/validate-build.js`):**
```javascript
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REQUIRED_FILES = [
    { path: 'extensions/ritemark/media/webview.js', minSize: 1024 } // > 1KB
];

console.log('🔍 Starting Pre-build Validation...');

// 1. Check for 0-byte source files
function checkZeroByteFiles(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            if (file !== 'node_modules' && file !== '.git') checkZeroByteFiles(filePath);
        } else {
            if (stat.size === 0) {
                console.error(`❌ ERROR: Found 0-byte file: ${filePath}`);
                process.exit(1);
            }
        }
    }
}
checkZeroByteFiles('./extensions/ritemark/src');

// 2. Verify Build Artifacts
REQUIRED_FILES.forEach(file => {
    if (!fs.existsSync(file.path)) {
        console.error(`❌ ERROR: Missing required build artifact: ${file.path}`);
        process.exit(1);
    }
    const stats = fs.statSync(file.path);
    if (stats.size < file.minSize) {
        console.error(`❌ ERROR: Artifact too small (${stats.size}b): ${file.path}`);
        process.exit(1);
    }
});

console.log('✅ Validation passed.');
```
