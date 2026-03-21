# Feature Wishlist

A collection of ideas for future development. No commitment, no order - just a place to capture inspiration.

* * *

## Text Editor

- [ ] Improve "Add link" dialog to smart-search from files inside the repository when user starts typing with "@"
- [ ] Add Youtube (any other streaming) videos from / command palette
- [ ] **Windows: save triggers "file updated" notification** - On Windows, every save triggers the stale file indicator as if the file was modified externally. Needs investigation — likely the file watcher is not distinguishing between internal saves and external changes on Windows


## Data Editor

- [ ] **BUG: Columns have no max-width — text never wraps** - Long cell content stretches columns infinitely with no line breaks (cells use `whitespace-nowrap` + `text-ellipsis`). Fix: add `max-width` (e.g. 300-400px) to columns and switch to `whitespace-normal` + `word-break: break-word` so text wraps within a bounded column. Consider `table-layout: fixed` for predictable column sizing. Affects both CSV and Excel preview. (`DataTable.tsx:516`, header `minWidth: 100` at line 271 but no max)
- [ ] Rebrand current Excel viewer/CSV editor as "Data Editor"
- [ ] CSV filter and column operations (add/delete/rename columns)
- [ ] CSV cell in "editable" mode must be multi-line and extend to "full-height"
- [ ] CSV open in Excel (automatically export as UTF-8)
- [ ] CSV row deletion with context menu
- [ ] Excel (.xlsx) editing (currently preview-only)
- [ ] PowerPoint (.pptx) preview

## Flow editor

- [ ] **Codex Flow node** - Add Codex as a node type in visual AI workflows (like existing Claude Code node). Enables using Codex agent in flow diagrams.
- [ ] **Codex @ mention support** - Parse `@filename` from user messages, resolve to workspace files, and inline content before sending to app-server. Codex app-server doesn't parse `@` from text — the client must preprocess mentions into resolved file content (like TUI does) or structured `UserInput::Mention` items for plugins.

## Onboarding / Welcome Screen

Redesign Welcome screen for total newbies

- [ ] Clear "Getting Started" section with step-by-step guides
- [ ] How to open/create your first document
- [ ] How to install AI coding assistants from terminal: Claude Code Codex CLI Gemini CLI
- [ ] Visual tutorials / article links
- [ ] Make it obvious what to do first
- [ ] **Custom Welcome tab icon** - Replace default VS Code editor icon with Ritemark icon in the Welcome tab (especially visible on Windows)

### Built-in Support Module

In-app help system accessible from activity bar:

- [ ] **"?" icon** at bottom of activity bar (like Settings gear position)
- [ ] **Support sidebar** with collapsible topic sections
- [ ] **Built-in .md articles** bundled with app (offline, no browser needed)
- [ ] Search functionality for finding help
- [ ] Article categories: Getting Started, Writing, AI Features, Troubleshooting

## Dictate

- [ ] When launched first time easy to digest checklist whether the dependencies are installed in computer (first-launch wizard)

## File Management

- [ ] Recent files list on welcome page
- [ ] File templates (blog post, meeting notes, etc.)
- [ ] Quick switcher improvements

## AI Assistant

- [x] Advanced Claude Code harness in AI sidebar → **Sprint 33** (multi-turn sessions, model selector, image paste, clickable file paths)
- [x] **Chat font size setting** - User-adjustable font size for AI chat interface (easier reading, accessibility) → **Sprint 37**
- [ ] **Agent Mode Picker** (Cursor-style) - Dropdown next to input to select agent behavior mode
  - [ ] Write (default) — agent executes directly, no plan approval gate
  - [ ] Plan — agent plans first, waits for user approval before executing
  - [ ] Ask — conversational only, no file edits
  - [ ] Mode persists per session, resets on new chat
- [ ] Memories
- [ ] Customization (CLAUDE.md, Agents.md support)
- [ ] AI image generation via command palette - \[ \] Opens dialog to configure Google API key - \[ \] Uses Gemini API to generate images
- [ ] On left sidebar - possibility to edit Agents and Skills/Tools of Claude Code
- [ ] RAG to support pdf, word, ppt etc (finishing sprint-24 ideas, but we need to solve local-first dilemma)
- [ ] RAG integration as agent tool (agent can search workspace documents)
- [ ] **AI Subagent GUI** - Visual interface for AI agent operations
  - [ ] See running subagents and their progress in real-time
  - [ ] Agent task history / completion status
  - [ ] **Callback system** — subagent can call back to parent agent when done, with result summary
  - [ ] **Chat UI integration** — show subagent progress cards, results, and callbacks inline in the chat conversation
- [ ] **Chat Histories** - Persistent AI conversation management
  - [ ] Browse and search past conversations
  - [ ] Resume previous sessions
  - [ ] Delete / archive old chats
- [ ] **@ Mentions** - Reference system for AI context
  - [ ] `@file` to include file content in AI context
  - [ ] `@folder` to reference entire directories
  - [ ] `@workspace` for project-wide context
  - [ ] `@agent` to invoke specific agent capabilities
- [ ] **Skills & Slash Commands** - User-facing AI capabilities
  - [ ] `/` command palette for AI actions (rewrite, summarize, translate, etc.)
  - [ ] Custom user-defined skills
  - [ ] Skill marketplace / sharing
- [ ] **AskUserQuestion rendering in chat** - When AI agent uses AskUserQuestion tool, render it as an interactive question card (buttons/options) in the chat UI instead of showing the raw tool call. Essential for conversational AI flows where the agent needs user input to proceed.

## Export

- [ ] Batch export folder as .zip of DOCX

## Export V2 (Major Refactor)

Current PDF/Word export works but has limitations. V2 should use HTML-based rendering for production-quality output.

- [ ] **HTML-based rendering** - Use editor's HTML output instead of markdown parsing (WYSIWYG export)
- [ ] **Table support** - Tables not exported correctly to PDF/Word (critical)
- [ ] **Better styling** - Professional document styling, proper fonts
- [ ] **Headers/footers** - Page numbers, document title
- [ ] **Syntax highlighting** - Code blocks with colored syntax in exports
- [ ] **Template system** - User can choose export templates

## UI/UX Refactoring (shadcn/ui)

Consolidate UI components using shadcn/ui for consistency.

- [ ] **Install shadcn/ui** - Setup with existing Tailwind config
- [ ] **Dialog component** - Replace all custom dialogs (Dictation Settings, Resize confirm, Properties, etc.)
- [ ] **Resize dialog design** - Current resize confirmation dialog needs visual polish
- [ ] **Button component** - Consistent button styles across app
- [ ] **Text Editor refactor** - Migrate FormattingBubbleMenu, BlockMenu, SlashCommands
- [ ] **Data Editor refactor** - Migrate SpreadsheetViewer components
- [ ] **Update CLAUDE.md** - Add shadcn/ui guidelines for agents

## Collaboration

- [ ] Sharing (online, cloud sharing, view permissions)

## Integrations

- [ ] Sync to cloud (Google Drive, SharePoint)

## VS Code Upstream

- [ ] **Update base VS Code to 1.109+** - Investigate release notes, breaking changes, and patch compatibility. Current base: 1.94.0

## Developer Experience

- [ ] **Claude Code auto-launch** - Detect and auto-launch Claude Code in terminal on new window - Setting: `ritemark.claudeCode.autoLaunch` (default: false) - Setting: `ritemark.claudeCode.flags` (e.g., `--dangerously-skip-permissions`) - One-time prompt before enabling

## Internationalisation (i18n)

- [ ] **UI language support** — All user-facing strings should go through a translation system instead of hardcoded English
- [ ] **Estonian** as first additional language (Jarmo's native)
- [ ] Language picker in Settings (already have `LanguagePickerModal` for dictation — extend for full UI)
- [ ] Consider VS Code's built-in `vscode.l10n` API for extension strings
- [ ] Webview strings: lightweight i18n (e.g. `i18next` or simple key-value map)

## Distribution

- [ ] **Homebrew Cask support** - `brew install --cask ritemark` - See `docs/sprints/sprint-16-auto-update/research/HOMEBREW-CASK-GUIDE.md`

* * *

## Completed

- [x] /command list "Quote" (blockquote in slash commands) → **Sprint 26**
- [x] Add images from command palette (`/image` slash command) → **Sprint 26**
- [x] Remove Table from bubble menu → **Sprint 26**
- [x] Add quote style to bubble (formatting) menu → **Sprint 26**
- [x] Image selected state (click shows selection, resize handles for local images) → **Sprint 26**
- [x] Image resize - resize actual file when user drags handles → **Sprint 26**
- [x] Stale file indicator (Refresh button when file changes externally) → **Sprint 26**
- [x] PDF preview (read-only viewer) → **Sprint 32**
- [x] Word (.docx) preview (read-only viewer) → **Sprint 32**
- [x] CSV column sorting (click headers) → **Sprint 32**
- [x] CSV add row (toolbar button) → **Sprint 32**
- [x] Claude Code node (Flows) → **Sprint 30**
- [x] Intel Mac support (darwin-x64) → **Sprint 25**
- [x] GitHub Actions CI (Windows + x64 builds) → **Sprint 25**
- [x] Create ux-expert agent → **Sprint 26**
- [x] Export: embedded images in PDF/Word
- [x] Export: code blocks with monospace styling
- [x] Export: front-matter (title, author, date)
- [x] Export: error handling with user-facing messages
- [x] In-app update notifications (like Cursor) - \[x\] Show banner when new version available - \[x\] "Later" / "Install Now" buttons
- [x] Save as PDF
- [x] Save as DOCX
- [x] Copy code button in code blocks → **Sprint 14**
- [x] Quotation styles
- [x] Paste inline images (screenshots, data URLs) → save as local files
- [x] Clicking on link opens link editing dialog → **Sprint 14**
- [x] Display images with relative paths in editor
- [x] Markdown front-matter support (visual UI via properties dialog)
- [x] HTML table paste from web (Google Docs, Wikipedia) - Sprint 15
- [x] Task list checkboxes (`- [ ]` / `- [x]`) - Sprint 13
- [x] Word count / reading time in status bar
- [x] CMD+B shortcut fixed (toggles bold, not sidebar)
- [x] Increased codeblock font size
- [x] H3 button in formatting palette
- [x] Autosave enabled by default (1 second delay)
- [x] AI panel header made sticky
- [x] Show + button on hovered line (left side) to add blocks → **Sprint 14**
- [x] Show drag handle with the + → **Sprint 14**
- [x] Cursor randomly jumps to bottom of page
- [x] When deleting table column, it leaves a "ghost" column
- [x] Nested checklist is broken after edits
- [x] Copy-paste screenshot on Mac creates double image (needs investigation)

* * *

*Last updated: 2026-03-03*
