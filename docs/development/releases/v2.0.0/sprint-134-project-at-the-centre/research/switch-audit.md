# Switching projects: the audit (W8, R9)

Checked 2026-10-19 on `sprint-134-project-at-the-centre` (main `eae1dedd` with #462's plan). Line numbers are this branch's; `vscode/` paths are VS Code 1.117.0 with the 18 patches applied.

## 1. "Claude is working in this window"

Every chat this window runs has a runtime session in `UnifiedViewProvider._runtimeSessions` (`views/UnifiedViewProvider.ts:227`). A turn that runs has an entry in `_activeConversationTurnIds` (`:268`), set when a turn starts (`:758`, and `:3373` for a turn the runtime opens itself) and removed when it ends (`:2154`, `:3408`). Its record says `working`, or `needs-user` while it waits on a question or an approval.

- **Working** = a chat with an active turn in this window: an entry in `_activeConversationTurnIds` whose record is `working` or `needs-user`. A turn waiting on the person counts. Switching ends it too, and the dialog's words fit ("still working").
- **A card's turn** runs in its own chat, through the same queue (`comment-task/enqueue`, architecture.md, Task board), so it is in the same map. Nothing extra is needed.
- **Not working:** a card that is `waiting` for room, or a prompt queued behind a finished turn. Neither has a runtime turn, and both start again in that project next time.
- **The AI's name** in the title comes from each working chat's runtime: Claude, ChatGPT (R22) or OpenCode. With chats of two runtimes working, the title names both ("Claude and ChatGPT are still working in <project>"). That is a small extension of experience 33's words, sent to the Experience lead with the screenshots.

The provider gains one public method for the guard, `workingChats(): { conversationId, runtimeId }[]`, read from those two maps.

## 2. Switch and stop, as Stop does

The sheet's Stop posts `agent-cancel`. The host records the cancel intent, then cancels that chat's session (`UnifiedViewProvider.ts:1372–1383`). The card path does the same through `_cancelCommentTaskTurn` (`:2100–2105`), and the intent makes the turn end as `cancelled`, not `completed` (Sprint 117, F24).

Switch and stop runs that for every working chat, then waits up to 3 s for each turn to end (`_activeConversationTurnIds` empties), so each record is written as stopped by the person. A turn that hasn't ended by then is left to `prepareForShutdown` (`:2216`), which records it as interrupted by the reload, as today. Then the switch goes on.

## 3. Ritemark's own ways of switching

All of them end in `vscode.openFolder(uri, { forceReuseWindow: true })` (`vscode/src/vs/workbench/browser/actions/workspaceCommands.ts:167–200`), so one function, `switchProject.ts`, can ask first for all of them:

| Route | Today |
|---|---|
| Home's projects list (new) | — |
| The head's Switch project ▸ (new; Sprint 132's item runs `workbench.action.openRecent`, `views/projectHeadCommands.ts`) | VS Code's Open Recent |
| The head's Open a folder… | `vscode.openFolder` with no URI, so VS Code's picker opens and opens the folder in the main process |
| File ▸ Switch project (new) | — |
| Go back on Home's note (new) | — |
| Find it… on a project that is not found (new) | — |
| The welcome's lists, its new project and its sample | Sprint 133's landing; a window with no folder can still have chats (the no-folder scope) |

- **Open a folder…** from the head must pick the folder itself (`showOpenDialog`, folders only) and then go through the switch. Otherwise VS Code's main process opens it and nobody asks.
- **Open in a new window** is `vscode.openFolder(uri, { forceNewWindow: true })`. It leaves this window, and its turn, as they are.

## 4. VS Code's own ways

| Route | How it opens | Does the window know the target first? |
|---|---|---|
| File ▸ Open Recent, the recent picker (⌃R) | `hostService.openWindow([pick.openable], …)` in the window (`workbench/browser/actions/windowActions.ts:201–212`) | Yes |
| File ▸ Open Folder…, Open… | `nativeHostService.pickFolderAndOpen` (`workbench/services/dialogs/electron-browser/fileDialogService.ts:117`): the main process picks and opens | No |
| A folder dropped on the Dock icon, `ritemark <folder>` reusing the window | The main process | No |
| File ▸ Close Folder | The main process loads an empty window | No (no target: an empty window) |

Each of them unloads the window with reason `LOAD` (`workbench/services/lifecycle/common/lifecycle.ts:171`). The window's lifecycle fires `onBeforeShutdown` with that reason and waits for vetoes (`workbench/services/lifecycle/electron-browser/lifecycleService.ts:38–58, 79–150`). The extension host is still running then.

**Decision: a small veto in 018, so every switch that reloads asks** (experience 33):
- A workbench contribution listens to `onBeforeShutdown` and, only for `ShutdownReason.LOAD`, vetoes with the answer of a hidden extension command, `_ritemark.projects.beforeReload`. The command answers `true` to stop the reload.
- The command is passed the target folder when the window knows it. A small stash in the window's host service's `openWindow` records the folder about to open in this window (`forceReuseWindow`, or no `forceNewWindow`). It is cleared when the reload goes on or is stopped.
- **The extension's guard** (`switchProject.ts`) answers:
  - with no chat working: `false` at once;
  - when the reload is one Ritemark started after asking: `false` (it marks its own switch as asked, for 10 s);
  - otherwise it asks in the same dialog. With a known target, the buttons are Cancel, Switch and stop, and Open in a new window (default). With no target (Open Folder…, a drop, the CLI, Close Folder), it shows Cancel and Switch and stop, with Cancel as the default, since the other button stops the AI. Open in a new window there would need the folder, which only the main process knows.
- **Never trap the window:** if the extension host doesn't answer in 10 s, or the command is missing (a skewed extension), the reload goes on, as today.
- `Reload Window` is reason `RELOAD`, and quitting is `QUIT` or `CLOSE`. Neither asks, as today.

The two-button version for the routes without a target needs the Experience lead's look. It goes with the screenshots.

## 5. What changes in the plan

- **Spec R9:** "Any switch that reloads the window… asks first" now covers VS Code's own routes too. Where the target isn't known (File ▸ Open Folder…, a drop, the CLI, Close Folder), the dialog has no Open in a new window. S33 says which.
- **Technical plan W8:** `workingChats()` on the provider; Switch and stop as above; the head's Open a folder… picks and then switches; 018 gains the LOAD veto and the target stash, about 40 lines in one new contribution and one hunk in the host service.
- **Tests:** `switchProject.test.ts`: nothing working never asks; working asks; Cancel; Open in a new window; Switch and stop waits for the turns; Ritemark's own reload is not asked twice; no target gives two buttons; a guard that never answers lets the reload go after 10 s. A VS Code unit test for the veto contribution: only `LOAD` asks, and a missing command never vetoes.
