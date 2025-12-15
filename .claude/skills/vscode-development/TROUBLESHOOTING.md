# VS Code Development Troubleshooting

Quick solutions to common issues.

## RiteMark Native Specific Issues

### Issue: Broken extension symlink (MOST COMMON!)

**Symptoms:**
- Extension not activating
- Blank webview / editor
- "Activating Extensions..." hangs forever
- Changes to extension code not taking effect

**Diagnosis:**
```bash
ls -la vscode/extensions/ritemark
```
- **Good:** `ritemark -> ../../extensions/ritemark` (symlink)
- **Bad:** Shows directory contents (real folder, not symlink)

**Root Cause:** Git operations, clean commands, or manual changes replaced the symlink with a real directory containing stale code.

**Solution:**
```bash
# Remove the stale directory and recreate symlink
rm -rf vscode/extensions/ritemark
ln -s ../../extensions/ritemark vscode/extensions/ritemark

# Verify
ls -la vscode/extensions/ritemark  # Should show -> ../../extensions/ritemark

# Restart dev mode
cd vscode && ./scripts/code.sh
```

**Prevention:** After any git clean or submodule operation, always check the symlink.

---

### Issue: macOS Quarantine forces Rosetta (SNEAKY!)

**Symptoms:**
- `dlopen: mach-o file, but is an incompatible architecture (have 'arm64', need 'x86_64')`
- Everything IS arm64 but still fails with architecture error
- Error says modules "have arm64" but process "needs x86_64"

**Root Cause:** macOS quarantine attribute on downloaded Electron forces Rosetta emulation even for arm64 binaries.

**Diagnosis:**
```bash
xattr -l vscode/.build/electron/*.app | grep quarantine
```

**Solution:**
```bash
xattr -cr vscode/.build/electron/RiteMark.app
```

Then restart dev mode.

---

### Issue: Architecture mismatch (x86_64 vs arm64)

**Symptoms:**
- `dlopen: mach-o file, but is an incompatible architecture (have 'x86_64', need 'arm64')`
- Native modules fail to load

**Diagnosis:**
```bash
node -p "process.arch"  # Must be "arm64"
file $(which node)      # Check Node binary
file vscode/node_modules/@vscode/spdlog/build/Release/spdlog.node
```

**Root Cause:** Node.js running under Rosetta (x86_64) compiled native modules for wrong architecture.

**Solution:**
```bash
# Switch to arm64 Node
nvm install 22.14.0 --default
nvm use 22.14.0

# Verify
node -p "process.arch"  # Must show "arm64"

# Clean and reinstall
cd vscode
rm -rf node_modules build/node_modules remote/node_modules extensions/node_modules
yarn install

# Rebuild production
yarn gulp vscode-darwin-arm64
```

### Issue: Webview not rendering (blank RiteMark editor)

**Symptoms:**
- App launches, extension activates
- Markdown files show blank editor area
- webview.js is ~64KB (should be ~900KB)

**Diagnosis:**
```bash
# Check webview.js size
ls -la extensions/ritemark/media/webview.js  # Should be ~900KB

# Check for 0-byte files (corrupted node_modules)
ls -la extensions/ritemark/webview/node_modules/.bin/
```

**Root Cause:** Corrupted node_modules in webview folder. Vite silently fails producing truncated output.

**Solution:**
```bash
cd extensions/ritemark/webview
rm -rf node_modules package-lock.json
npm install
npm run build

# Verify
ls -la ../media/webview.js  # Should be ~900KB

# Copy to production if needed
cp ../media/webview.js \
   "../../VSCode-darwin-arm64/RiteMark Native.app/Contents/Resources/app/extensions/ritemark/media/"
```

### Issue: Production build fails at packaging

**Symptoms:**
- `TypeError: Cannot read properties of undefined (reading 'filter')`
- Error at gulpfile.vscode.js:307

**Root Cause:** Missing `builtInExtensions` in product.json.

**Solution:** Ensure `vscode/product.json` contains:
```json
{
  "extensionKind": {
    "vscode.debug-auto-launch": ["ui"],
    "vscode.debug-server-ready": ["ui"]
  },
  "builtInExtensions": []
}
```

### RiteMark Build Commands

```bash
# Development mode
cd vscode && ./scripts/code.sh

# Production build (~25 min)
cd vscode && yarn gulp vscode-darwin-arm64

# Build webview only
cd extensions/ritemark/webview && npm run build

# Launch production app
open "VSCode-darwin-arm64/RiteMark Native.app"
```

## Build Issues

### Issue: npm install fails with node-gyp errors

**Symptoms:**
- `gyp ERR! build error`
- Native module compilation failures

**Solutions:**
1. Check Node version matches `.nvmrc`:
   ```bash
   nvm use
   ```

2. macOS - Ensure Xcode CLI:
   ```bash
   xcode-select --install
   ```

3. Clean and retry:
   ```bash
   git clean -xfd
   npm install
   ```

4. Debug node-gyp (macOS):
   ```bash
   export CXX="c++ -v"
   npm install
   ```

### Issue: "Finished compilation" never appears

**Symptoms:**
- Watch build hangs
- No output after initial compile

**Solutions:**
1. Check for TypeScript errors:
   ```bash
   npm run compile  # See all errors
   ```

2. Check disk space and memory (need 6GB+ RAM)

3. Kill and restart watch:
   ```bash
   # Ctrl+C the watch
   npm run watch
   ```

### Issue: Changes not appearing after rebuild

**Solutions:**
1. Wait for "Finished compilation" message
2. Use Reload Window (Cmd+Shift+P > "Reload Window")
3. NOT: Close and reopen VS Code

### Issue: git clean -xfd doesn't help

**Solutions:**
1. Check submodule state:
   ```bash
   git submodule update --init --recursive
   ```

2. Verify Node version:
   ```bash
   node -v  # Should match .nvmrc
   ```

3. Check for global npm conflicts:
   ```bash
   npm list -g --depth=0
   ```

## Extension Issues

### Issue: Extension doesn't activate

**Symptoms:**
- Extension shows in list but doesn't work
- No errors in console

**Diagnosis:**
1. Check Output > Extension Host
2. Verify activation events in package.json
3. Check main entry point exists

**Solutions:**
1. Add catch-all activation (temporary debugging):
   ```json
   "activationEvents": ["*"]
   ```

2. Check file exists at main path:
   ```bash
   ls -la extensions/<name>/out/
   ```

### Issue: Webview blank/not loading

**Symptoms:**
- Webview shows empty white panel
- Console errors about content security

**Solutions:**
1. Check webview HTML uses proper CSP:
   ```html
   <meta http-equiv="Content-Security-Policy"
         content="default-src 'none';
                  style-src ${webview.cspSource};
                  script-src ${webview.cspSource};">
   ```

2. Verify asset URIs use `webview.asWebviewUri()`

3. Check browser console in webview:
   - Open Developer Tools
   - Look for the webview iframe

### Issue: Extension works in dev, fails in production

**Symptoms:**
- Works with F5 debug
- Fails when installed/bundled

**Solutions:**
1. Check all imports are in dependencies (not devDependencies)

2. Verify bundling includes all files:
   ```json
   // package.json
   "files": ["out", "media", "webview/dist"]
   ```

3. Check relative paths work from bundle location

## Debugging Issues

### Issue: Breakpoints not hitting

**Solutions:**
1. Ensure source maps enabled:
   ```json
   // tsconfig.json
   "sourceMap": true
   ```

2. Rebuild after tsconfig change:
   ```bash
   npm run compile
   ```

3. Check launch.json outFiles path matches output

### Issue: "Attach to Extension Host" fails

**Solutions:**
1. Ensure extension host is running (have an extension active)

2. Check debug port not in use:
   ```bash
   lsof -i :9229
   ```

### Issue: Can't debug webview

**Solutions:**
1. Use Developer Tools in the webview:
   - Right-click webview > "Inspect"
   - Or: Cmd+Shift+P > "Developer: Open Webview Developer Tools"

2. Add debug logging in webview code:
   ```javascript
   console.log('Debug:', data);
   ```

## Performance Issues

### Issue: Build is very slow

**Solutions:**
1. Use incremental build:
   ```bash
   npm run watch  # Not npm run compile
   ```

2. Close other heavy applications

3. Increase Node memory if needed:
   ```bash
   export NODE_OPTIONS="--max-old-space-size=8192"
   ```

### Issue: Extension Host memory leak

**Symptoms:**
- VS Code gets slower over time
- High memory usage

**Solutions:**
1. Dispose resources properly:
   ```typescript
   context.subscriptions.push(disposable);
   ```

2. Clear event listeners:
   ```typescript
   deactivate() {
     // Cleanup here
   }
   ```

## Testing Issues

### Issue: Tests fail with "VS Code instance already running"

**Solution:**
Use VS Code Insiders for development, Stable for testing:
```bash
code-insiders .  # Develop here
npm test         # Tests use Stable
```

### Issue: Tests timeout

**Solutions:**
1. Increase timeout in test config:
   ```javascript
   this.timeout(10000);
   ```

2. Ensure test waits for async operations:
   ```typescript
   await vscode.commands.executeCommand('...');
   ```

## Quick Recovery Checklist

When everything is broken:

```bash
# 1. Clean everything
git clean -xfd
git submodule foreach git clean -xfd

# 2. Reset submodules
git submodule update --init --recursive

# 3. Check Node version
nvm use  # or nvm install

# 4. Fresh install
npm install

# 5. Full rebuild
npm run compile

# 6. If still failing, check:
node -v          # Correct version?
python --version # Available?
xcode-select -p  # macOS: tools installed?
```
