# Sprint 117 Spec — Comment-to-Agent Honesty

**Parent:** [sprint-plan.md](./sprint-plan.md) · **Release:** [v1.11.0](../release-plan.md) · **Issue:** pending / [#156](https://github.com/ProductoryHQ/ritemark-native/issues/156) / [#281](https://github.com/ProductoryHQ/ritemark-native/issues/281) (absorbed from v1.12.0 Sprint 121) · **Evidence:** [research/current-state-audit.md](./research/current-state-audit.md)

## Purpose

Replace the editor→AI-sidebar relay and webview-memory status map with one canonical comment-task contract. A task must retain its source document, exact comments, runtime, destination conversation, and lifecycle independently of which editor or conversation is visible. The comment surface itself must be comfortable: the composer resizes, `@` opens the agent picker at once, and a collapsed comment never covers the text it annotates.

## Principles

- **One action, one task record.** UI surfaces capture intent; the host owns accepted task identity and state.
- **Freeze context at acceptance.** Later tab, selection, model, or conversation changes cannot retarget queued work.
- **No success before acceptance.** The editor reports queued only after a durable host acknowledgment.
- **Destination is visible, never asked.** A comment task goes to the conversation open in the AI sidebar; the Send surface says which one, and there is no confirmation step.
- **Status follows task/turn facts.** A conversation terminal event cannot finish unrelated tasks.
- **Reply without corrupting authorship.** Agent completion is visible on the source comment without silently rewriting the user's comment note.

## Proposed Stored Model

Phase 0 must freeze the exact codec, but the candidate `CommentTaskRecordV1` contains:

- canonical `taskId`, schema version, `bindingGeneration`, and timestamps;
- normalized source document URI plus project scope and optional source revision/hash evidence;
- ordered stable `commentIds` with kind (`mark`/`node`) and frozen instruction/anchored-text snapshots;
- selected runtime, approval/autonomy policy, model/effort snapshot where applicable;
- canonical destination `conversationId` and dispatched `conversationTurnId` once known;
- lifecycle `accepting | queued | running | needs-user | completed | failed | cancelled | interrupted`;
- one bounded completion summary or actionable failure/recovery projection;
- no full duplicate conversation transcript, tool payloads, approval capability, or Markdown body copy beyond the frozen task inputs required for audit/retry.

Recommended storage is host-local under extension global storage, indexed by canonical document URI and task ID. The completion reply is a projection of this record in the comment UI; it does not alter the user's Markdown comment body. Phase 0 must approve retention, file move/Save As behavior, comment deletion behavior, and whether source snippets are retained after terminal completion.

## Requirements

### R1: Canonical host-owned task identity

As a user, I want an assignment to become one durable task, so every surface refers to the same work.

Acceptance criteria:
- The host creates a canonical UUID `taskId` only after validating the request, source document, comment IDs, runtime, and destination policy.
- Both single-comment and bulk actions receive an acceptance/rejection response correlated to their request ID.
- The sidebar queue, conversation turn, editor status, attention state, and completion reply carry the same `taskId`.
- Webviews do not own canonical task status or create synthetic task IDs after acceptance.
- Unknown, stale, deleted, or wrong-project task IDs are rejected and never redirected to the active document/conversation.

### R2: One capture and prompt contract

As a user, I want single and bulk assignment to mean the same thing.

Acceptance criteria:
- Both entry points call one pure comment collector/normalizer and one prompt builder.
- Assignment uses the comment body as source of truth with one mention-detection and mention-removal rule.
- Ordered multi-block anchored text and standalone-note meaning are captured identically.
- The prompt always includes the real document path/label, stable comment IDs, ordered instructions, anchored text where present, and the marker-preservation guard.
- No entry point hardcodes `the active document` or strips meaningful mentions differently.
- Empty instruction, unsupported alias, duplicate ID, invalid terminator, and excessive payload are rejected with a specific reason.

### R3: Stable source binding

As a user, I want a queued comment task to keep working on the document I assigned.

Acceptance criteria:
- Every newly created anchored and standalone comment has a stable ID persisted by the existing comment round-trip.
- Legacy id-less comments receive IDs through a deterministic, undoable document edit before dispatch; acceptance cannot proceed with an empty ID list.
- Source binding uses a canonical URI/project scope, not a display-only relative string.
- The real source document path is supplied to runtime context independently of the later active editor/selection.
- Closing the document, switching tabs, hiding webviews, or opening another project cannot retarget the task.
- Rename/move/Save As and source-document deletion behavior are frozen in Phase 0 and covered by tests.

### R4: Visible canonical destination

As a user, I want to know which conversation receives the work and be able to open it.

Acceptance criteria:
- Destination resolution is deterministic and produces a canonical `conversationId` before task acceptance.
- The destination is the conversation open in the AI sidebar at the moment of sending, a fresh empty conversation included; both the margin rail and the Comments menu show its title on the Send surface, and no confirmation dialog or picker is added.
- The source comment shows **Open conversation** for queued/running/needs-user/completed/failed states.
- Selecting the action opens the exact conversation without changing task identity or status.
- The task never silently retargets if another conversation becomes active or the chosen conversation is deleted; deletion produces an explicit recovery/failure path.

### R5: Honest acceptance, availability, and queue behavior

As a user, I want assignment feedback to reflect whether work was actually accepted.

Acceptance criteria:
- Normalized provider availability is checked before durable acceptance/queueing.
- Signed-out, missing, incompatible, refreshing, or failed runtimes return the established runtime-specific recovery action.
- Queue capacity is checked atomically with acceptance; a full queue does not create a task reported as queued.
- Bulk dispatch returns per-runtime accepted/rejected results and never reports all tasks queued when one failed.
- Double-click/retry uses request idempotency and cannot create duplicate task records or turns.
- A persisted accepted task either dispatches or restores as interrupted/actionable after restart; it cannot disappear between editor acknowledgment and runtime dispatch.

### R6: Truthful lifecycle and attention state

As a user, I want each comment to show what its own task is doing.

Acceptance criteria:
- Lifecycle transitions are host-authoritative and monotonic for a binding generation.
- `needs-user` represents approval/question/plan review and points to the destination conversation; it is not mislabeled running or complete.
- Completion/failure/cancellation attaches to the exact `conversationTurnId`/`taskId`, not every running task in a conversation.
- Status is filtered by canonical source document and comment ID before it reaches an editor projection.
- Reload/reopen/restart reconstructs status from the host ledger; module-global webview memory is not the source of truth.
- Stale callbacks after retry, comment removal, task cancellation, or conversation deletion cannot update the current binding.

### R7: Source-comment completion reply

As a user, I want the agent's result to land visibly where I assigned the task.

Acceptance criteria:
- A successful task shows one bounded plain-language completion summary on every source comment included in that task.
- The reply identifies the runtime and links to the exact full conversation.
- The summary is derived from the exact terminal turn, never from the current conversation's latest message.
- Empty or tool-only success uses truthful fallback copy rather than fabricating an answer.
- Failure, cancellation, interruption, and needs-user states show distinct copy/actions and never masquerade as a completion reply.
- The user's comment body, anchored text, and Markdown carriers are not silently rewritten; exports remain comment-free.
- Retry creates a new binding generation/task attempt while preserving prior terminal evidence without duplicate visible replies.

### R8: Three-runtime and lifecycle parity

As a user, I want Claude, Codex, and OpenCode comment tasks to obey the same product contract.

Acceptance criteria:
- Runtime selection maps through the existing three `AgentRuntime` implementations and unified availability/approval systems.
- Runtime-specific event shapes normalize to task-scoped queued/running/needs-user/terminal transitions above adapters.
- Cancelled or interrupted Claude/Codex/OpenCode turns never report completed.
- Switching runtime for the destination conversation after acceptance cannot mutate the frozen task; any explicit handoff is a separate user action.
- Parallel tasks in one or several conversations remain isolated.

### R9: Rollout, accessibility, documentation, and regression safety

As the team, we want the repair to ship without breaking comment round-trip or adding another hidden store.

Acceptance criteria:
- Existing `comment-callouts` remains the only feature flag and stays default-on; flag-off gates capture, host mutation, destination events, and reply/status projection coherently.
- Stable-ID upgrade and task-ledger initialization are idempotent and do not alter unassigned comments.
- Comment UI states are keyboard accessible, screen-reader named, non-color-only, visible at narrow/normal widths, high contrast, and 200% zoom.
- Comment add/edit/delete/undo, multi-block marks, standalone notes, Markdown round-trip, document sync, export stripping, conversation durability, and prompt queue regressions pass.
- Architecture, user docs, changelog, v1.11 release notes, release tracker, issue, and QA evidence are current.

### R10: Comment ergonomics (absorbed from v1.12.0 Sprint 121)

As a user, I want comments to be comfortable to write, assign, and read alongside the text.

Acceptance criteria:
- The comment composer has a bounded vertical resize (a minimum of the current two rows and a Phase 0-frozen maximum); Save, Cancel, and Send stay visible and reachable at the minimum supported editor width, at 200% zoom, and with a long note.
- Typing `@` opens the supported-agent list immediately; continued typing filters it; Arrow keys move, Enter or Tab inserts, Escape closes without inserting; pointer selection works; only aliases in `COMMENT_AGENT_ALIASES` are offered, and the inserted mention is exactly what `detectAgentAlias` recognises, so picker and collector share one vocabulary.
- The selected agent stays visually explicit in the composer and in the bubble before save and before send.
- A collapsed comment is a compact margin marker that never covers document text at narrow or normal widths, with a long note, with a status dot, and with three adjacent markers; expanding uses the existing rail interaction, and the expanded bubble sits beside the text column.
- Status, completion reply, and actions stack below the note inside the bubble and never cover document text (R9 carries the accessibility matrix).
- The resizable composer is one reusable primitive so v1.12.0 Sprint 122 can apply it to the agent composer without a second implementation.

## Non-Requirements

- Multi-turn collaborative comment threads.
- Editing the agent response inside the comment.
- Automatically deleting/resolving a source comment after task completion.
- Agent conversation header, agent composer resize, and destination-aware chat links (v1.12.0 Sprint 122).
- New runtime kinds, runtime-specific approvals, or a second conversation transcript store.
- Portable/cloud-synced task metadata unless separately approved.

## Phase 0 Decisions

All resolved 2026-09-14; the frozen contract is [research/protocol-and-storage-decisions.md](./research/protocol-and-storage-decisions.md).

1. ~~Approve full 23-finding scope versus a named surgical deferral list.~~ Resolved 2026-09-14: full scope; v1.12.0 Sprint 121 absorbed.
2. Freeze `CommentTaskRecordV1`, retention, cleanup, file-move/Save As, retry, and comment-deletion behavior.
3. Approve host-local completion projection versus a new persisted Markdown reply encoding; recommendation is host-local projection.
4. ~~Freeze destination resolution and the exact pre-dispatch confirmation interaction.~~ Decided by Jarmo 2026-09-14: the destination is the conversation open in the AI sidebar; no confirmation, no picker; the Send surface shows its title.
5. Freeze the exact typed request/result/event union and integration seam with ConversationController/sidebar queue.
6. Approve the visual states in [design.md](./design.md).
7. Approve the composer resize bounds, the `@` picker behaviour, and the collapsed-marker layout at narrow widths (R10).
