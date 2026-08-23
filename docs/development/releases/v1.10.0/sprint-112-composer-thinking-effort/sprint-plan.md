# Sprint 112 — Composer Thinking Effort

**Track:** Full SDD, audit-first<br>
**Status:** Planned; depends on Sprint 111 merge<br>
**Branch after approval:** `codex/sprint-112-composer-thinking-effort`<br>
**Worktree:** Not created<br>
**Issue:** [#206](https://github.com/ProductoryHQ/ritemark-native/issues/206)<br>
**Release:** [v1.10.0](../release-plan.md)

## Goal

Put a truthful, accessible thinking-effort control in the Agent Chat Composer and apply each accepted turn’s choice through the shared runtime contract to Claude, Codex, and capability-advertising OpenCode sessions.

## Why this is a separate sprint

Thinking effort crosses Composer UX, durable conversation state, queue semantics, the typed webview↔host boundary, `AgentRuntime`, and three provider protocols. It depends on the exact runtime versions established by Sprint 111 and deserves its own capability audit, UX gate, regression matrix, branch, and PR.

## In Scope

- Canonical Auto/Low/Medium/High/Extra/Max vocabulary with capability-filtered options.
- Composer footer trigger and anchored discrete popover based on [design.md](./design.md).
- Per-conversation/per-runtime draft preference and per-accepted-turn snapshot.
- Typed host capability and turn contract; unknown-value validation.
- Claude SDK effort and Codex reasoning-effort mapping on final Sprint 111 pins.
- ACP semantic `thought_level` support when OpenCode advertises it, without eager runtime startup.
- Queue, concurrency, model/runtime switching, reload, downgrade/rejection, accessibility, responsive, and flag-off behavior.
- Architecture, user docs, changelog, v1.10.0 release notes/test checklist, and live canary evidence.

## Explicitly Out of Scope

- Raw chain-of-thought display, thinking token budgets, or hidden-reasoning export.
- Settings-only global effort, Flows/scheduled-task effort, agent frontmatter effort, or historical backfill.
- A claim that all OpenCode BYOK provider/models expose the same levels.
- Launching a runtime on open/select, model catalog redesign, or new model IDs outside canonical config/catalog files.
- Vendor-specific copies of the Composer control.

## Deliverables

1. Approved runtime/model effort capability matrix.
2. Approved Ritemark Composer effort UX contract.
3. Shared typed effort/capability contract and default-on kill switch.
4. Durable draft and queue-time turn snapshot.
5. Claude, Codex, and capability-driven OpenCode adapters.
6. Accessibility, responsive, cross-runtime, and rollback evidence.
7. Architecture, user, release, and tracker documentation.

## Success Criteria

- [ ] Claude and Codex users can choose effort beside the Composer’s model/mode controls.
- [ ] Auto sends no explicit override; explicit levels reach the correct measured runtime API.
- [ ] Only supported levels are selectable; invalidation and provider downgrade are disclosed.
- [ ] Queued/running turns retain their own snapshots; conversations and runtimes do not share effort state.
- [ ] OpenCode remains lazy and exposes only ACP-advertised thought levels.
- [ ] Keyboard, screen reader, reduced motion, minimum width, and 200% zoom contracts pass.
- [ ] Flag-off preserves conversations and restores provider defaults.
- [ ] Architecture, docs, release evidence, tracker, and issue are current.

## Dependencies and Gates

- Sprint 111 must merge with approved final runtime pins and capability evidence.
- Sprint 109 durable conversation schema and Sprint 110 continuation/ambiguous-dispatch rules are prerequisites.
- Jarmo approves kickoff and a dedicated branch before product-code edits.
- Phase 0 ends with a second explicit Jarmo capability/mapping/design decision before shared contracts change.

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| UI promises unsupported vendor level | High | Host capability matrix; filter options; reject unknown wire values. |
| Queue or concurrent chat receives another effort | High | Snapshot before enqueue/dispatch; conversation-scoped tests. |
| Codex plan mode overwrites effort with null | High | Execute+plan contract tests against final app-server. |
| Claude silently downgrades a level | Medium | Store requested/applied values and disclose measured downgrade. |
| OpenCode capability requires eager session | High | Preserve Sprint 110 lazy-open contract; show only after live ACP evidence. |
| More effort is marketed as guaranteed quality | Medium | Faster→More thorough copy and quota/latency explanation; no “Smarter.” |
| Footer becomes crowded | Medium | Focused control, wrap contract, minimum-width and 200% zoom tests. |

## SDD Artifacts

- [spec.md](./spec.md) — behavior contract.
- [scenarios.md](./scenarios.md) — QA matrix.
- [design.md](./design.md) — Composer UX contract.
- [technical-plan.md](./technical-plan.md) — architecture and implementation design.
- [tasks.md](./tasks.md) — phase checklist.
- [research/thinking-effort-capability-audit.md](./research/thinking-effort-capability-audit.md) — Phase 0 evidence template.

## Product Decisions

| Date | Decision | Rationale |
|---|---|---|
| 2026-08-22 | Add thinking effort as Sprint 112 under v1.10.0 | User expects the control in Composer; existing conversation sprints should not absorb a new cross-runtime feature. |
| 2026-08-22 | Sprint 111 is a hard dependency | Runtime/model capability must be measured against the versions that ship. |
| 2026-08-22 | Auto is default and manual values are capability-filtered | Preserves provider defaults and avoids fake parity. |
| 2026-08-22 | Claude/Codex first-class, OpenCode capability-driven | ACP/BYOK providers do not guarantee one universal effort vocabulary. |
| 2026-08-22 | Per-turn snapshot, per-runtime conversation preference | Matches Composer intent and prevents queue/concurrency surprises. |
| 2026-08-22 | Experimental/default-on kill switch | Large cross-boundary UX change remains reversible without deleting data. |

## Planning Approval

- [ ] Jarmo approves Sprint 112 scope and dependency on Sprint 111.
- [ ] Jarmo approves branch creation.
- [ ] Phase 0 capability/mapping/design decision approved.
- [x] GitHub issue #206 created and assigned to milestone v1.10.0.
