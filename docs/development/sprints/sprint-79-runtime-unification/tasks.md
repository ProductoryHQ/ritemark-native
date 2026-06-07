# Sprint 79 Tasks

## Phase 0 — Audits

- [ ] `research/acp-browser-audit.md` — Can ACP `initialize` accept MCP servers? Verify with `opencode acp` binary. Decide Path A or B for W3.
- [ ] `research/codex-mcp-injection-audit.md` — Does Codex protocol support MCP injection at session start? Read `codexAppServer.ts` + Codex protocol spec. Decide Path A or B for W3.
- [ ] `research/arch-1-esbuild-audit.md` — Run prod build, check `@agentclientprotocol/sdk` bundling, no dynamic-require warnings.
- [ ] Check `cron-parser` installed version in `package.json` (v4 or v5 API for R8).

## Phase 3 — Implementation

### W1: `src/runtime/` interface + registry

- [ ] Create `src/runtime/AgentRuntime.ts` — interface + all shared types
- [ ] Create `src/runtime/RuntimeRegistry.ts`
- [ ] Create `src/runtime/UnifiedApprovalGate.ts`
- [ ] Create `src/runtime/BrowserToolsInjector.ts`
- [ ] Create `src/runtime/index.ts`
- [ ] `RuntimeRegistry.test.ts` — lifecycle tests

### W6: Daemon foundation

- [ ] Create `src/daemon/AgentDaemon.ts` — cron scheduler using `RuntimeRegistry`
- [ ] Create `src/daemon/DaemonSession.ts` — headless turn + auto-approval block policy
- [ ] Create `src/daemon/DaemonResultStore.ts` — workspaceState persistence
- [ ] Create `src/daemon/DaemonStatusEvents.ts` — output channel trace
- [ ] `AgentDaemon.test.ts` — register/fire/cancel; headless blocks; result stored
- [ ] Register `AgentDaemon` in `extension.ts` (instantiated, not activated)

### W4: Runtime adapters

- [ ] `src/agent/ClaudeCodeRuntime.ts` implements `AgentRuntime` — wraps `AgentRunner`/`AgentSession`
- [ ] `ClaudeCodeRuntime.test.ts` — mock manager, verify interface contract
- [ ] `src/codex/CodexRuntime.ts` implements `AgentRuntime` — wraps `CodexManager`
- [ ] `CodexRuntime.test.ts`
- [ ] `src/acp/AcpRuntime.ts` implements `AgentRuntime` — wraps `AcpManager`
- [ ] `AcpRuntime.test.ts`
- [ ] Wire `RuntimeRegistry` in `UnifiedViewProvider` constructor

### W2: Unified dispatch

- [ ] Rename webview message types: `agent-execute`, `agent-cancel`, `agent-approve` (extension host)
- [ ] Update `UnifiedViewProvider` switch — 3 cases replace 9
- [ ] Delete `_handleAgentExecution`, `_handleCodexExecution`, `_handleAcpExecution` private methods
- [ ] Update webview side (`AgentSelector.tsx`, AI sidebar message posts) to send new message types
- [ ] `UnifiedApprovalGate` wired to webview in `UnifiedViewProvider`
- [ ] Verify `UnifiedViewProvider` ≤ 1100 LOC (`wc -l`)

### W3: Browser injection

- [ ] Implement per Phase 0 audit decision (Path A or B — see tech plan)
- [ ] If Path A: delete `codexBrowserTools.ts`, verify Codex browser tests pass
- [ ] If Path B: move `codexBrowserTools.ts` logic inside `CodexRuntime`, delete from `UnifiedViewProvider`
- [ ] Delete `_codexBrowserToolsEnabledForThread` from `UnifiedViewProvider`
- [ ] `BrowserToolsInjector.test.ts`

### W5: File attachments

- [ ] `UnifiedAttachment` type plumbed through `agent-execute` webview message
- [ ] `CodexRuntime.prompt()` — PDF/text inlined; image as data URL
- [ ] `AcpRuntime.prompt()` — image multimodal if provider supports; text/PDF inlined
- [ ] Webview `agent-execute` payload includes `attachments?: UnifiedAttachment[]`
- [ ] Test S7 (PDF attachment, Codex) manually in dev mode

### W7: Cleanup + docs

- [ ] Base system prompt in `UnifiedViewProvider` — add integrated browser routing hint (one line; always present, not flag-gated): prefer `mcp__ritemark_browser__*` tools over Bash `open`/`xdg-open` for URLs
- [ ] `flags.ts`: `document-search` → `status: 'disabled'`
- [ ] Delete `CODEX_MODELS` from `agent/types.ts`
- [ ] Move `CLAUDE_MODELS` + `DEFAULT_MODEL` to `modelConfig.ts`; update all import sites
- [ ] Delete `codexApproval.ts` (logic absorbed into `CodexRuntime`)
- [ ] Update `docs/development/architecture.md`:
  - `Last updated` date
  - AS IS section → post-sprint state
  - Close ARCH-2,3,4,5 (and 6/8 per audit outcomes)
  - Add Version History entry
- [ ] `CLAUDE.md` model config section — confirm post-sprint wording is accurate

## Phase 4 — Integration Testing

Each scenario marked "all runtimes" must pass for Claude Code, Codex, and OpenCode separately.

- [ ] S1: Basic prompt — all runtimes
- [ ] S2: File-write approval — all runtimes
- [ ] S3: Plan approval — Claude Code only
- [ ] S4: Image attachment — all runtimes
- [ ] S5: PDF attachment — all runtimes
- [ ] S6: Text file attachment — all runtimes
- [ ] S7: Browser action — Claude Code + Codex (OpenCode stubbed)
- [ ] S8: Integrated browser preferred over external Chrome — Claude Code
- [ ] S9: Cancel mid-run — all runtimes
- [ ] S10: Daemon registration — unit test

## Phase 5 — QA Gate

- [ ] `qa-validator` passes
- [ ] Pre-commit hook passes
- [ ] `wc -l extensions/ritemark/src/views/UnifiedViewProvider.ts` ≤ 1100
- [ ] `docs/development/architecture.md` `Last updated` = sprint close date
