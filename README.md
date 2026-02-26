# Ritemark

**Three editors. One app. Text, Data, Flow.**

A native desktop app for writing, structured data, and AI automation—all in one place.

## The Three Modes

| Mode | What It Does |
|------|--------------|
| **Text** | WYSIWYG markdown editing. Write in rich text, save as clean markdown. |
| **Data** | CSV editing and Excel preview. Work with spreadsheets alongside your docs. |
| **Flow** | Visual AI workflows. Chain prompts together, generate content automatically. |

## Features

### Text Mode
- True WYSIWYG markdown editing
- Clean markdown output that works everywhere
- Slash commands for quick formatting
- AI writing assistant (rephrase, expand, translate)
- Voice dictation (macOS)
- PDF and Word export

### Data Mode
- Edit CSV files with inline cell editing
- Preview Excel files (.xlsx, .xls)
- YAML front-matter for document metadata
- Auto-refresh when files change

### Flow Mode
- Drag-and-drop workflow editor
- LLM nodes for text generation
- Image nodes for AI art
- Save outputs directly to files
- Reusable workflows you can run anytime

### Privacy First
- Local-first: your files stay on your machine
- No account required
- No telemetry by default
- AI calls go directly to your API provider

## Download

**[Download for macOS (Apple Silicon)](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark.dmg)**

**[Download for Windows](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-Setup.exe)**

## Screenshots

*Coming soon*

## Building from Source

```bash
# Clone with submodules
git clone --recurse-submodules https://github.com/jarmo-productory/ritemark-native.git
cd ritemark-native

# Apply VS Code patches
./scripts/apply-patches.sh

# Install dependencies
cd vscode && npm install && cd ..
cd extensions/ritemark && npm install --legacy-peer-deps && cd ../..

# Run in development mode (macOS)
./scripts/build-mac.sh
```

**Requirements:** Node.js 20, Git, Python 3.11+, macOS (primary). See [CONTRIBUTING.md](CONTRIBUTING.md) for full setup instructions.

## Contributing

We welcome contributions! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for:

- Development environment setup
- Project structure and where to make changes
- Pull request process and DCO sign-off
- What we will and won't merge

## Documentation

- [Feature Guide](docs/features/README.md)
- [Getting Started](docs/guides/getting-started.md)
- [Keyboard Shortcuts](docs/features/keyboard-shortcuts.md)

## Community

- [GitHub Issues](https://github.com/jarmo-productory/ritemark-native/issues) — Bug reports and feature requests
- [GitHub Discussions](https://github.com/jarmo-productory/ritemark-native/discussions) — Questions, ideas, and conversation
- [Code of Conduct](CODE_OF_CONDUCT.md) — Our community standards
- [Security Policy](SECURITY.md) — How to report security issues

## Acknowledgments

Ritemark is built on the shoulders of great open-source projects:

- [VS Code OSS](https://github.com/microsoft/vscode) (MIT) — The foundation
- [TipTap](https://tiptap.dev/) (MIT) — Rich text editor framework
- [Orama](https://orama.com/) (Apache 2.0) — Full-text search
- [OpenAI SDK](https://github.com/openai/openai-node) (Apache 2.0) — AI integration

## AI-Assisted Development

This project uses [Claude Code](https://claude.ai/code) for development. The `.claude/` directory contains agent configurations and development workflows. You don't need Claude Code to contribute — it's part of the maintainer's workflow.

## License

[MIT](LICENSE) — Copyright (c) 2024-2026 Productory OÜ

The Ritemark name, logos, and brand assets are trademarks of Productory OÜ. See [TRADEMARK.md](TRADEMARK.md) for details.
