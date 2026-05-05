# Context Handoff Decision

## Decision

For Sprint 62, runtime switching uses a conservative handoff model:

```text
same visible conversation, provider-local sessions, explicit handoff prompt only when switching runtimes
```

Claude and Codex keep their existing session/execution behavior. The unified conversation model records all runs, but it does not try to inject provider-internal state from one runtime into another runtime.

## Why

This preserves the user's product expectation without rewriting Claude or Codex:

- The UI shows one continuous conversation.
- Each provider keeps its existing session semantics.
- Runtime switching does not require replacing current dependencies.
- Cross-runtime continuity can be handled with a generated handoff summary/prompt when needed.

## Initial Behavior

When the user switches from one runtime to another inside the same conversation:

1. The conversation UI remains continuous.
2. The new run records the new runtime/model/mode.
3. The provider starts or continues according to its current implementation.
4. If the previous visible turns matter, Ritemark can prepend a compact handoff note to the user prompt.

Draft handoff shape:

```text
Conversation context from earlier visible turns:
<short summary or selected recent turns>

User request:
<current prompt>
```

## Deferred

These are intentionally deferred until after the model/UX foundation is stable:

- automatic high-quality summarization across all previous runs
- provider-to-provider session import
- user-controlled context selection for handoff
- fork conversation from selected turn
- compact conversation command shared across runtimes

## Implementation Guidance

Do not modify `AgentRunner.ts` or `CodexManager` for this decision unless a small adapter boundary needs a new option.

Prefer adding handoff preparation in the AI sidebar store or a nearby conversation-runtime helper.
