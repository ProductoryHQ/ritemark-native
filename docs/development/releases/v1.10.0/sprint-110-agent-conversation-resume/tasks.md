# Sprint 110 Tasks

Implementation checklist for [technical-plan.md](./technical-plan.md). Tick `[x]` only when the artifact/code exists on branch `codex/sprint-110-agent-conversation-resume` and can be pointed to in the diff.

> **Gates:** Sprint 109 must be merged. Jarmo must approve this SDD plan. Phase 0 live protocol audit and SDD decision updates must complete before continuation implementation.

## Phase 0: Pinned runtime protocol audit (W0 — R1)

- [x] Record exact bundled Claude SDK, Codex app-server, ACP SDK, and OpenCode versions.
- [x] Claude live matrix: capture/resume, restart, invalid ID, model change, two sessions, and duplication behavior; defer authenticated auth-loss UI injection to the final post-Sprint 111 release canary.
- [x] Codex live matrix: thread resume/read, restart, invalid ID, two threads, and reconciliation behavior; defer auth-loss and binary-upgrade UI paths to Sprint 111, which changes the bundled binary.
- [x] ACP/OpenCode capability and live load/resume matrix; `session/resume` passed and `session/load` was rejected for production because it replayed history.
- [x] Cover pre-send failure, confirmed accept/no final, ambiguous accept, partial/tool/progress-only, and process-loss handoff policy in focused adapter/controller tests; defer authenticated live failure injection to the final release matrix.
- [x] Decide each runtime’s native/fallback status, descriptor codec, `coveredThroughEventId`/ambiguous-crash policy, context budget, lazy timing, and reconciliation source.
- [x] Update spec/scenarios/technical plan/sprint plan with Phase 0 decisions before Phase 1.
- [x] **Jarmo Phase 0 decision gate:** approve runtime matrix, context budget, watermark/crash semantics, and adapter scope before Phase 1.

## Phase 1: Shared continuation contract (W1 — R2, R8)

- [x] Extend `runtime/AgentRuntime.ts` / `RuntimeSessionConfig` with shared continuation request/checkpoint/state types.
- [x] Add versioned opaque descriptor codecs and compatibility validation per runtime.
- [x] Add `not-attempted`/`pending`/terminal transitions plus coverage watermark and binding-generation rules.
- [x] Persist checkpoints through ConversationController/ConversationStore; keep raw IDs out of webview messages.
- [x] Add redacted diagnostics and tests for wrong runtime/project/version/model/policy descriptors.

## Phase 2: Native same-runtime resume (W2 — R3)

- [x] Implement Phase 0-proven Claude resume and descriptor checkpoint path.
- [x] Implement Phase 0-proven Codex thread resume path without breaking shared-process routing; provider history/read never becomes transcript authority.
- [x] Implement capability-gated ACP/OpenCode `session/resume`; never call `session/load`.
- [x] Add focused native success, expired/invalid descriptor, auth/version mismatch, process restart, runtime-unavailable, two-chat, and duplicate-turn coverage; retain real binary-upgrade/auth-loss production-UI checks in the post-Sprint 111 release matrix.
- [x] Prove open/select starts no runtime/auth/network/resume work; negotiation begins only on accepted Send/explicit Continue.

## Phase 3: Transcript context fallback (W3 — R4)

- [x] Add deterministic normalized context pack builder and serialization.
- [x] Include ordered user prompts — including prior unanswered prompts — plus assistant final text; exclude tools, approvals, assistant questions awaiting input, partial/progress text, rejected plans, hidden prompts, binaries.
- [x] Implement budget/truncation preserving purpose + the most recent unanswered request + recent complete turns, with omitted-count disclosure.
- [x] Exclude the newly accepted prompt from fallback pack and dispatch it exactly once after continuation setup.
- [x] Add runtime framing, workspace-recheck instruction, durable transcript boundary, and `transcript-restored` state.
- [x] Test oversized, legacy migration, attachment exclusion, and no-usable-context paths.

## Phase 4: Explicit handoff and continuation UX (W4 — R5, R6)

- [x] Add Continue with … confirmation for non-empty runtime changes; preserve composer draft.
- [x] Maintain per-runtime descriptors and continuation binding generation under one canonical conversation ID.
- [x] Preserve a prior saved-but-unanswered prompt across runtime switch as labelled context in known-unsent, known-accepted, and ambiguous states; dispatch only the new handoff instruction once.
- [x] Inject only canonical delta after `coveredThroughEventId`; checkpoint advancement after proven acceptance and use fresh fallback on unreconciled crash ambiguity.
- [x] Add native/transcript/unavailable/runtime-unavailable inline states and accessible wording.
- [x] Reject late events from invalidated bindings and verify concurrent conversation isolation.
- [x] Live-check copy, focus, keyboard, and no false exact-memory promise; retain reduced-motion visual verification in the final release candidate matrix.

## Phase 5: Continuation-safe conversation rail (W5 — R7)

- [x] Preserve Sprint 109’s permanent 56px New / Pinned / automatic active-and-recent / All conversations rail and 40×40 selection-only safe targets.
- [x] Keep canonical conversation ID, derived rail membership, and explicit Pin state stable through native resume/fallback; prove no duplicate rail/history rows or implicit Pin/Unpin.
- [x] Verify resume/fallback/handoff preserve the shared chat-bubble visual and do not reorder Recents without real activity.
- [x] Preserve Needs you/Working aggregation on the conversation rail and All conversations button accessibly.
- [x] Preserve unlimited current-project reading/selection; active-work limits apply only at Send.
- [x] Record search/All-project/filter features as deferred follow-up scope and preserve Sprint 109 Rename behavior.

## Phase 6: QA, docs, and release feature complete (W6 — R8)

- [x] Run focused unit/integration tests for the shared contract, three adapters, controller/store, fallback pack, handoff, projection, and presentation.
- [x] Save fresh-profile Claude → Codex handoff/restart evidence and list the remaining unexercised live matrix explicitly.
- [x] Verify every checked task against branch code/diff and demote unsupported `[x]`.
- [x] Run `./scripts/validate-qa.sh` on the final Sprint 110 branch.
- [ ] Run release preflight on clean synchronized `main` after all v1.10 sprints merge.
- [x] Update `docs/development/architecture.md` with `Last updated` on/after branch creation date, plus user docs, `docs/CHANGELOG.md`, v1.10.0 release notes and test checklist.
- [x] Run the Sprint 110 fresh-profile migration+resume canary and retain three release screenshots.
- [x] Update the release tracker and Sprint 110 issue #204 with PR #211, QA, review, and explicit release-matrix deferrals.
- [ ] Commit, push, PR, review, merge; mark release Feature complete only when all exceptions are deferred explicitly.

## Phase 7: Lightweight runtime switch disclosure (W7 — R9, added 2026-08-23)

- [x] Remove the runtime-switch confirmation dialog and apply the selected runtime immediately without touching the composer draft.
- [x] Stop active prior work through the existing cancellation route; keep selection-only changes runtime/network-lazy.
- [x] Replace the duplicate transcript-restored banner with one compact durable boundary between prior and next turns; retain actionable unavailable notices.
- [x] Update focused tests, production webview bundle, release copy/checklist, and rundev smoke evidence.
- [x] Rerun official QA and re-review the final diff.

## Explicit Release-Matrix Deferrals

Sprint 110 closes with deterministic policy paths covered in focused tests and a live Claude → Codex fallback/restart canary. The following environment-dependent checks remain visible in the release checklist rather than being claimed as Sprint 110 evidence:

- authenticated native semantic recall for every runtime after Sprint 111 changes the bundled runtime pins;
- auth-loss/runtime-unavailable and ambiguous post-transport crash injection through the production UI;
- OpenCode/ACP authenticated production-UI restart; and
- reduced-motion visual verification on the final release candidate.
