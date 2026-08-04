# Sprint 104 Tasks

> Branch `sprint-104-prompt-queue`. Tick only when the change exists on the branch.

## Phase 1: Queue model (W1 — R1)
- [x] `webview …/promptQueue.ts`: QueueItem, PromptQueues, pure ops, `isReadyToDrain`
- [x] `promptQueue.test.ts`: pure-op table tests

## Phase 2: Store integration (W2 — R2/R3)
- [x] `store.ts`: `promptQueues` state + enqueue/edit/remove/move/retry/resume actions
- [x] `dispatchQueueItem` (turn append + `agent-execute` post from captured payload, target-conversation scoped)
- [x] Drain triggers at all resolution points (results, plan/question/approval reducers)
- [x] `comment:submit` → target resolver + enqueue (direct-send + retarget path deleted)
- [x] `threadStatus`/close-affordance accessors read queue length

## Phase 3: Composer + panel UI (W3/W4 — R2/R4)
- [x] `ChatInput.tsx`: queue-branch builds full prompt + enqueues; auto-send effect deleted; full-state notice
- [x] `QueuePanel.tsx` per design language; wired into the composer area
- [x] Old notch UI removed

## Phase 4: QA
- [x] Store-level tests (readiness gating, pause, isolation, comment routing)
- [x] Live dev matrix: rapid submits, parallel threads, plan-review pause, captured-policy check
- [ ] `./scripts/validate-qa.sh` + full test chain
- [ ] Docs: CHANGELOG, release-notes, user doc (ai-agents.md queue section), architecture.md
- [ ] Merge PR (closes #162); release-plan tracker update
