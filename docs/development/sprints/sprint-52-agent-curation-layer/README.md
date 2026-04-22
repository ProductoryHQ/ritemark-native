# Sprint 52: Agent Curation Layer

This sprint ships the first altitude of Ritemark's unified agent-management UX — the *curation layer*. It is the archaeology / hygiene surface over an accumulated mess of `.md` agent/skill files across vendors (Claude Code first, Codex `AGENTS.md` secondary, Gemini stub only).

It is not a builder. It is not a runtime. It is the thing that sits between the user and their accumulated files, helps them see what they have, and lets them deduplicate, archive, and harmonize without fear.

Focus areas:

- Auto-discovery across `.claude/agents/`, `.claude/skills/`, `.claude/commands/`, `~/.claude/`, `.agents/`, `AGENTS.md`, plugin dirs
- Unified Library view with dense sortable table, filters, segments
- Duplicate detection + side-by-side diff + explicit filesystem-op previews
- Orphan / stale flagging with reversible archive + recoverable trash
- Bulk operations with dry-run diffs and audit log
- Canonical flag in frontmatter with drift warnings
- Provenance seeding going forward (created-at, created-from, last-invocation timestamps)
- Round-trip guarantee enforced end-to-end ("Edit as markdown" escape hatch, unknown-field preservation, file-watcher for external edits)

This sprint is Viktor-only (veteran power user). Nina (newbie) onboarding and template gallery are explicitly out of scope; they belong to v1-C in a later sprint.

Strategic context lives in `docs-internal/` (gitignored):
- `insights.md`, `insights-2.md` — why this altitude
- `round-trip-guarantee.md` — the non-negotiable design principle
- `user-flows.md` — Viktor's detailed flow
- `roadmap.md` — full altitude menu

Sprint starts with an audit phase. Phase 2 → 3 approval gate is the critical one: no implementation begins until the technical plan is approved.
