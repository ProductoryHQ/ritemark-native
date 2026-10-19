# What waits: the audit (W3, R3, R6)

Checked 2026-10-19 on `sprint-134-project-at-the-centre` (main `eae1dedd` with #462's plan). Line numbers are this branch's. It covers Jarmo's answer of the same day: a chat's unread reply counts as waiting too ("Also unread answers").

## The result in one table

| Part | Read from | Counted when | Never counted |
|---|---|---|---|
| A card's call, the open project | The board's own snapshot (`BoardController.snapshot()`, `calls`) | As the Tasks place counts it today | — |
| A card's call, another project | Its card files and this computer's hand-off records, through the same rules | A call the project's own board would show if it were opened now | An archived card; a project whose tasks folder can't be read (no count, not zero) |
| A chat's question or approval | `index.json`, raw | `lifecycle.state: 'needs-user'` and a live window holds the chat | A `needs-user` left by a crash or a quit; a card's chat |
| A chat's unread reply | `index.json`, raw, with two new fields | Its newest reply finished after the person last had the chat in front on a shown sheet | Chats from before this build; a card's chat; a stopped or interrupted turn |

## 1. Another project's calls

**The rules exist once.** `deriveWho(card, handoff)` (`taskBoard/BoardController.ts:176`) is exported and has no `vscode` import. The loop that turns cards into calls is inside `snapshot()` (`BoardController.ts:264–270`): it skips archived cards and keeps a call only when `who.call && who.since`. That loop moves into one exported function, `callsOf(cards, handoffs)`, which `snapshot()` and `waiting.ts` both call, so nothing re-implements it (E1).

**Card files.** `<folder>/.ritemark/tasks/*.md`, parsed by `parseCardFile` (`taskBoard/cardFile.ts:198`, gray-matter, no `vscode`). A file that doesn't parse is not a call (the board lists it as unreadable, `BoardController.ts:255`). No `tasks` folder means no board, so the board's part is 0. A `tasks` folder that can't be read at all (permissions, a cloud drive) gives no count (`undefined`), never 0 (R3).

**Hand-off records.** `<globalStorage>/task-board/v1/<projectKey(folder.fsPath)>/<cardId>.json` (`taskBoard/CardTaskStore.ts:54–60`). They hold the card id, state, `since`, `needs`, `failure` and the card's `conversationId`, but no folder, so they are found only from a known folder. They map to `CardHandoffView` as `CardHandoffLedger.list()` maps them (`CardHandoffLedger.ts:107–121`).

- **Read them without `CardTaskStore.load()`.** `load()` renames a record it can't decode to `*.unreadable` (`CardTaskStore.ts:92–97`): it writes. Another project is read with a decode-only reader (the same `decode`, exported), which skips what it can't read.

**A hand-off left in flight.** The ledger has no shutdown step. A card whose turn was running when its window closed (cleanly or not) keeps `running`, `queued`, `accepting` or `needs-user` in its record. Only the project's next start turns it into `interrupted` (`recover()`, `CardHandoffLedger.ts:88–103`), which `deriveWho` reads as a `failed` call. So:

- a project **open in another window**: its records are live, read as they are;
- a project **open in no window**: an active state is read as `interrupted`, as `recover()` would make it, so the count matches what its board shows once opened.

Nothing records today which project a window has open. **New: a window marker**, as `TurnOwners` does for chats (`conversations/turnOwners.ts`): each window writes `<globalStorage>/projects/v1/windows/<pid>.json` with its folder URI at activation and removes it at dispose; a file whose process is gone holds nothing. `waiting.ts` reads these files and never deletes one (the writer side cleans dead ones, as `TurnOwners.isClaimedElsewhere` does).

## 2. Chats

**One read for every project.** `<globalStorage>/conversations/v1/index.json` holds a summary per chat: `scopeId`, `title`, `lifecycle`, `lastActivityAt` (`conversations/types.ts:184–199`). Every store write rebuilds it from the records and writes it by temporary file and rename (`ConversationStore.ts:611–646, 708–713`), so another window's read never sees half a file.

- Read it raw. Never `store.list()` without a scope: it runs `reconcile()`, which reads every record and rewrites the index (`ConversationStore.ts:611`).
- A project's chats are the entries whose `scopeId` equals `resolveProjectScope({ folderUris: [folderUri] }).scopeId` (`conversations/projectScope.ts:47–66`, pure). The project list keeps the URI as `uri.toString()`, as the host's own scope does.
- The index's decoder builds each entry from the fields it knows and ignores the rest (`ConversationStore.ts:123–160`), and so does the record's (`types.ts:622–690`). New optional fields therefore don't break this build's older readers, and an older Ritemark that rewrites a record simply drops them (a downgrade loses read state, nothing else).

**A question or an approval.** `lifecycle.state === 'needs-user'` with `attentionKind` `approval`, `question` or `plan-review`. A crash or a quit leaves it so until that scope's next start sweeps it (`ConversationController.ts:650–669`). It counts only when a live window holds the chat: a `TurnOwners` file of a running process lists its id (`turnOwners.ts:61–83`), read without deleting.

**An unread reply (Jarmo, 19 October).** The store has no read marker today (no `unread`, `seen` or `readAt` anywhere in `src/` or the webview), and the chat rail has no unread mark: its statuses are idle, running and attention (`webview/src/components/ai-sidebar/threadStatus.ts:55`). The marker:

- **The record gains `readAt`** (optional, ISO): when the person last had the chat in front on a shown sheet.
- **The summary gains `readAt` and `lastReplyAt`.** `lastReplyAt` is derived in `summarizeConversationRecord` (`types.ts:701`) from the events: the newest `assistant-message` with `terminalStatus` `completed` or `failed`, or `boundary` `failed`. A reply the person stopped (`cancelled`), a turn ended by a restart (`interrupted`) and `context-restored` are not replies.
- **Unread** = `readAt` and `lastReplyAt` both present and `lastReplyAt > readAt`.
- **A record without `readAt` is read.** Every chat from before this build is, so the first 2.0 start shows no backlog.
- **When a turn ends** (its terminal checkpoint, which is already a write): if the chat is in front on a shown sheet, `readAt` becomes the reply's time; otherwise, if `readAt` is absent, it becomes the time of the turn's first event, so the reply is unread. A present, older `readAt` stays.
- **When the chat is shown**: on `conversation:selected` (`UnifiedViewProvider.ts:554`) while the sheet is visible, and when the sheet becomes visible with a chat in front (`onDidChangeVisibility`, `:1560`), `readAt` becomes now, written only when the chat has an unread reply, so selection costs no write otherwise. The host already knows both facts: `_activeConversationId` and `this._view.visible`.
- **A card's chat** is never counted as a chat. Its call is the card's (`review`, `failed`, `needs-you`). Its id is the hand-off record's `conversationId`: from the ledger in the open project, from the records elsewhere.
- Background turns the runtime opens itself (Sprint 128, `origin: 'background-task'`) end like any turn, so their reply is unread unless its chat is in front.

The webview's own unread mark on the rail is a design question sent to the Experience lead on 19 October. The count does not depend on it.

## 3. The open project

The same functions, fed live: the board's snapshot (its subscription already pushes on every change) and the chat store's change events. The Tasks place's badge stays `snapshot.attention.count` (`taskBoardHost.ts:100–106`), so the Tasks tab (019, from that badge) and the place can never differ. The project's total adds its chats.

## 4. Cost

Measured on this Mac (Node 22.22.1, M-series), with a fixture of 20 projects, 50 card files each (the sample project's card), 5 hand-off records each, and a 400-entry `index.json`: **46 ms the first time, 30 ms after.** Read when Home or the switcher is shown, cached for 30 s, never on a timer. The bench is in the session's scratch folder, not the repo.

## 5. What changes in the plan

- **Spec R3:** nothing beyond the 19 October change already made. "A project whose board cannot be read shows no count" covers an unreadable `tasks` folder. An unreadable `index.json` makes every project's chat part unknown, so no project shows a count, rather than a count without chats.
- **Technical plan W3:** `callsOf` extracted from `snapshot()`; a decode-only hand-off reader; the window marker (`projects/v1/windows/<pid>.json`); the read marker as above.
- **Tests:** `waiting.test.ts` adds a project held by no window with a `running` hand-off (counted as failed) and the same project held by a live window (not counted), a `needs-user` chat with and without a live owner, an unread, a read and a pre-build chat, and a card's chat. The store's tests cover `readAt`'s round trip and `lastReplyAt` from each terminal kind.
