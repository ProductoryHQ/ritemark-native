# Sprint 105 Spec — Comments Command Center

**Issues:** #164 (badge/overview/batch dispatch) · #165 (task correlation/status) · **Depends on:** Sprint 104 queue (hard — no direct send fallback)

## Purpose

Comments become a countable, reviewable document workload: the toolbar shows the true unique-comment count, an overview breaks it down by assignment, and assigned comments dispatch as ONE ordered task per agent through the Sprint 104 queue — leaving every source comment untouched and reporting honest queued/running/done/failed status.

## Requirements

### R1: Shared ID-deduplicated comment index
- One pure function over the editor state (`collectDocumentComments`) is the single source for BOTH the margin rail's identity rules and the new badge/overview: dedup by `data-comment-id` (multi-block fragments count once), positional identity fallback for id-less legacy marks, standalone `CommentNode`s by position, document order preserved.
- Each indexed comment carries: stable key, commentId (when present), kind, body, derived alias (via `parseCommentBody` — body is the source of truth), instruction text, anchored text (all fragments joined), doc position.
- Unit-tested against: anchored, standalone, multi-block same-id, two same-text distinct comments, id-less legacy, unassigned `@unknown`.

### R2: Toolbar badge + overview (#164)
- The editor toolbar shows a **Comments** button with a count badge equal to the index's unique total; hidden at zero. Updates on edit, assignment change, delete, document switch, external reload (recomputed from the live index on editor transactions).
- The overview popover shows: total, assigned/unassigned counts, per-agent groups (agent name + count + first-lines), and the bulk action **Send assigned comments to AI** (disabled at zero assigned).
- Confirmation step lists each agent group with its task count and allows excluding groups before dispatch; wording is dispatch-only (nothing implies resolving).

### R3: One ordered task per agent, through the queue (#164)
- Dispatch builds ONE prompt per included agent: the document path + that agent's comments in document order, each with its stable id, instruction, and anchored text/position.
- Both bulk and the existing per-marker **Send to AI** ride `comment:send-to-ai` → host → sidebar → **Sprint 104 `enqueuePrompt`** (busy runtimes queue; nothing is dropped). The payload now carries `commentIds` and `documentPath` end-to-end.
- Source comments are never mutated, resolved, or deleted by dispatch.

### R4: Honest task status (#165)
- The sidebar store maintains a comment-task registry keyed by queue item: `queued → running → done | failed`, updated from queue state and turn results of the item's own conversation.
- Status flows back editor-ward (`comment:task-status` host relay) and the margin rail marker shows it as a small state dot with tooltip (queued amber-outline, running accent, done green, failed red); the transient "Sent" flash is replaced by the real status.
- No invented signals: a status only ever reflects the queue/turn facts; correlation is by stable commentId; failure is visually distinct from completion.

## Non-Requirements
Auto-resolution/deletion/edits of comments; AI-authored replies or thread schema (#156, deferred); cross-document batching; persistent sent/read state; "Delete all".
