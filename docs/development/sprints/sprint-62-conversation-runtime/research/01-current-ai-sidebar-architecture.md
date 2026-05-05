# Current AI Sidebar Architecture Audit

## Summary

The current implementation already has the raw pieces for Claude, Codex, and legacy RAG chat, but the product model is still agent-first rather than conversation-first.

The most important architectural issue is that state is split across three conversation arrays:

- `chatMessages` and `conversationHistory` for the legacy Ritemark Document Agent.
- `agentConversation` for Claude Code.
- `codexConversation` for Codex.

Saved conversations then store all three arrays together but still keep one metadata-level `agentId`. This makes a mixed-runtime conversation possible as stored data, but not cleanly represented as the main model.

## Key Files

- `extensions/ritemark/webview/src/components/ai-sidebar/types.ts`
- `extensions/ritemark/webview/src/components/ai-sidebar/store.ts`
- `extensions/ritemark/webview/src/components/ai-sidebar/chatHistoryStorage.ts`
- `extensions/ritemark/webview/src/components/ai-sidebar/AgentSelector.tsx`
- `extensions/ritemark/webview/src/components/ai-sidebar/ChatView.tsx`
- `extensions/ritemark/webview/src/components/ai-sidebar/AgentView.tsx`
- `extensions/ritemark/webview/src/components/ai-sidebar/CodexView.tsx`
- `extensions/ritemark/src/agent/types.ts`
- `extensions/ritemark/src/agent/AgentRunner.ts`
- `extensions/ritemark/src/codex/codexManager.ts`

## Current Data Model

`AgentId` is currently:

```ts
export type AgentId = 'ritemark-agent' | 'claude-code' | 'codex';
```

This type exists in both webview and extension-side types. The backend `AGENTS` registry still includes `ritemark-agent`, labeled as "Ritemark Document Agent".

The store initializes with:

```ts
selectedAgent: 'ritemark-agent'
selectedModel: 'claude-sonnet-4-5'
codexSelectedModel: 'gpt-5.3-codex'
```

This means the initial mental model is still "choose an agent", not "start a conversation and choose runtime per run".

## Current Runtime Flows

### Legacy Ritemark Agent

`ChatView` uses `chatMessages`, `streamingContent`, and `sendChatMessage()`.

`sendChatMessage()` sends:

```ts
type: 'ai-execute'
prompt
selection
conversationHistory
```

This path is the legacy document/RAG assistant. It should be deprecated from the primary agent selector during this sprint. If RAG remains valuable, it should become a tool/capability that Claude/Codex/future runners can use rather than a peer "agent" in the selector.

### Claude

Claude uses `agentConversation` and `sendAgentMessage()`.

The extension-side runner is `AgentRunner.ts`, which imports `@anthropic-ai/claude-agent-sdk` dynamically and uses `query()`.

The current Claude runner already supports:

- one-shot execution for flows
- persistent multi-turn `AgentSession`
- streaming progress events
- plan approval through `ExitPlanMode`
- user questions through `AskUserQuestion`
- subagent progress
- file attachments
- active file context

This is the strongest existing runtime implementation and should become one adapter behind a unified conversation/run model.

### Codex

Codex uses `codexConversation` and `sendCodexMessage()`.

`CodexManager` locates either bundled or system Codex runtimes and launches `codex app-server` or the Codex CLI. The current Codex path has provider-specific support for:

- ChatGPT authentication
- approval requests
- user-input requests
- plan updates
- compatibility detection for audited app-server ranges
- model selection via `codexSelectedModel`

Codex already has richer plan update semantics than the legacy Ritemark Agent. This should remain provider-specific payload inside the unified run type.

## Saved Conversation Storage

`chatHistoryStorage.ts` stores:

```ts
export interface SavedConversation {
  id: string;
  title: string;
  agentId: AgentId;
  createdAt: number;
  updatedAt: number;
}

export interface SavedConversationData extends SavedConversation {
  agentConversation: AgentConversationTurn[];
  codexConversation?: CodexConversationTurn[];
  chatMessages: ChatMessage[];
  conversationHistory: ConversationEntry[];
}
```

This is a useful migration point. The new schema should keep legacy loading, then normalize into a conversation with typed runs.

## Product/Architecture Gaps

1. `agentId` is conversation metadata, but it should become run metadata.
2. `selectedAgent` drives cancel behavior and view routing, but mixed conversations need active-run routing.
3. Plan approval and question answering are separate Claude/Codex actions; they need runtime-aware dispatch.
4. The history list badge currently assumes one agent per conversation.
5. Legacy Ritemark Agent has a dedicated view and selector entry, even though the desired future is runtime-based Claude/Codex/future SDKs.
6. Codex and Claude model selectors are grouped under one dropdown, but there is no global conversation input with per-run settings.

## Recommended Target Model

Introduce a product-facing model shaped like:

```ts
type RuntimeId = 'claude' | 'codex' | 'legacy-ritemark';
type RunMode = 'plan' | 'edit';

interface ConversationRun {
  id: string;
  runtimeId: RuntimeId;
  modelId: string;
  mode: RunMode;
  thinkingEffort?: string;
  userPrompt: string;
  activeFilePath?: string;
  attachments?: FileAttachment[];
  status: 'running' | 'waiting-for-user' | 'complete' | 'error' | 'cancelled';
  createdAt: number;
  completedAt?: number;
  providerPayload: ClaudeRunPayload | CodexRunPayload | LegacyRitemarkRunPayload;
}
```

The exact names can change during implementation, but the product principle should hold: the run owns runtime/model/mode; the conversation owns continuity.

## Ritemark Agent Deprecation Notes

Deprecation should be staged:

1. Keep `ritemark-agent` in legacy types until migration is complete.
2. Remove it from the visible default selector.
3. Preserve loading old `chatMessages` history.
4. Add a migration path that maps old RAG chat records to `legacy-ritemark` runs or read-only legacy messages.
5. Decide later whether RAG becomes a callable tool inside real agent runtimes.

## Suggested Implementation Order

1. Add conversation/run types and migration helpers.
2. Add tests for legacy saved conversation normalization.
3. Switch history save/load to new schema while writing old fields only if needed for compatibility.
4. Update UI rendering to map unified runs into Claude/Codex/legacy message components.
5. Deprecate Ritemark Agent in selector.
6. Move runtime/model/mode controls into the input area.
7. Route cancel/approve/question actions by active run runtime.
