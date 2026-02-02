# Ritemark Flows

Visual workflow automation for AI-powered content generation.

---

## What Are Flows?

Flows let you chain AI tasks together into reusable workflows. Instead of running prompts one at a time in the chat, you build a visual diagram that executes automatically.

**Example workflow:**
1. Define a topic variable (Trigger)
2. Generate a blog post about that topic (LLM)
3. Generate a hero image prompt from the post (LLM)
4. Create the image (Image)
5. Save everything to files (Save File)

Run the flow once, and Ritemark executes each step in sequence.

---

## Accessing Flows

Click the **Flows** icon in the Activity Bar (left sidebar). This opens the Flows panel where you can:

- View existing flows
- Create new flows
- Edit and run flows

---

## Node Types

Flows are built from four node types, organized in three categories.

### Start

| Node | Purpose |
|------|---------|
| **Trigger** | Starting point for the flow. Define input variables here. Only one Trigger node per flow. |

### AI

| Node | Purpose |
|------|---------|
| **LLM Prompt** | Send a prompt to an LLM (GPT-4o, etc.). Use `{{variableName}}` to inject values from connected nodes. Outputs generated text. |
| **Image Generation** | Create images with AI (GPT Image 1.5). Input: text description. Output: path to generated image file. |

### Output

| Node | Purpose |
|------|---------|
| **Save File** | Write content to a file in your workspace. Supports markdown, CSV, and images. |

---

## Building a Flow

### 1. Create a New Flow

1. Open the Flows panel (Activity Bar icon)
2. Click **New Flow**
3. Give your flow a name

### 2. Add Nodes

Drag nodes from the left palette onto the canvas:

- Start with a **Trigger** node (required)
- Add **LLM** or **Image** nodes for AI processing
- End with **Save File** nodes to write outputs

### 3. Connect Nodes

- Drag from an output handle (right side) to an input handle (left side)
- Data flows along these connections
- Each node's output becomes available in downstream nodes

### 4. Configure Nodes

Click a node to open its configuration panel on the right:

**Trigger Node:**
- Add variables that will be available to the flow
- Set default values for testing

**LLM Node:**
- Write your prompt
- Use `{{variableName}}` to reference upstream outputs
- Select the model to use

**Image Node:**
- Configure the prompt (can reference upstream text)
- Set image dimensions

**Save File Node:**
- Choose filename (use variables for dynamic names)
- Select file type (markdown, CSV, image)

---

## Running Flows

### Execute a Flow

1. Select the flow in the Flows panel
2. Click **Run** in the toolbar
3. If the Trigger has variables without defaults, you'll be prompted to enter values
4. Watch execution progress in the Execution Panel

### Execution Panel

Shows real-time status:
- Current node being executed
- Outputs from each completed node
- Any errors encountered
- Total execution time

---

## Storage

Flows are stored locally in your workspace:

```
.ritemark/flows/
├── my-first-flow.json
├── blog-generator.json
└── social-media-workflow.json
```

Each flow is a JSON file containing:
- Node definitions
- Connections between nodes
- Node configurations
- Canvas layout positions

---

## Requirements

### API Keys

Flows require API keys configured in Ritemark Settings:

| Node Type | Requires |
|-----------|----------|
| LLM Prompt | OpenAI API key |
| Image Generation | OpenAI API key with image generation access |

### Configuring API Keys

1. Open Flows panel
2. Click **Settings** (gear icon)
3. Enter your OpenAI API key
4. Select default models for LLM and Image generation

---

## Tips

- **Start simple:** Build a two-node flow first (Trigger → LLM → Save File)
- **Test incrementally:** Run after adding each node to verify it works
- **Use variables:** Make flows reusable by parameterizing inputs
- **Check outputs:** Review generated files before building on them

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Delete selected node | Delete / Backspace |
| Undo | Cmd+Z |
| Redo | Cmd+Shift+Z |
| Select all | Cmd+A |
| Pan canvas | Drag on empty space |
| Zoom | Scroll / Pinch |

---

## Related

- [AI Assistant](ai-assistant.md) - For single-prompt AI tasks
- [Document Properties](document-properties.md) - YAML frontmatter for metadata
