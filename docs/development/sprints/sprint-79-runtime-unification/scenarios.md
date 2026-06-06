# Sprint 79 Scenarios

## S1 — Claude Code prompt, no regression

**Setup:** Claude Code selected, workspace open, Claude authenticated.

1. User types a prompt in the AI sidebar and sends.
2. Extension receives `agent-execute { agentId: 'claude-code', prompt, model }`.
3. `RuntimeRegistry.get('claude-code').prompt(...)` called.
4. Progress events stream to the sidebar (thinking, tool use, text).
5. Run completes; sidebar shows result.

**Pass:** Identical behavior to v1.7.3. Message type is `agent-execute` (not `ai-execute-agent`).

## S2 — Codex prompt, no regression

**Setup:** Codex selected, ChatGPT authenticated.

1. User sends prompt. Extension receives `agent-execute { agentId: 'codex', ... }`.
2. `CodexRuntime.prompt(...)` called.
3. Streaming progress. Run completes.

**Pass:** Identical behavior to v1.7.3. Old `codex-execute` message no longer exists.

## S3 — ACP/OpenCode prompt, no regression

**Setup:** OpenCode selected, Anthropic API key configured.

1. User sends prompt. Extension receives `agent-execute { agentId: 'opencode', ... }`.
2. `AcpRuntime.prompt(...)` called.
3. Streaming, approval if file write attempted, completes.

**Pass:** Identical to v1.7.3.

## S4 — Unified file-write approval (Codex)

1. Codex agent attempts to write a file.
2. Webview receives `agent-approval-request { agentId: 'codex', kind: 'file-write', filePath, diff }`.
3. `ApprovalCard` renders with file diff view.
4. User clicks Approve.
5. Webview sends `agent-approve { agentId: 'codex', requestId, approved: true, alwaysAllow: false }`.
6. `CodexRuntime.respondToApproval(...)` resolves the native Codex JSON-RPC approval.
7. File is written.

**Pass:** Codex file write approval uses the unified card, not the old Codex-specific card.

## S5 — Unified plan approval (Claude Code)

1. Claude enters plan mode and sends plan.
2. Webview receives `agent-approval-request { agentId: 'claude-code', kind: 'plan', planText }`.
3. `ApprovalCard` renders plan text.
4. User approves.
5. Claude continues execution.

**Pass:** Plan approval uses the unified card. Old `agent-answer-plan` message type no longer exists.

## S6 — Image attachment, Claude Code

1. User attaches a PNG image and sends prompt.
2. `agent-execute.attachments = [{ kind: 'image', ... }]`.
3. `ClaudeCodeRuntime` passes attachment to SDK.
4. Claude responds referencing the image.

**Pass:** No change from v1.7.3.

## S7 — PDF attachment, Codex (new behavior)

1. User attaches a PDF and sends prompt to Codex.
2. `CodexRuntime.prompt()` inlines PDF content as fenced block in prompt preamble.
3. Progress stream emits a text event: "Attachment: report.pdf (inlined as text)".
4. Codex agent responds with content referencing the PDF text.

**Pass:** Previously broken (PDF silently dropped). Now inlined.

## S8 — Browser action, Claude Code (regression)

1. Browser panel open, `browser-agent-control` flag on.
2. User sends prompt to Claude: "Go to the homepage and summarize the title."
3. `BrowserToolsInjector.getServers()` called; `browserMcpServer` injected.
4. Claude uses `browser_navigate` and `browser_snapshot` tools.
5. Result streamed to sidebar.

**Pass:** Identical to v1.7.3. Browser works via MCP injection (unchanged path).

## S9 — Browser action, Codex (regression or new)

1. Browser panel open, `browser-agent-control` flag on.
2. User sends prompt to Codex: "Summarize the current browser page."
3. `CodexRuntime` injects browser tools (via MCP if Path A, via dynamic tools inside adapter if Path B).
4. Codex uses browser tools, responds.

**Pass:** Identical to v1.7.3 behavior. `_codexBrowserToolsEnabledForThread` is gone from `UnifiedViewProvider`.

## S10 — Cancel mid-run (all runtimes)

1. User sends prompt. Agent starts running.
2. User clicks Cancel.
3. Extension receives `agent-cancel { agentId }`.
4. `RuntimeRegistry.get(agentId).cancel()` called.
5. Sidebar returns to idle within 3 seconds.

**Pass:** All three runtimes cancel cleanly. Old `codex-cancel` / `acp-cancel` / `ai-cancel-agent` messages gone.

## S11 — Daemon registration (not activated)

1. Developer calls `AgentDaemon.register('claude-code', '0 9 * * 1-5', '/workspace')`.
2. Daemon does NOT fire immediately (cron not matched).
3. Developer advances mock clock to 9:00 AM Monday.
4. `ClaudeCodeRuntime.prompt(...)` called with a headless session.
5. File-write approval blocked (headless policy); progress logged to output channel.
6. `DaemonResultStore` records run.

**Pass:** Daemon module works in isolation. Not visible in UI (Sprint 80 wires the UI).
