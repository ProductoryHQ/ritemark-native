# Sprint 105 — Comments Command Center

**Status:** Approved — SDD artifacts required; blocked by Sprint 104  
**Parent release:** [v1.8.6](../release-plan.md)  
**GitHub milestone:** [v1.8.6](https://github.com/ProductoryHQ/ritemark-native/milestone/7)  
**Branch:** `sprint-105-comments-command-center`  
**Track:** SDD recommended — editor model, cross-webview routing, and user-visible workflow state  
**Delivery tier:** Extension

## Goal

Turn comments into a document-level workload users can count, review, and deliberately dispatch to the assigned AI agents without losing, duplicating, resolving, or retargeting feedback.

## Release Outcome

The editor toolbar shows the active document’s true comment count, opens a compact overview, and sends assigned comments as one ordered task per agent through the reliable queue from Sprint 104.

## Linked Issues

- [#164 — Comments toolbar badge, overview, and assigned-comment batch dispatch](https://github.com/ProductoryHQ/ritemark-native/issues/164).
- [#165 — comment task correlation and queued/running/done/failed status](https://github.com/ProductoryHQ/ritemark-native/issues/165), split from #156.
- [#156](https://github.com/ProductoryHQ/ritemark-native/issues/156) now tracks only deferred automatic AI-authored replies/thread schema and is not in v1.8.6.

## In Scope

- Shared document comment index that deduplicates by stable `data-comment-id`.
- Toolbar **Comments** action with a total-count badge.
- Overview with total, assigned, unassigned, and per-agent counts.
- Bulk action labelled **Send assigned comments to AI**.
- Confirmation showing per-agent task counts and allowing agent groups to be excluded before dispatch.
- One ordered task per assigned agent containing comment ID, instruction, anchored text/position, and active document path.
- Route individual and bulk comment tasks through Sprint 104’s queue.
- Preserve all source comments after dispatch.
- Correlate queued tasks with their source comments and show honest queued/running/done/failed marker status through #165.

## Explicitly Out of Scope

- Automatic comment resolution, deletion, acceptance, or document edits.
- AI-authored replies or threaded comment schema.
- Cross-document batching.
- Persistent sent/read state unless the split #156 foundation explicitly defines it.
- “Delete all” or other destructive document-wide actions.

## Deliverables

1. Shared ID-deduplicated comment index.
2. Toolbar badge and overview UI.
3. Per-agent aggregation and confirmation flow.
4. Queue-based individual and bulk dispatch.
5. #165 correlation/status foundation, with automatic replies explicitly excluded.
6. Comment workflow docs and scenario coverage.

## Architecture and Feature Flags

- Extend the existing `comment-callouts` feature flag rather than inventing a parallel comment flag.
- Comments remain editor metadata represented by the existing Markdown comment carriers; do not introduce a second persistence format.
- No runtime-specific comment send implementation. Route through the shared queue and existing `AgentRuntime` path.
- Update [architecture.md](../../../architecture.md) if the editor↔host↔sidebar message contract or comment state model changes.

## Definition of Done

- [ ] Badge count equals unique anchored plus standalone comments in the active document.
- [ ] Multi-block marks sharing one `data-comment-id` count once.
- [ ] Overview counts update after add, edit, assignment change, resolve/delete, document switch, and external reload.
- [ ] Unassigned comments are never sent by the bulk action.
- [ ] The confirmation identifies every agent group and resulting task count.
- [ ] Dispatch creates at most one ordered task per selected agent.
- [ ] Individual and bulk sends both use Sprint 104’s queue and cannot disappear on a busy runtime.
- [ ] Sending does not mutate, resolve, delete, or auto-apply any source comment.
- [ ] Any displayed status is correlated to the correct stable comment and distinguishes failure from completion.
- [ ] Automatic AI replies remain absent unless Jarmo explicitly expands scope and approves a new schema.

## Validation

- Unit tests for comment indexing, deduplication, assignment grouping, payload construction, and state correlation.
- Integration tests for editor→host→sidebar→queue routing.
- Dev-mode scenarios: anchored, standalone, multi-block, unassigned, three agents, cap pressure, busy runtime, failure/retry, document switch, and reload.
- Screenshot evidence for badge, overview, confirmation, queue items, and marker states.
- Run `./scripts/validate-qa.sh` before readiness handoff.

## Dependencies and Blockers

- Hard dependency on Sprint 104; no direct runtime send fallback is permitted.
- The #156 split is complete; SDD artifacts must preserve the boundary between included #165 status and deferred #156 replies.
- The overview must reuse one shared comment index with the margin rail to prevent count drift.

## Risks

- DOM-element counting overstates multi-block comments.
- Starting several agent groups can hit the parallel-chat cap; confirmation and queue feedback must make that visible.
- “Sent” can be mistaken for “resolved”; use precise queued/running/done wording and preserve source comments.

## Approval Gate

- [x] Jarmo approved the overview contents, bulk-action label, grouping, and #156 split on 2026-08-03.
- [ ] Author and obtain approval for the SDD artifacts before implementation.
- [x] #164/#165 are milestone-assigned and #156 is updated/deferred outside v1.8.6.
- [ ] Create the sprint branch only after approval; no product code changes on `main`.
