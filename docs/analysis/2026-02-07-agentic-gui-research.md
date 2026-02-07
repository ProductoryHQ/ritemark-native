# Agentic GUI for Ritemark AI Assistant

**Date:** 2026-02-07
**Status:** Research
**Author:** Claude (Engineering) for Jarmo (Product Owner)

---

## Problem Statement

Ritemark's AI assistant should become agentic -- capable of autonomous multi-step operations (file editing, code execution, research, content generation) within the user's workspace. The core problem is **UX**: most Ritemark users are writers, researchers, and knowledge workers who are afraid of terminals. They need an agentic AI experience wrapped in a friendly GUI.

**Market reality:**
- ChatGPT has ~70% market share; ~7% have Claude subscriptions
- People already pay for ChatGPT Plus/Pro ($20-$200/mo)
- OpenAI Codex CLI is open-source (Apache-2.0) with a proper SDK
- Claude Agent SDK is already used in Ritemark Flows

---

## What Ritemark Already Has

### Current AI Architecture

| Component | Status | Notes |
|-----------|--------|-------|
| OpenAI LLM integration | Production | GPT-5.2, GPT-4o, GPT-4o-mini via Responses + Chat APIs |
| Gemini LLM integration | Production | Gemini 3/2.5 family |
| Image generation | Production | GPT Image 1.5, DALL-E 3, Imagen 4 |
| RAG (vector search) | Production | Orama-based, markdown indexing, semantic search |
| Unified AI View | Production | Left sidebar chat interface with RAG context |
| API key management | Production | OS keychain storage (SecretStorage) |
| Connectivity monitoring | Production | Online/offline detection with status bar |
| Claude Agent SDK | Production | Used in Flows' `ClaudeCodeNode` with full tool access |
| Flows system | Production | Visual DAG workflow editor with 5 node types |

### Claude Agent SDK in Flows (Already Working)

The `ClaudeCodeNodeExecutor.ts` already implements:
- Dynamic ES module import of `@anthropic-ai/claude-agent-sdk`
- Full tool access: Bash, Read, Write, Edit, Glob, Grep
- `bypassPermissions` mode for autonomous execution
- Progress tracking (init, tool_use, thinking, text, done events)
- File modification tracking
- Timeout/abort support
- Cost tracking (duration + USD)

This is a **proven integration** that can be extended beyond Flows into the main AI assistant.

---

## Options Analysis

### Option A: Codex CLI App Server (GUI Wrapper)

**What:** Embed OpenAI's Codex via its App Server protocol (JSON-RPC over stdio) or TypeScript SDK (`@openai/codex-sdk`).

**Architecture:**
```
User (Ritemark Sidebar)
  → VS Code Extension Host
    → codex app-server (child process, JSON-RPC over stdio)
      → OpenAI Responses API (GPT-5.3-Codex)
        → shell, apply_patch, web_search tools
```

**Pros:**
- Leverages ChatGPT subscriptions (70% market) via "Sign in with ChatGPT" OAuth
- Open source (Apache-2.0), well-documented App Server protocol
- Purpose-built for GUI integration (VS Code extension already exists)
- Streaming events: tool calls, file changes, approval requests
- OS-level sandboxing (macOS Seatbelt, Linux Landlock)
- Client implementations exist in TypeScript, Go, Python, Swift, Kotlin
- GPT-5.3-Codex optimized for coding with real-time progress updates

**Cons:**
- Requires bundling a Rust binary (~20-50MB) or expecting npm global install
- Authentication complexity: "Sign in with ChatGPT" flow is Codex-specific, not a general OAuth
- Codex is code-focused; markdown/writing tasks are not its strength
- API key users pay separately from ChatGPT subscription
- Dependency on OpenAI's Codex release cycle
- Tools are code-oriented (shell, apply_patch) -- not ideal for writing workflows

**Auth Reality Check:**
- "Sign in with ChatGPT" generates an API key linked to the user's org
- ChatGPT Plus gets $5 in API credits (30-day expiry), Pro gets $50
- After credits exhaust, standard API billing applies
- This is NOT unlimited use from a ChatGPT subscription
- **Third-party apps cannot use the ChatGPT OAuth flow** -- it's Codex-specific

### Option B: Claude Agent SDK (Extend Current Flows Integration)

**What:** Promote the Claude Agent SDK from Flows-only to a first-class agentic assistant in the main UI.

**Architecture:**
```
User (Ritemark Sidebar)
  → VS Code Extension Host
    → Claude Agent SDK (@anthropic-ai/claude-agent-sdk)
      → Anthropic API (Claude 4 Opus/Sonnet)
        → Bash, Read, Write, Edit, Glob, Grep tools
```

**Pros:**
- Already integrated and proven in Flows (ClaudeCodeNodeExecutor.ts)
- Full tool suite well-suited for markdown/writing workflows
- Strong at reasoning, planning, and multi-step tasks
- No binary bundling needed (pure TypeScript/JS)
- Better for non-code tasks (research, writing, organization)
- Ritemark team has deep expertise with the SDK

**Cons:**
- Only ~7% of users have Claude subscriptions
- Requires Anthropic API key (separate billing from Claude subscription)
- No "Sign in with Claude" OAuth flow for consumer subscriptions
- Higher per-token cost than Codex for coding tasks
- Less coding-specific optimization than GPT-5.3-Codex

### Option C: OpenAI Responses API with Custom Tool Loop

**What:** Build a custom agentic loop using OpenAI's Responses API with self-defined tools (not Codex CLI).

**Architecture:**
```
User (Ritemark Sidebar)
  → VS Code Extension Host
    → Custom Agent Loop (TypeScript)
      → OpenAI Responses API (GPT-5.2/4o)
        → Custom tools: file_read, file_write, search, execute, web_search
```

**Pros:**
- Maximum control over tool definitions and behavior
- Can define writing-specific tools (not just code tools)
- Uses standard OpenAI API key (no Codex binary dependency)
- Tools can be tailored to markdown workflows
- Already have OpenAI client integration (`openAIClient.ts`)
- Can use any GPT model, not locked to Codex-specific models

**Cons:**
- Must implement agent loop, tool execution, sandboxing from scratch
- No ChatGPT subscription leverage (API key only)
- More development work than wrapping Codex or extending Claude SDK
- Must handle safety/sandboxing ourselves
- No "Sign in with ChatGPT" (that's Codex-specific)

### Option D: Multi-Provider Agentic Layer (Recommended)

**What:** Build a provider-agnostic agentic layer that supports both OpenAI (via Codex SDK or Responses API) and Claude (via Agent SDK), letting users choose based on their existing subscriptions.

**Architecture:**
```
User (Ritemark Sidebar)
  → Agentic UI Layer (React webview)
    → Agent Router (TypeScript)
      ├── OpenAI Provider
      │   ├── Codex SDK (if installed) → ChatGPT auth possible
      │   └── Responses API (API key) → Custom tool loop
      └── Claude Provider
          └── Agent SDK → Anthropic API
    → Shared Tool Layer
      → file_read, file_write, search, execute, web_search
      → markdown-specific: format, insert_citation, create_outline, etc.
```

**Pros:**
- Users choose their preferred/existing provider
- Captures both ChatGPT (70%) and Claude (7%) markets
- Falls back gracefully (Codex SDK optional, API key always works)
- Writing-optimized tools shared across providers
- Existing infrastructure (OpenAI client + Claude SDK) covers both
- Future-proof: add Gemini or other providers later

**Cons:**
- Most complex to build
- Must maintain two provider integrations
- UX must abstract provider differences
- Testing surface area doubles

---

## UX Design: What the Industry Has Learned

### The 7 Patterns That Work

Based on analysis of Cursor, Windsurf, Copilot, Claude Cowork, Cline, and Codex App:

#### 1. Progressive Autonomy (Three-Mode Pattern)

| Mode | Risk | Agent Can Do | User Must Do |
|------|------|--------------|--------------|
| **Chat** | Zero | Answer questions, explain, plan | Nothing |
| **Assist** | Low | Read files, suggest edits | Approve each change |
| **Auto** | Medium | Execute multi-step tasks | Monitor, can pause |

Windsurf calls these Chat/Write/Turbo. This is the clearest mental model for non-technical users.

#### 2. Activity Feed (Not Terminal Output)

Replace terminal-style output with a structured activity feed:

```
[Thinking] Planning how to reorganize your notes...
[Reading]  ~/Documents/research/chapter-3.md
[Writing]  Created outline with 5 sections
[Searching] Finding related notes about "climate data"
[Done]     Reorganized 3 files, created 1 new outline
```

Each step is a card with an icon, timestamp, and optional expand for details. Non-technical users understand this immediately.

#### 3. Undo > Approval

Research shows users click "approve" without reading diffs. The real safety net is easy undo:

- **Per-step checkpoints** (Cline's approach -- gold standard)
- **"Undo Last Action" button** always visible (Copilot's approach)
- **Snapshot timeline** with visual comparison and one-click restore

For Ritemark: every agent action creates a checkpoint. A timeline slider lets users scrub back to any point.

#### 4. Folder-Permission Model

Claude Cowork's insight: non-technical users understand "this folder" better than "this git branch." Let users designate which folders the agent can access. Clear, visual, no technical knowledge required.

#### 5. Show the "Why", Not Just the "What"

Non-technical users cannot evaluate a diff. But they CAN evaluate:
> "I'm moving the methodology section before the results because academic papers typically follow Introduction -> Methodology -> Results -> Discussion order."

The agent's explanation IS the interface for non-developers.

#### 6. Writing-Specific Agent Skills

Unlike code agents, a writing agent needs:

| Skill | What It Does |
|-------|-------------|
| Reorganize | Move sections, restructure outlines |
| Research | Search notes (RAG), find citations, summarize sources |
| Expand | Elaborate on bullet points, add detail |
| Edit | Grammar, clarity, tone adjustment |
| Format | Apply consistent heading levels, fix lists, add metadata |
| Generate | Create outlines, summaries, tables from content |
| Multi-file | Cross-reference between documents, merge notes |

These are fundamentally different from `shell` and `apply_patch`.

#### 7. Background Tasks with Notification

For long-running tasks (reorganize 50 notes, generate summaries for a folder):
- Agent works in the background
- Progress indicator in status bar
- Notification when done with summary
- Review all changes before accepting

---

## Recommended Approach

**UX Decision (Jarmo):** No abstract modes (Chat/Assist/Auto). Instead, a **persistent agent selector dropdown** with concrete agent names. Users pick their agent and it stays until they change it.

```
Agent: [Ritemark Agent ▼]
        ┌─────────────────────┐
        │ Ritemark Agent     ← │  (current chat + RAG, default)
        │ Claude Code          │  (Phase 1: agentic, Claude SDK)
        │ Codex                │  (Phase 2: agentic, OpenAI Codex)
        └─────────────────────┘
```

Each agent is a real product with its own personality, tools, and provider -- not an abstraction layer.

### Phase 1: Claude Code Agent (via Claude Agent SDK)

**Effort:** Medium (infrastructure already exists)
**Impact:** High (proves the concept with existing users)

1. Extract `ClaudeCodeNodeExecutor` patterns into a reusable `AgentRunner`
2. Add agent selector dropdown to `UnifiedViewProvider` sidebar
3. When "Claude Code" is selected, switch to activity feed UI
4. When "Ritemark Agent" is selected, keep current chat UI unchanged
5. Implement activity feed with structured cards
6. Define writing-specific tools (not just code tools)
7. Persist agent selection in VS Code settings

This leverages the proven Claude Agent SDK integration. The ~7% Claude subscription market is small but these are power users who will validate the UX before wider rollout.

### Phase 2: Codex Agent (via OpenAI Codex SDK)

**Effort:** Medium
**Impact:** High (captures ChatGPT market)

1. Add `@openai/codex-sdk` as optional dependency
2. Add "Codex" option to the agent selector dropdown
3. Implement `CodexAgentProvider` with same activity feed UI
4. Map Codex events (tool calls, file changes) to shared card types
5. Handle "Sign in with ChatGPT" flow if Codex CLI is installed

### Phase 3: Custom OpenAI Agent (API Key Users)

**Effort:** Medium-High
**Impact:** Medium (catches users without Codex CLI installed)

1. Implement agentic loop using OpenAI Responses API directly
2. Add as "OpenAI Agent" option in the selector (or merge with Codex option)
3. Custom writing-optimized tools (not shell/apply_patch)
4. Same activity feed and card types

### Phase 4: Polish & Future Agents

1. Unified settings panel for all agents
2. Smart agent recommendation based on available API keys
3. Per-agent capability indicators in the dropdown
4. Gemini Agent option when/if Google ships agent SDK

---

## Critical Decision: ChatGPT Subscription Leverage

The promise of "leveraging ChatGPT subscriptions" has a catch:

| Method | ChatGPT Sub Works? | Notes |
|--------|-------------------|-------|
| Codex CLI "Sign in with ChatGPT" | Yes, with limits | $5-$50 credits, then API billing |
| Codex SDK (our app spawns Codex) | Yes, inherits CLI auth | User must have Codex CLI installed |
| OpenAI API key directly | No | Separate billing system |
| ChatGPT web interface | No API access | Cannot embed |

**Reality:** There is no way to get free, unlimited API access from a ChatGPT subscription. The Codex "Sign in with ChatGPT" flow gives limited credits. After that, it's standard API pricing.

**Strategic implication:** The real value of Codex integration is not free API calls -- it's that users with ChatGPT subscriptions already have an account and can start using Codex with minimal friction (the credits help them try it). The long-term model is API key billing, same as Claude.

---

## Proposed UI Mockup (Conceptual)

```
+-----------------------------------------------+
| Agent: [Claude Code ▼]                         |
+-----------------------------------------------+
| How can I help with your writing?              |
|                                                |
| User: Reorganize my research notes into a      |
|       proper thesis outline                    |
|                                                |
| [Thinking] Analyzing your research folder...   |
|   > Found 23 markdown files in ~/research/     |
|   > Identified 5 topic clusters               |
|                                                |
| [Reading] notes/methodology.md                 |
| [Reading] notes/literature-review.md           |
| [Reading] notes/data-analysis.md               |
|   > Read 12 of 23 files                       |
|                                                |
| [Planning] Proposed outline:                   |
|   1. Introduction (from intro-draft.md)        |
|   2. Literature Review (from 4 source files)   |
|   3. Methodology (from methodology.md)         |
|   4. Results (from data-analysis.md + ...)     |
|   5. Discussion (new, synthesized)             |
|                                                |
| [Writing] Creating thesis-outline.md           |
|   "Moving methodology before results because   |
|    this follows standard academic structure"    |
|                                                |
| [Done] Created thesis-outline.md               |
|   3 files reorganized, 1 new file created      |
|   Duration: 4.2s | Cost: $0.08                 |
|                                                |
|   [Review Changes] [Undo All]                  |
+-----------------------------------------------+
| [Type a message...]                   [Send]   |
+-----------------------------------------------+
```

Key UX elements:
- **Agent selector** (top): Persistent dropdown -- Ritemark Agent / Claude Code
- **Activity feed**: Structured cards, not terminal output (only in Claude Code)
- **Explanations**: Agent explains WHY, not just what
- **Review changes**: Diff view before accepting
- **Switching to "Ritemark Agent"** restores the familiar chat UI instantly

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Codex "Sign in with ChatGPT" auth is Codex-specific, can't use in our app directly | High | Use Codex SDK which inherits CLI auth; also support API keys |
| ChatGPT credits exhaust quickly for heavy users | Medium | Clear cost communication; support API keys as primary |
| Claude Agent SDK requires Claude subscription/API key | Medium | Position as premium feature; focus on Codex for mass market |
| Agent makes destructive changes to user's files | High | Per-step checkpoints, folder permissions, undo timeline |
| Bundling Codex binary increases app size | Low | Make Codex optional; detect if already installed |
| Two providers = double maintenance | Medium | Shared tool layer and activity feed UI |
| Users don't understand agentic mode | Medium | Progressive autonomy; start in Chat mode by default |

---

## Next Steps (If Approved)

1. **Sprint planning** for Phase 1 (Claude Agent SDK in main AI view)
2. **UX design** for the activity feed and three-mode selector (invoke `ux-expert`)
3. **Technical spike** on extracting `ClaudeCodeNodeExecutor` into reusable `AgentRunner`
4. **Codex SDK evaluation** -- install and test `@openai/codex-sdk` integration
5. **User research** -- what tasks do Ritemark users actually want an agent for?

---

## Appendix: Competitive Positioning

| Feature | Cursor | Windsurf | Copilot | Ritemark (Proposed) |
|---------|--------|----------|---------|---------------------|
| Target user | Developers | Developers | Developers | **Writers & researchers** |
| Primary task | Code | Code | Code | **Markdown & knowledge work** |
| Multi-provider | No (OpenAI) | No (Codeium) | No (GitHub/OpenAI) | **Yes (OpenAI + Claude)** |
| RAG/knowledge base | No | Yes (indexing) | No | **Yes (Orama vectors)** |
| Visual workflows | No | No | No | **Yes (Flows)** |
| Writing-specific tools | No | No | No | **Yes (planned)** |
| Image generation | No | No | No | **Yes (GPT Image + Imagen)** |
| Terminal required | No | No | No | **No** |

Ritemark's differentiator: **the first agentic AI assistant purpose-built for writing and research, not coding.**
