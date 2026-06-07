# Sprint 79 Scenarios

## Core principle

**Every capability must work identically across all three runtimes.** Where native support is unavailable, the adapter uses a fallback (e.g. PDF → inline text) that produces the same user-visible outcome. A scenario that only passes for one runtime is a failing scenario.

---

## S1 — Basic prompt (all runtimes)

Repeat for each runtime: Claude Code, Codex, OpenCode.

1. Select runtime, authenticate, open workspace.
2. Type a prompt in the AI sidebar and send.
3. Extension receives `agent-execute { agentId, prompt, model }`.
4. `RuntimeRegistry.get(agentId).prompt(...)` called.
5. Progress events stream to sidebar. Run completes.

**Pass:** Identical user-visible behavior across all three runtimes. Old runtime-specific message types (`ai-execute-agent`, `codex-execute`, `acp-execute`) no longer exist.

---

## S2 — File-write approval (all runtimes)

Repeat for each runtime: Claude Code, Codex, OpenCode.

1. Agent attempts to write a file.
2. Webview receives `agent-approval-request { agentId, kind: 'file-write', filePath, diff }`.
3. `ApprovalCard` renders with file diff view.
4. User clicks Approve.
5. Webview sends `agent-approve { agentId, requestId, approved: true }`.
6. Runtime resolves the native approval. File is written.

**Pass:** All three runtimes use the unified approval card. No runtime-specific card exists. When the user has not enabled auto-allow in Settings, the card appears before any file is written — regardless of runtime.

---

## S3 — Plan approval (Claude Code)

Claude Code only — plan mode is a Claude Code SDK concept.

1. Claude enters plan mode and sends plan text.
2. Webview receives `agent-approval-request { agentId: 'claude-code', kind: 'plan', planText }`.
3. `ApprovalCard` renders plan text.
4. User approves. Claude continues execution.

**Pass:** Plan approval uses the unified card. Old `agent-answer-plan` message type no longer exists.

---

## S4 — Image attachment (all runtimes)

Repeat for each runtime: Claude Code, Codex, OpenCode.

1. User pastes (Ctrl+V) or attaches a PNG image and sends prompt.
2. `agent-execute.attachments = [{ kind: 'image', ... }]`.
3. Runtime adapter passes image to its underlying agent (native multimodal or data URL).
4. Agent responds referencing the image content.

**Pass:** All three runtimes accept and process image attachments. No runtime silently drops the image.

---

## S5 — PDF attachment (all runtimes)

Repeat for each runtime: Claude Code, Codex, OpenCode.

1. User attaches a PDF and sends prompt.
2. `agent-execute.attachments = [{ kind: 'pdf', ... }]`.
3. Runtime adapter processes the PDF:
   - Claude Code: passed natively via SDK multimodal.
   - Codex: inlined as fenced text block; progress stream emits "Attachment: report.pdf (inlined as text)".
   - OpenCode: native if ACP multimodal confirmed by Phase 0 audit, otherwise inlined same as Codex.
4. Agent responds referencing the PDF content.

**Pass:** All three runtimes produce a response that references the PDF content. No runtime silently drops the attachment. User-visible outcome is identical regardless of whether native or inline path is used.

---

## S6 — Text file attachment (all runtimes)

Repeat for each runtime: Claude Code, Codex, OpenCode.

1. User attaches a `.txt` or `.md` file and sends prompt.
2. Runtime inlines file content in prompt preamble.
3. Agent responds referencing the file content.

**Pass:** All three runtimes process text attachments identically.

---

## S7 — Browser action (Claude Code + Codex)

ACP/OpenCode: browser support is not shipped in Sprint 79 (stub returns "unsupported", see ARCH-8).

1. Browser panel open, `browser-agent-control` flag on.
2. User sends prompt: "Go to the homepage and summarize the title."
3. `BrowserToolsInjector.getServers()` called; `browserMcpServer` injected into runtime.
4. Agent uses `browser_navigate` and `browser_snapshot` tools.
5. Result streamed to sidebar.

**Pass:** Both Claude Code and Codex use the integrated browser via `BrowserToolsInjector`. `_codexBrowserToolsEnabledForThread` is gone from `UnifiedViewProvider`. OpenCode returns a clear "browser control not supported" message.

---

## S8 — Integrated browser preferred over external Chrome (Claude Code)

1. Normal chat mode; `browser-agent-control` flag is off (no browser panel open).
2. User asks Claude: "Open github.com and summarize the page."
3. Claude does NOT run `open -a "Google Chrome"` or `xdg-open` via Bash.
4. Claude explains the browser panel is not open and how to enable it, or offers to fetch the page via WebFetch instead.

**Pass:** No external Chrome window opens. Base system prompt routing hint is present regardless of flag state.

---

## S9 — Cancel mid-run (all runtimes)

Repeat for each runtime: Claude Code, Codex, OpenCode.

1. User sends prompt. Agent starts running.
2. User clicks Cancel.
3. Extension receives `agent-cancel { agentId }`.
4. `RuntimeRegistry.get(agentId).cancel()` called.
5. Sidebar returns to idle within 3 seconds.

**Pass:** All three runtimes cancel cleanly. Old `codex-cancel` / `acp-cancel` / `ai-cancel-agent` messages gone.

---

## S10 — Daemon registration (not activated)

Developer-only test; no UI involved.

1. Developer calls `AgentDaemon.register('claude-code', '0 9 * * 1-5', '/workspace')`.
2. Daemon does NOT fire immediately (cron not matched).
3. Developer advances mock clock to 9:00 AM Monday.
4. `ClaudeCodeRuntime.prompt(...)` called with headless session.
5. File-write approval blocked (headless policy); progress logged to output channel.
6. `DaemonResultStore` records run.

**Pass:** Daemon module works in isolation. Not visible in UI (Sprint 80 wires the UI).
