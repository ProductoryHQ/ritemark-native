# Development Environment Breakdown Analysis

**Date:** December 6, 2024
**Issue:** Dev mode extension not activating after production build success
**Status:** Root cause identified, solutions proposed

---

## Executive Summary

The development environment broke due to a **symlink being replaced with a static copy**. The production build succeeded because it uses the frozen copy, but dev mode stopped working because it's running an outdated version of the extension.

---

## Part 1: What Allowed Production to Work

### 1.1 Architecture Mismatch Resolution

**Problem:** Native Node modules compiled for x86_64 but running on arm64 (Apple Silicon)

**Symptoms:**
- `dlopen: mach-o file, but is an incompatible architecture (have 'x86_64', need 'arm64')`
- Production build failing during packaging

**Root Cause:** Node.js was running under Rosetta emulation, causing all native modules to compile for wrong architecture.

**Fix Applied:**
```bash
# Switch to arm64 Node
nvm install 22.14.0 --default
nvm use 22.14.0

# Verify architecture
node -p "process.arch"  # Must show "arm64"

# Clean and reinstall all node_modules
cd vscode
rm -rf node_modules build/node_modules remote/node_modules extensions/node_modules
yarn install

# Rebuild production
yarn gulp vscode-darwin-arm64
```

### 1.2 Webview Rendering Fix

**Problem:** RiteMark editor showing blank white area

**Symptoms:**
- webview.js was ~64KB (should be ~900KB)
- Vite build silently failing

**Root Cause:** Corrupted `node_modules` in `extensions/ritemark/webview/` folder. All files were 0 bytes.

**Fix Applied:**
```bash
cd extensions/ritemark/webview
rm -rf node_modules package-lock.json
npm install
npm run build

# Verify size
ls -la ../media/webview.js  # Should be ~900KB

# Copy to production app
cp ../media/webview.js \
   "../../VSCode-darwin-arm64/RiteMark Native.app/Contents/Resources/app/extensions/ritemark/media/"
```

### 1.3 Production Build Configuration

**Key file:** `vscode/product.json` must contain:
```json
{
  "extensionKind": {
    "vscode.debug-auto-launch": ["ui"],
    "vscode.debug-server-ready": ["ui"]
  },
  "builtInExtensions": []
}
```

Without `builtInExtensions: []`, the gulp build fails with:
```
TypeError: Cannot read properties of undefined (reading 'filter')
```

---

## Part 2: Why Development Environment Broke

### 2.1 The Symlink Problem

**Discovery:** In the vscode submodule, `extensions/ritemark` was originally a **symlink**:

```bash
# Git shows mode 120000 = symlink
git ls-tree HEAD extensions/ | grep ritemark
# Output: 120000 blob 01e502f... extensions/ritemark

# The symlink pointed to:
git cat-file -p 01e502f44f98af63696d0307f6c05d512cf8269b
# Output: /Users/jarmotuisk/Projects/ritemark-native/extensions/ritemark
```

**Current State:** The symlink has been **replaced with a directory** (a static copy):

```bash
file vscode/extensions/ritemark
# Output: directory (NOT symlink!)

# The copy is from Dec 5, while source was updated Dec 6
ls -la extensions/ritemark/out/extension.js        # Dec 6 10:46
ls -la vscode/extensions/ritemark/out/extension.js # Dec 5 16:42
```

### 2.2 How This Happened

The symlink was likely replaced during one of these operations:

1. **`setup.sh` script** uses `cp -r` to copy the extension:
   ```bash
   cp -r "$ROOT_DIR/extensions/ritemark" "$ROOT_DIR/vscode/extensions/"
   ```
   If the symlink already existed, `cp -r` would replace it with a directory copy.

2. **Production build** (`yarn gulp vscode-darwin-arm64`) may have replaced the symlink when packaging extensions.

3. **Manual operations** during troubleshooting (cleaning node_modules, rebuilding) may have inadvertently replaced the symlink.

### 2.3 Impact

| Environment | Extension Used | Status |
|-------------|---------------|--------|
| Dev (`./scripts/code.sh`) | `vscode/extensions/ritemark/` (stale copy) | **BROKEN** |
| Production (`.app`) | Bundled copy | Working |

The dev environment is running an **old version** of the extension from Dec 5, which lacks recent fixes and may have different dependencies.

---

## Part 3: Recommended Development Workflow

### Option A: Restore Symlink Approach (Recommended)

**Pros:**
- Changes to source extension immediately available in dev
- Single source of truth
- Matches original project design

**Cons:**
- Absolute path in symlink is machine-specific
- Need to be careful with `cp`, `git clean`, etc.

**Implementation:**
```bash
# Remove the stale copy
rm -rf vscode/extensions/ritemark

# Create symlink (relative path is better)
cd vscode/extensions
ln -s ../../extensions/ritemark ritemark

# Verify
ls -la ritemark  # Should show -> ../../extensions/ritemark
```

### Option B: Manual Sync Script

**Pros:**
- More explicit control
- Works across different machines

**Cons:**
- Need to remember to sync after changes

**Implementation:**
```bash
# scripts/sync-extension.sh
#!/bin/bash
rsync -av --delete \
  extensions/ritemark/ \
  vscode/extensions/ritemark/ \
  --exclude node_modules
```

### Option C: Unified Extension Location

**Pros:**
- Eliminates duplication entirely
- Simplest mental model

**Cons:**
- Requires restructuring project
- May complicate production builds

**Implementation:**
Move extension to `vscode/extensions/ritemark/` and remove `extensions/` from project root entirely.

---

## Part 4: Immediate Fix

To restore dev environment now:

```bash
cd /Users/jarmotuisk/Projects/ritemark-native

# 1. Remove stale copy
rm -rf vscode/extensions/ritemark

# 2. Create relative symlink
cd vscode/extensions
ln -s ../../extensions/ritemark ritemark

# 3. Rebuild extension (if needed)
cd ../../extensions/ritemark
npm run compile

# 4. Rebuild webview
cd webview
npm run build

# 5. Run dev
cd ../../../vscode
./scripts/code.sh
```

---

## Part 4.1: Dev Electron Architecture Fix (Additional Issue Discovered)

**Problem:** After restoring the symlink, dev mode still failed with a different architecture error:
```
dlopen: mach-o file, but is an incompatible architecture (have 'arm64', need 'x86_64')
```

**Root Cause:** The `.build/electron/` directory contained an **x86_64** Electron binary (downloaded when using x64 Node), but `node_modules` contained **arm64** native modules (compiled when using arm64 Node for production).

**Discovery:**
```bash
# The dev Electron was x86_64
file vscode/.build/electron/RiteMark\ Native.app/Contents/MacOS/Electron
# Output: Mach-O 64-bit executable x86_64

# But native modules were arm64
file vscode/node_modules/@vscode/spdlog/build/Release/spdlog.node
# Output: Mach-O 64-bit bundle arm64
```

**Fix Applied:**
```bash
# Delete the x86_64 Electron
rm -rf vscode/.build/electron

# Run code.sh using arm64 Node
export PATH="/Users/jarmotuisk/.nvm/versions/node/v22.14.0/bin:$PATH"
node -p "process.arch"  # Must show "arm64"
cd vscode && ./scripts/code.sh
```

This causes VS Code to re-download the arm64 Electron binary matching the architecture of the native modules.

**Important:** The Electron binary architecture is determined by `process.arch` at the time `build/lib/electron.js` runs. Both the Electron binary AND the native modules must be the same architecture.

---

## Part 5: Lessons Learned

### 5.1 Development Environment Hygiene

1. **Document symlink dependencies** - Add to README/CLAUDE.md
2. **Add validation to scripts** - Check symlink integrity before operations
3. **Separate dev and prod workflows clearly**

### 5.2 Production Build Process

1. **Architecture matters** - Always verify `node -p "process.arch"` on Apple Silicon
2. **Clean builds are essential** - When native modules fail, full clean is required
3. **Webview builds can fail silently** - Always verify output file sizes

### 5.3 Script Improvements

The `setup.sh` script should:
1. Create symlink instead of copying
2. Verify symlink integrity
3. Skip copy if symlink already exists

---

## Appendix: Key File Locations

| Component | Location | Notes |
|-----------|----------|-------|
| Extension Source | `extensions/ritemark/` | Source of truth |
| Extension in VSCode | `vscode/extensions/ritemark/` | Should be symlink |
| Webview Source | `extensions/ritemark/webview/` | React + Vite |
| Webview Bundle | `extensions/ritemark/media/webview.js` | ~900KB when built correctly |
| Production App | `VSCode-darwin-arm64/RiteMark Native.app/` | Standalone build |
| Dev App | `vscode/.build/electron/` | Development build |

---

## Related Documentation

- `.claude/skills/vscode-development/TROUBLESHOOTING.md` - Build troubleshooting
- `docs/sprints/sprint-04-core-polish/` - Sprint 04 documentation
