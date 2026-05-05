# Target Conversation Model

## Principle

Conversation state becomes provider-neutral. Provider execution remains provider-specific.

This sprint should not rewrite how Claude or Codex work. It should introduce a stable product model around them so the UI can represent one conversation containing multiple runtime runs.

## Current Problem

The AI sidebar stores three parallel conversation models:

- `chatMessages` / `conversationHistory` for the legacy Ritemark Document Agent
- `agentConversation` for Claude
- `codexConversation` for Codex

The active runtime is chosen globally through `selectedAgent`. That leaks into:

- sending messages
- cancelling work
- saving conversation metadata
- loading conversations
- chat history badges
- empty states and view routing

This is workable when one conversation belongs to one agent. It becomes brittle when one conversation can contain Claude and Codex turns.

## Target Types

These names are draft names; implementation can adjust them to local style.

```ts
export type RuntimeId = 'claude-code' | 'codex' | 'legacy-ritemark';

export type ConversationRunMode = 'plan' | 'edit';

export type ConversationRunStatus =
  | 'running'
  | 'waiting-for-user'
  | 'complete'
  | 'error'
  | 'cancelled';

export interface RuntimeSelection {
  runtimeId: RuntimeId;
  modelId: string;
  mode: ConversationRunMode;
  thinkingEffort?: string;
}

export interface ConversationRunBase {
  id: string;
  runtime: RuntimeSelection;
  userPrompt: string;
  activeFilePath?: string;
  attachments?: FileAttachment[];
  status: ConversationRunStatus;
  timestamp: number;
  completedAt?: number;
}

export interface ClaudeConversationRun extends ConversationRunBase {
  runtime: RuntimeSelection & { runtimeId: 'claude-code' };
  providerTurn: AgentConversationTurn;
}

export interface CodexConversationRun extends ConversationRunBase {
  runtime: RuntimeSelection & { runtimeId: 'codex' };
  providerTurn: CodexConversationTurn;
}

export interface LegacyRitemarkConversationRun extends ConversationRunBase {
  runtime: RuntimeSelection & { runtimeId: 'legacy-ritemark' };
  providerTurn: {
    messages: ChatMessage[];
    conversationHistory: ConversationEntry[];
  };
}

export type ConversationRun =
  | ClaudeConversationRun
  | CodexConversationRun
  | LegacyRitemarkConversationRun;

export interface ConversationDocument {
  schemaVersion: 2;
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  runs: ConversationRun[];
}
```

## Runtime Selection State

Keep a current draft runtime selection for the input:

```ts
interface RuntimeDraftSelection {
  runtimeId: 'claude-code' | 'codex';
  modelId: string;
  mode: 'plan' | 'edit';
  thinkingEffort?: string;
}
```

This replaces the product meaning of `selectedAgent`, but it does not have to remove `selectedAgent` immediately. During migration, `selectedAgent` can remain as an adapter to existing extension settings and provider commands.

## Provider Preservation

Claude keeps using:

- `sendAgentMessage()`
- `agentConversation`
- `AgentRunner.ts`
- `@anthropic-ai/claude-agent-sdk`

Codex keeps using:

- `sendCodexMessage()`
- `codexConversation`
- `CodexManager`
- Codex app-server/CLI protocol

The unified conversation model should wrap their provider turns rather than flatten every provider event into a new shared format immediately. That keeps risk low and preserves plan approval/question/streaming behavior.

## Active Run Routing

Actions should route by active run runtime, not by global selected runtime.

Current risky shape:

```ts
if (state.selectedAgent === 'codex') cancel codex;
else if (state.selectedAgent === 'claude-code') cancel claude;
else cancel legacy chat;
```

Target shape:

```ts
const activeRun = getActiveRunningRun(state.conversation);

if (activeRun?.runtime.runtimeId === 'codex') cancel codex;
if (activeRun?.runtime.runtimeId === 'claude-code') cancel claude;
```

The same applies to:

- approve plan
- reject plan
- answer user question
- append progress
- finish result

## History Metadata

Current metadata:

```ts
SavedConversation.agentId
```

Target metadata:

```ts
export interface SavedConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  runtimeSummary: Array<'claude-code' | 'codex' | 'legacy-ritemark'>;
  primaryRuntimeId?: 'claude-code' | 'codex' | 'legacy-ritemark';
}
```

Compatibility:

- Old metadata with `agentId` remains readable.
- New history badge can show `Claude`, `Codex`, or `Mixed`.
- Legacy `ritemark-agent` records show as `Legacy` or remain readable without showing as a new selectable runtime.

## Migration Strategy

Add pure helper functions before changing UI behavior:

```ts
normalizeSavedConversation(data: SavedConversationData): ConversationDocument
serializeConversationDocument(conversation: ConversationDocument): SavedConversationDataV2
getRuntimeSummary(conversation: ConversationDocument): RuntimeId[]
```

Legacy mapping:

- `agentConversation[]` maps to Claude runs.
- `codexConversation[]` maps to Codex runs.
- `chatMessages[]` maps to one or more legacy Ritemark runs.

Ordering:

- Merge provider turns by `timestamp`.
- If timestamps are missing, preserve legacy array order and place unknown timestamps after known turns.

Schema versioning:

- Store new conversations as `schemaVersion: 2`.
- Accept old records without `schemaVersion` as version 1.
- Do not delete old fields until a later cleanup sprint.

## Plan/Edit Mode Mapping

Claude:

- Existing plan mode is provider-driven through lifecycle prompt and `ExitPlanMode`.
- Sprint 62 should pass a run-level `mode` into the existing prompt-building layer only if needed.

Codex:

- Existing plan detection uses `shouldRequestPlanMode(prompt)`.
- Target should replace heuristic-only behavior with explicit run mode while keeping the current Codex plan update UI.

Default:

- `edit` for normal user prompts.
- `plan` when user explicitly chooses Plan mode.
- Existing prompt heuristics can remain as a fallback during migration.

## Ritemark Agent Deprecation

`ritemark-agent` should not be a selectable primary runtime after deprecation.

Keep:

- old saved history readability
- old RAG messages as legacy display
- current extension-side RAG code until a later cleanup decision

Remove or hide:

- `ritemark-agent` as default selected runtime
- Ritemark Document Agent as a normal peer in the runtime selector
- onboarding copy that presents it as a primary agent

Future option:

- Move RAG/document search into a tool callable by Claude/Codex/future Gemini runtimes.

## Rollout Guard

The first implementation should avoid irreversible localStorage writes.

Preferred path:

- add v2 normalization helpers first
- test them immediately
- keep legacy fields intact
- gate v2 persistence behind a temporary feature/config guard or keep v2 in memory only until validation passes

This lets the UI prove mixed-runtime behavior without risking user history loss.

## Implementation Slices

### Slice 1: Types and Migration Helpers

- Add new conversation document types.
- Add pure migration helpers.
- Add tests covering legacy Claude, Codex, mixed, and Ritemark Agent history.
- Do not remove old fields.
- Do not make v2 persistence the only write path yet.

### Slice 2: History Metadata

- Extend saved metadata with runtime summary.
- Update history badge to show `Mixed` when needed.
- Keep old `agentId` compatibility.

### Slice 3: Active Run Routing

- Change cancel/approve/question routing to use active running run when available.
- Keep provider-specific action implementations.

### Slice 4: Ritemark Agent Deprecation

- Hide `ritemark-agent` from the normal selector only after legacy history migration helpers are tested.
- Keep old Ritemark Agent history readable.
- Keep extension-side RAG code until a later cleanup decision.

### Slice 5: Runtime Draft Selection

- Add input-level runtime selection state.
- Keep existing `selectedAgent` messages to extension as a bridge.
- Default new conversations to Claude or Codex, not `ritemark-agent`.

### Slice 6: UI Rendering

- Render mixed conversations from unified runs.
- Reuse existing `AgentView` and `CodexView` components where practical.
- Add per-run runtime/model provenance.
- Defer a full global input-first empty-state redesign unless required.

## Open Decisions

- Should switching runtime send full visible conversation history into the next provider prompt, or should each provider keep its own session and receive a short handoff summary?
- Should legacy Ritemark Agent messages be grouped into one legacy run or split by user/assistant turn pairs?
- Should Plan mode be represented as a segmented control in the input or a menu item inside runtime options?
- Should thinking effort be global per runtime, or stored only when explicitly changed for a run?
