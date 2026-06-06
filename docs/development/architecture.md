# Ritemark Extension Architecture

**Status:** Living document — updated at the end of each sprint that changes extension architecture.
**Last updated:** 2026-06-06 (pre-Sprint 79 baseline; expanded to full system scope)
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
  attachments?: UnifiedAttachment[];
  mcpServers?: Record<string, unknown>;  // browser tools + future MCP
  excludedFolders?: string[];
  extraSystemPrompt?: string;
  onProgress: (p: AgentProgress) => void;
  onApprovalRequest: (req: UnifiedApprovalRequest) => void;
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

**Target size:** `UnifiedViewProvider` ≤ 1100 LOC (from 2480).

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

**Known architectural issue — extension host (ARCH-8):** The host ships as 105 loose `.js` files plus the entire `node_modules` tree (~180 packages). Most packages are transitive dependencies of `@anthropic-ai/claude-agent-sdk` + `@modelcontextprotocol/sdk` and are not loaded at runtime. This is the root cause of three documented incidents: Windows EMFILE, the 0-byte tsc trap (v1.7.1), and DMG bloat. Fix: esbuild bundle with tree-shaking; target is a handful of self-contained files.

**Known architectural issue — webview bundle (ARCH-10):** The webview bundle is documented in several places as "~900 KB" but is actually **~7.6 MB** (~8× undocumented growth). All surfaces — TipTap editor, PDF/Excel/DOCX viewers, Flows canvas, AI sidebar — are in one IIFE loaded on every `.md` open. No CI bundle-size budget exists.

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

5. **Cross-runtime context (Sprint 80 pre-flight):** The daemon fires a runtime and receives results. When the daemon result is surfaced in the Agent Library alongside interactive history, what context (if any) carries between them? See ARCH-13.

---

## Model Configuration (Single Source of Truth)

### AS IS — Three locations (pre-Sprint 79)

| Location | Models |
|---|---|
| `src/agent/types.ts:52` | `CLAUDE_MODELS` (Sonnet/Opus/Haiku) |
| `src/codex/codexModels.ts` | `getCodexModels()` dynamic |
| `src/ai/modelConfig.ts` | `OPENAI_LLM_MODELS` + `BYOK_PROVIDER_MODELS` |

### TO BE — One location (post-Sprint 79)

All model identifiers in `src/ai/modelConfig.ts`. The CLAUDE.md rule "all model identifiers in one file" becomes literally true. `agent/types.ts` retains only type definitions; `CODEX_MODELS` (`@deprecated`) is deleted in Sprint 79. Full elimination of the runtime `flow:modelConfig` mirror message (for static config) requires the shared module approach — see ARCH-9 + to-be-proposal.md #3.

---

## Broader Architectural Roadmap (Post-Sprint 79)

These improvements are not in Sprint 79 scope. Each is independently shippable. Tracked as ARCH items below.

**Sequencing (from docs-internal/architecture/to-be-proposal.md):**

1. ~~Dead-code removal (#4)~~ ✅ Sprint 74 | Patch manifest (#7) — low priority
2. **Esbuild host bundle (#1) + build integrity gate (#6)** — ARCH-8, ARCH-11. The keystone structural win; they reinforce each other. Sprint 79 runtime unification makes the host cleaner and esbuild more tractable.
3. **Shared model config (#3) + typed webview protocol (#2)** — ARCH-9. Sprint 79 does the model-ID half; the full shared-module approach pairs with the typed protocol.
4. **Webview lazy-load + size budget (#5)** — ARCH-10. Last; highest constraint (CSP-compatible chunk loading, not just a Vite flag).

**Item summaries:**

**#1 Bundle the extension host (esbuild) — ARCH-8 — the keystone win.** Bundle the host into a small set of files using esbuild (same tool VS Code extensions use), tree-shaking out everything not reachable from `extension.ts`. `node_modules` stops shipping. Payoff: dissolves EMFILE structurally, eliminates the 0-byte tsc trap (a broken bundle fails loudly, not silently), shrinks the DMG, speeds extension activation. Watch-out: native modules and bundled agent binaries stay external (mark `external` in esbuild, copy explicitly).

**#2 Typed webview ↔ host protocol — ARCH-9.** Define the protocol as a discriminated union in a shared module (`shared/protocol.ts`) imported by both sides. Adding or changing a message type becomes a compile error on both ends until both are updated. Sprint 79 reduces message types from 9+ to 3 (agent-execute/cancel/approve), making the typed protocol tractable.

**#3 Single model-config source — partial in Sprint 79 (R6).** Sprint 79 consolidates model IDs into `modelConfig.ts`. Full solution: promote to a `@shared` module that both host (esbuild) and webview (Vite `@shared` alias) import directly, eliminating the runtime `flow:modelConfig` mirror message for static config.

**#5 Webview lazy-load + size budget — ARCH-10.** Split viewers (PDF/Excel/DOCX) and Flows canvas out of the editor critical path. Requires CSP-compatible chunk loading (nonce'd script injection or small loader) — not just flipping `inlineDynamicImports`. Add a CI bundle-size budget so the ~7.6 MB figure is tracked, not invisible.

**#6 Build-integrity gate — ARCH-11.** Before signing: (a) clean build from empty `out/`/`dist/` (no incremental tsc state); (b) assert every emitted artifact is non-zero; (c) smoke-launch the built app headless and confirm the `ai-sidebar` sentinel. Win #8 (esbuild bundling) makes (a) and (b) near-automatic — a broken bundle fails at build time, not as a 0-byte file.

**Model gateway — ARCH-12.** Currently the three agent runtimes and flow nodes each carry their own auth, model-resolution, retry, and telemetry paths. A thin gateway interface would unify these without merging execution shapes. Separate from R6 (which consolidates model IDs, not call paths).

**Cross-runtime conversation context — ARCH-13 (GH#97).** When switching agents mid-conversation, what context (if any) carries to the new runtime? Today each runtime has its own backend session; the sidebar renders a single combined transcript — so switching drops prior context from the new agent's view. Three design options: replay-on-switch, unified transcript + per-turn runtime marker, explicit "carry context to <agent>" handoff. **Must be decided before any Sprint 80+ daemon wiring or multi-agent orchestration.** Tracking: [ProductoryHQ/ritemark-native#97](https://github.com/ProductoryHQ/ritemark-native/issues/97).

---

## Open Architectural Debt

| ID | Item | Blocking? | Target sprint |
|---|---|---|---|
| **ARCH-1** | `@agentclientprotocol/sdk` esbuild compatibility — verify no dynamic `require()` in prod build. Sprint 76 shipped without verification. | Not blocking, but prerequisite for ARCH-8. | Sprint 79 Phase 0 audit |
| **ARCH-2** | Unified approval gate — three incompatible approval message types. | No, but each sprint without it adds drift. | Sprint 79 (R3) |
| **ARCH-3** | `document-search` zombie flag gates deleted RAG code (`src/rag/` removed Sprint 74). | No effect; flag is a tombstone. | Sprint 79 cleanup (R7) |
| **ARCH-4** | `CODEX_MODELS` in `types.ts` is `@deprecated` but not removed. | No. | Sprint 79 (R6) |
| **ARCH-5** | Codex browser tools use dynamic injection (`codexBrowserTools.ts`); Claude Code uses MCP server. Two patterns for same capability. | No, but blocks ACP browser parity. | Sprint 79 (R4) — Path A if audit confirms, Path B if blocked |
| **ARCH-6** | File attachments broken for Codex (partial) and ACP (missing). | Yes — user-visible bug. | Sprint 79 (R5) |
| **ARCH-7** | `UnifiedViewProvider` at 2480 LOC; grows linearly with each new runtime. | No, but maintainability cost compounds. | Sprint 79 (R2) |
| **ARCH-8** | Extension host ships as 105 loose `.js` files + ~180 `node_modules` packages. Root cause of Windows EMFILE, 0-byte tsc trap, DMG bloat. Fix: esbuild bundle. | No — three documented incidents but not hard-blocking. | Sprint 80 or 81 |
| **ARCH-9** | Webview ↔ host protocol is stringly-typed (`bridge.ts`). Message renames fail silently at runtime. | No. | After Sprint 79 (sprint count TBD; Sprint 79 reduces message types from 9+ → 3 first) |
| **ARCH-10** | Webview bundle is ~7.6 MB IIFE (documented as ~900 KB; 8× undocumented growth). All surfaces loaded on every `.md` open; no CI size budget. | No — UX impact on cold start but not broken. | After ARCH-8 (esbuild first) |
| **ARCH-11** | Build-integrity gate: Gate 1 has passed a build with 0-byte `.js` files (v1.7.1 incident). Gate checks file existence, not integrity. | Yes — can ship broken DMGs that pass Gate 1. | Sprint 80 (with ARCH-8) |
| **ARCH-12** | Model gateway: agent runtimes and flow nodes have separate auth / model-resolution / retry / telemetry paths. | No. | After Sprint 79; sequence TBD |
| **ARCH-13** | Cross-runtime conversation context (GH#97). Switching agents mid-conversation silently drops prior context from the new runtime. Open design decision. | Decision required before Sprint 80 daemon wiring. | Sprint 80 pre-flight |

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
