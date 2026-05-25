# Changelog

All notable changes to Ritemark Native are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **GitHub Copilot support:** Marketplace-installed GitHub Copilot and Copilot Chat can now authenticate and run in Ritemark for users with Copilot entitlement
- **Contained Copilot Chat:** Copilot Chat can appear beside Ritemark AI in the Activity Bar / Auxiliary Bar without replacing the Ritemark AI panel

### Changed
- **Copilot compatibility metadata:** product metadata now includes the GitHub auth trust, default chat agent, and proposed API allow-list required by the Marketplace Copilot Chat extension
- **Marketplace extension defaults:** Ritemark no longer disables Copilot inline completions, auto-completions, code actions, or chat-agent enablement by default

### Fixed
- **Copilot sign-in path:** Copilot's contained Sign In button now has the narrow setup commands it needs without restoring the full upstream VS Code Chat setup UI
- **Copilot Chat disabled state:** VS Code's builtin chat enablement migration no longer disables Marketplace-installed Copilot Chat when Ritemark suppresses the upstream setup contribution
- **Copilot Chat production visibility:** Marketplace-installed Copilot Chat now repairs stale hidden view state and pins the real Chat entry to the Activity Bar in macOS production builds

---

## [1.6.0] - 2026-04-28

### Added
- **Agent Library:** new activity-bar entry that auto-discovers `.claude/agents/`, `.claude/skills/`, and `.claude/commands/` from the workspace and the user-scope `~/.claude/` directory; click any entry to open the source `.md` file
- **Properties side panel:** frontmatter editing (status, tags, dates, custom fields) now opens as a dedicated right-side panel instead of a modal dialog
- **Inline Table of Contents:** sticky 220px outline rail in the editor on screens ≥960px wide, with active-heading tracking and click-to-jump
- **Dark mode:** Ritemark Dark theme as a first-class option, auto-switching with the system color scheme
- **Phosphor icon set:** primary navigation, document header, AI sidebar, and dialogs migrated from Codicons to Phosphor Icons
- **CSV → Excel conversion:** "Open in Excel" on a CSV file now converts to a temporary `.xlsx` first (fixes Mac Excel UTF-8 mojibake and EU semicolon-delimiter issues)

### Changed
- **Activity bar redesign:** 28×28 icons, rounded active-state indicator, dedicated Agent Library and Flows entries
- **Auxiliary bar tabs:** compact icon-only tabs when multiple panels are docked on the right side
- **AI panel default placement:** reliably docks on the right on first launch, ignoring cached VS Code view positions
- **Diagnostic noise suppressed:** markdown files no longer show red squiggles for missing link references; file tree no longer propagates editor decorations

### Fixed
- Activity bar 6px vertical spacing between icons (regression from Sprint 53)
- Frontmatter parser handles CRLF line endings (agents written on Windows)
- Frontmatter parser handles YAML block scalar indicators (`>`, `>-`, `|`, `|-`)
- Phosphor font loading hardened in production builds (no brief icon-box flash at startup)
- AI panel focus restoration timeout tightened so the chat input reliably focuses on open

### Technical
- VS Code base: 1.109.5 (no change from v1.5.3)
- No new extension-host runtime dependencies
- Sprints rolled up: 51 (inline ToC + CSV-to-xlsx), 52 (design foundations + Phosphor), 53 (chrome activity bar + titlebar polish, PR #29), 54 (Agent Library + Properties panel, PR #30)
- Internal v1.5.4 build (Sprint 51 only) was never tagged; its content ships here

---

## [1.3.0] - 2026-02-06

### Added
- **PDF Viewer:** Read-only preview for PDF files with page navigation, zoom (50%-200%), text selection, and continuous scroll
- **DOCX Viewer:** Read-only preview for Word documents with faithful visual rendering (fonts, colors, alignment preserved)
- **CSV Sort:** Click column headers to sort data ascending/descending/unsorted
- **CSV Add Row:** Toolbar button to append new rows to spreadsheets
- **Claude Code Node:** New Flows node type for executing Claude Code tasks via Agent SDK
- **Intel Mac Support:** Added darwin-x64 builds for older Intel-based Macs
- **GitHub Actions CI:** Automated Windows and macOS x64 builds on release

### Changed
- Webview bundle increased to ~5MB (includes react-pdf + docx-preview + PDF.js worker)

### Fixed
- Flows sidebar white background on VS Code light themes
- CSV editing preserves correct row indices during sort operations
- Package dependency conflicts with zod 4.x (upgraded openai to v6)

### Technical
- react-pdf@10.3.0 for PDF rendering with worker support
- docx-preview for faithful DOCX visual rendering
- PDF.js worker loaded separately (~1MB) via webview CSP
- Feature flags: All features enabled by default

---

## [1.2.0] - 2026-02-02

### Added
- **Ritemark Flows:** Visual workflow automation for AI content generation (Sprint 27)
  - New Activity Bar tab with Flows icon
  - Drag-and-drop node editor using React Flow
  - Trigger, LLM, Image, and Save File node types
  - Auto-layout with ELKjs
  - Undo/redo support
  - Flow storage in `.ritemark/flows/`
- New branded Ritemark Settings page

### Fixed
- Windows: Dictate button now hidden (macOS-only feature)
- Windows: PDF export images now properly embedded
- Windows: PDF export unicode checkboxes render correctly
- Windows: Word export line-ending compatibility

### Technical
- Bundle size increased by ~2.3MB (React Flow + ELKjs)
- Feature flagged as `ritemark-flows` (enabled by default)

---

## [1.1.1] - 2026-01-30

### Added
- Insert images from files with `/image` command
- Image resize handles with actual file resizing
- Stale file indicator with Refresh button
- Blockquote button in bubble menu

### Changed
- Removed table button from bubble menu (still available via `/table`)

### Fixed
- Image filenames with special characters
- Empty paragraphs around images

---

## [1.1.0] - 2026-01-26

### Added
- Document Search with RAG (Retrieval-Augmented Generation)
- Natural language queries about your documents
- Source citations in AI responses
- Local vector database using Orama

---

## [1.0.3] - 2026-01-15

### Added
- Estonian voice dictation with local Whisper model
- Voice Dictation button in editor toolbar
- Dictation Settings dialog for language/model selection

---

## [1.0.2] - 2026-01-13

### Added
- Excel file preview with multi-sheet support
- Spreadsheet toolbar with "Open in Excel/Numbers" integration
- Extension-only lightweight updates system

---

## [1.0.1] - 2026-01-11

### Added
- Document header with Properties and Export buttons
- PDF export functionality
- Word (.docx) export functionality
- CSV file viewing and inline editing
- Auto-update notification system
- Virtual scrolling for large CSV files (up to 10,000 rows)

### Changed
- Properties modal now properly shows dropdown menus

### Fixed
- Better handling of documents without YAML front-matter

---

## [1.0.0] - 2026-01-10

Initial release of Ritemark Native.

### Added
- TipTap-based WYSIWYG markdown editor
- Full markdown syntax support
- Auto-save with 1 second delay
- AI chat sidebar (Cmd+Shift+A)
- Text rephrasing and improvement tools
- OpenAI API integration
- YAML front-matter editing
- Visual property editor (text, date, tags, status)
- GFM-compatible task lists with checkboxes
- Slash command `/task` for quick task creation
- Drag handle for reordering blocks
- Delete button on hover for blocks
- Smart paste from web pages and Word/Google Docs
- Clean HTML-to-markdown conversion
- Custom Lucide-based file icon theme
- macOS DMG installer with drag-to-Applications

### Technical
- Base: VS Code OSS 1.94.0
- Platform: macOS (Apple Silicon)
- Sprints completed: 01-15

---

## Version History

| Version | Date | Type | Notes |
|---------|------|------|-------|
| 1.6.0 | 2026-04-28 | Minor | Agent Library, design refresh (Phosphor), inline ToC, dark mode, CSV→xlsx |
| 1.3.0 | 2026-02-06 | Major | PDF/DOCX preview, CSV enhancements, Claude Code node |
| 1.2.0 | 2026-02-02 | Major | Ritemark Flows - visual AI workflows |
| 1.1.1 | 2026-01-30 | Minor | Image handling improvements |
| 1.1.0 | 2026-01-26 | Minor | Document Search (RAG) |
| 1.0.3 | 2026-01-15 | Minor | Voice dictation |
| 1.0.2 | 2026-01-13 | Minor | Excel preview, lightweight updates |
| 1.0.1 | 2026-01-11 | Minor | Export, CSV preview, auto-update |
| 1.0.0 | 2026-01-10 | Major | Initial release |

---

## Links

- [Releases on GitHub](https://github.com/jarmo-productory/ritemark-public/releases)
- [Detailed release notes](./releases/)
