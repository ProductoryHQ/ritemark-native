# Sprint 54: Agent Curation Layer

## Goal

Give Ritemark a unified, trustworthy *curation layer* over the accumulated `.md` agent/skill files across Claude Code and Codex — a place where a power user can see everything they have, detect duplicates, archive orphans, harmonize cross-vendor entries, and mark canonical versions, without ever losing the round-trip guarantee between GUI and file.

## Why This Sprint Exists

Veteran users of Claude Code and Codex accumulate a `.md` harness that drifts over time:

- Dozens of agents across `.claude/agents/`, `~/.claude/agents/`, project-local scopes, and plugin dirs — no unified view
- Duplicates silently drift when the same agent lives in user and project scope
- Orphaned agents persist because the user is afraid to delete anything — they cannot remember what depends on each file
- Cross-vendor setups (Claude + Codex) are manually kept in sync; `AGENTS.md` and `.claude/agents/` never talk to each other
- The existing Ritemark sidebar selects agents but does not surface them for *management*; `agent/discovery.ts` already scans them but nothing renders a list
- No provenance — when was this created, why, last-used-when — so deletion feels reckless

This sprint does not build a runtime, a builder, or an onboarding flow. It builds the surface that makes an existing mess legible. Full strategic context: `docs-internal/insights.md`, `docs-internal/insights-2.md`, `docs-internal/user-flows.md` (Viktor section), `docs-internal/roadmap.md` Option B.

## Feature Flag Check

- [x] Does this sprint need a feature flag? **YES.** New flag `agent-library`, status `experimental`, default OFF. Reason: new user-facing surface, large UI change, destructive-op tooling that benefits from a kill-switch during rollout. Follow the convention in `.claude/skills/feature-flags/SKILL.md`. Wire it end-to-end in `extensions/ritemark/src/features/flags.ts`, `extensions/ritemark/package.json`, `extensions/ritemark/src/settings/RitemarkSettingsProvider.ts`, and `extensions/ritemark/webview/src/components/settings/RitemarkSettings.tsx`.

## Success Criteria

- [ ] Opening Ritemark on a project with an existing `.claude/` directory surfaces a populated Library view with accurate counts (agents, skills, commands)
- [ ] The Library view lists every `.md` agent/skill/command file discovered, with file path always visible
- [ ] Filters work correctly: scope (all / project / user / plugin), vendor (Claude / Codex / any), status (active / dormant / orphaned), health (duplicated / broken / stale)
- [ ] Duplicate detection finds name-matched pairs across scopes and renders a side-by-side frontmatter + body diff
- [ ] Every destructive operation (move, delete, archive, promote-to-user) presents a dry-run dialog with explicit filesystem ops before committing
- [ ] Archived and soft-deleted files stay under their original writable root (`<root>/.claude/.archive/` and `<root>/.claude/.trash/`); plugin and repo-tracked files are read-only in this sprint
- [ ] Bulk operations work on multi-selection and log every mutation to `.ritemark/agent-ops.log`
- [ ] A file edited externally (VS Code tab, git pull, another editor) reflects in the Library view without manual refresh (file-watcher)
- [ ] Round-trip guarantee: every agent card has an "Edit as markdown" action that opens the file in Ritemark's markdown editor; unknown frontmatter fields survive a GUI edit → file save round-trip
- [ ] Canonical flag (`ritemark.canonical: true` in frontmatter) is surfaced in the UI and drift warnings appear when non-canonical siblings diverge
- [ ] Provenance frontmatter (`ritemark.createdAt`, `ritemark.lastInvokedAt`) is stamped only on writable user-owned markdown files; read-only sources surface derived provenance without write-back and preserve unrelated GUI edits
- [ ] Codex `AGENTS.md` entries appear in the unified list behind a Codex filter (read-only in this sprint; write-back is not guaranteed)
- [ ] QA gate: `qa-validator` passes; no regression in AgentSelector, RitemarkSettings, or Flows

## Deliverables

| Deliverable | Description | Phase | Status |
| --- | --- | --- | --- |
| **Ritemark design skill** | Install `ritemark-design` skill at `.claude/skills/ritemark-design/` (project-level) codifying the Indigo-current palette, component polish rules, light + dark theme spec, audit checklist. Prep work — unblocks wireframes and implementation with a consistent design language. See `design-study/` and this sprint's rationale below. | 0 | TODO |
| Discovery-surface audit | Document current `agent/discovery.ts` capabilities, gaps vs scope of this sprint | 1 | TODO |
| Architectural design doc | Resolve open questions (write eligibility, provenance storage, file-watcher shape, dedup heuristic, archive/trash policy, file-writer with frontmatter preservation) | 2 | TODO |
| Design wireframes | Low-fi wireframes and interaction notes for every required screen (see `design-brief.md`); wireframes must use the `ritemark-design` skill as the visual language | 2 | TODO |
| **Approval gate** | Jarmo approves technical plan + wireframes before Phase 3 starts | 2→3 | BLOCKING |
| Discovery expansion | Extend `agent/discovery.ts` to cover user-scope, plugin dirs, Codex `AGENTS.md`, health detection | 3 | TODO |
| Library view | New UI surface rendering the discovered list with filters and actions | 3 | TODO |
| Dedup + diff | Side-by-side diff view, explicit filesystem-op previews | 4 | TODO |
| Orphan + bulk ops | Orphan detection heuristic, archive/trash mechanics, bulk-op dry-run, audit log | 4 | TODO |
| Round-trip file writer | Frontmatter-preserving parser/serializer, file-watcher, provenance stamper | 5 | TODO |
| Canonical flag | Flag surfacing + drift detection | 5 | TODO |
| Feature flag wiring | `agent-library` flag defined, contributed in `package.json`, wired through settings provider, gated on extension + webview; setting surfaced in Settings | 5 | TODO |
| Validation | Build, tests, QA, manual smoke tests of Viktor's flow | 6 | TODO |

## Scope

### In Scope

- `extensions/ritemark/src/agent/discovery.ts` (expansion)
- New files under `extensions/ritemark/src/agent/curation/` (library service, dedup, orphan detection, bulk ops, audit log)
- New files under `extensions/ritemark/src/agent/files/` (frontmatter-preserving parser + serializer + file watcher)
- New webview UI under `extensions/ritemark/webview/src/components/agent-library/`
- Integration with existing `UnifiedViewProvider.ts` message bridge (new message types; do not replace existing)
- `extensions/ritemark/src/features/flags.ts` (new flag)
- `extensions/ritemark/package.json` (contributed setting for experimental flag)
- `extensions/ritemark/src/settings/RitemarkSettingsProvider.ts` (send/read flag state)
- `RitemarkSettings.tsx` (surface the new flag; do not break the 1,446-line invariant)
- Design wireframes (Figma or low-fi sketch files) delivered into `notes/`
- Claude-first discovery; Codex `AGENTS.md`, plugin dirs, and repo-tracked vendor files read-only; Gemini stub (detection only, no write path)

### Out of Scope

- Templates gallery, NL-first agent creation, pre-filled creation forms (v1-C)
- `@agent` in-document invocation (v1-C)
- Push / context-triggered suggestions (v1-D)
- Cross-vendor runtime switching (v1-D)
- Conversation-log coupling (v1-D)
- Per-agent analytics beyond invocation count (v1-D)
- Gemini write path
- MCP server discovery/counts
- Any changes to the existing AgentSelector, ChatView, or Flows UIs (must remain intact)
- Any changes to `.claude/agents/**` authored content in this repo — Ritemark reads and may write *user* files, never repo-committed sprint agents
- Templates (even placeholder) — do not seed any

## Implementation Checklist

### Phase 0: Design Foundation — Ritemark Design Skill

**Rationale.** Sprint 54 ships a substantial new UI surface (the Agent Library — a dense power-user table with filters, diff views, dry-run dialogs, detail panels). Without a design system codified before wireframes are drawn, we have two paths: (a) author it in the current "VS Code feeling" mode — VS Code's default dark chrome, shadcn defaults on indigo fallback — which is exactly what Jarmo wants to move away from, or (b) each new component reinvents its own polish rules, producing drift from day one across Library rows, dialogs, badges, diff panes, and the detail panel.

Instead, we front-load a design foundation: a `ritemark-design` skill codifying the existing **Indigo-current** palette (which Ritemark already ships via `themes/ritemark-light.json`) plus the component polish the design study validated (sidebar left-border active state, muted-tone hierarchy, focus-ring + colored-shadow CTAs), plus a net-new **Ritemark dark theme** (Deep-Space-on-deep-indigo, not VS Code charcoal) so the "VS Code feeling" stops surviving into dark mode in this sprint's UI.

The skill is prep, not product. It unblocks:
- **Phase 2 wireframes** — the designer uses the skill's token library + component patterns as the shared visual vocabulary, aligned with design-brief principle #4 (density over decoration).
- **Phase 3+ implementation** — the engineer reads `references/webview-ui.md` and `references/components.md` to build Library components with the right primitives the first time, not after review cycles.
- **Future sprints** — every subsequent UI surface has one source of truth instead of accumulating per-sprint drift.

Design study (pre-read): `docs-internal/analysis/design-study/` — the comparison study where Option D (Indigo-current) was selected.

- [ ] Build the skill at `.claude/skills/ritemark-design/` (project-level) per proposed structure (SKILL.md, tokens.css, references/, preview/, slides/, assets/)
- [ ] Spec the new Ritemark dark theme palette in `references/vscode-core.md` (implementation of `themes/ritemark-dark.json` is separate, not in this sprint)
- [ ] Write `references/audit-current.md` — checklist for Phase 3+ engineer to confirm new components follow the skill's polish rules (sidebar active state, focus ring, CTA shadow, muted tone ladder)
- [ ] Extract indigo + slate palette rules from `branding/PRODUCTORY_BRAND_GUIDELINES .md` into the skill; delete the legacy doc after
- [ ] **Jarmo sign-off** that the skill is ready before Phase 1 starts

Phase 0 is self-contained and does not depend on Phase 1 research — it can happen immediately.

### Phase 1: Audit

- [ ] Inspect current `agent/discovery.ts`: what it scans, what it returns, how it's wired into `UnifiedViewProvider`
- [ ] Inventory where discovered agents/commands surface in the webview today (AgentSelector, slash commands)
- [ ] Map the actual file locations Claude Code scans (reference: `docs/development/analysis/` and the Claude Code research dossier produced for this effort)
- [ ] Map the actual file locations Codex scans (`AGENTS.md`, `.agents/skills/`)
- [ ] Produce a write-eligibility matrix: writable user files vs read-only repo-tracked, plugin, and Codex sources
- [ ] Check whether any sidecar state about agents already exists in the extension (it should not; if it does, flag it)
- [ ] Produce `research/discovery-audit.md`

### Phase 2: Architectural Design — GATE BEFORE PHASE 3

These open questions must be resolved in a design doc before a line of implementation code is written:

- [ ] **Write-eligibility matrix**: define exactly which roots are writable in v1 (`<workspace>/.claude/**`, `~/.claude/**`) and which stay read-only (`AGENTS.md`, plugin dirs, repo-tracked vendor files). Decision + rationale.
- [ ] **Provenance storage**: frontmatter for writable user-owned files; transparent `.ritemark/` index for read-only sources only. Decision + rationale.
- [ ] **Invocation-tracking mechanism**: how does Ritemark observe that an agent was invoked (which channel? AgentRunner? webview events?) and what's the minimum-invasive way to stamp `lastInvokedAt`
- [ ] **File-watcher architecture**: `vscode.FileSystemWatcher` with debounced reparse; what triggers a full rescan vs incremental
- [ ] **Duplicate-detection heuristic**: name-match (simple, brittle), content-hash (catches copies), fuzzy similarity (heavy). Start simple + iterate.
- [ ] **Frontmatter preservation contract**: which YAML library round-trips comment preservation and key order? If none, document the degradation explicitly. Test vectors required.
- [ ] **Audit log**: plain JSONL at `.ritemark/agent-ops.log`; rotation strategy; git-ignore default
- [ ] **Destructive-op root policy**: archive/trash must stay under the original writable root; destructive ops unavailable for read-only sources
- [ ] **Trash retention policy**: no automatic 30-day cleanup in this sprint; define manual restore/empty-trash behavior and document it honestly
- [ ] **VS Code surface placement**: new view-container, panel in existing AI sidebar, or dedicated editor tab (per design-brief open question)
- [ ] **Message protocol additions**: new `library:*` message types without breaking existing `agent:*` protocol
- [ ] **Interaction with existing `agentic-assistant` flag**: does the Library require that flag, or is it independent?
- [ ] Produce `notes/architecture.md` and `notes/open-questions-resolved.md`
- [ ] Design wireframes delivered per `design-brief.md`
- [ ] **APPROVAL GATE**: Jarmo reviews architecture + wireframes. Explicit "approved" required. Do not proceed without it.

### Phase 3: Discovery Expansion + Library View

- [ ] Extend `agent/discovery.ts` to walk all in-scope locations (not just project `.claude/`)
- [ ] Add a `DiscoveredFile` record with vendor, scope, full path, root policy (`writable` / `read-only`), frontmatter, body-hash, mtime, provenance fields
- [ ] Add Codex `AGENTS.md` parsing (read-only)
- [ ] Wire a `library:list` message from webview → extension; return normalized list
- [ ] Implement the Library view component (dense table, sortable, multi-select, counts for agents/skills/commands only)
- [ ] Implement filter controls (scope / vendor / status / health) using `.ritemark-filter-chip` from `.claude/skills/ritemark-design/references/components.md`
- [ ] Render file path and "Edit as markdown" action on every row
- [ ] Feature-flag gate: everything behind `isEnabled('agent-library')`
- [ ] Add Tailwind semantic aliases to `extensions/ritemark/webview/tailwind.config.ts` (e.g. `text-ink-muted`, `bg-surface-soft`, `border-hairline`, `bg-accent-soft`) mapping each alias to the corresponding `--r-*` role token; replace any remaining `--vscode-*` color references in new Library components (VS Code vars remain only for scrollbar/context-menu surfaces per `references/webview-ui.md`)

### Phase 4: Dedup, Orphan, Bulk Ops

- [ ] Implement duplicate detection (chosen heuristic from Phase 2)
- [ ] Side-by-side diff view — frontmatter fields + body
- [ ] Orphan / stale detection based on `lastInvokedAt`
- [ ] Archive mechanic (move within the same writable root to `.claude/.archive/<timestamp>/`)
- [ ] Trash mechanic (move within the same writable root to `.claude/.trash/<timestamp>/`); no auto-cleanup in this sprint
- [ ] Bulk-op selection + dry-run dialog that lists exact filesystem ops before commit
- [ ] Audit log append on every mutation
- [ ] Undo for last op (read from audit log)

#### Phase 4 Visual Regression Tests

- [ ] Capture Playwright screenshots of Library view (populated, empty, diff view, dry-run dialog) and compare against Phase 2 wireframes
- [ ] Confirm `components/ui/button.tsx` CTA primary variant renders with indigo shadow + 10px radius (regression risk: shadcn defaults drift)
- [ ] Confirm Dialog backdrop is Deep Space tint `rgba(30, 27, 75, 0.45)` + 6px blur (not default black)
- [ ] Confirm FilterChip selected state renders `accent-soft` background + accent border + `accent-deep` text (regression risk: shadcn Badge default would overwrite this if someone refactors)

### Phase 5: Round-Trip Writer, Provenance, Canonical

- [ ] Frontmatter-preserving parser + serializer (merge-not-replace semantics) with test vectors covering: unknown fields, comments, key order, multi-line values, empty frontmatter, missing frontmatter
- [ ] File-watcher that detects external edits and refreshes the Library view without user action
- [ ] Provenance stamper: set `ritemark.createdAt` on newly observed writable user files (migration moment, one-time per file), `ritemark.lastInvokedAt` whenever AgentRunner fires for writable files
- [ ] Read-only provenance model: derive and surface provenance for `AGENTS.md`, plugin, and repo-tracked sources without mutating them
- [ ] Canonical flag (`ritemark.canonical: true`) — set via row action, preserved by round-trip
- [ ] Drift warning: when non-canonical siblings diverge from canonical, surface as a health badge
- [ ] Feature flag: add `agent-library` to `flags.ts`, contribute it in `package.json`, wire it through `RitemarkSettingsProvider.ts`, surface it in `RitemarkSettings.tsx`, send enabled-state to webview

### Phase 6: Validation

- [ ] `cd extensions/ritemark && npm run compile`
- [ ] `cd extensions/ritemark/webview && npm run build`
- [ ] `./scripts/validate-qa.sh`
- [ ] Unit tests for frontmatter parser + serializer (round-trip invariants are load-bearing)
- [ ] Unit tests for discovery expansion
- [ ] Integration test for file-watcher → Library view refresh path
- [ ] Manual QA: walk Viktor's flow end-to-end from `docs-internal/user-flows.md`
- [ ] Manual QA: confirm round-trip guarantee — create an agent with exotic frontmatter (comments, unknown fields, key order), edit it in GUI, confirm file is preserved
- [ ] Manual QA: confirm existing AgentSelector, ChatView, Flows, and Settings still work (regression)
- [ ] Manual QA: disabling the flag hides all Library UI without breaking anything
- [ ] Manual QA: Codex `AGENTS.md` is discovered and listed correctly
- [ ] Produce `notes/validation-log.md` + `handover.md` for release-manager

## Invariants This Sprint Must Uphold

1. **Round-trip guarantee** (`docs-internal/round-trip-guarantee.md`) — unknown frontmatter fields preserved, external edits respected, file is source of truth, no sidecar DB for things that belong in the file
2. **Never stub or disable existing features** (CLAUDE.md HARD RULE #1) — AgentSelector, ChatView, Flows, Settings must remain fully functional
3. **Settings page full implementation** (CLAUDE.md invariant) — `RitemarkSettings.tsx` must remain ≥400 lines; the feature-flag toggle is an *addition*, not a replacement
4. **Feature flags default ON** except when Jarmo explicitly says otherwise (CLAUDE.md HARD RULE #2). This sprint: `agent-library` defaults OFF (experimental), consistent with `codex-integration` and `scheduled-flow-runs` pattern. Explicitly confirm this with Jarmo at Phase 2 gate.
5. **No destructive filesystem op without preview + explicit user consent** — dry-run dialog on every mutation, audit log on every commit
6. **No proprietary middle format** — all agent metadata lives in frontmatter or in a transparent, rebuildable `.ritemark/` index
7. **Read-only sources stay read-only** — no automatic write-back to Codex `AGENTS.md`, plugin dirs, or repo-tracked vendor files in this sprint
8. **Archive/trash never cross roots** — project files stay under project-managed storage; user-home files stay under user-home storage

## Risk Register

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Frontmatter parser loses comments / ordering | HIGH | Test vectors for every weird YAML shape; pick a library with round-trip semantics (e.g., `yaml` package in `document` mode, not `parse`); if no library does this cleanly, document the degradation explicitly and narrow the promise |
| Destructive op wipes user data | HIGH | Dry-run dialog mandatory; archive/trash stay in the original writable root; read-only sources expose no destructive actions; Phase 6 manual QA explicitly checks recovery path |
| Dedup false positives cause wrong merges | MEDIUM | Never auto-merge; always present diff; user must explicitly pick a winner; fuzzy matching gated behind an opt-in |
| File-watcher debouncing / race with GUI saves | MEDIUM | Single writer path; GUI saves go through same serializer as external edits; version-on-disk compared on save |
| Provenance stamping pollutes vendor-owned files | MEDIUM | Stamp only writable user-owned files; use a transparent `.ritemark/` index for read-only sources; document clearly in the architecture doc |
| Feature flag is only partially wired | MEDIUM | Treat `flags.ts`, `package.json`, `RitemarkSettingsProvider.ts`, and `RitemarkSettings.tsx` as one deliverable; validate both extension and webview gating in Phase 6 |
| Cross-vendor field semantics don't map | LOW (scope-limited) | Codex is read-only in this sprint; Gemini is stub; no semantic translation attempted |
| Audit log grows unbounded | LOW | Plain JSONL, gitignored, rotation only if it becomes a real problem; document manual cleanup |
| Scope creep toward v1-C (templates, NL creation) | HIGH | Sprint-manager enforces scope; any new "while we're at it" request defers to a later sprint |
| shadcn component drift overwrites Ritemark polish | HIGH | Phase 4 visual regression tests check button CTA shadow, Dialog backdrop, and FilterChip selected state; code-review checklist reads `.claude/skills/ritemark-design/references/audit-current.md` before Phase 4 merge |

## Key Research

- `docs-internal/insights.md`
- `docs-internal/insights-2.md`
- `docs-internal/round-trip-guarantee.md`
- `docs-internal/user-flows.md` (Viktor section — primary persona)
- `docs-internal/roadmap.md` (Option B)
- `research/discovery-audit.md` (Phase 1 output — TBD)
- `notes/architecture.md` (Phase 2 output — TBD)

## Key Files

| File | Purpose |
| --- | --- |
| `extensions/ritemark/src/agent/discovery.ts` | Existing discovery; to be expanded for user-scope, plugin dirs, Codex |
| `extensions/ritemark/src/agent/curation/library.ts` | NEW — unified library service |
| `extensions/ritemark/src/agent/curation/dedup.ts` | NEW — duplicate detection |
| `extensions/ritemark/src/agent/curation/orphan.ts` | NEW — stale / orphan heuristic |
| `extensions/ritemark/src/agent/curation/bulkOps.ts` | NEW — multi-file operations with dry-run |
| `extensions/ritemark/src/agent/curation/auditLog.ts` | NEW — append-only JSONL log |
| `extensions/ritemark/src/agent/files/frontmatter.ts` | NEW — merge-not-replace parser + serializer |
| `extensions/ritemark/src/agent/files/watcher.ts` | NEW — file-watcher wrapper |
| `extensions/ritemark/src/agent/files/provenance.ts` | NEW — ritemark.* frontmatter stamping |
| `extensions/ritemark/src/views/UnifiedViewProvider.ts` | EXTEND — add `library:*` message types |
| `extensions/ritemark/webview/src/components/agent-library/` | NEW — Library UI (table, filters, diff view, dry-run dialog) |
| `extensions/ritemark/src/features/flags.ts` | EXTEND — add `agent-library` flag |
| `extensions/ritemark/package.json` | EXTEND — contribute experimental setting for `agent-library` |
| `extensions/ritemark/src/settings/RitemarkSettingsProvider.ts` | EXTEND — send/read `agent-library` setting state |
| `extensions/ritemark/webview/src/components/settings/RitemarkSettings.tsx` | EXTEND — add flag toggle; MUST NOT shrink below 400 lines |

## Status

**Current Phase:** Phase 2 ready for Jarmo approval
**Current Branch:** `claude/research-agent-management-ux-Xkewf`
**Phase 0:** Complete — `ritemark-design` skill shipped
**Phase 1:** Complete — discovery audit done; token gap confirmed none; FilterChip spec written; Tailwind alias decision made
**Next Gate:** Jarmo approves Phase 2 plan → Phase 3 implementation begins
