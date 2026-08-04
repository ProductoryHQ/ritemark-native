# Sprint 103 — Truthful Agent Plans and Activity State

**Status:** SDD artifacts drafted (2026-08-03) — awaiting Jarmo's approval before branch/implementation  
**Parent release:** [v1.8.6](../release-plan.md)  
**GitHub milestone:** [v1.8.6](https://github.com/ProductoryHQ/ritemark-native/milestone/7)  
**Branch:** `sprint-103-agent-truth` (not yet created — created on approval)  
**Track:** SDD — cross-runtime safety and lifecycle behavior  
**Delivery tier:** Extension

## SDD Artifacts

- [research/plan-truth-audit.md](./research/plan-truth-audit.md) — evidence base: code audit + docs verification + **live reproduction** with screenshots and debug traces (findings F1–F12).
- [spec.md](./spec.md) is the product and behavior contract (R1–R9).
- [scenarios.md](./scenarios.md) captures behavior examples and is the manual QA matrix; ★ scenarios are the automated regression set.
- [technical-plan.md](./technical-plan.md) records the architecture (workstreams W0–W7).
- [design.md](./design.md) — mode control, plan review card, and activity status design in the Indigo-Editorial system.
- [tasks.md](./tasks.md) is the implementation checklist.

## Key Findings (from the live audit — why this sprint matters)

Reproduced on 2026-08-03 in the dev instance (full detail + evidence in the audit):

1. **The Plan button does not put Claude in plan mode.** The session runs `bypassPermissions`; the model's `ExitPlanMode` fails with a harness error, the drafted plan is silently lost, and the plan card appears only if the model *accidentally recovers* by calling `EnterPlanMode` itself. This is the exact "sometimes shows a plan, sometimes doesn't respond" experience.
2. **Auto mode plans and blocks without saying so.** Our own always-on turn reminder nudges Claude into planning; in Auto mode this produced a *blocking* plan-approval card — the inverse of "acts without asking".
3. **Nothing blocks writes during Claude "planning"** — a `Write` executed before any approval in the repro.
4. The bundled SDK natively provides everything needed (enforced `permissionMode: 'plan'`, live `setPermissionMode`, plan-approval mode transitions) — currently unused.
5. Codex plan flow works but plan turns run in a writable sandbox, and structured plan events cannot be relied on (0 events in the live run).
6. OpenCode's Plan button changes nothing (identical to Ask).
7. "Done in 662s" counted ~5 min of waiting for the human; "Modified 6 files" counted non-workspace writes; the approved-plan banner showed the result text as the plan.

## Product Decisions Needed (before implementation)

| # | Decision | Recommendation | Status |
| --- | --- | --- | --- |
| D1 | Autonomy vocabulary in the UI | Manual review / Work automatically | **Decided 2026-08-04 (Jarmo): "Manual" / "Auto"** — shorter labels win; descriptions carry the nuance |
| D2 | Plan chip: one-turn action or session state? | Session state; resets after approve/cancel | **Decided 2026-08-04 (Jarmo): chip is labeled "Plan"; stays on until a plan is Approved, then auto-resets.** Cancel/discard does NOT reset it (no approved plan yet); manual toggle always available |
| D3 | OpenCode Plan control: hidden or disabled-with-tooltip? | Hidden | **Decided 2026-08-04 (Jarmo): hidden** |
| D4 | Remove prompt-text mode sniffing ("enter plan mode" no longer flips modes)? | Yes — the Plan chip is the explicit path | **Decided 2026-08-04 (Jarmo): remove** |
| D5 | Claude Auto backend moves from `bypassPermissions` to `acceptEdits` + auto-allow (required for enforceable Plan; behaviorally equivalent for our tool surface) | Yes | **Decided 2026-08-04 (Jarmo): switch** |

## Goal

Make Plan, approval, and activity status truthful across Claude, Codex, and OpenCode so the UI never promises a safety mode or a “Done” state that the active runtime cannot actually guarantee.

## Release Outcome

Users choose a clear autonomy policy, invoke Plan first only where it is genuinely supported, review a stable plan before execution, and can distinguish finished turns from ongoing background work or human-review waits.

## Linked Issues

- [#132](https://github.com/ProductoryHQ/ritemark-native/issues/132) — truthful compact approval/Plan controls.
- [#161](https://github.com/ProductoryHQ/ritemark-native/issues/161) — truthful background-work and completion state. Completed #140 stays closed.

## In Scope

- Define separate internal concepts for autonomy/approval policy and plan-first collaboration.
- Audit the bundled versions of Claude, Codex, and OpenCode against their actual native capabilities.
- Use native plan mechanisms where available; do not rely on a prompt-only no-write promise.
- Hide Plan for a runtime that cannot provide an enforceable plan/review contract.
- Replace the three-button `Auto / Ask / Plan` strip with a compact, capability-aware control after semantics are fixed.
- Provide stable Plan review actions: **Approve and continue**, **Keep planning**, and **Cancel**.
- Define a conversation activity state model that distinguishes running, waiting for approval, waiting for user input, background work, completed turn, cancelled, and failed.
- Replace misleading global “Done” wording when the client cannot prove all background work is finished.
- Preserve conversation scoping and parallel-session isolation.

## Explicitly Out of Scope

- Adding a fourth runtime.
- Runtime-specific approval message types or approval gates.
- Inventing background activity when the runtime provides no authoritative signal.
- Global prompt queueing; that belongs to Sprint 104.
- Comments overview and batch dispatch; that belongs to Sprint 105.

## Deliverables

1. Approved runtime capability/behavior matrix.
2. Enforced Plan-first contract per supported runtime.
3. Compact capability-aware autonomy/Plan UI closing #132.
4. Shared activity-state contract and truthful status presentation.
5. Cross-runtime scenario suite and dev-mode evidence.

## Architecture and Feature Flags

- Preserve the three `AgentRuntime` adapters and `UnifiedApprovalGate`; do not add runtime-specific approval contracts.
- Any `AgentRuntime`, `RuntimeSession`, lifecycle event, or webview message-contract change requires an update to [architecture.md](../../../architecture.md).
- No new feature flag is expected for safety corrections. If a new lifecycle signal is runtime-dependent or experimental, define one flag in `src/features/flags.ts` rather than ad hoc runtime checks.
- All model identifiers remain in `src/ai/modelConfig.ts` / the shared catalog.

## Definition of Done

- [ ] Every visible mode has documented, tested semantics for every runtime that exposes it.
- [ ] Claude and Codex Plan flows produce a reviewable plan and cannot write before approval.
- [ ] OpenCode does not display Plan unless an enforceable native contract is proven.
- [ ] Approve, refine, cancel, timeout, failure, and runtime-switch scenarios are covered.
- [ ] The UI distinguishes turn completion from outstanding authoritative background work.
- [ ] If no global background signal exists, wording reports only what is known instead of claiming all work is done.
- [ ] A conversation’s status cannot overwrite another parallel conversation.
- [ ] #132 is closed only after runtime semantics and compact UI both pass.
- [ ] Architecture and user documentation are updated where behavior/contracts changed.

## Validation

- Unit tests for mode mapping, no-write enforcement, lifecycle transitions, and conversation scoping.
- Live dev-mode matrix for Claude, Codex, and OpenCode: plan, refine, approve, cancel, failure, approval wait, and concurrent conversations.
- Screenshot evidence for compact control, plan review, waiting states, background state, and true completion.
- Run `./scripts/validate-qa.sh` before readiness handoff.

## Dependencies and Blockers

- Sprint 102 is not a code dependency; its disclosure vocabulary should be reused where appropriate.
- Sprint 104 depends on this sprint’s authoritative “ready for next turn” definition.
- Background truth may be limited by upstream runtime events; Phase 0 must prove available signals before promising a new indicator.

## Risks

- Claude Plan currently relies on prompt convention while using permissive execution settings; this is a safety-critical regression risk.
- Recreating sessions to change policy can lose runtime context; tests must cover same-mode reuse and policy switches.
- “Done” can refer to a turn, session, subprocess, or subagent; the UI must label the exact scope rather than collapse them.

## Approval Gate

- [x] Jarmo approved this sprint scope on 2026-08-03.
- [x] SDD artifacts authored (2026-08-03): audit, spec, scenarios, technical plan, design, tasks.
- [x] Jarmo answered decisions D1–D5 (2026-08-04) and approved implementation start ("tee rundev … tõesta et kõik valmis", 2026-08-04) with dev-mode proof required before handoff.
- [x] #132 and #161 are assigned to the v1.8.6 milestone.
- [x] Sprint branch `sprint-103-agent-truth` created 2026-08-04; no product code changes on `main`.
