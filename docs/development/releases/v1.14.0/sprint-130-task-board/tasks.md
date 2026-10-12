# Sprint 130 Tasks

Jarmo approved the plan on 2026-10-12. `sprint-130-task-board` was created from `main` before any code.

## Phase 0: Setup and probes

- [x] T0.1 Branch `sprint-130-task-board` from `main`; check with `git branch --show-current`
- [ ] T0.2 Run probes P1–P7 (technical-plan W0); write `research/phase-0-probes.md` with method and result for each
- [ ] T0.3 If a probe fails, stop and bring Jarmo the options before the affected workstream
- [ ] T0.4 Jarmo looks at the design (design.md) on a dev instance mock-up before W3 is finished (short check, not a gate)

## Phase 1: Card files and store (W1, R4)

- [ ] T1.1 `src/taskBoard/cardFile.ts`: parse/serialize, bounds, `rankBetween`, ids, unknown-key preservation, `done_when`, `result.check`
- [ ] T1.2 `src/taskBoard/cardFile.test.ts`: round trip, broken YAML → read error, duplicate id, rank order, byte-for-byte body
- [ ] T1.3 `src/taskBoard/BoardStore.ts`: injected fs, cache, serialized `mutate`, atomic write, exclusive create, trash, echo suppression
- [ ] T1.4 `src/taskBoard/BoardStore.test.ts` on a temp folder, including "never overwrite an unreadable file" and a leftover `.tmp-*`

## Phase 2: Controller and protocol (W2, R3, R7, R10)

- [ ] T2.1 `src/taskBoard/protocol.ts` + `decodeBoardRequest` with exact-field validation
- [ ] T2.2 `src/taskBoard/BoardController.ts`: operations, derived who-moves-next, Your calls, badge count
- [ ] T2.3 `BoardController.test.ts`: operations and history lines, derived calls, agents cannot reach Done
- [ ] T2.4 Attention summary (count, oldest, blocked), `since` per call, longest-waiting order, Next up; tests
- [ ] T2.6 Doing limit (D13): `wipLimit` in workspaceState, `doing-full` answer, `board/queue`, start queued cards when a card leaves Doing, agent move into full Doing refused, `board/set-wip`; header control; tests
- [ ] T2.5 Conflict guard: shared-file detection, `conflict` answer, `force`, `waiting` handoff, auto-start on the blocker's terminal event, unwait; tests

## Phase 3: Surfaces (W3, R1, R2, R3, R9, R10, R11)

- [ ] T3.1 `iconMap` gains `kanban` (and any other name design.md uses that is missing); `ritemark-design/references/iconography.md` lists it
- [ ] T3.2 `media/tasks-icon.svg` (Phosphor, 256 viewBox, `currentColor`)
- [ ] T3.3 `package.json`: container (declared first among Ritemark's, lands above Transcribe), view, `ritemark.openTaskBoard`, `ritemark.addTask`, activation event, `ritemark.features.task-board`
- [ ] T3.4 `src/features/flags.ts`: `task-board`
- [ ] T3.5 `src/views/TasksViewProvider.ts` (+ badge, flag notice, no-folder state)
- [ ] T3.6 `src/taskBoard/TaskBoardPanel.ts` (+ serializer, `ritemark.openTaskBoard`)
- [ ] T3.7 `extension.ts` composition: store, controller, watcher, both surfaces, serializer
- [ ] T3.8 `webview/src/main.tsx`: `tasks-panel` and `task-board` branches, side-bar background list
- [ ] T3.9a `ui/tabs.tsx` (shadcn Radix Tabs) + `@radix-ui/react-tabs` in `webview/package.json` and the lockfile; export `RowMenus` from `ConversationsPanel.tsx`
- [ ] T3.9 `webview/src/components/tasks/`: `TasksPanel`, `TaskBoard`, `BoardColumns`, `CardRow`, `CardDetail`, `NoteBox`, `CallsView`, `IdeasView`, `LogView`, `AgentSplitButton` (used by every agent action: Give to, Review with, Retry with, Send to), `taskCopy.ts`
- [ ] T3.9b `ritemark.addTask` (input box, top of To do, focus returns)
- [ ] T3.9c Home: "New AI task" → "New AI conversation" (R14); `HomeViewProvider.test.ts` updated
- [ ] T3.10 `taskCopy.test.ts`: every state in design.md §10 has its words and glyph
- [ ] T3.11 Rebuild `media/webview.js`; size change noted

## Phase 4: Give to agent (W4, R5, R6, R7, R12)

- [ ] T4.1 `src/taskBoard/CardTaskStore.ts` + test (lifecycle from `commentTasks/types.ts`, prune at activation)
- [ ] T4.2 `src/taskBoard/boardPrompt.ts` + test: `displayText` is the user's request only; `prompt` adds the card line only with board tools; follow-up and answer turns
- [ ] T4.3 `UnifiedViewProvider`: task listener list (G1); comment-task controller registered through it; its tests stay green
- [ ] T4.4 Enqueue `newConversation` + `sourceKind` (G2): protocol, host, sidebar store, manual title, queue icon
- [ ] T4.5 G3: answered approval/question → `running`
- [ ] T4.6 G4: last-message summary for Codex/OpenCode (per P5)
- [ ] T4.7 G5: queued task items are not editable
- [ ] T4.8 G6: `comment-task/dispatch-failed` → `failed`
- [ ] T4.8a F1: neutral shadcn role tokens re-declared under `body.vscode-dark` in `webview/src/index.css`; outline/secondary buttons checked in dark mode on Settings, dialogs and the board
- [ ] T4.9 Controller: give, follow-up, answer, stop, retry, open conversation, recover; result onto the card (report first, summary fallback, changed files, seconds); interrupted on restart; deleted conversation; locks while working
- [ ] T4.9a Focus: no `ritemark.unifiedView.focus` on a handoff; hidden sidebar shown without focus (P7)
- [ ] T4.10 `BoardController.test.ts`: handoff lifecycle end to end with injected sidebar fakes

## Phase 5: Agent tools (W5, R8)

- [ ] T5.1 `src/runtime/ritemarkTools.ts`: registry types; browser group moved onto it with names unchanged
- [ ] T5.2 `BrowserToolsInjector` → `RitemarkToolsInjector` (Claude servers + allow names, Codex dynamic tools + router + thread-reset key, OpenCode descriptors)
- [ ] T5.3 Generic OpenCode adapter (same output path) + IPC `{op, group, tool, params}`; `AcpRuntime` dispatch by group
- [ ] T5.4 `CodexRuntime`: `onDynamicToolCall`; `AgentRuntime.ts` callback renamed; `UnifiedViewProvider` wiring
- [ ] T5.5 Board group: seven tools on `BoardController`; `done_when` on add/update, `check` on report_result
- [ ] T5.6 `capabilityContext.ts`: `hasBoardTools` + TASK BOARD section (report with Check these, ask decisions before long work, work toward Done when); version bump
- [ ] T5.7 Tests: `ritemarkTools.test.ts`, updated `capabilityContext`, `CodexRuntime`, `AcpRuntime` tests; old `BrowserToolsInjector.test.ts` assertions carried over

## Phase 6: Ideas (W6, R9)

- [ ] T6.1 `src/taskBoard/ideaReview.ts` (one-shot runtime) + `ideaReview.test.ts` (strict parsing, failure copy)
- [ ] T6.2 Review / Make it a task / Drop / Bring back wired through the controller

## Phase 7: Docs (W8)

- [ ] T7.1 `docs/development/architecture.md`: Task board section, Subsystem Map, Ritemark tool injection rewrite, capability table, Sprint 117 TO BE updates, Version History, `Last updated`
- [ ] T7.2 `CLAUDE.md` locked-decision row for agent tools
- [ ] T7.3 User docs: a short "Task board" page under `docs/user/`
- [ ] T7.4 v1.14.0 release plan: Sprint 130 row (once the release plan exists on `main`)

## Phase 8: QA and closeout

- [ ] T8.1 `npm test` (extension) and the webview tests green
- [ ] T8.2 `npm run compile` and the webview build; run the pre-commit validator by hand in the worktree (`CLAUDE_PROJECT_DIR="$PWD"`)
- [ ] T8.3 Dev instance: scenarios S1–S37 (with S20a), each runtime where marked, side bar at 280 and 420 px; evidence in `qa-evidence.md`
- [ ] T8.4 `qa-validator` review
- [ ] T8.5 PR with the QA evidence; issue #119 linked; Jarmo's admin-merge yes naming the PR
