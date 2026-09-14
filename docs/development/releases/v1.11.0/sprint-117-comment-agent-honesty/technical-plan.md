# Sprint 117 Technical Plan

Architecture and workstreams for [spec.md](./spec.md), grounded in [research/current-state-audit.md](./research/current-state-audit.md).

## Architecture Overview

Recommended architecture moves identity/status authority into the extension host while reusing existing comment and conversation systems:

```text
Editor webview
  MarginCommentRail / CommentsMenuButton
          ↓ one pure collector + one typed request
RitemarkEditorProvider
          ↓ canonical document URI + validated comment snapshot
CommentTaskController ─ CommentTaskStore
          ↓ accepted taskId + destination conversationId
UnifiedViewProvider / AI sidebar queue client
          ↓ taskId + frozen prompt + destination
ConversationController → existing AgentRuntime session
          ↑ task-scoped turn/attention/terminal events
CommentTaskController
          ↓ document-filtered projections
Editor webview comment bubble/status/reply
```

The host ledger owns task identity/lifecycle. It does not duplicate the conversation transcript or runtime adapter. The AI sidebar may remain the execution client for the existing prompt queue, but it only executes a host-accepted task and reports events carrying `taskId` and exact turn identity.

## Proposed Host Files

```text
extensions/ritemark/src/commentTasks/
  types.ts
  protocol.ts
  CommentTaskStore.ts
  CommentTaskController.ts
  commentTaskPrompt.ts
  commentTaskProjection.ts
```

Expected integrations:

```text
extensions/ritemark/src/ritemarkEditor.ts
extensions/ritemark/src/views/UnifiedViewProvider.ts
extensions/ritemark/src/conversations/ConversationController.ts
extensions/ritemark/webview/src/extensions/comment/commentIndex.ts
extensions/ritemark/webview/src/extensions/comment/commentModel.ts
extensions/ritemark/webview/src/extensions/comment/commentTaskStatus.ts
extensions/ritemark/webview/src/components/MarginCommentRail.tsx
extensions/ritemark/webview/src/components/header/CommentsMenuButton.tsx
extensions/ritemark/webview/src/components/ai-sidebar/promptQueue.ts
extensions/ritemark/webview/src/components/ai-sidebar/store.ts
extensions/ritemark/webview/src/components/comment/AgentMentionPicker.tsx   (proposed, R10)
extensions/ritemark/webview/src/components/comment/ResizableComposer.tsx    (proposed, R10; reused by Sprint 122)
```

The two `components/comment/` files are proposals: Phase 0 may rename them or fold them into `MarginCommentRail.tsx` if the existing compose bubble can carry the behaviour without a new file.

## Workstream 0: Audit and freeze (R1–R9)

- Turn the 23 findings into a traceability table: finding → requirement → scenario → workstream → disposition.
- Freeze `CommentTaskRecordV1`, exact typed messages, bounds, retention, file move/Save As behavior, source deletion, retry generations, cleanup, and reply ownership.
- Decide destination resolution/confirmation timing and the atomicity boundary between durable acceptance and queue capacity reservation.
- Build synthetic Markdown fixtures: anchored, multi-block, link/format split, standalone, id-less legacy, duplicate IDs, multiple agents, terminator, deleted source, and two documents with identical text.
- Approve [design.md](./design.md) states, including the R10 composer, picker, and collapsed-marker states; scope resolved full on 2026-09-14.
- Stop for Jarmo's explicit Phase 0 decision before product code.

## Workstream 1: Task schema, store, and source identity (R1, R3, R6)

- Implement exact codecs/validators for task records and public projections.
- Store records atomically under a versioned host directory; index by canonical document URI and task ID, with rebuild/quarantine diagnostics.
- Use canonical `vscode.Uri` string plus project scope; keep display labels separate.
- Use request correlation and task binding generations to reject duplicate/stale callbacks.
- Implement list-for-document/get/accept/transition/retry/cancel/detach-source/diagnostics operations.
- Do not retain full conversation transcripts or executable approval/tool state.

## Workstream 2: One collector, ID upgrade, and prompt builder (R2, R3)

- Make `commentIndex.ts` the pure authority for assignment parsing, instruction stripping, fragment grouping, order, anchored text, and prompt inputs.
- Extend `CommentNode`/Turndown/marked round-trip so all new standalone comments persist stable IDs; preserve existing anchored IDs.
- Add an explicit legacy ID assignment transaction before dispatch; preserve undo and avoid dirtying a document merely by opening it.
- Replace rail-specific prompt construction and the bulk `the active document` placeholder with one builder receiving host-validated source label/URI.
- Add payload bounds and exact rejected reasons.

## Workstream 3: Typed acceptance and destination resolution (R1, R4, R5)

- Define editor request/result/events in `commentTasks/protocol.ts`; runtime-validate exact fields at the webview boundary.
- `RitemarkEditorProvider` stamps canonical document URI/project scope and validates that requested IDs exist in the current document snapshot.
- Resolve a canonical destination conversation through host conversation APIs, preferring a ready compatible conversation only under a frozen deterministic rule; otherwise create one accepted background conversation.
- Query normalized runtime availability and queue reservation before final acceptance.
- Persist task before returning accepted; if queue handoff fails after persistence, record actionable interrupted/failed state rather than losing it.
- Return per-group results for bulk requests and idempotently correlate retries.

## Workstream 4: Queue, turn, and lifecycle integration (R5, R6, R8)

- Add `taskId` and frozen source context to queue items/turn dispatch without reading active editor selection at drain time.
- Send the canonical source path through the host runtime prompt context; do not depend on sidebar `activeFilePath`.
- Map accepted→queued→running from exact queue/turn events.
- Map approval/question/plan review to `needs-user`; map terminal result/cancel/failure/interruption with exact task/turn identity.
- Remove conversation-wide `finalizeCommentTasks` behavior and webview-memory lifecycle authority.
- Ensure all three runtimes normalize above adapters and preserve `UnifiedApprovalGate`/conversation scoping.

## Workstream 5: Completion summary and source projection (R7)

- Derive one bounded plain-text completion summary from the exact terminal assistant event, with a tool-only success fallback.
- Persist only the approved summary/failure projection and conversation link in the task record.
- Project task state by canonical document URI and comment ID when an editor becomes ready or records change.
- Render the projection in the comment bubble without modifying the user's note or TipTap document.
- If a source comment is gone, retain conversation/task evidence under the approved retention rule but never reinsert text.

## Workstream 6: UX, accessibility, migration, and flag behavior (R4–R10)

- Implement [design.md](./design.md) confirmation and task states for single and bulk entry points; the confirmation shows the agent and destination before dispatch.
- Show runtime, destination title, current state, timestamp, concise reply/error, and Open conversation/Retry/Sign in as applicable.
- Replace global broadcast with document-scoped host projection; clear old webview module state on transition.
- Give the compose bubble a bounded vertical resize as one reusable primitive (Sprint 122 applies it to the agent composer); keep Save, Cancel, and Send outside the scrolling area.
- Add the `@` agent picker driven by `COMMENT_AGENT_ALIASES` and `ALIAS_TO_AGENT_ID` from `commentModel.ts`, so the picker and the W2 collector share one vocabulary; keyboard and pointer selection; explicit selected-agent pill.
- Render collapsed comments as gutter markers that never overlap the text column; stack status, reply, and actions below the note; validate the narrow-width rule on RunDev.
- Keep `comment-callouts` as the single default-on flag and gate host/UI paths together.
- Preserve comment editing/removal, document sync, export stripping, and the Sprint 122 boundary (conversation header, agent composer, chat links stay out).

## Workstream 7: Tests, live matrix, and closeout (R9)

- Pure tests: collector/prompt, ID upgrade, schema/protocol, store, destination selection, availability/queue acceptance, transition reducer, completion summary.
- Integration: two documents, same conversation/two tasks, three runtimes, approval/question, queue full, reload/restart, retry/stale callbacks, delete source/conversation.
- Live RunDev: every ★ scenario at narrow/normal width and packaged-profile restart evidence where persistence differs.
- Update architecture subsystem/protocol/ownership, AI agent/comment user docs, changelog, v1.11 release notes, release tracker, issue, and QA.

## Implementation Order

W0 audit/design → decision gate → W1 task store → W2 capture/IDs/prompt → W3 acceptance/destination → W4 runtime lifecycle → W5 reply projection → W6 UX/ergonomics (R10)/migration/flag → W7 QA/docs.

## Architecture Gate

Triggered by a new host subsystem, versioned local records, new typed webview messages, changed status ownership, and conversation/queue integration. Update `docs/development/architecture.md`. Preserve the sandbox boundary, canonical `conversationId`, three `AgentRuntime` implementations, `UnifiedApprovalGate`, and the existing comment export chokepoint.
