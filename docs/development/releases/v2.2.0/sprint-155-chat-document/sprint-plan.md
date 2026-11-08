# Sprint 155: each chat shows its document

Track: Standard (two extension PRs in series, one review round and one proof each)<br>
Release tier: extension. `src/` and `webview/src/` only. The file icons already ship in `fileicons/`; nothing under `binaries/`, `patches/` or `vscode` changes.<br>
**Status:** Approved. PR 1 in progress.<br>
**Approval:** Jarmo approved this plan on 7 November 2026, in the Development manager's session: "kinnitan, alusta". The 1 November delegation ran until 2.2's release candidate, built on 6 November, so the plan was his to approve. He also allowed dev windows for the live checks ("aknaid võid avada").<br>
**Release:** [v2.2.0](../release-plan.md). The 6 November candidate (`4f5e80e3`) does not ship (Jarmo, 7 November: "me ei tee mingit 2.2.1 - 2.2 sees on veel vaja parandusi teha"), so this sprint goes into a new 2.2.0 candidate.

## Why

Jarmo, 7 November: a comment's task "läks ka valesse vestlusesse", and "vestluse pealkirja ees võiks olla väike ikoon, mis annab viite, et mis tabiga/failiga on vestlus seotud (viimane tab siis, kus vestlus muudatusi tegi)".

Today a comment's task always goes to the chat that is open on the AI's sheet. That was decision D5 (Jarmo, 14 September, Sprint 117: `docs/development/releases/v1.11.0/sprint-117-comment-agent-honesty/research/protocol-and-storage-decisions.md`). So a task about one document can land in a chat about another.

The experience is [experience 45](https://github.com/ProductoryHQ/ritemark-dev/blob/main/product/design/experience/experiences/chatdoc/README.md) (ritemark-dev `4ac0e8e`). Jarmo tried [its prototype](https://claude.ai/artifact/3QcqE6TrE14Y3avnVSwijo) and accepted it: "looks good". He chose that picking a chat leaves the desk as it is ("Laud jääb"), and he placed the work in 2.2 (decisions/log.md, two rows dated 7 November). This replaces experience 43 (each chat brings back its tab, placed in 2.3).

## What people get

1. **A comment's task goes to the document's own chat.** There is no question and no picker. The rule:
   1. the chat that last changed that document;
   2. if no chat has, the open chat, but only if it hasn't changed another document;
   3. otherwise, a new chat, named from the comment.

   A chat holding a comment's task for the document, waiting or working, counts as having changed it, as its newest change. So a second comment on the same document, or comments sent together, go into the first one's chat instead of a new chat each. Retry keeps its chat: it sends the task again to the chat its card names, and the rules pick again only when that chat is gone ("Conversation no longer available"). Both were added by the Experience lead (ritemark-dev `a9b53ca`; the prototype's version 2 queues a second comment that way).

   The comment says where its task goes, before and after sending, with today's words: "→ Draft Module 2 and 3" or "→ New conversation", then "In “Draft Module 2 and 3”" and Open conversation. When the task goes to a chat that isn't open, a short toast says so: "Sent to “Draft Module 2 and 3”" or "Sent to a new chat, “Shorter please”". That chat's place on the rail shows that it is working. The sheet stays on the chat you had open.
2. **The document's icon before the chat's name** in the AI's sheet's head. It shows the document the chat changed last. Pointing at it says "Changed Advokatuur.md", or "Changed Module 2.md and 2 more". A click brings that tab forward, or opens the document in a new tab if it is closed. A chat that changed nothing has no icon.
3. **All chats shows the same icon and the file name**, muted, before the time: "Module 2.md · 1 h ago · Current". The chats whose icon is the document in front come first, and the order follows as you change tabs.
4. **Nothing switches by itself.** Changing tabs leaves the chat as it is. Picking a chat leaves the desk as it is. The AI never brings a tab forward (Jarmo, 5 November); only the person's click on the icon does.

## Checked against `main` (`4f5e80e3`), 7 November, before any change

| Fact | Where | What it means for the build |
|---|---|---|
| The comment task's destination is always the open chat | `UnifiedViewProvider._resolveOpenConversation` (the only `resolveOpenConversation` the controller has); `CommentTaskController` asks it at preview, at send and at retry | The three rules replace this one resolver. Preview and send keep asking one place, so the caption and the send agree. Retry no longer asks it: it goes to the card's own chat, and asks the rules only when that chat is gone (otherwise rule 3 would make a new chat on every retry of a task that failed before it changed anything) |
| Today's caption and receipt words exist | `webview/src/components/comment/commentTaskCopy.ts` ("→ …", "→ New conversation", "In “…”") | Reused as they are |
| A turn can run in a chat that isn't open | `_runtimeSessions` is per conversation; `parallelChats` is `stable`; `_enqueueCardTask` already queues a task board card's task in a new chat or one loaded from history; `ThreadRail.tsx` marks a working chat | The comment task uses the same path, without changing the sheet's chat |
| **What a chat changed is not kept** | `ActivityEventV1.fileReferences` is defined and parsed (`conversations/types.ts`), but no production code writes an activity event. A turn's changed files reach the live sheet (`agent-result.filesModified`) and the comment task's terminal, but `completeRuntimeTurn` does not store them | This is new work: each finished turn records the files it changed, in the conversation's record. Earlier chats have no such record, so they show no icon and count as "changed nothing" until they change a file again |
| **Only Claude Code reports changed files** | `AgentRunner.processAssistantMessage` collects Write and Edit paths (Read is separate). `CodexRuntime` reads only `agentMessage` from `item/completed`; it sees file changes only in approval requests. `AcpRuntime` reads an `edit` tool call's `locations` only for approvals | Codex and OpenCode must report changed files too (the runtimes share one interface: `AgentRuntime.filesModified`). Codex from its completed file-change items, OpenCode from its completed `edit` tool calls. A read never counts (Development manager, 7 November) |
| The tab row's file icons are Ritemark's own theme | `fileicons/ritemark-icon-theme.json` (`workbench.iconTheme: ritemark-icons`) | The host resolves a file's icon from that theme and gives the sheet its URI; no icon is drawn by hand |

## PRs

| PR | Branch | What | Depends on |
|---|---|---|---|
| 1, the fix | `sprint-155-chat-document` | Each runtime reports the files a turn changed; the conversation's record keeps them; the comment task's three rules, with the new chat named from the comment (no "@claude", up to six words) and the "Sent to …" toast (`_ritemark.briefToast`); the task queues in a chat that isn't open without switching the sheet | — |
| 2, what you see | `sprint-155-chat-document-icon` | The head's icon (16 in a 24 square, 8 from the sheet's left edge, the name 6 later; hover is the soft accent fill with the icon in accent, as the rail's buttons; keyboard focus, the tooltip on focus too; label = the tooltip's words plus ". Bring it forward"); the click brings the tab forward in its own group, or opens the document at the row's end; All chats' meta line (icon at 11, file name, a middle dot, then the time or status) and its order by the document in front | PR 1's record |

Both PRs: shadcn `Button` and `ui/tooltip.tsx` (never a native `title`), the global `cursor: pointer`, Light and Dark.

## Rules decided here (small, the manager's)

- **A file that is gone** (deleted or moved): the icon shows the newest changed file that still exists; if none does, there is no icon. Renames are not followed. The tooltip's "and N more" counts only files that still exist, the same set the icon draws from, so it never names a file a click can't reach (the Experience lead, 7 November).
- **The task's chat is working:** the task waits in that chat's queue, as a card's task does today. The card uses today's words, "Queued for Claude" with "In “<chat>”" and Open conversation; the "Sent to “…”" toast still shows, because the task has been handed over. If there is no room for one more working chat, it does the same as a card's task does now; PR 1 checks what that is first and keeps it.
- **A comment assigned to another AI** than the chat's last one still lands in the document's chat, with today's caption first: "→ <chat> · Codex takes over". One chat per document.
- **Chats from before the build** have no icon and route as if they changed nothing: for them it is the same as today (the Experience lead agreed, ritemark-dev `f7f5c31`).
- **No new counts.** The User lead's numbers are not part of this sprint.

## Proof plan

Each PR has `proof-155-N.txt` in its worktree (not committed), PASS/FAIL lines, and screenshots for the Experience lead before the merge.

**PR 1**
- Unit tests, written to fail first on `main`: the three rules (each case, the open chat that changed another document, an old chat with no record, a gone file); a pending task counts as its chat's change (two comments on one document in a row make one chat; a batch makes one chat); retry keeps the card's chat and picks again only when it is gone; preview and send pick the same chat; the new chat's name from the comment's words.
- The record: a turn's changed files are stored and read back; an old record without them still parses.
- Runtimes: Claude Code counts Write and Edit, not Read; Codex counts completed file changes from its protocol at the bundled version, not commands; OpenCode counts completed `edit` calls, not `read`.
- Live, in a hidden, isolated dev instance with a test key from the vault: two chats change two documents; a comment on the first document goes to its chat while the second chat stays open; the toast shows; the sheet does not switch; no tab comes forward.
- Shots for the Experience lead, Light and Dark: the caption in each case ("→ <the document's chat>", "→ New conversation", "· Codex takes over"); the "Sent to …" toast (`_ritemark.briefToast`, bottom right, 4 s); the rail's working mark on a chat that isn't open; the card's Queued, working and Completed states; the sheet still on the chat that was open.
- The pre-commit hook passes.

**PR 2**
- Unit tests: the tooltip's words (one file, several), no icon for a chat that changed nothing, the order of All chats as the front document changes.
- Live: the icon's hover, focus and click (a tab in another group comes forward there; a closed document opens at the row's end); All chats' meta line and order.
- Shots for the Experience lead, Light and Dark: the icon at rest, on hover, with keyboard focus and pressed; the tooltip for one file and for several; a long chat name (the name keeps its ellipsis, the icon never shrinks); a chat with no icon, its name where it is today; All chats' meta line, and its order before and after a tab change.

**Not run, and why:** Windows (the Windows rows go into Gate 2 of the new candidate). Live checks wait for Jarmo's word on the screen (his 6 November rule: no screen use while he trains); the unit tests do not.

## After the sprint

- `docs/development/architecture.md`: the conversation record's changed files and the comment task's destination rule.
- The comment task's D5 note in Sprint 117's decisions gains a pointer to this plan.
- CHANGELOG lines; the release notes' line at the release step (`release-notes` skill).
- The new 2.2.0 candidate's checklist gets rows for both PRs.
