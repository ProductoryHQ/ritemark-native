# File Explorer Icon Analysis

## Problem

Windows executable doesn't show RiteMark icon in File Explorer when viewing the unzipped app directory.

**Expected:** RiteMark logo icon
**Actual:** Generic Windows application icon

## Icon Asset Exists

**Location:** `branding/icons/icon.ico`
**Size:** 143KB
**Format:** Multi-resolution .ico (contains multiple icon sizes)

## Windows Build Process

Windows builds are created via:
- `./scripts/build-prod-windows.sh` (wrapper script)
- Calls `gulp vscode-win32-x64` (or similar target)
- Build system: VS Code's gulp build (located in `vscode/build/`)

## Icon Embedding in Windows

Windows executables need icons embedded at build time via:
1. Resource compiler (.rc file pointing to .ico)
2. Electron builder configuration (for Electron-based apps)
3. VS Code build gulp configuration

## Where to Look

### Primary: VS Code Build Configuration

**File:** `vscode/build/gulpfile.vscode.win32.js` or similar
- Search for: `icon`, `ico`, `win32Icon`
- VS Code likely has icon configuration for Windows builds
- Need to point it to `../../branding/icons/icon.ico`

### Alternative: Product Configuration

**File:** `branding/product.json`
- May support `win32Icon` or similar property
- Less likely than build configuration

### Electron Builder

If VS Code uses electron-builder for packaging:
- Configuration in `package.json` or `electron-builder.json`
- Property: `win.icon`

## Investigation Steps

1. Search vscode/build/ for icon configuration
2. Check how macOS icon is configured (as reference)
3. Look for Windows-specific build settings
4. Verify icon is copied to build output directory

## Testing

**After fix:**
1. Run Windows build: `./scripts/build-prod-windows.sh`
2. Navigate to: `VSCode-win32-x64/`
3. View in Windows File Explorer
4. Verify: `Code.exe` (or `Ritemark.exe`) shows RiteMark icon

**Alternative test:**
- Right-click exe → Properties → Icon should show RiteMark logo

## Expected Fix

Likely a one-line change in build configuration:

```javascript
// vscode/build/gulpfile.vscode.win32.js (example)
const config = {
  // ...
  icon: path.join(__dirname, '../../branding/icons/icon.ico'),
  // ...
}
```

This may require a new patch file if it's in VS Code's build scripts.

## Complexity

**Medium** - Requires:
- Understanding VS Code's Windows build process
- Modifying build configuration (may need patch)
- Testing on Windows (or Windows VM)
- Rebuilding entire app to verify (~25min build)
