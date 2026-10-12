# Sprint 130 Technical Plan — Task board

**Status:** approved with the plan 2026-10-12; Phase 0 probes first. Proposed shapes, not final code: when the code diverges, this file changes first.
**Architecture gate:** **this sprint changes architecture.** It adds a `src/taskBoard/` subsystem, new webview↔host messages, a second agent tool group, and it generalises `BrowserToolsInjector`, which CLAUDE.md lists as a locked decision. `docs/development/architecture.md` and that CLAUDE.md row are updated before the sprint closes (W8).

Facts behind every claim below: [research/current-state-audit.md](./research/current-state-audit.md). Storage reasoning: [research/storage-decision.md](./research/storage-decision.md). Paths are relative to `extensions/ritemark/`.

## Architecture overview

```text
 Activity bar "Tasks"                         Editor area
 ┌───────────────────────┐                    ┌──────────────────────────────────────┐
 │ TasksViewProvider     │                    │ TaskBoardPanel (WebviewPanel)        │
 │ data-editor-type=     │                    │ data-editor-type="task-board"        │
 │ "tasks-panel"         │                    │ Your calls · Board · Ideas · Log     │
 └──────────┬────────────┘                    └──────────────────┬───────────────────┘
            │ board/* (protocol.ts, exact-field)                 │
            └──────────────────────┬─────────────────────────────┘
                                   ▼
                     BoardController (no vscode import)
          ┌────────────────┬───────┴──────────┬─────────────────────────┐
          ▼                ▼                  ▼                         ▼
   BoardStore         CardTaskStore      IdeaReviewer           board tool group
   .ritemark/tasks/   <globalStorage>/   (one-shot runtime,      (RitemarkTools registry)
   *.md, watcher      task-board/v1/     like ConversationTitle  ├ Claude: SDK MCP server
                      handoff records     Generator)             ├ Codex: dynamic tools
                           │                                     └ OpenCode: stdio adapter + IPC
                           ▼
              UnifiedViewProvider (sidebar half of Sprint 117, generalised)
              availability gate → enqueue (new or bound conversation) → agent-execute(taskId)
              → turn events fan out to every task listener by turn id
```

Both surfaces are projections. They never talk to each other; the host pushes one `board/state` snapshot to every open surface after any change, as Transcribe does.

## Existing patterns reused

| Pattern | From | Used for |
|---|---|---|
| Side-bar `WebviewView` on the shared `webview.js`, `data-editor-type`, ready → state snapshot, `view.badge` | `src/views/TranscribeViewProvider.ts` | `TasksViewProvider` |
| One editor-area `WebviewPanel` + `WebviewPanelSerializer` + `onWebviewPanel:` activation | `src/settings/RitemarkSettingsProvider.ts:237-265, 499-526` | `TaskBoardPanel` |
| Flag as an experimental kill switch, default on through `ritemark.features.<id>: true`, a disabled notice instead of a `when` clause | Home (`home-launcher`) | `task-board` flag |
| One file per item under `.ritemark/` | `src/flows/FlowStorage.ts` | `.ritemark/tasks/*.md` |
| Front matter parsing | `gray-matter` (`ritemarkEditor.ts`, `editorSync/state.ts`) | Card files |
| Injected filesystem, mutation tail, temp-then-rename, never guess around an unreadable file | `ConversationStore`, `CommentTaskStore` | `BoardStore`, `CardTaskStore` |
| Lifecycle states, transition table, binding generations, `summarizeTerminalText`, `safeFailureMessage` | `src/commentTasks/types.ts`, `CommentTaskController.ts` (exported; imported as they are) | Card handoffs |
| Availability gate, enqueue handshake, `agent-execute` with `taskId`, attention/terminal events by turn id | `UnifiedViewProvider` sidebar half of Sprint 117 | Give to agent |
| One-shot, tools-off runtime call on the user's chosen runtime | `src/conversations/ConversationTitleGenerator.ts` | Idea review |
| Project-path resolution with `realpath` inside the workspace | `src/views/chatLinkTargets.ts` | A card's `files` |
| `MoreActionsTrigger` + context menu, `Tooltip`, `Dialog*`, `Icon`, `Pill`, `Input`, `Textarea` | `webview/src/components/ui/` | All board UI |
| `RowMenus` (one action list → More actions + right-click) | `ai-sidebar/ConversationsPanel.tsx:49`, exported | Card rows |
| Display text vs runtime prompt in one turn | Sprint 109 conversation events, Sprint 117 `displayText` | The card's first message reads as the user's request |
| Words and glyphs for agent state | `activityState.ts`, `conversationActionsModel.ts`, `commentTaskCopy.ts` | `taskCopy.ts` (design §10) |
| Plain `npx tsx` test scripts chained in `npm test` | `package.json` `scripts.test` | New tests |

## New patterns introduced

| New | Why an existing one cannot carry it |
|---|---|
| `src/taskBoard/` subsystem | A board is neither a document (editorSync), a conversation (conversations) nor a comment (commentTasks). Same shape as `googleDocs/` and `commentTasks/`: injected dependencies, one controller, typed protocol |
| The first atomic store **in the project folder** | FlowStorage writes in place without a temp file; cards are written by the user, agents and the host at once |
| A second agent tool group and a tool registry | Browser tools are hardcoded per runtime in three hand copies; a second group would otherwise mean three more copies (audit §5) |
| Several task listeners on `UnifiedViewProvider` | It holds exactly one `CommentTaskController` today (G1) |
| Enqueue into a new conversation for a card | The Sprint 117 path can only target the conversation open in the sidebar (G2) |
| Activity-bar icon `media/tasks-icon.svg` (Phosphor) | Every Ritemark activity-bar entry is a Phosphor SVG; a codicon would not match |
| `ui/tabs.tsx` + `@radix-ui/react-tabs` | The board has four peer views with counts; `FilterChip` is a toggle, not a tablist, and hand-rolling a tablist breaks the "always the shadcn primitive" rule. Bundled into `webview.js`, so it ships like any webview change |
| A quick-add command with VS Code's input box | Capturing a task must not leave the document (design §1); no existing command adds anything to a list |

## W0 — Phase 0 probes (before any product code)

Each probe is a short script or dev-instance check, recorded in `research/phase-0-probes.md`. A failed probe stops the affected workstream and goes to Jarmo with options.

| Probe | Question | If it fails |
|---|---|---|
| P1 | Can the sidebar create a conversation without making it the open one, and enqueue into a conversation that exists but is not open, or is only in the durable history (not loaded)? | Reveal the card's conversation first (`openConversation` exists), then enqueue; for a new card, open its new conversation (design.md says what the user sees) |
| P2 | Does a Codex thread resumed with `thread/resume` keep the dynamic tools it was started with? | Start a fresh thread when a card task needs tools and the thread was resumed (the Sprint 110 context pack carries the history) |
| P3 | Does a call to an MCP tool trigger OpenCode's `session/request_permission`? (Keyless probe as in the 2026-09-26 browser probe, with isolated XDG folders) | If yes: auto-allow only the `ritemark_board_*` tool titles in `AcpRuntime._handlePermission`, documented |
| P4 | Does the Claude Agent SDK 0.3.289 `tool()` accept zod v4 raw shapes from our `zod` 4, and does `z.toJSONSchema` give Codex/OpenCode schemas equal to today's hand-written browser schemas? | Keep zod for Claude and hand-written JSON Schema for the other two, generated from one table of fields |
| P5 | Can Codex and OpenCode give the turn's last assistant message separately from the whole stream (G4)? | Summarise the last paragraph of the stream |
| P6 | Does a fifth container declared first among Ritemark's land just above Transcribe (after VS Code's built-ins; measured 2026-10-12), carry a badge, and does a 256-viewBox Phosphor SVG render at the 16 px size patch 002 sets? | Adjust the declaration or the icon; no patch |
| P7 | Can the host show a hidden or never-opened AI sidebar without taking focus (the agent runs in its webview)? | Show it, then return focus to the editor or view that had it |

**Results (2026-10-12, [research/phase-0-probes.md](./research/phase-0-probes.md)): none failed, no fallback needed.** P4 and P7 pass as planned. P1, P2, P5 and P6 pass with a change, and P3 found no prompt but adds hardening. The changes are written into W2–W5 below: the sidebar store adds or loads a card's conversation without opening it (P1); the Codex continuation fingerprint includes the tool set (P2); `_handlePermission` allows board tools (P3); both runtimes keep the last assistant message (P5); the badge comes from a hidden companion tree view (P6); and the sidebar is shown with `{ preserveFocus: true }` (P7).

## W1 — Card files and the board store

**`src/taskBoard/cardFile.ts`** (pure, no `vscode`): `parseCardFile(text, fileName) → Card | CardReadError` and `serializeCard(card, original?) → string` with `gray-matter`. Rules:
- A file is a card only with `ritemark: task/1` in its front matter. Other `.md` files in the folder are ignored (and listed nowhere).
- Unknown front-matter keys are preserved on rewrite; the body is written back byte-for-byte unless the description changed.
- Bounds: title ≤ 200 characters, one line; `files` ≤ 20 entries; `history` ≤ 50 (oldest dropped); `result.summary` ≤ 280; `ask.question` ≤ 500, 2–4 options of ≤ 80 characters; description ≤ 16 KiB through tools (no cap on the user's own file).
- `rankBetween(a?, b?)`: a short base-36 string strictly between two ranks; a new card gets a rank before the first card of its stage (new cards land on top).
- Ids: six random `[a-z0-9]`, unique on the board; a duplicate id (a copied file) is re-minted on the next write with a history line "Copied from k3f9x2".

**`src/taskBoard/BoardStore.ts`**: one instance per project folder (`workspaceFolders[0]`, the app's `workspacePath`).
- Injected filesystem (the seven-method `ConversationStoreFileSystem` plus `trash`) so tests run in Node.
- `list()` reads `.ritemark/tasks/*.md` once, then serves a cache; `invalidate(fileName)` re-reads one file.
- `mutate(cardId, change)` runs on one serialized tail: re-read the file, refuse if it does not parse (never overwrite), apply the semantic change, append a history entry, write `<file>.tmp-<id>`, rename, remember the written hash.
- `create(card)` creates `.ritemark/tasks/` on first use (`mkdir -p`) and writes `<id>-<slug>.md` exclusively.
- `remove(cardId)` moves the file to the system trash.
- The watcher (`vscode.workspace.createFileSystemWatcher(new RelativePattern(folder, '.ritemark/tasks/*.md'))`, composed in `extension.ts`) calls `invalidate`; a change whose hash equals the last write is the host's own echo and is ignored.

## W2 — Board controller and protocol

**`src/taskBoard/protocol.ts`**: exact-field request/result/event union and `decodeBoardRequest`, the only place webview JSON becomes a board request (the `commentTasks/protocol.ts` and `googleDocs/protocol.ts` pattern).

| Webview → host | Fields |
|---|---|
| `board/ready` | `surface: 'sidebar' \| 'panel'` |
| `board/add` | `requestId`, `title`, `stage` |
| `board/update` | `requestId`, `cardId`, optional `title`, `doneWhen`, `description`, `files` |
| `board/move` | `requestId`, `cardId`, `stage`, optional `beforeCardId` |
| `board/delete` | `requestId`, `cardId` |
| `board/open` | `cardId` (side bar → open the panel with this card) |
| `board/add-files` | `cardId` (host shows a file picker rooted at the project) |
| `board/open-file` | `path` (re-resolved inside the project before opening) |
| `board/open-as-document` | `cardId` |
| `board/give` | `requestId`, `cardId`, `runtimeId`, optional `force` (Start now past the conflict guard) |
| `board/wait`, `board/unwait` | `requestId`, `cardId` (+ `runtimeId` for wait) |
| `board/follow-up` | `requestId`, `cardId`, `text` (Ask for changes, or an answer in the user's own words) |
| `board/answer` | `requestId`, `cardId`, `optionIndex` (Something else… is a `board/follow-up`) |
| `board/mark-done` | `requestId`, `cardId` |
| `board/drop`, `board/bring-back` | `requestId`, `cardId` (ideas only) |
| `board/open-conversation`, `board/stop`, `board/retry` | `cardId` |
| `board/review-idea`, `board/accept-review` | `requestId`, `cardId` (+ `runtimeId` for review) |
| `board/recover` | `action: 'sign-in-claude' \| 'sign-in-codex' \| 'settings'` (mapped to `ritemark.claudeLogin`, `ritemark.codexLogin`, `ritemark.aiSettings`, as `comment:recover`) |

| Host → webview | Fields |
|---|---|
| `board/state` | Full snapshot: `folder` (name or none), `enabled`, `cards[]` (projection: id, title, stage, rank, description, files with `exists`, result, ask, review, last 50 history entries, `handoff` = {state, runtimeId, conversationTitle, canOpen} or null, `readError`), `calls[]` (derived), `runtimes[]` (availability from `deriveRuntimeAvailabilities`, default runtime), `focusCardId` |
| `board/result` | `requestId`, `ok`, optional error code + safe message + recovery |

The Log is derived in the webview from the cards' history (it is in the snapshot already), grouped by local day.

**`src/taskBoard/BoardController.ts`** (no `vscode` import; every dependency injected, as `CommentTaskController` and `GoogleDocsController`):
- Board operations above, each one a `BoardStore.mutate` with its history line.
- **Who moves next** is derived, never stored: a handoff that is accepting/queued/running → the agent; needs-user, a pending `ask`, a `result` on a card not in Done, or a failed/interrupted handoff → you; otherwise nobody.
- **Your calls** are derived the same way, one per card, ordered needs-user → decision → review and failed, newest first inside each (design §7). A stopped card is not a call.
- **Locks:** while a handoff is accepting, queued, running or needs-user, `move` out of Doing and `mark-done` are refused with "the agent is still working".
- **Attention summary** (in the snapshot): number of calls, the oldest call's wait time, and how many agents are blocked mid-turn (needs-user). Each call carries `since` (when its card started waiting on the user). Calls sort by kind, then longest-waiting first.
- **Next up**: the top To do card that has no active or waiting handoff.
- **Doing limit**: `wipLimit` per project in `workspaceState` (default 3; `null` = no limit). `give` on a card outside Doing answers `doing-full {count, limit}` when Doing is at the limit, unless `force`; `board/queue` records a `waiting` handoff with reason `slot`; whenever a card leaves Doing the controller starts queued cards in To do order while there is room (through the normal give path, which re-checks conflicts). `move_card` from an agent into a full Doing is refused ("Doing is full"); a user move is allowed and the snapshot flags it as over. `board/set-wip` sets the limit.
- **AI sidebar capacity** (found in P1): at most five conversations can be working or waiting on the user at once (`runtimeAttachmentPolicy.ts`), the user's own chats included. A card turn past that cap would fail at `agent-execute`. The host exposes the capacity decision (`canAttachRuntime(conversationId)`); `give` checks it before enqueueing and, when blocked, records a `waiting` handoff with reason `capacity` ("Starts when the AI sidebar has room"). The controller retries waiting cards on every terminal turn event, which G1 already delivers to every listener. A capacity error that still arrives at dispatch puts the card back in that queue instead of Failed.
- **Conflict guard**: `give` first looks for another card with an active handoff (accepting, queued, running, needs-user) that names one of the same files. If it finds one, it answers `conflict {withCardId, file}` instead of starting; the webview shows the Wait for it / Start now panel. `board/give` takes `force: true` for Start now. `board/wait` records a `waiting` handoff (blocking card + runtime); when the blocking card's turn reaches any terminal state, the controller starts every card waiting for it through the normal give path (which re-checks for conflicts). `board/unwait` drops it.
- New cards get a rank before the first card of their stage (they land on top). Reopen is a `move` to To do.
- **Badge**: the number of calls, set on a hidden companion tree view `ritemark.tasksBadge` (`"when": "false"`, created with `createTreeView` at activation) in the Tasks container. Its badge shows from activation, before Tasks has been opened, which a webview view's badge cannot do (P6). The webview view never sets a badge, because two badges in one container add up. `undefined` clears it.
- **Agents may not** move a card to Done, delete a card, edit history or set a result except through `report_result` (W5).

## W3 — The two surfaces

Host:
- `src/views/TasksViewProvider.ts`: `WebviewViewProvider`, `viewType` `ritemark.tasksView`, `<div id="root" data-editor-type="tasks-panel">`, `retainContextWhenHidden: true`. Flag off → one-line notice (Home's pattern).
- `src/taskBoard/TaskBoardPanel.ts`: one panel per window, `viewType` `ritemark.taskBoard`, title "Task board", `reveal` if open, serializer for restore, `data-editor-type="task-board"`. Command `ritemark.openTaskBoard` (optional `cardId`).
- `package.json`: container `ritemark-tasks` ("Tasks", `media/tasks-icon.svg` = Phosphor `kanban` regular, declared **first** among Ritemark's containers so it lands just above Transcribe; confirmed in P6), view `ritemark.tasksView`, the badge-only tree view `ritemark.tasksBadge` (`"when": "false"`), commands `ritemark.openTaskBoard` ("Tasks: Open Board") and `ritemark.addTask` ("Tasks: Add a Task…", VS Code input box, no default keybinding), `onWebviewPanel:ritemark.taskBoard`, `ritemark.features.task-board` default `true`. No `view/title` button: Open board is an icon button inside the view, beside the add field (design §3).
- `src/views/HomeViewProvider.ts`: the quick action label "New AI task" → "New AI conversation" (R14); the command is unchanged.
- `extension.ts`: compose `BoardStore`, `CardTaskStore`, `BoardController`, both surfaces, the watcher, `registerWebviewPanelSerializer`, and register the controller as a task listener on `UnifiedViewProvider`.

Webview (`webview/src/components/tasks/`), lazy-loaded from `main.tsx` for `tasks-panel` and `task-board`; `tasks-panel` joins the side-bar background list (lines 50–57):

| File | Role |
|---|---|
| `TasksPanel.tsx` | Side bar: quick add, Your calls, stage sections, card rows (see design.md) |
| `TaskBoard.tsx` | Editor area: tabs Your calls · Board · Ideas · Log, `vscode.setState` for the open tab |
| `BoardColumns.tsx` | Board tab: four stage columns, drag and drop between and within stages (native HTML5 drag, plus Move to… in the More actions menu as the keyboard path) |
| `CardRow.tsx` | One card, two densities (side-bar row, board tile); its More actions menu and context menu come from one action list |
| `CardDetail.tsx` | Card detail (shape per design.md): title, description, files, state, Give to agent, result, ask, history |
| `CallsView.tsx`, `IdeasView.tsx`, `LogView.tsx` | The other three tabs |
| `AgentSplitButton.tsx` | The one split button for every agent action (Give to, Review with, Review again with, Retry with, Send to): the label names the runtime, the caret menu lists the three runtimes with their availability, and the choice becomes the board's default (`workspaceState`). Row menus use the same runtime list as an in-place submenu |
| `NoteBox.tsx` | The in-place reply box for Ask for changes… and Something else… |
| `taskCopy.ts` | Pure state → words + glyph table (design §10), shared by every surface (the `commentTaskCopy.ts` pattern), tested |

Shared pieces: `ui/tabs.tsx` is new (shadcn's Radix Tabs), which adds **one webview dependency, `@radix-ui/react-tabs`** (MIT, the same family as the other `ui/` primitives; compiled into `webview.js`). `RowMenus` is exported from `ai-sidebar/ConversationsPanel.tsx` instead of copied. `kanban` joins `iconMap` and `ritemark-design/references/iconography.md`. Drag and drop is native HTML5, as in `flows/NodePalette.tsx`.

## W4 — Give to agent and the result coming back

**`src/taskBoard/CardTaskStore.ts`**: handoff records in `<globalStorage>/task-board/v1/records/<taskId>.json`, same file pattern as `CommentTaskStore`, importing its lifecycle table and helpers from `commentTasks/types.ts` unchanged. Record: `taskId`, `bindingGeneration`, `requestId`, `scopeId`, `cardId`, `runtimeId`, `destination {conversationId, created}`, `turn {conversationTurnId}`, `prompt {text, sha256}`, `lifecycle`, `createdAt`, `updatedAt`. Retention: terminal records older than 30 days are pruned at activation (Sprint 117's `prune` is never called at runtime; this store calls its own).

**`src/taskBoard/boardPrompt.ts`**: the one prompt builder for a card. It returns the two texts the Sprint 109 turn already keeps apart: `displayText` (what the conversation shows as the user's message) and `prompt` (what the runtime receives).

```text
displayText:
  Rewrite the launch plan intro

  Done when: one paragraph that names the three audiences.

  Make the intro shorter and name the three audiences: trainers, consultants and technical writers.

  Files: docs/launch-plan.md, notes/audiences.md

prompt = displayText + one line, only when board tools are injected for that runtime:
  (This is card k3f9x2 on the project's task board.)
```

How to report (`report_result`), when to use `ask_user`, and that only the user marks a card done are in the TASK BOARD section of the capability context (W5), not in the message, so the user reads their own request. A follow-up is a short turn in the same conversation: the user's own words for Ask for changes… and Something else…, "I choose: {option}" for a decision button; the runtime prompt again adds the card line. Files are listed by path; the agent opens them with its own tools (no attachments: a card may name large files).

**Sequence** (Give to agent on a card with no conversation on this computer):

```text
board webview          BoardController                 UnifiedViewProvider            AI sidebar webview
board/give ─────────→  availability gate (shared)
                       persist handoff `accepting`
                       move card to Doing, history
                                    ──── enqueue {taskId, runtimeId, prompt,
                                          newConversation: {title: card title}} ──→  create conversation for
                                                                                      that runtime, title it,
                                                                                      queue the turn
                                                          ←── enqueue-result {queued, conversationId}
                       persist `queued` + destination
←── board/result ok, board/state (Sending… → Queued)
                                                          ←── agent-execute(taskId, host turn id)
                       turn started → `running`
                       attention → `needs-user` → call "Needs you in the conversation"
                       terminal → result onto the card:
                         completed: report_result text if the agent called it this turn,
                                    else summarizeTerminalText(last assistant message),
                                    + the turn's filesModified (workspace-filtered metrics)
                                    + seconds from turn start to end
                         failed / cancelled / interrupted: history line + Retry
←── board/state
```

Later handoffs on the same card (Give to agent again, Ask for changes, answering an `ask`) enqueue into the bound `conversationId` without revealing it (P1). After a restart that conversation is usually only in durable history, so the sidebar loads it in the background first (G2). Retry follows Sprint 117: new generation, new turn id, previous outcome kept in history. A bound conversation that no longer exists gives "Conversation no longer available", and Retry starts a new one.

**Focus.** A card handoff shows the AI sidebar only with `ritemark.unifiedView.focus` and `{ preserveFocus: true }` (P7: the sidebar appears and the document keeps focus). That includes `_awaitActiveConversation` (`UnifiedViewProvider.ts:1611`), which today runs the plain focus command when the view is not resolved; it gains a `preserveFocus` option that the card path sets, and comment tasks keep their behaviour. Only **Open conversation** focuses the sidebar.

**Changes to the Sprint 117 path** (each one with a test; G-numbers from the audit):

| Change | Where | Also fixes for comment tasks |
|---|---|---|
| G1: a list of task listeners (`attachTaskListener`) instead of one `_commentTaskController`; turn events go to every listener, each ignores turns it does not own (`findByTurn` → null) | `UnifiedViewProvider.ts:208, 548-551, 1212, 1545, 1795-1817` | — |
| G2: optional `newConversation {title}` on `comment-task/enqueue`; the sidebar inserts a fresh conversation for `runtimeId` into `conversations` without touching `activeConversationId`, queues, and answers with its `conversationId`. The host sets the card title as a manual title (so the AI title never replaces it) once the first turn has given the record its canonical id. **History-only destination (P1):** when the enqueue names a conversation the store does not hold, the store loads it with `conversation/get` under a remembered `requestId` and adds it without activating it, focusing the composer or posting `ai-select-agent`; it answers `no-conversation` only if that load fails (the host waits 10 s). Today's `createConversation()` (store.ts:960) reuses the user's empty thread and makes the new one active; the card variant does neither: it always makes a fresh conversation and leaves the open one open (the rail shows it while it works, Sprint 109). The client-to-canonical id rename is already absorbed by `findByTurn`. Optional `sourceKind: 'comment' \| 'card'` for the queue icon (`kanban` for cards). The message keeps its name; the naming debt is recorded in architecture.md | `commentTasks/protocol.ts:155-176`, `ai-sidebar/store.ts:809-840`, `QueuePanel.tsx:81-85` | — |
| G3: report `running` again when an approval or question is answered | `UnifiedViewProvider` approval/answer handlers → `applyTurnStarted` | Yes: a comment no longer says "Needs your input" after it was answered |
| G4: the summary comes from the last assistant message for Codex and OpenCode (P5). Codex: `lastAgentMessage` per session, reset when an `agentMessage` item starts (`item/started`, deltas carry `itemId`), `item.text` from `item/completed` when present. OpenCode: the text under the latest ACP `messageId` on `agent_message_chunk`, whole stream if absent. Both pass it in `onCodexComplete`; the host summarises `lastAgentMessage ?? streamedResponseText`, and the transcript keeps the full text. Capture one Codex `item/completed` trace to confirm the payload | `CodexRuntime.ts:801-842`, `acpManager.ts:449-455`, `AcpRuntime.ts:256`, `AgentRuntime.ts:158`, `UnifiedViewProvider.ts:988-991, 1105-1109` | Yes |
| G5: a queued task item cannot be edited, only removed (editing threw away the host-built prompt) | `QueuePanel.tsx:96`, `store.ts` `editQueued` | Yes |
| G6: a dispatch exception tells the host, which records `failed` | `store.ts:791-798`, new `comment-task/dispatch-failed` | Yes |

Out of scope and unchanged: G7 (`approvalMode` frozen to `auto`), the ready-queue gap, deleted-destination detection (Sprint 117 TO BE list).

**F1, found while building the prototype (2026-10-12), fixed in this sprint:** shadcn's role tokens (`--background`, `--secondary`, `--muted`, `--border`, `--input`, `--accent` and their foregrounds) are declared on `:root` in `webview/src/index.css` and reference `--r-*` tokens that flip only on `body.vscode-dark`. A custom property resolves where it is declared, so in dark mode `bg-background` stays `#ffffff` and `bg-secondary` `#f1f5f9`: an outline button is white with near-white text (checked in the installed 1.13.0 over CDP). The board uses outline buttons in every row, so the fix belongs here: re-declare the neutral role tokens under `body.vscode-dark` (as the prototype does). `--primary` stays as it ships. Check the existing surfaces that use outline or secondary buttons (Settings, dialogs) in dark mode after the change.

**Menus in the card dialog** take the z-90 popover layer of Sprint 126, so the Give menu and More actions show above the dialog (z-80). "Move to…" expands in place inside the menu rather than as a side submenu.

## W5 — Agent tools in all three runtimes

**`src/runtime/ritemarkTools.ts`** (new) — one registry, one definition per tool:

```ts
interface RitemarkTool {
  name: string;                       // 'list_cards'
  description: string;
  input: z.ZodRawShape;               // zod 4 (already a dependency)
  run(args: unknown): Promise<{ text: string; isError?: boolean }>;
}
interface RitemarkToolGroup {
  id: 'browser' | 'board';
  server: 'ritemark_browser' | 'ritemark_board';
  enabled(): boolean;                 // browser-agent-control / task-board flag + folder open
  tools: RitemarkTool[];
}
```

`BrowserToolsInjector` becomes **`RitemarkToolsInjector`** over the enabled groups (file renamed, three call sites updated):

| Runtime | Today (browser only) | After (any group) |
|---|---|---|
| Claude | `getMcpServers` → one cached `ritemark_browser` server; `BROWSER_TOOL_ALLOW_NAMES` | One SDK server per enabled group, built from the registry; `allowedToolNames(groups)` = `mcp__<server>__<tool>` |
| Codex | `getCodexDynamicTools` + `onBrowserToolCall` for every `item/tool/call`; thread reset on one boolean | Dynamic tools `<server>_<tool>` with `z.toJSONSchema` (+ `additionalProperties: false`); one `onDynamicToolCall(name, args)` routed by prefix. Tools are fixed at thread start and restored on `thread/resume`, which cannot add any (P2), so the continuation fingerprint (`continuation.ts:180-195`) gains a hash of the tool names and schemas: a thread whose tools differ starts fresh with the Sprint 110 context pack. `CodexRuntime.ts:309` records the tools the thread actually has |
| OpenCode | `browserMcpAdapter.js` with a hardcoded `TOOLS` array; IPC limited to six names | The same adapter file (output path unchanged, so no shell-tier build script changes) becomes generic: `RITEMARK_TOOL_GROUP` env selects the group, `tools/list` and `tools/call` go to the host over `RITEMARK_IPC` as `{op, group, tool, params}`. One descriptor per enabled group |

- The browser tools move onto the registry **with their model-visible names unchanged** (`mcp__ritemark_browser__browser_*`, `ritemark_browser_*`, `ritemark_browser_browser_*`) and one description each (today's three copies differ slightly). This removes the three hand copies.
- **Board tools** (`ritemark_board`):

| Tool | Input | Does |
|---|---|---|
| `list_cards` | optional `stage` | id, title, stage, who moves next, number of files, for every card |
| `read_card` | `card_id` | title, stage, description, files, result, ask, last 10 history entries |
| `add_card` | `title`, optional `done_when`, `description`, `stage` (`idea` or `todo`, default `todo`), `files` | creates a card, returns its id |
| `update_card` | `card_id`, optional `title`, `done_when`, `description`, `files` | changes those fields |
| `move_card` | `card_id`, `stage` (`idea`, `todo` or `doing`) | moves it; **Done is refused**: "Only the user marks a card done." |
| `report_result` | `card_id`, `summary`, optional `check` (up to three short items, 160 characters each) | sets the result (summary bounded to 280 characters) with its Check these list and a history line; the card then waits on the user for review |
| `ask_user` | `card_id`, `question`, `options` (2–4) | leaves a decision on the card under Your calls; the answer comes back as a new turn in the card's conversation |

  Every tool answers in plain text; a bad id or a path outside the project returns `isError` with a sentence the model can act on. All writes go through `BoardStore.mutate`, so parallel chats are serialized.
- **OpenCode permissions (P3):** OpenCode checks every MCP tool, but with Ritemark's `OPENCODE_PERMISSION` a board tool matches only the default `"*": "allow"`, so nothing reaches Ritemark. `AcpRuntime._handlePermission` still allows, as hardening, a request titled `ritemark_board_*` and a `doom_loop` request whose `rawInput.tool` is a board tool. That covers a user whose own `opencode.json` says `"*": "ask"`, and three identical calls in a row. Edits and shell commands keep asking.
- **Schemas (P4):** `z.toJSONSchema(z.object(shape), { io: 'input' })` reproduces the OpenCode adapter's browser schemas and the Claude SDK's `tools/list` exactly. Codex's hand-written copy differs only in descriptions (three missing, one shorter), so generating it adds them; names are unchanged.
- **No approval prompt for board tools**, in any autonomy mode, as for browser tools today: they only change the board, every change is a history line the user sees, and no tool can delete a card, mark it done or touch a document. Documents are still changed only through the runtime's own (gated) file tools.
- **`src/ai/capabilityContext.ts`**: `CapabilityDescriptor.hasBoardTools` and a TASK BOARD section: the project has a task board; read and change it only with the `ritemark_board` tools, never by editing `.ritemark/tasks/` files; when a message says it is a card on the task board, finish with `report_result` for that card (one or two sentences on what you did, plus up to three things the user should check); work toward the card's Done when; before long work, put the decisions that would change the result to the user with `ask_user` first rather than stopping in the middle; use `ask_user` for any decision that can wait instead of guessing, then end the turn; only the user marks a card done. `capabilityDescriptorFor(runtime, { browser, board })`. Version bumped.

## W6 — Idea review

**`src/taskBoard/ideaReview.ts`**: `IdeaReviewer.review(card, boardSummary, runtimeId)` copies `ConversationTitleGenerator`: a fresh one-shot runtime from `createRuntime(runtimeId)`, no tools (`availableTools: []`, `settingSources: []`), low effort, 45 s timeout, disposed afterwards. The prompt carries the idea, the titles of the open cards (to spot repeats) and asks for JSON: `verdict` (`ready` | `unclear` | `already-on-board` | `not-a-task`), `why` (one sentence), `size` (`small` | `medium` | `large`), `title`, `description`. Parsed strictly; anything else is "The review didn't come back in a usable form. Try again." The review is stored on the card (`review`), so it travels with the folder. **Make it a task** moves the card to To do with the proposed title and description (the user's original line is kept as the first history entry).

## W7 — Flag and release tier

- `task-board` in `src/features/flags.ts`: experimental, all platforms, default on through `ritemark.features.task-board: true`. Off: the side bar shows a one-line notice, the board command is a no-op with a message, no tools are injected, no TASK BOARD section, files untouched.
- **Release tier: extension by path.** No `patches/`, `vscode`, `branding/product.json`, `binaries/agents/` or listed `scripts/` change; the OpenCode adapter keeps its output path so the three shell-tier build checks are untouched. The new `media/tasks-icon.svg` is outside what an extension-only release ships, so **the feature reaches users with the v1.14.0 app release** (as Sprint 128 did inside v1.13.0). If it ever has to go out extension-only, `release-extension-preflight.sh` stops on the icon and asks.

## W8 — Docs, tests, QA

- `docs/development/architecture.md`: a "Task board (Sprint 130)" section (modules, card file, handoff sequence, invariants), the Subsystem Map, the rewritten "Browser Tool Injection" section as "Ritemark tool injection", the capability-context table, the Sprint 117 TO BE list (G3–G6 closed), Version History, `Last updated`.
- `CLAUDE.md` locked-decision row "Browser tools … via `BrowserToolsInjector`" → "Agent tools (browser, board) … via `RitemarkToolsInjector`; one definition per tool, no runtime-specific implementations".
- Tests (`npx tsx`, added to `scripts.test`): `taskBoard/cardFile.test.ts`, `BoardStore.test.ts`, `BoardController.test.ts`, `CardTaskStore.test.ts`, `boardPrompt.test.ts`, `ideaReview.test.ts`; `runtime/ritemarkTools.test.ts` (one definition → three shapes; browser names unchanged), replacing the assertions in `BrowserToolsInjector.test.ts`; updated `capabilityContext.test.ts`, `CodexRuntime.test.ts`, `AcpRuntime.test.ts`; `webview/.../tasks/taskCopy.test.ts`; the comment-task tests stay green.
- Manual QA: [scenarios.md](./scenarios.md) on a dev instance, all three runtimes, side bar at 280 and 420 px.
