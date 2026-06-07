# Ritemark Extension Architecture

**Status:** Living document — updated at the end of each sprint that changes extension architecture.
**Last updated:** 2026-06-08 (Sprint 79 close — runtime unification)
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

Entry point `extension.ts` registers all providers, commands, and views.

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

**Dispatch (post-Sprint 79 AS IS):** `UnifiedViewProvider.ts` is 1097 LOC. Three unified switch cases replace the previous 9 runtime-specific variants. Adding a fourth runtime requires only a new adapter class + a registry entry.

### AS IS (Sprint 79) — Runtime Adapter Pattern

```
src/runtime/                          ← added Sprint 79
├── AgentRuntime.ts                   interface + shared types
├── RuntimeRegistry.ts                factory, lookup, lifecycle management
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
tsc → out/              extension host: 105 loose .js files
Vite → media/webview.js webview bundle: ~7.6 MB IIFE
apply-patches.sh        applies patches/vscode/001–010.patch to /vscode submodule
gulp darwin-arm64-min   VS Code full build against submodule
codesign                Apple Developer ID + Hardened Runtime + agent binary re-signing (JKBSC3ZDT5)
xcrun notarytool        Apple notarization (pull log with --id before assuming outage)
create-dmg              Sparkle-compatible .dmg
update-feed.json        Sparkle update feed → jarmo-productory/ritemark-public
```

Build prerequisites (not enforceable at commit time): Node v20.x arm64 for prod, Node v22.21.1 arm64 for dev, `arch -arm64` shell wrapper. Full commands and gotchas in `.claude/skills/vscode-development/SKILL.md`.

**Known architectural issue ([#105](https://github.com/ProductoryHQ/ritemark-native/issues/105)):** The host ships as 105 loose `.js` files plus the entire `node_modules` tree (~180 packages). Most packages are transitive dependencies not loaded at runtime. Root cause of three documented incidents: Windows EMFILE, the 0-byte tsc trap (v1.7.1), and DMG bloat.

**Known architectural issue ([#107](https://github.com/ProductoryHQ/ritemark-native/issues/107)):** The webview bundle is documented in several places as "~900 KB" but is actually **~7.6 MB** (~8× undocumented growth). All surfaces in one IIFE loaded on every `.md` open. No CI bundle-size budget exists.

---

## Scheduled Agent Tasks (Daemon)

### Vision

Agents with a `schedule:` frontmatter field run autonomously while Ritemark is open. A daemon watches registered agents, fires them on schedule, and surfaces results in the Agent Library without interrupting the user.

### Architecture (TO BE — Sprint 79 foundation, Sprint 80+ activation)

```
src/daemon/                          ← NEW in Sprint 79
├── AgentDaemon.ts                   cron watcher, registration, lifecycle
├── DaemonSession.ts                 headless AgentRuntime session (no UI approval)
├── DaemonResultStore.ts             persists run history (workspaceState)
└── DaemonStatusEvents.ts            VS Code status bar + Agent Library notifications
```

**Key design decisions:**

1. **Daemon uses the same `AgentRuntime` interface** — it calls `runtime.prompt()` like an interactive session, but with a headless session that routes approvals to auto-block-or-skip logic instead of the UI. This is the reason the `AgentRuntime` abstraction must exist first (Sprint 79 is a hard prerequisite).

2. **No daemon-specific runtime.** The daemon is a client of the existing runtime layer, not a fourth runtime.

3. **Auto-approval policy for headless runs:** file-reads auto-approved; file-writes blocked and surfaced as a notification; shell commands blocked. The agent's `allowedTools` frontmatter narrows this further.

4. **Background execution (Phase 2).** Phase 1 (Sprint 80) runs while Ritemark is open. True background execution (process keeps running after app close) requires OS-level service integration — out of scope until there is user demand.

5. **Cross-runtime context (Sprint 80 pre-flight):** The daemon fires a runtime and receives results. When the daemon result is surfaced in the Agent Library alongside interactive history, what context (if any) carries between them? Design decision required before Sprint 80 — see [#97](https://github.com/ProductoryHQ/ritemark-native/issues/97).

---

## Model Configuration (Single Source of Truth)

### AS IS — One location (post-Sprint 79)

| Location | Models |
|---|---|
| `src/ai/modelConfig.ts` | `CLAUDE_MODELS`, `DEFAULT_MODEL`, `OPENAI_LLM_MODELS`, `BYOK_PROVIDER_MODELS` |
| `src/codex/codexModels.ts` | `getCodexModels()` dynamic (Codex list fetched at runtime, not static) |

`CODEX_MODELS` deleted (deprecated static list). `agent/types.ts` retains only type definitions. `CLAUDE_MODELS` / `DEFAULT_MODEL` re-exported from `src/agent/index.ts` for backward compatibility (callers that import from `../agent`). Full elimination of the runtime `flow:modelConfig` mirror message (for static config) requires the shared module approach — see ARCH-9.

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
| `UnifiedViewProvider` at 2480 LOC | Done — 2480 → 1097 LOC (target was ≤ 1100) |

Post-Sprint 79 items tracked as GitHub Issues:

| Issue | Item | Prerequisite |
|---|---|---|
| [#105](https://github.com/ProductoryHQ/ritemark-native/issues/105) | Extension host esbuild bundling — 105 loose files + ~180 packages; root cause of EMFILE, 0-byte tsc trap, DMG bloat | Sprint 79 |
| [#106](https://github.com/ProductoryHQ/ritemark-native/issues/106) | Typed webview ↔ host protocol — `bridge.ts` is stringly-typed; renames fail silently at runtime | Sprint 79 (reduces message count 9→3 first) |
| [#107](https://github.com/ProductoryHQ/ritemark-native/issues/107) | Webview bundle ~7.6 MB IIFE (documented as ~900 KB); no CI size budget; all surfaces loaded on every `.md` open | #105 esbuild first |
| [#108](https://github.com/ProductoryHQ/ritemark-native/issues/108) | Build-integrity gate — Gate 1 has passed 0-byte builds (v1.7.1); checks presence not integrity | #105 esbuild first |
| [#109](https://github.com/ProductoryHQ/ritemark-native/issues/109) | Model gateway — agent runtimes and flow nodes have separate auth/model-resolution/retry/telemetry paths | Sprint 79 R6 |
| [#97](https://github.com/ProductoryHQ/ritemark-native/issues/97) | Cross-runtime conversation context — switching agents drops prior context; open design decision | **Decide before Sprint 80 daemon wiring** |

---

## Locked Decisions

The decisions that define the system. Changing any of these is an architecture-level change requiring Jarmo's approval and an architecture.md update.

- **VS Code as submodule, not fork** — customise via patches; keep upstream sync cheap. The brittleness of patch files is the accepted price.
- **Extension symlinked, not copied** — single source of truth in `extensions/ritemark/`; symlinked into `vscode/extensions/ritemark` at build time. Never edit the submodule copy.
- **Webview is sandboxed** — no filesystem/Node access; everything through `bridge.ts`. Never give the webview direct FS access to "simplify" things. ARCH-9 hardens this boundary; it must not dissolve it.
- **Model IDs centralised** — only in `src/ai/modelConfig.ts` (post-Sprint 79). Never hardcode model names anywhere else.
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
| 2026-06-06 | Baseline | Initial document (agent runtime scope). Captures AS IS post-Sprint 78: 3 runtimes, 2 browser integration patterns, 3 model config locations. Defines TO BE for Sprint 79 (runtime adapter unification). |
| 2026-06-06 | Pre-Sprint 79 | Expanded to full system scope. Added: system layers overview, webview↔host protocol, flows architecture, build pipeline (with ARCH-8 and ARCH-10 observations), broader TO BE roadmap (ARCH-8 through ARCH-13), locked decisions. Reconciled with `docs-internal/architecture/` (high-level-architecture.md + to-be-proposal.md). |
| 2026-06-08 | Sprint 79 | Runtime unification: `src/runtime/` added (AgentRuntime, RuntimeRegistry, UnifiedApprovalGate, BrowserToolsInjector); ClaudeCodeRuntime/CodexRuntime/AcpRuntime adapters; `UnifiedViewProvider` 2480→1097 LOC; unified `agent-execute`/`agent-cancel`/`agent-approve` webview messages; browser IPC server + `browserMcpAdapter.ts` for ACP browser injection via Unix socket; `AgentDaemon` foundation (inactive); `CLAUDE_MODELS`/`DEFAULT_MODEL` moved to `modelConfig.ts`; `CODEX_MODELS` deleted; `document-search` flag disabled; ARCH-2/3/4/5 resolved. |
