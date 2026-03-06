## [1.4.1] - 2026-03-XX

### Added
- **Codex CLI Agent:** OpenAI Codex as a third AI agent option alongside Claude Code and Ritemark Agent, with ChatGPT OAuth login
- **Plan Mode:** AI agent proposes a plan before executing — approve or reject before any files change
- **Interactive Agent Questions:** AI asks structured questions inline with selectable options instead of silently blocking
- **File Context for AI Chat:** Right-click "Send to AI Chat" in Explorer, active file context chip, smart deduplication
- **Context Window Protection:** Usage progress bar, warning banner at 70% capacity, friendly overflow error handling
- **Agent Badge in History:** Chat history shows agent type (Claude / Codex / Agent) for each conversation

### Changed
- VS Code patches consolidated from 21 to 4 domain-grouped patches (no functional change)
- Hidden VS Code submodule from Source Control panel
- Drag-and-drop file paths now work for all three agent types

### Fixed
- Feature flag key mismatch for Codex integration
- RitemarkSettingsProvider memory leak (missing dispose)
- JSON-RPC timeout for unanswered Codex requests
- Cross-platform binary detection (Windows compatibility)
- OAuth spinner stuck state with 60-second timeout
- ChatInput dependency array for Codex message handling
