# A5: chats and tasks as sources (R3; PR 1's part)

Read on 1 November 2026 from `main` at `b2ac230e`. PR 1 needs the words and the scope; whether a chat can open at its message is PR 2's (R8): answered below, on 2 November.

## Chats

- **Where the words are:** a `user-message` event's `text` and an `assistant-message` event's `content` (`src/conversations/types.ts`). Activity, attention (approvals, questions), boundaries and dispatch receipts are left out. A `user-message` with `origin: 'background-task'` is a line the host wrote when Claude reopened a turn, not the person's words: left out too.
- **Read only, in the worker:** `index.json` lists the chats with their `scopeId`, `revision` and `integrity`; each chat is `records/<id>.json`. The worker reads them directly, never through `ConversationStore`, whose reads can repair and rewrite the index. A chat is read again only when its revision moves; a chat gone from the index, marked `corrupt`, or with a tombstone (`tombstones/<id>.json`) never shows.
- **The scope:** the host gives the worker the same `resolveProjectScope(...)` id the AI sidebar's controller uses, so the list is this project's chats.
- **Following them:** the host watches `index.json` as Home does (`projectsHost.ts`) and tells the worker after 300 ms.
- **The largest record:** not measured on a test profile here. The reader keeps at most 1 MB of message text per chat, the newest messages first, and all chats together at most a quarter of R1's text budget (20 MB of 80), so many long chats can't take the worker past its heap cap (the review round of #631); past it, a chat is found by its title.
- **Who said it:** each passage carries `speaker`, `you` or the AI's runtime id, for the row's "You: …" or "Claude: …" (the Experience lead, question 4).

## A chat at its message (PR 2, R8)

Read on 2 November 2026 on `sprint-148-search-words-panel`, and checked in a dev instance.

- **Today:** `UnifiedViewProvider.openConversation(id)` posts `conversation/select`; the sheet loads the chat, and `UnifiedConversationView` scrolls to its end. Nothing could show a given message.
- **What the sheet draws:** one block per turn, keyed by the turn's id (`conversationProjection.ts`: a turn's id is its `user-message` event's `turnId`, for Claude's and for ChatGPT's and OpenCode's turns alike). Every message event carries its `turnId` in the record.
- **So:** the chat source keeps each message's `turnId` in its passage (`PassageLocation.turnId`, beside `eventId`), and an open from search passes it: `openConversation(id, { turnId, preserveFocus: true })` → `conversation/select { conversationId, turnId }` (optional; older pages ignore it). The page holds the request (`ai-sidebar/turnReveal.ts`) until that chat is the open one and the turn is drawn, then scrolls the transcript, not the page, to the turn once, a frame after its own scroll to the end, and keeps that place as if the person had scrolled there. A later select without a turn clears it. Each turn has a hidden anchor before it (`data-turn-anchor`), which the list's spacing doesn't count.
- **Checked:** the seeded chat "Report for the managers" (8 turns): the message searched for, in turn 6, was 20 px from the transcript's top after the open, with the transcript scrolled 610 of 1,059 px; again when the chat was already open (`qa/pr2-results-view/10-chat-at-message-*.png`). The keyboard stays in the results.
- **The chat's colour** for its row (the Experience lead, question 4) is the record's `identityColorSlot`, kept on the chat's source and result as `colorSlot`.

## Tasks

- From the board's snapshots (`BoardController.subscribe`), which carry `cards` and `archived`, each a `BoardCardView` with `title`, `doneWhen`, `description`, `stage`, `call`, `archived`, `updated`. The card files in `.ritemark/tasks/` are not read as documents.
- A task's passages: its Done when, then its description's paragraphs. Its "where": "Waiting for you" while it waits on the person (`call`), "Archived" when archived, else its column (Ideas, To do, Doing, Done).
- With the board turned off (`task-board`), the set sent is empty.
