# Ritemark Extension Architecture

**Status:** Living document — updated at the end of each sprint that changes extension architecture.
**Last updated:** 2026-06-06 (baseline, pre-Sprint 79)
**Owner:** Jarmo (decisions) · Claude (maintenance)

---

## Purpose

This document is the single source of truth for the Ritemark extension's **structural architecture** — how the main subsystems are organized, how they communicate, and what invariants must hold across sprints. It covers the extension host only; VS Code patches are documented in `CLAUDE.md`; webview internals are in `extensions/ritemark/webview/`.

Sprint planning must consult this document. Any sprint that changes the architecture must update this document as part of its definition of done (see [Sprint Architecture Gate](#sprint-architecture-gate)).

---

## Subsystem Map (current, post-Sprint 78)

```
extensions/ritemark/src/
├── agent/           Claude Code runtime — SDK-based, in-process + bundled binary
├── codex/           Codex runtime — JSON-RPC 2.0 / stdio binary, custom protocol
├── acp/             ACP runtime — JSON-RPC 2.0 / stdio, @agentclientprotocol/sdk
├── browser/         Integrated browser — CDP panel, MCP server, action tools
├── flows/           Flow engine — scheduler, executor, storage, test runner
├── features/        Feature flags — flags.ts registry, featureGate.ts
├── ai/              Shared AI utilities — modelConfig.ts, connectivity, analytics
├── views/           View providers — UnifiedViewProvider (AI sidebar), AgentLibraryViewProvider
├── settings/        Settings page bridge
├── utils/           Binary resolution, platform utils, bundledAgentRuntime
├── voiceDictation/  Whisper-based STT (macOS only)
├── export/          PDF/DOCX export
└── [editors]        ritemarkEditor.ts, docxEditorProvider.ts, pdfEditorProvider.ts, excelEditorProvider.ts
```

---

## Agent Runtime Architecture

### AS IS (Sprints 1–78) — Three Parallel Worlds

Each runtime was integrated independently. The result is three structurally similar but incompatible stacks:

| Dimension | Claude Code (`src/agent/`) | Codex (`src/codex/`) | ACP/OpenCode (`src/acp/`) |
|---|---|---|---|
| **Interface** | In-process TS SDK (`@anthropic-ai/claude-agent-sdk`) + bundled `claude` binary | Bundled `codex-app-server` binary, hand-written JSON-RPC 2.0/stdio (`codexProtocol.ts` 463 LOC) | `@agentclientprotocol/sdk` over stdio |
| **Session manager** | `AgentRunner.ts` (1235 LOC) | `CodexManager.ts` (906 LOC) | `AcpManager.ts` (286 LOC) |
| **Auth** | Claude OAuth / Anthropic API key | ChatGPT OAuth built into binary | BYOK — env-var injection from Settings |
| **Approval** | `agent-answer-plan` webview message → PlanApprovalCard | `codex-approve` → CodexApprovalCard | `acp-approval-response` → CodexApprovalCard (shared shape, different message type) |
| **Browser tools** | `BrowserMcpServer` injected via `AgentSessionConfig.mcpServers` | `codexBrowserTools.ts` — dynamic tool injection via Codex protocol | Not implemented |
| **File attachments** | Full `FileAttachment` (image/pdf/text) | Images converted to data URLs; PDF/text not supported | No attachment support |
| **Model config** | `CLAUDE_MODELS` in `src/agent/types.ts` | `getCodexModels()` in `src/codex/codexModels.ts` | `BYOK_PROVIDER_MODELS` in `src/ai/modelConfig.ts` |
| **Webview execute message** | `ai-execute-agent` | `codex-execute` | `acp-execute` |
| **Webview cancel message** | `ai-cancel-agent` | `codex-cancel` | `acp-cancel` |

**Dispatch:** `UnifiedViewProvider.ts` (2480 LOC) contains three parallel switch-case trees — one per runtime — plus runtime-specific private methods. Adding a fourth runtime requires ~200 LOC of new switch cases and private methods.

### TO BE (Sprint 79+) — Runtime Adapter Pattern

A thin abstraction layer makes `UnifiedViewProvider` runtime-agnostic. Each runtime becomes a pluggable adapter. New runtimes (e.g. Goose, Cursor via ACP) require only a new adapter class + registry entry.

```
src/runtime/                          ← NEW in Sprint 79
├── AgentRuntime.ts                   interface + shared types
├── RuntimeRegistry.ts                factory, lookup, lifecycle management
├── UnifiedApprovalGate.ts            single approval path for all runtimes
└── BrowserToolsInjector.ts           single browser MCP injection for all runtimes

src/agent/   → ClaudeCodeRuntime implements AgentRuntime
src/codex/   → CodexRuntime implements AgentRuntime
src/acp/     → AcpRuntime implements AgentRuntime
```

**`AgentRuntime` interface:**

```typescript
interface AgentRuntime {
  readonly id: AgentId;

  start(config: RuntimeSessionConfig): Promise<void>;
  prompt(turn: RuntimeTurnConfig): Promise<void>;
  cancel(): Promise<void>;
  dispose(): void;

  // Unified approval — all runtimes respond through one path
  respondToApproval(requestId: string, approved: boolean, alwaysAllow: boolean): void;

  getStatus(): Promise<RuntimeStatus>;
}
```

**`RuntimeSessionConfig`** — shared session config that each adapter translates to its native form:

```typescript
interface RuntimeSessionConfig {
  workspacePath: string;
  model?: string;
  attachments?: UnifiedAttachment[];     // see File Attachments section
  mcpServers?: Record<string, unknown>;  // browser tools + future MCP
  excludedFolders?: string[];
  extraSystemPrompt?: string;
}
```

**Unified dispatch in `UnifiedViewProvider` (post-Sprint 79):**

```typescript
// Before: 3 × execute + 3 × cancel + 3 × approve = 9 cases
// After: 3 cases total
case 'agent-execute': {
  const runtime = this._runtimeRegistry.get(message.agentId);
  await runtime.prompt({ prompt: message.prompt, model: message.model, attachments: message.attachments });
  break;
}
case 'agent-cancel': {
  this._runtimeRegistry.get(message.agentId)?.cancel();
  break;
}
case 'agent-approve': {
  this._runtimeRegistry.get(message.agentId)?.respondToApproval(message.requestId, message.approved, message.alwaysAllow);
  break;
}
```

**Target size:** `UnifiedViewProvider` ~900 LOC (from 2480).

### Unified Approval Gate

One webview message contract, one approval card component, all runtimes:

```typescript
// Extension → Webview (all runtimes):
{
  type: 'agent-approval-request',
  agentId: AgentId,
  requestId: string,
  kind: 'file-write' | 'shell-command' | 'permission' | 'plan',
  // kind-specific payload (file path, command, plan text, etc.)
}

// Webview → Extension (all runtimes):
{
  type: 'agent-approve',
  agentId: AgentId,
  requestId: string,
  approved: boolean,
  alwaysAllow: boolean,
}
```

Each runtime adapter translates its native approval format (Codex JSON-RPC, ACP `session/request_permission`, Claude plan approval) into this shape before forwarding to the webview.

### Browser Tool Injection

**Target:** All runtimes receive browser tools through a single `BrowserToolsInjector` that produces an MCP server spec. Each adapter knows how to inject an MCP server into its runtime.

```
BrowserToolsInjector.getServers() → MCP server config
  → ClaudeCodeRuntime: mcpServers field (already works this way)
  → CodexRuntime: replaces codexBrowserTools.ts with MCP injection via Codex protocol
  → AcpRuntime: MCP server list in ACP `initialize` request
```

`codexBrowserTools.ts` is deleted in Sprint 79.

---

## File Attachments

### AS IS

Attachment support is runtime-specific and inconsistent:

| Runtime | Images | PDFs | Text files |
|---|---|---|---|
| Claude Code | ✅ via `FileAttachment` | ✅ | ✅ |
| Codex | ⚠️ converted to data URLs; no `kind` check | ❌ | ❌ |
| ACP/OpenCode | ❌ not implemented | ❌ | ❌ |

### TO BE

Single `UnifiedAttachment` type in `src/runtime/AgentRuntime.ts`. Each adapter converts to its native format:

```typescript
interface UnifiedAttachment {
  id: string;
  kind: 'image' | 'pdf' | 'text';
  name: string;
  data: string;       // base64 for image/pdf, raw text for text
  mediaType: string;
}
```

- `ClaudeCodeRuntime` passes through unchanged (it already matches this shape).
- `CodexRuntime` converts images to data URLs, skips pdf/text with a visible notice ("Codex does not support PDF attachments").
- `AcpRuntime` converts images to inline base64 in the prompt text (OpenCode BYOK providers vary in multimodal support; text content is inlined as a fenced block).

---

## Scheduled Agent Tasks (Daemon)

### Vision

Agents with a `schedule:` frontmatter field run autonomously while Ritemark is open. A daemon watches registered agents, fires them on schedule, and surfaces results in the Agent Library without interrupting the user.

### Architecture (TO BE — Sprint 80+)

```
src/daemon/                          ← NEW
├── AgentDaemon.ts                   cron watcher, registration, lifecycle
├── DaemonSession.ts                 headless AgentRuntime session (no UI approval)
├── DaemonResultStore.ts             persists run history (workspaceState)
└── DaemonStatusEvents.ts            VS Code status bar + Agent Library notifications
```

**Key design decisions:**

1. **Daemon uses the same `AgentRuntime` interface** — it calls `runtime.prompt()` like an interactive session, but with a `headless: true` flag that routes approvals to auto-approve-or-skip logic instead of the UI. This is the reason the `AgentRuntime` abstraction must exist first (Sprint 79 is a hard prerequisite).

2. **No daemon-specific runtime.** The daemon is a client of the existing runtime layer, not a fourth runtime.

3. **Auto-approval policy for headless runs:** The daemon must not silently execute destructive operations. Default policy: file-reads auto-approved; file-writes blocked and surfaced as a notification; shell commands blocked. The agent's `allowedTools` frontmatter narrows this further.

4. **Flow `routine:` integration.** If the agent's frontmatter has `routine: <flow-stem>`, the daemon calls `FlowExecutor` after the agent run completes (or instead of — TBD in Sprint 80 spec).

5. **Background execution (Phase 2).** Phase 1 (Sprint 80) runs while Ritemark is open. True background execution (process keeps running after app close) is a separate decision requiring OS-level service integration — out of scope until there is user demand.

---

## Model Configuration (Single Source of Truth)

### AS IS — Three locations

| Location | Models |
|---|---|
| `src/agent/types.ts:52` | `CLAUDE_MODELS` (Sonnet/Opus/Haiku) |
| `src/codex/codexModels.ts` | `getCodexModels()` dynamic |
| `src/ai/modelConfig.ts` | `OPENAI_LLM_MODELS` + `BYOK_PROVIDER_MODELS` |

### TO BE — One location

All model identifiers in `src/ai/modelConfig.ts`. The CLAUDE.md rule "all model identifiers in one file" becomes literally true. `agent/types.ts` retains `CLAUDE_MODELS` only until Sprint 79 migrates it; `CODEX_MODELS` (already `@deprecated`) is deleted.

---

## Open Architectural Debt

These items are tracked here until resolved in a sprint:

| ID | Item | Blocking? | Target sprint |
|---|---|---|---|
| **ARCH-1** | `@agentclientprotocol/sdk` must be esbuild-bundleable (no dynamic `require()`). Verify before prod build. | Sprint 76 shipped without verification on prod. | Sprint 79 pre-flight |
| **ARCH-2** | Unified approval gate (TO BE #2 from Sprint 76 tech plan). ACP pre-aligned; full migration deferred. | No, but each sprint without it adds drift. | Sprint 79 |
| **ARCH-3** | `document-search` (`'stable'`) flag gates deleted RAG code (`src/rag/` removed in Sprint 74). Zombie flag. | No (flag has no effect; RAG code is gone). | Sprint 79 cleanup |
| **ARCH-4** | `CODEX_MODELS` in `types.ts` is `@deprecated` but callers not migrated. | No. | Sprint 79 |
| **ARCH-5** | Codex browser tools use dynamic injection (`codexBrowserTools.ts`); Claude Code uses MCP server. Two patterns for same capability. | No, but blocks browser parity for ACP. | Sprint 79 |
| **ARCH-6** | File attachments broken for Codex (partial) and ACP (missing). | Yes — user-visible bug. | Sprint 79 |
| **ARCH-7** | `UnifiedViewProvider` at 2480 LOC; grows linearly with each new runtime. | No, but maintainability cost compounds. | Sprint 79 |

---

## Sprint Architecture Gate

**Rule:** Any sprint whose implementation changes the structure of a subsystem listed in this document must update this document before the sprint is closed.

"Changes structure" means:
- Adding, removing, or renaming a module at the `src/<subsystem>/` level
- Adding a new webview↔extension message type that crosses a subsystem boundary
- Changing an interface that other subsystems depend on
- Adding or removing a feature flag that gates a named architectural feature
- Changing the binary bundling manifest or `AgentRuntimeKind` enum

**Enforcement:** The sprint-manager skill checks for this requirement. The `qa-validator` blocks merge if the sprint's technical-plan says "changes architecture" but this document's `Last updated` date is older than the sprint branch creation date.

---

## Version History

| Date | Sprint | Changes |
|---|---|---|
| 2026-06-06 | Baseline | Initial document. Captures AS IS state post-Sprint 78: 3 runtimes, 2 browser integration patterns, 3 model config locations. Defines TO BE for Sprint 79 (runtime adapter unification). |
