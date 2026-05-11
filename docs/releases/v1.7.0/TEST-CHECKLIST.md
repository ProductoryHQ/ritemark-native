# v1.7.0 Test Checklist

**Release:** Ritemark v1.7.0 — The Browser Comes In; AI That Reads What You Read
**Date:** 2026-05-11
**Scope:** Sprint 65 (In-app Browser), Sprint 66 (Codex Runtime Hardening + System Runtime Preference), Sprint 67 (Browser-aware AI Chat) + housekeeping from deferred v1.6.4 draft (#50, #55, #56)

> Before opening the new DMG: **quit any running Ritemark.app** (two instances share the user-data dir and will cause a blank webview / SW `InvalidStateError`).

---

## macOS Apple Silicon (darwin-arm64) — GATE 1

**DMG:** `dist/Ritemark-1.7.0-darwin-arm64.dmg`

### Installation
- [ ] DMG opens without Gatekeeper warning (notarization stapled)
- [ ] App copies to `/Applications` cleanly
- [ ] App launches from `/Applications` (no quarantine prompt)
- [ ] About dialog shows version `1.7.0` and VS Code base `1.117.0`
- [ ] No "January 1, 1980" timestamps in Finder Get Info
- [ ] App icon renders correctly in Dock and Finder

---

### Sprint 65 — In-app Browser

#### External sites
- [ ] `Cmd+Shift+P` → "Ritemark Browser: Open URL" → `https://ritemark.app` → renders the marketing site
- [ ] `https://google.com` → renders (no iframe fallback / blank)
- [ ] `https://github.com` → renders or reaches expected auth UX (not iframe-blocked)
- [ ] `https://example.com` → renders
- [ ] Back/forward/reload buttons work
- [ ] Address bar accepts a URL → navigates correctly
- [ ] Right-click on page shows Chromium context menu
- [ ] DevTools opens from toolbar

#### Local files
- [ ] Open a workspace `.html` file from Explorer → opens in the integrated browser (NOT the source editor)
- [ ] `.html` content renders with styles and scripts
- [ ] **"Open as Text"** in the file context menu still opens the source editor (escape hatch)
- [ ] Local `file://` path with `#anchor` → scrolls to the correct location
- [ ] Relative links and assets resolve

#### Multiple tabs
- [ ] Open three browser tabs → all visible in the tab bar (alongside markdown tabs)
- [ ] Tabs preserve their URL / scroll / state when switched
- [ ] `Cmd+W` closes the active browser tab
- [ ] Closing browser tabs does NOT affect open markdown tabs

#### Terminal localhost link
- [ ] `echo http://localhost:3000` in integrated terminal → `Cmd+click` opens the URL in a Ritemark browser tab (NOT the system browser)
- [ ] If no server is running, browser tab shows expected connection error (Chromium error page)

#### Sidebar Browser view
- [ ] Browser activity bar icon (globe) shows the **Recent** view
- [ ] Recently opened URLs are listed
- [ ] Clicking a Recent entry reopens that URL in a new browser tab
- [ ] **Clear History** action works

#### Known cold-start race (NOT a blocker; tracked as [#63](https://github.com/ProductoryHQ/ritemark-native/issues/63))
- [ ] Verify workaround: opening an `.html` via cold-start CLI / Finder leaves a blank text-editor tab. Close it, reopen via **File → Open**, browser renders. Documented in release notes follow-up section.

---

### Sprint 67 — Browser-aware AI Chat

#### Consent gate (D5 + D8 addendum)
- [ ] Quit Ritemark, relaunch (fresh session). Open AI sidebar. Open a browser tab to `https://ritemark.app/en/`.
- [ ] **"Share with Agent?" dialog appears automatically** within 1.5–3s
- [ ] Click **Deny** → no chip appears in composer / chip is "muted state". Ask Claude "what page am I looking at?" → AI says it does NOT have page context (URL not leaked)
- [ ] Quit and relaunch. Open the same tab. Click **Allow + Don't ask again**
- [ ] Chip appears in composer with globe icon + `Browser: <page title>`
- [ ] Open a SECOND browser tab → consent dialog does NOT reappear (Don't ask again honoured)
- [ ] Switch back to first tab → chip updates to first tab's title

#### Normal mode (summary only)
- [ ] Chip is GREY (not indigo) — annotation is OFF
- [ ] Ask Claude: "summarize this page" → answer references actual hero, feature cards, and content
- [ ] Ask Codex (switch runtime in composer): same question → page-aware answer
- [ ] Open `browser-fixture.html` from this repo's sprint-65 testing folder. Ask: "what are the links on this page?" → answer lists the 5 navigation links

#### Annotation mode (screenshot)
- [ ] In the browser toolbar (right of the URL bar), find the **camera icon** with tooltip "Include Screenshot in AI Chat Context"
- [ ] Click it → chip turns INDIGO with `· Annotation` suffix
- [ ] Ask Claude: "describe the visual layout of this page" → answer references colours, spacing, image positions (not possible from ARIA summary alone)
- [ ] Toggle annotation OFF → chip back to grey
- [ ] Next AI turn → no screenshot sent (verify via token cost / response framing)

#### Per-turn dismiss
- [ ] With chip showing, click the **×** on the chip
- [ ] Send a question → AI answers WITHOUT browser context for that turn
- [ ] Next turn → chip reappears (per-turn dismiss, not session-wide)

#### Runtime exclusion
- [ ] Confirm legacy "Ritemark Document Agent" runtime does NOT receive browser context (the runtime should not even be selectable in default Settings)

---

### Sprint 66 — Codex Runtime Hardening + System Runtime Preference

#### System-installed Codex compatibility
- [ ] Install the latest Codex via `cargo install codex` or download a system binary
- [ ] Open Settings → **Agent Runtime** section → switch to `system`
- [ ] Codex runtime starts without the "Some agent features are unavailable" banner
- [ ] "Currently active:" chip in Settings shows the system path

#### Bundled Codex version
- [ ] Settings → Agent Runtime → set to `bundled`
- [ ] Codex initializes; About / diagnostics shows the new pinned upstream version

#### Known upstream crash
- [ ] If `codex_core_skills::manager::ManagerError::Init` is encountered, Settings diagnostic banner explains the issue
- [ ] `docs/user/known-issues.md` entry is linked

---

### Housekeeping (from deferred v1.6.4 draft)

#### Settings page cleanup (#55, #56)
- [ ] Settings → **AI Model** orphaned dropdown is GONE
- [ ] Settings → **Features** section (Voice Dictation, Ritemark Flows, Codex Integration toggles) is GONE
- [ ] Codex Integration is ON by default (no toggle visible)
- [ ] Codex auth card no longer references a Features section

#### Agent Library casing (#50)
- [ ] Library shows **UX Expert** (not "Ux Expert")
- [ ] Library shows **PR Reviewer** (not "Pr Reviewer")
- [ ] Library shows **QA Validator** (not "Qa Validator")
- [ ] Library shows **VS Code Expert** (not "Vs Code Expert")
- [ ] Custom agent with `displayName: "My Custom"` frontmatter renders exactly as set

---

### Core regression — does the editor still work?

- [ ] Open a `.md` file from Explorer → renders in Ritemark editor
- [ ] Type, format (bold, italic, headings), save → file content updated on disk
- [ ] AI sidebar Claude turn → response streams correctly (with active-file chip)
- [ ] AI sidebar Codex turn → response streams correctly
- [ ] Voice dictation start/stop → transcribes audio (if mic permission granted)
- [ ] File watcher: external edit to an open `.md` reflects in editor on focus

---

## macOS Intel (darwin-x64) — GATE 2

**DMG:** `dist/Ritemark-1.7.0-darwin-x64.dmg` (from GH Actions; cross-compile rule: NEVER from arm64)

Same checks as arm64 plus:
- [ ] App runs natively (no Rosetta prompt — native Intel binary)
- [ ] About → Architecture shows x86_64
- [ ] Browser tab opens external sites (parity check)
- [ ] AI sidebar works (parity check)

---

## Windows x64 — GATE 2

**Installer:** `Ritemark-1.7.0-win32-x64-setup.exe` (built on Windows host from GH Actions artifact; see `windows-installer` skill)

### Installation
- [ ] Installer runs (no SmartScreen block, OR Jarmo confirms "More info → Run anyway" path)
- [ ] Installer completes; Ritemark appears in Start Menu
- [ ] App launches with TipTap editor visible
- [ ] About → version `1.7.0`

### Sprint 65 parity
- [ ] Browser tab opens external site
- [ ] Browser tab opens local `.html` file
- [ ] `.html` opens in browser by default

### Sprint 67 parity
- [ ] Browser chip appears in AI sidebar composer
- [ ] Consent prompt fires on first tab activation per session
- [ ] After Allow, Claude content question works

### Sprint 66 parity
- [ ] Settings → Agent Runtime → `bundled`/`system` toggle works on Windows
- [ ] Bundled Codex binary path resolves correctly (Windows separator)

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
