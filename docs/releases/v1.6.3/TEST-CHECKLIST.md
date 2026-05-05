# v1.6.3 Test Checklist

**Release:** Ritemark v1.6.3 — One Conversation, Many Runtimes; A Library You Can Talk To
**Date:** 2026-05-05
**Scope:** Sprint 59 (Agent Authoring Loop), Sprint 61 (Agent Library Icons & Colours), Sprint 62 (Conversation Runtime + Per-Turn Agent Switching), Sprint 63 (Minor Updates: Launch Chat + AGENTS/.agents + model refresh)

> Before opening the new DMG: **quit any running Ritemark.app** (two instances share the user-data dir and will cause a blank webview / SW `InvalidStateError`).

---

## macOS Apple Silicon (darwin-arm64) — GATE 1

**DMG:** `dist/Ritemark-1.6.3-darwin-arm64.dmg`

### Installation
- [ ] DMG opens without Gatekeeper warning (notarization stapled)
- [ ] App copies to `/Applications` cleanly
- [ ] App launches from `/Applications` (no quarantine prompt)
- [ ] About dialog shows version `1.6.3` and VS Code base `1.117.0`
- [ ] No "January 1, 1980" timestamps in Finder Get Info
- [ ] App icon renders correctly in Dock and Finder

---

### Minor updates (post-Sprint 62 patch)

#### Agent Library — `.agents/` directory scanning (#38)
- [ ] Open this repo in Ritemark dev mode → Agent Library → **Project** tab → **Skills** section shows entries from `.agents/skills/` (e.g. `codereview`, `qa-validation`, `sprint-workflow`, `release-process`, `webview-development`, `macos-screenshots`)
- [ ] Skills already in `.claude/skills/` are not duplicated — each name appears once
- [ ] Skills in `.agents/skills/` that share a name with a `.claude/skills/` entry show the `.claude/` version (`.claude/` wins)
- [ ] Live update: add a new `SKILL.md` under `.agents/skills/test-skill/` → sidebar refreshes and shows it without manual reload
- [ ] Agents section is unaffected if `.agents/agents/` does not exist (no error, no empty section)

#### Launch Chat from agents list (#49)
- [ ] Right-click any agent row in the library → context menu shows **Launch Chat** as the first item (above Open)
- [ ] **Launch Chat** does NOT appear on skill rows or command rows
- [ ] Click **Launch Chat** on an agent → AI panel focuses, a new chat starts, and the agent selector shows that specific agent pre-selected
- [ ] Verify with at least two different agents — each correctly pre-selects in the chat
- [ ] After launch, typing and sending a message goes to the selected agent (not the previously active one)

#### Claude model IDs (#44)
- [ ] Open AI sidebar → Claude provider → model picker shows **Sonnet** (`claude-sonnet-4-6`), **Opus** (`claude-opus-4-7`), **Haiku** (`claude-haiku-4-5-20251001`)
- [ ] Old model IDs (`claude-sonnet-4-5`, `claude-opus-4-6`, `claude-haiku-4-5`) no longer appear in the picker
- [ ] Fallback still works: if the Claude CLI reports no models, the picker falls back to these three

---

### Sprint 62 — Conversation Runtime + Per-Turn Agent Switching

#### Per-turn runtime/model switch inside one conversation
- [ ] Open AI sidebar, start a new conversation in **Claude**, send a question, receive an answer
- [ ] In the composer footer, switch the runtime to **Codex** without leaving the conversation
- [ ] Send the next turn — it goes to Codex; Claude turns above remain visible and readable
- [ ] Switch back to Claude for a third turn — works without errors

#### Per-message provenance line
- [ ] Each assistant response carries a small line above it identifying the runtime + model that produced it
- [ ] In a mixed-runtime thread, the badge differs between Claude and Codex turns

#### Plan/Edit as per-turn footer toggle (Codex)
- [ ] Switch to Codex, toggle composer footer to **Plan** mode → run a plan
- [ ] Without leaving the conversation, toggle to **Edit** mode → apply the change
- [ ] Both runs are visible in the same thread, each tagged with its mode

#### Mixed-runtime conversation badge
- [ ] In the chat history list, conversations that span more than one runtime show a compact mixed-runtime badge

#### Cancel + approval target the running turn (not the footer)
- [ ] Start a long Claude run; while streaming, switch the footer dropdown to Codex
- [ ] Click **Stop** → the Claude run is cancelled (not Codex, because Codex isn't running)
- [ ] Trigger a Codex Plan that needs approval; while waiting, switch the footer to Claude → approval still routes to the Codex run
- [ ] Trigger a Codex command/file approval prompt; switch footer to Claude → approval still routes to Codex
- [ ] Pending question routes to the run that asked it

#### Legacy Ritemark Document Agent
- [ ] The legacy "Ritemark Document Agent" no longer appears in the agent selector
- [ ] Old conversations that contain legacy-agent turns still **open and render** without error
- [ ] No migration prompt is shown
- [ ] Inspect localStorage in DevTools — legacy records are **still present**, not deleted

#### Schema v2 storage rollout (guarded)
- [ ] New conversations created after install write `schemaVersion: 2` records
- [ ] DevTools: existing v1.6.2 records remain readable side-by-side with v2 records
- [ ] Reload the window — every conversation still loads correctly

#### Cross-runtime context handoff
- [ ] When the next turn switches runtime, a compact handoff note is prepended to the prompt (no automatic full summarization expected — that's roadmap)

#### Agent Selector
- [ ] `AgentSelector.tsx` still handles setup, discovery, and availability of runtimes
- [ ] Selector reflects current runtime correctly when navigating between conversations

---

### Sprint 59 — Agent Authoring Loop

#### Empty state
- [ ] Move `~/.claude/` aside (or open a brand-new profile) → empty state shows **New skill** and **New agent** buttons (NOT a "open a terminal" hint)

#### New-helper modal
- [ ] Click **New skill** → modal collects name + scope (project vs user)
- [ ] After confirm, a new file is written under `.claude/skills/<name>/SKILL.md` with valid frontmatter
- [ ] Editor opens the new file ready to edit
- [ ] Repeat for **New agent** → file written under `.claude/agents/<name>.md`

#### `+` on section headers
- [ ] Once the library has helpers, the **Agents** and **Skills** section headers each show a `+` affordance
- [ ] Clicking `+` opens the same new-helper modal (scope auto-set to that section)

#### Right-click row context menu
- [ ] Right-click an agent row → menu shows **Open**, **Duplicate**, **Reveal in Finder**, **Move scope**, **Delete…**
- [ ] **Open** opens the file in the editor
- [ ] **Duplicate** creates a copy (verify file lands in correct dir)
- [ ] **Reveal in Finder** opens Finder with the file selected (uses `revealFileInOS`)
- [ ] **Move scope** on a project-scope helper promotes it to user scope (file moves; sidebar refreshes)
- [ ] **Move scope** on a user-scope helper demotes to project scope
- [ ] **Delete…** sends the file to OS Trash (recoverable from `~/.Trash`)
- [ ] **Delete…** on a project-scope helper shows a teammate-impact note before confirming

#### Context menu reliability (regression — commit `4299a77`)
- [ ] Open right-click menu on multiple rows in succession — opens every time
- [ ] Right-click a row whose JSON-stringified data would have contained quotes (e.g., name/description with `"`) — menu still opens

#### Hover `⋯` button
- [ ] Hovering a row reveals a `⋯` button at the right edge
- [ ] Clicking `⋯` opens the same menu as right-click

---

### Sprint 61 — Agent Library Icons & Colours

#### Auto-assigned chip
- [ ] Each row has a 32×32 rounded icon chip with a colour
- [ ] An agent named e.g. `pr-reviewer` gets a blue clipboard
- [ ] An agent named e.g. `release-manager` gets a green rocket
- [ ] A generic helper with no keyword match gets indigo `sparkle`

#### Manual override via frontmatter
- [ ] Add `icon: bug` and `color: red` to a helper's `.md` frontmatter, save the file
- [ ] Sidebar updates to show the red bug chip without manual reload

#### Description on row second line
- [ ] Frontmatter `description` field renders directly on the row's second line
- [ ] File path is no longer the second line — it appears in tooltip when hovering the row

#### Available colours
- [ ] Verify chips render correctly across the eight palette colours: `indigo`, `blue`, `green`, `amber`, `red`, `purple`, `pink`, `slate`
- [ ] Chips remain readable on both **light** and **dark** VS Code themes (rgba alpha tints)

---

### Starter pack on first run (Sprint 59)

- [ ] With `~/.claude/` empty, launch Ritemark → starter pack seeds **once**
- [ ] Four helpers appear in the library: `skill-creator`, `outline-from-notes`, `frontmatter-cleanup`, `document-reviewer`
- [ ] Open `skill-creator/SKILL.md` → header notes Anthropic upstream commit `5128e186` and Apache-2.0 license
- [ ] Relaunch with files already in `~/.claude/` → starter pack does **NOT** re-seed
- [ ] Editing/deleting starter helpers works like any other file (no protection)

---

### Live library updates

- [ ] Edit any file under `.claude/agents/` directly in a terminal → sidebar reflects the change without manual reload
- [ ] Same for `.claude/skills/` and `.claude/commands/`

### Sort dropdown
- [ ] Sort dropdown offers **Alphabetical** and **Recently modified**
- [ ] **Recently modified** orders by FS mtime; touching a file moves it to the top

---

### Core editor (regression)
- [ ] Open existing .md file → TipTap renders content correctly (NOT plain text)
- [ ] Type new content → autosaves
- [ ] Bold / italic / heading toolbar shortcuts work (Cmd+B, Cmd+I, Cmd+Alt+1..6)
- [ ] Save As works (Cmd+Shift+S)
- [ ] Image embed works
- [ ] Code block syntax highlighting works
- [ ] Table editing works
- [ ] Mermaid diagrams still render (Sprint 56 polish)

### Layout (regression — patches 002+003)
- [ ] Activity Bar on left, AI panel on right (auxiliary bar)
- [ ] Terminal opens in right sidebar, NOT editor area
- [ ] Titlebar action toolbar shows expected icons
- [ ] No chat icon in titlebar / command center / activity bar

### AI features (with API keys configured)
- [ ] AI Chat panel responds (right sidebar)
- [ ] AI Flow generates content
- [ ] Dictation: start, transcribe, stop

### Settings (regression — must NOT be a stub)
- [ ] Settings → Claude section reflects truthful auth state
- [ ] Settings → API key configuration works (any provider)
- [ ] Settings page is the full implementation (not a placeholder)

---

## macOS Intel (darwin-x64) — GATE 2 (after CI tag)

**DMG:** `dist/Ritemark-1.6.3-darwin-x64.dmg` (built after Gate 1)

Same checklist as Apple Silicon, plus:
- [ ] Native Intel binary (Rosetta NOT required)
- [ ] sqlite3 / node-pty native modules load (no x86_64 vs arm64 mismatch)

---

## Windows (win32-x64) — GATE 2 (after CI tag)

**Installer:** `installer-output/Ritemark-1.6.3-win32-x64-setup.exe` (built on Windows host after tag push)

### Installation
- [ ] Installer runs without SmartScreen block (or "Run anyway" option visible)
- [ ] Ritemark icon shown in installer (rcedit-patched)
- [ ] App installs to `Program Files\Ritemark`
- [ ] Start Menu entry created with Ritemark icon
- [ ] Desktop shortcut option works
- [ ] Launches from Start Menu

### Sprint 62 (Windows-specific)
- [ ] Per-turn runtime switching works on Windows (Claude ↔ Codex)
- [ ] Provenance line renders correctly on Windows
- [ ] Cancel + approval routing on Windows matches macOS behavior

### Sprint 59 (Windows-specific)
- [ ] **New skill** / **New agent** modal writes files under `%USERPROFILE%\.claude\` with correct paths (NOT mac-style `~/.claude`)
- [ ] **Reveal in Finder** label adapts to "Reveal in File Explorer" (or equivalent) and opens Explorer
- [ ] **Delete…** sends to Recycle Bin (recoverable)
- [ ] Starter pack seeds correctly on a fresh Windows profile

### Sprint 61 (Windows-specific)
- [ ] Icon chips render on Windows (Phosphor inline SVG, no missing fonts)
- [ ] All 8 palette colours render correctly on Windows light + dark themes

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
