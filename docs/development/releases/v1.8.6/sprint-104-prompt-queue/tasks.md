# Sprint 104 Tasks

> Branch `sprint-104-prompt-queue`. Tick only when the change exists on the branch.

## Phase 1: Queue model (W1 — R1)
- [ ] `webview …/promptQueue.ts`: QueueItem, PromptQueues, pure ops, `isReadyToDrain`
- [ ] `promptQueue.test.ts`: pure-op table tests

## Phase 2: Store integration (W2 — R2/R3)
- [ ] `store.ts`: `promptQueues` state + enqueue/edit/remove/move/retry/resume actions
- [ ] `dispatchQueueItem` (turn append + `agent-execute` post from captured payload, target-conversation scoped)
- [ ] Drain triggers at all resolution points (results, plan/question/approval reducers)
- [ ] `comment:submit` → target resolver + enqueue (direct-send + retarget path deleted)
- [ ] `threadStatus`/close-affordance accessors read queue length

## Phase 3: Composer + panel UI (W3/W4 — R2/R4)
- [ ] `ChatInput.tsx`: queue-branch builds full prompt + enqueues; auto-send effect deleted; full-state notice
- [ ] `QueuePanel.tsx` per design language; wired into the composer area
- [ ] Old notch UI removed

## Phase 4: QA
- [ ] Store-level tests (readiness gating, pause, isolation, comment routing)
- [ ] Live dev matrix: rapid submits, parallel threads, plan-review pause, captured-policy check
- [ ] `./scripts/validate-qa.sh` + full test chain
- [ ] Docs: CHANGELOG, release-notes, user doc (ai-agents.md queue section), architecture.md
- [ ] Merge PR (closes #162); release-plan tracker update
