# Sprint 79 Spec — Runtime Unification

**Track:** SDD
**Branch:** `sprint-79-runtime-unification`
**Architecture doc:** `docs/development/architecture.md`

## Purpose

Eliminate the three parallel agent runtime stacks by introducing a shared `AgentRuntime` interface and collapsing `UnifiedViewProvider` from 2480 LOC to ~900. Fix broken file attachments for Codex and ACP. Unify the approval system to one webview message type. Standardize browser tool injection across all runtimes. Consolidate model config to one file. Clean up architectural debt (zombie flag, deprecated types). Lay the daemon scheduling foundation.

This sprint is a **structural refactor** — no user-visible behavior changes except fixing broken file attachments. Every existing feature must work identically after the sprint.

## Principles

- **Zero user-visible regression.** All three runtimes must work correctly after the refactor. Full integration test for each runtime before merge.
- **Adapt, don't rewrite.** Existing `CodexManager`, `AcpManager`, and `AgentRunner` are wrapped by adapters, not replaced. Their internal logic stays intact.
- **Architecture doc as deliverable.** `docs/development/architecture.md` `Last updated` date must equal the sprint close date. This is a required output, not optional.
- **Incremental, branch-local.** All changes on `sprint-79-runtime-unification`. Each workstream can be a separate commit series; merge to the sprint branch only, never directly to `main` during the sprint.

## Requirements

### R1: `AgentRuntime` interface + `RuntimeRegistry`

As a developer extending Ritemark with a new agent runtime, I want a single well-typed interface to implement, so adding the fourth runtime requires only a new class + a registry entry.

Acceptance criteria:
- New module `extensions/ritemark/src/runtime/` with:
  - `AgentRuntime.ts` — the `AgentRuntime` interface, `RuntimeSessionConfig`, `RuntimeTurnConfig`, `RuntimeStatus`, `UnifiedAttachment`
  - `RuntimeRegistry.ts` — factory that holds one instance per `AgentId`, exposes `get(id)`, `getAll()`, `dispose()`
- `ClaudeCodeRuntime` in `src/agent/` implements `AgentRuntime`, wrapping existing `AgentRunner` / `AgentSession`. No behavior changes.
- `CodexRuntime` in `src/codex/` implements `AgentRuntime`, wrapping existing `CodexManager`. No behavior changes.
- `AcpRuntime` in `src/acp/` implements `AgentRuntime`, wrapping existing `AcpManager`. No behavior changes.
- `RuntimeRegistry` is created once in `UnifiedViewProvider` constructor and disposed on deactivation.
- Unit tests: `RuntimeRegistry.test.ts` — get/dispose lifecycle; adapter construction.

### R2: Unified dispatch in `UnifiedViewProvider`

As a developer reading `UnifiedViewProvider`, I want to see one `agent-execute`, one `agent-cancel`, and one `agent-approve` case — not nine runtime-specific variants.

Acceptance criteria:
- Webview message types refactored (extension host + webview side must agree):
  - `ai-execute-agent` / `codex-execute` / `acp-execute` → **`agent-execute`** (with `agentId` field)
  - `ai-cancel-agent` / `codex-cancel` / `acp-cancel` → **`agent-cancel`** (with `agentId`)
  - `codex-approve` / `acp-approval-response` / `agent-answer-plan` → **`agent-approve`** (with `agentId`, `requestId`, `approved`, `alwaysAllow`, `kind`)
- `UnifiedViewProvider` switch statement has exactly three cases for the above (plus existing non-agent cases unchanged).
- All private `_handleAgentExecution`, `_handleCodexExecution`, `_handleAcpExecution` methods are deleted; logic moves into respective runtime adapters.
- `UnifiedViewProvider` target: ≤ 1100 LOC (from 2480). Remaining LOC is settings handling, browser panel, onboarding, status events — none of which is agent-runtime-specific.
- Webview (`AgentSelector.tsx`, AI sidebar message posting) updated to send `agent-execute` / `agent-cancel` / `agent-approve`.

### R3: Unified approval gate

As a user, I want file-edit approvals, command approvals, and plan approvals to look and behave the same regardless of which agent runtime is running.

Acceptance criteria:
- New `src/runtime/UnifiedApprovalGate.ts` — maps native approval types from each runtime adapter into one webview message shape:
  ```
  { type: 'agent-approval-request', agentId, requestId, kind: 'file-write'|'shell-command'|'permission'|'plan', ... }
  ```
- Extension → webview approval request always uses this shape. Runtime adapters call `ApprovalGate.request(...)` which sends to the webview and returns a Promise that resolves when `agent-approve` arrives.
- Webview: one `ApprovalCard` component handles all four `kind` values. Existing `PlanApprovalCard` and `CodexApprovalCard` are unified into it. The visual appearance may differ per kind but the component file is one.
- `codexApproval.ts` routing logic is absorbed into `CodexRuntime` adapter; `codexApproval.ts` is deleted.
- Rejection sends the correct native rejection to the runtime (Codex JSON-RPC negative response, ACP rejection outcome, Claude SDK interrupt).

### R4: Browser tool injection unification

As a developer, I want browser tools to be injected into all three runtimes through a single `BrowserToolsInjector`, so adding a fourth runtime automatically gets browser capabilities.

Acceptance criteria:
- New `src/runtime/BrowserToolsInjector.ts` — returns `{ enabled: boolean, mcpServers: Record<string, unknown> }` based on `browser-agent-control` flag and current browser state.
- `ClaudeCodeRuntime` calls `BrowserToolsInjector.get()` and passes `mcpServers` into `AgentSessionConfig` (existing behavior, just relocated).
- `CodexRuntime` calls `BrowserToolsInjector.get()` and uses `codexBrowserTools.ts`'s MCP injection path (or equivalent). `codexBrowserTools.ts` is **deleted**; Codex receives browser as MCP, not as dynamic tools. This is the primary behavioral change — verify with an integration test (Codex + browser action).
- `AcpRuntime` calls `BrowserToolsInjector.get()` and passes MCP servers into the ACP `initialize` request (OpenCode supports `mcpServers` in ACP init — verify in research/acp-browser-audit.md).
- `UnifiedViewProvider` no longer holds `_codexBrowserToolsEnabledForThread` state; this is internalized in `CodexRuntime`.

### R5: File attachment unification

As a user, I want to attach images, PDFs, and text files to prompts for any agent runtime, not just Claude Code.

Acceptance criteria:
- `UnifiedAttachment` type in `src/runtime/AgentRuntime.ts`:
  ```typescript
  interface UnifiedAttachment { id: string; kind: 'image'|'pdf'|'text'; name: string; data: string; mediaType: string; }
  ```
- `ClaudeCodeRuntime`: passes `UnifiedAttachment[]` through unchanged (already compatible).
- `CodexRuntime`: images → data URLs (existing behavior); PDF and text files → inline as a fenced block in the prompt preamble with a notice ("Attachment: <name>\n```\n<content>\n```"). Codex does not support native multimodal; the inline approach is the best available.
- `AcpRuntime`: images → inline base64 prompt attachment if the selected provider supports multimodal (check provider capabilities from `BYOK_PROVIDER_MODELS`); text/PDF → inline fenced block like Codex. Show a notice in the progress stream when a non-supported attachment type is downgraded.
- Webview: the attachment picker sends `UnifiedAttachment[]` in `agent-execute.attachments` (unified message type from R2). The attachment UI does not change visually.

### R6: Model config consolidation

As a developer, I want all model IDs in one file (`modelConfig.ts`), so the CLAUDE.md rule is literally true.

Acceptance criteria:
- `CLAUDE_MODELS` and `DEFAULT_MODEL` are moved from `src/agent/types.ts` to `src/ai/modelConfig.ts`.
- `CODEX_MODELS` (deprecated) in `types.ts` is **deleted**. Any remaining callers (verify with grep) are migrated to `codexModels.ts::getCodexModels()`.
- `agent/types.ts` retains only type definitions — no runtime data (model arrays, default strings).
- All imports updated. TS compiles cleanly. Pre-commit hook passes.

### R7: Architectural debt cleanup

Acceptance criteria:
- **ARCH-3 (zombie flag):** `document-search` flag in `flags.ts` set to `status: 'disabled'` (the RAG code it gated was deleted in Sprint 74). Description updated: "Removed in Sprint 74. Flag retained as a kill-switch tombstone."
- **ARCH-4 (deprecated constant):** `CODEX_MODELS` deleted (see R6).
- **ARCH-1 (esbuild bundling):** Verify `@agentclientprotocol/sdk` has no dynamic `require()` by running the production build and checking for bundling warnings. Record result in `research/arch-1-esbuild-audit.md`.

### R8: Daemon foundation

As a developer building scheduled agent tasks, I want a `AgentDaemon` module that can register an agent + schedule and fire it, using the `AgentRuntime` interface, so Sprint 80 can build the full scheduling UX without protocol-level work.

Acceptance criteria:
- New `src/daemon/AgentDaemon.ts` — takes a `RuntimeRegistry`, registers `(agentId, cronExpression, workspacePath)` entries, fires `runtime.prompt(...)` on schedule using `node-cron` (or `cron-parser` already installed via Sprint 77).
- `AgentDaemon` runs inside the VS Code extension host process (no separate process, no OS service — Phase 1 "open only" design).
- Headless approval policy: `file-write` → blocked (logged as skipped, not silently applied); `shell-command` → blocked; `permission` → blocked. Agent only performs read-only operations unless the approval policy is explicitly configured. This prevents autonomous destructive operations.
- `DaemonResultStore.ts` — persists last-run timestamp + result summary in `workspaceState` per agent ID.
- `AgentDaemon` is NOT activated in this sprint — it is instantiated but not connected to any UI or to the `schedule:` frontmatter field. Sprint 80 does that wiring. The sprint 79 deliverable is the working, tested module.
- Unit tests: `AgentDaemon.test.ts` — register/fire/cancel; headless approval blocks fire-and-forget; result stored.

### R9: Architecture document update

Acceptance criteria:
- `docs/development/architecture.md` `Last updated` date = sprint close date.
- All ARCH-N items resolved in this sprint are moved from "Open Architectural Debt" to the Version History entry.
- The AS IS section is updated to describe the post-Sprint 79 state (not the pre-sprint state).
- `CLAUDE.md` model config section updated to reflect consolidation.

## Non-Requirements

- No change to user-visible UI except file attachment behavior for Codex/ACP (R5).
- No new features beyond R8 daemon foundation.
- No Goose or other additional ACP agent bundled (out of scope — the interface enables it, the bundling is not part of this sprint).
- No background daemon execution (OS service, launchd, systemd) — Phase 2, post-Sprint 80.
- No changes to the webview bundle architecture or Vite config.
- No VS Code patches added or removed.

## Open Questions

| # | Question | Owner |
|---|---|---|
| Q1 | Does OpenCode ACP `initialize` accept `mcpServers`? What's the exact field name? | Verify in `research/acp-browser-audit.md` (Phase 0 audit) |
| Q2 | Does Codex JSON-RPC protocol support MCP server injection at session start (to replace `codexBrowserTools.ts`)? Or is it a different mechanism? | Audit `codexAppServer.ts` + Codex protocol docs |
| Q3 | Does `node-cron` or `cron-parser` (already installed via Sprint 77) expose a scheduler we can use for R8, or do we need an additional dep? | Check Sprint 77 dep in package.json |
| Q4 | Should `agent-execute` replace the webview messages immediately (breaking) or should we keep old messages and add new ones with a migration period? | Jarmo decision — clean break preferred; migration window only if webview regression risk is high |
