<!-- DRAFT — update as remaining sprint(s) land -->

## [1.8.0] - TBD

### Added
- Scheduled AI agents — add a `schedule:` block to an agent `.md` file's frontmatter (or use the new Schedule picker in the Agent editor) and the agent runs headlessly at the configured time while Ritemark is open: daily briefings, weekly summaries, recurring reports
- Schedule picker in the Agent editor — Interval mode (every N minutes/hours from presets) or Days mode (weekday chips Mon–Sun, with Every day / Weekdays / Weekends presets and a time of day), a live "Runs daily at 09:00" summary, and an Advanced (cron) escape hatch with a copy button; no cron knowledge required, local time throughout
- SCHEDULED section in the Agent Library — per-task run history (last 10 runs) that persists across restarts, fully separate from chat history; amber "needs review" rows surface scheduled runs that were blocked, with a Review & approve flow
- Status bar scheduling state — "N scheduled" when idle, a spinner with the task label while a run is in progress, and amber "N needs review" when a blocked run is waiting; completion toasts show the first line of agent output with Open result / Show runs buttons
- .xlsx files are now editable — click a cell to edit, Cmd+S / Ctrl+S to save, with dirty tracking, hot-exit backup, and revert; .xls remains a read-only preview
- fx formula bar in the Excel editor — selecting a formula cell shows its formula (e.g. `=B2*C2`) Excel-style; empty sheets offer an "Add a row to start editing" button, and rows/columns can be added
- Unified approval policy in the AI composer — a single per-conversation Auto / Ask / Plan mode picker (default Auto) that applies identically to all three runtimes (Claude Code, Codex, OpenCode), replacing the previous Codex-only Edit/Plan toggle; Auto acts without asking, Ask shows an Approve/Reject card before each file write or shell command, Plan proposes a plan and waits for approval (Plan behaves as Ask on OpenCode, which has no native plan mode)
- File attachments (images, PDFs, text files) now work for Codex and OpenCode runtimes, not just Claude Code — PDFs and text files are inlined as fenced code blocks; images sent as data URLs (Codex) or base64 multimodal attachments (OpenCode, provider-permitting)
- System prompt hint in every agent session: agents prefer `mcp__ritemark_browser__*` tools over Bash `open`/`xdg-open` for URLs, so the integrated browser is used instead of launching an external Chrome window

### Changed
- Scheduled runs are safe by default — they auto-approve file READS but block file writes and shell commands; a blocked run raises a warning toast and an amber "needs review" row, and Review & approve re-runs the agent with that single action allowed (one-time; future runs stay restricted)
- Scheduled runs execute as fresh, isolated sessions through a new `createRuntime()` factory (`src/runtime/runtimeFactory.ts`) — they never touch your interactive conversations; agent files are picked up from both `.claude/agents/` and `.agents/`, and edits take effect live without a restart
- The Excel custom editor renamed "Excel Preview" → "Excel Editor"; the grid is anchored at A1 so row numbers match real cell addresses, and multi-sheet workbooks show sheet tabs at the bottom of the viewport (Excel-style, active tab merging with the grid)
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
- #110 — the multi-sheet selector now appears reliably for multi-sheet workbooks
- `document-search` feature flag set to `status: 'disabled'` (the RAG code it gated was removed in Sprint 74 — zombie flag)

### Notes
- Scheduled tasks run only while Ritemark is open — there is no background OS daemon yet. The `scheduled-tasks-daemon` flag ships `stable` (ON by default).
- The daemon is a new `src/daemon/` subsystem: a handler-agnostic `Scheduler` over a `ScheduledTask` interface (with `GitSyncHandler` / `ScriptHandler` stubs proving extensibility), a pure tested cron engine, `DaemonResultStore` (workspaceState), and `DaemonStatusEvents`.
- Excel editing is basic-editing scope: cell values only. Formulas, styles, and merged cells are preserved on save but not editable; editing a formula cell in the grid replaces the formula with a plain value (Ritemark has no formula engine — the grid shows the last value Excel calculated). Clearing cells does not shrink the used range, and if the file changes on disk while you have unsaved edits your edits stay in memory and a refresh asks for confirmation.
- The unified dispatch path now preserves per-turn context (active file, browser context, `@mentions`) consistently across all three runtimes.
- macOS arm64 and x64 DMGs notarized; Windows installer signed. All artifacts published with a verified update feed.
