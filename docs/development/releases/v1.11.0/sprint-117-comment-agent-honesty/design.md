# Sprint 117 Design — Comment Task Honesty

**Status:** Draft for Phase 0 approval<br>
**System:** Ritemark Indigo-Editorial<br>
**Scope:** Assignment destination, lifecycle, attention, completion reply, and recovery; not v1.12 comment composer/layout polish

## User Model

- A **comment** is the user's document note.
- A **task** is one accepted assignment of one or more comments to one runtime/conversation.
- The **conversation** contains full work, approvals, questions, and details.
- The source comment shows a compact projection: destination, current state, one completion/failure summary, and a path to the conversation.
- Assigning never silently rewrites, removes, or resolves the user's note.

## Single Comment Flow

```text
┌────────────────────────────────────────┐
│ @claude Strengthen this argument       │
│                                        │
│ Send to Claude                         │
│ Destination: New conversation          │
│                         [Cancel] [Send] │
└────────────────────────────────────────┘

after acceptance

┌────────────────────────────────────────┐
│ @claude Strengthen this argument       │
│ ● Working · Claude                     │
│ In “Strengthen policy argument”        │
│                    [Open conversation] │
└────────────────────────────────────────┘

after completion

┌────────────────────────────────────────┐
│ @claude Strengthen this argument       │
│ ✓ Claude completed this task           │
│ Reworked the evidence and tightened…   │
│                    [Open conversation] │
└────────────────────────────────────────┘
```

Destination may be confirmed in the same surface before durable acceptance or returned immediately with the accepted state. Phase 0 chooses the atomic interaction, but the user must never receive a generic success without a canonical destination.

## Bulk Flow

```text
COMMENTS · 5 total · 4 assigned

[✓] Claude · 2  → “Release note review”
[✓] Codex  · 2  → New conversation
    1 unassigned comment is not sent

Starts 2 tasks containing 4 comments.
Each task keeps the document and comments shown here.
                         [Back] [Start 2 tasks]
```

After the host responds, results are per group:

```text
✓ Claude · 2 queued → Release note review
! Codex · Sign in required              [Sign in]
```

Never show “Queued 2 tasks” when only one was accepted.

## State Vocabulary

| State | Source-comment copy | Primary action |
|---|---|---|
| accepting | Sending task… | none; duplicate activation disabled |
| queued | Queued for {runtime} | Open conversation |
| running | {runtime} is working | Open conversation |
| needs-user | Needs your input | Open conversation |
| completed | {runtime} completed this task | Open conversation |
| failed | Task failed · {safe reason} | Retry / recovery |
| cancelled | Task cancelled | Retry |
| interrupted | Task interrupted when Ritemark closed | Retry / Open conversation |

Status is text plus icon; never color-only. `needs-user` uses the established amber attention treatment, `completed` uses restrained success, failure uses established error tokens, and idle/queued surfaces remain neutral.

## Completion Summary

- Maximum two visually truncated lines in the bubble; full conversation owns detail.
- Plain text only; no rendered Markdown, tool cards, hidden prompt, file paths, or approval buttons inside the comment.
- Prefer the first useful terminal assistant sentence under an approved character bound.
- Tool-only success: **The task finished. Open the conversation for details.**
- Never expose raw provider diagnostics; use the normalized safe failure copy.
- One task spanning several comments projects the same task result to each source without cloning records.

## File and Lifecycle States

- If the source comment was removed, do not resurrect it.
- If the document was moved/Save As'd, show the approved relink/copy state instead of guessing.
- If the destination conversation was deleted, show **Conversation no longer available** and the approved retry/retarget action.
- A task requiring approval/question always routes the user to the exact destination; no approval controls are duplicated in the editor.

## Accessibility and Layout

- Actions have names containing runtime/destination where useful.
- Open conversation and recovery actions are reachable by keyboard without hover.
- Live status changes use a polite announcement and do not steal focus.
- At narrow widths the note remains primary; status/reply/actions stack below it and never cover document text.
- Validate high contrast, 200% zoom, reduced motion, long titles, long safe errors, and three simultaneous task projections.

## Phase 0 Decisions for Jarmo

- [ ] Approve task/comment/conversation mental model.
- [ ] Approve destination visibility and exact confirmation timing.
- [ ] Approve state vocabulary and per-group bulk results.
- [ ] Approve host-local completion projection that leaves Markdown unchanged.
- [ ] Approve summary bounds/fallback and source/destination deletion behavior.
