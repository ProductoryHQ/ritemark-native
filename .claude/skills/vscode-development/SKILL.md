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
- Working with VS Code forks (like RiteMark Native)
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

**macOS (our target: darwin-arm64)**
```bash
xcode-select --install  # Command Line Tools
```

**Windows**
- Visual Studio Build Tools with "Desktop Development with C++"

**Linux**
```bash
apt install build-essential g++ libx11-dev libxkbfile-dev libsecret-1-dev
```

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
