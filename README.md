# RiteMark Native

VS Code OSS fork with RiteMark built-in as the native markdown editor.

## Overview

RiteMark Desktop - A branded standalone app built from VS Code OSS with RiteMark embedded as the native markdown editor.

**Not an extension** - Full control over branding, defaults, UX, and OS integration.

## Architecture

- VS Code OSS as git submodule (not fork)
- Custom Editor Provider for .md files
- RiteMark WYSIWYG editor in webview
- Minimal patches to product.json and branding

## Repository Structure

```
ritemark-native/
├── vscode/                 # VS Code OSS submodule
├── extensions/
│   └── ritemark/           # Built-in RiteMark extension
├── build/                  # Build scripts and configs
├── branding/               # Icons, logos, product.json overrides
├── scripts/                # Development and release scripts
└── docs/                   # Documentation
```

## Related Repositories

- [ritemark](https://github.com/jarmo-productory/ritemark) - Web application
- [ritemark-shared](https://github.com/jarmo-productory/ritemark-shared) - Shared packages

## Development

```bash
# Clone with submodules
git clone --recursive https://github.com/jarmo-productory/ritemark-native.git

# Install dependencies
npm install

# Build
npm run build

# Run dev
npm run dev
```

## License

MIT
