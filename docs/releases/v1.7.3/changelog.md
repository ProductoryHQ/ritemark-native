## [1.7.3] - 2026-06-06

### Added
- Unified Agent Library (robot icon in the left activity bar) gathers everything AI-related — Instructions (CLAUDE.md / AGENTS.md), Agents, Skills, Commands, and Flows — into one place, with collapsible sections whose state is remembered, Project / User scope tabs, search, sort, create (+), and full row actions
- Agent Configurator — a visual panel for editing an agent's Description, Model, Tools allow-list, Skills, and Advanced settings (Effort, Memory, Color) built on the real Claude Code agent format, so no YAML editing is required
- OpenCode — a third, bring-your-own-key AI chat runtime alongside Claude Code and Codex, integrated over the Agent Client Protocol; point it at any provider you already have a key for and pick from that provider's models
- OpenRouter API-key field in Settings, joining OpenAI, Google AI, and Anthropic
- File Change Approval card for OpenCode edits — the file on disk is untouched until you Approve; out-of-workspace writes are rejected automatically
- Auto-approve edits & tool calls toggle in Settings → OpenCode for hands-free OpenCode runs (out-of-workspace writes stay blocked even when on)
- `browser_snapshot` tool (`mcp__ritemark_browser__browser_snapshot` for Claude Code, `ritemark_browser_snapshot` for Codex) — returns the active browser tab's current ARIA outline without navigating; read-only and consent-aware, so an unshared tab leaks nothing
- Live screenshot thumbnail chip in the composer when annotation mode is on, replacing the misleading URL chip — it previews exactly the screenshot the AI will receive and refreshes as you scroll
- Composer queue — keep typing while an agent runs; one follow-up parks in a "Queued" notch above the input and auto-sends when the run finishes (discard with ×)
- Optional "Display text" field in the Edit Link dialog, pre-filled from the current selection or existing link, so you can rename a link's text and target in one step

### Changed
- Plan-approval card redesigned — it now renders only while the agent is genuinely blocked, shows the full plan text reliably, uses a flat single-level layout, and gives Approve a clear indigo primary call-to-action
- Agent Library now separates Instructions files (CLAUDE.md / AGENTS.md, project-wide rules) from configurable Agents
- The AI sidebar composer no longer locks during an agent run

### Fixed
- Plan-approval Approve/Reject buttons no longer render after the approval window has closed, where clicking them was a silent no-op
- Short, single-line code blocks no longer show a phantom horizontal scrollbar caused by the copy-button tooltip overflowing the container
- OpenCode model picker now refreshes the moment a provider API key is saved or removed, instead of staying stuck until the window is reloaded

### Removed
- Non-functional agent scheduling (cron field, `cron-parser` dependency, and the "runs only while open" banner) — scheduling returns properly designed after the Flows → agent-runtime refactor

### Notes
- macOS arm64 and x64 DMGs are notarized; the Windows installer is signed. All three artifacts ship the same app code and are published with a verified update feed.
