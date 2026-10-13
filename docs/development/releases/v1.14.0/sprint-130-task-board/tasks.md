# Sprint 130 Tasks

Jarmo approved the plan on 2026-10-12. `sprint-130-task-board` was created from `main` before any code.

## Phase 0: Setup and probes

- [x] T0.1 Branch `sprint-130-task-board` from `main`; check with `git branch --show-current`
- [x] T0.2 Run probes P1–P7 (technical-plan W0); write `research/phase-0-probes.md` with method and result for each
- [x] T0.3 If a probe fails, stop and bring Jarmo the options before the affected workstream (none failed, 2026-10-12; five pass with a change, folded into W2–W5)
- [x] T0.4 Jarmo looks at the design (design.md) on a dev instance mock-up before W3 is finished (short check, not a gate). Done: the prototype and the card page he approved covered it (Jarmo, 2026-10-13, through the Development manager: "jah märgi T0.4 tehtuks")

## Phase 1: Card files and store (W1, R4)

- [x] T1.1 `src/taskBoard/cardFile.ts`: parse/serialize, bounds, `rankBetween`, ids, unknown-key preservation, `done_when`, `result.check`
- [x] T1.2 `src/taskBoard/cardFile.test.ts`: round trip, broken YAML → read error, duplicate id, rank order, byte-for-byte body
- [x] T1.3 `src/taskBoard/BoardStore.ts`: injected fs, cache, serialized `mutate`, atomic write, exclusive create, trash, echo suppression
- [x] T1.4 `src/taskBoard/BoardStore.test.ts` on a temp folder, including "never overwrite an unreadable file" and a leftover `.tmp-*`; both in `npm test`

## Phase 2: Controller and protocol (W2, R3, R7, R10)

- [x] T2.1 `src/taskBoard/protocol.ts` + `decodeBoardRequest` with exact-field validation
- [x] T2.2 `src/taskBoard/BoardController.ts`: operations, derived who-moves-next, Your calls, badge count (set on the hidden `ritemark.tasksBadge` tree view, P6)
- [x] T2.3 `BoardController.test.ts`: operations and history lines, derived calls, agents cannot reach Done
- [x] T2.4 Attention summary (count, oldest, blocked), `since` per call, longest-waiting order, Next up; tests
- [x] T2.6 Doing limit (D13): `wipLimit` in workspaceState, `doing-full` answer, `board/queue`, start queued cards when a card leaves Doing, agent move into full Doing refused, `board/set-wip`; tests (the header control is T3.9)
- [x] T2.7 AI sidebar capacity (controller side; the host's `canAttach` is T4.9): `canAttachRuntime` from the host, `waiting` with reason `capacity`, retry on every terminal turn event, a dispatch-time capacity error back to the queue (P1); tests
- [x] T2.5 Conflict guard: shared-file detection, `conflict` answer, `force`, `waiting` handoff, auto-start on the blocker's terminal event, unwait; tests

## Phase 3: Surfaces (W3, R1, R2, R3, R9, R10, R11)

- [x] T3.1 `iconMap` gains `kanban` (and any other name design.md uses that is missing); `ritemark-design/references/iconography.md` lists it
- [x] T3.2 `media/tasks-icon.svg` (Phosphor, 256 viewBox, `currentColor`), plus `tasks-tab-light.svg` / `tasks-tab-dark.svg` for the board tab (a tab icon cannot follow `currentColor`)
- [x] T3.3 `package.json`: container (declared first among Ritemark's, lands above Transcribe), view, `ritemark.openTaskBoard`, `ritemark.addTask`, activation event, `ritemark.features.task-board`, badge-only tree view `ritemark.tasksBadge` (`when: false`)
- [x] T3.4 `src/features/flags.ts`: `task-board`
- [x] T3.5 `src/views/TasksViewProvider.ts` (+ badge, flag notice, no-folder state)
- [x] T3.6 `src/taskBoard/TaskBoardPanel.ts` (+ serializer, `ritemark.openTaskBoard`)
- [x] T3.7 `extension.ts` composition: store, controller, watcher, both surfaces, serializer
- [x] T3.8 `webview/src/main.tsx`: `tasks-panel` and `task-board` branches, side-bar background list
- [x] T3.9a `ui/tabs.tsx` (shadcn Radix Tabs) + `@radix-ui/react-tabs` in `webview/package.json` and the lockfile; export `RowMenus` from `ConversationsPanel.tsx`
- [x] T3.9 `webview/src/components/tasks/`: `TasksPanel`, `TaskBoard`, `BoardColumns`, `CardRow`, `CardDetail`, `NoteBox`, `CallsView`, `IdeasView`, `LogView`, `AgentSplitButton` (used by every agent action: Give to, Review with, Retry with, Send to), `taskCopy.ts`
- [x] T3.9b `ritemark.addTask` (input box, top of To do, focus returns)
- [x] T3.9c Home: "New AI task" → "New AI conversation" (R14); `HomeViewProvider.test.ts` updated
- [x] T3.10 `taskCopy.test.ts`: every state in design.md §10 has its words and glyph
- [x] T3.11 Rebuild `media/webview.js`; size change noted (8,366,183 → 8,452,268 bytes, +86 KB)

## Phase 3b: The card page (W3b, revised 2026-10-12)

- [x] T3b.0 Jarmo's OK on design.md §5 in the sprint session (2026-10-12: "card page approved, go ahead")
- [x] T3b.1 Probe P8: closing the reused card tab with `window.tabGroups.close`; focus after `vscode.openWith` (both work, technical-plan W3b)
- [x] T3b.2 `cardFileName(title)` → `<slug>.md` with a `-2`… suffix; old `<id>-<slug>.md` files still load; tests
- [x] T3b.3 Document-aware file layer for BoardStore: read the open document, edit only the front matter, save only when clean; tests (dirty page keeps typing, clean page saves)
- [x] T3b.4 `ritemarkEditor.ts` card mode: detection (path, `ritemark: task/1`, flag), `cardMode` in the render payload and `editorSync/protocol.ts`, body saves keep the front-matter text byte for byte, `board/` routing; tests for the splice and the `cardMode` field (the provider wiring is checked live: it needs VS Code)
- [x] T3b.5 `board/open-card` replaces `board/open-as-document`; the card-page surface in `boardSurface.ts`; the reused-tab rule; protocol tests (the tab rule is checked live)
- [x] T3b.6 Webview: `CardStrip` and `CardHead` in `App.tsx` card mode (reusing `CardParts`, `AgentSplitButton`, `CardMenu`); Properties and Contents hidden
- [x] T3b.7 Remove `CardDetail.tsx`; card clicks on every surface send `board/open-card`; the side-bar row highlights the open page; "Open as document" leaves `CardMenu`
- [x] T3b.8 Rebuild `media/webview.js` (8,453,831 → 8,459,024 bytes); live check of S8a–S8c on a dev instance, light and dark, and a 360 px editor (the strip gives way, More stays). Side-bar widths 280/420 go with the Phase 8 pass
- [x] T3b.9 Unreadable card files listed in the side bar and below the board (R4 gap in W3)

## Phase 3c: Archive and the Done window (D15, 2026-10-13)

- [x] T3c.1 Jarmo's OK (2026-10-13: "yes, build archive like that and keep 28days Done limit also")
- [x] T3c.2 `archived: <time>` in the card format (`true` from a hand edit reads too); tests
- [x] T3c.3 `BoardController.archive`, `restore`, `archiveDone`; archived cards out of the board, Your calls, Doing and Next up (`snapshot.archived`); move and agent work refused until restored; tests
- [x] T3c.4 Protocol: `board/archive`, `board/restore`, `board/archive-done`; tests
- [x] T3c.5 Webview: Archive in `CardMenu`, Archive all done on the Done column, a collapsed Archived section at the bottom of the side bar (revised from an Archive tab, Jarmo 2026-10-13), an archived card's page, Done and the side bar's Done limited to 28 days with the Log note; header icon buttons on shadcn `Button`
- [x] T3c.6 Delete… confirms with Enter
- [x] T3c.7 `read_card` reads an archived card; `list_cards` leaves them out
- [x] T3c.8 Live check on a dev instance: the 28-day note, Archive all done, the Archived section, Restore, Enter to delete

## Phase 4: Give to agent (W4, R5, R6, R7, R12)

- [x] T4.1 `src/taskBoard/CardTaskStore.ts` (one record per card; records of deleted cards dropped at activation), covered by the ledger test
- [x] T4.2 `src/taskBoard/boardPrompt.ts` + test: `displayText` is the user's request only; `prompt` adds the card line only with board tools; follow-up and answer turns
- [x] T4.3 `UnifiedViewProvider`: task listener list (G1); comment-task controller registered through it; its tests stay green
- [x] T4.4 Enqueue `newConversation` + `sourceKind` (G2): protocol, host, sidebar store (insert without activating), manual title after the first turn, queue icon
- [x] T4.4a History-only destination (P1): store loads the conversation with `conversation/get` under a remembered request id, adds it without activating, focusing or `ai-select-agent`, then queues
- [x] T4.5 G3: answered approval/question → `running`
- [x] T4.6 G4: last-message summary for Codex (`agentMessage` item + `itemId`) and OpenCode (ACP `messageId`), passed in `onCodexComplete`; capture one Codex `item/completed` trace
- [x] T4.7 G5: queued task items are not editable
- [x] T4.8 G6: `comment-task/dispatch-failed` → `failed`
- [x] T4.8a F1: neutral shadcn role tokens re-declared under `body.vscode-dark` in `webview/src/index.css`; outline/secondary buttons checked in dark mode on Settings, dialogs and the board
- [x] T4.0 Replace the interim `NOT_CONNECTED_LEDGER` in `taskBoardHost.ts` with the W4 ledger (it must not ship)
- [x] T4.9 Controller: give, follow-up, answer, stop, retry, open conversation, recover; result onto the card (report first, summary fallback, changed files, seconds); interrupted on restart; deleted conversation; locks while working
- [x] T4.9a Focus: the card path shows the sidebar only with `ritemark.unifiedView.focus` + `{ preserveFocus: true }`, including `_awaitActiveConversation` (P7)
- [x] T4.10 Handoff lifecycle end to end with injected sidebar fakes (`CardHandoffLedger.test.ts`), plus G4 tests in `CodexRuntime.test.ts` and `acpManager.test.ts`

## Phase 5: Agent tools (W5, R8)

- [x] T5.1 `src/runtime/ritemarkTools.ts`: registry types; browser group moved onto it with names unchanged (the generated schemas equal the old adapter's, tested)
- [x] T5.2 `BrowserToolsInjector` → `RitemarkToolsInjector` (Claude servers + allow names, Codex dynamic tools + router + thread-reset key, OpenCode descriptors)
- [x] T5.3 Generic OpenCode adapter (same output path) + IPC `{op, group, tool, params}`; `AcpRuntime` dispatch by group
- [x] T5.4 `CodexRuntime`: `onDynamicToolCall`; `AgentRuntime.ts` callback renamed; `UnifiedViewProvider` wiring; tool-set hash in the continuation fingerprint and `:309` records the thread's real tools (P2)
- [x] T5.4a `AcpRuntime._handlePermission`: allow `ritemark_board_*` titles and a `doom_loop` on a board tool (P3); test
- [x] T5.5 Board group: seven tools on `BoardController`; `done_when` on add/update, `check` on report_result
- [x] T5.6 `capabilityContext.ts`: `hasBoardTools` + TASK BOARD section (report with Check these, ask decisions before long work, work toward Done when); version bump
- [x] T5.7 Tests: `ritemarkTools.test.ts`, updated `capabilityContext`, `CodexRuntime`, `AcpRuntime` tests; old `BrowserToolsInjector.test.ts` assertions carried over

## Phase 6: Ideas (W6, R9)

- [x] T6.1 `src/taskBoard/ideaReview.ts` (one-shot runtime, shared `runtime/oneShotTurn.ts`) + `ideaReview.test.ts` (strict parsing, failure copy)
- [x] T6.2 Review / Make it a task / Drop / Bring back wired through the controller (reviewing and failure states in the card view)

## Phase 7: Docs (W8)

- [x] T7.1 `docs/development/architecture.md`: Task board section, Subsystem Map, Ritemark tool injection rewrite, capability table, Sprint 117 TO BE updates, Version History, `Last updated`
- [x] T7.2 `CLAUDE.md` locked-decision row for agent tools (with W5)
- [x] T7.3 User docs: `docs/user/features/task-board.md`, linked from the features index
- [x] T7.4 v1.14.0 release plan: Sprint 130 row

## Phase 8: QA and closeout

- [x] T8.1 `npm test` (extension) and the webview tests green
- [x] T8.2 `npm run compile` and the webview build; run the pre-commit validator by hand in the worktree (`CLAUDE_PROJECT_DIR="$PWD"`)
- [x] T8.3 Dev instance: scenarios S1–S37 (with S20a, S23c), each runtime where marked, side bar at 280 and 420 px; evidence in `qa-evidence.md` (Claude live; Codex, OpenCode and the rows this run could not drive are on its Gate 2 list)
- [ ] T8.4 `qa-validator` review
- [ ] T8.5 PR with the QA evidence; issue #119 linked; Jarmo's admin-merge yes naming the PR
