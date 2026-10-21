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

Flows live in **Agents**, in the places row at the top left. Its **Flows** section lists your project's flows. From there you can:

- View existing flows
- Create new flows with **New ▸ Flow**, under the project's name (Documents' **New** has **Flow** too)
- Open a flow to edit and run it in the flow editor, as a tab

---

## Node Types

Flows are built from six kinds of step, organized in three categories.

### Start

| Node | Purpose |
|------|---------|
| **Trigger** | Starting point for the flow. Define input variables here. Only one Trigger node per flow. |

### AI

| Node | Purpose |
|------|---------|
| **LLM Prompt** | Send a prompt to an LLM (GPT-4o, etc.). Use `{{variableName}}` to inject values from connected nodes. Outputs generated text. |
| **Image Generation** | Create images with AI (GPT Image 2 by default, or Gemini 3.1 Flash Image with the Google Gemini provider). Input: text description. Output: path to generated image file. |
| **Claude Code** | Give a task to Claude Code, which can read and change the project's files. Needs Claude signed in. |
| **ChatGPT** | Give a task to ChatGPT, which can read and change the project's files. Needs ChatGPT signed in. |

### Output

| Node | Purpose |
|------|---------|
| **Save File** | Write content to a file in your workspace. Supports markdown, CSV, and images. |

---

## Building a Flow

### 1. Create a New Flow

1. Open **Agents** in the places row
2. Click **New**, under the project's name, then **Flow**
3. Type your flow's name in the flow editor's bar

### 2. Add Nodes

Drag steps from the left palette onto the canvas:

- Start with a **Trigger** node (required)
- Add **LLM**, **Image**, **Claude Code** or **ChatGPT** steps for AI processing
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
- Choose the provider (**OpenAI** or **Google Gemini**) and model. If a saved Flow uses a model Ritemark no longer offers, the Model field shows it as **Unavailable** with *Saved model is no longer available. Choose a replacement.*

**Save File Node:**
- Choose filename (use variables for dynamic names)
- Select file type (markdown, CSV, image)

---

## Running Flows

### Execute a Flow

1. Open the flow from **Agents ▸ Flows**
2. Click **Run flow** in the flow editor's bar
3. If the Trigger has variables without defaults, you'll be prompted to enter values
4. Watch execution progress in the run panel on the right

The clock button beside it runs the flow on a schedule.

### The Run Panel

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

Flows require API keys or sign-ins configured in Ritemark Settings:

| Node Type | Requires |
|-----------|----------|
| LLM Prompt | OpenAI API key |
| Image Generation | OpenAI API key with image generation access |
| Claude Code | Claude signed in |
| ChatGPT | ChatGPT signed in |

A Claude Code or ChatGPT step that isn't signed in says where in Ritemark Settings to sign in.

### Configuring API Keys

1. Open **Settings** (**You** ▸ Settings at the top right, or Cmd+, / Ctrl+,)
2. Under **API Keys**, enter your OpenAI API key
3. Choose each LLM and Image step's model in its configuration panel

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

- [AI Agents](ai-agents.md) - Claude and ChatGPT in the sidebar
- [Agents](agent-library.md) - Where your flows are listed
- [Document Properties](document-properties.md) - YAML frontmatter for metadata
