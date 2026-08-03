# Sprint 103 — Truthful Agent Plans and Activity State

**Status:** Approved — SDD artifacts required before implementation  
**Parent release:** [v1.8.6](../release-plan.md)  
**GitHub milestone:** [v1.8.6](https://github.com/ProductoryHQ/ritemark-native/milestone/7)  
**Branch:** `sprint-103-agent-truth`  
**Track:** SDD recommended — cross-runtime safety and lifecycle behavior  
**Delivery tier:** Extension

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
- [ ] Author and obtain approval for the SDD artifacts before implementation.
- [x] #132 and #161 are assigned to the v1.8.6 milestone.
- [ ] Create the sprint branch only after approval; no product code changes on `main`.
