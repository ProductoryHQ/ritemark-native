# Agent SDK Options Research

## Summary

Sprint 62 should not replace the current Claude or Codex integrations. It should define a runtime adapter model that can host both existing provider paths and future SDK-backed runtimes.

Current recommendation:

- Keep Claude on `@anthropic-ai/claude-agent-sdk`.
- Keep Codex on current Codex app-server integration for ChatGPT-auth agent behavior.
- Keep current dependencies unless implementation uncovers a specific compatibility blocker.
- Use OpenAI Agents SDK as a future API-key OpenAI runtime candidate, not as a drop-in replacement for Codex.
- Defer Gemini framework selection to a later sprint and compare ADK, LangGraph, CrewAI, and other candidates with GitHub stars plus TypeScript fit, session model, local execution, tool permissions, and packaging risk.

## Runtime Preservation Constraint

The implementation should treat Claude and Codex as existing engines behind a new conversation UX.

That means:

- no rewrite of `AgentRunner.ts` unless needed for adapter wiring
- no replacement of `CodexManager` or the Codex app-server protocol
- no dependency swap from Codex app-server to OpenAI Agents SDK
- no dependency swap from Claude Agent SDK to another Claude integration
- no behavior changes to auth, approvals, user questions, plan review, attachments, or streaming unless the new unified model requires a thin routing layer

## Claude Agent SDK

Official docs describe the TypeScript Agent SDK as using `query()` to create an async generator streaming SDK messages. The package is installed with:

```text
npm install @anthropic-ai/claude-agent-sdk
```

Important current docs note: the SDK bundles a native Claude Code binary as an optional platform dependency, so separate Claude Code installation is not required if optional dependencies are installed correctly. If optional dependencies are skipped, callers can set `pathToClaudeCodeExecutable`.

Relevance to Ritemark:

- Already used in `extensions/ritemark/src/agent/AgentRunner.ts`.
- Fits persistent multi-turn agent sessions.
- Supports provider-native plan/user-question flows through Claude Code tools.
- Aligns with Sprint 57 bundled runtime direction.

Sources:

- Claude TypeScript Agent SDK reference: https://code.claude.com/docs/en/agent-sdk/typescript
- Claude Agent SDK overview: https://docs.claude.com/en/docs/agent-sdk/overview

## Codex App-Server / CLI

Ritemark currently integrates Codex through `CodexManager`, which resolves bundled or system Codex runtimes and launches app-server/CLI mode.

Relevance to Ritemark:

- Preserves ChatGPT authentication instead of requiring an OpenAI API key.
- Already supports Codex-specific app-server protocol features.
- Provides plan updates, approvals, user input, and compatibility checks.
- Should remain the Codex runtime adapter for this sprint.

Open issue:

- Codex app-server is not the same thing as OpenAI Agents SDK. We should not collapse these until auth, feature parity, and product semantics are intentionally reviewed.

## OpenAI Agents SDK

The OpenAI Agents SDK for TypeScript is official and open source. It exposes primitives for agents, tools, handoffs, guardrails, sessions, human-in-the-loop, tracing, and realtime agents. The current GitHub page shows roughly 2.9k stars and a latest release of `v0.8.5` on April 21, 2026.

Relevance to Ritemark:

- Good architectural reference for a future API-key based OpenAI agent runtime.
- Has a formal Sessions concept, which maps nicely to the conversation runtime work.
- Provider-agnostic claims may matter later, but Ritemark should validate actual Gemini support before relying on it.
- It does not replace Codex ChatGPT OAuth behavior by default.

Sources:

- OpenAI Agents SDK docs: https://openai.github.io/openai-agents-js/
- OpenAI Agents SDK GitHub: https://github.com/openai/openai-agents-js

## Gemini / Open Agent Framework Candidates

This sprint should capture candidates, not choose the final Gemini implementation.

### Google ADK

Google ADK is an official open-source agent framework optimized for Gemini and described as model-agnostic. Current ADK site presents Python, TypeScript, Go, and Java examples. Search results and third-party summaries show roughly 18k stars for `google/adk-python`, but this should be verified at selection time.

Why it matters:

- Best provider alignment for Gemini.
- TypeScript availability may make it more practical for a VS Code extension than Python-first frameworks.
- Needs packaging and runtime investigation.

Sources:

- ADK site: https://adk.dev/
- Google ADK Python GitHub: https://github.com/google/adk-python

### LangGraph

LangGraph is a large open-source stateful agent framework. Current GitHub result shows about 29.3k stars and highlights durable execution, long-running stateful workflows, and production use.

Why it matters:

- Strong fit for durable agent state and graph orchestration.
- Popularity and maturity are strong.
- Python-first core may be awkward for Ritemark's TypeScript extension unless LangGraph.js meets requirements.

Source:

- LangGraph GitHub: https://github.com/langchain-ai/langgraph

### CrewAI

CrewAI is a very popular open-source multi-agent framework. Current GitHub organization search result shows about 49.1k stars for `crewAIInc/crewAI`.

Why it matters:

- Strong GitHub popularity signal.
- Clear multi-agent orchestration focus.
- Python-first and framework semantics may not match an embedded VS Code extension runtime.

Source:

- CrewAI GitHub organization/repo listing: https://github.com/crewAIInc

### Microsoft AutoGen

AutoGen has historically been popular, but the current GitHub result says it is in maintenance mode and recommends Microsoft Agent Framework for new users. That likely disqualifies it as a preferred future Gemini framework unless Microsoft Agent Framework is separately evaluated.

Source:

- AutoGen GitHub: https://github.com/microsoft/autogen

## Selection Criteria For Future Gemini Sprint

Use GitHub stars as an initial discovery signal, but do not optimize only for stars. The Gemini sprint should score candidates on:

- GitHub stars and fork activity
- official Gemini support
- TypeScript support
- local extension packaging feasibility
- session/memory model
- human-in-the-loop support
- tool permission model
- MCP support
- streaming event model
- licensing
- maintenance status
- security surface
- ability to run without Python as a user-visible dependency

## Sprint 62 Runtime Adapter Implication

The unified Ritemark runtime interface should not assume Claude/Codex specifics. It should support:

- `startRun()`
- `cancelRun()`
- `answerQuestion()`
- `approvePlan()` / `rejectPlan()`
- streaming progress events
- attachments
- active file context
- provider-specific payload
- per-run model/mode/thinking settings

This lets Claude SDK, Codex app-server, and future Gemini SDKs live behind the same product model without forcing a premature SDK choice.
