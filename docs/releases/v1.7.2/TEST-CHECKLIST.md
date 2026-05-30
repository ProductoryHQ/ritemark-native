# v1.7.2 Test Checklist

**Release:** Ritemark v1.7.2 — Markdown workflow + AI runtime clarity
**Date:** TBD (2026-05-29 build)
**Scope:** Sprint 72 (Markdown `@`-mentions, internal Cmd-click links, TOC heading-level shortcuts) + Sprint 73 (bundled-runtime updates + AI model-selector clarity)

> Before opening the new DMG: **quit any running Ritemark.app** (two instances share the user-data dir and will cause a blank webview / SW `InvalidStateError`).

---

## macOS Apple Silicon (darwin-arm64) — GATE 1

**DMG:** `dist/Ritemark-1.7.2-darwin-arm64.dmg`

### Installation
- [ ] DMG opens without Gatekeeper warning (if notarization succeeded) OR documented "Open Anyway" works (if unnotarized)
- [ ] App copies to `/Applications` cleanly
- [ ] App launches from `/Applications` (no quarantine prompt if notarized)
- [ ] About dialog shows version `1.7.2` and VS Code base `1.117.0`
- [ ] No "January 1, 1980" timestamps in Finder Get Info
- [ ] App icon renders correctly in Dock and Finder

---

### Sprint 72 — Markdown navigation + annotation

#### `@`-mention file picker (inline editor)
- [ ] In an open `.md` document, type `@` → a file-search picker opens at the cursor
- [ ] Start typing a partial filename → results filter live
- [ ] Markdown files rank highest in results
- [ ] Type `@test-utils.js` (or any `.js` file in workspace) → result appears (no allowlist regression)
- [ ] Arrow keys move selection; **Enter** inserts a Markdown link with basename as visible text and a **relative path** as target
- [ ] **Escape** dismisses the picker without inserting anything
- [ ] Heavy folders excluded — `@node_modules` returns nothing useful from `node_modules/`

#### Add Link dialog `@`-syntax (Cmd+K)
- [ ] Place cursor on selected text → **Cmd+K** opens Add Link dialog
- [ ] Type `@spec` in the URL field → picker results appear
- [ ] Pick `spec.md` → relative path lands in the URL field
- [ ] Click Add → link inserted with chosen target
- [ ] Internal targets: "open in browser" external-open icon is **hidden** in the dialog
- [ ] Relative paths are NOT silently auto-prefixed with `https://`

#### Cmd-click follows internal links
- [ ] Cmd-click (Ctrl-click on non-mac) on an inserted `.md` link → opens that file in Ritemark in a new tab
- [ ] Cmd-click on `.pdf` / `.png` / `.csv` link → opens via VS Code's default opener (NOT Ritemark editor)
- [ ] Cmd-click on `http(s)://` link → opens in system browser (existing behaviour preserved)
- [ ] Out-of-workspace path (e.g. `../../../etc/passwd`) → non-blocking notification "Link target is outside the workspace"
- [ ] Missing file (`./does-not-exist.md`) → non-blocking notification "File not found"
- [ ] Regular click (no modifier) on a link still opens the **Edit Link** dialog (no modifier gymnastics needed)

#### Edit Link dialog `↗` open icon
- [ ] Click an existing link in the editor → Edit Link dialog opens
- [ ] A small `↗` icon is visible next to the URL input
- [ ] Click `↗` on an internal Markdown link → opens that file (Ritemark in a new tab)
- [ ] Click `↗` on an external URL → opens in system browser

#### Heading levels from the Table of Contents
- [ ] Resize window to ≥960px wide → persistent inline TOC (220px rail) appears to the left of the editor
- [ ] Right-click any TOC row → context menu lists H1–H6
- [ ] Current heading's level is **disabled** in the menu (cannot toggle to itself)
- [ ] Shortcut hint shows `⌥⌘1-6` on macOS
- [ ] Pick a different level → heading changes in editor
- [ ] **Scroll position is preserved** — try on a heading that is off-screen
- [ ] **Cmd+Z reverts the level change in one step** (single transaction)
- [ ] Inside editor body: focus an H2 → press `⌥⌘4` → heading becomes H4
- [ ] At a heading boundary (the TOC click landing position): `⌥⌘1-6` still works (regression fix from StarterKit default)

#### Removed dead code (regression check)
- [ ] Header dropdown TOC variant is **gone** — no broken UI in header
- [ ] No new errors in DevTools console about missing `header/TableOfContents` import

---

### Sprint 73 — Bundled runtime + AI model selector clarity

> Requires API keys configured in Settings (Claude and Codex). Without keys, model lists will be empty — that's expected, not a Sprint 73 regression.

#### Settings runtime diagnostics
- [ ] Open Settings → AI section
- [ ] **Claude card** shows CLI version + SDK version in a single chip (e.g. `CLI 2.x · SDK 0.x`)
- [ ] **Codex card** shows the actual app-server runtime version (read from `--version`, not just from manifest)
- [ ] No "unknown" or empty runtime version strings when keys + runtimes are present

#### AI model picker warm-up
- [ ] Open the AI sidebar (no message sent yet)
- [ ] Open the Claude model picker → list shows real Claude models (Sonnet/Opus/Haiku) with **version lines**, not just fallback labels
- [ ] Rows render as **two lines**: primary model name/version + short purpose tagline
- [ ] Switch runtime to Codex → model picker shows Codex model list

#### Model picker overflow + cursor
- [ ] Open a runtime with a long model list (Claude usually qualifies)
- [ ] List is **height-constrained** — does NOT push the rest of the sidebar off-screen
- [ ] A **thin vertical scrollbar** is visible when overflow occurs
- [ ] Hovering a model row shows a **pointer cursor** (not default arrow)
- [ ] Clicking a row selects that model; chip in composer updates

#### Account switch invalidates model cache (review fix from PR #91)
- [ ] Trigger Claude logout (or use Settings to switch identity if available)
- [ ] After `login-finished` event for a new identity, open the model picker → list reflects the **new account's** models, not the previous account's cached list

---

### Core regression — does the editor still work?

- [ ] Open a `.md` file from Explorer → renders in Ritemark editor (NOT raw text editor)
- [ ] Type a paragraph, headings, lists → renders correctly
- [ ] Bold (Cmd+B), italic (Cmd+I), heading shortcuts (Cmd+Alt+1-6) → all work
- [ ] Save (Cmd+S) → file content updated on disk
- [ ] AI sidebar Claude turn (with API key) → response streams correctly
- [ ] AI sidebar Codex turn → response streams correctly
- [ ] Voice dictation start/stop → transcribes audio (if mic permission granted)
- [ ] File watcher: external edit to an open `.md` reflects in editor on focus
- [ ] In-app browser still opens external sites (Sprint 65 regression)
- [ ] Browser-aware AI chat consent dialog still appears for first browser tab (Sprint 67 regression)

---

## macOS Intel (darwin-x64) — GATE 2

**DMG:** `dist/Ritemark-1.7.2-darwin-x64.dmg` (from GH Actions; cross-compile rule: NEVER from arm64)

Same checks as arm64 plus:
- [ ] App runs natively (no Rosetta prompt — native Intel binary)
- [ ] Sprint 72 `@`-picker works on x64
- [ ] Sprint 72 Cmd-click internal-link navigation works on x64
- [ ] Sprint 72 TOC right-click context menu works on x64
- [ ] Sprint 73 model picker scrollbar + two-line rows render correctly on x64
- [ ] AI sidebar works (parity check)

---

## Windows x64 — GATE 2

**Installer:** `Ritemark-1.7.2-win32-x64-setup.exe` (built on Windows host from GH Actions artifact; see `windows-installer` skill)

### Installation
- [ ] Installer runs (no SmartScreen block, OR Jarmo confirms "More info → Run anyway" path)
- [ ] Installer completes; Ritemark appears in Start Menu
- [ ] App launches with TipTap editor visible
- [ ] About → version `1.7.2`

### Sprint 72 parity (Windows shortcut variant: Ctrl+Alt instead of ⌥⌘)
- [ ] `@`-picker works inline in editor and in Add Link dialog (Ctrl+K)
- [ ] **Ctrl-click** follows internal Markdown links → opens target in Ritemark
- [ ] **Ctrl-click** on non-Markdown internal links → opens via VS Code default opener
- [ ] TOC right-click context menu shows `Ctrl+Alt+1-6` shortcut hints
- [ ] `Ctrl+Alt+1-6` changes heading level globally inside editor
- [ ] Edit Link dialog `↗` icon opens link target

### Sprint 73 parity
- [ ] Settings shows Claude CLI + SDK chip and real Codex `--version` on Windows
- [ ] Model picker two-line rows + thin scrollbar + pointer cursor

### Core regression on Windows
- [ ] Open .md, type, format, save
- [ ] AI sidebar Claude + Codex (with keys)
- [ ] In-app browser opens external sites + local `.html`

---

## Sign-off table

| Platform | Tester | Date | Result | Notes |
| --- | --- | --- | --- | --- |
| macOS arm64 | Jarmo | __________ | ☐ Pass / ☐ Fail | |
| macOS x64 | Jarmo | __________ | ☐ Pass / ☐ Fail | |
| Windows x64 | Jarmo | __________ | ☐ Pass / ☐ Fail | |

**Gate 1 cleared (arm64 DMG locally tested + approved):** ☐  Approval phrase: __________

**Gate 2 cleared (x64 + Windows tested + approved):** ☐  Approval phrase: __________

Until BOTH gates are checked with approval phrases ("tested locally" / "approved for release" / "ship it"), the release-manager agent must BLOCK publication.
