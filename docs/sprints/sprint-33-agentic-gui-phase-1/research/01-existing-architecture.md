# Existing Architecture Analysis

**Sprint 33: Agentic GUI - Phase 1**
**Date:** 2026-02-07

## What Already Exists

### 1. Claude Agent SDK Integration (Production)

Location: `extensions/ritemark/src/flows/nodes/ClaudeCodeNodeExecutor.ts`

**Current capabilities:**
- Dynamic ES module import of `@anthropic-ai/claude-agent-sdk`
- Full tool access: Bash, Read, Write, Edit, Glob, Grep
- Autonomous execution via `bypassPermissions` mode
- Progress tracking with typed events: init, tool_use, thinking, text, done
- File modification tracking
- Cost tracking (duration + USD)
- Timeout/abort support with AbortController
- Variable interpolation for prompt templates

**Key implementation details:**
```typescript
const query = await getQuery(); // Dynamic import
const result = query({
  prompt: interpolatedPrompt,
  options: {
    cwd: context.workspacePath,
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
    allowedTools: ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep'],
    abortController,
  },
});
```

**Event stream:**
- `system`: Model initialization
- `assistant`: Content blocks (text, tool_use)
- `result`: Success/failure with duration and cost

**File tracking:**
- Write/Edit tools trigger file modification tracking
- Returns list of all modified files
- Tracks both relative and basename for display

### 2. Unified AI View (Production)

Location: `extensions/ritemark/src/views/UnifiedViewProvider.ts`

**Current features:**
- Left sidebar chat interface (Primary Sidebar)
- Smart context detection (selection → edit, question → RAG)
- RAG integration with Orama vector store
- OpenAI LLM chat with streaming
- API key management
- Connectivity monitoring
- Selection tracking from active editor
- Index status footer
- Citation display for RAG results
- Widget system for inline tool previews

**Architecture:**
- WebviewViewProvider (VS Code sidebar)
- Message-based communication (postMessage)
- Conversation history tracking
- Abort controller for cancellation

**Current message handlers:**
- `ai-execute`: Execute prompt with optional RAG context
- `ai-cancel`: Abort current request
- `execute-widget`: Execute tool in editor
- `reindex`: Re-index documents for RAG

### 3. OpenAI Integration (Production)

Location: `extensions/ritemark/src/ai/openAIClient.ts`

**Capabilities:**
- OpenAI Responses API (GPT-5.2, GPT-4o family)
- Streaming support with token-by-token delivery
- Tool calling (widgets for text editing)
- Conversation history
- Abort signal support
- Model configuration via `modelConfig.ts`

**Not agentic:**
- Single LLM call per user message
- No multi-step reasoning
- No file system tools (Read/Write/Edit)
- Limited to chat and text editing widgets

### 4. RAG System (Production)

Location: `extensions/ritemark/src/rag/`

**Features:**
- Orama-based vector store
- Markdown file indexing
- Semantic search with citations
- Document chunking
- Source attribution with page/section

### 5. Flows System (Production)

Location: `extensions/ritemark/src/flows/`

**Features:**
- Visual DAG workflow editor
- 5 node types: Input, LLM, ClaudeCode, Image, Output
- Execution engine with abort support
- Progress tracking
- File modification tracking

## Gaps for Agentic GUI

### What's Missing

1. **No AgentRunner service**
   - ClaudeCodeNodeExecutor is Flow-specific
   - Cannot be called from sidebar or other contexts
   - Needs extraction into reusable service

2. **No agent mode selector**
   - Chat is the only mode
   - No Assist (approval-required) mode
   - No Auto (autonomous) mode

3. **No activity feed UI**
   - Terminal-style output in Flows
   - No structured activity cards
   - No tool/file/status categorization

4. **No checkpoint/undo system**
   - Agent changes are immediate
   - No per-step rollback
   - No timeline/history view

5. **No folder permissions**
   - Agent has full workspace access
   - No user-controlled boundaries
   - No "safe folder" concept

6. **No writing-specific tools**
   - Tools are code-focused (Bash, Edit, Grep)
   - No reorganize, expand, format, research
   - RAG is separate from agent tools

## Reusable Components

### Can Be Reused

1. **ClaudeCodeNodeExecutor patterns:**
   - Dynamic SDK import
   - Event stream parsing
   - File modification tracking
   - Cost/duration tracking
   - Abort controller pattern

2. **UnifiedViewProvider patterns:**
   - Webview communication
   - Streaming progress updates
   - API key management
   - Connectivity monitoring

3. **RAG system:**
   - Vector search
   - Citation building
   - Document indexing

### Must Be Refactored

1. **Progress UI:**
   - Replace terminal output with activity cards
   - Add icons for different tool types
   - Group by operation type

2. **Permission model:**
   - Add folder selection UI
   - Implement path validation
   - Communicate restrictions to SDK

3. **Tool definitions:**
   - Add writing-focused tools
   - Integrate RAG as a tool
   - Keep Bash/Read/Write/Edit for power users

## Technical Constraints

1. **Claude Agent SDK is ESM-only**
   - Requires dynamic import with Function constructor
   - Cannot use static import in CommonJS extension

2. **Webview architecture**
   - React + Vite
   - Must stay under 5MB bundle size
   - CSP restrictions apply

3. **VS Code API limits**
   - Cannot use worker threads in webview easily
   - Must use postMessage for all communication
   - SecretStorage for API keys

## Next Steps

See `02-extraction-strategy.md` for plan to extract AgentRunner from ClaudeCodeNodeExecutor.
