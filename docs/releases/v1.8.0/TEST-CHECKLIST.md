# v1.8.0 Test Checklist

**Release:** Ritemark v1.8.0 — Scheduled AI Agents, Excel editing, draw.io diagrams, runtime unification, dictation mic fix
**Date:** 2026-06-12 (arm64 build)
**Scope:**
- **Sprint 79** (runtime unification — unified Auto/Ask/Plan approval across Claude Code / Codex / OpenCode; file attachments for all runtimes; PR #113)
- **Sprint 80** (scheduled tasks daemon — `schedule:` frontmatter + picker, headless runs, blocked-action inline approval, Agent Library SCHEDULED section; PR #114)
- **Sprint 81** (Excel editing — editable .xlsx grid, multi-sheet fix #110, bottom Excel-style sheet tabs, fx formula display; PR #115)
- **Sprint 82** (draw.io diagrams — `/diagram` command, vendored offline editor, autosave, live embed refresh, double-click-to-edit #111; PR #118)
- **Sprint 83** (voice dictation microphone fix on macOS Tahoe #116 — Permissions-Policy delegation via patch 004; PR #120)

> Before opening the new DMG: **quit any running Ritemark.app** (Cmd+Q). Two instances share the user-data dir and cause a blank webview / SW `InvalidStateError`.

---

## macOS Apple Silicon (darwin-arm64) — GATE 1

**DMG:** `dist/Ritemark-1.8.0-darwin-arm64.dmg` (signed Developer ID, **un-notarized** — right-click → **Open** to bypass Gatekeeper)

### Installation

- [ ] DMG mounts; app copies to `/Applications` cleanly
- [ ] Right-click → **Open** launches it (un-notarized warning is expected)
- [ ] About dialog shows version **`1.8.0`** (VS Code base `1.117.0` is expected in Info.plist — not a bug)
- [ ] App icon renders correctly in Dock and Finder
- [ ] Markdown file opens in the Ritemark editor; typing + autosave work

### Scheduled agents (Sprint 80) — headline

- [ ] Agent editor shows the **Schedule** picker (Interval / Days modes, weekday chips, Advanced cron)
- [ ] An agent with an enabled schedule shows `N scheduled` in the status bar
- [ ] A scheduled run fires: spinner in status bar → completion toast with output first line
- [ ] Toast buttons (Open result / Show runs) reveal the Agent Library SCHEDULED section
- [ ] A write-attempting agent gets BLOCKED → warning toast → **Review & approve** modal shows the exact action → approve re-runs and flips to Completed
- [ ] Run history persists across app restart

### Excel editing (Sprint 81)

- [ ] `.xlsx` opens editable; multi-sheet tabs at the BOTTOM (Excel-style, active tab merges with grid)
- [ ] Cell edit + Cmd+S round-trips; reopen shows the change; formulas/styles preserved
- [ ] Selecting a formula cell shows `=FORMULA` in the fx bar (read-only there)
- [ ] Empty sheet shows "Add a row to start editing"
- [ ] `.xls` stays read-only preview

### draw.io diagrams (Sprint 82)

- [ ] `/diagram` in a markdown file creates `images/diagram.drawio.svg`, embeds it, opens the editor
- [ ] Double-click an embedded diagram opens the editor (single click selects; tooltip says double-click)
- [ ] Diagram edits AUTOSAVE (~1s, no Ctrl+S); the markdown embed refreshes live
- [ ] Close + reopen the `.drawio.svg` — edits persisted, still editable
- [ ] Works offline (Wi-Fi off): open + edit + save a diagram

### Voice dictation (Sprint 83)

- [ ] Mic button prompts macOS permission (first use) and starts capture — NO "microphone not found"
- [ ] Dictation transcribes into the document (Whisper model downloads on first use, ~75MB)
- [ ] Denying permission yields a specific, honest error message

### Runtime unification (Sprint 79)

- [ ] Composer shows Auto / Ask / Plan picker; Ask mode shows approval card before a file write (any runtime)
- [ ] Image attachment works in a Codex chat (was Claude-only before)

### Regression sweep

- [ ] AI sidebar chat works (Claude Code)
- [ ] Settings page loads and saves an API key
- [ ] Flows panel opens; an existing flow runs
- [ ] Integrated browser opens a page
- [ ] PDF/DOCX preview opens

---

## macOS Intel (darwin-x64) + Windows — GATE 2

**DMG:** `dist/Ritemark-1.8.0-darwin-x64.dmg` (signed, un-notarized)
**Windows:** `Ritemark-1.8.0-win32-x64-setup.exe` (CI artifact)

- [ ] x64: installs + launches; markdown editing works; one scheduled-agent smoke test
- [ ] x64: Excel + draw.io smoke test
- [ ] Windows: installer runs; app launches; markdown + Excel + draw.io smoke test
- [ ] Windows: agent runtimes start (bundled binaries unpack correctly)
