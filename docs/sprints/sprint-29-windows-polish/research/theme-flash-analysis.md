# Dark Theme Flash Analysis

## Problem

On Windows (and likely all platforms), when launching RiteMark:
1. VS Code loads with Dark Modern theme (brief flash)
2. Then switches to RiteMark's Default Light Modern theme

This creates a jarring dark flash on startup.

## Current Configuration

**Extension defaults:** `extensions/ritemark/package.json`

```json
"configurationDefaults": {
  "workbench.colorTheme": "Default Light Modern",
  "workbench.preferredLightColorTheme": "Default Light Modern",
  "workbench.preferredDarkColorTheme": "Default Light Modern",
  "window.autoDetectColorScheme": false,
  // ...
}
```

These settings are correct but applied AFTER VS Code initializes.

## Root Cause

VS Code has a **hardcoded default theme** in its source code that loads during initialization, before extension configurations are applied.

**File:** `vscode/src/vs/workbench/services/themes/common/workbenchThemeService.ts`

Likely contains something like:

```typescript
const DEFAULT_THEME_ID = 'vs-dark'; // Dark Modern
```

This loads FIRST, then user/extension settings override it.

## Solution Options

### Option 1: Patch VS Code Theme Service (Most Effective)

Create a patch to change the hardcoded default:

**Target file:** `vscode/src/vs/workbench/services/themes/common/workbenchThemeService.ts`

**Change:** Replace `'vs-dark'` with `'vs'` (Light Modern theme ID)

**Patch file:** `patches/vscode/010-default-light-theme.patch`

**Pros:**
- Fixes root cause
- No flash on any platform
- Clean solution

**Cons:**
- Requires finding exact location in VS Code source
- May conflict with upstream updates
- Need to verify theme IDs

### Option 2: Product.json Configuration (If Supported)

**File:** `branding/product.json`

Add (if VS Code supports it):

```json
{
  "nameShort": "Ritemark",
  // ... existing config ...
  "defaultTheme": "vs",  // or "Default Light Modern"
  "defaultLightTheme": "vs",
  "defaultDarkTheme": "vs"
}
```

**Pros:** Simple, no patch
**Cons:** Might not be a real VS Code setting (need to verify)

### Option 3: Reduce Flash with CSS

Add a startup CSS override to make the flash less noticeable:

**File:** Create patch or product.json configuration
**Approach:** Set initial background color to light (not dark)

**Pros:** Minimal change
**Cons:** Doesn't eliminate flash, just makes it less jarring

### Option 4: Accept the Flash

Document as known issue and defer fix.

**Pros:** No work needed
**Cons:** Poor user experience

## Recommended Approach

**Try Option 1** (Patch VS Code):
1. Locate theme service file
2. Find hardcoded default theme ID
3. Create patch to change to light theme
4. Test on Windows and macOS

**Fallback to Option 3** if Option 1 is too complex:
1. Make flash less noticeable with CSS
2. Document as minor cosmetic issue

## Investigation Steps

1. Search vscode source for theme initialization:
   ```bash
   grep -r "vs-dark" vscode/src/vs/workbench/services/themes/
   ```

2. Find theme service configuration:
   - `workbenchThemeService.ts`
   - `themeService.common.ts`
   - Look for `DEFAULT_THEME` or similar constant

3. Check VS Code theme IDs:
   - Dark Modern: `vs-dark`
   - Light Modern: `vs`
   - High Contrast Dark: `hc-black`
   - High Contrast Light: `hc-light`

4. Create patch to change default

## Testing

1. Apply patch
2. Build app
3. Launch app with clean state (delete user data folder)
4. Verify: App starts with light theme (no dark flash)
5. Test theme switching still works
6. Test on both Windows and macOS

## Complexity

**Medium-Hard** - Requires:
- Understanding VS Code theme system
- Locating hardcoded defaults in large codebase
- Creating patch that won't break theme functionality
- Testing on multiple platforms
- Verifying doesn't affect user theme preferences

## Related Files

- Theme service: `vscode/src/vs/workbench/services/themes/`
- Default settings: `vscode/src/vs/workbench/common/configuration.ts`
- Product config: `vscode/src/vs/platform/product/common/product.ts`

## Patch Strategy

If creating a patch:

```bash
# 1. Make change in vscode/
cd vscode
git diff > ../patches/vscode/010-default-light-theme.patch

# 2. Test patch applies cleanly
cd ..
./scripts/apply-patches.sh --dry-run

# 3. Commit patch
git add patches/vscode/010-default-light-theme.patch
git commit -m "patch: set default theme to light"
```
