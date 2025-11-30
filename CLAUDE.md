# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RiteMark Native is a VS Code OSS fork with RiteMark built-in as the native markdown editor. This is a standalone branded app, not an extension.

## Architecture

- **VS Code OSS**: Added as a git submodule in `vscode/` (not a fork)
- **Custom Editor Provider**: Registers for `.md` files to use RiteMark instead of default editor
- **RiteMark Extension**: Built-in extension at `extensions/ritemark/` providing WYSIWYG editing in webview
- **Branding**: Custom icons, logos, and product.json overrides in `branding/`

## Development Commands

```bash
# Clone with submodules
git clone --recursive https://github.com/jarmo-productory/ritemark-native.git

# Install dependencies
npm install

# Build
npm run build

# Run development
npm run dev
```

## Repository Structure

- `vscode/` - VS Code OSS submodule
- `extensions/ritemark/` - Built-in RiteMark extension
- `build/` - Build scripts and configs
- `branding/` - Icons, logos, product.json overrides
- `scripts/` - Development and release scripts

## Related Repositories

- [ritemark](https://github.com/jarmo-productory/ritemark) - Web application
- [ritemark-shared](https://github.com/jarmo-productory/ritemark-shared) - Shared packages
