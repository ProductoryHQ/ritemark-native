# Sprint 117 — Comment-to-Agent Honesty

**Track:** Full SDD<br>
**Status:** Draft — prepared, not approved, no branch created<br>
**Branch after approval:** `sprint-117-comment-agent-honesty`<br>
**Issue:** Pending release mapping; absorbs [#156](https://github.com/ProductoryHQ/ritemark-native/issues/156)<br>
**Release:** [v1.11.0](../release-plan.md)

## Goal

Make every comment-to-agent assignment truthful from click to completion: one dispatch contract, the correct document and conversation, reliable status, and a visible reply on the source comment.

## Release Outcome

After Sprint 117, assigning from an individual margin comment or the document-wide Comments menu creates the same host-owned task record. The source document can be closed or another tab selected without retargeting work; the original comment shows durable task status, the destination conversation, requests for attention, and one concise completion reply.

## SDD Artifacts

- [spec.md](./spec.md) — behavioral contract R1–R9.
- [scenarios.md](./scenarios.md) — BDD, hostile-path, and three-runtime matrix.
- [technical-plan.md](./technical-plan.md) — proposed task-ledger architecture and workstreams W0–W7.
- [design.md](./design.md) — source-comment, destination, attention, completion, and error states.
- [tasks.md](./tasks.md) — audit, decision, implementation, and QA phases.
- [research/current-state-audit.md](./research/current-state-audit.md) — 23 concrete current-path inconsistencies.
- `research/protocol-and-storage-decisions.md` — Phase 0 freeze artifact to be completed after kickoff.

## Proposed Scope

This draft recommends fixing the full correctness contract in one sprint because the known findings share the same message path and state model. Jarmo may instead approve the surgical subset and explicitly defer the remaining rows before kickoff.

- Replace margin-rail and toolbar-overview divergence with one typed dispatch contract and one prompt builder.
- Give anchored and standalone comments stable IDs and preserve exact ordered grouping.
- Bind every dispatch to canonical `documentPath`, `conversationId`, runtime, comment IDs, and assignment source at enqueue time.
- Gate dispatch through normalized runtime availability before queue acceptance.
- Keep status document-scoped and comment-scoped across editor/sidebar reloads; never mark unrelated comments done.
- Normalize completion, failure, cancellation, approval, and question states across Claude, Codex, and OpenCode.
- Post a short completion reply back to the source comment for #156 without creating a general multi-turn comment schema.
- Show and navigate to the exact destination conversation where the task is working or needs input.
- Preserve the existing `comment-callouts` feature flag and default-on behavior; do not add a second flag for the pipeline repair.

## Deliverables

1. Approved behavioral spec, scenarios, technical plan, and task checklist.
2. One exact typed comment-task protocol across editor webview, extension host, AI sidebar, and conversation controller.
3. Durable or reconstructable per-document task status with stale-event protection.
4. Source-comment completion reply and visible destination-conversation navigation.
5. Three-runtime automated matrix plus narrow/normal-width manual evidence.
6. Architecture and user-documentation updates.

## Definition of Done

- [ ] Single and bulk dispatch produce the same normalized task records and prompts.
- [ ] Every dispatched comment has a stable ID; no valid path can report success with `commentIds: []`.
- [ ] Switching tabs after enqueue cannot change the task's document context.
- [ ] Unknown or stale document/conversation/comment identifiers are rejected, never routed to the active view.
- [ ] Unavailable runtimes fail before queue acceptance with actionable recovery.
- [ ] Working, needs-input, completed, failed, and cancelled states are truthful and isolated to the source document/comments.
- [ ] Completion writes one concise reply to the source comment and links to the canonical conversation.
- [ ] Existing comment Markdown round-trip and export stripping remain unchanged.
- [ ] Full runtime matrix, webview build, extension tests, architecture gate, changelog/release-note disposition, and repository QA pass.

## Dependencies and Gates

- Sprint 116 must be merged, or the release plan must record an explicit reorder decision.
- v1.11.0 must be mapped and the sprint approved before branch creation.
- Phase 0 must inventory the 23 known inconsistencies into a traceability table and classify each as required, already fixed, or explicitly deferred.
- The final protocol must preserve Sprint 99's rule that every conversation-scoped message carries canonical `conversationId`.

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Refactor changes behavior across all three runtimes | High | Keep dispatch normalization above runtime adapters and run the full matrix. |
| Completion mutates the wrong document or comment | High | Canonical path + comment ID binding, stale-event rejection, multi-document tests. |
| Status persistence duplicates conversation truth | High | Define one owner in Phase 0; store only comment-task projection data, not another transcript. |
| Reply serialization damages Markdown | High | Reuse comment round-trip primitives and add anchored/standalone fixtures. |
| Background approval lands invisibly | High | Persist exact conversation destination and expose navigation before dispatch. |

## Out of Scope

- General multi-turn comment threads or collaborative Docs-style commenting.
- New runtime kinds or runtime-specific approval message types.
- Comment layout/resize/suggestion polish reserved for v1.12.0 Sprint 121.
- Deleting comments automatically after completion.

## Open Decision

- **Recommended:** full correctness contract above.
- **Alternative:** surgical subset limited to dispatch unification, stable IDs, correct status, and #156 reply; every omitted finding must be named in the release plan and moved to a later issue.

## Requirement Traceability

| Requirement | Outcome | Workstream |
|---|---|---|
| R1 | One canonical task identity/owner | W0–W1 |
| R2 | One capture and prompt contract | W2 |
| R3 | Immutable source-document/comment binding | W1–W2 |
| R4 | Visible canonical destination conversation | W3 |
| R5 | Honest acceptance and queue behavior | W3–W4 |
| R6 | Durable lifecycle and attention state | W1, W4 |
| R7 | One visible completion reply | W5 |
| R8 | Three-runtime and reload correctness | W4–W6 |
| R9 | Flag, migration, accessibility, docs, QA | W6–W7 |

## Product Decisions

| Date | Decision | Consequence |
|---|---|---|
| 2026-09-07 | Separate comment-task honesty from v1.12 comment ergonomics | Sprint 117 owns correctness/state; Sprint 121 owns composer and layout polish. |
| 2026-09-13 | Recommend a host-owned comment-task ledger | Status and reply survive webview reload and cannot be broadcast as unscoped in-memory facts. |
| 2026-09-13 | Reuse `comment-callouts`; add no second flag | This is repair of an existing default-on feature, not an alternate product path. |
| 2026-09-13 | Keep completion reply outside the Markdown comment body by default | The user's note and export/round-trip contract stay untouched; Phase 0 must approve exact local metadata ownership. |

## Planning Approval

- [ ] Jarmo chooses full or surgical depth.
- [ ] GitHub issue is created, links #156, and is assigned to milestone `v1.11.0`.
- [ ] SDD artifacts are approved.
- [ ] Dedicated branch is created after approval.
