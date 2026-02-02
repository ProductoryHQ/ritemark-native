# Ritemark Flows - User Guide

**Version:** 1.0
**Last Updated:** 2026-02-01

---

## What is Ritemark Flows?

Ritemark Flows is a visual automation tool that lets you create AI-powered workflows without writing code. Connect nodes together to build pipelines that can:

- Generate text using AI (blog posts, summaries, translations)
- Create images from descriptions
- Save outputs to your workspace as markdown, CSV, or image files

Think of it as a visual programming tool where you connect building blocks to automate repetitive tasks.

---

## Getting Started

### Enable Ritemark Flows

1. Click the **gear icon** in either the Ritemark AI or Ritemark Flows sidebar
2. Find **Ritemark Flows** under Features
3. Toggle it **ON**
4. The Flows icon will appear in your Activity Bar (left sidebar)

### Your First Flow

1. Click the **Flows icon** in the Activity Bar
2. Click **+ New Flow**
3. The visual editor opens with a Trigger node already placed

---

## The Flow Editor

The editor has three sections:

```
┌─────────────┬────────────────────────┬─────────────────┐
│   NODE      │                        │   PROPERTIES    │
│   PALETTE   │      CANVAS            │   PANEL         │
│             │                        │                 │
│  Drag nodes │   Connect nodes here   │  Configure the  │
│  from here  │                        │  selected node  │
└─────────────┴────────────────────────┴─────────────────┘
```

### Node Palette (Left)

Drag nodes onto the canvas:

| Category | Nodes |
|----------|-------|
| **Start** | Trigger - Every flow needs one |
| **AI** | LLM Prompt, Image Generation |
| **Output** | Save File |

### Canvas (Center)

- **Drag** nodes to position them
- **Connect** nodes by dragging from a node's output handle to another node's input handle
- **Select** a node by clicking it
- **Delete** a node by selecting it and pressing Delete/Backspace
- **Auto-arrange** using the button in the toolbar

### Properties Panel (Right)

Shows settings for the selected node. Different nodes have different options.

---

## Node Types

### Trigger Node (Blue)

The starting point of every flow. Define what inputs your flow needs.

**Settings:**
- **Label** - Name shown on the node
- **Inputs** - Add text inputs that users fill in when running the flow

**Example inputs:**
- "Topic" for a blog post generator
- "Language" for a translator
- "Product Name" for a description writer

### LLM Prompt Node (Purple)

Sends a prompt to an AI model and returns text.

**Settings:**
- **Label** - Name shown on the node
- **Provider** - OpenAI (default)
- **Model** - GPT-5 Mini, GPT-5.2, etc.
- **System Prompt** - Instructions for the AI's behavior
- **User Prompt** - The actual request (can include variables)
- **Temperature** - Creativity level (0 = focused, 1 = creative)
- **Max Tokens** - Maximum response length

**Using Variables:**
Reference inputs or other nodes in your prompts:
- `{Topic}` - Value from a Trigger input named "Topic"
- `{LLM Prompt}` - Output from a node labeled "LLM Prompt"

### Image Generation Node (Green)

Creates images using AI.

**Settings:**
- **Label** - Name shown on the node
- **Provider** - OpenAI (GPT Image 1.5)
- **Prompt** - Description of the image to generate
- **Size** - 1024x1024, 1792x1024, or 1024x1792
- **Quality** - Standard or HD
- **Style** - Natural or Vivid

**Note:** Requires an OpenAI API key configured in Settings.

### Save File Node (Orange)

Saves output to a file in your workspace.

**Settings:**
- **Label** - Name shown on the node
- **Save output from** - Which node's output to save
- **Format** - Markdown (.md), CSV (.csv), or Image (.png)
- **Folder** - Where to save (use folder picker button)
- **Filename** - Name of the file (supports variables)

**Filename Variables:**
Click the `/` button to insert:
- `{{inputs.Topic}}` - Value from an input
- `{{timestamp}}` - Current timestamp
- `{{date}}` - Today's date (YYYY-MM-DD)

---

## Running a Flow

1. Click **Run** in the top toolbar (or the play button)
2. Fill in any required inputs
3. Click **Run Flow**
4. Watch the progress as each node executes
5. View results in the panel

### During Execution

- **Blue spinner** - Node is running
- **Green checkmark** - Node completed successfully
- **Red X** - Node failed (expand to see error)

### After Completion

- Click on completed nodes to see their output
- Files are saved to your workspace
- Generated images are stored in `.ritemark/flows/images/`

---

## Managing Flows

### From the Sidebar

- **Click** a flow to open it in the editor
- **Hover** to reveal Edit and Delete buttons
- **Delete** shows a confirmation dialog

### Flow Files

Flows are stored in your workspace:
```
.ritemark/
└── flows/
    ├── my-blog-generator-x4k9.flow.json
    ├── image-creator-m2p7.flow.json
    └── images/
        └── (generated images)
```

### Renaming Flows

1. Open the flow in the editor
2. Change the name in the top-left field
3. The file automatically renames on save

---

## Tips & Best Practices

### Naming
- Give nodes descriptive labels ("Generate Outline" not "LLM 1")
- Name your flows based on what they do ("Weekly Report Generator")

### Prompts
- Be specific in system prompts about the AI's role
- Use variables `{InputName}` to make flows reusable
- Chain nodes: first node generates outline, second expands it

### Organization
- Keep related flows in your project workspace
- Use the description field to document what a flow does

### Troubleshooting
- **Flow won't run:** Check that all nodes are connected
- **API error:** Verify your OpenAI API key in Settings
- **Wrong output:** Adjust temperature or be more specific in prompts

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Save | Cmd/Ctrl + S |
| Undo | Cmd/Ctrl + Z |
| Redo | Cmd/Ctrl + Shift + Z |
| Delete selected | Delete / Backspace |
| Select all | Cmd/Ctrl + A |

---

## Requirements

- **OpenAI API Key** - Required for LLM and Image nodes
- **Ritemark Flows** feature enabled in Settings

---

## Examples

### Blog Post Generator

```
[Trigger: Topic] → [LLM: Generate Outline] → [LLM: Write Post] → [Save: blog-post.md]
```

### Image + Caption

```
[Trigger: Description] → [Image: Generate] → [Save: image.png]
                       ↘ [LLM: Write Caption] → [Save: caption.md]
```

### Translation Pipeline

```
[Trigger: Text, Language] → [LLM: Translate] → [Save: translated.md]
```

---

## Getting Help

- Check Settings (gear icon) for API key configuration
- Validation warnings appear at the top of the editor
- Error details shown in the execution panel

---

*Ritemark Flows is currently in beta. Features may change based on feedback.*
