# v1.4.0 Test Checklist

**Release:** Ritemark v1.4.0  
**Date:** 2026-02-14

* * *

## macOS Apple Silicon (darwin-arm64)

### New Features: Claude Code Agent

- [x] Enable feature: Settings > Ritemark Features > Agentic AI Assistant
- [x] Agent selector dropdown shows "Claude Code" option when enabled
- [x] Select Claude Code + Sonnet model
- [x] Send a message — activity feed shows progress cards
- [x] Multi-turn conversation — follow-up messages work (~2-3s response)
- [x] Paste screenshot with Cmd+V — thumbnail appears in chat
- [x] File paths in responses are clickable
- [x] Stop button interrupts running agent
- [x] "New Chat" clears conversation

### New Features: Visual Design

- [x] UI text uses Sofia Sans font (not system font)
- [x] Color theme: light gray sidebar, white editor, indigo accents
- [x] Sidebar tabs appear as horizontal bar at top of sidebar
- [x] Breadcrumbs ribbon is smaller/slimmer
- [x] Icons look consistent/harmonized

### New Features: CSV Editing

- [x] Open a CSV file
- [x] Click cell to select — blue border appears
- [x] Double-click or type to edit — full cell content visible
  - [ ] Double click not working - but that is not blocker!
- [x] Press Enter to commit, Esc to cancel
- [x] Press Tab to move to next cell
- [x] Cmd+C copies cell content
- [x] Cmd+V pastes into active cell
- [x] Add column: click + button in header row
- [x] Rename column: double-click column header
- [x] Delete column: click header, click red minus button

### Bug Fixes

- [ ] Cmd+B toggles **Bold** in editor (not sidebar)
  - [ ] Still not working - but that's not a blocker
- [ ] Terminal does NOT auto-open on window launch
  - [ ] Still not working - not a blocker
- [x] PDF export includes images correctly
- [x] Word export includes images with correct aspect ratio

### Core Features (Regression)

- [x] Open .md file — TipTap editor loads
- [x] Type text, formatting works (**bold**, *italic*, headings)
- [x] Save file (Cmd+S)
- [x] Open PDF — preview loads with zoom controls
- [x] Open DOCX — preview shows with colors/formatting
- [x] Open Excel (.xlsx) — preview loads with sheet tabs
- [x] Ritemark Agent chat works (non-Claude Code)
- [x] Export PDF — file saves correctly
- [x] Export Word — file saves correctly

### Installation

- [ ] DMG opens without Gatekeeper warning
- [ ] App launches from /Applications
- [ ] No crashes on startup

* * *

## macOS Intel (darwin-x64)

### New Features: Claude Code Agent

- [ ] Enable feature: Settings > Ritemark Features > Agentic AI Assistant
- [ ] Agent selector dropdown shows "Claude Code" option when enabled
- [ ] Select Claude Code — activity feed appears
- [ ] Send a message — progress cards display
- [ ] Multi-turn conversation works

### New Features: Visual Design

- [ ] UI text uses Sofia Sans font
- [ ] Color theme matches arm64 build
- [ ] Sidebar tabs horizontal at top
- [ ] Icons harmonized

### New Features: CSV Editing

- [ ] Full-text cell editing works
- [ ] Column operations work (add/rename/delete)
- [ ] Copy-paste works

### Bug Fixes

- [ ] Cmd+B toggles Bold (not sidebar)
- [ ] Terminal does NOT auto-open

### Core Features (Regression)

- [ ] Open .md file — editor loads
- [ ] Formatting works
- [ ] Save file works
- [ ] PDF preview works
- [ ] DOCX preview works

### Installation

- [ ] DMG opens without Gatekeeper warning
- [ ] App runs from /Applications
- [ ] Rosetta NOT required (native Intel binary)

* * *

## Windows (x64)

### New Features: Claude Code Agent

- [ ] Enable feature: Settings > Ritemark Features > Agentic AI Assistant
- [ ] Agent selector dropdown shows "Claude Code" option when enabled
- [ ] Select Claude Code — activity feed appears
- [ ] Send a message — progress cards display

### New Features: Visual Design

- [ ] UI text uses Sofia Sans font
- [ ] Color theme correct
- [ ] Sidebar tabs horizontal at top

### New Features: CSV Editing

- [ ] Full-text cell editing works
- [ ] Ctrl+C copies, Ctrl+V pastes
- [ ] Column operations work

### Bug Fixes

- [ ] Ctrl+B toggles Bold (not sidebar)
- [ ] Terminal does NOT auto-open

### Core Features (Regression)

- [ ] Open .md file — editor loads
- [ ] Formatting works (Ctrl+B, Ctrl+I, etc.)
- [ ] Save file works
- [ ] PDF preview works
- [ ] DOCX preview works

### Installation

- [ ] Installer runs without SmartScreen block
- [ ] App launches from Start Menu
- [ ] No crashes on startup

* * *

## Sign-off

| Platform | Tester | Date | Status |
| --- | --- | --- | --- |
| macOS Apple Silicon |  |  |  |
| macOS Intel |  |  |  |
| Windows |  |  |  |