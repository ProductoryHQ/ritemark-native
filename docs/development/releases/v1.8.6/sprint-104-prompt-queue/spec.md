# Sprint 104 Spec — Reliable Multi-Prompt Queue

**Parent:** [sprint-plan.md](./sprint-plan.md) · **Issue:** [#162](https://github.com/ProductoryHQ/ritemark-native/issues/162) · **Depends on:** Sprint 103's activity-state model (`activityState.ts`)

## Purpose

Every prompt a user submits while an agent is busy must be visibly queued, editable, and delivered in order to the exact conversation/runtime/policy captured at submission — never silently dropped (today's `comment:submit` on a busy runtime) and never limited to one invisible slot.

## Principles

- **Nothing is silently dropped.** A submission either sends, queues visibly, or fails visibly.
- **Capture at enqueue.** An item's target conversation, runtime, policy, prompt, and attachments are frozen when queued; later UI changes cannot retarget it.
- **Drain only on true readiness.** Sprint 103's `deriveActivityState` is the authority — a pending plan review, question, or approval is not idle.
- **Store-level, not render-level.** Draining runs in the store on state transitions, so background threads drain too (the old React-effect auto-send only served the visible composer).

## Requirements

### R1: Bounded per-conversation queue

Acceptance criteria:
- `promptQueues: Record<conversationId, QueueItem[]>` replaces the single-string `composerQueues`; cap **10** per conversation.
- `QueueItem` freezes: id, conversationId, runtimeId, autonomy, planFirst, model, final prompt, source (`composer` | `comment`), attachments, skip-flags, comment metadata, createdAt, status (`queued` | `sending` | `failed`) + error.
- Enqueue on a full queue is rejected with a visible "Queue full (10)" state; the composer text is NOT cleared.
- Closed threads' queues are pruned (existing `pruneSlots` invariant carries over); thread-close affordance still withheld while items are queued.

### R2: One enqueue path for every source

Acceptance criteria:
- Composer sends while busy enqueue (existing intercept), capturing the fully built prompt (selection context, chips, mentions) at enqueue time.
- `comment:submit` NEVER calls a send function directly and never retargets the active thread's runtime: it resolves a target conversation for the assigned agent — an open conversation already bound to that runtime (prefer idle) or a new one — and enqueues there; if the target is idle the item sends immediately via the same drain path.
- Rapid successive comment sends on a busy runtime all land in the queue in order (the audit's silent-drop path is deleted).

### R3: Store-level drain with readiness gating

Acceptance criteria:
- Drain triggers on: turn completion (`agent-result` / `codex-result`), plan/question/approval resolution, enqueue-on-idle, and explicit user resume.
- An item dispatches only when the target conversation's `deriveActivityState` is `idle` or `done`. `plan-review`, `waiting-input`, `waiting-approval`, and `running` block draining.
- A turn ending `failed` or `cancelled` PAUSES the queue (items retained, visible "paused" state); the user resumes explicitly.
- Dispatch uses the item's captured payload (turn appended to the TARGET conversation, `agent-execute` posted with the captured runtime/policy) — background conversations drain without being visible.
- A dispatch failure marks the item `failed` with error + Retry/Remove; the rest of the queue stays intact and paused.

### R4: Queue management UI

Acceptance criteria:
- The composer-area queue surface shows "Queued · n/10" with the ordered items: truncated prompt, source marker (comment/composer), target runtime; actions per item: edit (in place), remove, move up/down; failed items show the error + Retry.
- Paused state shows why ("Paused — last turn failed/stopped") + a Resume action.
- The queue panel is per-thread (switching threads swaps contents; a background thread's items never render in another thread).
- Design follows the Sprint 103 card language (chrome tone, ink ladder, no new colors beyond amber/red semantics).

### R5: Regression coverage

Acceptance criteria:
- Unit tests: enqueue/cap/order, capture immutability, readiness gating against every activity state, pause on failure/cancel, retry, edit/remove/reorder, per-thread isolation, comment-target resolution.
- Live dev validation: rapid multi-submit while running (composer + comment paths), two parallel threads draining independently, runtime switch mid-queue (items keep their captured runtime), plan-review pause.

## Non-Requirements

- No persistence across app restart (session-local; documented). App-close warning is limited to the existing thread-close affordance — the webview cannot veto a window close.
- No global cross-thread scheduler; no drag-and-drop (buttons suffice).
- No Comments overview UI (Sprint 105 consumes this contract).

## Resolved Questions

- Old `composerQueues` string slots are session state only — no storage migration needed.
- The `comment:submit` target rule (reuse idle matching-runtime thread, else create) implements the release-plan's open decision recommendation; Sprint 105 builds its per-agent task routing on the same resolver.
