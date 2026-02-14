# Sprint 36: Codex CLI Integration with ChatGPT Credentials

## Goal

Integrate OpenAI's Codex CLI with ChatGPT OAuth authentication into Ritemark Native, enabling users to access autonomous coding agents using their existing ChatGPT Plus/Pro subscriptions without requiring a separate API key.

## Why This Sprint

Current AI features require API keys, which creates friction for ChatGPT subscribers who already pay $20-200/month. Codex CLI supports ChatGPT OAuth login with included API credits ($5/month for Plus, $50/month for Pro), and is fully open-source (Apache-2.0). This integration:

- **Eliminates API key friction** for ChatGPT subscribers
- **Adds autonomous coding agent** capabilities (like Claude Code but with OpenAI models)
- **Leverages existing subscription** billing (no separate API costs)
- **Uses official tooling** (open-source App Server protocol, well-documented)
- **Legally clean** (Apache-2.0 license allows bundling/embedding)

## Context

Research document: `/home/user/ritemark-native/docs/analysis/2026-02-14-codex-cli-chatgpt-integration.md`

Key architectural findings:
- Codex CLI is Apache-2.0 licensed (~15MB Rust binary)
- ChatGPT OAuth is built-in via `auth/startLogin` RPC
- App Server protocol (JSON-RPC over stdio) is the integration path
- Models include GPT-5.3-Codex, Codex-Spark (fastest), GPT-5.2-Codex
- Tools: `shell`, `apply_patch`, `web_search`, `update_plan`
- TypeScript SDK available: `@openai/codex-sdk`

## Feature Flag Check

- [x] Does this sprint need a feature flag?
  - **YES** - Experimental integration, large binary bundling decision pending, kill-switch needed
  - **Flag ID:** `codex-integration`
  - **Reason:**
    - New experimental feature (not battle-tested)
    - Binary distribution strategy TBD (bundle vs install-on-demand)
    - Need ability to disable if auth flow issues arise
    - Premium feature consideration (ChatGPT Plus/Pro required)
  - **Platforms:** All (macOS, Windows, Linux)
  - **Default state:** Disabled (manual opt-in during beta)
  - **Setting location:** `package.json` → `ritemark.experimental.codexIntegration`

## Success Criteria

- [ ] ChatGPT OAuth login flow works (browser popup → auth success)
- [ ] Authenticated status visible in Settings page
- [ ] Codex Agent panel renders in sidebar with streaming responses
- [ ] Approval dialogs for shell commands work (Approve/Reject)
- [ ] Approval dialogs for file edits work (Approve/Reject)
- [ ] Codex Flow node executes successfully
- [ ] Feature flag controls entire integration (disabled = no UI elements)
- [ ] Auth credentials stored securely (OS keyring via Codex)
- [ ] No regressions to existing AI features (OpenAI API key flow)
- [ ] Documentation updated (feature description, setup guide)

## Scope

### In Scope

| Feature | Description |
|---------|-------------|
| Feature flag | `codex-integration` flag in `flags.ts` and package.json |
| Codex binary integration | Spawn `codex app-server` as child process (stdio JSON-RPC) |
| ChatGPT OAuth login | Settings page: "Sign in with ChatGPT" button |
| Auth status display | Show signed-in user, plan type (Plus/Pro), model access |
| Codex Agent panel | Sidebar panel (like AI Assistant but agent-focused) |
| Streaming responses | Render agent messages with progress (init, tool use, thinking) |
| Approval UI for shell | Dialog with command preview, Approve/Reject buttons |
| Approval UI for files | Dialog with diff preview, Approve/Reject buttons |
| Codex Flow node | New "Codex Agent" node in Flow editor using `@openai/codex-sdk` |
| Settings integration | Add "ChatGPT Account" section to AI provider settings |
| Binary management | Detect/download/verify `codex` binary availability |

### Out of Scope (Future Sprints)

| Feature | Reason |
|---------|--------|
| Binary bundling in app | TBD - separate sprint to decide: bundle vs install vs auto-download |
| MCP server support | Codex supports MCP but adds complexity, defer to future sprint |
| Advanced Codex config | Config.toml customization (sandboxing, tool restrictions) - power user feature |
| Codex-only mode | Replace all AI with Codex (too large, this sprint is additive) |
| Batch agent tasks | Queue multiple Codex tasks - needs UX design |
| Custom instructions | Codex supports custom instructions but needs .md editor integration |
| Windows/Linux testing | Initial sprint focuses on macOS (darwin-arm64), expand in follow-up |

## Implementation Checklist

### Phase 1: Feature Flag & Architecture

- [ ] Create feature flag `codex-integration` in `src/features/flags.ts`
- [ ] Add setting to `package.json`: `ritemark.experimental.codexIntegration` (default: false)
- [ ] Define TypeScript protocol types from `codex app-server generate-ts`
- [ ] Create directory structure: `src/codex/*` for all integration code
- [ ] Document architecture decision: spawn vs SDK vs hybrid approach

### Phase 2: Binary Management

- [ ] Create `src/codex/codexManager.ts` - binary lifecycle management
- [ ] Implement detection: check if `codex` is in PATH
- [ ] Implement version check: `codex --version` compatibility
- [ ] Add binary not found error with installation instructions
- [ ] Add spawn logic for `codex app-server` with stdio pipes
- [ ] Add graceful shutdown on extension deactivate

### Phase 3: App Server Protocol Client

- [ ] Create `src/codex/codexAppServer.ts` - JSON-RPC client
- [ ] Implement JSONL parser for stdio streams
- [ ] Implement RPC method: `initialize` (capabilities negotiation)
- [ ] Implement RPC method: `auth/getStatus`
- [ ] Implement RPC method: `auth/startLogin` (trigger OAuth)
- [ ] Implement RPC method: `auth/logout`
- [ ] Implement RPC method: `thread/create`
- [ ] Implement RPC method: `turn/start` (send user message)
- [ ] Implement RPC method: `turn/interrupt` (cancel)
- [ ] Implement RPC method: `approve/command` (approve shell)
- [ ] Implement RPC method: `approve/fileChange` (approve edit)
- [ ] Handle server events: `auth/statusChanged`, `item/started`, `item/completed`, `item/agentMessage/delta`, `turn/completed`

### Phase 4: Authentication Integration

- [ ] Create `src/codex/codexAuth.ts` - auth state management
- [ ] Add "ChatGPT Account" section to `RitemarkSettingsProvider.ts`
- [ ] Add "Sign in with ChatGPT" button in webview settings
- [ ] Add auth status display (email, plan, subscription)
- [ ] Add "Sign out" button
- [ ] Handle OAuth browser popup (system browser launch)
- [ ] Handle OAuth callback/completion detection
- [ ] Add error handling for failed auth

### Phase 5: Agent Panel UI

- [ ] Create `src/codex/codexAgentProvider.ts` - webview provider
- [ ] Register webview panel in `extension.ts` (gated by feature flag)
- [ ] Add command: `ritemark.openCodexAgent` (activity bar icon)
- [ ] Create webview component: `webview/src/components/codex/CodexAgent.tsx`
- [ ] Implement message input field
- [ ] Implement streaming message renderer
- [ ] Implement progress indicators (init, tool use, thinking, done)
- [ ] Add model selector dropdown (GPT-5.3-Codex, Codex-Spark, etc.)
- [ ] Add "Cancel" button (calls `turn/interrupt`)

### Phase 6: Approval Dialogs

- [ ] Create shell approval dialog component: `webview/src/components/codex/ShellApprovalDialog.tsx`
- [ ] Create file edit approval dialog: `webview/src/components/codex/FileApprovalDialog.tsx`
- [ ] Implement diff rendering for file changes (before/after preview)
- [ ] Wire dialogs to RPC approve methods
- [ ] Add "Always allow" checkbox (future - needs config system)
- [ ] Add timeout/auto-reject for safety

### Phase 7: Flow Node Integration

- [ ] Add `@openai/codex-sdk` to `package.json`
- [ ] Create `src/flows/nodes/CodexNodeExecutor.ts` using SDK
- [ ] Add Codex node to Flow editor palette (in "Actions" category, gated by flag)
- [ ] Create webview node: `webview/src/components/flows/nodes/CodexNode.tsx`
- [ ] Implement variable interpolation for Codex prompts
- [ ] Add progress reporting during Flow execution
- [ ] Add Flow validation (requires auth before execution)
- [ ] Add error handling (auth expired, binary missing)

### Phase 8: Settings Page Updates

- [ ] Update `RitemarkSettings.tsx` with ChatGPT section (gated by flag)
- [ ] Add OAuth status card (signed in/out state)
- [ ] Add plan type display (Plus: $20/mo, Pro: $200/mo, credits)
- [ ] Add model availability list (based on plan)
- [ ] Add "Test Connection" button
- [ ] Keep existing API key section (dual auth support)

### Phase 9: Error Handling & Edge Cases

- [ ] Binary not installed → user-friendly message + install link
- [ ] Binary wrong version → upgrade prompt
- [ ] OAuth timeout → retry flow
- [ ] Token expiry → auto-refresh via Codex
- [ ] Rate limit hit → display quota message
- [ ] Spawn failure → fallback error state
- [ ] Approval timeout → safe default (reject)

### Phase 10: Testing & Documentation

- [ ] Create test Codex Flow: `research-and-implement.codex.flow.json`
- [ ] Manual test: ChatGPT login on macOS
- [ ] Manual test: Agent panel with streaming
- [ ] Manual test: Shell command approval/rejection
- [ ] Manual test: File edit approval/rejection
- [ ] Manual test: Flow node execution
- [ ] Manual test: Feature flag disabled (no UI visible)
- [ ] Update `docs/features/codex-integration.md` (new file)
- [ ] Update `WISHLIST.md` to mark Codex integration complete
- [ ] Create troubleshooting guide for common issues

### Phase 11: Cleanup & Polish

- [ ] Remove debug logging from RPC client
- [ ] Optimize binary spawn (lazy init on first use)
- [ ] Add analytics events (auth success, agent use, flow runs)
- [ ] Review memory leaks (ensure process cleanup)
- [ ] Standardize error messages
- [ ] Add user-facing success toasts

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| Feature flag | `codex-integration` controlling entire integration |
| Codex Manager | Binary detection, spawn, lifecycle management |
| App Server Client | JSON-RPC client for stdio communication |
| Auth Integration | ChatGPT OAuth in Settings page |
| Agent Panel | Sidebar panel with streaming agent responses |
| Approval Dialogs | Shell and file edit approval UI |
| Flow Node | Codex Agent node in Flow editor |
| Documentation | Feature guide + troubleshooting docs |

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Binary distribution unclear | High | High | Feature flag allows testing without bundling decision. Document install-from-npm path. |
| OAuth flow breaks in sandbox | Medium | High | Test early, use device-code auth as fallback if needed. |
| Approval UI race conditions | Medium | Medium | Timeout-based auto-reject, explicit state machine for approvals. |
| Codex version incompatibility | Low | Medium | Pin to tested version range, document compatibility. |
| Windows/Linux spawn issues | Medium | Low | Initial macOS-only (darwin-arm64), expand after validation. |
| Feature flag not respected | Low | High | QA checklist must verify flag=false hides all UI. |

## Status

**Current Phase:** 1 (PLAN)
**Approval Required:** Yes
**Gate:** BLOCKED - Waiting for Jarmo approval

## Approval

- [ ] Jarmo approved this sprint plan

---

**Created:** 2026-02-14
**Based on:** `docs/analysis/2026-02-14-codex-cli-chatgpt-integration.md`
