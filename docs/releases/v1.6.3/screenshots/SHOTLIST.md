# v1.6.3 Screenshot Shot List

Date: 2026-05-06  
Purpose: Capture the v1.6.3 user-facing agentic workflow improvements for release notes and support docs.

## File naming convention

`v1-6-3-{surface}-{state}.png`

Theme scope:

- Primary captures: light theme
- Optional support captures: dark theme only if the UI state reads better or the doc needs it

Resolution:

- 2560×1664 retina for wide hero shots
- 1440×900 for in-context UI shots

## Setup checklist

1. Quit any running Ritemark instance.
2. Launch the v1.6.3 build.
3. Open a workspace that contains:
   - `.claude/agents/`
   - `.claude/skills/`
   - `.agents/agents/`
   - `.agents/skills/`
   - at least one `AGENTS.md` at the workspace root, if available
4. Make sure Claude and Codex are both signed in.
5. Use a small, readable workspace tree so the sidebar and library are easy to read.

---

## Priority 1 — release notes heroes

These shots should tell the main v1.6.3 story.

| # | Shot | File name | Why |
| --- | --- | --- | --- |
| 1 | **AI sidebar — runtime switch inside one conversation** | `v1-6-3-ai-sidebar-runtime-switch.png` | Shows Claude and Codex available in one continuous thread. This is the headline behavior change for the release. |
| 2 | **Assistant provenance line** | `v1-6-3-assistant-provenance-line.png` | Captures the runtime/model line above an assistant response so readers understand per-turn ownership. |
| 3 | **Codex composer footer — Plan/Edit toggle** | `v1-6-3-codex-plan-edit-footer.png` | Demonstrates that Plan/Edit is per turn, not a separate conversation mode. |
| 4 | **Agent Library — main view** | `v1-6-3-agent-library-main.png` | Shows the library as a place to create and manage helpers, not just browse them. |
| 5 | **Agent Library — Launch Chat action** | `v1-6-3-agent-library-launch-chat.png` | Shows the contextual entry point for starting a chat with a specific agent. |

---

## Priority 2 — support docs (`docs/user/features/agent-library.md`)

These shots explain the new helper-management workflow.

| # | Shot | File name | Notes |
| --- | --- | --- | --- |
| 6 | **New helper modal** | `v1-6-3-agent-library-new-helper-modal.png` | Show the modal for creating a new skill or agent. |
| 7 | **Section header + button** | `v1-6-3-agent-library-section-plus.png` | Show the `+` affordance in the Agents or Skills section header. |
| 8 | **Row context menu** | `v1-6-3-agent-library-row-menu.png` | Show Open / Duplicate / Reveal / Move scope / Delete. |
| 9 | **Icon chip row** | `v1-6-3-agent-library-icon-chip.png` | Show the visual chip treatment for a helper row. |
| 10 | **Recently modified sort** | `v1-6-3-agent-library-sort-recent.png` | Show the sort dropdown with “Recently modified” selected. |
| 11 | **Live `.agents/` update** | `v1-6-3-agent-library-agents-live-update.png` | Capture a freshly added helper appearing without manual reload. |

---

## Priority 3 — support docs (`docs/user/features/ai-agents.md`)

These shots explain the runtime and setup changes in the AI sidebar.

| # | Shot | File name | Notes |
| --- | --- | --- | --- |
| 12 | **Claude model picker** | `v1-6-3-ai-sidebar-claude-model-picker.png` | Shows current Sonnet / Opus / Haiku IDs. |
| 13 | **Codex model / mode area** | `v1-6-3-ai-sidebar-codex-mode.png` | Useful if the doc needs a screenshot of the Codex state with the footer controls. |
| 14 | **Mixed-runtime history badge** | `v1-6-3-conversation-list-mixed-badge.png` | Shows that a thread has used more than one runtime. |
| 15 | **Pinned agent chip / Launch Chat flow** | `v1-6-3-pinned-agent-chip.png` | Captures the chat chip after Launch Chat or agent pinning. |

---

## Priority 4 — edge cases and discovery

These are useful if you want extra proof for the docs or release notes.

| # | Shot | File name | Notes |
| --- | --- | --- | --- |
| 16 | **Workspace root `AGENTS.md` discovered** | `v1-6-3-agents-md-discovered.png` | Show the root agent config appearing in the library or discovery view. |
| 17 | **`.agents/` wins only on unique names** | `v1-6-3-agents-vs-claude-dedupe.png` | Useful if you want to illustrate the dedupe rule. |
| 18 | **Legacy agent removed from selector** | `v1-6-3-legacy-agent-removed.png` | Optional proof that the old document agent no longer appears. |

---

## Suggested embedding targets

- `docs/releases/v1.6.3/release-notes.md`
  - Use shots 1–5 as the release story
- `docs/user/features/agent-library.md`
  - Use shots 4–11
- `docs/user/features/ai-agents.md`
  - Use shots 1–3 and 12–15

## Out of scope

- Landing-page screenshots
- Windows-specific shots
- Any content owned by another repo/agent

## When done

Put the final PNGs in this folder and then wire the chosen subset into the relevant docs.
