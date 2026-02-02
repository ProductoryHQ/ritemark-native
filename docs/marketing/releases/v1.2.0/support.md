# Ritemark Flows - Help & Support

Build visual AI workflows to automate content generation.

* * *

## What are Ritemark Flows?

**Ritemark Flows** is a visual workflow editor that lets you chain AI operations together. Instead of running prompts one at a time, you build a flow once and execute it to generate multiple outputs automatically.

**Example use cases:**
- Generate a blog post and matching hero image
- Create product descriptions with accompanying visuals
- Build a content pipeline that outputs multiple formats

## How to Use

1. Click the **Flows** icon in the Activity Bar (left sidebar)
2. Click **New Flow** to create a workflow
3. Drag nodes from the palette onto the canvas
4. Connect nodes by dragging from output handles to input handles
5. Click a node to configure it in the right panel
6. Click **Run** to execute the flow

## Node Types

### Trigger Node

The starting point of every flow. Use it to:
- Define input variables (e.g., `topic`, `style`)
- Set default values for testing
- Variables are available in all downstream nodes via `{{variableName}}`

### LLM Node

Sends a prompt to OpenAI GPT and outputs the generated text.

- **Model:** Select from available GPT models
- **System prompt:** Set the AI's behavior/role
- **User prompt:** The actual request (can include variables)
- **Output:** Generated text, available to downstream nodes

### Image Node

Creates images using GPT Image 1.5.

- **Prompt:** Describe the image to generate (can include variables or LLM output)
- **Size:** Choose dimensions (1024x1024, 1792x1024, etc.)
- **Output:** Path to the generated image file

### Save File Node

Writes content to a file in your workspace.

- **Filename:** Where to save (relative to workspace root)
- **Content:** What to write (typically from an LLM node)
- **Format:** Markdown, CSV, or image

## Working with Variables

Use double curly braces to reference variables:

- `{{topic}}` - References a Trigger variable
- `{{llm_1.output}}` - References output from a specific LLM node
- `{{image_1.path}}` - References the path from an Image node

## Flow Storage

Flows are saved automatically to:
```
{workspace}/.ritemark/flows/
```

Each flow is a JSON file containing node positions, configurations, and connections.

## Requirements

**API Key:** Flows require an OpenAI API key for LLM and Image nodes.

To configure:
1. Open Command Palette (`Cmd+Shift+P`)
2. Run "Ritemark: Configure OpenAI API Key"
3. Enter your API key

Or use the new Ritemark Settings page accessible from the Flows sidebar.

## Troubleshooting

### Flow won't run

- Ensure all nodes are connected (no orphaned nodes)
- Check that the Trigger node is present
- Verify your OpenAI API key is configured

### LLM node returns error

- Check your API key is valid
- Verify you have API credits
- Review the prompt for issues

### Image generation fails

- GPT Image 1.5 requires specific API access - verify your account has it
- Check the prompt isn't triggering content filters
- Try a simpler prompt to test

### Nodes won't connect

- Drag from an **output handle** (right side) to an **input handle** (left side)
- Not all node types can connect to each other
- Trigger can only output, Save File can only input

### Flow executes slowly

- Each node makes an API call - execution time depends on API response
- Image generation is slower than text generation
- Large prompts take longer to process

## Tips & Best Practices

1. **Start simple:** Build a 3-node flow (Trigger -> LLM -> Save File) before complex workflows
2. **Test incrementally:** Run partial flows to verify each step works
3. **Use descriptive names:** Name your variables clearly (`blog_topic` not `t`)
4. **Auto-layout:** Click the layout button to automatically arrange nodes
5. **Undo mistakes:** Use Cmd+Z / Ctrl+Z to undo changes

## Privacy & Security

**Stays on your computer:**
- Flow definitions (JSON files)
- Generated output files
- Variable values and configurations

**Uses OpenAI API:**
- LLM prompts and responses
- Image generation requests

**Note:** Prompts containing your variables are sent to OpenAI when flows execute. Review OpenAI's data policies for sensitive content.

* * *

## FAQ

### Q: Do I need an API key?

**A:** Yes. Flows use OpenAI for LLM and Image nodes. Configure your key in Ritemark Settings.

### Q: Can I use other AI providers?

**A:** Currently OpenAI only. Additional providers may be added in future versions.

### Q: Where are my flows saved?

**A:** In `.ritemark/flows/` within your workspace. They're regular JSON files.

### Q: Can I share flows with others?

**A:** Yes. Copy the `.flow.json` file from `.ritemark/flows/` and share it. Others can place it in their flows directory.

### Q: What's the bundle size increase?

**A:** About 2.3MB for React Flow and ELKjs libraries.

### Q: Can I disable Flows?

**A:** Yes. The feature is controlled by the `ritemark-flows` flag. Contact support for instructions.

### Q: Why is my Dictate button missing on Windows?

**A:** Voice dictation uses macOS-specific APIs. The button is now hidden on Windows to avoid confusion.

### Q: Are flows executed locally?

**A:** Flow logic runs locally, but LLM and Image nodes make API calls to OpenAI. Generated files are saved locally.
