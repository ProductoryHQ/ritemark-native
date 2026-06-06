# Sprint 79 Plan — Runtime Unification

**Status:** PLANNING — awaiting Jarmo approval
**Branch:** `sprint-79-runtime-unification` (create after approval)
**Estimated size:** Large (structural refactor across 5 subsystems)
**Risk:** Medium — no user-visible behavior change expected; main risk is integration regressions caught by manual testing

## What This Sprint Does

Structural refactor of the Ritemark extension's agent runtime layer. Introduces an `AgentRuntime` interface and `RuntimeRegistry` so all three runtimes (Claude Code, Codex, ACP/OpenCode) are interchangeable plugins. Collapses `UnifiedViewProvider` from 2480 to ≤1100 LOC. Fixes broken file attachments for Codex and ACP. Unifies the approval system to one message type and one UI card. Standardizes browser tool injection. Consolidates model config. Cleans up five architectural debt items. Lays the daemon scheduling foundation (inactive — Sprint 80 activates it).

## What This Sprint Does NOT Do

- No new user-visible features (except fixing file attachment support for Codex/ACP).
- No fourth runtime bundled.
- No background/OS-level daemon execution.
- No VS Code patches.
- No UI changes.

## Phase 0 — Audits (before code approval)

Three short audits must complete before implementation begins:
1. ACP browser MCP injection — can OpenCode accept MCP servers in `initialize`?
2. Codex MCP injection — can Codex receive MCP server list at session start?
3. `@agentclientprotocol/sdk` esbuild bundleability.

These answer the two open implementation paths (browser injection Path A vs Path B) and clear ARCH-1.

## Phase 1 → Phase 7 (standard SDD track)

Follows the standard sprint-manager phases:

| Phase | Content |
|---|---|
| Phase 0 | Audits (above) |
| Phase 1 | Spec + tech plan + scenarios (this doc — DONE) |
| Phase 2 | **Jarmo approval gate** |
| Phase 3 | Implementation (W1→W7, see tasks.md) |
| Phase 4 | Integration testing (S1–S11, see scenarios.md) |
| Phase 5 | QA gate (`qa-validator`, pre-commit hook, LOC check) |
| Phase 6 | PR + merge |
| Phase 7 | Architecture doc update (R9 — mandatory deliverable) |

## Architectural Decisions Made

These are locked for this sprint. Changes require Jarmo sign-off:

| Decision | Rationale |
|---|---|
| Adapter pattern (not protocol unification) | Preserve existing runtime internals; minimize regression risk |
| `UnifiedAttachment` in `runtime/` layer | Single source of truth for attachment types; adapters convert to native |
| Daemon is inactive in Sprint 79 | UI wiring is Sprint 80 scope; foundation only this sprint |
| Approval gate uses Promise-based pending Map | Matches existing pattern in `src/acp/` and `src/codex/` |
| Codex browser Path A preferred | Reduces code duplication; contingent on audit |

## Open Questions (require Jarmo input)

| Q | Question | Default if Jarmo unavailable |
|---|---|---|
| Q4 | Clean break on message rename (`agent-execute` replaces `ai-execute-agent` etc.) vs migration period? | Clean break (no migration window) — conversation history is reset on upgrade anyway |

## Definition of Done

- [ ] All tasks in `tasks.md` checked
- [ ] All scenarios in `scenarios.md` pass (manual + automated)
- [ ] `UnifiedViewProvider.ts` ≤ 1100 LOC
- [ ] `qa-validator` passes
- [ ] `docs/development/architecture.md` updated (Last updated = sprint close date)
- [ ] PR merged to `main`
