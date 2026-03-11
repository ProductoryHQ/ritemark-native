# Development Guide

How to set up a development environment for Ritemark Native.

## Prerequisites

- **Node.js 22.21.1** (match `vscode/.nvmrc`, use [nvm](https://github.com/nvm-sh/nvm))
- **Yarn 1.x**
- **Python 3.x** (required by VS Code build)
- **macOS** (primary development platform)

## Quick Start

```bash
# 1. Clone the repository
git clone --recurse-submodules https://github.com/jarmo-productory/ritemark-native.git
cd ritemark-native

# 2. Apply VS Code patches
./scripts/apply-patches.sh

# 3. Install VS Code dependencies
cd vscode && yarn && cd ..

# 4. Install extension dependencies
cd extensions/ritemark && npm install && cd ../..

# 5. Build the webview bundle
cd extensions/ritemark/webview && npm install && npm run build && cd ../../..

# 6. Compile the extension
cd extensions/ritemark && npx tsc && cd ../..

# 7. Run in development mode
./scripts/code.sh
```

## Repository Structure

```
ritemark-native/
├── vscode/                      # VS Code OSS submodule (patches applied here)
│   └── extensions/ritemark/     # SYMLINK to ../../extensions/ritemark
├── extensions/ritemark/         # Ritemark extension source (edit here!)
│   ├── src/                     # TypeScript source
│   ├── out/                     # Compiled JS
│   ├── webview/                 # React webview (TipTap editor)
│   └── media/                   # webview.js bundle
├── patches/vscode/              # VS Code customization patches
├── branding/                    # Icons, logos, product.json
├── scripts/                     # Build and release scripts
└── docs/                        # Documentation
```

## Key Concepts

### Extension Symlink

The extension source lives at `extensions/ritemark/` but VS Code expects it at `vscode/extensions/ritemark/`. A symlink connects them. Always edit files in `extensions/ritemark/`, never in `vscode/extensions/ritemark/`.

### Patch System

We customize VS Code via patch files, not direct edits to the submodule. See [Patch System](patch-system.md) for details.

| Command | Purpose |
|---------|---------|
| `./scripts/apply-patches.sh` | Apply all patches |
| `./scripts/apply-patches.sh --dry-run` | Check patch status |
| `./scripts/create-patch.sh "name"` | Create new patch |
| `./scripts/apply-patches.sh --reverse` | Remove patches |

### Webview Architecture

The editor is a React application using TipTap, bundled with Vite into `media/webview.js`. The extension loads this bundle into a VS Code webview panel.

```
Extension (TypeScript) <--messages--> Webview (React + TipTap)
```

## Building for Production

```bash
# macOS (Apple Silicon)
./scripts/build-prod.sh

# Output: VSCode-darwin-arm64/Ritemark Native.app
```

See [Building Installers](building.md) for DMG/Windows builds.

## Further Reading

- [Building Installers](building.md) — DMG and Windows builds
- [Windows Installer](building-windows-installer.md) — Inno Setup on Windows
- [Patch System](patch-system.md) — How VS Code patches work
- [Menu Customization](menu-customization.md) — Menu item changes
- [Style Guide](style-guide.md) — Content style conventions
