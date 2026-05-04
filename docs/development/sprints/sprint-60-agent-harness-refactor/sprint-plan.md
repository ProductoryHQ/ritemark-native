# Sprint 60 — Agent Harness Refactor

## Goal

Holistic refactor of the Claude Code harness (CLAUDE.md, agents, skills, memory, hooks, sprint protocol) per 2026-05-03 audit findings. Apply agentskills.io and Anthropic May 2026 best practices. No product code changes.

## Source documents

- **Charter:** [`docs-internal/analysis/2026-05-03-agent-harness-refactor/charter.md`](../../../../docs-internal/analysis/2026-05-03-agent-harness-refactor/charter.md)
- **Audit:** [`docs-internal/analysis/2026-05-03-agent-harness-refactor/audit.md`](../../../../docs-internal/analysis/2026-05-03-agent-harness-refactor/audit.md) — 435 lines, 10 prioritized findings
- **Approved plan:** `~/.claude/plans/typed-bubbling-whale.md` (this session)

## Decisions (Jarmo, 2026-05-04)

1. All 10 audit recommendations bundled into one sprint
2. Keep 6-phase workflow, add lightweight track for small sprints (single-domain, < 200 LOC, no new deps, no new flag, bug fix / refactor)
3. Split release-manager agent → trimmed agent (~1500 words: workflow + Gate 1/Gate 2) + new `release` skill (procedural commands + gotchas)

## Feature Flag Check

- [x] No feature flag needed — harness/docs only, no runtime feature gating

## Success Criteria

- [x] CLAUDE.md ≤ 1700 words (target 1500) — currently 1192
- [x] MEMORY.md ≤ 60 lines — currently 30
- [x] release-manager.md ≤ 1700 words; new `release` skill exists
- [x] All 6 skills have YAML frontmatter (`name`, `description`)
- [x] flow-testing skill is description-activatable (frontmatter present)
- [x] No agent file contains "Invoke X agent" subagent-delegation instruction
- [x] Hardcoded `/Users/jarmotuisk/Projects/ritemark-native` removed from CLAUDE.md and MEMORY.md build sections; `$CLAUDE_PROJECT_DIR` (with pwd fallback) used
- [x] Worktree context hook fires on session start, prints branch + worktree path
- [x] `pre-commit-validator.sh` is the single runtime invariant gate (no duplicated checks in agent prompts)
- [x] Sprint-manager prompt has Sprint Sizing section with lightweight criteria
- [x] Worktree dry-run: build paths resolve correctly when run from a `git worktree add` location *(PROJECT_DIR derived from `${CLAUDE_PROJECT_DIR:-$(pwd)}` in build skills + hook script location fallback in pre-commit-validator)*

## Implementation Tracks

| # | Track | Description | Status |
|---|---|---|---|
| 1 | A | Replace hardcoded paths with `$CLAUDE_PROJECT_DIR` (CLAUDE.md, MEMORY.md) | Done — CLAUDE.md trim (track E+G) removed the only hardcoded path; MEMORY.md restructured to use `${CLAUDE_PROJECT_DIR:-$(pwd)}` |
| 2 | J | New `worktree-context.sh` hook + settings.json wiring | Done — `chore(.claude): refresh agents, skills, and harness hooks` |
| 3 | C | Remove dead "invoke other agent" delegation from all agent files | Done — same harness commit |
| 4 | H | Add `flow-testing` frontmatter, normalize skill spec compliance | Done — same harness commit |
| 5 | F-skill | New `.claude/skills/release/SKILL.md` (procedural commands + gotchas) | Done — same harness commit |
| 6 | D | MEMORY.md cleanup: move procedural knowledge to skills | Done — MEMORY.md down to 30 lines (was 200+); build/release/Node-version content moved into `vscode-development` and `release` skills |
| 7 | I | Add `## Gotchas` sections across skills | Done — same harness commit |
| 8 | F-agent | Trim `release-manager.md` to workflow + gates (~1500 words) | Done — same harness commit |
| 9 | B | Consolidate invariants — pre-commit hook is single source | Done — `refactor(sprint-60): consolidate invariants behind pre-commit hook (track B)`; added Patches Applied + Settings page integrity checks; CLAUDE.md table dropped |
| 10 | E + G | Trim CLAUDE.md + sprint-manager lightweight mode | Done — `refactor(sprint-60): trim CLAUDE.md (track E+G)` |

## Status

**Current Phase:** Phase 4 — Validation complete (all 10 tracks shipped)
**Approval Required:** No (Phase 2→3 cleared via ExitPlanMode 2026-05-04)
**Gate:** Clear

All 10 audit recommendations landed. Ready for `qa-validator` and merge.

## Approval

- [x] Jarmo approved this sprint plan (via ExitPlanMode, 2026-05-04)
