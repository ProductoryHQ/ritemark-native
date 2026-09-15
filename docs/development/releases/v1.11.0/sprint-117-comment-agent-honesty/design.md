# Sprint 117 Design — Comment Task Honesty

**Status:** Draft for Phase 0 approval<br>
**System:** Ritemark Indigo-Editorial<br>
**Scope:** Assignment destination, lifecycle, attention, completion reply, recovery, and the comment composer, agent picker, and collapsed-marker layout absorbed from v1.12.0 Sprint 121; not the agent conversation header, agent composer, or chat links (Sprint 122)

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
│ → Release note review                  │
│                        [Send to Claude] │
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

Decided by Jarmo 2026-09-14: there is no confirmation step. The task goes to the conversation open in the AI sidebar, a fresh empty one included; the caption above the button names it so nothing is hidden, and after acceptance the bubble shows the same title with Open conversation. The user must never receive a generic success without a canonical destination.

## Bulk Flow

```text
COMMENTS · 5 total · 4 assigned

[✓] Claude · 2
[✓] Codex  · 2
    1 unassigned comment is not sent

Starts 2 tasks containing 4 comments in “Release note review”.
Each task keeps the document and comments shown here.
                         [Back] [Start 2 tasks]
```

After the host responds, results are per group:

```text
✓ Claude · 2 queued → Release note review
! Codex · Sign in required              [Sign in]
```

Never show “Queued 2 tasks” when only one was accepted.

## Composer

```text
┌────────────────────────────────────────┐
│ @cla|                                  │
│ ┌──────────────┐                       │
│ │ ● Claude     │  ← picker, filtered   │
│ │   Codex      │                       │
│ │   OpenCode   │                       │
│ └──────────────┘                       │
│                                        │
│                          ═══ (resize)  │
│ Claude              [Cancel] [Save]    │
└────────────────────────────────────────┘
```

- Bounded vertical resize from the bottom edge: minimum two rows, maximum frozen in Phase 0 (proposal: eight rows or 40% of the editor viewport, whichever is smaller). Height is remembered for the session, not persisted.
- Save, Cancel, and Send never scroll away; they sit outside the scrolling text area.
- The selected agent shows as a pill in the footer while composing and in the bubble head after save.
- One reusable primitive; v1.12.0 Sprint 122 applies it to the agent composer.

## Agent picker

- Opens the moment `@` is typed at a word boundary; filters on every keystroke; closes when the filter matches nothing.
- Arrow Up/Down move, Enter or Tab insert `@alias ` at the caret, Escape closes without inserting; pointer click inserts and keeps composer focus.
- Lists only `COMMENT_AGENT_ALIASES`, with the runtime's display name and, when known, its availability hint (for example "Sign in required"); the inserted text is exactly what the collector's `detectAgentAlias` recognises.
- Screen readers get a listbox with the active option announced; the picker never covers the composer's controls.

## Collapsed marker

```text
   text column                          │ gutter
   The evidence in this section is …    │ ◌  @claude Strengthen…
   which the reviewers questioned.      │ ●  @codex Check the…
                                        │ ◌  Rephrase for…
```

- A collapsed comment is a compact marker in the margin gutter (icon, optional status dot, a short preview only when the gutter is wide enough); it never overlaps document text.
- Expanding opens the bubble beside the text column at normal widths; at narrow widths the bubble opens below the marker within the gutter and the preview is dropped rather than letting the bubble cover the text. Phase 0 validates the narrow-width rule on RunDev at the minimum supported width.
- Status, completion reply, and actions stack below the note inside the bubble; nothing inside the bubble is positioned over the text column.

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
- [x] Destination: the conversation open in the AI sidebar, no confirmation (Jarmo, 2026-09-14).
- [ ] Approve state vocabulary and per-group bulk results.
- [ ] Approve host-local completion projection that leaves Markdown unchanged.
- [ ] Approve summary bounds/fallback and source/destination deletion behavior.
- [ ] Approve the composer resize bounds, the `@` picker behaviour, and the collapsed-marker layout at narrow widths (R10).
