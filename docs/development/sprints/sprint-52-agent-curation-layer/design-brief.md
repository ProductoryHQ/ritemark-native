# Design Brief — Sprint 52: Agent Curation Layer

Audience: a designer (internal or external) who has not read the strategic docs. This brief is self-contained. By the end of it, the designer should know what to produce, for whom, and within what constraints.

## 1. What this is, in one paragraph

Ritemark Native is adding a *curation layer* for AI agents. Today users of Claude Code and OpenAI Codex accumulate dozens of markdown-file "agents" and "skills" scattered across their project and home directories. Nobody has built a UI to manage this pile. This sprint ships that UI — a library view where a power user can see everything they have across vendors, find duplicates, archive orphans, and flag canonical versions, without ever losing their files. It is not a builder, not an onboarding wizard, and not a runtime. It is a file-aware management surface — closer in spirit to a package manager, a git log, or a photo library than to a traditional settings page.

## 2. The one user to design for

**Viktor, veteran Claude Code + Codex user.**

Read `docs-internal/user-flows.md` (the Viktor section) for the full scenes. The short version:

- He has ~30 agents and ~15 skills accumulated over a year, spread across `~/.claude/agents/`, project-local `.claude/`, Codex `AGENTS.md`, and possibly `.agents/skills/`
- He half-remembers what each one does. He is terrified of deleting anything in case something still depends on it
- He can't find the good code-reviewer he wrote three months ago
- His emotional state entering the app is mild dread; his win moment is seeing "32" drop to "19 canonical + 11 archived" and breathing out
- He is not creating his first agent — he is doing archaeology on his existing pile

**Viktor does not need encouragement. He needs visibility, transparency, and tools.**

## 3. Design principles (non-negotiable)

1. **Round-trip guarantee visible.** Every screen has an "Edit as markdown" action that opens the underlying file in Ritemark's markdown editor. This is not a power-user easter-egg — it is always visible. It is the trust signal that the UI is a view over files, not a cage around them. Full explanation: `docs-internal/round-trip-guarantee.md`.

2. **File paths always on screen.** On every row, every dialog, every diff view — the absolute file path is visible (hover reveals full path if truncated). No hidden state. Viktor must always know which file he's looking at.

3. **No destructive operation without a preview.** Every move, delete, archive, or bulk op opens a dry-run dialog listing the exact filesystem operations about to be performed. The user must confirm. There is always an undo path (audit log + trash with recovery window).

4. **Density over decoration.** This is a power-user screen. Think GitHub's repo insights, Linear's list views, VS Code's source-control panel — not a marketing landing page. Scannable rows, small type weight variations, color used sparingly and functionally (vendor badges, health states).

5. **Honest about vendor differences.** When a field is Claude-only (`isolation: worktree`) or Codex-only (sandbox policy), show it as such with a small badge. Don't invent a "unified" field that hides the asymmetry. Don't hide vendor-specific fields — relegate them, don't bury them.

6. **Empty states must not feel broken.** A user with zero `.claude/` files is a legitimate state (they exist but haven't made any agents yet). The empty library should be quiet and unassuming — a single "Nothing here yet. Agents will appear as you create them" message, not a marketing card.

## 4. Required screens

Deliver wireframes and interaction notes for each of these. Low-fi is fine; the goal is to enable implementation, not to produce production-ready polish.

### 4.1 Library view — populated state

The primary surface. Dense, sortable table of every discovered agent/skill/command.

Must include:
- Count banner at top ("Agents: 32 · Skills: 15 · Commands: 9 · MCP servers: 4")
- Filter rail (scope, vendor, status, health)
- Sortable columns: Name, Scope, Vendor, Last modified, Last run, Duplicates, Source (path)
- Multi-select for bulk ops
- Per-row actions: Edit as markdown, Open, Archive, Delete, Set canonical, View diff (if duplicate)
- Health badges (duplicated, broken frontmatter, stale)
- Vendor badges (Claude, Codex, Gemini stub)
- Canonical flag indicator
- Footer with selection count and bulk-op menu

Consider: how does the sidebar width constraint affect column visibility? What collapses first, what stays?

### 4.2 Library view — empty state

A user in a fresh repo with no `.claude/` content. No excited call-to-action. Just honest quietness.

### 4.3 Duplicate diff view

Side-by-side comparison of two (or more) agents with the same name in different scopes.

Must include:
- Frontmatter comparison — differing fields highlighted
- Body comparison — unified or split diff, user's choice
- Metadata strip: scope, path, last modified, last run, file size, line count for each
- Clear primary recommendation ("Project version is newer and more detailed") when the choice is obvious
- Explicit action set: promote / demote / delete / merge manually / mark not-duplicate
- Whatever action is picked triggers the dry-run dialog (4.5)

### 4.4 Orphan / stale sweep view

A focused view filtered to agents that haven't been invoked in 90+ days.

Must include:
- Heuristic explanation ("Not invoked in the last 90 days") with a learn-more
- Per-row archive / delete / mark-active actions
- Bulk archive action
- Reassurance about reversibility ("Archived files go to `.claude/.archive/` and can be restored")

### 4.5 Bulk-op dry-run dialog

Shown before any destructive operation commits.

Must include:
- Plain-language summary of what's about to happen
- Exact filesystem operations listed ("move `~/.claude/agents/foo.md` → `~/.claude/.archive/2026-04-22/foo.md`")
- Count of affected files
- Cancel and Confirm actions; Confirm is not the default focused button (prevent muscle-memory commits)
- If operation is reversible, say so explicitly

### 4.6 Agent detail view (provenance panel)

Clicking a row opens a side panel with the agent's detail.

Must include:
- Name, description, scope, vendor, file path
- Provenance: created-at, created-from (template ref if any), last-invoked-at, invocation count
- Frontmatter fields visualized (common fields prominent; vendor-specific fields in a collapsible "Advanced" section)
- Body preview (first ~10 lines; "Edit as markdown" to see all)
- Actions: Edit as markdown, Set canonical, Archive, Delete, Duplicate
- Drift warning if this is a non-canonical duplicate of a canonical agent

### 4.7 "Edit as markdown" transition

This is not a new screen — it's the handoff from the Library view into Ritemark's existing markdown editor. Design the transition:

- Where does the editor open? (New tab? Replace current?)
- How does the user know they can come back to the Library?
- Is there a visual link between the editor tab and the Library row?
- When they save and switch back, how does the row visually acknowledge the change?

### 4.8 Canonical flag surfacing

- How is a canonical agent visually distinct in the list? (Small icon? Dot? Label?)
- Where does the "Set as canonical" action live? (Row action menu? Detail panel? Both?)
- How is a drift warning presented on non-canonical siblings? (Inline badge? Tooltip? Separate banner?)

## 5. Reference material (inspiration, not copy)

- **Cursor 3's Agents Window** — tiled multi-agent view for power users
- **Zapier Agents "Pods" and "Needs action" filter** — grouping and focused attention patterns
- **GitHub's repo insights / traffic tab** — dense power-user table with filters
- **Linear's issue list** — keyboard-first, dense, sortable, multi-select
- **VS Code's Source Control panel diff** — file-path visible, inline diff, action menu
- **Kaleidoscope / Beyond Compare** — file-level diff UX patterns
- **Obsidian's graph view / file-management panels** — markdown-native management UX

The pattern to take from each is named; do not replicate any of them wholesale. This is not Cursor for agents.

## 6. What to deliver

At the end of the design phase, land these in `notes/` inside the sprint folder:

1. Wireframes (Figma link or exported PNGs) for each required screen in 4.1–4.8
2. Short written rationale per screen — what the screen is solving, which principles it honors, which trade-offs were made
3. Interaction notes for destructive ops (4.3, 4.4, 4.5) — what happens on hover, confirm, cancel, keyboard shortcuts, accidental-click prevention
4. Empty-state wireframe + write-up (4.2)
5. Responsive / width-constrained behavior notes — Ritemark's left sidebar is narrow; the Library may need to break out into the editor area. Propose a placement decision with rationale.
6. Dark-mode + light-mode variants where color is load-bearing
7. A list of any *new* open questions surfaced during design that the implementation plan should address

## 7. What NOT to design

- No creation flow. No "New Agent" form, wizard, or template picker. Those belong to v1-C in a later sprint.
- No templates gallery. Don't even suggest one — it's a strategic commitment that hasn't been made yet.
- No onboarding nudges, "get started" cards, or first-run tutorials.
- No redesign of Ritemark's markdown editor.
- No changes to the existing AgentSelector, ChatView, or Flows UI — those must remain visually and functionally untouched.
- No *@agent* in-document invocation. That's v1-C.
- No push / context-triggered suggestion surface. That's v1-D.
- No per-agent analytics dashboard beyond a simple invocation count. Dashboards are v1-D.
- No speculation about Gemini. Stub vendor badge only.

If you feel an instinct to add any of these, note it in the open-questions list at the end and keep designing Option B.

## 8. Open questions you can weigh in on

These are things the implementation plan has listed as unresolved. The designer has standing to influence them:

1. **Placement**: is the Library a new VS Code view container (new activity-bar icon), a panel inside the existing AI sidebar, a dedicated editor tab, or some combination? Propose and defend a choice.
2. **Column overflow**: which columns survive a narrow sidebar? What's the minimum-viable column set? When does the table break out into the editor area?
3. **Vendor badging**: how distinct but not decorative? Small colored dot? Single-letter pill? Full-word tag? Something else?
4. **Destructive-op friction**: how much friction is right? One confirm click is too little; typing "DELETE" is too much. Where's the sweet spot for Viktor?
5. **Diff view density**: Kaleidoscope-like full split, or collapse unchanged frontmatter fields? If collapsing, how does the user expand?
6. **Canonical flag icon**: ★? Pin icon? Lock icon? Or something purely non-iconic?
7. **Audit log surfacing**: is there a UI for browsing the audit log, or is it file-only? If UI, where does it live?

## 9. Success criteria for the design

- [ ] A developer reading the wireframes + notes can begin Phase 3 implementation without asking further design questions
- [ ] Viktor's flow in `docs-internal/user-flows.md` is walkable end-to-end through the wireframes
- [ ] The round-trip guarantee (`docs-internal/round-trip-guarantee.md`) is visibly honored on every screen
- [ ] Every destructive op has an associated preview / undo affordance designed
- [ ] Empty, partial, and populated states are all drawn
- [ ] No feature outside Option B scope has been added

## 10. Process

- Deliver drafts into `notes/wireframes-v1/` (or similar) inside the sprint folder
- Expect iteration — the Phase 2 approval gate depends on both architecture and design being ready together
- Final design ships with the `notes/architecture.md` output; both go to Jarmo for Phase 2 → 3 approval
- Implementation does not start until Jarmo explicitly approves

## 11. Contact / context

- Product owner: Jarmo
- Sprint manager: see `sprint-plan.md`
- Strategic framing: `docs-internal/insights.md`, `docs-internal/insights-2.md`
- Design principle (non-negotiable): `docs-internal/round-trip-guarantee.md`
- Primary persona: Viktor, `docs-internal/user-flows.md`
- Full v1 altitude menu (what's NOT in this sprint): `docs-internal/roadmap.md`

Questions welcome. Ambiguity is worse than friction — if anything in this brief is unclear, surface it immediately rather than guessing.
