# Cursor SDK Research vs. Ritemark Agent Harness

**Date:** 2026-04-30
**Status:** Research
**Author:** Claude (Engineering)
**Related:**
- `2026-02-03-claude-code-node-flows.md` (Claude Code node in Flows)
- `2026-02-14-codex-cli-chatgpt-integration.md` (Codex node)
- `2026-03-05-kanban-task-management-for-ai-agents.md` (multi-agent kanban)
- `2026-03-17-agent-lifecycle-planmode-analysis.md` (Plan/Question lifecycle)

---

## Executive Summary

Cursor released a public-beta TypeScript SDK (`@cursor/sdk`) on 2026-04-29 that
exposes the same agent harness powering the Cursor IDE. It supports **local,
cloud (Cursor-hosted VM), and self-hosted** execution; streams a discriminated
event protocol nearly identical to `@anthropic-ai/claude-agent-sdk`; and adds
first-class **subagents, file-based hooks, MCP, artifact download, and durable
agent IDs** with `Agent.list/get/archive`.

**The Cursor SDK is not a strategic replacement for our current Anthropic-based
harness.** Ritemark already has the streaming, tool-call, MCP, and subagent
plumbing it needs via `@anthropic-ai/claude-agent-sdk@^0.2.29`, plus parallel
subprocess paths for Claude Code and Codex CLIs. Replacing that core would
trade vendor lock-in (Anthropic) for vendor lock-in (Cursor) **plus** their
metered billing — a net loss for our BYOK posture.

**However, three pieces are uniquely interesting** and map cleanly onto
existing roadmap items:

1. **Cloud-VM background coding agents with auto-PR** — a capability Ritemark
   has zero of today. Best fit: a new `CursorNodeExecutor` for Flows, alongside
   `ClaudeCodeNodeExecutor` and `CodexNodeExecutor`.
2. **`Agent.list/get/archive` over remote sessions** — directly enables the
   multi-agent kanban work in `2026-03-05-kanban-task-management-for-ai-agents`.
3. **`.cursor/agents/*.md` and `.cursor/hooks.json` formats** — near-isomorphic
   to Claude Code's `.claude/agents/*.md` and hook config. If we ever surface
   shared subagents in the editor, the formats are interconvertible.

The rest of the SDK (Composer 2 model, sandboxed VMs, OAuth-managed MCPs,
`onDelta`/`onStep` callbacks) is well-engineered but largely duplicates what we
already have on the Anthropic side.

---

## 1. Cursor SDK at a Glance

### Installation & shape

```bash
npm install @cursor/sdk
# Node ≥ 22; latest in cookbook quickstart pins ^1.0.7
```

```typescript
import { Agent } from "@cursor/sdk"

const agent = await Agent.create({
  apiKey: process.env.CURSOR_API_KEY!,
  model: { id: "composer-2" },
  local: { cwd: process.cwd() },
})

const run = await agent.send("Explain this project")
for await (const event of run.stream()) { /* ... */ }
await run.wait()
```

### Three execution modes

| Mode          | Where                                    | Notable                                   |
| ------------- | ---------------------------------------- | ----------------------------------------- |
| `local`       | User machine, current process            | Fast iteration; reads `.cursor/` config   |
| `cloud`       | Cursor-managed sandboxed VM              | Survives disconnects; opens PRs; durable  |
| `self-hosted` | Customer's own pool/machine              | Same VM image, customer-controlled hosts  |

Cloud agent creation:

```typescript
const agent = await Agent.create({
  apiKey: process.env.CURSOR_API_KEY!,
  model: { id: "composer-2" },
  cloud: {
    repos: [{ url: "https://github.com/org/repo", startingRef: "main" }],
    autoCreatePR: true,
  },
})
```

### Streaming protocol (`SDKMessage`)

| Cursor type     | Ritemark/Anthropic equivalent                            |
| --------------- | -------------------------------------------------------- |
| `system`/`init` | SDK init payload (`tools`, `model`)                      |
| `assistant`     | Streamed text + `ToolUseBlock`                           |
| `thinking`      | Reasoning trace                                          |
| `tool_call`     | `running` / `completed` / `error` with args + result     |
| `status`        | `CREATING`/`RUNNING`/`FINISHED`/`ERROR`/`CANCELLED`/`EXPIRED` |
| `task`          | High-level task summary                                  |
| `request`       | Pending interactive request (analogous to our `AskUserQuestion`) |

The `Run` object exposes `stream()`, `wait()`, `cancel()`, `conversation()`,
`onDidChangeStatus()`, plus `supports(op)` / `unsupportedReason(op)` for
runtime-conditional behavior. Lower-level `onDelta` / `onStep` callbacks expose
token-level deltas (`text-delta`, `thinking-delta`, `tool-call-started`,
`step-completed`, `turn-ended` with usage).

### Configuration surfaces

- **MCP servers**: inline (per-create or per-`send`) or file-based
  (`.cursor/mcp.json`, `~/.cursor/mcp.json`, dashboard for cloud). Supports
  `stdio`, `http`, `sse`; OAuth via `auth: { CLIENT_ID, scopes }`.
- **Subagents**: inline `agents: { name: { description, prompt, model } }` or
  `.cursor/agents/*.md` with frontmatter. Each subagent can override its
  `model` and `mcpServers`.
- **Hooks**: `.cursor/hooks.json` only — no programmatic callbacks. Spawned
  process, JSON over stdio, exit-code permission gate (`0` allow, `2` deny).
  Rich event surface: `sessionStart/End`, `preToolUse/postToolUse`,
  `subagentStart/Stop`, `beforeShellExecution`, `beforeMCPExecution`,
  `beforeReadFile`/`afterFileEdit`, `beforeSubmitPrompt`, `preCompact`, `stop`,
  `afterAgentResponse`, plus separate `beforeTabFileRead`/`afterTabFileEdit`
  for inline completions.
- **Skills**: hinted at in the announcement (`.cursor/skills/`) but not exposed
  via SDK API.

### Agent lifecycle (durable)

```typescript
await Agent.list({ runtime: "local", cwd: process.cwd() })
await Agent.list({ runtime: "cloud", prUrl, includeArchived: true, apiKey })
await Agent.get(agentId, { apiKey })
await Agent.listRuns(agentId, { runtime, cwd })
await Agent.getRun(runId, { runtime, agentId, apiKey })
await Agent.archive(agentId)   // soft-delete, transcript readable
await Agent.unarchive(agentId)
await Agent.delete(agentId)    // permanent
await Agent.resume(agentId, { apiKey })  // bc-* = cloud, others = local
```

`agentId` is durable: `agent-<uuid>` (local) or `bc-<uuid>` (cloud). Inline
`mcpServers` are not persisted across `resume()` — file-based config is.

### Authentication & billing

- API keys from user dashboard or service-account dashboard.
- Token-based pricing — Composer 2 is **$0.50 / M input, $2.50 / M output**.
- Spend appears in the Cursor team dashboard, **not** charged to user-supplied
  Anthropic/OpenAI keys. Privacy Mode rules apply.

### Cookbook examples

| Example            | Demonstrates                                                    |
| ------------------ | --------------------------------------------------------------- |
| `quickstart`       | Single agent, one prompt, stream `assistant` text blocks.       |
| `coding-agent-cli` | TUI (Bun + OpenTUI), local↔cloud toggle, model selection.       |
| `app-builder`      | Cloud-sandboxed scaffolding flow ("spin up a new project").     |
| `agent-kanban`     | Linear-style board over `Agent.list`, grouping, artifact preview, `Agent.create({ cloud: { repos } })`. |

The kanban example is the most architecturally interesting for us — see §4.

---

## 2. What Ritemark Has Today

(Compressed from a fresh codebase walkthrough; full detail in
`2026-03-17-agent-lifecycle-planmode-analysis.md`.)

### Two coexisting executors

**Agent-as-Code (sidebar chat & planning):**
- `extensions/ritemark/src/agent/AgentRunner.ts` (~43 KB) — `runAgent()`
  one-shot wrapper plus a long-lived `AgentSession` with warm turns
  (~2–3 s vs. ~8–12 s cold).
- Uses `@anthropic-ai/claude-agent-sdk@^0.2.29`.
- Default `allowedTools`: `Bash, Read, Write, Edit, Glob, Grep,
  AskUserQuestion, ExitPlanMode`.
- Tool gating via `canUseTool(toolName)` callback returning
  `{ behavior: 'allow' | 'deny', message? }`.
- `AskUserQuestion` and `ExitPlanMode` modeled as **pending tool calls** that
  resolve when the webview returns an answer (recently fixed lifecycle bug).
- `settingSources: ['user', 'project', 'local']` so user-scope MCPs load.

**Flow runtime (visual DAG, in `extensions/ritemark/src/flows/`):**
- `FlowExecutor.ts` (6 KB) — sequential topological execution (Kahn's algorithm).
- Per-node executors:
  - `LLMNodeExecutor.ts` — direct OpenAI / Gemini calls.
  - `ClaudeCodeNodeExecutor.ts` — spawns Claude Code CLI subprocess.
  - `CodexNodeExecutor.ts` — OpenAI Codex via app-server protocol
    (`codexProtocol.ts` is a snapshot of v0.106.0; current is 0.114.0).
- Variable interpolation `{Label}` resolves trigger inputs and upstream outputs
  from `ExecutionContext`.

### Webview message protocol (extension → webview)

`agent-setup:progress`, `agent-setup:complete`, `agent-progress`,
`agent-question`, `agent-plan-approval`, `agent-result`, `flow:saved`,
`flow:validation`, `flow:stepStart`, `flow:stepComplete`,
`flow:claudeCodeProgress`, `flow:codexProgress`, `flow:modelConfig`,
`flow:featureFlags`.

### What we have that Cursor SDK doesn't

- Visual DAG flow runtime with mixed node types (LLM, image-gen, Claude Code,
  Codex, save-file).
- BYOK across three providers (OpenAI, Gemini, Anthropic), single source of
  truth at `extensions/ritemark/src/ai/modelConfig.ts`.
- In-editor chat tied to TipTap selection state (bubble menu, slash commands).
- Native VS Code extension host integration (settings, secrets, status bar).

---

## 3. Capability Diff

| Capability                        | Anthropic SDK (Ritemark today) | Cursor SDK            | Notes                                                                |
| --------------------------------- | ------------------------------ | --------------------- | -------------------------------------------------------------------- |
| Streaming events                  | ✅ `SDKMessage` types           | ✅ Near-identical      | Easy to adapt our `agent-progress` mapper.                           |
| Tool-call streaming               | ✅                              | ✅                     |                                                                       |
| Thinking/reasoning stream         | ✅                              | ✅                     |                                                                       |
| Cancellation                      | ✅ (AbortSignal)                | ✅ `run.cancel()`      |                                                                       |
| Multi-turn warm session           | ✅ `AgentSession`               | ✅ `Agent.send` reuse  |                                                                       |
| Local execution                   | ✅                              | ✅                     |                                                                       |
| **Cloud sandbox VM**              | ❌                              | ✅                     | **Net new capability.**                                              |
| **Self-hosted runner**            | ❌                              | ✅ (pool / machine)    | **Net new capability.**                                              |
| **Auto-PR from cloud agent**      | ❌                              | ✅ `autoCreatePR`      | **Net new capability.**                                              |
| MCP — stdio                       | ✅                              | ✅                     |                                                                       |
| MCP — http/sse                    | ✅                              | ✅ + OAuth helper       | Cursor's `auth: { CLIENT_ID, scopes }` is a nicer DX than rolling our own. |
| Subagents (inline)                | Indirect (via Task tool)       | ✅ first-class          |                                                                       |
| Subagents (file-based)            | ✅ `.claude/agents/*.md`        | ✅ `.cursor/agents/*.md` | Same shape (frontmatter + body).                                     |
| Hooks (file-based)                | ✅ via Claude Code              | ✅ `.cursor/hooks.json` | Cursor exposes more event types (Tab hooks, `preCompact`, etc.).     |
| Hooks (programmatic callbacks)    | Partial (`canUseTool`)         | ❌                     | Both rely on file-based for full lifecycle.                          |
| Plan-mode lifecycle               | ✅ `ExitPlanMode` tool call     | ✅ via `request` event |                                                                       |
| Image input                       | ✅                              | ✅ `images: [...]`     |                                                                       |
| **Durable agent IDs + list/get**  | ❌ (sessions are in-memory)     | ✅ `Agent.list/get`    | **Big win for kanban use case.**                                     |
| **Archive/unarchive/delete**      | ❌                              | ✅                     | **Net new for long-running agents.**                                 |
| Artifact download (workspace)     | ❌                              | ✅ (cloud only)        |                                                                       |
| Per-send model override           | Partial                        | ✅                     |                                                                       |
| Per-send MCP override             | ❌                              | ✅                     |                                                                       |
| Resume after disconnect           | ❌                              | ✅ `Agent.resume`      |                                                                       |
| Token-level callbacks             | ✅                              | ✅ `onDelta`/`onStep`  |                                                                       |
| **Multi-provider model routing**  | ✅ (OpenAI/Gemini/Anthropic)    | ❌ (Composer/auto)     | **Ritemark advantage.**                                              |
| **Visual DAG flows**              | ✅                              | ❌                     | **Ritemark advantage.**                                              |
| BYOK billing                      | ✅                              | ❌ (Cursor-metered)    | **Ritemark advantage** for our user base.                            |
| Composer 2 model                  | ❌                              | ✅                     | Specialized coding model; locked to Cursor.                          |

---

## 4. Useful Integration Vectors for Ritemark

### 4.1 New Flow node: `CursorNodeExecutor` *(highest ROI)*

The Flow runtime already supports plug-in node executors with a stable contract
(streaming progress messages, `ExecutionContext` outputs, AbortSignal
cancellation). Adding a Cursor node is a small, additive change:

```typescript
// extensions/ritemark/src/flows/nodes/CursorNodeExecutor.ts (sketch)
import { Agent } from "@cursor/sdk"

export async function executeCursorNode(node, context, postProgress) {
  const agent = await Agent.create({
    apiKey: await getCursorApiKey(),                     // new SecretStorage entry
    model: { id: node.data.model ?? "composer-2" },
    cloud: node.data.runtime === "cloud" ? {
      repos: [{ url: node.data.repoUrl, startingRef: node.data.branch ?? "main" }],
      autoCreatePR: node.data.autoCreatePR,
    } : undefined,
    local: node.data.runtime === "local" ? { cwd: context.workspacePath } : undefined,
  })

  const run = await agent.send(interpolate(node.data.prompt, context))

  for await (const event of run.stream()) {
    postProgress({ type: "flow:cursorProgress", nodeId: node.id, event })
  }
  const result = await run.wait()
  context.outputs[node.id] = {
    text: result.result,
    prUrl: result.git?.branches[0]?.prUrl,
    artifacts: await agent.listArtifacts(),
  }
}
```

Concretely useful for flows like:
- "On issue label `auto-fix`, run a cloud Cursor agent, review the PR it
  opens" — analogous to today's "Watched flow jobs" wishlist item.
- "Take meeting notes → extract action items → spawn one cloud agent per
  item" — extends `2026-03-17-meeting-to-action-notes.md`.

**Cost:** ~1 sprint. Pattern is already established by `ClaudeCodeNodeExecutor`
and `CodexNodeExecutor`. No core harness change.

### 4.2 Cloud-agent surface in the multi-agent kanban *(natural fit)*

`2026-03-05-kanban-task-management-for-ai-agents.md` proposes a kanban over
running coding agents. The cookbook's `agent-kanban` example does **exactly**
this for Cursor cloud agents (`Agent.list({ runtime: "cloud" })`,
artifact previews, `Agent.create({ cloud: { repos } })`).

**Recommendation:** if we build the kanban, treat agent type as a column
attribute (`local Claude Code`, `local Codex`, `Cursor cloud`) and back each
type with its native list API. Cursor's API is the most mature here; Claude
Code currently has no equivalent and we'd track local sessions in our own
SQLite/JSON store.

### 4.3 Format alignment for subagents and hooks *(zero-cost)*

`.cursor/agents/*.md` and `.claude/agents/*.md` are essentially the same shape
(YAML frontmatter with `name`, `description`, `model`; markdown body as system
prompt). If a future "shared subagent definitions" feature ships, defining one
canonical Ritemark format that exports to both is trivial.

`.cursor/hooks.json` is more elaborate than Claude Code's hook surface (Tab
hooks, `preCompact`, MCP/shell separation). If we ever expose hook config to
end-users, Cursor's event taxonomy is worth borrowing — even if the runtime
remains Claude Code.

### 4.4 Things explicitly **not** worth doing

- **Replacing `AgentRunner.ts` with the Cursor SDK.** The sidebar chat is the
  user's most-touched surface; ripping out a working `@anthropic-ai/claude-agent-sdk`
  integration for a public-beta SDK with a different billing model would be
  high-risk for zero user-visible improvement.
- **Routing flow LLM nodes through Cursor.** `LLMNodeExecutor` does single API
  calls, often over Gemini, with BYOK. Cursor's metered Composer pricing
  doesn't fit, and we'd lose multi-provider routing.
- **Adopting Cursor as our chat model provider.** Same lock-in argument as
  above, plus Composer 2 is opaque (no published model card we can verify
  against).

---

## 5. Open Questions

1. **API stability.** SDK is public beta as of 2026-04-29. Any production
   integration should pin a version and be prepared for breaking changes
   through ~Q3 2026.
2. **Authentication UX.** Cursor's API keys are issued via `cursor.com/dashboard`.
   We'd add a Cursor section to settings alongside OpenAI / Gemini / Anthropic.
   Service-account keys (team) vs. user keys both work; admin keys not yet
   supported.
3. **Privacy implications of cloud mode.** Cloud agents clone the repo onto
   Cursor-managed VMs. For privacy-conscious users this is a hard "no"; we'd
   need to gate cloud-mode flow nodes behind an opt-in feature flag with clear
   data-flow disclosure.
4. **PR-creating agents in CI.** The cookbook positions cloud agents as
   "delegate background tasks" (e.g. CI pipeline runs an agent, opens a PR).
   This pattern could replace some of what users currently do with Codex via
   the Codex node — but only for users on GitHub repos integrated with Cursor.
5. **MCP scope reuse.** Could we point Cursor's `mcpServers` config at the
   same MCP endpoints we already register for Claude Code? Yes — both follow
   the MCP spec. The OAuth helper (`auth: { CLIENT_ID, scopes }`) might be
   nicer than what we currently expose.

---

## 6. Recommendation

**Adopt the Cursor SDK as a Flow node, not as a harness replacement.** Track
under a feature flag (`cursorNodeEnabled`, defaults off). Implement after the
multi-agent kanban work, since the kanban is the natural surface where remote
durable agents become visible alongside local Claude Code / Codex sessions.

**Do not** retire `AgentRunner.ts` or change anything about how the sidebar
chat works. The harness is fine; the gap is **cloud-execution and durable
agent management**, and that gap is exactly what `@cursor/sdk` fills.

---

## References

- [Cursor SDK announcement (2026-04-29)](https://cursor.com/blog/typescript-sdk)
- [Cursor SDK TypeScript reference](https://cursor.com/docs/api/sdk/typescript)
- [Cursor hooks reference](https://cursor.com/docs/hooks)
- [cursor/cookbook on GitHub](https://github.com/cursor/cookbook) — quickstart, app-builder, agent-kanban, coding-agent-cli
- Related Ritemark analysis: `2026-02-03-claude-code-node-flows.md`,
  `2026-03-05-kanban-task-management-for-ai-agents.md`,
  `2026-03-17-agent-lifecycle-planmode-analysis.md`
