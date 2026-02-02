# Ritemark v1.2.0

**Released:** 2026-02-02
**Type:** Major (new feature: Ritemark Flows)
**Download:** [GitHub Release](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark.dmg)

## Highlights

Ritemark v1.2.0 introduces **Ritemark Flows** - a visual workflow automation system for AI-powered content generation. Build workflows by connecting nodes, then execute them to generate text, images, and files automatically.

## What's New

### Ritemark Flows

Think of Flows as a visual programming tool for AI tasks. Instead of writing prompts one at a time in the chat, you build reusable workflows that can:

- Generate multiple pieces of content in sequence
- Create images based on AI-written descriptions
- Save outputs directly to files in your workspace

**Getting Started:**

1. Click the new **Flows** icon in the Activity Bar (left sidebar)
2. Click "New Flow" to create a workflow
3. Drag nodes from the palette onto the canvas
4. Connect nodes by dragging from output to input handles
5. Configure each node (click to select, edit in the right panel)
6. Click "Run" to execute the flow

**Node Types:**

| Node | Purpose |
|------|---------|
| Trigger | Starts the flow, defines input variables |
| LLM | Sends a prompt to OpenAI GPT, outputs generated text |
| Image | Creates images with GPT Image 1.5, outputs image path |
| Save File | Writes content to markdown, CSV, or image files |

**Example Workflow:**

Trigger (topic variable) -> LLM (write blog post) -> Save File (output.md)
                        -> LLM (write image prompt) -> Image (generate) -> Save File (hero.png)

### Ritemark Settings

A new branded settings page consolidates AI configuration:

- OpenAI API key management
- Model selection for LLM and Image generation
- Accessible from the Flows sidebar

### Windows Polish

Several fixes for Windows users:

- **Dictate button hidden:** Voice dictation requires macOS-specific APIs, so the button no longer appears on Windows
- **PDF export images:** Images now properly embed in exported PDFs
- **PDF checkboxes:** Unicode checkbox characters render correctly
- **Word export:** Fixed line-ending issues for better compatibility with Microsoft Word

## Technical Notes

- Base: VS Code OSS 1.94.0
- Platform: macOS (Apple Silicon), Windows
- React Flow: Powers the visual flow editor
- ELKjs: Automatic graph layout algorithm
- Bundle increase: ~2.3MB for the flow editor libraries
- Feature flag: `ritemark-flows` (enabled by default, can be disabled)

## Upgrade Notes

1. Download Ritemark.dmg from GitHub Releases
2. Drag to Applications (replace existing)
3. Launch Ritemark

Your existing documents, settings, and RAG index are preserved. Flows are stored in `.ritemark/flows/` and will be created automatically when you make your first flow.

## Known Limitations

- Flows require an OpenAI API key
- Image generation uses GPT Image 1.5 (requires appropriate API access)
- Windows voice dictation not supported (macOS only)
- Large flows may take time to execute depending on API response times
