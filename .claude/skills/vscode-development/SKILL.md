---
name: vscode-development
description: VS Code OSS development knowledge - building from source, extension development, debugging, testing. Use when working with VS Code forks, building VS Code, developing extensions, or troubleshooting VS Code build issues.
version: 1.0.0
allowed-tools: Read, Grep, Glob, Bash, WebFetch, WebSearch
---

# VS Code Development

Comprehensive knowledge for VS Code OSS development, building from source, and extension development.

## When to Use This Skill

- Building VS Code from source
- Developing VS Code extensions
- Troubleshooting build failures
- Setting up VS Code development environment
- Working with VS Code forks (like Ritemark Native)
- Understanding VS Code architecture

## Quick Reference

### Essential Commands

```bash
# Initial setup
git clone --recursive <repo>
npm install

# Watch build (incremental)
npm run watch

# Run development instance
./scripts/code.sh          # macOS/Linux
.\scripts\code.bat         # Windows

# Run web version
./scripts/code-web.sh

# Run tests
./scripts/test.sh          # Unit tests
npm run eslint             # Linting

# Clean rebuild (when stuck)
git clean -xfd && npm install
```

### Development Cycle
1. Make changes
2. Wait for "Finished compilation" in watch output
3. Reload Window (Cmd+R) - NOT restart app
4. Test changes

## Build Environment Requirements

### Prerequisites

| Component | Requirement |
|-----------|-------------|
| Node.js | v20.x+ (check .nvmrc) |
| Python | Required for node-gyp |
| Git | Latest |

### Platform-Specific

**macOS (targets: darwin-arm64 AND darwin-x64)**
```bash
xcode-select --install  # Command Line Tools
```

**Windows**
- Visual Studio Build Tools with "Desktop Development with C++"

**Linux**
```bash
apt install build-essential g++ libx11-dev libxkbfile-dev libsecret-1-dev
```

## Multi-Platform Production Builds

VS Code supports building for multiple platforms from a single host.

### Supported Build Targets

| Platform | Architecture | Gulp Task | Output Directory |
|----------|--------------|-----------|------------------|
| macOS Apple Silicon | darwin-arm64 | `vscode-darwin-arm64-min` | `VSCode-darwin-arm64/` |
| macOS Intel | darwin-x64 | `vscode-darwin-x64-min` | `VSCode-darwin-x64/` |
| Windows | win32-x64 | `vscode-win32-x64-min` | `VSCode-win32-x64/` |
| Linux | linux-x64 | `vscode-linux-x64-min` | `VSCode-linux-x64/` |

### Cross-Compilation Matrix

| Build Target | From macOS arm64 | From macOS x64 | From Windows | From Linux |
|--------------|------------------|----------------|--------------|------------|
| darwin-arm64 | ✅ Native | ✅ Works | ❌ No | ❌ No |
| darwin-x64 | ✅ Cross | ✅ Native | ❌ No | ❌ No |
| win32-x64 | ✅ Cross | ✅ Cross | ✅ Native | ✅ Cross |
| linux-x64 | ✅ Cross | ✅ Cross | ✅ Cross | ✅ Native |

**Key limitation:** macOS builds REQUIRE a macOS host (Electron framework requirement).

### Build Commands (Ritemark Native)

```bash
# Apple Silicon (default)
./scripts/build-prod.sh

# Intel Mac
./scripts/build-prod.sh darwin-x64

# Windows (via GitHub Actions, or locally with Wine)
./scripts/build-windows.sh
```

### Gulp Commands (Raw VS Code)

```bash
cd vscode

# Development builds (fast, with sourcemaps)
npm run gulp vscode-darwin-arm64
npm run gulp vscode-darwin-x64
npm run gulp vscode-win32-x64

# Production builds (minified, no sourcemaps)
npm run gulp vscode-darwin-arm64-min
npm run gulp vscode-darwin-x64-min
npm run gulp vscode-win32-x64-min
```

### Build Output Structure

```
VSCode-darwin-arm64/
└── Ritemark.app/
    └── Contents/
        ├── Info.plist
        ├── MacOS/Electron
        └── Resources/
            └── app/
                ├── product.json
                └── extensions/
                    └── ritemark/

VSCode-darwin-x64/
└── Ritemark.app/
    └── [same structure, x64 binaries]

VSCode-win32-x64/
├── Ritemark.exe
└── resources/
    └── app/
        ├── product.json
        └── extensions/
            └── ritemark/
```

### Post-Build Steps (macOS)

After gulp build completes, ALWAYS:

1. **Copy extension** to app bundle:
   ```bash
   cp -R extensions/ritemark VSCode-darwin-*/Ritemark.app/Contents/Resources/app/extensions/
   ```

2. **Update Info.plist version** (Finder displays this):
   ```bash
   /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString X.Y.Z" Ritemark.app/Contents/Info.plist
   ```

3. **Code sign** (required for distribution):
   ```bash
   codesign --deep --force --verify --sign "Developer ID Application: ..." Ritemark.app
   ```

4. **Create DMG**:
   ```bash
   ./scripts/create-dmg.sh        # arm64
   ./scripts/create-dmg.sh x64    # Intel
   ```

5. **Notarize DMG** (required for Gatekeeper):
   ```bash
   ./scripts/notarize-dmg.sh dist/Ritemark-X.Y.Z-darwin-arm64.dmg
   ./scripts/notarize-dmg.sh dist/Ritemark-X.Y.Z-darwin-x64.dmg
   ```

### Reference

- Analysis document: `docs/development/analysis/2026-02-03-multi-platform-build.md`
- Build script: `scripts/build-prod.sh`
- DMG creation: `scripts/create-dmg.sh`
- DMG notarization: `scripts/notarize-dmg.sh`

### Important Notes
- Clone to path WITHOUT spaces (node-gyp issues)
- Min 4 cores, 6GB RAM (8GB recommended) for full build
- Dev containers available in repo

## Extension Development

### Project Structure
```
extensions/<name>/
├── package.json        # Extension manifest
├── src/
│   └── extension.ts    # Entry point
├── webview/            # If using webviews
├── media/              # Static assets
└── tsconfig.json
```

### package.json Key Fields
```json
{
  "name": "extension-name",
  "displayName": "Display Name",
  "version": "0.0.1",
  "engines": { "vscode": "^1.74.0" },
  "activationEvents": ["onLanguage:markdown"],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [],
    "customEditors": [],
    "configuration": {}
  }
}
```

### Activation Events
- `onLanguage:<lang>` - When file of language opens
- `onCommand:<command>` - When command invoked
- `onView:<viewId>` - When view becomes visible
- `*` - Always active (avoid if possible)
- `onStartupFinished` - After VS Code startup

### Custom Editors (WebView)
```typescript
// Register provider
vscode.window.registerCustomEditorProvider(
  'myExtension.customEditor',
  new MyCustomEditorProvider(context),
  { webviewOptions: { retainContextWhenHidden: true } }
);
```

### Extension Testing
```bash
npm run test              # Run integration tests
```
- Tests run in Extension Development Host
- Use Mocha framework
- Can't run tests while VS Code Stable is open (use Insiders)

### Debugging Extensions
1. Open extension source
2. Press F5 (launches Extension Development Host)
3. Set breakpoints in source
4. Use "Attach to Extension Host" for running instance

## Debugging VS Code Itself

### Render Process
- F5 with "VS Code" launch config
- Or: `Developer: Toggle Developer Tools`

### Extension Host
- "Attach to Extension Host" debug config

### Search Process
- Start a search first (Ctrl+P)
- Then attach debugger (avoids timeout)

### Debug Logging (macOS)
```bash
export CXX="c++ -v"  # For node-gyp issues
```

## Common Build Issues

### "Cannot find module" Errors
```bash
git clean -xfd
npm install
npm run watch
```

### Native Module Failures
- Check Node version matches .nvmrc
- Ensure compiler toolchain installed
- macOS: `xcode-select --install`

### Watch Build Not Updating
- Check for TypeScript errors in terminal
- Verify "Finished compilation" message
- Try manual rebuild: Ctrl+Shift+B

### Extension Not Loading
1. Check activation events in package.json
2. Look at Output > Extension Host for errors
3. Verify main entry point path is correct

## VS Code Architecture

### Key Directories
```
src/
├── vs/
│   ├── base/           # Core utilities
│   ├── platform/       # Platform services
│   ├── editor/         # Monaco editor
│   ├── workbench/      # Workbench UI
│   └── code/           # Electron entry
extensions/             # Built-in extensions
```

### Process Model
- **Main Process**: Electron main (Node.js)
- **Renderer Process**: UI (Chromium)
- **Extension Host**: Extensions (separate Node process)
- **Shared Process**: Background services

### Customization Points (Forks)
- `product.json`: Branding, telemetry endpoints, marketplace
- `extensions/`: Built-in extensions
- `resources/`: Icons, splash screens

## VS Code OSS vs VS Code

| Aspect | Code OSS | VS Code |
|--------|----------|---------|
| License | MIT | Microsoft EULA |
| Marketplace | Not included | VS Marketplace |
| Telemetry | Optional | On by default |
| Branding | Generic | Microsoft |
| Some extensions | Limited | Full access |

### Marketplace Alternatives
- Open VSX Registry (open source)
- Manual .vsix installation
- Built-in extensions (our approach)

## Best Practices

### Extension Development
1. Use TypeScript (best tooling support)
2. Follow UX Guidelines from VS Code docs
3. Minimize activation events
4. Use webview sparingly (heavy)
5. Test with disabled extensions first

### Fork Maintenance
1. Use submodule (not fork) for easy upstream sync
2. Customize via product.json overrides
3. Add features as built-in extensions
4. Avoid modifying core VS Code source

### Build Workflow
1. Always run `npm run watch` during development
2. Wait for "Finished compilation" before testing
3. Use Reload Window, not restart
4. Clean rebuild when stuck

## References

- [VS Code Contribution Guide](https://github.com/microsoft/vscode/wiki/How-to-Contribute)
- [Extension API Docs](https://code.visualstudio.com/api)
- [Testing Extensions](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [VS Code OSS Repo](https://github.com/microsoft/vscode)
