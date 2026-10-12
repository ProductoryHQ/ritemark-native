# Sprint 130 research — where the board's data lives

**Question (from #119):** one file (JSON or SQLite) or one Markdown file per card?
**Recommendation:** **one Markdown file per card** in `.ritemark/tasks/`, board fields in YAML front matter, the card's description as the Markdown body. Plus one small host-local record per agent handoff in global storage, for facts that belong to this computer only (which conversation, which turn).

## What the data must do

1. Belong to the project folder, travel with it, work offline, need no account (#119).
2. Be read and changed by the user (board UI), by agents (tools, in all three runtimes) and by the host (results coming back), sometimes at the same moment.
3. Survive the places writers keep folders: Dropbox, OneDrive, iCloud Drive, Google Drive, git. These sync whole files, and two edits to one file on two machines become a "conflicted copy" or a merge conflict.
4. Never lose a card because one file is damaged.
5. Add no native dependency (the extension host is one esbuild bundle; native modules mean per-platform binaries, signing and a shell release).

## Options

| | One JSON file (`.ritemark/tasks.json`) | SQLite (`.ritemark/tasks.db`) | **One Markdown file per card** (`.ritemark/tasks/*.md`) |
|---|---|---|---|
| Readable without Ritemark | Barely | No (binary) | **Yes**: a card is a short document |
| Two people or agents change different cards | Same file → conflict / conflicted copy | Binary file in a sync folder: whole-file conflicts, or a damaged database if synced mid-write | **Different files → no conflict** |
| A damaged write | Whole board unreadable | Whole board, unless WAL recovery works | **One card** shows "Couldn't read this card" |
| Agents without board tools (e.g. a CLI in the terminal) | Can read; editing JSON by hand risks breaking the board | Cannot | **Can read any card with ordinary file tools** |
| Opens in Ritemark's editor | No | No | **Yes**, "Open as document" for long descriptions |
| Dependencies | None | A native module (`better-sqlite3`) or Node's experimental `node:sqlite` | None: `gray-matter` 4.0.3 is already bundled |
| Listing the board | One read | One query | One read per card, cached, refreshed by a file watcher. Fine at hundreds of cards |
| Moving a card | Rewrite the whole board | One row | Rewrite one card (order is a per-card `rank`, see below) |
| Precedent in Ritemark | `.flow.json` (one per flow), not a board | None | Flows are one file per item in `.ritemark/`; scheduled agents are Markdown + front matter |

**SQLite is out**: native dependency, binary in a sync folder, unreadable, and Node's built-in `node:sqlite` is still experimental. **One JSON file** is simplest to write but puts every card in one conflict and one point of failure, which is the wrong trade for folders that live in Dropbox or git. The 2026-03-05 kanban analysis chose `.tasks.json` "for simplicity, move to per-task files if conflicts become real"; for writers' sync folders they are real from day one.

## The card file

`.ritemark/tasks/<id>-<slug>.md` (revised 2026-10-12: `<slug>.md`, `-2` if taken, so the editor tab reads well; the id stays in the front matter, see design.md §5). The id is six random lowercase letters and digits, checked against the board. The slug comes from the title at creation and is **never renamed**; a card's identity is the `id` in its front matter, not its filename.

```markdown
---
ritemark: task/1
id: k3f9x2
title: Rewrite the launch plan intro
stage: doing
rank: m
files:
  - docs/launch-plan.md
  - notes/audiences.md
created: 2026-10-11T10:02:00Z
updated: 2026-10-11T10:31:00Z
result:
  by: claude
  at: 2026-10-11T10:31:00Z
  seconds: 252
  summary: Rewrote the intro into one paragraph that names the three audiences.
  files:
    - docs/launch-plan.md
history:
  - { at: 2026-10-11T10:02:00Z, by: you, what: Created }
  - { at: 2026-10-11T10:05:00Z, by: you, what: Gave it to Claude }
  - { at: 2026-10-11T10:31:00Z, by: claude, what: "Finished: Rewrote the intro into one paragraph…" }
---
Make the intro shorter and name the three audiences: trainers, consultants and technical writers.

- [ ] Keep the first sentence
- [ ] Link the audience notes
```

| Field | Meaning | Who writes it |
|---|---|---|
| `ritemark: task/1` | Format marker and version; a file without it is not a card | Host |
| `id` | Stable identity; a duplicate (a copied file) gets a fresh id on the next write, with a history line | Host |
| `title` | One line, at most 200 characters | User, agent tool |
| `done_when` | One line, at most 200 characters: what done looks like | User, agent tool |
| `stage` | `idea`, `todo`, `doing` or `done` (fixed, see the plan) | User, agent tool, host |
| `rank` | Order within the stage: a short string sorted as text, so a move rewrites only the moved card | Host |
| `files` | Project-relative paths the card names; each is resolved inside the project before use | User, agent tool |
| `result` | The latest result from an agent: who, when, how long, a summary of at most 280 characters, the project files the turn changed (at most 20), and `check`: up to three short things the user should check | Host (from the agent's report or the turn's last message, and the turn's file metrics) |
| `ask` | A decision an agent left on the card: question, 2–4 options, who, when | Agent tool; cleared by the user's answer |
| `review` | An idea's review: verdict (`ready`, `unclear`, `already-on-board`, `not-a-task`), why, size, suggested title and description, who, when | Host (idea review) |
| `dropped` | `true` on an idea the user dropped (hidden under Dropped, Bring back clears it) | User |
| `history` | Short history, newest last, at most 50 entries; older entries drop off | Host |
| body | The description, ordinary Markdown | User, agent tool |

The `by` values are `you`, `claude`, `codex` and `opencode`. The board is single-user in this sprint: in a folder shared with others, their changes also read as "You" (stated limit).

## Machine-local facts stay out of the folder

Which conversation a card's work runs in, its turn, and the live state (sending, queued, working, needs you) are true only on this computer: a conversation lives in this computer's global storage. Writing them into the shared card would show "Claude is working" on a colleague's machine where nothing runs. So:

- **In the card file:** durable product facts: stage, result, history, the agent's question.
- **In `<globalStorage>/task-board/v1/`:** one record per handoff (task id, project scope id, card id, conversation id, runtime, turn id, lifecycle), written with the global stores' atomic pattern. A card that **waits for** another card's agent (the conflict guard's Wait for it) is a handoff record in a `waiting` state that names the blocking card and the chosen runtime; it is local because it is about agents running on this computer.

On another computer the card shows its result and history, and Give to agent starts a new conversation there.

## Writing safely

- One serialized mutation queue per board. Every change is semantic ("move to Done", "append a history line", "set the result"): read the file fresh, apply, write `<file>.tmp-<id>` and rename.
- A file that does not parse is **never overwritten**. The card shows "Couldn't read this card"; clicking it opens the file as a plain document (revised 2026-10-12, the card page replaces Open as document); the user fixes or deletes it. Same rule as the global stores' quarantine, without moving the user's file.
- A file watcher on `.ritemark/tasks/*.md` picks up edits from git, sync tools, the editor or an agent's own file tools, and refreshes both board surfaces. The host ignores the echo of its own writes by content hash.
- A writer outside Ritemark that changes the same card in the instant between the host's read and rename follows last-writer semantics on that one card. Accepted, as in Sprint 115.
- Delete moves the card file to the system trash (`workspace.fs.delete` with `useTrash`). Its history leaves the Log with it.
