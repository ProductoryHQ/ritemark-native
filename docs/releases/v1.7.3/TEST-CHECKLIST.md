# v1.7.3 Test Checklist

**Release:** Ritemark v1.7.3 — Agent Library + Configurator, OpenCode BYOK runtime, Browser UX & AI sidebar polish
**Date:** 2026-06-03 (arm64 build)
**Scope:**
- **Sprint 77** (Unified Agent Library + Agent Configurator — discovery, provenance, sidebar merge, configurator panel; PR #99)
- **Sprint 78** (Browser UX — `browser_snapshot` MCP tool #88, annotation screenshot chip #73, OpenCode BYOK picker refresh, plan-approval card content; PR #101)
- **Sprint 76** (ACP client + bundled OpenCode BYOK runtime, #52)
- **Sprint 74** (AI sidebar & composer polish — composer queue #82, link display text #93, plan approval #86, code-block scrollbar #84)

> Before opening the new DMG: **quit any running Ritemark.app** (Cmd+Q). Two instances share the user-data dir and cause a blank webview / SW `InvalidStateError`.

---

## macOS Apple Silicon (darwin-arm64) — GATE 1

**DMG:** `dist/Ritemark-1.7.3-darwin-arm64.dmg` (signed Developer ID, **un-notarized** — right-click → **Open** to bypass Gatekeeper)

### Installation

- [ ] DMG mounts; app copies to `/Applications` cleanly
- [ ] Right-click → **Open** launches it (un-notarized warning is expected)
- [ ] About dialog shows version **`1.7.3`** and VS Code base `1.117.0`
- [ ] No "January 1, 1980" timestamps in Finder Get Info
- [ ] App icon renders correctly in Dock and Finder

### ⚠️ Agent re-signing regression (critical for this build)

> The bundled `claude`, `codex`, and `opencode` binaries were re-signed under our Developer ID with hardened runtime this release. Confirm none of them broke at launch.

- [ ] **Claude Code** — select it, send a prompt → streams a normal response (binary launches under hardened runtime)
- [ ] **Codex** — select it, send a prompt → responds (no crash / "killed" / signature error)
- [ ] **OpenCode** — select it, send a prompt → responds (see Sprint 76 below)
- [ ] No macOS "cannot be opened / damaged" or code-signature dialogs for any agent

---

## Sprint 77 — Unified Agent Library + Agent Configurator (headline)

> Full how-to: `docs/releases/v1.7.3/agent-configurator-guide.md`. Test with both Project and User scope if you have agents in both.

### Agent Library sidebar (R1–R3, R8)

- [ ] Left activity bar shows the **Agent Library** (robot) icon; the old separate **Flows** activity-bar container is **gone**
- [ ] Library lists collapsible sections: **Instructions** (CLAUDE.md / AGENTS.md), **Agents**, **Skills**, **Commands**, **Flows**
- [ ] **Discovery is correct** — agents/skills/commands that exist on disk all appear (no missing entries); Instructions files are listed separately from Agents
- [ ] **Provenance badges** distinguish Project vs User scope; **Project / User scope tabs** filter the list
- [ ] Search filters; sort works; **+** creates a new item in the active section
- [ ] Row actions work: **Open, Duplicate, Launch Chat, Move scope, Delete**
- [ ] Section collapse state **persists** across reloads
- [ ] **Flows section**: clicking a flow opens it for editing; attachment indicator shows when a flow is attached

### Agent Configurator panel (R5, R6)

- [ ] Opening an agent `.md` file opens it in the editor with the **Agent panel** available (toolbar toggles: Table of Contents / Properties / Agent)
- [ ] **Description** field edits; empty description shows the required-field warning
- [ ] **Model** picker: Inherit / Sonnet / Opus / Haiku / custom model ID — selection saves to frontmatter
- [ ] **Tools** allow-list: nothing checked = inherits all; checking some = least-privilege subset (saved correctly to the `tools` field)
- [ ] **Skills** preloading + **Advanced** section (Effort, Memory, Color) save and reload correctly
- [ ] Reopening the file shows the saved values (frontmatter round-trips — no corruption of an existing agent file)

### Schedule UI / K6 banner (R7)

- [ ] No non-functional cron/schedule field is shown (scheduling was removed); if a "runs only while open" style banner appears, it is accurate

---

## Sprint 78 — Browser UX

> Requires the integrated browser. Open a page in a Ritemark browser tab and **share it with AI** for the snapshot/annotation tests.

### `browser_snapshot` MCP tool (#88)

- [ ] With a browser tab **shared with AI**: ask Claude Code (or Codex) to snapshot the page → returns the ARIA outline (URL + title + accessibility tree) **without re-navigating**
- [ ] On a tab **NOT shared with AI**: the snapshot tool returns an error and does **not** leak URL, title, or page content (consent gate)

### Annotation-mode screenshot chip (#73)

- [ ] Turn on **annotation mode** (camera toggle in the browser toolbar) → the composer shows a **56×56 screenshot thumbnail chip** (not the URL globe chip)
- [ ] Scroll / open a modal without navigating → the thumbnail **refreshes** within ~5 s to match the current view
- [ ] **×** on the chip dismisses it (browser context excluded from the next prompt), same as dismissing the URL chip
- [ ] Annotation mode **off** → the existing URL chip behaviour is unchanged

### Plan-approval card content (Sprint 78 fix)

- [ ] Ask Claude Code to **plan** (plan mode) → the approval card shows the **full plan markdown** in the body before Approve/Reject (not an empty body)

### OpenCode BYOK picker refresh (Sprint 78 stretch)

- [ ] In Settings, **save** a provider key (e.g. Google AI) → the agent picker's OpenCode section updates to show that provider's models **without a window reload**
> Note: intentionally untested by Jarmo (all BYOK keys already configured, no clean fixture). Spot-check only if convenient.

---

## Sprint 76 — OpenCode BYOK runtime (headline)

> Requires at least one provider API key configured in **Settings → API Keys** (OpenAI / Google AI / Anthropic / OpenRouter).

### Model picker (R6)

- [ ] Model dropdown shows an **OpenCode** group **after** Codex
- [ ] Only providers with a configured key show models (e.g. Google key → Gemini 3.1 Pro / 3.5 Flash / 2.5 Pro)
- [ ] Rows are two-line: model label + provider description
- [ ] With **no** provider keys: OpenCode group shows the non-selectable "Add API keys to use OpenCode → Open Settings" row, and selecting OpenCode shows the "Set up your API keys" card
- [ ] Trigger label reads `OpenCode · <Model>`

### Execution & streaming (R5)

- [ ] Select an OpenCode model + send a prompt → text **streams** into the response
- [ ] Reasoning shows as a small number of **"Thinking"** entries (NOT hundreds of one-word activities)
- [ ] Tool calls appear as activities ("N actions completed")
- [ ] **Cancel** mid-run → UI returns to idle **≤ 2 s**; a fresh prompt works after
- [ ] An error (e.g. wrong/empty key) surfaces a readable message, not a silent hang

### File-edit approval (R4)

- [ ] Ask OpenCode to edit an open `.md` file → a **single "File Change Approval"** card appears with the target file path (NOT two cards, NOT "Shell Command Approval")
- [ ] File on disk is **unchanged** until you click **Approve**
- [ ] **Reject** → file unchanged, agent continues/reports it could not complete
- [ ] **Always allow** → a second edit in the same session proceeds without a new card
- [ ] Ask to write **outside** the workspace (e.g. `~/.zshrc`) → rejected automatically, no card

### Auto-approve setting

- [ ] **Settings → OpenCode → "Auto-approve edits & tool calls"** toggle is a proper switch
- [ ] Toggle **ON** → edits proceed with **no** approval card
- [ ] Toggle **OFF** → approval card returns
- [ ] Out-of-workspace writes are still blocked even with auto-approve ON

### Settings copy (R3a)

- [ ] OpenAI card "Used for:" mentions **OpenCode (GPT models)**
- [ ] Google AI card "Used for:" reads **Gemini models in OpenCode, Flows**
- [ ] Anthropic card "Used for:" mentions **OpenCode (Claude models)**
- [ ] **OpenRouter API Key** card present (placeholder `sk-or-…`, "Get an OpenRouter key" link)
- [ ] Google AI card no longer mentions "Imagen 3 (coming soon)"

---

## Sprint 74 — AI sidebar & composer polish

- [ ] **Composer queue (#82):** during an agent run, type a follow-up + Enter → it parks in a "Queued" notch and auto-sends when the run finishes; × discards it
- [ ] **@mention in a queued prompt** carries through on auto-send (mentioned agent's instructions apply)
- [ ] **Plan approval (#86):** a plan card's Approve/Reject buttons actually work (no silent no-op); full plan text shown
- [ ] **Edit Link display text (#93):** select text → add link → optional "Display text" field; re-opening an existing link **pre-fills** the current link text; Update replaces the whole link
- [ ] **Code block scrollbar (#84):** a short code block shows **no** spurious horizontal scrollbar; long lines still scroll

---

## Regression sanity

- [ ] Markdown editor opens/edits/saves normally (TipTap loads — no blank webview)
- [ ] Claude Code and Codex chats work end-to-end
- [ ] Flows (LLM / Image nodes) open and run
- [ ] Settings page renders fully (API keys, themes, agent runtime, updates)
- [ ] No console errors on AI sidebar open (View → Output → check for runtime errors)

---

## Gate 1 sign-off

- [ ] **All critical items pass** → reply "**Gate 1 passed**" / "tested locally"
- [ ] Notarization happens only after Gate 1 **and** ≥ 60 min since DMG build (DMG built **12:52 EEST** → hardening window ends **≥ 13:52 EEST**)

> x64 macOS + Windows builds (Gate 2) come from CI after the tag is pushed — not part of this local Gate 1.
