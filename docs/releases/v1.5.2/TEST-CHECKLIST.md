# v1.5.2 Test Checklist

**Release:** Unified Onboarding, Codex Flow Node, Scheduled Flows, Reactions, Offline Guard
**Date:** 2026-04-06

---

## macOS Apple Silicon (darwin-arm64)

### New Features

#### Unified Onboarding Wizard
- [ ] Open AI sidebar -> onboarding wizard appears (not per-agent setup screens)
- [ ] Checklist shows Git, Node.js, Claude CLI, Codex CLI dependencies
- [ ] 1-click install buttons work for missing dependencies
- [ ] 3-step flow: Checklist -> Authenticate -> Ready
- [ ] Claude and Codex auth cards appear side by side
- [ ] After setup, sidebar defaults to best available agent (Claude > Codex > Ritemark Document Agent)

#### Codex in Flows
- [ ] Open a Flow -> Codex node appears in AI section of node palette
- [ ] Add Codex node to flow canvas
- [ ] Configure Codex node (prompt, model, timeout)
- [ ] Execute flow with Codex node -> runs successfully

#### Scheduled Flow Runs
- [ ] Open a flow -> schedule option available
- [ ] Configure daily/weekdays/weekly/hourly/every N minutes
- [ ] Schedule indicator shows next run timing
- [ ] Duplicate schedule slots are suppressed

#### Editor Reactions
- [ ] Reaction button visible in editor title toolbar
- [ ] Click reaction -> options appear (love it, etc.)
- [ ] Submit reaction with optional free-text note
- [ ] Reaction submits without error

#### Offline Send Guard
- [ ] Disconnect network -> AI chat input shows offline indicator
- [ ] Send button is disabled when offline
- [ ] Typing/composing still works when offline
- [ ] Reconnect network -> send button re-enables

### Core Features (Regression)
- [ ] Open .md file -> TipTap editor loads (not plain text)
- [ ] Formatting works (bold, italic, headings)
- [ ] Save file works (Cmd+S)
- [ ] Open .docx file -> Word preview loads
- [ ] Open .xlsx file -> Excel preview loads
- [ ] Open .pdf file -> PDF preview loads
- [ ] Settings page opens and is fully functional (not a stub)
- [ ] AI sidebar agent selector shows: Claude > Codex > Ritemark Document Agent (in that order)

### Installation
- [ ] DMG opens without Gatekeeper warning
- [ ] Drag to /Applications works
- [ ] App runs from /Applications
- [ ] Finder shows version 1.5.2

### Improvements
- [ ] Settings page has "Switch to Claude.ai sign-in" button
- [ ] Settings page has "Refresh Status" button
- [ ] Agent selector: "Ritemark Document Agent" (was "Ritemark Agent")

---

## macOS Intel (darwin-x64)

### New Features
- [ ] Unified Onboarding Wizard loads and works
- [ ] Codex node available in Flows
- [ ] Scheduled Flow Runs configurable
- [ ] Editor Reactions visible and functional
- [ ] Offline Send Guard works

### Core Features (Regression)
- [ ] Open .md file -> TipTap editor loads
- [ ] Formatting works
- [ ] Save file works
- [ ] Settings page fully functional

### Installation
- [ ] DMG opens without Gatekeeper warning
- [ ] App runs from /Applications
- [ ] Rosetta NOT required (native Intel binary)
- [ ] Finder shows version 1.5.2

---

## Windows (x64)

### New Features
- [ ] Unified Onboarding Wizard loads and works
- [ ] "Get Node.js" button appears when Node is missing
- [ ] Codex node available in Flows
- [ ] Scheduled Flow Runs configurable
- [ ] Editor Reactions visible and functional
- [ ] Offline Send Guard works

### Core Features (Regression)
- [ ] Open .md file -> TipTap editor loads
- [ ] Formatting works (Ctrl+B, Ctrl+I)
- [ ] Save file works (Ctrl+S)
- [ ] Settings page fully functional

### Installation
- [ ] Installer runs without SmartScreen block
- [ ] App launches from Start Menu
- [ ] Finder/Explorer shows version 1.5.2

---

## Sign-off

| Platform | Tester | Date | Status |
|----------|--------|------|--------|
| macOS Apple Silicon | | | |
| macOS Intel | | | |
| Windows | | | |
