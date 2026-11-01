# A5: chats and tasks as sources (R3; PR 1's part)

Read on 1 November 2026 from `main` at `b2ac230e`. PR 1 needs the words and the scope; whether a chat can open at its message is PR 2's (R8), and stays open here.

## Chats

- **Where the words are:** a `user-message` event's `text` and an `assistant-message` event's `content` (`src/conversations/types.ts`). Activity, attention (approvals, questions), boundaries and dispatch receipts are left out. A `user-message` with `origin: 'background-task'` is a line the host wrote when Claude reopened a turn, not the person's words: left out too.
- **Read only, in the worker:** `index.json` lists the chats with their `scopeId`, `revision` and `integrity`; each chat is `records/<id>.json`. The worker reads them directly, never through `ConversationStore`, whose reads can repair and rewrite the index. A chat is read again only when its revision moves; a chat gone from the index, marked `corrupt`, or with a tombstone (`tombstones/<id>.json`) never shows.
- **The scope:** the host gives the worker the same `resolveProjectScope(...)` id the AI sidebar's controller uses, so the list is this project's chats.
- **Following them:** the host watches `index.json` as Home does (`projectsHost.ts`) and tells the worker after 300 ms.
- **The largest record:** not measured on a test profile here. The reader keeps at most 1 MB of message text per chat, the newest messages first, and all chats together at most a quarter of R1's text budget (20 MB of 80), so many long chats can't take the worker past its heap cap (the review round of #631); past it, a chat is found by its title.
- **Who said it:** each passage carries `speaker`, `you` or the AI's runtime id, for the row's "You: …" or "Claude: …" (the Experience lead, question 4).

## Tasks

- From the board's snapshots (`BoardController.subscribe`), which carry `cards` and `archived`, each a `BoardCardView` with `title`, `doneWhen`, `description`, `stage`, `call`, `archived`, `updated`. The card files in `.ritemark/tasks/` are not read as documents.
- A task's passages: its Done when, then its description's paragraphs. Its "where": "Waiting for you" while it waits on the person (`call`), "Archived" when archived, else its column (Ideas, To do, Doing, Done).
- With the board turned off (`task-board`), the set sent is empty.
