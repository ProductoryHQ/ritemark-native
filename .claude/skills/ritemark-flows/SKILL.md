---
name: ritemark-flows
description: Build and modify Ritemark Flows - visual AI workflows. Use when creating, editing, or debugging flow JSON files.
version: 1.0.0
allowed-tools: Read, Write, Edit, Glob, Grep
---

# Ritemark Flows

Build visual AI workflows that chain LLM and image generation operations.

## When to Use This Skill

- Creating new flows from user requirements
- Modifying existing flow configurations
- Debugging flow connection or variable issues
- Understanding flow JSON structure

## Flow Storage

Flows are stored as JSON files in:

```
{workspace}/.ritemark/flows/{flow-name}-{id}.flow.json
```

## Flow JSON Schema

```typescript
interface Flow {
  id: string;                    // Unique ID (e.g., "document-summarizer-0oj6")
  name: string;                  // Display name
  description: string;           // What the flow does
  version: number;               // Schema version (currently 1)
  created: string;               // ISO timestamp
  modified: string;              // ISO timestamp
  inputs: FlowInput[];           // Trigger inputs
  nodes: FlowNode[];             // All nodes in the flow
  edges: FlowEdge[];             // Connections between nodes
}
```

## Node Types

### 1. Trigger Node (Required)

Starting point of every flow. Defines user inputs.

```json
{
  "id": "node-{timestamp}",
  "type": "trigger",
  "position": { "x": 100, "y": 0 },
  "data": {
    "label": "Trigger",
    "inputs": [
      {
        "id": "input-{timestamp}",
        "type": "text",           // or "file"
        "label": "Topic",
        "required": true,
        "defaultValue": ""
      }
    ]
  }
}
```

**Input types:**
- `text` - User enters text (e.g., topic, style, keywords)
- `file` - User selects a file to process

### 2. LLM Prompt Node

Sends prompt to language model, outputs generated text.

```json
{
  "id": "node-{timestamp}",
  "type": "llm-prompt",
  "position": { "x": 100, "y": 200 },
  "data": {
    "label": "LLM Prompt",
    "provider": "openai",         // or "gemini"
    "model": "gpt-5-mini",        // see Model Config
    "systemPrompt": "You are a helpful assistant",
    "userPrompt": "Write about {Topic}",
    "temperature": 0.7,
    "maxTokens": 2000
  }
}
```

**Variable syntax:** Use `{Label}` to reference inputs or other node outputs.

### 3. Image Prompt Node

Generates images using AI models.

```json
{
  "id": "node-{timestamp}",
  "type": "image-prompt",
  "position": { "x": 100, "y": 400 },
  "data": {
    "label": "Generate Image",
    "provider": "openai",         // or "gemini"
    "model": "gpt-image-1.5",     // see Model Config
    "prompt": "A photo of {Topic}",
    "inputImages": [],            // for image editing
    "action": "auto",             // "auto", "generate", "edit"
    "inputFidelity": "low",       // "low", "high" (for edits)
    "size": "1024x1024",          // "1024x1024", "1792x1024", "1024x1792"
    "quality": "standard",        // "standard", "hd"
    "style": "natural"            // "natural", "vivid"
  }
}
```

### 4. Save File Node

Writes content to a file.

```json
{
  "id": "node-{timestamp}",
  "type": "save-file",
  "position": { "x": 100, "y": 600 },
  "data": {
    "label": "Save File",
    "filename": "output.md",
    "format": "markdown",         // "markdown", "csv", "image"
    "sourceNodeId": "node-xxx",   // Which node's output to save
    "folder": "outputs"           // Subfolder (optional)
  }
}
```

## Edges (Connections)

Connect nodes by defining edges:

```json
{
  "id": "edge-{timestamp}",
  "source": "node-trigger-id",
  "target": "node-llm-id"
}
```

**Connection rules:**
- Trigger can only be a source (outputs to other nodes)
- Save File can only be a target (receives from other nodes)
- LLM and Image nodes can be both source and target

## Variable References

Use curly braces to reference values:

| Syntax | Description |
| --- | --- |
| `{Topic}` | Reference trigger input by label |
| `{LLM Prompt}` | Reference node output by label |
| `{Generate Image}` | Reference image node output |

Variables are case-sensitive and match node/input labels.

## Model Configuration

Available models are defined in `extensions/ritemark/src/ai/modelConfig.ts`.

**OpenAI LLM models:**
- `gpt-5-mini` (default, fast)
- `gpt-5` (most capable)
- `gpt-4o`

**OpenAI Image models:**
- `gpt-image-1.5` (default)

**Gemini LLM models:**
- `gemini-2.5-flash`
- `gemini-3-pro`

**Gemini Image models:**
- `imagen-4`

## Example Flows

### Simple Blog Post Generator

```json
{
  "id": "blog-generator-abc1",
  "name": "Blog Post Generator",
  "description": "Generates a blog post from a topic",
  "version": 1,
  "created": "2026-02-01T00:00:00.000Z",
  "modified": "2026-02-01T00:00:00.000Z",
  "inputs": [
    {
      "id": "input-1",
      "type": "text",
      "label": "Topic",
      "required": true,
      "defaultValue": ""
    }
  ],
  "nodes": [
    {
      "id": "node-trigger",
      "type": "trigger",
      "position": { "x": 100, "y": 0 },
      "data": {
        "label": "Trigger",
        "inputs": [
          {
            "id": "input-1",
            "type": "text",
            "label": "Topic",
            "required": true,
            "defaultValue": ""
          }
        ]
      }
    },
    {
      "id": "node-llm",
      "type": "llm-prompt",
      "position": { "x": 100, "y": 200 },
      "data": {
        "label": "Write Blog",
        "provider": "openai",
        "model": "gpt-5-mini",
        "systemPrompt": "You are a professional blog writer.",
        "userPrompt": "Write a 500-word blog post about: {Topic}",
        "temperature": 0.7,
        "maxTokens": 2000
      }
    },
    {
      "id": "node-save",
      "type": "save-file",
      "position": { "x": 100, "y": 400 },
      "data": {
        "label": "Save Blog",
        "filename": "blog-post.md",
        "format": "markdown",
        "sourceNodeId": "node-llm",
        "folder": "posts"
      }
    }
  ],
  "edges": [
    { "id": "edge-1", "source": "node-trigger", "target": "node-llm" },
    { "id": "edge-2", "source": "node-llm", "target": "node-save" }
  ]
}
```

### Content + Image Pipeline

```json
{
  "id": "content-image-xyz2",
  "name": "Content with Hero Image",
  "description": "Generates content and a matching image",
  "version": 1,
  "inputs": [
    { "id": "input-1", "type": "text", "label": "Product", "required": true }
  ],
  "nodes": [
    {
      "id": "node-trigger",
      "type": "trigger",
      "position": { "x": 100, "y": 0 },
      "data": { "label": "Trigger", "inputs": [...] }
    },
    {
      "id": "node-description",
      "type": "llm-prompt",
      "position": { "x": 100, "y": 200 },
      "data": {
        "label": "Product Description",
        "provider": "openai",
        "model": "gpt-5-mini",
        "systemPrompt": "You write compelling product descriptions.",
        "userPrompt": "Write a product description for: {Product}",
        "temperature": 0.7,
        "maxTokens": 1000
      }
    },
    {
      "id": "node-image",
      "type": "image-prompt",
      "position": { "x": 100, "y": 400 },
      "data": {
        "label": "Product Image",
        "provider": "openai",
        "model": "gpt-image-1.5",
        "prompt": "Professional product photo of {Product}, white background, studio lighting",
        "size": "1024x1024",
        "quality": "hd",
        "style": "natural"
      }
    },
    {
      "id": "node-save-text",
      "type": "save-file",
      "position": { "x": 0, "y": 600 },
      "data": {
        "label": "Save Description",
        "filename": "description.md",
        "format": "markdown",
        "sourceNodeId": "node-description"
      }
    },
    {
      "id": "node-save-image",
      "type": "save-file",
      "position": { "x": 200, "y": 600 },
      "data": {
        "label": "Save Image",
        "filename": "product.png",
        "format": "image",
        "sourceNodeId": "node-image"
      }
    }
  ],
  "edges": [
    { "id": "edge-1", "source": "node-trigger", "target": "node-description" },
    { "id": "edge-2", "source": "node-trigger", "target": "node-image" },
    { "id": "edge-3", "source": "node-description", "target": "node-save-text" },
    { "id": "edge-4", "source": "node-image", "target": "node-save-image" }
  ]
}
```

## Building a Flow

When a user requests a flow:

1. **Clarify requirements:**
   - What inputs does the user provide?
   - What outputs should be generated?
   - What AI operations are needed?

2. **Design the node graph:**
   - Start with a Trigger node
   - Add LLM nodes for text generation
   - Add Image nodes for visuals
   - End with Save File nodes

3. **Connect the nodes:**
   - Define edges from source to target
   - Ensure data flows correctly

4. **Write the JSON file:**
   - Generate unique IDs (use timestamps)
   - Set reasonable positions (y increases by ~200 per row)
   - Write to `.ritemark/flows/`

5. **Validate:**
   - All nodes are connected
   - Variable references match labels
   - Model names are valid

## Common Patterns

### Sequential Pipeline
```
Trigger → LLM → Save
```

### Parallel Outputs
```
Trigger → LLM → Save Text
        ↘ Image → Save Image
```

### Chained Processing
```
Trigger → LLM (outline) → LLM (expand) → Save
```

### Document Processing
```
Trigger (file) → LLM (summarize) → Save
```

## Debugging Tips

- **Missing connections:** Ensure every non-trigger node has an incoming edge
- **Variable not found:** Check that `{Label}` matches exactly (case-sensitive)
- **Invalid model:** Check `modelConfig.ts` for valid model names
- **Position overlap:** Space nodes ~200px apart vertically

## Documentation

Full user documentation: `docs/releases/v1.2.0/support.md`
