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

- [ ] CLAUDE.md ≤ 1700 words (target 1500)
- [ ] MEMORY.md ≤ 60 lines
- [ ] release-manager.md ≤ 1700 words; new `release` skill exists
- [ ] All 5 skills have YAML frontmatter (`name`, `description`)
- [ ] flow-testing skill is description-activatable (frontmatter present)
- [ ] No agent file contains "Invoke X agent" subagent-delegation instruction
- [ ] Hardcoded `/Users/jarmotuisk/Projects/ritemark-native` removed from CLAUDE.md and MEMORY.md build sections; `$CLAUDE_PROJECT_DIR` (with pwd fallback) used
- [ ] Worktree context hook fires on session start, prints branch + worktree path
- [ ] `pre-commit-validator.sh` is the single runtime invariant gate (no duplicated checks in agent prompts)
- [ ] Sprint-manager prompt has Sprint Sizing section with lightweight criteria
- [ ] Worktree dry-run: build paths resolve correctly when run from a `git worktree add` location

## Implementation Tracks (10 commits, dependency-ordered)

| # | Track | Description | Commit subject |
|---|---|---|---|
| 1 | A | Replace hardcoded paths with `$CLAUDE_PROJECT_DIR` (CLAUDE.md, MEMORY.md) | `refactor(harness): replace hardcoded paths with $CLAUDE_PROJECT_DIR` |
| 2 | J | New `worktree-context.sh` hook + settings.json wiring | `feat(harness): worktree context injection hook` |
| 3 | C | Remove dead "invoke other agent" delegation from all agent files | `refactor(agents): remove dead "invoke other agent" delegation` |
| 4 | H | Add `flow-testing` frontmatter, normalize skill spec compliance | `fix(skills): add flow-testing frontmatter, normalize spec` |
| 5 | F-skill | New `.claude/skills/release/SKILL.md` (procedural commands + gotchas) | `feat(skills): split release-manager — new release skill` |
| 6 | D | MEMORY.md cleanup: move procedural knowledge to skills | `refactor(memory): move procedural knowledge to skills` |
| 7 | I | Add `## Gotchas` sections across skills | `feat(skills): add Gotchas sections` |
| 8 | F-agent | Trim `release-manager.md` to workflow + gates (~1500 words) | `refactor(release-manager): trim to workflow + gates` |
| 9 | B | Consolidate invariants — pre-commit hook is single source | `refactor(invariants): consolidate to pre-commit hook` |
| 10 | E + G | Trim CLAUDE.md + sprint-manager lightweight mode | `refactor(harness): trim CLAUDE.md, add sprint lightweight mode` |

## Status

**Current Phase:** 3 (Develop)
**Approval Required:** No (Phase 2→3 cleared via ExitPlanMode 2026-05-04)
**Gate:** Clear

## Approval

- [x] Jarmo approved this sprint plan (via ExitPlanMode, 2026-05-04)
