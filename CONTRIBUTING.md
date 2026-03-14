# Contributing to Ritemark

Thank you for your interest in contributing to Ritemark! This guide will help you get set up and understand how the project is structured.

## Prerequisites

- **Node.js 20** (required — VS Code OSS does not build on newer versions)
- **Git** with submodule support
- **macOS** (primary development platform, Apple Silicon or Intel)
- **Python 3.11+** (required by VS Code's native module build)

Windows and Linux development is community-supported. The CI builds for these platforms, but day-to-day development is done on macOS.

## Getting Started

### 1. Clone the Repository

```bash
git clone --recurse-submodules https://github.com/jarmo-productory/ritemark-native.git
cd ritemark-native
```

If you already cloned without `--recurse-submodules`:

```bash
git submodule update --init --recursive
```

### 2. Apply Patches

Ritemark customizes VS Code via patch files (not direct edits to the submodule). After cloning:

```bash
./scripts/apply-patches.sh
```

Verify patches applied:

```bash
./scripts/apply-patches.sh --dry-run
# Should show all patches as "Already applied"
```

### 3. Install Dependencies

```bash
# VS Code dependencies
cd vscode
npm install

# Extension dependencies
cd extensions/ritemark
npm install --legacy-peer-deps

cd ../../..
```

### 4. Run Dev Mode

```bash
./scripts/build-mac.sh
```

This launches Ritemark in development mode. The first run takes longer as VS Code compiles.

## Project Structure

```
ritemark-native/
├── vscode/                      # VS Code OSS submodule (patches applied here)
│   └── extensions/ritemark/     # SYMLINK → ../../extensions/ritemark
├── extensions/ritemark/         # Ritemark extension (edit HERE)
│   ├── src/                     # TypeScript source
│   ├── out/                     # Compiled JS output
│   ├── webview/                 # React webview (TipTap editor)
│   └── media/                   # Bundled webview.js
├── patches/vscode/              # VS Code customization patches
├── branding/                    # Icons, logos, product.json
└── scripts/                     # Dev, build, and release scripts
```

**Key rule:** Always edit `extensions/ritemark/` — never edit `vscode/` directly. The symlink ensures VS Code sees your changes.

## Making Changes

### Extension Development

Most contributions will be to the Ritemark extension:

```bash
cd extensions/ritemark

# Edit TypeScript source in src/
# Then compile to check for errors:
npx tsc --noEmit
```

### Webview Development

The editor UI is a React app using TipTap, built with Vite:

```bash
cd extensions/ritemark/webview

# Install webview dependencies (first time only)
npm install

# Build the webview bundle
npm run build
```

The build output goes to `extensions/ritemark/media/webview.js`.

### VS Code Patches

If your change requires modifying VS Code itself (rare for most contributors):

```bash
# Make your changes in vscode/
# Then create a patch:
./scripts/create-patch.sh "description-of-change"
```

Patches live in `patches/vscode/` and are numbered sequentially.

## Before Submitting

### Compile Check

```bash
cd extensions/ritemark && npx tsc --noEmit
```

This must pass with no errors.

### Patch Check

```bash
./scripts/apply-patches.sh --dry-run
```

All patches must show as "Already applied".

### Sign Your Commits (DCO)

We use the [Developer Certificate of Origin](https://developercertificate.org/) (DCO). Sign off your commits:

```bash
git commit -s -m "Your commit message"
```

This adds a `Signed-off-by: Your Name <email>` line confirming you have the right to submit the code.

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-change`)
3. Make your changes
4. Ensure compile check passes
5. Commit with DCO sign-off
6. Push to your fork and open a PR

PRs are reviewed by the maintainer. The CI will automatically run a TypeScript compile check and patch validation.

## What We Merge

- Bug fixes with clear reproduction steps
- Documentation improvements
- New file format support following existing patterns
- UI/UX improvements that maintain simplicity
- Performance improvements

## What We Won't Merge

- **Telemetry or tracking** — Ritemark is privacy-first, no exceptions
- **Cloud dependencies** — The app must work fully offline
- **Breaking local-first** — User files stay on the user's machine
- **Large refactors without prior discussion** — Open an issue first
- **Changes to branding** — Logos, names, and icons are trademarked (see `TRADEMARK.md`)

## AI-Assisted Development

This project uses Claude Code for development. The `.claude/` directory contains agent configurations and skills that power the development workflow. These files are part of the project infrastructure — you don't need to modify them for typical contributions.

## Getting Help

- **GitHub Issues** — Bug reports and feature requests
- **GitHub Discussions** — Questions, ideas, and general conversation

## License

By contributing, you agree that your contributions will be licensed under the MIT License that covers the project.
