# v1.8.5 Test Checklist

**Release:** Ritemark v1.8.5 — Safe Extension-Update Lane + Parallel Agent Chats + Runtime Bumps + Agent Capability Context
**Date:** 2026-07-24 (arm64 build)
**Scope:**
- **Sprint 98** (safe ext-update lane — shell watchdog patch 012, copy-then-overlay installer, `ritemark.updates.channel` setting; #142 groundwork)
- **Sprint 99** (parallel agent chats — session-per-conversation, thread rail, thread cap; multi-thread store)
- **Sprint 100** (runtime bumps — Claude Code 2.1.217, OpenCode 1.18.4, repeatable runtime verification; #146)
- **Sprint 101** (agent capability-context system prompt; #154)
- **Agent-fix PRs** — #147 dictation default 5s (#136), #152 "Check again" on AI Offline badge (#125), #149 release-notes process (docs-only, no runtime test)

> Before opening the new DMG: **quit any running Ritemark.app** (Cmd+Q). Two instances share the user-data dir and cause a blank webview / SW `InvalidStateError`.

---

## macOS Apple Silicon (darwin-arm64) — GATE 1

**DMG:** `dist/Ritemark-1.8.5-darwin-arm64.dmg` (signed Developer ID, **un-notarized** — right-click → **Open** to bypass Gatekeeper, or `xattr -dr com.apple.quarantine '/Applications/Ritemark.app'`)
**SHA256:** `4fe9cc553865353062e90ad99bda8af7979fa8ad95bf8b3ed82587f27ac0ff40` (rebuild 2 — indigo thread-rail fix `0fec43f`; supersedes `613d4847…`)

### Installation

- [ ] DMG mounts; app copies to `/Applications` cleanly
- [ ] Right-click → **Open** launches it (un-notarized warning is expected)
- [ ] About dialog shows version **`1.8.5`** (VS Code base version in Info.plist is expected — not a bug)
- [ ] Markdown file opens in the Ritemark editor; typing + autosave work

### Parallel agent chats (Sprint 99) — headline

- [ ] Thread rail is visible in the AI sidebar; a second thread can be opened while the first is running
- [ ] Two threads run agent turns simultaneously without cross-talk (responses land in the right thread)
- [ ] Thread cap dialog appears when opening more threads than allowed
- [ ] Chat history: closing and reopening a thread restores its conversation
- [ ] Runtime switching (Claude ↔ Codex ↔ OpenCode) works per-thread
- [ ] Thread-rail robot icons are brand **indigo** in both light and dark mode (Gate 1 rebuild fix)

### Runtime bumps (Sprint 100)

- [ ] Claude Code chat works end-to-end on the bundled 2.1.217 binary
- [ ] OpenCode chat works end-to-end on the bundled 1.18.4 binary (approval gate still fires before writes)
- [ ] Codex chat works end-to-end
- [ ] Parallel sessions work on the NEW binaries (2 Claude threads at once)

### Agent capability context (Sprint 101)

- [ ] Agent knows its Ritemark surroundings: ask "what tools/capabilities do you have in this editor?" — answer reflects Ritemark context (browser tools, file access), not generic CLI
- [ ] No prompt-injection regression: agent still refuses instructions embedded in opened documents

### Safe ext-update lane (Sprint 98)

- [ ] App starts normally with no user-dir extension copy present (watchdog dormant — no visible effect)
- [ ] `ritemark.updates.channel` setting exists and defaults to `stable`
- [ ] (Deep test intentionally deferred: real `-ext.N` E2E happens post-release per #142 criterion)

### Agent-fix PRs

- [ ] **#152 / #125**: disconnect network → AI Offline badge appears with "Check again" link; clicking shows a brief "Checking…" state; reconnect network → "Check again" brings the sidebar back online without restart
- [ ] **#147 / #136**: Dictation Settings modal shows chunk duration default **5s** on a fresh profile; 3s/10s remain selectable; Estonian dictation works

### Regression sweep

- [ ] Settings page loads and saves an API key
- [ ] Flows panel opens; an existing flow runs
- [ ] Integrated browser opens a page; agent browser actions work
- [ ] PDF/DOCX preview opens; export to PDF/Word works
- [ ] Comments (margin rail, multi-block) still render and round-trip

---

## macOS Intel (darwin-x64) + Windows — GATE 2

**DMG:** `dist/Ritemark-1.8.5-darwin-x64.dmg` (signed, un-notarized) — built via CI after Gate 1
**Windows:** `Ritemark-1.8.5-win32-x64-setup.exe` (CI artifact) — built via CI after Gate 1

- [ ] x64: installs + launches; markdown editing works
- [ ] x64: AI sidebar chat + parallel threads smoke test
- [ ] Windows: installer runs; app launches; agent runtimes start (bundled binaries unpack correctly)
- [ ] Windows: parallel threads + dictation default smoke test
