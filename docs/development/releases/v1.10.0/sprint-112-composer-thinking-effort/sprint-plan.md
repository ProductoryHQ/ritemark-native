# Sprint 112 — Composer Thinking Effort

**Track:** Full SDD, audit-first<br>
**Status:** Complete — final endpoint polish in PR review<br>
**Branch:** `codex/sprint-112-composer-thinking-effort`<br>
**Worktree:** `.worktrees/sprint-112-composer-thinking-effort`<br>
**Issue:** [#206](https://github.com/ProductoryHQ/ritemark-native/issues/206)<br>
**PRs:** [#215](https://github.com/ProductoryHQ/ritemark-native/pull/215), [#216](https://github.com/ProductoryHQ/ritemark-native/pull/216), [#219](https://github.com/ProductoryHQ/ritemark-native/pull/219), [#220](https://github.com/ProductoryHQ/ritemark-native/pull/220)<br>
**Release:** [v1.10.0](../release-plan.md)

## Goal

Put a truthful, accessible thinking-effort control in the Agent Chat Composer and apply each accepted turn’s choice through the shared runtime contract to Claude, Codex, and capability-advertising OpenCode sessions.

## Why this is a separate sprint

Thinking effort crosses Composer UX, durable conversation state, queue semantics, the typed webview↔host boundary, `AgentRuntime`, and three provider protocols. It depends on the exact runtime versions established by Sprint 111 and deserves its own capability audit, UX gate, regression matrix, branch, and PR.

## In Scope

- Canonical Auto/Low/Medium/High/Extra/Max/Ultra vocabulary with capability-filtered options.
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

- [x] Claude and Codex users can choose effort beside the Composer’s model/mode controls.
- [x] Auto sends no initial override and restores warm defaults; explicit levels reach the correct measured runtime API.
- [x] Only supported levels are selectable; invalidation and provider downgrade are disclosed.
- [x] Queued/running turns retain their own snapshots; conversations and runtimes do not share effort state or notices.
- [x] OpenCode remains lazy and exposes only ACP-advertised thought levels.
- [x] Native accessible controls, reduced motion, minimum width, and 200% zoom contracts pass.
- [x] Flag-off preserves conversations and restores provider defaults.
- [x] Architecture, docs, release evidence, and tracker are current; issue #206 closes with the sprint PR.

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

## Validation Evidence

- `./scripts/validate-qa.sh` passes, including runtime-manifest validation, pre-commit checks, patched VS Code native TypeScript, and targeted agent lifecycle tests.
- Extension compile/bundle, webview typecheck/production bundle, full conversation regression suite, canonical effort tests, model-catalog resolver tests, and all three runtime adapter suites pass.
- RunDev in `ritemark-demo` passes native range drag and arrow keys, Auto, Escape/focus return, flag-off omission, 300px collision, normal width, and 200% geometry. Release evidence is stored as `docs/releases/v1.10.0/screenshots/1-10-0-thinking-effort.png`.
- Independent risk-first review found and fixed three contained issues before close: explicit live Auto-only capability precedence, stale-turn callback isolation, and cross-conversation notice isolation. No P0–P3 findings remain.
- The post-merge Codex review identified four follow-up defects now covered by regression tests: rapid range writes are atomic, queued turns no longer overwrite the current draft effort, Codex model IDs are centralized, and rejected warm Claude overrides reset to Auto without dropping the accepted message.
- Review-polish RunDev confirms the approved control at a compact 28 px visible track/26 px thumb while retaining a 40 px native drag target; the filled track and stop geometry follow the real thumb centers, forming one continuous indigo envelope around the thumb at both endpoints.
- Final user-approved endpoint polish places the thumb's 2 px accent-ring edge flush with the visual track at Low and Max, extends non-maximum progress 8 px beyond the thumb center, and refreshes the single Sprint 112 release screenshot from the final live bundle.
- PR #220 Codex review found one P3 singleton-capability geometry edge case; the centered zero-range state now has a focused regression test registered in `test:thinking-effort`, and the official QA gate passes after the fix.
- The broad legacy `npm test` command still reaches the pre-existing bare-Node Claude Flow integration harness failure where `AgentRunner` transitively resolves `vscode`; the same import chain exists on `origin/main`. Sprint 112’s official QA and every affected focused suite pass.

## Product Decisions

| Date | Decision | Rationale |
|---|---|---|
| 2026-08-22 | Add thinking effort as Sprint 112 under v1.10.0 | User expects the control in Composer; existing conversation sprints should not absorb a new cross-runtime feature. |
| 2026-08-22 | Sprint 111 is a hard dependency | Runtime/model capability must be measured against the versions that ship. |
| 2026-08-22 | Auto is default and manual values are capability-filtered | Preserves provider defaults and avoids fake parity. |
| 2026-08-22 | Claude/Codex first-class, OpenCode capability-driven | ACP/BYOK providers do not guarantee one universal effort vocabulary. |
| 2026-08-22 | Per-turn snapshot, per-runtime conversation preference | Matches Composer intent and prevents queue/concurrency surprises. |
| 2026-08-22 | Experimental/default-on kill switch | Large cross-boundary UX change remains reversible without deleting data. |
| 2026-08-23 | Advance kickoff approval recorded | Branch creation remains dependency-gated on Sprint 111 merge; capability/mapping/design approval is still a separate Phase 0 decision. |
| 2026-08-24 | Recommend capability-filtered Ultra | Exact Codex 0.149.0 metadata advertises `ultra` above `max` for Sol and Terra; hiding or coercing it would make the shared vocabulary misleading. |
| 2026-08-24 | Define warm Auto as restoration of the captured runtime default | Codex effort is sticky across turns. Omission is correct initially, but returning from a manual override must restore the effective default rather than leave the old manual value active. |
| 2026-08-24 | Preserve OpenCode lazy discovery | ACP `thought_level` is session-local; opening or selecting a conversation still performs no runtime work. |
| 2026-08-24 | Phase 0 design and capability contract approved | Approved the compact native range control, Auto below the scale, capability-filtered Ultra, warm-Auto restoration, and honest OpenCode lazy behavior. |
| 2026-08-24 | Require a review-polish PR after the delayed Codex review | The original PR merged before the bot review arrived; all four findings and final visual feedback are handled on a dedicated follow-up that must receive fresh Codex review before merge. |
| 2026-08-24 | Approve final slider endpoint geometry | The thumb itself forms the visual Low/Max endpoint; intermediate progress extends 8 px behind the thumb center, while Max remains flush with the right track edge. |

## Planning Approval

- [x] Jarmo approves Sprint 112 scope and dependency on Sprint 111 (2026-08-23).
- [x] Jarmo pre-approves branch creation after Sprint 111 merges (2026-08-23).
- [x] Phase 0 capability/mapping/design decision approved (2026-08-24).
- [x] GitHub issue #206 created and assigned to milestone v1.10.0.
