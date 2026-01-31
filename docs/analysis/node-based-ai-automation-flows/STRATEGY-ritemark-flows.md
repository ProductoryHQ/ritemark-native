# RiteMark Flows - Product Strategy & Implementation Plan
## Updated January 2026 with Current Research

---

## Executive Summary

Build a **lightweight, custom** node-based automation system using modern 2026 tooling. Key finding: **React Flow UI** now ships with shadcn/ui integration AND a pre-built Workflow Editor template with sequential execution - dramatically reducing our implementation effort.

**Strategic Decision: Custom Build with React Flow UI**

| Option | Verdict |
|--------|---------|
| Node-RED | Overkill - 10MB+ for IoT/general automation |
| Flowise | Heavy - requires embedded server |
| n8n | Blocked - auth issues + restrictive license |
| NodeTool | Blocked - Python dependency + AGPL |
| Sequential Workflow Designer | Good alternative - 0 dependencies, but less React-native |
| Flowy.js | Too minimal - lacks execution engine |
| **React Flow UI + Workflow Template** | **Optimal** - shadcn/ui built-in, runner included, perfect fit |

---

## Research Findings (January 2026)

### Visual Canvas Libraries

| Library | Size | Verdict | Source |
|---------|------|---------|--------|
| [React Flow UI](https://reactflow.dev/ui) | ~50KB | **Best fit** - shadcn/ui integration, workflow template, React 19 + Tailwind 4 ready | [xyflow blog](https://xyflow.com/blog/react-flow-components) |
| [Sequential Workflow Designer](https://github.com/nocode-js/sequential-workflow-designer) | 0 deps | Good alternative - pure TS/SVG, framework-agnostic | [GitHub](https://github.com/nocode-js/sequential-workflow-designer) |
| [Flowy.js](https://github.com/alyssaxuu/flowy) | ~12KB | Too basic - no execution engine | [GitHub](https://github.com/alyssaxuu/flowy) |
| JsPlumb Toolkit | Large | Enterprise-focused, expensive | [jsplumbtoolkit.com](https://jsplumbtoolkit.com/) |

**Winner: React Flow UI** because:
- Already React-based (matches our webview stack)
- [Workflow Editor template](https://reactflow.dev/ui/templates/workflow-editor) includes Zustand state management, drag-drop sidebar, **sequential runner**
- Updated for React 19 + Tailwind CSS 4 (Oct 2025)
- shadcn/ui components built-in (matches our planned migration)
- ELKjs auto-layout included

### Image Generation APIs (2026 State-of-the-Art)

| Model | Provider | Strength | Pricing | Source |
|-------|----------|----------|---------|--------|
| [GPT Image 1.5](https://platform.openai.com/docs/models/gpt-image-1.5) | OpenAI | Best text rendering, 4x faster | $0.032-0.064/image | [OpenAI](https://platform.openai.com/docs/guides/image-generation) |
| [Nano Banana Pro](https://ai.google.dev/gemini-api/docs/image-generation) (Gemini 3 Pro Image) | Google | 14 reference images, subject consistency | $0.039-0.24/image | [Google AI](https://ai.google.dev/gemini-api/docs/image-generation) |
| [FLUX 1.1 Pro](https://replicate.com/black-forest-labs/flux-1.1-pro) | Black Forest Labs | 4.5s generation, photorealistic | $0.04-0.08/image | [WaveSpeed](https://wavespeed.ai/blog/posts/best-ai-image-generators-2026/) |
| [Ideogram 3.0](https://ideogram.ai/) | Ideogram | 90% text accuracy | Varies | [Zapier](https://zapier.com/blog/best-ai-image-generator/) |
| Stable Diffusion 3.5 | Stability AI | Open source, self-hostable | Free (self-hosted) | [DigitalOcean](https://www.digitalocean.com/resources/articles/dall-e-alternatives) |

**Note:** DALL-E 2 and DALL-E 3 are **deprecated** - support ends May 2026. Must use GPT Image 1.5+.

**Note:** Claude API does **not** support image generation (text-only output). Can use [MCP connectors to Hugging Face](https://huggingface.co/blog/claude-and-mcp) for image generation with Claude.

### VS Code Webview Best Practices (2026)

| Finding | Implication | Source |
|---------|-------------|--------|
| Webview UI Toolkit **deprecated** Jan 2025 | Must use custom components | [Microsoft GitHub](https://github.com/microsoft/vscode-webview-ui-toolkit) |
| Vite + React recommended | Already our stack | [GitHub Next](https://githubnext.com/projects/react-webview-ui-toolkit/) |
| 400+ theme CSS variables available | Easy theming | [Elio Struyf](https://www.eliostruyf.com/react-vscode-webview-hot-module-replacement/) |
| GitHub's vscode-react-webviews template | Reference implementation | [GitHub](https://github.com/githubnext/vscode-react-webviews) |
| Tailwind + VS Code CSS vars work together | Theme-native styling | [Ken Muse](https://www.kenmuse.com/blog/using-react-in-vs-code-webviews/) |

---

## Updated Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RiteMark Flows Architecture (2026)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  WEBVIEW (React Flow UI + shadcn/ui)     EXTENSION (TypeScript)             │
│  ┌──────────────────────────────┐        ┌───────────────────────────────┐  │
│  │  FlowCanvas                  │        │  FlowExecutor                 │  │
│  │  ├─ React Flow core          │◄──────►│  ├─ Sequential runner         │  │
│  │  ├─ Zustand state            │ msgs   │  ├─ GPT Image 1.5 / Nano      │  │
│  │  ├─ ELKjs auto-layout        │        │  │    Banana API calls        │  │
│  │  ├─ Drag-drop sidebar        │        │  ├─ OpenAI LLM (existing)     │  │
│  │  └─ shadcn/ui components     │        │  └─ File system operations    │  │
│  └──────────────────────────────┘        └───────────────────────────────┘  │
│                                                     │                        │
│  ┌──────────────────────────────┐        ┌─────────▼─────────────────────┐  │
│  │  .flows/*.flow.json          │◄───────│  FlowStorage                  │  │
│  │  (workspace storage)         │ save/  │  ├─ CRUD operations           │  │
│  │                              │ load   │  └─ File watcher              │  │
│  └──────────────────────────────┘        └───────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Product Vision

**Target User:** Inexperienced users who want to automate repetitive AI tasks without coding.

**Core Use Cases:**
1. "Generate weekly blog post outline from my notes"
2. "Create social media images from product descriptions"
3. "Transform meeting notes into action items CSV"
4. "Run my cleanup script and save results"

**Design Principles:**
- **Minimal** - 4 node types, not 400
- **Visual** - Drag-and-drop, no code required
- **Local-first** - All execution on user's machine
- **Integrated** - Feels native to RiteMark, uses existing AI infrastructure

---

## Node Types (4 Total)

### 1. Input Node (Trigger)
- **Purpose:** Define flow inputs
- **Input types:** Text field, File picker (from workspace)
- **Variables:** `{{input.text}}`, `{{input.file}}`, `{{input.filename}}`

### 2. LLM Prompt Node
- **Purpose:** Send prompt to language model
- **Config:** System prompt, user prompt template, model selection
- **API:** Uses existing OpenAI service (gpt-4o, gpt-4o-mini, etc.)
- **Output:** `{{llm.response}}`

### 3. Image Prompt Node
- **Purpose:** Generate images
- **Config:** Prompt template, size, quality, model selection
- **API Options (user choice):**
  - GPT Image 1.5 (best text rendering) - via existing OpenAI key
  - Nano Banana Pro (Gemini API) - requires separate API key
  - FLUX (via Replicate) - requires Replicate key
- **Output:** `{{image.url}}`, `{{image.data}}`

### 4. Save File Node
- **Purpose:** Write output to workspace
- **Config:** Filename template, format (markdown/CSV/image), destination folder
- **Input:** Content from upstream nodes
- **Output:** Saved file path

---

## User Interface Design

### Entry Point: Sidebar Panel
```
┌─────────────────────────────────────┐
│ ⚡ FLOWS                            │
├─────────────────────────────────────┤
│ [+ New Flow]                        │
├─────────────────────────────────────┤
│ 📄 Weekly Blog Post                 │
│    Last run: 2 days ago             │
│    [▶ Run] [✏️ Edit] [⋯]            │
├─────────────────────────────────────┤
│ 📄 Social Images                    │
│    Never run                        │
│    [▶ Run] [✏️ Edit] [⋯]            │
└─────────────────────────────────────┘
```

### Flow Editor: Modal with React Flow Canvas
Uses React Flow UI's [Workflow Editor template](https://reactflow.dev/ui/templates/workflow-editor) architecture:

```
┌────────────────────────────────────────────────────────────────────┐
│ Edit Flow: Weekly Blog Post                             [Save] [X] │
├────────────────────────────────────────────────────────────────────┤
│ ┌──────────────┐  ┌─────────────────────────────────────────────┐  │
│ │ NODE PALETTE │  │              CANVAS (React Flow)            │  │
│ │              │  │                                             │  │
│ │ ┌──────────┐ │  │  ┌─────────┐      ┌─────────┐    ┌──────┐  │  │
│ │ │📝 Input  │ │  │  │  Input  │──────│   LLM   │────│ Save │  │  │
│ │ └──────────┘ │  │  │ Topic   │      │ Writer  │    │  .md │  │  │
│ │ ┌──────────┐ │  │  └─────────┘      └─────────┘    └──────┘  │  │
│ │ │🤖 LLM    │ │  │                                             │  │
│ │ └──────────┘ │  │           (drag nodes here)                 │  │
│ │ ┌──────────┐ │  │                                             │  │
│ │ │🎨 Image  │ │  └─────────────────────────────────────────────┘  │
│ │ └──────────┘ │                                                   │
│ │ ┌──────────┐ │  ┌─────────────────────────────────────────────┐  │
│ │ │💾 Save   │ │  │ NODE CONFIG (LLM selected)                  │  │
│ │ └──────────┘ │  │ Name:    [Blog Writer           ]           │  │
│ └──────────────┘  │ System:  [You are a professional...]        │  │
│                   │ Prompt:  [Write outline: {{input.text}}]    │  │
│                   │ Model:   [gpt-4o-mini          ▼]           │  │
│                   └─────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### Run Flow: Input Modal
```
┌──────────────────────────────────────────────────┐
│ Run Flow: Weekly Blog Post                       │
├──────────────────────────────────────────────────┤
│                                                  │
│ Topic (text):                                    │
│ ┌──────────────────────────────────────────────┐ │
│ │ AI productivity tools                        │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ Reference file (optional):                       │
│ [📁 Select from workspace...]                    │
│                                                  │
│ ─────────────────────────────────────────────── │
│ ▶ Running step 2 of 3: LLM Writer...            │
│ [████████████░░░░░░░░] 65%                       │
│                                                  │
│               [Cancel]  [▶ Run Flow]             │
└──────────────────────────────────────────────────┘
```

---

## Flow Definition Format (JSON)

```json
{
  "id": "flow_abc123",
  "name": "Weekly Blog Post",
  "description": "Generate blog outline from topic",
  "version": 1,
  "created": "2026-01-15T10:00:00Z",
  "modified": "2026-01-20T14:30:00Z",
  "inputs": [
    { "id": "topic", "type": "text", "label": "Topic", "required": true },
    { "id": "notes", "type": "file", "label": "Reference notes", "required": false }
  ],
  "nodes": [
    {
      "id": "node_1",
      "type": "llm-prompt",
      "position": { "x": 200, "y": 100 },
      "data": {
        "label": "Blog Writer",
        "model": "gpt-4o-mini",
        "systemPrompt": "You are a professional blog writer.",
        "userPrompt": "Create a detailed outline for: {{inputs.topic}}\n\nReference: {{inputs.notes.content}}"
      }
    },
    {
      "id": "node_2",
      "type": "save-file",
      "position": { "x": 400, "y": 100 },
      "data": {
        "label": "Save Outline",
        "filename": "{{inputs.topic | slugify}}-outline.md",
        "folder": "drafts",
        "format": "markdown",
        "content": "# {{inputs.topic}}\n\n{{node_1.output}}"
      }
    }
  ],
  "edges": [
    { "id": "e1-2", "source": "node_1", "target": "node_2" }
  ]
}
```

---

## Implementation Phases

### Phase 1: Foundation (MVP)
**Goal:** Working flow execution with 2 node types

**Deliverables:**
1. Flow storage system (`.flows/` directory, JSON CRUD)
2. Sidebar panel (list flows, run button)
3. Input node + LLM node (uses existing OpenAI service)
4. Basic execution engine (adapt React Flow's runner pattern)
5. Simple run modal (text input only)

**New dependencies (webview):**
- `reactflow` - Core library
- `@xyflow/react` - React bindings
- `elkjs` - Auto-layout (optional, can add later)
- `zustand` - Already considering for state management

**Files to create:**
```
extensions/ritemark/
├── src/flows/
│   ├── FlowStorage.ts         # CRUD for .flow.json files
│   ├── FlowExecutor.ts        # Sequential runner
│   └── FlowsViewProvider.ts   # Sidebar webview provider
└── webview/src/components/flows/
    ├── FlowsPanel.tsx         # Sidebar flow list
    ├── RunFlowModal.tsx       # Input collection + progress
    └── index.ts
```

### Phase 2: Visual Editor
**Goal:** Full drag-and-drop flow building

**Deliverables:**
1. React Flow canvas integration
2. Node palette (drag to canvas)
3. Node configuration panel (shadcn/ui forms)
4. Flow save/load in editor
5. Variable autocomplete (basic)

**Files to create:**
```
webview/src/components/flows/
├── FlowEditorModal.tsx       # Main editor modal
├── FlowCanvas.tsx            # React Flow wrapper
├── nodes/
│   ├── InputNode.tsx         # Input node component
│   ├── LLMNode.tsx           # LLM prompt node
│   ├── ImageNode.tsx         # Image generation node
│   └── SaveNode.tsx          # Save file node
├── NodePalette.tsx           # Drag source
└── NodeConfigPanel.tsx       # Settings form
```

### Phase 3: Complete Node Set
**Goal:** All 4 node types working

**Deliverables:**
1. Image prompt node (GPT Image 1.5 default, Nano Banana optional)
2. Save file node (markdown, CSV, image formats)
3. File picker input type
4. Run script node (execute .sh/.py in project)

**Extension additions:**
```
src/flows/nodes/
├── LLMNodeExecutor.ts        # OpenAI text completion
├── ImageNodeExecutor.ts      # GPT Image 1.5 / Nano Banana
├── SaveNodeExecutor.ts       # Write to workspace
└── ScriptNodeExecutor.ts     # Child process execution
```

### Phase 4: Polish & Templates
**Goal:** Production-ready experience

**Deliverables:**
1. Starter flow templates (blog post, social images, meeting notes)
2. Execution progress UI with step-by-step status
3. Error handling & recovery (retry failed nodes)
4. Flow export/import
5. Keyboard shortcuts
6. ELKjs auto-layout integration

---

## Technical Decisions

### React Flow UI vs Alternatives
**Decision:** Use React Flow UI with Workflow Editor template

**Rationale:**
- Production-ready, MIT licensed
- shadcn/ui integration already built
- [Workflow Editor template](https://reactflow.dev/ui/templates/workflow-editor) includes:
  - Zustand state management (lightweight)
  - Drag-drop sidebar (ready to use)
  - Sequential runner (exactly what we need!)
  - ELKjs auto-layout (optional)
  - Dark mode support (VS Code compatible)
- Updated for React 19 + Tailwind 4 (Oct 2025)
- Used by Stripe, LinkedIn, Typeform

### Image Generation Default
**Decision:** GPT Image 1.5 as default (via existing OpenAI key)

**Rationale:**
- User already has OpenAI API key configured
- Best text rendering (important for blog graphics, etc.)
- 20% cheaper than previous model
- Single API key covers both LLM and image generation

**Alternative support:** Allow Nano Banana Pro (Gemini) and FLUX as optional providers for users who prefer them.

### Storage Location
**Decision:** `.flows/` directory in workspace root

**Rationale:**
- Version-controllable with project
- No external database needed
- Pattern matches `.vscode/` convention
- Easy to backup/share flows

### Execution Model
**Decision:** Sequential, single-threaded in extension

**Rationale:**
- React Flow's Workflow template already implements this pattern
- Simplest mental model for users
- No race conditions
- Can add parallelism later if needed

---

## Dependencies Summary

### Webview (new)
```json
{
  "reactflow": "^12.x",
  "@xyflow/react": "^12.x",
  "zustand": "^5.x",
  "elkjs": "^0.9.x"
}
```

### Extension (existing, reused)
- OpenAI SDK (already installed)
- fs/path (Node.js built-in)

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Bundle size increase | Medium | Lazy-load editor modal, tree-shake React Flow |
| Image API costs | Low | User's API key, their responsibility; show cost estimates |
| Script execution security | High | Sandbox to workspace, require explicit user approval |
| Scope creep | High | Strict 4-node limit for v1, defer requests |
| DALL-E deprecation (May 2026) | Low | Already planning GPT Image 1.5 |

---

## Success Metrics

1. **Adoption:** 50% of active users try Flows within first month
2. **Completion:** 70% of started flows get run at least once
3. **Retention:** Users run flows 3+ times per week
4. **Simplicity:** Average flow has ≤ 5 nodes

---

## Out of Scope (v1)

- Scheduled/automatic triggers
- Conditional branching (if/else nodes)
- Loops/iterations
- External API integrations beyond OpenAI/Google
- Flow sharing/marketplace
- Collaborative editing
- Undo/redo in editor

---

## Competitive Advantage

| RiteMark Flows | Node-RED / n8n / Flowise |
|----------------|--------------------------|
| 4 focused nodes | 100s of nodes (overwhelming) |
| ~50KB addition | ~10MB+ separate app |
| Native VS Code theming | Different UI paradigm |
| Workspace-integrated storage | Separate database |
| No server to run | Requires backend process |
| Built for writers | Built for developers/IT |
| 2026 image models (GPT 1.5, Nano Banana) | Older integrations |

---

## Verification Plan

After implementation, verify:

1. **Create flow:** Can create new flow from sidebar
2. **Visual edit:** Can drag nodes, connect edges, configure
3. **Save/load:** Flow persists in `.flows/` as valid JSON
4. **Run flow:** Can execute with input, see progress
5. **LLM output:** Generated text appears correctly
6. **Image output:** Generated images save to workspace
7. **Error handling:** Graceful failure with clear message
8. **Theme:** UI matches VS Code dark/light themes

---

## Sources

### Visual Canvas
- [React Flow UI](https://reactflow.dev/ui) - Component library
- [Workflow Editor Template](https://reactflow.dev/ui/templates/workflow-editor) - Reference implementation
- [xyflow Blog](https://xyflow.com/blog/react-flow-components) - shadcn/ui announcement
- [Sequential Workflow Designer](https://github.com/nocode-js/sequential-workflow-designer) - Alternative considered

### Image Generation
- [GPT Image 1.5 Docs](https://platform.openai.com/docs/models/gpt-image-1.5) - OpenAI
- [Nano Banana Pro](https://ai.google.dev/gemini-api/docs/image-generation) - Google Gemini
- [Best AI Image Generators 2026](https://wavespeed.ai/blog/posts/best-ai-image-generators-2026/) - Comparison
- [DALL-E Alternatives](https://www.digitalocean.com/resources/articles/dall-e-alternatives) - DigitalOcean

### VS Code Webview
- [Building VS Code Extensions 2026](https://abdulkadersafi.com/blog/building-vs-code-extensions-in-2026-the-complete-modern-guide) - Modern guide
- [GitHub vscode-react-webviews](https://github.com/githubnext/vscode-react-webviews) - Starter template
- [React in VS Code Webviews](https://www.kenmuse.com/blog/using-react-in-vs-code-webviews/) - Ken Muse
