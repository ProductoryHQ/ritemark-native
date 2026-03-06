## [1.4.0] - 2026-02-14

### Added
- **Claude Code Agent:** Autonomous AI agent in sidebar with multi-turn sessions, activity feed, image paste, clickable file paths
- **Agent Model Selector:** Choose between Claude Sonnet, Opus, or Haiku models
- **Excluded Folders Setting:** Configure which folders the agent cannot access
- **Sofia Sans Font:** Professional UI typography bundled with the app
- **Horizontal Sidebar Tabs:** Activity bar tabs moved to top of sidebar for cleaner layout
- **CSV Column Operations:** Add, rename, and delete columns via header interactions
- **CSV Copy-Paste:** Cmd+C/V support for cell data
- **Full-Text Cell Editing:** See entire cell contents while editing (Excel-like UX)

### Changed
- Refreshed color theme with softer grays and indigo accents
- Smaller breadcrumbs ribbon for more content space
- Simplified export menu (removed template choices)
- Harmonized icons across the interface

### Fixed
- **Cmd+B conflict:** Bold formatting no longer toggles sidebar
- **Terminal auto-open:** Only opens on startup if no terminal exists
- **PDF images:** Images now render correctly in PDF exports
- **Word images:** Proper aspect ratio for embedded images
- **PDF headings:** Consistent spacing and orphan protection
- **PDF blockquotes:** Added left border styling
- **Word code blocks:** Proper formatting in exports
- **Spreadsheet toolbar:** Refreshes correctly after operations

### Technical
- 7 new VS Code patches (015-021) for GUI customization
- Sofia Sans font bundled (~60KB woff2)
- Feature flag: `agentic-assistant` (experimental, off by default)
- Claude Agent SDK integration via AgentRunner service
