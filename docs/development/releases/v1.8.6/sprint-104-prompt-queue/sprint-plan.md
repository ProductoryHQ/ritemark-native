# Sprint 104 — Reliable Multi-Prompt Queue

**Status:** Approved — planned; blocked by Sprint 103  
**Parent release:** [v1.8.6](../release-plan.md)  
**GitHub milestone:** [v1.8.6](https://github.com/ProductoryHQ/ritemark-native/milestone/7)  
**Branch:** `sprint-104-prompt-queue`  
**Track:** Full — shared state, conversation routing, and interaction design  
**Delivery tier:** Extension

## Goal

Replace the single queued-prompt slot with a bounded per-conversation queue used by every prompt source, so rapid follow-ups are visible, editable, and never silently dropped or retargeted.

## Release Outcome

Users can queue several follow-ups while an agent is busy, inspect and manage them, and trust that each item runs in order against the conversation/runtime/context captured when it was queued.

## Linked Issues

- [#162 — bounded multi-prompt queue for composer and comments](https://github.com/ProductoryHQ/ritemark-native/issues/162), successor to completed [#95](https://github.com/ProductoryHQ/ritemark-native/issues/95).

## In Scope

- Replace `conversationId → string` with a bounded ordered `QueueItem[]` per conversation.
- Default cap: 10 items per chat with a clear full state.
- Capture immutable target conversation, runtime, mode, source, attachments, and context on enqueue.
- Route composer and comment-originated prompts through one queue API.
- Support preview, edit, remove, and reorder before an item starts.
- Pause draining while approval, question, Plan review, cancellation, or another human checkpoint is pending.
- Keep failed items visible with retry/remove actions; do not silently discard them.
- Warn before closing a chat/app with queued unsent work.
- Preserve queue isolation across parallel conversations.

## Explicitly Out of Scope

- Queue persistence after full app restart.
- A global priority scheduler across chats.
- Unbounded queues or drag-and-drop polish if accessible move controls are sufficient.
- Background execution after the app closes.
- Comments overview UI; Sprint 105 consumes this queue contract.

## Deliverables

1. Shared `QueueItem` contract and per-conversation queue state.
2. One enqueue/drain path for all prompt sources.
3. Queue management UI with cap/full/error states.
4. Rapid-submit and parallel-chat regression suite.
5. Updated architecture/release/user documentation where required.

## Architecture and Feature Flags

- Keep queues conversation-scoped; never fall back to the active visible conversation.
- No `AgentRuntime` interface change is expected. Use Sprint 103’s readiness state to decide when dequeue is safe.
- Any new host↔webview queue message contract requires an update to [architecture.md](../../../architecture.md).
- No new feature flag is expected: this replaces a lossy one-slot implementation with a correctness fix.

## Definition of Done

- [ ] Each conversation accepts several queued items up to the agreed cap.
- [ ] Composer, individual comment, and bulk comment sources use the same enqueue contract.
- [ ] Items retain their captured runtime, mode, source context, and attachments.
- [ ] Switching the visible conversation or runtime cannot retarget queued work.
- [ ] Auto-drain stops at approvals, user questions, Plan review, cancellation, and failure.
- [ ] Users can edit, remove, reorder, retry, and inspect queued items.
- [ ] Queue-full, failure, closing-with-items, and unavailable-runtime states are explicit.
- [ ] Rapid submissions do not drop or duplicate work for Claude, Codex, or OpenCode.
- [ ] The successor GitHub issue is closed with acceptance evidence.

## Validation

- Store/unit tests for enqueue, cap, edit/remove/reorder, drain, pause/resume, failure, retry, and conversation isolation.
- Integration tests for comment and composer entry points.
- Dev-mode stress pass: rapid 10-item submission, two parallel chats, runtime switch, approval wait, failure/retry, and chat close.
- Run `./scripts/validate-qa.sh` before readiness handoff.

## Dependencies and Blockers

- Depends on Sprint 103’s authoritative lifecycle/checkpoint definition.
- Must land before Sprint 105 so comments dispatch cannot bypass the queue.
- The queue contract must be agreed before implementation; UI polish must not drive the data model.

## Risks

- Auto-drain can cross a human-review boundary if “ready” is inferred from a spinner instead of authoritative state.
- Mutable global composer state can leak current context into an older queued item.
- Comment submissions currently bypass queueing and return early on busy runtimes; migration must remove that path completely.

## Approval Gate

- [x] Jarmo approved the queue cap, management actions, and non-persistence decision on 2026-08-03.
- [x] #162 is created and assigned to the v1.8.6 milestone.
- [ ] Create the sprint branch only after approval; no product code changes on `main`.
