# Sprint 103 Tasks

Implementation checklist for [technical-plan.md](./technical-plan.md). Tick `[x]` only when the change exists on branch `sprint-103-agent-truth` (see SDD discrepancy rules). Requirement IDs from [spec.md](./spec.md).

> **Gate:** Phases 1+ start only after Jarmo approves the sprint plan AND `git checkout -b sprint-103-agent-truth` exists. Phase 0 spikes are read-only research permitted pre-branch.

## Phase 0: Audit spikes (W0)

- [x] Write `research/spikes/sdk-plan-mode-spike.mjs` — streaming session against bundled CLI; assert ExitPlanMode→canUseTool in `plan` mode, mutating-tool routing + denial survival, `updatedPermissions setMode` transition, `setPermissionMode` context retention (R2, R3)
- [x] Run spike, append results to `research/plan-truth-audit.md` §6
- [ ] OpenCode spike: keyed profile, log `session/new` modes of bundled OpenCode 1.18.4; record in audit §6 (R6) — *deferred: automation profile has no BYOK keys; not a blocker (Plan stays hidden for OpenCode regardless)*
- [x] If any spike contradicts the audit's conclusions → STOP (none did — all asserts confirmed the plan)

## Phase 1: Claude permission-mode rework (W1 — R2, R3, R4)

- [x] `runtime/AgentRuntime.ts`: add `TurnPolicy` type; extend `RuntimeSessionConfig`/`RuntimeTurnConfig` (compat mapping documented in code comment)
- [x] `agent/AgentRunner.ts`: `_sdkModeFor(policy)` mapping (plan/acceptEdits/default); delete `bypassPermissions` + `allowDangerouslySkipPermissions`
- [x] `agent/AgentRunner.ts`: remove `ExitPlanMode` from SDK `allowedTools`; add `planModeInstructions` (Ritemark plan voice)
- [x] `agent/AgentRunner.ts`: `_handleCanUseTool` — plan-phase mutating-tool denial; approve → `updatedPermissions setMode`; reject → feedback deny, stay in plan; `work-automatically` auto-allow fallthrough
- [x] `agent/AgentRunner.ts`: strip plan lines from `CLAUDE_LIFECYCLE_APPEND` / `CLAUDE_TURN_REMINDER`; emit `plan_autonomous` progress on model-initiated EnterPlanMode
- [x] `agent/ClaudeCodeRuntime.ts`: `applyConfig` uses `setPermissionMode` (no Ask-boundary rebuild); `session_reset` progress on genuine rebuild; delete `CLAUDE_PLAN_TURN_REMINDER`
- [x] `agent/AgentRunner.test.ts`: mapping table, approval payloads, plan-phase denial, no-dangerous-flag regression (R9)
- [x] `views/UnifiedViewProvider.ts`: map webview mode → `TurnPolicy`; wait-span metrics passthrough

## Phase 2: Mode control UI (W6 — R8)

- [x] `webview …/ChatInput.tsx`: replace 3-button strip with autonomy Select + Plan-first chip per design.md §1
- [x] `webview …/store.ts`: `TurnPolicy` selectors over stored `'auto'|'ask'|'plan'`; migration mapping (`plan`→work-automatically+planFirst); Plan-chip auto-reset on APPROVAL-only reducer (D2)
- [x] Remove `shouldRequestPlanMode` prompt sniffing (webview) (R1)
- [x] Unit tests: migration + reset semantics (`activityState.test.ts` policyOf block); capability-driven *rendering* is covered by the live matrix, not a component unit test

## Phase 3: Plan review surface + transcript truth (W4 — R4, F11, F12)

- [x] Merge `AgentPlanApproval.tsx` into unified `PlanReviewCard.tsx` per design.md §2 (rendered markdown body, provenance line, sticky footer, Keep-planning feedback row)
- [x] Autonomous-plan chip ("Claude chose to plan first") from `plan_autonomous` (R4)
- [ ] Resolved-card collapse pattern for plan + question cards (F12) — *deferred: plan decisions already leave a transcript note ("Plan approved" / "sent back"); full question-history persistence moved to backlog*
- [x] `lifecycle.ts`: `getActiveApprovedPlanForClaude` returns plan text, never result text; Codex banner step statuses (structuredPlanSteps)
- [x] Claude "Keep planning" path wired end-to-end (feedback → deny-with-message → revised card)

## Phase 4: Codex plan hardening (W2 — R5)

- [x] `codex/CodexRuntime.ts`: plan-first → sandbox `read-only`; reset key extended with plan flag; continuation restores write sandbox
- [x] Remove `shouldStartCodexInPlanMode` (R1)
- [x] `buildCodexKeepPlanningPrompt` + wiring for Keep planning
- [ ] `codexApproval.test.ts` additions — *deferred: read-only plan thread + write continuation live-verified in the matrix (trace-asserted); unit coverage tracked as follow-up*

## Phase 5: Capability map + OpenCode gating (W3 — R6)

- [x] New `runtime/capabilities.ts` registry; delivered via agent config message
- [x] Webview consumes capability map (no hardcoded runtime ids); OpenCode hides Plan-first (or D3 alternative); mid-thread runtime switch deactivates chip with notice
- [x] `AcpRuntime` never receives `planFirst` — gated host-side in UnifiedViewProvider via `capabilitiesFor()` (stronger than an adapter assert)

## Phase 6: Truthful activity state (W5 — R7, #161)

- [x] `webview …/activityState.ts`: `deriveActivityState` single source; `threadStatus.ts` refactors onto it (rail contract unchanged — Sprint 99 tests stay green)
- [x] Status line component per design.md §3; "Done" summary only in `done`
- [x] `AgentRunner`: `waitedMs` metric (pending-card open→close spans); UI headline = active time
- [x] Workspace-filtered `filesModified` (host-side)
- [x] `activityState.test.ts` (transitions, duration math, file filtering)

## Phase 7: QA and closeout (W7 — R9)

- [x] `scripts/qa/plan-truth-matrix.sh` — CDP matrix run (★ scenarios): Claude plan / Claude autonomous-plan / Codex plan / OpenCode gating; screenshots to `research/screenshots/`, assertions on traces + workspace md5s
- [x] Run focused unit tests + full webview/extension test suites
- [x] Dev-mode validation walked by Claude 2026-08-04 (CDP-driven ★ scenarios + dark-mode pass; evidence in `research/screenshots/v2-*.png`); Jarmo's own Gate walk still pending
- [ ] Run `./scripts/validate-qa.sh`
- [ ] Update `docs/user/features/ai-agents.md` (mode vocabulary, plan flow)
- [ ] Update `docs/CHANGELOG.md` + `docs/releases/v1.8.6/release-notes.md` + `TEST-CHECKLIST.md`
- [ ] Update `docs/development/architecture.md` (mode model, capabilities registry)
- [ ] Update release-plan tracker row + issues #132/#161; commit, push, PR
