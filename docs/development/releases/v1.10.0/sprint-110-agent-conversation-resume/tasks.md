# Sprint 110 Tasks

Implementation checklist for [technical-plan.md](./technical-plan.md). Tick `[x]` only when the artifact/code exists on branch `codex/sprint-110-agent-conversation-resume` and can be pointed to in the diff.

> **Gates:** Sprint 109 must be merged. Jarmo must approve this SDD plan. Phase 0 live protocol audit and SDD decision updates must complete before continuation implementation.

## Phase 0: Pinned runtime protocol audit (W0 — R1)

- [ ] Record exact bundled Claude SDK, Codex app-server, ACP SDK, and OpenCode versions.
- [ ] Claude live matrix: capture/resume, restart, invalid ID, auth loss, model change, two sessions, duplication behavior.
- [ ] Codex live matrix: thread resume/read, restart, invalid ID, auth loss, binary upgrade, two threads, reconciliation behavior.
- [ ] ACP/OpenCode capability and live load/resume matrix; mark fallback-only unless advertised behavior is proven.
- [ ] For each runtime, switch away after pre-send failure, confirmed accept/no final, ambiguous accept, partial/tool/progress only, and process loss; verify the prior saved user prompt reaches the next runtime as labelled context and late events stay isolated.
- [ ] Decide each runtime’s native/fallback status, descriptor codec, `coveredThroughEventId`/ambiguous-crash policy, context budget, lazy timing, and reconciliation source.
- [ ] Update spec/scenarios/technical plan/sprint plan with Phase 0 decisions before Phase 1.
- [ ] **Jarmo Phase 0 decision gate:** approve runtime matrix, context budget, watermark/crash semantics, and adapter scope before Phase 1.

## Phase 1: Shared continuation contract (W1 — R2, R8)

- [ ] Extend `runtime/AgentRuntime.ts` / `RuntimeSessionConfig` with shared continuation request/checkpoint/state types.
- [ ] Add versioned opaque descriptor codecs and compatibility validation per runtime.
- [ ] Add `not-attempted`/`pending`/terminal transitions plus coverage watermark and binding-generation rules.
- [ ] Persist checkpoints through ConversationController/ConversationStore; keep raw IDs out of webview messages.
- [ ] Add redacted diagnostics and tests for wrong runtime/project/version/model/policy descriptors.

## Phase 2: Native same-runtime resume (W2 — R3)

- [ ] Implement Phase 0-proven Claude resume and descriptor checkpoint path.
- [ ] Implement Phase 0-proven Codex thread resume/read path without breaking shared-process routing.
- [ ] Implement ACP/OpenCode load/resume only if proven; otherwise encode fallback-only capability explicitly.
- [ ] Add native success, expired, invalid, auth loss, process restart, runtime unavailable, upgrade, two-chat, and duplicate-turn tests.
- [ ] Prove open/select starts no runtime/auth/network/resume work; negotiation begins only on accepted Send/explicit Continue.

## Phase 3: Transcript context fallback (W3 — R4)

- [ ] Add deterministic normalized context pack builder and serialization.
- [ ] Include ordered user prompts — including prior unanswered prompts — plus assistant final text; exclude tools, approvals, assistant questions awaiting input, partial/progress text, rejected plans, hidden prompts, binaries.
- [ ] Implement budget/truncation preserving purpose + the most recent unanswered request + recent complete turns, with omitted-count disclosure.
- [ ] Exclude the newly accepted prompt from fallback pack and dispatch it exactly once after continuation setup.
- [ ] Add runtime framing, workspace-recheck instruction, durable transcript boundary, and `transcript-restored` state.
- [ ] Test oversized, malformed, legacy, attachment, and no-usable-context paths.

## Phase 4: Explicit handoff and continuation UX (W4 — R5, R6)

- [ ] Add Continue with … confirmation for non-empty runtime changes; preserve composer draft.
- [ ] Maintain per-runtime descriptors and continuation binding generation under one canonical conversation ID.
- [ ] Preserve a prior saved-but-unanswered prompt across runtime switch as labelled context in known-unsent, known-accepted, and ambiguous states; dispatch only the new handoff instruction once.
- [ ] Inject only canonical delta after `coveredThroughEventId`; checkpoint advancement after proven acceptance and use fresh fallback on unreconciled crash ambiguity.
- [ ] Add native/transcript/unavailable/runtime-unavailable inline states and accessible wording.
- [ ] Reject late events from invalidated bindings and verify two concurrent handoffs.
- [ ] Live-check copy, focus, keyboard, reduced motion, and no false exact-memory promise.

## Phase 5: Continuation-safe conversation rail (W5 — R7)

- [ ] Preserve Sprint 109’s permanent 56px New / Pinned / automatic active-and-recent / All conversations rail and 40×40 selection-only safe targets.
- [ ] Keep canonical conversation ID, derived rail membership, and explicit Pin state stable through native resume/fallback; prove no duplicate rail/history rows or implicit Pin/Unpin.
- [ ] Verify resume, fallback, restart, and handoff preserve the shared chat-bubble visual and do not reorder Recents without real activity.
- [ ] Aggregate Needs you/Working state on the conversation rail and All conversations button accessibly.
- [ ] Prove reading/selecting is unlimited and current-project-only; active-work limits apply only at Send.
- [ ] Record search/All-project/filter features as deferred follow-up scope and preserve Sprint 109 Rename behavior.

## Phase 6: QA, docs, and release feature complete (W6 — R8)

- [ ] Run focused unit/integration tests and complete the full cross-runtime matrix.
- [ ] Walk every scenario; save evidence for ★ paths and list unexercised paths explicitly.
- [ ] Verify every checked task against branch code/diff and demote unsupported `[x]`.
- [ ] Run `./scripts/validate-qa.sh` and release preflight.
- [ ] Update `docs/development/architecture.md` with `Last updated` on/after branch creation date, plus user docs, `docs/CHANGELOG.md`, v1.10.0 release notes and test checklist.
- [ ] Run release-specific migration+resume canary; update tracker and Sprint 110 issue.
- [ ] Commit, push, PR, review, merge; mark release Feature complete only when all exceptions are deferred explicitly.
