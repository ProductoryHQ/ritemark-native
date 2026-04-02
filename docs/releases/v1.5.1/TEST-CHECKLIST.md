# v1.5.1 Test Checklist

**Release:** Mermaid Diagrams + AI Reliability
**Date:** 2026-03-22

---

## macOS Apple Silicon (darwin-arm64)

### New Features

#### Mermaid Diagram Rendering
- [ ] Create a mermaid code block (```mermaid) — renders as SVG diagram
- [ ] Toggle between diagram view and code view
- [ ] Try flowchart, sequence diagram, pie chart
- [ ] Invalid mermaid syntax shows error message
- [ ] Export document with mermaid to Word (.docx) — diagrams appear as images
- [ ] Export document with mermaid to PDF — diagrams appear as images

#### AI Agent Lifecycle
- [ ] Claude: ask a question that triggers a plan — plan appears in reviewable UI
- [ ] Claude: approve plan — execution proceeds, current plan widget visible
- [ ] Claude: ask clarifying question — inline question renders, answer continues task
- [ ] Codex: similar plan/question flow works (if API key configured)
- [ ] Clear chat resets plan state (no stale plan banners)

#### Menu Cleanup
- [ ] Help menu: reduced to essentials (Support, View License, Advanced)
- [ ] File > New File: only shows Markdown and CSV options
- [ ] CSV creation routes to table-oriented flow
- [ ] Cmd+B triggers Bold (NOT sidebar toggle)

### Core Features (Regression)
- [ ] Open .md file — editor loads with TipTap
- [ ] Formatting: bold, italic, headings work
- [ ] Save file works (Cmd+S)
- [ ] Dictation: start, transcribe, stop
- [ ] AI sidebar: Claude chat works (if API key configured)
- [ ] Settings page loads and shows all options
- [ ] Extensions marketplace hidden

### Installation
- [ ] DMG opens without Gatekeeper warning
- [ ] App runs from /Applications
- [ ] Finder shows version 1.5.1

---

## macOS Intel (darwin-x64)

### New Features

#### Mermaid Diagram Rendering
- [ ] Create a mermaid code block — renders as SVG diagram
- [ ] Toggle between diagram and code view
- [ ] Export to Word/PDF with mermaid diagrams

#### AI Agent Lifecycle
- [ ] Claude plan/question flows work
- [ ] Clear chat resets plan state

#### Menu Cleanup
- [ ] Help menu simplified
- [ ] New File picker: Markdown and CSV only
- [ ] Cmd+B triggers Bold

### Core Features (Regression)
- [ ] Open .md file — editor loads
- [ ] Formatting works
- [ ] Save file works
- [ ] Rosetta NOT required (native Intel binary)

### Installation
- [ ] DMG opens without Gatekeeper warning
- [ ] App runs from /Applications

---

## Windows (x64)

### New Features

#### Mermaid Diagram Rendering
- [ ] Create a mermaid code block — renders as SVG diagram
- [ ] Toggle between diagram and code view
- [ ] Export to Word/PDF with mermaid diagrams

#### AI Agent Lifecycle
- [ ] Claude plan/question flows work
- [ ] Clear chat resets plan state

#### Menu Cleanup
- [ ] Help menu simplified
- [ ] New File picker: Markdown and CSV only
- [ ] Ctrl+B triggers Bold

### Core Features (Regression)
- [ ] Open .md file — editor loads
- [ ] Formatting works
- [ ] Save file works

### Installation
- [ ] Installer runs without SmartScreen block
- [ ] App launches from Start Menu
- [ ] App shows version 1.5.1

---

## Sign-off

| Platform | Tester | Date | Status |
|----------|--------|------|--------|
| macOS Apple Silicon | | | |
| macOS Intel | | | |
| Windows | | | |
