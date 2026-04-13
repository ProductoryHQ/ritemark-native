## [1.5.2] - 2026-04-07

### Added
- **Unified Onboarding Wizard:** Single checklist replaces fragmented per-agent setup screens for Claude and Codex
- **Codex Flow Node:** Dedicated Codex node in Flow Editor AI section for OpenAI agent workflows
- **Scheduled Flow Runs:** Flow-level scheduling with daily, weekdays, weekly, hourly, and minute-interval recurrence
- **Editor Reactions:** Quick sentiment feedback action in editor toolbar with optional free-text note
- **Offline Send Guard:** AI chat input disables send when offline while keeping composing functional
- **App Analytics:** Anonymous PostHog-backed usage events with opt-out in Settings
- **Windows Node.js detection:** "Get Node.js" button in onboarding when Node is missing on Windows

### Changed
- Agent selector reordered: Claude > Codex > Ritemark Document Agent (was alphabetical)
- "Ritemark Agent" renamed to "Ritemark Document Agent"
- Claude auth UX in Settings: added "Switch to Claude.ai sign-in" and "Refresh Status" buttons
- Analytics events routed to dedicated app PostHog project instead of web analytics project
- Editor provider tracking added to all file types (DOCX, Excel, PDF, Flows, Markdown)

### Fixed
- 53 pre-existing webview TypeScript errors resolved (18 unused imports/variables, 25 type mismatches, 10 other)
- Codex node configuration crash that blanked the Flow Editor after drop/select
- Codex CLI nvm path resolution: scans ~/.nvm/versions/node/*/bin/ as fallback
- Codex architecture detection: checks Node binary instead of Codex text script
- Codex repair: uninstalls from install-time Node and reinstalls under runtime Node
- Codex spawn PATH: prepends nvm bin dir to PATH before spawning
- Codex nvm version sorting: uses semver sort (v22 > v9) instead of lexicographic
- Analytics startup sequencing so opt-out applies before first app session event
- Schedule runtime dedupe and overlap protection for long-running scheduled flows
- Windows build EMFILE error hardening in CI
