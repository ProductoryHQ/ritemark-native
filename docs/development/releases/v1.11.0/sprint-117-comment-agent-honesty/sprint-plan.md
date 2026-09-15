# Sprint 117 — Comment-to-Agent Honesty

**Track:** Full SDD<br>
**Status:** **Closed 2026-09-15.** Merged via [PR #293](https://github.com/ProductoryHQ/ritemark-native/pull/293); [#292](https://github.com/ProductoryHQ/ritemark-native/issues/292), [#156](https://github.com/ProductoryHQ/ritemark-native/issues/156) and [#281](https://github.com/ProductoryHQ/ritemark-native/issues/281) closed with it. Full scope, absorbing v1.12.0 Sprint 121. Validated on a running dev instance; the five defects that surfaced there are listed in the PR and fixed on the branch.<br>
**Branch:** `sprint-117-comment-agent-honesty` (worktree `.claude/worktrees/sprint-117-comment-agent-honesty`)<br>
**Issue:** [#292](https://github.com/ProductoryHQ/ritemark-native/issues/292), published 2026-09-14 under milestone `v1.11.0`; absorbs [#156](https://github.com/ProductoryHQ/ritemark-native/issues/156) and [#281](https://github.com/ProductoryHQ/ritemark-native/issues/281), both moved to that milestone<br>
**Release:** [v1.11.0](../release-plan.md)

## Goal

Make every comment-to-agent assignment truthful from click to completion: one dispatch contract, the correct document and conversation, reliable status, and a visible reply on the source comment. Make the comment itself comfortable to write and hand over: a composer that resizes, an agent picker that opens on `@`, collapsed comments that never cover the text, and a task that goes to the conversation you have open, no questions asked.

## Release Outcome

After Sprint 117, assigning from an individual margin comment or the document-wide Comments menu creates the same host-owned task record. The source document can be closed or another tab selected without retargeting work; the original comment shows durable task status, the destination conversation, requests for attention, and one concise completion reply. The comment composer resizes within bounds, typing `@` opens the agent picker immediately, a collapsed comment is a compact margin marker that never covers document text, and a comment task goes to the conversation open in the AI sidebar, which the Send surface names, with no confirmation step.

## SDD Artifacts

- [spec.md](./spec.md) — behavioral contract R1–R9.
- [scenarios.md](./scenarios.md) — BDD, hostile-path, and three-runtime matrix.
- [technical-plan.md](./technical-plan.md) — proposed task-ledger architecture and workstreams W0–W7.
- [design.md](./design.md) — source-comment, destination, attention, completion, and error states.
- [tasks.md](./tasks.md) — audit, decision, implementation, and QA phases.
- [research/current-state-audit.md](./research/current-state-audit.md) — 23 concrete current-path inconsistencies.
- `research/protocol-and-storage-decisions.md` — Phase 0 freeze artifact (in progress).
- [research/github-issue-draft.md](./research/github-issue-draft.md) — issue text, published after Jarmo's go.

## Approved Scope

Jarmo approved the full correctness contract on 2026-09-14 because the known findings share the same message path and state model, and absorbed v1.12.0 Sprint 121 into this sprint because its remaining items change the same margin-rail component and share the `@` alias vocabulary.

- Replace margin-rail and toolbar-overview divergence with one typed dispatch contract and one prompt builder.
- Give anchored and standalone comments stable IDs and preserve exact ordered grouping.
- Bind every dispatch to canonical `documentPath`, `conversationId`, runtime, comment IDs, and assignment source at enqueue time.
- Gate dispatch through normalized runtime availability before queue acceptance.
- Keep status document-scoped and comment-scoped across editor/sidebar reloads; never mark unrelated comments done.
- Normalize completion, failure, cancellation, approval, and question states across Claude, Codex, and OpenCode.
- Post a short completion reply back to the source comment for #156 without creating a general multi-turn comment schema.
- Show and navigate to the exact destination conversation where the task is working or needs input.
- Route every comment task to the conversation open in the AI sidebar and show its title on the Send surface of both the margin rail and the Comments menu; no confirmation dialog or picker (Jarmo, 2026-09-14; R4).
- Give the comment composer a bounded vertical resize that keeps Save, Cancel, and Send reachable at the minimum supported editor width (absorbed from Sprint 121).
- Open the supported-agent picker immediately on `@`, filter as the user types, support keyboard and pointer selection, keep the selected agent visually explicit, and insert mentions from the same alias vocabulary the collector parses (absorbed from Sprint 121).
- Render a collapsed comment as a compact margin marker that never covers document text, and stack status, reply, and actions below the note inside the bubble (absorbed from Sprint 121).
- Preserve the existing `comment-callouts` feature flag and default-on behavior; do not add a second flag for the pipeline repair.

## Deliverables

1. Approved behavioral spec, scenarios, technical plan, and task checklist.
2. One exact typed comment-task protocol across editor webview, extension host, AI sidebar, and conversation controller.
3. Durable or reconstructable per-document task status with stale-event protection.
4. Source-comment completion reply and visible destination-conversation navigation.
5. Three-runtime automated matrix plus narrow/normal-width manual evidence.
6. Architecture and user-documentation updates.
7. Comment composer resize, `@` agent picker, and non-overlapping collapsed-comment layout absorbed from Sprint 121 (#281), with the resizable composer as a primitive v1.12.0 Sprint 122 reuses.

## Definition of Done

- [ ] Single and bulk dispatch produce the same normalized task records and prompts.
- [ ] Every dispatched comment has a stable ID; no valid path can report success with `commentIds: []`.
- [ ] Switching tabs after enqueue cannot change the task's document context.
- [ ] Unknown or stale document/conversation/comment identifiers are rejected, never routed to the active view.
- [ ] Unavailable runtimes fail before queue acceptance with actionable recovery.
- [ ] Working, needs-input, completed, failed, and cancelled states are truthful and isolated to the source document/comments.
- [ ] Completion writes one concise reply to the source comment and links to the canonical conversation.
- [ ] A comment task lands in the conversation open in the AI sidebar; both surfaces show that conversation's title without a confirmation step.
- [ ] `@` opens the agent picker immediately; keyboard-only and pointer selection both work; only supported aliases are offered.
- [ ] Collapsed comments never overlap document text at narrow or normal widths, including with status dots and adjacent markers.
- [ ] The comment composer resizes within bounds and keeps Save, Cancel, and Send reachable at the minimum supported width.
- [ ] Existing comment Markdown round-trip and export stripping remain unchanged.
- [ ] Full runtime matrix, webview build, extension tests, architecture gate, changelog/release-note disposition, and repository QA pass.

## Dependencies and Gates

- Sprint 116 merged 2026-09-14 via [PR #287](https://github.com/ProductoryHQ/ritemark-native/pull/287) — satisfied.
- Sprint approved and branch created 2026-09-14 — satisfied.
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
- Agent conversation header, agent composer resize, and destination-aware chat links (v1.12.0 Sprint 122). Sprint 122 reuses the resizable composer primitive built here.
- Deleting comments automatically after completion.

## Open Decision

Resolved 2026-09-14: full correctness contract, plus v1.12.0 Sprint 121 absorbed. The surgical alternative is withdrawn.

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
| R10 | Comment ergonomics: composer resize, `@` picker, non-overlapping collapsed marker | W6 (W2 for the shared alias vocabulary) |

## Product Decisions

| Date | Decision | Consequence |
|---|---|---|
| 2026-09-07 | Separate comment-task honesty from v1.12 comment ergonomics | Sprint 117 owns correctness/state; Sprint 121 owns composer and layout polish. Superseded 2026-09-14. |
| 2026-09-13 | Recommend a host-owned comment-task ledger | Status and reply survive webview reload and cannot be broadcast as unscoped in-memory facts. |
| 2026-09-13 | Reuse `comment-callouts`; add no second flag | This is repair of an existing default-on feature, not an alternate product path. |
| 2026-09-13 | Keep completion reply outside the Markdown comment body by default | The user's note and export/round-trip contract stay untouched; Phase 0 must approve exact local metadata ownership. |
| 2026-09-14 | Approve the full 23-finding scope | The surgical subset would have left the two worst symptoms, wrong document context and the invisible landing; every finding gets a disposition in Phase 0. |
| 2026-09-14 | Absorb v1.12.0 Sprint 121 (#281) into Sprint 117 | Two of Sprint 121's six outcomes were already R4/R6/R7; the other three change the same component W6 rewrites (`MarginCommentRail.tsx`, `CommentsMenuButton.tsx`) and share the `@` alias vocabulary with W2. One sprint avoids rebuilding the rail in two releases; R10 added; the resizable composer becomes a primitive Sprint 122 reuses. |
| 2026-09-14 | Destination is the conversation open in the AI sidebar; no confirmation dialog, no picker | Jarmo: "läheb automaatselt sinna, milline on hetkel visuaalselt avatud". A fresh empty conversation counts; the Send surface shows the title so nothing is hidden. |
| 2026-09-14 | Phase 0 gate passed; the remaining protocol, storage and ergonomics decisions are delegated to engineering | Jarmo: "ülejäänud sprindi otsustes usaldan sind". Decisions D1–D4 and D6–D12 in [research/protocol-and-storage-decisions.md](./research/protocol-and-storage-decisions.md) stand as written; any later change to user-visible behaviour still comes back to him. |

## Planning Approval

- [x] Jarmo chooses full or surgical depth — full, 2026-09-14.
- [x] GitHub issue is created, links #156 and #281, and is assigned to milestone `v1.11.0` — [#292](https://github.com/ProductoryHQ/ritemark-native/issues/292), 2026-09-14.
- [x] SDD artifacts are approved — as amended 2026-09-14 to absorb Sprint 121; the Phase 0 freeze is still gated.
- [x] Dedicated branch is created after approval — `sprint-117-comment-agent-honesty` from `d0328249`.
