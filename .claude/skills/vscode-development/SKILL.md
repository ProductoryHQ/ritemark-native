---
name: vscode-development
description: VS Code OSS development knowledge - building from source, extension development, debugging, testing. Use when working with VS Code forks, building VS Code, developing extensions, or troubleshooting VS Code build issues.
allowed-tools: Read, Grep, Glob, Bash, WebFetch, WebSearch
metadata:
  version: 1.0.0
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

## Production Build (Ritemark Native)

The user-facing app is built with `./scripts/build-prod.sh`. Hard rules — diverging from these has cost full 25-minute builds:

```bash
# 1. From a normal checkout, audit and create the disposable RC worktree.
node ./scripts/worktree-hygiene.mjs --check
./scripts/create-release-worktree.sh

# 2. cd to the printed path. Preflight must see pristine exact-main source.
./scripts/release-preflight.sh

# 3. Build with the submodule-pinned arm64 Node. build-prod performs frozen
#    dependency installs, bundle rebuilds, patching, and provenance itself.
arch -arm64 /bin/zsh -c 'source ~/.nvm/nvm.sh && nvm use "$(cat vscode/.nvmrc)" && ./scripts/build-prod.sh 2>&1'
```

**Hard rules:**
- **NEVER** promote a development/old RC tree into a release. `vscode/` must be a physical pristine submodule in a new exact-main worktree.
- **NEVER** pre-apply patches, link another checkout's VS Code or `node_modules`, or reuse `VSCode-<target>` output. The production script owns materialization.
- **NEVER** sign/package an app without matching `ritemark-build-provenance.json`; signing and DMG scripts enforce this.
- `apply-patches.sh` records the exact derived VS Code diff. A later manual submodule edit invalidates that proof and blocks automatic worktree cleanup.
- **NEVER** use `| tail` or `| head` with build commands — output buffering hangs background mode.
- **NEVER** run `gulp vscode-darwin-arm64` directly — skips extension copy → broken app.
- **ALWAYS** use the `arch -arm64 /bin/zsh` wrapper and the version in `vscode/.nvmrc`.
- **ALWAYS** run as background task with `run_in_background: true` and `timeout: 600000` (10 min cap).
- **Extension-only changes** (no VS Code core edits) skip full rebuild:

  ```bash
  cp -R extensions/ritemark/out/* "VSCode-darwin-arm64/Ritemark Native.app/Contents/Resources/app/extensions/ritemark/out/"
  ```

For the release sequence (sign, DMG, notarize, GitHub Release), see the `release` skill.

## Extension host build — esbuild bundled (Sprint 92, #105)

The extension host is **esbuild-bundled**, not the old ~130 loose `out/*.js` tree (that was the root cause of the Windows EMFILE class, the v1.7.1 0-byte-tsc trap, and DMG bloat — all now resolved).

- `npm run compile` = `tsc --noEmit -p ./` (type-check only) **then** `node esbuild.config.mjs` (emit). Type errors still fail the build; esbuild strips types without checking.
- Output is **two** self-contained bundles: `out/extension.js` (package.json `main`; first-party code + inlined pure-JS deps) and `out/browser/browserMcpAdapter.js` (a standalone Node subprocess spawned by `BrowserToolsInjector` — its own entry point because a child process can't `require()` code loaded in the host).
- `external` (NOT inlined; stay in `node_modules`): `vscode` (host), `fsevents` (native, macOS-only), `pdfkit` (loads its own font data at runtime), and — invisibly, because they're loaded via `new Function('return import(...)')` — the two ESM agent SDKs `@anthropic-ai/claude-agent-sdk` and `@agentclientprotocol/sdk`. So `node_modules` is retained but its footprint is largely inlined away.
- `npm run watch` runs esbuild in watch mode (fast rebuilds). Run `tsc --noEmit --watch` separately if you want live type-checking during watch.

### ⚠️ Bundle-safe extension code (rule — applies to ALL future extension-host code)

Because the host is one flat bundle, new code must not reintroduce the layout assumptions bundling breaks:

1. **No `__dirname`-depth path math.** Do not compute paths assuming a module's directory depth under `out/` (the whole host is now `out/extension.js`). Derive the extension root from a bundle-independent source — prefer `context.extensionPath` / `vscode.extensions.getExtension('ritemark.ritemark')?.extensionPath`. (Sprint 92 fixed two such landmines: `bundledAgentRuntime.ts`, `BrowserToolsInjector.ts`.)
2. **Native / runtime-asset / dynamically-`require()`d-by-path packages → esbuild `external`.** A new pure-JS dependency is auto-inlined; a package with a `.node` binary, a `binding.gyp`, or one that reads its own data files at runtime (like `pdfkit`) must be added to the `external` list in `esbuild.config.mjs` instead.
3. **Separately-spawned processes need their own esbuild entry point.** Code launched as its own OS process (like `browserMcpAdapter`) cannot live in the main bundle — add it as a second entry point.

(This rule + the build description above are mirrored to the Codex canon by the scheduled `harness-equalizer` — do not hand-edit `.codex/**` / `AGENTS.md`.)

## Node Versions

| Context | Required | Why |
|---|---|---|
| Production builds | arm64 Node pinned by `vscode/.nvmrc` | Clean build and CI must use the submodule-owned toolchain version, not a machine default |
| Dev mode (`./vscode/scripts/code.sh`) | Node v22.21.1 arm64 (`nvm use` at repo root) | Matches the repo-root development pin. Node 22+ has native `.ts` loading which VS Code's build scripts (`build/lib/preLaunch.ts`) need. Node 20 fails with `ERR_UNKNOWN_FILE_EXTENSION` |
| Webview Vite build | Node v20 (uses compiled rollup) | OK |

Repo root `.nvmrc` pins 22.21.1. `nvm use` from repo root picks it up automatically. x64/Rosetta Node fails all builds (missing arm64 native binaries).

Simple dev launch:

```bash
source "$HOME/.nvm/nvm.sh" && nvm use && ./vscode/scripts/code.sh
```

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

## Gotchas

Hard-won lessons. Each one cost real time at least once.

### `navigator.clipboard` is blocked in VS Code webview sandbox

`navigator.clipboard.writeText/readText` fails silently in VS Code's sandboxed webview iframe — no error shown, nothing happens. **Never use `navigator.clipboard` directly in webview code.**

Use the shared utility instead:

```typescript
import { writeClipboard, readClipboard } from '../lib/clipboard'

// Write
writeClipboard(text)

// Read (Promise)
const text = await readClipboard()
```

`writeClipboard` sends a `copyToClipboard` message to the extension host, which calls `vscode.env.clipboard.writeText`. `readClipboard` sends `readClipboard` and waits for a `clipboardText` response message. Both handlers live in `ritemarkEditor.ts`.

### `ELECTRON_RUN_AS_NODE` breaks dev launch

Claude Code sets `ELECTRON_RUN_AS_NODE=1` in its shell. This makes Electron run as plain Node — `import { Menu } from 'electron'` then fails. Always unset before launching dev mode:

```bash
arch -arm64 /bin/zsh -c 'unset ELECTRON_RUN_AS_NODE && source "$HOME/.nvm/nvm.sh" && nvm use && VSCODE_SKIP_PRELAUNCH=1 ./vscode/scripts/code.sh'
```

### Dev mode serves from `out/`, not `src/`

`./scripts/code.sh` reads from `out/`. Rebuild the bundle with `npm run compile` (or `npm run watch` for esbuild watch mode — Sprint 92; it's no longer `tsc -watch`), **but CSS and static assets do NOT auto-copy.** After editing CSS or fonts, manually `cp` to `out/`. `CSSDevelopmentService` ripgreps `out/` at startup to build the import map. Cmd+R reloads CSS *content*; full restart needed for *new* CSS files.

For production: register `.woff2` in esbuild loader + resource globs in gulpfile.

### Theme `settingsId` ≠ label

Theme `settingsId` comes from `theme.id` in package.json contribution — not the human label. Ritemark Light: `settingsId` = `"ritemark-light"`, label = `"Ritemark Light"`. Always reference the settingsId.

`findThemeBySettingsId()` does exact match. VS Code theme default is set at three levels: bootstrap (`themeMainService.ts` + `workbench.js`), `workbenchThemeService.ts` placeholder, `themeConfiguration.ts` defaults. Desktop hardcodes `ColorScheme.DARK` and `'vs-dark'` as fallbacks — patched to `'vs'`/`ColorScheme.LIGHT` in patch 001.

### React PDF — memoize file data

Inline `<Document file={{ data: pdfData.slice(0) }}>` re-inits the doc every render → scroll jumps to top. Memoize:

```ts
const fileData = useMemo(() => ({ data: pdfData.slice(0) }), [pdfData])
```

Use `IntersectionObserver` + fixed-size containers for lazy page rendering (not scroll-position math). Once a page loads, keep it rendered (`hasLoaded` flag). The `URL.parse is not a function` warning from pdfjs-dist is harmless — Electron Chromium too old; ignore.

### VS Code patches — unused imports = build fail (after 22 min)

When commenting out code in patches, **always remove unused imports**. VS Code build is strict: "declared but never read" = build error. Also remove dead methods (cascading unused references fail too). DI constructor params no longer used: change `private readonly foo` → `_foo`.

### VS Code patches — file path matters

Files in `browser/media/` are NOT copied to production builds. Files in `common/media/` ARE. When referencing assets via `FileAccess.asBrowserUri()`, use `common/media/`.

See: `.claude/skills/vscode-development/PATCH-RULES.md` for the full patching contract.

### VS Code 1.117 upgrade pitfalls

Three runtime crashes appeared only in prod bundle (dev mode unaffected): `onboardingVariationA` assertDefined, `ChatSetupContribution` activity-bar leak, `builtInExtensionsEnabledWithAutoUpdates` required field — plus newly-bundled `copilot`/`mermaid-chat-features` built-in extensions. Patched in v1.6.1 commit `275da52` + patch 007.

### Native module arch check after submodule bump

**Default-drift scan (mandatory on every upstream bump, added 2026-08-05):** upstream changes workbench SETTING DEFAULTS silently — e.g. `workbench.secondarySideBar.showLabels` flipped the aux-bar tabs from icons to text and surfaced only on FRESH profiles at release-candidate stage. After any bump: `git -C vscode diff <old>..<new> -- src/vs/workbench/browser/workbench.contribution.ts` and review every new/changed `'default':` that touches visible chrome; pin anything Ritemark's look depends on in `branding/product.json` `configurationDefaults` (live on desktop via patch 013). The shell's appearance must never ride an unpinned upstream default. Also test chrome on a FRESH `--user-data-dir` — seasoned profiles can mask default changes.

After `update-vscode.sh`, verify `vscode/node_modules` doesn't carry stale x86_64 native modules (GH #39) and `out/` of html/css/json language-features isn't stale CJS post-ESM-flip (GH #41). `update-vscode.sh` + `check-native-modules.sh` enforce this since 2026-05-02.

## References

- [VS Code Contribution Guide](https://github.com/microsoft/vscode/wiki/How-to-Contribute)
- [Extension API Docs](https://code.visualstudio.com/api)
- [Testing Extensions](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [VS Code OSS Repo](https://github.com/microsoft/vscode)
- Patch rules: `.claude/skills/vscode-development/PATCH-RULES.md`
- Troubleshooting: `.claude/skills/vscode-development/TROUBLESHOOTING.md`
