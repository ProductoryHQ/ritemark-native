# Ritemark Extension Architecture

**Status:** Living document — updated at the end of each sprint that changes extension architecture.
**Last updated:** 2026-07-15 (Sprint 94 — comment callouts)
**Owner:** Jarmo (decisions) · Claude (maintenance)

---

## Purpose

This document is the single source of truth for Ritemark extension architecture — system layers, subsystem structure, data flows, and invariants that must hold across sprints. It covers the extension host and its integration with VS Code OSS; VS Code patch specifics are in `CLAUDE.md`; webview component internals are in `extensions/ritemark/webview/`.

Sprint planning must consult this document. Any sprint that changes the structure of a subsystem listed here must update this document as part of its definition of done (see [Sprint Architecture Gate](#sprint-architecture-gate)).

---

## System Architecture Overview

Ritemark Native is a **VS Code OSS fork — as a git submodule, not a hard fork** — with the Ritemark markdown editor built in natively. `.md` files open in a TipTap WYSIWYG webview via a Custom Editor Provider. The submodule choice is the keystone structural decision: all VS Code customizations live in **patch files** (`patches/vscode/`), never in the submodule tree, keeping upstream VS Code sync cheap.

```
┌─────────────────────────────────────────────────────────┐
│  Ritemark.app                                           │
│                                                         │
│  Layer 4: Webview        /webview/src                   │
│           React + TipTap + Vite (IIFE, ~7.6 MB)         │
│                    ↕ bridge.ts (postMessage)             │
│  Layer 3: Extension host /extensions/ritemark/src       │
│           TypeScript → Node.js                          │
│                    ↕ VS Code Extension API              │
│  Layer 2: VS Code patches /patches/vscode               │
│           001–010.patch (applied at build time)         │
│                    ↕                                    │
│  Layer 1: VS Code OSS    /vscode  (git submodule)       │
└─────────────────────────────────────────────────────────┘
```

**Layer boundaries are isolation boundaries.** Patches never touch the extension source; the webview never touches Node APIs directly. Every cross-boundary interaction is explicit and documented. This is what makes the system maintainable across VS Code upstream bumps.

---

## Webview ↔ Extension Protocol

The load-bearing boundary. The TipTap editor cannot read files, make AI calls, or do any I/O. It requests everything through `bridge.ts`. This keeps the editor sandboxed and independently testable; the webview bundle (`media/webview.js`) is a self-contained artifact that ships separately from the host.

`bridge.ts` exposes four channels:

| Function | Direction | Use |
|---|---|---|
| `sendToExtension(type, data)` | webview → host | request file ops, AI calls, navigation |
| `onMessage(cb)` | host → webview | document content, AI streams, state pushes |
| `emitInternalEvent` / `onInternalEvent` | webview ↔ webview | UI-only events, no host round-trip |
| `openExternalUrl` / `openInternalLink` | webview → host | external and cross-document links |

`saveState` / `getState` (VS Code webview API) persist webview UI state across panel hide/show without a host round-trip.

### Core file editing flow

```
.md file opened
  → host: onMessage("document", content)  → webview renders in TipTap
  user edits
  → webview: sendToExtension("save", markdown)  → host writes to disk
  external change detected by file watcher
  → host: onMessage("document", content)  → webview re-renders
```

**Protocol type safety (AS IS):** `sendToExtension(type: string, data: Record<string, unknown>)` is stringly-typed. The host and webview agree on message names and payload shapes only by convention. A renamed `type` or changed payload field fails silently at runtime in a sandboxed context where it is hard to observe. See ARCH-9.

**Comment callouts (Sprint 94, #81).** Editor-only comments live entirely in the editor webview (TipTap `CommentMark` for anchored highlights, an atom `CommentNode` for `///` notes, and a DOM-scanning `MarginCommentRail`); they round-trip through a scoped `marked` tokenizer + Turndown rules and are stripped at the shared export chokepoint (`export/v2/htmlPipeline.ts`). The one cross-subsystem seam is **Send-to-AI**: the editor and the AI sidebar are separate webviews, so an assigned comment relays across two new host messages — `comment:send-to-ai` (editor → `RitemarkEditorProvider`) and `comment:submit` (`UnifiedViewProvider` → sidebar, then the store's existing `sendAgentMessage`/`sendCodexMessage`/`sendOpenCodeMessage` → `agent-execute`). No `AgentRuntime` change. Gated by the `comment-callouts` experimental flag (default on). The comment webview.js bundle is now cache-busted via `?v=<mtime>` (was silently serving stale bundles across reloads).

---

### Conversation scoping (Sprint 99)

Every message that concerns a conversation carries `conversationId` at the top level — inbound
(`agent-execute`, `agent-cancel`, `agent-approve`, `agent-answer-question`, `codex-answer-question`,
`conversation:reset`) and outbound (`agent-progress`, `agent-result`, `agent-question`,
`agent-approval-request`, `codex-streaming`, `codex-progress`, `codex-result`, `codex-question`,
`codex-plan-text-delta`, `codex-plan-update`, `codex-rpc-progress`).

**An inbound message with an unknown `conversationId` is dropped with a warning, never delivered to
the active conversation.** Falling back to "whatever is on screen" is the bug class parallel chats
exist to remove.

`UnifiedApprovalRequest` gained `conversationId`; adapters do not set it, the view provider stamps
it where the callback already closes over the conversation.

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
├── update/          Seamless updates — feed, resolver, installer, integrity, status bar
└── [editors]        ritemarkEditor.ts, docxEditorProvider.ts, pdfEditorProvider.ts, excelEditorProvider.ts, drawioEditorProvider.ts
```

Editor provider contracts: `ritemarkEditor.ts` is a `CustomTextEditorProvider` (markdown + CSV, editable). `excelEditorProvider.ts` is a full `CustomEditorProvider<ExcelDocument>` since Sprint 81 — .xlsx is editable (dirty tracking via `CustomDocumentContentChangeEvent`, save/save-as/revert/hot-exit backup; no undo-redo stack), .xls stays read-only. `docxEditorProvider.ts` and `pdfEditorProvider.ts` are read-only (`CustomReadonlyEditorProvider`).

Entry point `extension.ts` registers all providers, commands, and views.

---

## Agent Runtime Architecture

### Sessions (Sprint 99)

`AgentRuntime` is an adapter — **one instance per runtime KIND**, held by `RuntimeRegistry`. It
mints **one `RuntimeSession` per conversation**:

```ts
interface AgentRuntime {
  createSession(conversationId: string, config: RuntimeSessionConfig): Promise<RuntimeSession>;
  getStatus(): Promise<RuntimeStatus>;   // adapter-level: binary + auth, NOT per-conversation
  dispose(): void;                        // every session
}
interface RuntimeSession {
  readonly conversationId: string;
  prompt(turn); cancel(); respondToApproval(...); dispose();   // this conversation only
}
```

Before Sprint 99, `start()`/`prompt()`/`cancel()` lived on the adapter and `start()` ran on EVERY
turn against the shared instance — so a second conversation overwrote the first one's callbacks. A
session OBJECT rather than an id parameter, because `RuntimeSessionConfig` already carries the
per-turn callbacks: letting them close over the conversation means a callback *cannot* fire against
another one, instead of merely being told not to.

`getStatus()` stays adapter-level deliberately — per-conversation status would imply a
per-conversation binary.

Per-runtime session mapping, and the shared thing each keeps:

| Runtime | Session is | Shared across sessions |
|---|---|---|
| Claude Code | one `AgentSession` (`AgentRunner.ts`) | nothing — the SDK is per-session |
| Codex | one app-server **thread** | ONE `codex-app-server` process, one listener registration; events route by `params.threadId` |
| OpenCode / ACP | one ACP **session** | ONE subprocess (measured: 339 MB for 5 sessions vs 1291 MB for 5 processes) |

Sprint 99 fixed three concurrency defects that the single-conversation shape had hidden:
`CodexRuntime` held `_threadApprovalKey`/`_browserToolsEnabledForThread` as scalars whose mismatch
nulled `_threadId`, so one conversation switching Auto↔Ask would have silently destroyed another's
thread context; `AcpRuntime._recentlyPermissionedWrites` was a process-wide `Set<filePath>`, a
cross-chat approval bypass; and `AgentSession` held single-slot pending-approval fields that
overwrote each other when the model emitted two `tool_use` blocks in one message — a live bug on one
conversation, not just a concurrency risk.

**Browser tools are serialized across conversations** (`BrowserActionTools.callBrowserAction`). There
is one integrated browser and one active tab, so tool calls are commands against shared state.
Per-chat browsers would need per-chat tab ownership in the workbench — shell-tier, out of scope.


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
| **Model config** | `modelCatalog.getModels('anthropic')` — live `/v1/models` → catalog | `modelCatalog.getModels('codex')` — `~/.codex` cache → catalog | `modelCatalog.getModels('opencode')` — curated BYOK — all via `src/ai/modelCatalog` (Sprint 89) |
| **Webview execute message** | `ai-execute-agent` | `codex-execute` | `acp-execute` |
| **Webview cancel message** | `ai-cancel-agent` | `codex-cancel` | `acp-cancel` |

**Dispatch (post-Sprint 79 AS IS):** `UnifiedViewProvider.ts` is 1097 LOC. Three unified switch cases replace the previous 9 runtime-specific variants. Adding a fourth runtime requires only a new adapter class + a registry entry.

### AS IS (Sprint 79) — Runtime Adapter Pattern

```
src/runtime/                          ← added Sprint 79
├── AgentRuntime.ts                   interface + shared types
├── RuntimeRegistry.ts                holds the shared interactive instances (lookup, lifecycle)
├── runtimeFactory.ts                 createRuntime(id) — single runtime construction source (Sprint 80)
├── UnifiedApprovalGate.ts            single approval path for all runtimes
└── BrowserToolsInjector.ts           browser MCP injection config

src/agent/ClaudeCodeRuntime.ts   → implements AgentRuntime, wraps AgentRunner/AgentSession
src/codex/CodexRuntime.ts        → implements AgentRuntime, wraps CodexAppServer+CodexAuth
src/acp/AcpRuntime.ts            → implements AgentRuntime, wraps AcpManager
```

**`AgentRuntime` interface:**

```typescript
interface AgentRuntime {
  readonly id: AgentId;

  start(config: RuntimeSessionConfig): Promise<void>;
  prompt(turn: RuntimeTurnConfig): Promise<void>;
  cancel(): Promise<void>;
  dispose(): void;

  respondToApproval(requestId: string, approved: boolean, alwaysAllow: boolean): void;
  getStatus(): Promise<RuntimeStatus>;
}
```

**Unified dispatch in `UnifiedViewProvider`:**

```typescript
// 3 cases total (was 9 runtime-specific)
case 'agent-execute': {
  const runtime = this._runtimeRegistry.get(message.agentId);
  await runtime.start(sessionConfig);
  await runtime.prompt({ prompt, attachments });
  break;
}
case 'agent-cancel': {
  this._runtimeRegistry.get(message.agentId)?.cancel();
  break;
}
// agent-approve → _approvalGate.respond(requestId, approved, alwaysAllow)
```

---

## Unified Approval Gate

One webview message contract, one approval card component, all runtimes:

```typescript
// Extension → Webview (all runtimes):
{
  type: 'agent-approval-request',
  agentId: AgentId,
  requestId: string,
  kind: 'file-write' | 'shell-command' | 'permission' | 'plan',
  // kind-specific payload (file path, diff, command, plan text, etc.)
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

### Unified approval policy (Sprint 79)

A single per-conversation **mode** (`approvalMode`) governs *when* the gate fires, applied uniformly across all three runtimes. Selected in the composer (Auto · Ask · Plan), default **Auto**; sent as `approvalMode` on `agent-execute`.

| Mode | Claude Code | Codex | OpenCode (ACP) |
|---|---|---|---|
| **Auto** | SDK `bypassPermissions` — no prompts | `approvalPolicy: never`, `workspace-write` | auto-allow `request_permission` |
| **Ask** | SDK `default` mode + mutating tools (Write/Edit/Bash) removed from `allowedTools` → routed through `canUseTool` → gate | `approvalPolicy: untrusted` + `sandbox: read-only` (workspace-write pre-approves edits, so read-only is required to force a prompt) | native `request_permission` prompt |
| **Plan** | plan reminder → `ExitPlanMode` → plan card | plan collaboration mode | falls back to Ask |

Mechanics & constraints:
- `allowedTools` in the Claude SDK means *auto-allowed without prompting* — mutating tools must be excluded from it for Ask to reach `canUseTool`. `ExitPlanMode`/`AskUserQuestion` are control tools that always reach the client regardless of mode.
- Claude's SDK permission mode and Codex's `approvalPolicy`/`sandbox` are fixed at session/thread start, so crossing the Ask boundary **recreates** the Claude session / resets the Codex thread (loses that conversation's in-runtime context). Same-mode turns reuse the warm session.
- Claude sessions are reused across turns (model + Ask-class match) to preserve conversation memory — recreating per turn was a Sprint-79 regression, now fixed.
- "Always allow" was removed from the approval card (it was OpenCode-only and did not actually persist); cards offer Approve / Reject only.

---

## Browser Tool Injection

**Target:** All runtimes receive browser tools through a single `BrowserToolsInjector` that produces an MCP server spec. Each adapter knows how to inject an MCP server into its runtime.

```
BrowserToolsInjector.getServers() → MCP server config
  → ClaudeCodeRuntime: mcpServers field (already works this way)
  → CodexRuntime: replaces codexBrowserTools.ts with MCP injection via Codex protocol
  → AcpRuntime: MCP server list in ACP initialize request
```

`codexBrowserTools.ts` is deleted in Sprint 79 (Path A) if the Phase 0 Codex MCP injection audit confirms support. If not (Path B), the logic moves inside `CodexRuntime` and is tracked as ARCH-5 debt for a future sprint.

---

## Flows Architecture

Flows are JSON-serialized, node-based automation workflows. The engine resolves node dependencies and executes nodes through pluggable executors.

Engine files: `FlowExecutor.ts` (run), `FlowScheduler.ts` (timed triggers), `FlowStorage.ts` (load/save/enumerate), `FlowEditorProvider.ts` (custom editor for `.flow.json` files).

Node executors (`src/flows/nodes/`): `LLMNodeExecutor`, `ImageNodeExecutor`, `SaveFileNodeExecutor`, `ClaudeCodeNodeExecutor`, `CodexNodeExecutor`. Template interpolation (`{{variables}}`) handled by `interpolate.ts`.

UI: `webview/src/components/flows/` — canvas editor, node config panels, execution monitor.

**Key invariant:** flow nodes call model APIs directly through their own executors, not through the `AgentRuntime` interface. `ClaudeCodeNodeExecutor` and `CodexNodeExecutor` call their respective managers for single-shot turns within a flow. The distinction — autonomous agent runtime vs. single-shot flow node — is a deliberate design decision (see Locked Decisions).

---

## File Attachments

### AS IS

| Runtime | Images | PDFs | Text files |
|---|---|---|---|
| Claude Code | ✅ via `FileAttachment` | ✅ | ✅ |
| Codex | ⚠️ converted to data URLs; no `kind` check | ❌ silently dropped | ❌ silently dropped |
| ACP/OpenCode | ❌ not implemented | ❌ | ❌ |

### TO BE (Sprint 79)

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

- `ClaudeCodeRuntime`: passes through unchanged (already compatible).
- `CodexRuntime`: images → data URLs; PDF/text → inlined as fenced block in prompt preamble with notice.
- `AcpRuntime`: images → inline base64 if provider supports multimodal (check `BYOK_PROVIDER_MODELS`); text/PDF → inlined fenced block with downgrade notice.

---

## Build Pipeline

```
tsc --noEmit + esbuild  extension host: 2 bundles (out/extension.js + out/browser/browserMcpAdapter.js)  [Sprint 92 #105]
Vite → media/webview.js webview bundle: ~7.6 MB IIFE
apply-patches.sh        applies patches/vscode/001–010.patch to /vscode submodule
gulp darwin-arm64-min   VS Code full build against submodule
codesign                Apple Developer ID + Hardened Runtime + agent binary re-signing (JKBSC3ZDT5)
xcrun notarytool        Apple notarization (pull log with --id before assuming outage)
create-dmg              Sparkle-compatible .dmg
update-feed.json        Sparkle update feed → jarmo-productory/ritemark-public
```

Build prerequisites (not enforceable at commit time): Node v20.x arm64 for prod, Node v22.21.1 arm64 for dev, `arch -arm64` shell wrapper. Full commands and gotchas in `.claude/skills/vscode-development/SKILL.md`.

**RESOLVED ([#105](https://github.com/ProductoryHQ/ritemark-native/issues/105), Sprint 92):** The host was ~130 loose `.js` files plus the full `node_modules` tree (~180 packages) — root cause of Windows EMFILE, the 0-byte tsc trap (v1.7.1), and DMG bloat. Now esbuild-bundled into **two files** (`out/extension.js` + the standalone `out/browser/browserMcpAdapter.js` subprocess). Pure-JS deps are inlined; `node_modules` is retained ONLY for what esbuild can't/shouldn't bundle: the two ESM agent SDKs loaded via `new Function('return import(...)')` (`@anthropic-ai/claude-agent-sdk`, `@agentclientprotocol/sdk`), `pdfkit` (runtime font-data loader), and `fsevents` (native, macOS-only). Type-checking preserved via `tsc --noEmit`. **Future extension code must follow the bundle-safe rules** (no `__dirname`-depth path math; native/dynamic deps → esbuild `external`; separate-process code → its own entry point) — see `.claude/skills/vscode-development/SKILL.md`. #107 (webview bundle size) and #108 (build-integrity gate) are now unblocked but not built here.

**Known architectural issue ([#107](https://github.com/ProductoryHQ/ritemark-native/issues/107)):** The webview bundle is documented in several places as "~900 KB" but is actually **~7.6 MB** (~8× undocumented growth). All surfaces in one IIFE loaded on every `.md` open. No CI bundle-size budget exists.

---

## Scheduled Tasks (Daemon)

### Vision

A daemon is a **scheduler** — "a clock that fires registered tasks." What it fires is deliberately *not* the daemon's concern. Running an AI agent on a schedule is the first and primary use case, but it is one **task handler** among potentially many (git sync, file backup, future deterministic jobs). The scheduler knows only how to fire a task on schedule and record its result; each handler knows what to actually do.

This generality is a structural decision, not speculative scope. Coupling the scheduler to `AgentRuntime` would repeat the mistake the Sprint 79 runtime-adapter work exists to fix: a parallel world per use case. The scheduler-with-pluggable-handlers shape mirrors the runtime-adapter and flow-node-executor patterns already established in this codebase.

### Architecture (TO BE — Sprint 79 foundation, Sprint 80 activation)

```
src/daemon/                          ← NEW in Sprint 80
├── Scheduler.ts                     cron watcher, registration, lifecycle (handler-agnostic)
├── ScheduledTask.ts                 ScheduledTask interface + shared types
├── cron.ts                          minimal pure 5-field cron engine (unit-tested)
├── scheduleParser.ts                schedule frontmatter parser + cron validation
├── handlers/
│   ├── AgentTaskHandler.ts          runs a headless AgentRuntime session (Sprint 80)
│   ├── GitSyncHandler.ts            git pull/commit/push        (stub — interface only)
│   └── ScriptHandler.ts             arbitrary deterministic Node job (stub — interface only)
├── DaemonResultStore.ts             persists run history (workspaceState, 10/run cap per task)
└── DaemonStatusEvents.ts            VS Code status bar + Agent Library notifications
```

The scheduler scans and watches agent files under **both** `.claude/agents/` and `.agents/` in the workspace; a frontmatter `schedule:` block makes a file eligible.

**`ScheduledTask` interface (the load-bearing abstraction):**

```typescript
interface ScheduledTask {
  readonly id: string;
  readonly schedule: string;              // cron expression (future: event triggers e.g. "on-save")
  run(ctx: TaskContext): Promise<TaskResult>;
  readonly autoApprovalPolicy?: AutoApprovalPolicy;
}
```

`Scheduler` depends only on `ScheduledTask`. It never imports `AgentRuntime`. `AgentTaskHandler` is the adapter that bridges the two: it implements `ScheduledTask.run()` by calling `runtime.prompt()` on a headless session. Each run constructs its **own fresh** runtime via the `createRuntime()` factory (`src/runtime/runtimeFactory.ts`) — the single construction source that `UnifiedViewProvider` also uses for the shared interactive registry — so a headless run is fully isolated from the user's live conversation (Jarmo decision #2) and is runtime-agnostic *by construction* (claude-code is the verified default; pointing a task at another runtime is a constructor argument, not a rewrite). A future `GitSyncHandler` implements the same interface by calling `simpleGit` — the scheduler is unchanged.

**Key design decisions:**

1. **Scheduler is handler-agnostic.** The clock fires `ScheduledTask.run()` and stores the result. It has no knowledge of agents, git, or any specific job type. New scheduled capability = new handler, not a change to the scheduler. (Same shape as "new automation = new flow node executor.")

2. **Agent runs go through the same `AgentRuntime` interface.** `AgentTaskHandler` calls `runtime.prompt()` like an interactive session, but with a headless session that routes approvals to auto-block-or-skip logic instead of the UI. This is why the `AgentRuntime` abstraction must exist first (Sprint 79 is a hard prerequisite for the agent handler specifically).

3. **No daemon-specific runtime.** The agent handler is a client of the existing runtime layer, not a fourth runtime. It builds its instance through the shared `createRuntime()` factory rather than constructing a concrete runtime class directly — keeping runtime construction in one place.

4. **Auto-approval policy for headless runs:** carried by `autoApprovalPolicy` on the task. For agent tasks: file-reads auto-approved; file-writes blocked and surfaced as a notification; shell commands blocked. The agent's `allowedTools` frontmatter narrows this further. Deterministic handlers (git sync) define their own policy — they are not bound to the agent policy.

5. **Runs only while Ritemark is open (Phase 1, Sprint 80).** Any open window drives the scheduler. True background execution (process survives app close) requires OS-level service integration (launchd/systemd, menu-bar agent) and is **out of scope** until there is user demand. Deferred as a Phase 2 GitHub issue.

6. **Cross-runtime context (Sprint 80 pre-flight, agent handler only):** When an agent-task result is surfaced in the Agent Library alongside interactive history, what context (if any) carries between them? Design decision required before wiring `AgentTaskHandler` — see [#97](https://github.com/ProductoryHQ/ritemark-native/issues/97). Does not block the scheduler or non-agent handlers.

**Sprint 80 scope:** ship `Scheduler`, `ScheduledTask`, `DaemonResultStore`, `DaemonStatusEvents`, and exactly one concrete handler (`AgentTaskHandler`). `GitSyncHandler` / `ScriptHandler` ship as interface-only stubs (`run()` throws `not implemented`) to prove the interface generalizes without committing to their behaviour.

---

## Model Configuration (Single Source of Truth)

### AS IS — Model Catalog resolver (post-Sprint 89, GH #109)

The authority is the **`src/ai/modelCatalog/`** subsystem — a provenance-tracked waterfall
resolving model lists + per-surface defaults for every runtime and view:

**live provider probe → remote catalog → on-disk cache → bundled baseline** (highest-trust-that-succeeds wins).

| Layer | Source |
|---|---|
| Live | Anthropic `GET /v1/models` (primary, API-key); OpenAI `models.list()`; Gemini `/v1/models`; Codex `~/.codex/models_cache.json`; OpenCode ACP `configOptions` (deferred) |
| Remote | `feeds/model-catalog.json` in `jarmo-productory/ritemark-public` — edit to add a model with **no app release** (HTTPS + strict schema v1 + 512 KB cap + origin allowlist) |
| Cache | last good remote fetch in `globalState` (offline survival) |
| Bundled | `bundledCatalog.ts` typed baseline shipped in the VSIX (offline floor) |

Public API: `getModels(provider)`, `getDefault(provider, surface)`, `onUpdate(cb)`, `refresh()`.
Gated by the `remote-model-catalog` flag (off → bundled/cache floor only). Default Claude model: `claude-sonnet-5`.

`src/ai/modelConfig.ts` is **retained but narrowed** — only OpenAI/Gemini image arrays,
`DEFAULT_MODELS` (image defaults), and the `ModelConfig` types remain. Deleted: `CLAUDE_MODELS`,
`DEFAULT_MODEL`, `BYOK_PROVIDER_MODELS`, `ClaudeModelOption`, `ByokProvider`/`ByokModelOption`/
`toOpenCodeModelValue`; deleted files `src/agent/claudeModels.ts` + `src/codex/codexModels.ts`.

---

## Open Architectural Debt

**Resolved in Sprint 79:**

| Item | Resolution |
|---|---|
| `@agentclientprotocol/sdk` esbuild compatibility audit | Phase 0 audit complete → `research/arch-1-esbuild-audit.md`; no bundler blocker found |
| Unified approval gate (3 incompatible message types) | Done — `UnifiedApprovalGate` + `agent-approve` unified message type |
| `document-search` zombie flag (RAG removed Sprint 74) | Done — flag status set to `'disabled'` with tombstone description |
| `CODEX_MODELS` deprecated constant | Done — deleted; `CLAUDE_MODELS` + `DEFAULT_MODEL` moved to `modelConfig.ts` |
| Codex browser tools: dynamic injection vs MCP server (two patterns) | Done — Phase B: dynamic injection moved inside `CodexRuntime`; `_codexBrowserToolsEnabledForThread` now internal |
| File attachments broken for Codex (partial) and ACP (missing) | Done — `UnifiedAttachment` type; ACP fenced-block fallback with notice |
| `UnifiedViewProvider` at 2480 LOC | Done in Sprint 79 — 2480 → 1097 LOC (target ≤ 1100). **Reopened as tracked debt by Sprint 89**: catalog wiring pushed it to 1223 LOC, back over target — see Version History 2026-07-01 entry; no dedicated extraction sprint yet |

Post-Sprint 79 items tracked as GitHub Issues:

| Issue | Item | Prerequisite |
|---|---|---|
| ~~[#105](https://github.com/ProductoryHQ/ritemark-native/issues/105)~~ ✅ | **RESOLVED Sprint 92** — extension host esbuild-bundled (2 files); node_modules retained only for the ESM SDKs + pdfkit + fsevents. Unblocks #107/#108. | Sprint 92 |
| [#106](https://github.com/ProductoryHQ/ritemark-native/issues/106) | Typed webview ↔ host protocol — `bridge.ts` is stringly-typed; renames fail silently at runtime | Sprint 79 (reduces message count 9→3 first) |
| [#107](https://github.com/ProductoryHQ/ritemark-native/issues/107) | Webview bundle ~7.6 MB IIFE (documented as ~900 KB); no CI size budget; all surfaces loaded on every `.md` open | #105 esbuild first |
| [#108](https://github.com/ProductoryHQ/ritemark-native/issues/108) | Build-integrity gate — Gate 1 has passed 0-byte builds (v1.7.1); checks presence not integrity | #105 esbuild first |
| [#109](https://github.com/ProductoryHQ/ritemark-native/issues/109) | Model gateway — **model-resolution unified in Sprint 89** (`src/ai/modelCatalog/` resolver + publishable catalog); shared **retry + telemetry** unification still deferred | Sprint 89 (partial) |
| [#97](https://github.com/ProductoryHQ/ritemark-native/issues/97) | Cross-runtime conversation context — switching agents drops prior context; open design decision | **Decide before Sprint 80 daemon wiring** |

---

## Locked Decisions

The decisions that define the system. Changing any of these is an architecture-level change requiring Jarmo's approval and an architecture.md update.

- **VS Code as submodule, not fork** — customise via patches; keep upstream sync cheap. The brittleness of patch files is the accepted price.
- **Extension symlinked, not copied** — single source of truth in `extensions/ritemark/`; symlinked into `vscode/extensions/ritemark` at build time. Never edit the submodule copy.
- **Webview is sandboxed** — no filesystem/Node access; everything through `bridge.ts`. Never give the webview direct FS access to "simplify" things. ARCH-9 hardens this boundary; it must not dissolve it.
- **Model catalog is the single authority** — model lists + defaults resolve through `src/ai/modelCatalog/` (live provider probes → remote `ritemark-public` catalog → cache → bundled baseline), evolved from the static `modelConfig.ts` registry in Sprint 89 (GH #109). Never hardcode model ids in runtimes, views, or the webview; add models by editing the published catalog (no app release). The single-authority spirit is preserved; the mechanism is now dynamic + remotely updatable.
- **Flows are JSON + pluggable executors** — new automation capability = new node executor, not a new engine.
- **Features ON by default, gated by flags** — never delete code to disable (broke Settings in v1.3.0). Disable only via `src/features/flags.ts` and only on explicit instruction.
- **Layout invariants owned by patch 002** — sidebar, terminal, titlebar placement is contractual; enforced by `.claude/hooks/pre-commit-validator.sh`.
- **darwin-arm64 is the primary target** — Apple Silicon first; x64/Windows follow.
- **Three distinct AI execution shapes** — autonomous agent runtimes (Claude Code, Codex, ACP) vs. single-shot flow nodes are genuinely different and must stay so. Sprint 79 unifies the plumbing, not the behavior. The distinction is why `AgentRuntime.prompt()` is separate from `FlowExecutor` node execution.

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
| 2026-07-22 | Sprint 99 | **Parallel agent chats, v1.8.5.** `AgentRuntime.start()/prompt()/cancel()` replaced by `createSession(conversationId, config)` → `RuntimeSession`; one adapter per runtime KIND minting one session per conversation. `getStatus()` stays adapter-level. All three adapters hold session maps: Codex keeps one shared app-server process and one listener registration, routing by `params.threadId`; OpenCode runs N ACP sessions in ONE subprocess (spike-measured 339 MB for 5 sessions vs 1291 MB for 5 processes); Claude holds one `AgentSession` each — the audit found `AgentRunner` has no module-level singleton, so it was already a clean per-conversation unit. Webview store keyed by conversation with routing by `conversationId` and unknown ids DROPPED rather than misrouted. New thread rail (right edge, "+"/History pinned, one shared Phosphor `robot` tinted per runtime, one status slot where amber attention overrides the running spinner). Browser tools serialized across conversations — one browser, one active tab; per-chat browsers are shell-tier and out of scope. Three latent defects fixed: Codex scalar `_threadApprovalKey`/`_browserToolsEnabledForThread` silently destroying a sibling's thread context, `AcpRuntime._recentlyPermissionedWrites` as a cross-chat approval bypass, and `AgentSession`'s single-slot pending approvals overwriting each other (a live bug on ONE conversation). Also fixed in dev-validation: New Chat disposed every conversation's session, leaving a visible transcript whose agent had forgotten it. Touches #95/#97/#140 without resolving them. |
| 2026-07-21 | Sprint 98 | **Safe extension-update lane (GH #142), v1.8.5.** Two structural changes after the 1.8.3-ext.1 incident, where an update shipped a delta-only package and the extension died at module load (`require('pdfkit')`) before `activate()` — taking every extension-side recovery path down with it. (1) **Patch 012 (shell watchdog)** hooks `mainThreadExtensionService.$onExtensionActivationError` — verified to receive module-load throws — and renames the failing USER-dir copy of `ritemark.ritemark` so the scanner marks it invalid and filters it out, then prompts a reload onto the bundled built-in. Scoped by extension id + `extensionLocation` matching an `ExtensionType.User` install; gating on `isBuiltin` would be wrong because `dedupExtensions` rewrites it to `true` on a winning user copy. Inserted before the `isDev` early-return, which would otherwise skip it in production. (2) **`applyUpdate` is now clone-then-overlay**: it clones the bundled built-in extension (resolved from `vscode.env.appRoot`, never `getExtension().extensionPath` — that returns the user copy and would perpetuate corruption) and overlays the manifest delta, so an incomplete manifest degrades to stale files instead of an unloadable extension. Adds installer-layer `minimumAppVersion` enforcement, manifest path containment at both validation and write time, `UpdateFile.op: 'write' \| 'delete'` (deletions only became expressible once absent started meaning "inherited"), a validity probe so a broken install no longer short-circuits a corrected re-release, and `applyUpdate.test.ts` closing that function's previous zero coverage. Also: publish-side completeness + install-and-activate guards, and a `ritemark.updates.channel` canary ring. **Lane stays CLOSED until the watchdog ships and one trivial ext update passes end-to-end.** |
| 2026-07-12 | Sprint 93 | `src/update/` gains two modules: `updateStatusBar.ts` ("Relaunch to update" status-bar affordance) and `activationIntegrity.ts` (N-1 rollback + activation-crash quarantine). New `ritemark.updates.mode` setting (`auto`/`prompt`) governs silent vs. prompted extension-tier updates; full-app updates unaffected. `release-extension.sh` (renamed from `create-extension-release.sh`) + new `release-extension-preflight.sh` are the one-command extension-release path, gated by the new shell/extension release-tier rule (`CLAUDE.md` "Release Tiers"). |
| 2026-06-06 | Baseline | Initial document (agent runtime scope). Captures AS IS post-Sprint 78: 3 runtimes, 2 browser integration patterns, 3 model config locations. Defines TO BE for Sprint 79 (runtime adapter unification). |
| 2026-06-06 | Pre-Sprint 79 | Expanded to full system scope. Added: system layers overview, webview↔host protocol, flows architecture, build pipeline (with ARCH-8 and ARCH-10 observations), broader TO BE roadmap (ARCH-8 through ARCH-13), locked decisions. Reconciled with `docs-internal/architecture/` (high-level-architecture.md + to-be-proposal.md). |
| 2026-06-08 | Sprint 79 | Runtime unification: `src/runtime/` added (AgentRuntime, RuntimeRegistry, UnifiedApprovalGate, BrowserToolsInjector); ClaudeCodeRuntime/CodexRuntime/AcpRuntime adapters; `UnifiedViewProvider` 2480→1097 LOC; unified `agent-execute`/`agent-cancel`/`agent-approve` webview messages; browser IPC server + `browserMcpAdapter.ts` for ACP browser injection via Unix socket; `AgentDaemon` foundation (inactive); `CLAUDE_MODELS`/`DEFAULT_MODEL` moved to `modelConfig.ts`; `CODEX_MODELS` deleted; `document-search` flag disabled; ARCH-2/3/4/5 resolved. |
| 2026-06-08 | Sprint 79 (close) | Integration-test hardening: unified approval **policy** (Auto/Ask/Plan `approvalMode`) across all 3 runtimes; restored per-turn context dropped in the dispatch migration (active file, browser context, @mentions, Codex approval-policy/sandbox + plan toggle, Claude api-key/excludedFolders/timeout, `onExit`, Codex base-instruction clobber); fixed Claude warm-session reuse (was recreated every turn → lost memory); "Always allow" removed from the approval card; OpenCode model picker auto-default + BYOK env wiring. |
| 2026-06-08 | Pre-Sprint 80 | Generalized the daemon from agent-specific (`AgentDaemon`/`DaemonSession`) to a handler-agnostic `Scheduler` + `ScheduledTask` interface with pluggable handlers (`AgentTaskHandler` in Sprint 80; `GitSyncHandler`/`ScriptHandler` interface-only). Scheduler no longer depends on `AgentRuntime`; the agent handler is the adapter that bridges them. |
| 2026-06-10 | Sprint 82 | Draw.io diagram embedding (GH#111): `drawioEditorProvider.ts` added to [editors] — `CustomTextEditorProvider` for `*.drawio.svg` hosting the vendored draw.io v30.0.4 webapp subset (`media/drawio/`, 36 MB, Apache 2.0 incl. LICENSE/NOTICE, committed to git); clean-room bridge over the draw.io embed JSON protocol. `/diagram` slash command creates `images/diagram[-N].drawio.svg` and reuses the `imageSaved` insertion flow; `.drawio.svg` images in TipTap are double-click-to-edit. New `drawio-diagrams` flag (stable, kill-switch). `scripts/vendor-drawio.sh` re-vendors the bundle. The drawio bundle is NOT part of `media/webview.js` (no impact on GH#107). |
| 2026-06-12 | Sprint 82 (QA close) | Draw.io hosting rearchitected after manual QA found the editor blank: the app runs DIRECTLY in the webview document (patched `index.html` + `<base>` + CSP), NOT in an iframe — desktop VS Code serves vscode-resource requests only for the webview document itself (iframe navigations unserved; srcdoc clients 404 — the SW authorizes by client URL). draw.io's embed-protocol partner is a hidden same-origin relay iframe (`window.opener` → relay; its `initializeEmbedMode` rejects a self-window partner). Diagrams AUTOSAVE (debounced `autosave` event → export→save chain) matching markdown UX; markdown embeds live-refresh via an image watcher + `imageRefreshed` (cache-busted, surgical node-src swap); `/diagram` insert waits for the webview's `imageInserted` ack before opening the editor (focus-steal + externalChange reload wiped the insert). |
| 2026-07-01 | Sprint 89 | **Model Gateway (GH #109, model-resolution part).** New `src/ai/modelCatalog/` subsystem: provenance-tracked waterfall (live provider probe → remote `ritemark-public` catalog → `globalState` cache → bundled `bundledCatalog.ts` floor). Anthropic `GET /v1/models` is the primary live Claude source (supersedes the bundled SDK `supportedModels()`, which is capped at the CLI version). Publishable `feeds/model-catalog.json` adds a model with **no app release** (HTTPS + schema v1 + 512 KB cap + origin allowlist; pinned-key signature deferred). Deleted zombies `CLAUDE_MODELS`/`DEFAULT_MODEL`/`BYOK_PROVIDER_MODELS` + files `claudeModels.ts`/`codexModels.ts`. Consumers (UnifiedViewProvider, FlowEditorProvider, LLMNodeExecutor, extension.ts, webview store) rewired to `modelCatalog.*`; persisted-stale selection reconciled against the resolved list. New `remote-model-catalog` flag (stable). Default Claude model `claude-sonnet-5`. UnifiedViewProvider 1267→1223 LOC (pre-existing >1100 debt, reduced not increased). Retry/telemetry unification (rest of #109) deferred. |
| 2026-07-08 | Sprint 92 | **Extension host esbuild bundling (GH #105), v1.8.2.** `tsc -p ./` (emit) replaced by `tsc --noEmit` (typecheck) + `esbuild.config.mjs` (emit). The ~130 loose `out/*.js` files collapse to two self-contained bundles: `out/extension.js` (~5 MB, first-party + inlined pure-JS deps) and the standalone `out/browser/browserMcpAdapter.js` subprocess. `external`: `vscode`, `fsevents`, `pdfkit`, and (invisibly, via `new Function` import) the two ESM agent SDKs — so `node_modules` is retained but massively reduced in relevance. Fixed two `__dirname`-depth path landmines (`bundledAgentRuntime.ts`, `BrowserToolsInjector.ts`) that assumed the old multi-level `out/` tree. Closes the Windows EMFILE class + the 0-byte tsc trap. New "bundle-safe extension code" rule added to the `vscode-development` skill. Unblocks #107/#108. |
| 2026-07-08 | Sprint 90 | **Export Integrity (GH #127, #76), shipped in v1.8.1.** Fail-safe image export: the single chokepoint `export/v2/imageSource.ts` now returns `null` (skip) for SVG bytes and encoder-undecodable data-URLs (GIF/BMP/TIFF for pdfkit), and the IMG case in `pdfHtmlExporter.ts`/`wordHtmlExporter.ts` is wrapped in per-node try/catch — one bad image can no longer abort a whole export. SVG/draw.io rendering: new webview `lib/svgRasterExport.ts` (`inlineSvgImagesForExport` + shared `rasterizeSvgToPngDataUrl`, extracted from the mermaid path) rasterizes inline + file-referenced `.svg`/`.drawio.svg` to PNG via `<canvas>` before the HTML is posted to the host — **no new native dependency**. Atomic `saveAsMarkdown`: tracks only newly-created image paths and unlinks exactly those on failure. Shared `parseImageDataUrl` in `imageWriter.ts` accepts the compound `svg+xml` subtype (fixes `/image` SVG insert). Planned `export-svg-rasterization` flag dropped (webview flags not plumbed; graceful-skip already provides the safety). |

**Sprint 89 architecture-gate decision memo (2026-07-01, approved by Jarmo):** the Sprint 79 locked decision "Model IDs centralised in `modelConfig.ts`" is evolved — the single authority is now `src/ai/modelCatalog/` (resolver + remote catalog), not a static array. The single-place-to-look spirit is preserved; the mechanism is now dynamic and remotely updatable. Remote-catalog host: `jarmo-productory/ritemark-public`. Trust model v1: HTTPS + strict schema v1 + 512 KB cap + origin allowlist; pinned-key signature deferred to a follow-up issue.
