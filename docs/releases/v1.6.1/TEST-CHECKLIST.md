# v1.6.1 Test Checklist

**Release:** Ritemark v1.6.1 — Foundation + Polish
**Date:** 2026-05-02
**Scope:** Sprint 55 (VS Code 1.117.0 upgrade + bug bundle), Sprint 56 (Mermaid polish), Sprint 57 (Windows onboarding / Claude auth)

---

## macOS Apple Silicon (darwin-arm64) — GATE 1

**DMG:** `dist/Ritemark-1.6.1-darwin-arm64.dmg`

### Installation
- [ ] DMG opens without Gatekeeper warning (notarization stapled)
- [ ] App copies to `/Applications` cleanly
- [ ] App launches from `/Applications` (no quarantine prompt)
- [ ] About dialog shows version `1.6.1` and VS Code base `1.117.0`
- [ ] No "January 1, 1980" timestamps in Finder Get Info
- [ ] App icon renders correctly in Dock and Finder

### VS Code 1.117.0 Engine Upgrade (Sprint 55 — regression sweep)
- [ ] Editor opens .md files and renders TipTap webview (no plain text fallback)
- [ ] Sidebar layout intact: Activity Bar left, AI panel right
- [ ] Terminal opens in right sidebar (auxiliary bar), not editor area
- [ ] Titlebar action toolbar shows expected icons (per patches 002+003)
- [ ] No chat icon in titlebar / command center / activity bar (patch 003 still effective)
- [ ] Workspace trust prompt does NOT appear on first launch
- [ ] Welcome page renders with Ritemark branding (not VS Code default)
- [ ] About dialog shows Ritemark branding (icon, name, version)

### Mermaid Diagrams (Sprint 56)
- [ ] Mermaid diagram renders at full content-container width (no 680px cap)
- [ ] Diagram margins reduced (visual breathing room inside document)
- [ ] Complex / wide diagrams scroll horizontally instead of clipping/shrinking
- [ ] **Toolbar — Copy image:** clicking copies SVG to clipboard (paste into another app verifies)
- [ ] **Toolbar — Download:** Save As dialog opens, file writes to chosen path
- [ ] **Toolbar — Expand:** full-screen overlay opens
- [ ] In expand view, Cmd+Scroll zooms (cursor-anchored, 0.25x–4x)
- [ ] Esc closes expand overlay

### Claude / Codex Onboarding (Sprint 57)
- [ ] Settings → Claude section reflects truthful auth state (queries CLI, not env var)
- [ ] After `claude logout` in terminal, Settings shows Disconnected (not stale "Connected")
- [ ] Sign-in via `claude /login`: clicking sign-in opens system browser (no terminal)
- [ ] Cancel button works during in-progress sign-in
- [ ] 5-minute timeout fires if browser flow not completed
- [ ] Alternative path: "Use Anthropic API key" accepts key, stores in secret storage
- [ ] Bundled agent runtime resolves CLI binary from `extensions/ritemark/binaries/agents/` when available
- [ ] Falls back to global PATH when bundled binary not present

### Bug Fixes
- [ ] Text selection in code blocks: selection background distinguishable from row hover
- [ ] Text selection in table cells: same — distinguishable from hover
- [ ] File Explorer: gitignored entries (e.g., `node_modules/`, `docs-internal/`) are readable in BOTH light and dark themes
- [ ] AI Flow file writes: Flow-generated files appear in workspace (routed via `vscode.workspace.fs`)
- [ ] After AI/agent writes a file, File Explorer auto-refreshes
- [ ] Manual refresh button visible in File Explorer toolbar; clicking it refreshes the tree
- [ ] Activity bar icons have visible vertical spacing (~6px) between them
- [ ] Sprint 54 Agent Library + Properties side panel still present and functional (regression check)

### Core Editor (Regression)
- [ ] Open existing .md file → TipTap renders content correctly
- [ ] Type new content → autosaves
- [ ] Bold / italic / heading toolbar shortcuts work (Cmd+B, Cmd+I, Cmd+Alt+1..6)
- [ ] Save As works (Cmd+Shift+S)
- [ ] Image embed works
- [ ] Code block syntax highlighting works
- [ ] Table editing works

### AI Features (with API key configured)
- [ ] AI Chat panel responds (right sidebar)
- [ ] AI Flow generates content
- [ ] Image generation works (if applicable)
- [ ] Dictation: start, transcribe, stop

---

## macOS Intel (darwin-x64) — GATE 2 (after CI tag)

**DMG:** `dist/Ritemark-1.6.1-darwin-x64.dmg` (built after tag push)

Same checklist as Apple Silicon, plus:
- [ ] Native Intel binary (Rosetta NOT required)
- [ ] sqlite3 / node-pty native modules load (no x86_64 vs arm64 mismatch)

---

## Windows (win32-x64) — GATE 2 (after CI tag)

**Installer:** `installer-output/Ritemark-1.6.1-win32-x64-setup.exe` (built on Windows after tag push)

### Installation
- [ ] Installer runs without SmartScreen block (or "Run anyway" option visible)
- [ ] Ritemark icon shown in installer (rcedit-patched)
- [ ] App installs to `Program Files\Ritemark`
- [ ] Start Menu entry created with Ritemark icon
- [ ] Desktop shortcut option works
- [ ] Launches from Start Menu

### Sprint 57 Windows-specific
- [ ] First-launch onboarding does NOT require terminal
- [ ] Bundled agent runtime: Claude CLI binary resolves from extension directory
- [ ] Sign-in opens default browser via subprocess
- [ ] Settings reflects truthful Claude auth state

### Other (regression)
- [ ] Editor opens .md, TipTap renders
- [ ] Ctrl+B/I/save shortcuts work
- [ ] No fsevents error (macOS-only dep correctly opted out)

---

## Sign-off

| Platform | Tester | Date | Status |
|----------|--------|------|--------|
| macOS Apple Silicon (Gate 1) | Jarmo | | |
| macOS Intel (Gate 2) | Jarmo | | |
| Windows (Gate 2) | Jarmo | | |
