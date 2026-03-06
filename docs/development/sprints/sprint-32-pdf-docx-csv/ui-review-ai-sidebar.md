# UI Review: AI Sidebar (Agentic GUI)

Branch: `claude/research-agentic-gui-W4mOx`

## Current Architecture

The AI sidebar is a **raw HTML webview** defined inline in `UnifiedViewProvider.ts` (lines ~600-1278). It is NOT part of the React/TipTap webview — it's a completely separate VS Code webview with vanilla JS.

## Message Types Overview

### Extension → Webview (postMessage)

| Message Type | Purpose | Data |
|---|---|---|
| `ai-key-status` | API key configured? | `hasKey: boolean` |
| `connectivity-status` | Online/offline state | `isOnline: boolean` |
| `clear-chat` | Reset conversation | — |
| `ai-streaming` | Streaming token chunk | `content: string` (full accumulated text) |
| `ai-result` | Final AI response | `message: string`, `hasRagContext: boolean` |
| `rag-results` | Search results for citations | `results: [{source, page, citation}]` |
| `ai-widget` | Tool call preview (edit, insert) | `toolName, args, selection` |
| `ai-error` | Error message | `error: string` |
| `ai-stopped` | Generation cancelled | — |
| `selection-update` | User selected text in editor | `selection: {text, isEmpty, from, to}` |
| `index-status` | RAG index stats | `totalDocs, totalChunks` |
| `index-progress` | Indexing progress | `processed, total, current` |
| `index-done` | Indexing complete | — |
| `agent:config` | Agent feature config on init | `agenticEnabled, selectedAgent, agents[]` |
| `agent-progress` | Claude Code activity event | `progress: {type, message, tool?, file?}` |
| `agent-result` | Claude Code completion | `text, filesModified[], metrics, error?` |

### Webview → Extension (postMessage)

| Message Type | Purpose | Data |
|---|---|---|
| `ready` | Webview initialized | — |
| `ai-configure-key` | Open API key config | — |
| `ai-execute` | Send prompt (Ritemark Agent) | `prompt, selection, conversationHistory` |
| `ai-cancel` | Cancel Ritemark Agent | — |
| `ai-execute-agent` | Send prompt (Claude Code) | `prompt` |
| `ai-cancel-agent` | Cancel Claude Code | — |
| `ai-select-agent` | Switch agent | `agentId` |
| `execute-widget` | Apply tool call | `toolName, args, selection` |
| `reindex` | Start RAG indexing | — |
| `cancelIndex` | Cancel indexing | — |
| `open-source` | Open cited file | `filePath, page?` |

## Agent Progress Event Types

From `src/agent/types.ts`:

| Type | Icon | Label | When |
|---|---|---|---|
| `init` | `>` | Starting | Agent execution begins |
| `thinking` | `?` | Thinking | Model is reasoning |
| `tool_use` | `#` | (tool name) | Agent uses a tool (read, write, bash, etc.) |
| `text` | `>` | (none) | Agent produces text output |
| `done` | `+` | Done | Agent finished successfully |
| `error` | `!` | Error | Agent encountered error |
| `user-prompt` | `>` | You | User's input (added client-side) |

## UI Components

### 1. Agent Selector (top bar)
- Simple `<select>` dropdown: "Ritemark Agent" / "Claude Code (experimental)"
- Only visible when `agenticEnabled && hasApiKey`
- Persists choice in VS Code settings

### 2. Chat Messages (Ritemark Agent mode)
- User messages: right-aligned blue
- Assistant messages: left-aligned, with basic markdown rendering
- Streaming: shows accumulated text with blinking cursor
- Citations: clickable chips below message
- Widget preview: edit preview with Apply/Discard buttons
- Empty state: "Ask about your documents or edit text"

### 3. Activity Feed (Claude Code mode)
- Replaces chat messages when Claude Code is selected
- Activity cards with icon + label + detail
- Color-coded by type (thinking, tool_use, done, error)
- Shows files modified list and metrics (duration, cost)
- Empty state: "Claude Code can work with your files"

### 4. Input Area (shared)
- Text input + send button
- Stop button (appears during loading)
- Placeholder changes per agent mode

### 5. Footer
- Index stats ("X docs")
- Re-index / Cancel buttons

## Known UI Issues (to review)

1. **Settings page is a stub** — "Settings will be available in a future update"
2. **Agent selector is plain HTML `<select>`** — no styling, feels out of place
3. **Activity feed icons are text characters** (`>`, `?`, `#`, `+`, `!`) — should be proper icons
4. **Markdown renderer is minimal** — regex-based, no tables, no links, no images
5. **No conversation history** for Claude Code mode — only activity cards
6. **Widget preview is raw text** — no syntax highlighting or diff view
7. **No way to see/copy the full agent response text** — only activity cards
8. **Selection indicator** is basic text truncation
9. **The entire sidebar is inline HTML** (~680 lines) — should migrate to React webview
10. **No dark/light theme testing** documented
