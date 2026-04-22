# Sprint 52: Agent Curation Layer

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

- [x] Does this sprint need a feature flag? **YES.** New flag `agent-library`, status `experimental`, default OFF. Reason: new user-facing surface, large UI change, destructive-op tooling that benefits from a kill-switch during rollout. Follow the convention in `.claude/skills/feature-flags/SKILL.md`. Add to `extensions/ritemark/src/features/flags.ts`.

## Success Criteria

- [ ] Opening Ritemark on a project with an existing `.claude/` directory surfaces a populated Library view with accurate counts (agents, skills, commands, MCP servers)
- [ ] The Library view lists every `.md` agent/skill/command file discovered, with file path always visible
- [ ] Filters work correctly: scope (all / project / user / plugin), vendor (Claude / Codex / any), status (active / dormant / orphaned), health (duplicated / broken / stale)
- [ ] Duplicate detection finds name-matched pairs across scopes and renders a side-by-side frontmatter + body diff
- [ ] Every destructive operation (move, delete, archive, promote-to-user) presents a dry-run dialog with explicit filesystem ops before committing
- [ ] Archived files are moved to `.claude/.archive/` with timestamp; deleted files land in `.claude/.trash/` with a 30-day recovery window
- [ ] Bulk operations work on multi-selection and log every mutation to `.ritemark/agent-ops.log`
- [ ] A file edited externally (VS Code tab, git pull, another editor) reflects in the Library view without manual refresh (file-watcher)
- [ ] Round-trip guarantee: every agent card has an "Edit as markdown" action that opens the file in Ritemark's markdown editor; unknown frontmatter fields survive a GUI edit → file save round-trip
- [ ] Canonical flag (`ritemark.canonical: true` in frontmatter) is surfaced in the UI and drift warnings appear when non-canonical siblings diverge
- [ ] Provenance frontmatter (`ritemark.createdAt`, `ritemark.lastInvokedAt`) is stamped by Ritemark without user action and is preserved by unrelated GUI edits
- [ ] Codex `AGENTS.md` entries appear in the unified list behind a Codex filter (read-only in this sprint; write-back is not guaranteed)
- [ ] QA gate: `qa-validator` passes; no regression in AgentSelector, RitemarkSettings, or Flows

## Deliverables

| Deliverable | Description | Phase | Status |
| --- | --- | --- | --- |
| Discovery-surface audit | Document current `agent/discovery.ts` capabilities, gaps vs scope of this sprint | 1 | TODO |
| Architectural design doc | Resolve open questions (provenance storage, file-watcher shape, dedup heuristic, audit log, file-writer with frontmatter preservation) | 2 | TODO |
| Design wireframes | Low-fi wireframes and interaction notes for every required screen (see `design-brief.md`) | 2 | TODO |
| **Approval gate** | Jarmo approves technical plan + wireframes before Phase 3 starts | 2→3 | BLOCKING |
| Discovery expansion | Extend `agent/discovery.ts` to cover user-scope, plugin dirs, Codex `AGENTS.md`, health detection | 3 | TODO |
| Library view | New UI surface rendering the discovered list with filters and actions | 3 | TODO |
| Dedup + diff | Side-by-side diff view, explicit filesystem-op previews | 4 | TODO |
| Orphan + bulk ops | Orphan detection heuristic, archive/trash mechanics, bulk-op dry-run, audit log | 4 | TODO |
| Round-trip file writer | Frontmatter-preserving parser/serializer, file-watcher, provenance stamper | 5 | TODO |
| Canonical flag | Flag surfacing + drift detection | 5 | TODO |
| Feature flag wiring | `agent-library` flag defined, gated on extension + webview; setting surfaced in Settings | 5 | TODO |
| Validation | Build, tests, QA, manual smoke tests of Viktor's flow | 6 | TODO |

## Scope

### In Scope

- `extensions/ritemark/src/agent/discovery.ts` (expansion)
- New files under `extensions/ritemark/src/agent/curation/` (library service, dedup, orphan detection, bulk ops, audit log)
- New files under `extensions/ritemark/src/agent/files/` (frontmatter-preserving parser + serializer + file watcher)
- New webview UI under `extensions/ritemark/webview/src/components/agent-library/`
- Integration with existing `UnifiedViewProvider.ts` message bridge (new message types; do not replace existing)
- `extensions/ritemark/src/features/flags.ts` (new flag)
- `RitemarkSettings.tsx` (surface the new flag; do not break the 1,446-line invariant)
- Design wireframes (Figma or low-fi sketch files) delivered into `notes/`
- Claude-first discovery; Codex `AGENTS.md` read-only; Gemini stub (detection only, no write path)

### Out of Scope

- Templates gallery, NL-first agent creation, pre-filled creation forms (v1-C)
- `@agent` in-document invocation (v1-C)
- Push / context-triggered suggestions (v1-D)
- Cross-vendor runtime switching (v1-D)
- Conversation-log coupling (v1-D)
- Per-agent analytics beyond invocation count (v1-D)
- Gemini write path
- Any changes to the existing AgentSelector, ChatView, or Flows UIs (must remain intact)
- Any changes to `.claude/agents/**` authored content in this repo — Ritemark reads and may write *user* files, never repo-committed sprint agents
- Templates (even placeholder) — do not seed any

## Implementation Checklist

### Phase 1: Audit

- [ ] Inspect current `agent/discovery.ts`: what it scans, what it returns, how it's wired into `UnifiedViewProvider`
- [ ] Inventory where discovered agents/commands surface in the webview today (AgentSelector, slash commands)
- [ ] Map the actual file locations Claude Code scans (reference: `docs/development/analysis/` and the Claude Code research dossier produced for this effort)
- [ ] Map the actual file locations Codex scans (`AGENTS.md`, `.agents/skills/`)
- [ ] Check whether any sidecar state about agents already exists in the extension (it should not; if it does, flag it)
- [ ] Produce `research/discovery-audit.md`

### Phase 2: Architectural Design — GATE BEFORE PHASE 3

These open questions must be resolved in a design doc before a line of implementation code is written:

- [ ] **Provenance storage**: frontmatter-only (preferred; respects round-trip) vs `.ritemark/` index (rebuildable, avoids polluting vendor-owned files). Decision + rationale.
- [ ] **Invocation-tracking mechanism**: how does Ritemark observe that an agent was invoked (which channel? AgentRunner? webview events?) and what's the minimum-invasive way to stamp `lastInvokedAt`
- [ ] **File-watcher architecture**: `vscode.FileSystemWatcher` with debounced reparse; what triggers a full rescan vs incremental
- [ ] **Duplicate-detection heuristic**: name-match (simple, brittle), content-hash (catches copies), fuzzy similarity (heavy). Start simple + iterate.
- [ ] **Frontmatter preservation contract**: which YAML library round-trips comment preservation and key order? If none, document the degradation explicitly. Test vectors required.
- [ ] **Audit log**: plain JSONL at `.ritemark/agent-ops.log`; rotation strategy; git-ignore default
- [ ] **Destructive-op reversibility**: archive (mv to `.claude/.archive/`) vs soft-delete (mv to `.claude/.trash/` with TTL); who runs the 30-day cleanup
- [ ] **VS Code surface placement**: new view-container, panel in existing AI sidebar, or dedicated editor tab (per design-brief open question)
- [ ] **Message protocol additions**: new `library:*` message types without breaking existing `agent:*` protocol
- [ ] **Interaction with existing `agentic-assistant` flag**: does the Library require that flag, or is it independent?
- [ ] Produce `notes/architecture.md` and `notes/open-questions-resolved.md`
- [ ] Design wireframes delivered per `design-brief.md`
- [ ] **APPROVAL GATE**: Jarmo reviews architecture + wireframes. Explicit "approved" required. Do not proceed without it.

### Phase 3: Discovery Expansion + Library View

- [ ] Extend `agent/discovery.ts` to walk all in-scope locations (not just project `.claude/`)
- [ ] Add a `DiscoveredFile` record with vendor, scope, full path, frontmatter, body-hash, mtime, provenance fields
- [ ] Add Codex `AGENTS.md` parsing (read-only)
- [ ] Wire a `library:list` message from webview → extension; return normalized list
- [ ] Implement the Library view component (dense table, sortable, multi-select)
- [ ] Implement filter controls (scope / vendor / status / health)
- [ ] Render file path and "Edit as markdown" action on every row
- [ ] Feature-flag gate: everything behind `isEnabled('agent-library')`

### Phase 4: Dedup, Orphan, Bulk Ops

- [ ] Implement duplicate detection (chosen heuristic from Phase 2)
- [ ] Side-by-side diff view — frontmatter fields + body
- [ ] Orphan / stale detection based on `lastInvokedAt`
- [ ] Archive mechanic (move to `.claude/.archive/<timestamp>/`)
- [ ] Trash mechanic (move to `.claude/.trash/<timestamp>/`) + scheduled cleanup or manual-only for now
- [ ] Bulk-op selection + dry-run dialog that lists exact filesystem ops before commit
- [ ] Audit log append on every mutation
- [ ] Undo for last op (read from audit log)

### Phase 5: Round-Trip Writer, Provenance, Canonical

- [ ] Frontmatter-preserving parser + serializer (merge-not-replace semantics) with test vectors covering: unknown fields, comments, key order, multi-line values, empty frontmatter, missing frontmatter
- [ ] File-watcher that detects external edits and refreshes the Library view without user action
- [ ] Provenance stamper: set `ritemark.createdAt` on newly observed files (migration moment, one-time per file), `ritemark.lastInvokedAt` whenever AgentRunner fires
- [ ] Canonical flag (`ritemark.canonical: true`) — set via row action, preserved by round-trip
- [ ] Drift warning: when non-canonical siblings diverge from canonical, surface as a health badge
- [ ] Feature flag: add `agent-library` to `flags.ts`, wire to settings surface in `RitemarkSettings.tsx`, send enabled-state to webview

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

## Risk Register

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Frontmatter parser loses comments / ordering | HIGH | Test vectors for every weird YAML shape; pick a library with round-trip semantics (e.g., `yaml` package in `document` mode, not `parse`); if no library does this cleanly, document the degradation explicitly and narrow the promise |
| Destructive op wipes user data | HIGH | Dry-run dialog mandatory; all mutations reversible (archive + trash with TTL); audit log; Phase 6 manual QA explicitly checks recovery path |
| Dedup false positives cause wrong merges | MEDIUM | Never auto-merge; always present diff; user must explicitly pick a winner; fuzzy matching gated behind an opt-in |
| File-watcher debouncing / race with GUI saves | MEDIUM | Single writer path; GUI saves go through same serializer as external edits; version-on-disk compared on save |
| Provenance stamping pollutes vendor-owned files | MEDIUM | Namespace under `ritemark.*` key; preserve on round-trip; document clearly; offer opt-out in settings |
| Cross-vendor field semantics don't map | LOW (scope-limited) | Codex is read-only in this sprint; Gemini is stub; no semantic translation attempted |
| Audit log grows unbounded | LOW | Plain JSONL, gitignored, rotation only if it becomes a real problem; document manual cleanup |
| Scope creep toward v1-C (templates, NL creation) | HIGH | Sprint-manager enforces scope; any new "while we're at it" request defers to a later sprint |

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
| `extensions/ritemark/webview/src/components/settings/RitemarkSettings.tsx` | EXTEND — add flag toggle; MUST NOT shrink below 400 lines |

## Status

**Current Phase:** Planning — Phase 1 not yet started
**Current Branch:** not yet created; target `feature/sprint-52-agent-curation-layer`
**Next Gate:** Phase 1 audit complete → Phase 2 architectural design → Jarmo approval → Phase 3 implementation begins
