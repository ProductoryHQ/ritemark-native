# Contributing to Ritemark Native

Thank you for your interest in contributing to Ritemark Native!

## Getting Started

See [docs/development/README.md](docs/development/README.md) for full development environment setup.

### Quick Setup

```bash
git clone --recurse-submodules https://github.com/jarmo-productory/ritemark-native.git
cd ritemark-native
./scripts/apply-patches.sh
cd vscode && yarn && cd ..
cd extensions/ritemark && npm install && cd ../..
cd extensions/ritemark/webview && npm install && npm run build && cd ../../..
cd extensions/ritemark && npx tsc && cd ../..
./scripts/code.sh
```

## Project Structure

Ritemark Native has three main areas:

| Area | Location | What to Edit |
|------|----------|-------------|
| Extension | `extensions/ritemark/src/` | TypeScript extension code |
| Webview | `extensions/ritemark/webview/` | React + TipTap editor UI |
| VS Code patches | `patches/vscode/` | VS Code customizations |

**Important:** Never edit files inside `vscode/` directly. Use the [patch system](docs/development/patch-system.md) instead.

## How to Contribute

### Reporting Bugs

- Use [GitHub Issues](https://github.com/jarmo-productory/ritemark-native/issues)
- Include your OS, Ritemark version, and steps to reproduce
- Attach screenshots if relevant

### Suggesting Features

- Check [docs/WISHLIST.md](docs/WISHLIST.md) for existing ideas
- Open an issue with the "feature request" label

### Submitting Code

1. Fork the repository
2. Create a branch: `git checkout -b my-feature`
3. Make your changes
4. Ensure the extension compiles: `cd extensions/ritemark && npx tsc --noEmit`
5. If you changed the webview: `cd extensions/ritemark/webview && npm run build`
6. Test in dev mode: `./scripts/code.sh`
7. Submit a pull request

### Pull Request Guidelines

- Keep PRs focused on a single change
- Describe what changed and why
- Reference related issues if applicable

## Code Style

- TypeScript for all extension code
- React + Tailwind CSS for webview components
- See [docs/development/style-guide.md](docs/development/style-guide.md) for content conventions

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
