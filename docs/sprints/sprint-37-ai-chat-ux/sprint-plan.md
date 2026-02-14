# Sprint 37: AI Chat UX

## Goal

Enhance the AI chat experience with advanced UX features: subagent visualization, conversation history persistence, @ agent mentions, drag-and-drop file context, slash commands for skills, and chat font size customization.

## Feature Flag Check

- [x] Does this sprint need a feature flag? -   YES for some features:      -   **Subagent GUI**: Extends existing Claude Code agent (already gated by `agentic-assistant` flag)      -   **Chat Histories**: No flag needed (non-destructive, always useful)      -   **@ Agent Mentions & Drag-Drop**: No flag needed (enhances existing chat input)      -   **Slash Commands**: No flag needed (enhances existing chat input)      -   **Chat Font Size**: No flag needed (settings feature)

**Result:** No NEW feature flag required. Subagent features inherit the existing `agentic-assistant` flag.

## Success Criteria

- [ ] Subagents (Task tool) display as collapsible nested sections in the activity feed
- [ ] Subagent progress, status, and output visible inline in the conversation
- [ ] Users can view a list of previous chat sessions (by date/title)
- [ ] Users can resume/continue a previous conversation
- [ ] Users can delete old conversations
- [ ] Conversations auto-save after each turn
- [ ] Typing `@` in chat input triggers autocomplete for agents
- [ ] `@agent` (e.g., `@sprint-manager`, `@webview-expert`) engages a specific subagent for specialized tasks
- [ ] Drag & drop files/folders from Explorer into chat input inserts their path
- [ ] Dropped paths appear as styled chips in the input
- [ ] Typing `/` in chat input shows available commands for Claude Code.
- [ ] Built-in skills like `/summarize`, `/translate` work
- [ ] Slash commands autocomplete with descriptions
- [ ] Settings includes chat font size option
- [ ] Font size changes apply immediately to AI chat interface

## Deliverables

| Deliverable | Description |
| --- | --- |
| Subagent UI | Visual representation of Task tool subagents with collapsible sections, status indicators |
| Chat history storage | LocalStorage/VS Code state persistence for conversation sessions |
| History browser UI | Sidebar component showing past conversations with resume/delete actions |
| @ agent mentions | Autocomplete popup for `@agent` references. Agents loaded on session init. Example: `@sprint-manager start a sprint planning` |
| Drag & drop file context | Drag files/folders from Explorer into chat input → inserts path as styled chip. Claude Code reads the file itself. |
| Agent routing | `@agent` routes the message to a specific subagent (e.g., `@sprint-manager`, `@vscode-expert`, `@webview-expert`) |
| Slash command parser | `/` trigger with command autocomplete and execution |
| Built-in skills | `/summarize`, `/translate`, `/rewrite`, `/expand` commands |
| Font size setting | Setting in RitemarkSettings for chat interface font size |

## Implementation Checklist

### Phase 1: Research

- [x] Analyze Claude Agent SDK for Task tool / subagent events
- [x] Document current conversation state structure
- [x] Research VS Code state persistence limits and best practices
- [x] Research VS Code webview drag & drop API (Explorer → webview drop data format)
- [x] Analyze React autocomplete patterns for @ agent mentions
- [x] Research slash command implementations in similar apps (Notion, Slack)
- [x] Document current font handling in chat components

**Research Summary:**

1. **SDK Subagent Support:** The SDK provides `SDKTaskNotificationMessage`, `SDKToolProgressMessage` with `parent_tool_use_id`, `SubagentStart`/`SubagentStop` hooks, and `AgentInput` tool schema. Subagents are spawned via the `Agent` tool.

2. **State Structure:** Zustand store with `agentConversation: AgentConversationTurn[]`. Each turn has `activities`, `result`, `isRunning`, etc. Need to add `subagents?: SubagentProgress[]`.

3. **VS Code State:** `vscode.getState()`/`setState()` persists across hide/show. For chat histories, use localStorage with 5-10MB limit and cleanup strategy.

4. **Drag & Drop:** Webviews cannot directly receive Explorer drops. Need extension-side handling via `vscode.DataTransfer` API, forward URIs to webview.

5. **@ Mentions:** Custom autocomplete with trigger detection, cursor positioning, keyboard navigation. Can reference TipTap mention extension pattern.

6. **Slash Commands:** `/` at line start triggers menu. SDK exposes `Query.supportedCommands()`. Custom commands for summarize, translate, rewrite, expand, fix.

7. **Font Handling:** Currently hardcoded 12px/11px. Need CSS variable `--chat-font-size` applied from settings.

### Phase 2: Subagent GUI

The Claude Agent SDK emits progress for subagents spawned via the Task tool. Currently these appear as generic tool\_use events. This phase adds proper visual representation.

#### 2.1 Backend (Extension)

- [x] Update `AgentRunner.ts` to detect Task tool usage in content blocks
- [x] Create new progress type: `'subagent_start'`, `'subagent_progress'`, `'subagent_done'`
- [x] Parse subagent task description from tool input
- [x] Track subagent hierarchy (parent turn ID -> subagent IDs)
- [x] Forward subagent events to webview with parent context

#### 2.2 Types

- [x] Add `SubagentProgress` interface in `types.ts`
- [x] Update `AgentConversationTurn` to include `subagents?: SubagentProgress[]`
- [x] Add `ExtensionMessage` types for subagent events

#### 2.3 Webview Store

- [x] Update `store.ts` to handle subagent progress messages
- [x] Track subagents within their parent turn
- [x] Update subagent status on completion

#### 2.4 Webview UI

- [x] Create `SubagentCard.tsx` component with collapsible section, status indicator, nested activity feed
- [x] Update `AgentView.tsx` to render subagent cards within turns
- [x] Update `RunningIndicator.tsx` to show subagent spawning
- [x] Add visual hierarchy (indentation, border-left, connecting lines)

### Phase 3: Chat Histories

Persistent conversation management so users can browse and resume past chats.

#### 3.1 Storage Layer

- [x] Create `chatHistoryStorage.ts` in webview: -   `saveConversation(id, data)`: Save to localStorage      -   `loadConversation(id)`: Load from localStorage      -   `listConversations()`: List all saved with metadata      -   `deleteConversation(id)`: Remove from storage      -   `generateId()`: Unique conversation ID
- [x] Define storage schema: ```typescript interface SavedConversation {   id: string;   title: string;        // First user message or generated   agentId: AgentId;   createdAt: number;   updatedAt: number;   turns: AgentConversationTurn[] | ChatMessage[]; } ```
- [x] Handle localStorage limits (5-10MB typical) with cleanup strategy

#### 3.2 Store Integration

- [x] Add `currentConversationId` to store state
- [x] Add `savedConversations: SavedConversation[]` metadata list
- [x] Add `loadConversationList()` action (on init)
- [x] Add `saveCurrentConversation()` action (after each turn)
- [x] Add `loadConversation(id)` action
- [x] Add `deleteConversation(id)` action
- [x] Add `startNewConversation()` action
- [x] Auto-save on `agentConversation` or `chatMessages` change

#### 3.3 History Browser UI

- [x] Create `ChatHistoryPanel.tsx`: -   List of saved conversations      -   Date grouping (Today, Yesterday, This Week, Older)      -   Title + timestamp + agent badge      -   Click to resume conversation      -   Delete button with confirmation      -   "New Chat" button at top
- [x] Add history toggle button to `AISidebar.tsx` header
- [x] Animate panel slide-in/out
- [x] Empty state for no history

#### 3.4 Conversation Management

- [x] Clear button creates new conversation (not delete)
- [x] Conversation title auto-generated from first message
- [x] Limit stored conversations (e.g., 50 most recent)
- [x] Storage cleanup removes oldest when limit exceeded

### Phase 4: @ Agent Mentions & Drag-and-Drop File Context

Two ways to add context to chat: `@agent` mentions for routing to specialized agents, and drag & drop from Explorer for file/folder paths.

#### 4.1 Agent Registry

- [x] Define available agents list in `agentRegistry.ts` with 8 agents: sprint-manager, vscode-expert, webview-expert, qa-validator, release-manager, product-marketer, ux-expert, knowledge-builder
- [x] Filter and search functions: `filterAgents()`, `findAgent()`, `parseMentions()`

#### 4.2 @ Agent Autocomplete UI

- [x] Created `AgentMentionPopup.tsx` with keyboard navigation, Bot icon, fuzzy filter
- [x] Updated `ChatInput.tsx` to detect `@` trigger, show popup, insert `@agent-id` on selection
- [x] Visual badge strip showing which agents are mentioned in the current input

#### 4.3 Drag & Drop File Context

- [x] Added drag & drop zone to `ChatInput.tsx` with visual overlay indicator
- [x] Extract file/folder paths from VS Code URI (`text/uri-list` or `text/plain`)
- [x] Path chips with file icon, truncated path, and remove button
- [x] Multiple paths supported, duplicates prevented

#### 4.4 Context Injection

- [x] `parseMentions()` extracts `@agent` mentions from input
- [x] Dropped file paths are prepended to the message as `[File: /path/to/file]` format
- [x] Mentioned agents shown as visual badges above input
- **Note:** Agent routing to specific system prompts is handled by Claude Code itself (agents are in `.claude/agents/`)

### Phase 5: Slash Commands

`/` triggered command system with autocomplete and built-in skills.

#### 5.1 Command Registry

- [x] Created `slashCommands.ts` with 8 commands: summarize, translate, rewrite, expand, fix, explain, outline, simplify
- [x] Each command has `buildPrompt()` function that generates AI prompt from args and context
- [x] `filterCommands()`, `findCommand()`, `parseCommand()` utility functions

#### 5.2 Command Autocomplete UI

- [x] Created `SlashCommandPopup.tsx` with keyboard navigation, icons (lucide-react), descriptions
- [x] Updated `ChatInput.tsx` to detect `/` at start of input, show popup, insert command on selection

#### 5.3 Built-in Skills Implementation

- [x] `/summarize` - Summarizes selection/document with optional length hint
- [x] `/translate [language]` - Translates selection to target language
- [x] `/rewrite [style]` - Rewrites selection in specified style
- [x] `/expand [focus]` - Expands selection with more detail
- [x] `/fix` - Fixes grammar and spelling
- [x] `/explain` - Explains selected text or concept
- [x] `/outline` - Creates structured outline from document
- [x] `/simplify` - Simplifies complex text

#### 5.4 Execution Flow

- [x] `parseCommand()` extracts command and args from input
- [x] `executeCommand()` builds prompt using selection context and sends to AI
- [x] Works with both Ritemark Agent and Claude Code modes

### Phase 6: Chat Font Size Setting

User-adjustable font size for accessibility and readability.

#### 6.1 Settings Integration

- [x] Added `ritemark.chat.fontSize` setting to `package.json` (number, default 13, min 10, max 20)
- [ ] Read setting in `UnifiedViewProvider` (TODO: wire extension side)
- [ ] Send to webview on init and setting change (TODO: wire extension side)

#### 6.2 Settings UI

- [x] Added "Chat Appearance" section to `RitemarkSettings.tsx`
- [x] Range slider (10-20px) with live preview
- [x] Current size displayed as "13px" format

#### 6.3 Webview Implementation

- [x] Added `chatFontSize` to store state (default 13)
- [x] Handle `settings:chatFontSize` message in store
- [x] Apply font size via CSS variable: `--chat-font-size`
- [x] Updated `ChatMessage.tsx` and `AgentResponse.tsx` to use CSS variable
- [x] `AISidebar.tsx` initializes CSS variable on mount

### Phase 7: Testing & Polish

- [ ] Test subagent visualization with real Task tool usage
- [ ] Test conversation persistence across app restarts
- [ ] Test @ agent mention autocomplete
- [ ] Test drag & drop from Explorer into chat input
- [ ] Test slash command execution
- [ ] Test font size changes
- [ ] Cross-test between Ritemark Agent and Claude Code modes
- [ ] Performance test with large conversation history

### Phase 8: Documentation

- [ ] Update WISHLIST.md to mark completed items
- [ ] Document new features in sprint notes
- [ ] Create user-facing documentation if needed

## Technical Notes

### Subagent Detection

The Claude Agent SDK's Task tool appears in content blocks like:

```typescript
{
  type: 'tool_use',
  name: 'Task',
  input: {
    prompt: 'Subagent task description...',
    // other options
  }
}
```

Subagent progress is interleaved with parent agent progress. We need to track hierarchy via:

1.  Task tool\_use block starts a subagent
    
2.  Subsequent messages until result may be subagent activity
    
3.  SDK may provide parent\_tool\_use\_id for correlation
    

### Storage Limits

localStorage typically has 5-10MB limit. Conversation storage strategy:

-   Store minimal metadata in memory (id, title, timestamps)
    
-   Full conversation data stored keyed by ID
    
-   Automatic cleanup of oldest conversations when approaching limit
    
-   Consider IndexedDB for larger storage needs (future enhancement)
    

### @ Agent Mention Resolution

**`@agent` behavior:**
- Message is sent to Claude Code with the agent's system prompt prepended
- Agent system prompts live in `.claude/agents/{agent-id}.md`
- Available agents: `sprint-manager`, `vscode-expert`, `webview-expert`, `qa-validator`, `release-manager`, `product-marketer`, `ux-expert`, `knowledge-builder`
- Example: `@sprint-manager create sprint 38 for dark mode` → Claude Code receives the sprint-manager agent instructions + user message
- Multiple `@agent` mentions in one message: each agent runs as a parallel subagent (visible in Subagent GUI)

### Drag & Drop File Context

**How it works:**
- User drags file/folder from VS Code Explorer into chat input area
- Drop event extracts the VS Code URI → converts to workspace-relative path
- Path is inserted into the message as a styled chip (e.g., `src/extension.ts`)
- When sent, the path is included as plain text in the message — Claude Code uses its own Read/Glob tools to access the file
- No file content is read or injected by Ritemark — keeps it simple and avoids size limits

### Slash Command Context

Commands have access to:

-   Current editor selection (if any)
    
-   Current document content
    
-   Previous conversation context
    
-   Arguments provided after command name
    

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Subagent events not exposed by SDK | Medium | HIGH | Research SDK docs thoroughly; fallback to inferring from tool\_use patterns |
| localStorage limits exceeded | Low | Medium | Implement cleanup strategy; warn user when approaching limit |
| Explorer drag & drop not working in webview | Medium | Medium | Research VS Code webview drop API; may need extension-side drop handler |
| Slash command conflicts with typing | Low | Low | Only trigger at line start; escape sequence to bypass |
| Font size breaks layout | Low | Low | Test edge cases (10px, 20px); constrain to safe range |

## Dependencies

-   Existing `agentic-assistant` feature flag for subagent features
    
-   VS Code webview drag & drop API for file context
    
-   localStorage API for conversation persistence
    
-   Current chat/agent infrastructure from Sprint 33
    

## Status

**Current Phase:** 7 (TESTING & POLISH)
**Approval Required:** No (Jarmo approved full sprint)

### Implementation Summary (Phases 4-6 completed)

**Phase 4 - @ Agent Mentions & Drag-and-Drop:**
- Created `AgentMentionPopup.tsx` and `agentRegistry.ts`
- Updated `ChatInput.tsx` with `@` detection, mention popup, drag-and-drop support
- Path chips for dropped files, agent badges for mentions

**Phase 5 - Slash Commands:**
- Created `SlashCommandPopup.tsx` and `slashCommands.ts`
- 8 built-in commands: summarize, translate, rewrite, expand, fix, explain, outline, simplify
- Updated `ChatInput.tsx` with `/` detection and command execution

**Phase 6 - Chat Font Size:**
- Added `ritemark.chat.fontSize` setting to `package.json`
- Added Chat Appearance section to `RitemarkSettings.tsx` with slider and preview
- Updated `store.ts`, `ChatMessage.tsx`, `AgentResponse.tsx` to use `--chat-font-size` CSS variable
- NOTE: Extension-side wiring (UnifiedViewProvider) still needed to send setting to webview

## Approval

- [x] Jarmo approved this sprint plan