<!-- DRAFT — update as remaining sprint(s) land -->

## [1.8.0] - TBD

### Added
- Unified approval policy in the AI composer — a single per-conversation Auto / Ask / Plan mode picker (default Auto) that applies identically to all three runtimes (Claude Code, Codex, OpenCode), replacing the previous Codex-only Edit/Plan toggle; Auto acts without asking, Ask shows an Approve/Reject card before each file write or shell command, Plan proposes a plan and waits for approval (Plan behaves as Ask on OpenCode, which has no native plan mode)
- File attachments (images, PDFs, text files) now work for Codex and OpenCode runtimes, not just Claude Code — PDFs and text files are inlined as fenced code blocks; images sent as data URLs (Codex) or base64 multimodal attachments (OpenCode, provider-permitting)
- System prompt hint in every agent session: agents prefer `mcp__ritemark_browser__*` tools over Bash `open`/`xdg-open` for URLs, so the integrated browser is used instead of launching an external Chrome window

### Changed
- `UnifiedViewProvider` unified from ~2480 LOC to ~1100: `agent-execute`, `agent-cancel`, and `agent-approve` replace nine runtime-specific message types; one `ApprovalCard` handles all approval kinds
- All three agent runtimes (Claude Code, Codex, OpenCode) now implement the `AgentRuntime` interface via adapters; behavior is unchanged
- Browser tools injected uniformly via `BrowserToolsInjector` across all runtimes; Codex now receives browser tools as MCP (same as Claude Code / OpenCode)
- Approval policy mapped per runtime from the composer's `approvalMode`: Claude Code via SDK permission mode + `canUseTool`, Codex via `approvalPolicy`/`sandbox` (Ask = `untrusted` + `read-only`), OpenCode via native ACP `request_permission`
- `CLAUDE_MODELS` and `DEFAULT_MODEL` moved from `src/agent/types.ts` to `src/ai/modelConfig.ts` — single source for all model identifiers

### Removed
- "Always allow" option removed from the approval card — it was OpenCode-only and never actually persisted; cards now offer only Approve / Reject
- Deprecated `CODEX_MODELS` constant deleted from `src/agent/types.ts`
- Per-thread `_codexBrowserToolsEnabledForThread` state removed from `UnifiedViewProvider` (internalized in `CodexRuntime`)
- `codexApproval.ts` deleted; logic absorbed into `CodexRuntime` adapter

### Fixed
- `document-search` feature flag set to `status: 'disabled'` (the RAG code it gated was removed in Sprint 74 — zombie flag)
- [TODO: add fixes from remaining sprint(s)]

### Notes
- The unified dispatch path now preserves per-turn context (active file, browser context, `@mentions`) consistently across all three runtimes.
- Daemon foundation (`AgentDaemon`, `DaemonResultStore`, `DaemonStatusEvents`) ships but is not yet connected to any UI — Sprint 80 wires scheduling.
- macOS arm64 and x64 DMGs notarized; Windows installer signed. All artifacts published with a verified update feed.
