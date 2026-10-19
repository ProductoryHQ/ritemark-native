# Confirmations (Phase 1)

Checked 2026-10-19 on `sprint-134-project-at-the-centre` (HEAD `30d7fa3a`, which holds Sprint 133's merge `eae1dedd`). Extension paths are under `extensions/ritemark/`. Shell paths are under `vscode/src/vs/`, VS Code 1.117.0 at the pin `10c8e557` with the 18 patches applied. Line numbers are this branch's.

## 1. A submenu in Ritemark's menu, filled by the extension

- `ritemarkMenu.ts` draws one flat list: rows, hairlines and an optional heading (`IRitemarkMenuItem`, `workbench/browser/parts/ritemarkMenu.ts:21–31`; `renderMenu`, `:96–152`). There is no submenu. A row only runs (`:124–128`), and the arrow keys move in the one list (`:133–148`).
- Ritemark's menus are context views (`:77`). VS Code shows one context view at a time: a second `show` hides the first (`base/browser/ui/contextview/contextview.ts:184–187`). So a submenu cannot be a second menu. It has to be drawn inside the first one's container.
- How the head's menu gets its entries today: `RitemarkProjectHead.showMenu` reads the `ritemark/projectHead` menu with `IMenuService.getMenuActions` and draws each group, with a hairline between groups (`workbench/browser/parts/sidebar/ritemarkProjectHead.ts:176–193`). 018 registers the menu key (`workbench/services/actions/common/menusExtensionPoint.ts:553–568`). `package.json:698–705` puts six commands in it: Switch project…, Open a folder…, Reveal in Finder or Reveal in File Explorer, New folder, Collapse folders. Their words and icons are the commands' own titles and icons. `src/views/projectHeadCommands.ts:26–33, 57–64` makes each run the real command; Switch project… runs `workbench.action.openRecent`.
- Only a `MenuItemAction` gets its icon, and every entry runs `action.run(folder)` (`ritemarkProjectHead.ts:183–186`). A package.json `submenus` entry would come back as a `SubmenuItemAction`: a row with no icon that does nothing when clicked. VS Code also drops a submenu that has no static items (`platform/actions/common/menuService.ts:297–301`).
- The drawing (`experiences/home/home.html`, frame 2) shows a flyout, not a list that replaces the menu. It is 272 wide and sits 4 to the right of the 232-wide project menu, level with Switch project. It has the heading "Your projects". Each project has its initials in a small mark. "1 waits" is quiet text at the right (the kit's `.sub`, not a second line). The open project has a check. Then a hairline, "All projects, on Home", and "Open in a new window" with "⌥ click" at the right.

**The smallest change.** One 018 hunk in two files and no new file:

1. `ritemarkMenu.ts`: `IRitemarkMenuItem` gains three optional fields:
   - `mark?: string`, the initials, drawn in place of the icon;
   - `checked?: boolean`, a check at the right (`role="menuitemradio"`, `aria-checked`);
   - `submenu?: () => Promise<{ heading?: string; items: RitemarkMenuEntry[] }>`.

   `run` receives `{ altKey }`, so ⌥ click (Alt click on Windows) can open a new window. A row with `submenu` gets a caret and `aria-haspopup="menu"`. Pointing at it, Right arrow or Enter draws a second `.ritemark-menu` into the same context-view container, 4 px right of the first and level with the row. Left arrow and Escape close the flyout and return to the row. A choice closes both. `ritemarkCloseOnLeave` already ignores presses inside `.context-view` (`ritemarkMenu.ts:57`), so it needs no change. More and You are untouched.
2. `ritemarkProjectHead.ts`, `showMenu`: a `SubmenuItemAction` becomes a row with `submenu`. A small table names the submenus the extension fills:

   ```ts
   /** Submenus whose rows the extension lists when the menu opens, and the command a row runs. */
   const RITEMARK_DYNAMIC_SUBMENUS = new Map([
   	['ritemark/projectHead/switch', { items: 'ritemark.projects.switcherItems', run: 'ritemark.projects.switchTo' }],
   ]);
   ```

   The rows from `items` come first, then a hairline and the submenu's own static items (`action.actions`). A row runs `run` with the project's id and `{ newWindow: altKey }`. The head starts the `items` command when the project menu opens, so the round trip to the extension host is mostly over before the person reaches the row. If the command is missing or fails (an older or newer extension), the flyout shows the static items only. The shell stays tolerant of version skew.
3. `package.json`: a `submenus` entry `ritemark/projectHead/switch` ("Switch project", `$(arrow-swap)`) at `1_project@0` in `ritemark/projectHead`, in place of today's command. It holds the two static items, All projects, on Home and Open in a new window. No new key is needed in `menusExtensionPoint.ts`: a submenu an extension declares is a menu key of its own.

The item shape becomes `{ id, label, mark, sub, checked }`. `sub` carries "1 waits" as drawn. The plan's `detail` would draw a second line. The heading's words come back with the items, so they stay the extension's.

**For the plan.** W7's "one shell change" holds, but it is a flyout inside one context view. Two things follow:
- The File menu cannot draw this flyout. VS Code's File menu takes static items only, and the Mac's is native. So File ▸ Switch project has to open the switcher somewhere else. The plain choice is Home's place, whose list is the switcher, with its search field focused. The other choice is a shell command that opens the head's menu with the flyout open, but Home has no head. The plan picks one.
- What a click on "Open in a new window" does is not drawn. The row reads as a hint for ⌥ click. The Experience lead says.

Live checks: the flyout is not clipped by the context view's layer; VoiceOver reads it as a submenu; the `items` command answers in time with 20 projects (the waiting audit gives the cost).

## 2. Reveal in Finder, Reveal in File Explorer

- VS Code's label for `revealFileInOS` is "Reveal in File Explorer" on Windows, "Reveal in Finder" on the Mac and "Open Containing Folder" elsewhere (`workbench/contrib/files/electron-browser/fileActions.contribution.ts:27–28`). No patch changes it. The command opens the folder's parent with the folder selected (`showItemInFolder`, `fileCommands.ts:15–29`).
- The head picks its words with two commands, because a command's title cannot change with the system (`projectHeadCommands.ts:8–11`):
  - `ritemark.projectHead.revealInFinder`, "Reveal in Finder", `when: isMac`;
  - `ritemark.projectHead.revealInFileExplorer`, "Reveal in File Explorer", `when: isWindows`.

  Both are in `package.json:701–702`, titled at `:54` and `:59`, hidden from the palette at `:684–685`. Both run `revealFileInOS` on the project's folder (`projectHeadCommands.ts:29–30, 60–62`). On Linux neither shows.
- Two other places use other words:
  - the Agents place's row menu says "Reveal in Finder" on Windows too (`src/views/AgentLibraryViewProvider.ts:1051`);
  - the chat's link menu says "Locate in Finder" on the Mac and "Show in File Explorer" elsewhere (`webview/src/components/ai-sidebar/chatLinks.ts:88`).

**For the plan.** R8's words are VS Code's own, so the head needs nothing new. R19 says "Show in Finder" for the viewers, a third wording beside "Reveal in…" and "Locate in…"; the Experience lead confirms it is meant. W18 already changes `AgentLibraryViewProvider.ts`, so the Agents menu's Windows wording is fixed there. The viewers' webviews do not know the system, so the host sends the words, as the Word bar's `openStatus` does (`src/officePreview/officePreviewProvider.ts:157–160`).

## 3. A new chat, a waiting chat and a card, opened from Home

- `ritemark.newChat` (`src/extension.ts:681–682`) calls `UnifiedViewProvider.clearChat()` (`src/views/UnifiedViewProvider.ts:2168–2170`). That posts `clear-chat` to the sheet's page, if the page exists. The page answers with `startNewConversation`: the current chat is kept and a new one opens (`webview/src/components/ai-sidebar/store.ts:2918–2924, 2171–2177`). **It does not focus or reveal the sheet.** With the AI column closed, or a sheet not yet made in this window, nothing happens. 1.x's launcher ran it the same way (`src/views/HomeViewProvider.ts:26`).
- Sprint 133's landing does it fully. `openLandingChat` runs `ritemark.unifiedView.focus`, and holds its message until the page says `sidebar/ready` (`UnifiedViewProvider.ts:1633–1640`, flushed at `:576–580`).
- A chat is opened by its id through `_revealConversation(conversationId)` (`UnifiedViewProvider.ts:2093–2098`). It focuses the sheet and posts `conversation/select`; the page loads that chat (`store.ts:959–961`). It is private and has no command. The board and comment tasks reach it through their host dependencies (`UnifiedViewProvider.ts:1751, 1813`; `CardHandoffLedger.openConversation`, `src/taskBoard/CardHandoffLedger.ts:263–272`). Unlike the landing, it does not wait for `sidebar/ready`, so its message can be lost on a sheet that is still being made.
- `ritemark.openTaskBoard <cardId>` opens **the card's own page** in the Ritemark editor, not the board with the card picked out (`src/taskBoard/taskBoardHost.ts:307–310`; `cardPages.ts:233–253`). The board takes only a view: `TaskBoardPanel.show(…, { tab })` (`TaskBoardPanel.ts:24`), where `BoardTab` is `calls`, `board`, `ideas` or `log` (`protocol.ts:193`). A card clicked on the board opens the same page (`webview/src/components/tasks/boardUi.ts:48`).

**For the plan.** In W4's actions:
- New chat: a public `openNewChat()` beside `openLandingChat` (focus, then `clear-chat`, held until ready). `ritemark.newChat` calls it too, so the command also works with the AI column closed.
- A waiting chat: a public `openConversation(id)` that wraps `_revealConversation` and holds its message until ready, as the landing does.
- `HomePanel` calls both through its dependencies, as the board does; no new command id.
- A card's call: `ritemark.openTaskBoard <cardId>`, as the plan says, which opens the card's page. "Opened on the board" should read "opened on its page".

## 4. The board writes nothing until the first card

- `BoardStore` creates `.ritemark/tasks/` only in `create`, right before a new card's first write (`src/taskBoard/BoardStore.ts:217–263`, the `mkdir` at `:251`). That `mkdir` is recursive (`nodeConversationStoreFileSystem.mkdir`, `src/conversations/ConversationStore.ts:46–47`). Reading treats a missing folder as an empty board (`ensureLoaded`, `BoardStore.ts:385–397`).
- Opening the board or the Tasks place writes nothing in the project. At activation the host makes the store and the controller, reads the board once (`taskBoardHost.ts:202`) and sets two file watchers (`:177–200`). The surfaces read through the controller. The controller's one setting, the Doing limit, lives in VS Code's workspace state and is written only when the person changes it (`:141–144`).
- The agents' board tools (`src/runtime/ritemarkTools.ts:238–359`):
  - `list_cards` and `read_card` read;
  - `add_card` goes through the same `create`, so it makes `.ritemark/tasks/` too;
  - `update_card`, `move_card`, `report_result` and `ask_user` change a card that exists.
- The hand-off ledger writes `<globalStorage>/task-board/v1/<first 16 hex of sha256(folder)>/<cardId>.json`, and makes that folder, only when a card is handed to an agent and its record changes (`src/taskBoard/CardTaskStore.ts:54–60, 145–154`). At start, `recover` reads the records, removes those of cards that are gone and marks running ones interrupted (`CardHandoffLedger.ts:91–104`). With no records it writes nothing. A card's chat is an ordinary record in `<globalStorage>/conversations/v1/`.

**For the plan.** R13's "no board file until the first card" is true today; W10 needs no change for the board. Two catches. `create`'s `mkdir` is recursive, so adding a card in a project whose folder has gone brings the folder back (section 7). And every project does get `.ritemark/` when it opens, from Flows, not from the board (section 7).

## 5. How 018's head takes a place's rows

- `HEAD_PLACES` maps a container id to `{ newMenu, search, group? }` (`ritemarkProjectHead.ts:37–47`):
  - Documents (`workbench.view.explorer`): New from `ritemark/projectHead/new`, Search runs `workbench.view.search`, the label "Documents";
  - Agents (`workbench.view.extension.ritemark-agent-library`): New from `ritemark/projectHead/agents/new`, Search runs `ritemark.agentLibrary.search`, no label.
- The rows are built once, in the constructor: a `.ritemark-project-rows` block after the title area, holding two fixed rows and the label (`:104–121`). **The rows' words and icons are the shell's** ("New" with `Codicon.add`, "Search" with `Codicon.search`, through `localize`). Only New's entries and Search's command come from the extension. New opens its menu as a Ritemark menu (`:110–114`); Search runs its command (`:116–120`). Each row is a link with `role=button` that takes Enter and Space (`:161–173`).
- `update(compositeId)` turns the head on for a place in `HEAD_PLACES` when a folder is open (`:130–153`). With no folder it stays off. `sidebarPart.ts:191–201` calls it whenever a place opens. The part gives the content what is left under the rows (`rowsHeight`, `ritemarkProjectHead.ts:125–127`; `sidebarPart.ts:217–225`).
- **The title row's actions are hidden by CSS.** On a place with the head, `.composite.title > .title-actions` and `.global-actions` are `display: none !important` (`workbench/browser/media/ritemarkSurfaces.css:1079–1082`). The place's own title is hidden too (`:1108–1110`). On Documents this hides `ritemark.openSearch` and `ritemark.explorer.refresh` (`package.json` `view/title`, `:730–745`).
- Tasks, Browser and Transcribe each show one view, so VS Code draws the view's `view/title` actions in the container's title (`mergeViewWithContainerWhenSingleView: true`, `workbench/api/browser/viewsExtensionPoint.ts:435`). That is the element the CSS hides. Tasks has a second view, `ritemark.tasksBadge`, but it is `when: false`.
- The containers:

| Place | Container in package.json | The shell's id | View |
|---|---|---|---|
| Home | `ritemark-home` (`:570`) | `workbench.view.extension.ritemark-home` | `ritemark.homeView` (`:607`) |
| Tasks | `ritemark-tasks` (`:575`) | `workbench.view.extension.ritemark-tasks` | `ritemark.tasksView` (`:616`); `ritemark.tasksBadge` (`:620`, hidden) |
| Transcribe | `ritemark-transcribe` (`:580`) | `workbench.view.extension.ritemark-transcribe` | `ritemark.transcribeView` (`:655`) |
| Agents | `ritemark-agent-library` (`:585`) | `workbench.view.extension.ritemark-agent-library` | `ritemark.agentLibraryView` |
| Browser | `ritemark-browser` (`:590`) | `workbench.view.extension.ritemark-browser` | `ritemark.browserView` (`:646`) |

**What it takes.** In 018 (`ritemarkProjectHead.ts`, one menu key, one CSS rule):
1. `HEAD_PLACES` gains the three ids. Each entry keeps only its optional label (Documents').
2. The rows come from one new menu, `ritemark/projectHead/rows`, registered beside the others (`menusExtensionPoint.ts:553–568`). Each entry names its place with `when: activeViewlet == <container id>` (the `activeViewlet` context key, `workbench/common/contextkeys.ts:118`). The head keeps the menu (`createMenu`), redraws its rows on `onDidChange`, which fires when the place changes, and lays out again. At most two rows:
   - a `MenuItemAction` is a row that runs its command, with the command's title and icon;
   - a `SubmenuItemAction` is a row that opens its items as a Ritemark menu. New on Documents and Agents become package.json `submenus` holding today's `ritemark/projectHead/new` and `/agents/new` entries.
3. A place with no rows and no label (Browser) hides the rows block. Its padding alone would leave a 20 px band (`ritemarkSurfaces.css:1136–1139`, 12 above and 8 below), and `rowsHeight` must then read 0.

In the extension:
4. The row commands, hidden from the palette like the head's other commands:
   - Documents' Search: `ritemark.openSearch` exists ("Search", `$(search)`);
   - Agents' Search: a head command titled "Search" with `$(search)`, because `ritemark.agentLibrary.search` is "Search Agents" with no icon;
   - Tasks' New task and Search, and Transcribe's Record and Transcribe a file…: none exists yet. Tasks' two post to the Tasks view after `ritemark.tasksView.focus`. Transcribe's two run the handlers the panel's buttons reach today (`transcribe:pickFile` and Record).
5. The title rows' actions: the CSS hides Browser's + and Clear history (`package.json:747–756`) and Transcribe's gear (`:757`) as soon as those places get the head. Each must be in its page in the same change, as W12 says.

**For the plan.** W12 is right in shape. Two corrections:
- Today's "New" and "Search" are the shell's words. Moving them to the extension is part of W12, because R16 asks for it.
- `ritemark.transcribe.openSettings` is not in the palette today (`package.json:682`, `when: false`). "Each stays in the palette" holds for Browser's two commands but not for the gear. The plan either lists it in the palette or drops that line.

## 6. ⌘T and Ctrl+T today

- VS Code 1.117 binds ⌘T (Ctrl+T on Windows) twice:
  - Go to Symbol in Workspace… (`workbench.action.showAllSymbols`), weight 200, no `when` (`workbench/contrib/search/browser/searchActionsSymbol.ts:28–33`);
  - in a web page tab, the integrated browser's New Tab (`workbench.action.browser.newTab`), weight 250, `when: activeEditor == workbench.editor.browser` (`workbench/contrib/browserView/electron-browser/features/browserTabManagementFeatures.ts:336–354`).

  On the Mac, ⌃T in a text editor is Transpose Letters (`editor/contrib/caretOperations/browser/transpose.ts:28`), a different key.
- Ritemark binds neither. `package.json`'s keybindings (`:983–`) have no T, and no patch binds it.
- **An extension binding takes precedence.** A built-in extension's binding gets weight 300 plus its index (`workbench/services/keybinding/browser/keybindingService.ts:631–635`), above both of VS Code's. So `{ "key": "ctrl+t", "mac": "cmd+t", "command": … }` wins everywhere, a web page tab too, unless its `when` leaves out `activeEditor == workbench.editor.browser`. Whether ⌘T in a web page opens the + or a new web page, as browsers do, is the Experience lead's call.
- In a terminal tab on Windows, Ctrl+T goes to the shell unless the command is in `terminal.integrated.commandsToSkipShell`. On the Mac a ⌘ key always reaches the workbench (`workbench/contrib/terminal/browser/terminalInstance.ts:1152`). 019 can add the command to `DEFAULT_COMMANDS_TO_SKIP_SHELL` (`workbench/contrib/terminal/common/terminal.ts:507`).
- **No command opens the + menu.** The + is a button each editor group makes (`createRitemarkNewTabButton`, `workbench/browser/parts/editor/ritemarkNewTab.ts:97–137`, called from `multiEditorTabsControl.ts:204`). Its `show` is a closure. 019 has no new-tab command id.

**For the plan.** W7 says "019's new-tab command"; it does not exist. 019 gains one, proposed `ritemark.newTab`, registered in `ritemarkNewTab.ts`. It opens the + menu of the active group, from a small map of each group's `show`. An empty group's + is hidden, so then it uses the first group's. The package.json binding and File ▸ New tab both run it. Go to Symbol in Workspace stays in the palette unless the palette audit drops it.

## 7. Every recursive `mkdir` under a project

VS Code's `workspace.fs.writeFile` and `copy` create missing parents too (`platform/files/common/fileService.ts:398–400, 831`), so they are listed. `workspace.fs.createDirectory` is used nowhere. Node's `writeFile` does not create parents.

| # | Where | What it creates | When it runs | Can it bring back a gone project? |
|---|---|---|---|---|
| 1 | `src/flows/FlowStorage.ts:40–46` (`ensureFlowsDirectory`), called by `listFlows` (`:51–52`) and `saveFlow` (`:103–104`) | `<project>/.ritemark/flows` | **A timer.** The flow scheduler starts at activation in any folder (`src/extension.ts:631–636`). It ticks at once, then every 30 s (`FlowScheduler.ts:97–105`; `flowSchedule.ts:3`), and each tick runs `listFlows` (`FlowScheduler.ts:126–131`). Its flag is experimental, but the setting's default is `true` (`package.json:361–365`; `featureGate.ts:57–60`), so it runs. Also New flow (`extension.ts:179–188`) | **Yes, within 30 s, with no action.** This is Sprint 133's finding. It also gives every project an empty `.ritemark/flows/` the moment it opens |
| 2 | `src/ritemarkEditor.ts:1053–1059` (`createAgentFlow`) | `<project>/.ritemark/flows` | User: a flow made from an agent's page | Yes |
| 3 | `src/ritemarkEditor.ts:1293–1297`, through `src/utils/imageWriter.ts:60–62` | `images/` beside the document | User: an image pasted or dropped | Yes, the document's folder and its parents |
| 4 | `src/ritemarkEditor.ts:1364–1370` (`insertDiagram`) | `images/` beside the document | User: Insert diagram | Yes |
| 5 | `src/taskBoard/BoardStore.ts:251` | `<project>/.ritemark/tasks` | User or agent: a new card (`add_card`) | Yes |
| 6 | `src/speech/recording/RecordingController.ts:202` (`mkdirp`, `WavRecordingSink.ts:84`) | `<project>/recordings` (`recordingPaths.ts:32–34, 48–49`) | User: Record | Yes |
| 7 | `src/views/AgentLibraryViewProvider.ts:345, 354` | `<project>/.claude/agents`, `skills` or `commands` | User: a new agent, skill or command in project scope | Yes |
| 8 | `src/views/AgentLibraryViewProvider.ts:468` | the other scope's `.claude/<kind>` | User: Move to This project | Yes |
| 9 | `src/views/AgentLibraryViewProvider.ts:392` (`_copyDirRecursive`) | a skill's copy beside it | User: Duplicate | No: the original's folder is there |
| 10 | `src/flows/nodes/SaveFileNodeExecutor.ts:101–108`, then `workspace.fs.writeFile` (`:23`) | a flow's output folder | A flow run, by the person or the scheduler | Yes, if a run is under way when the folder goes |
| 11 | `src/flows/nodes/ImageNodeExecutor.ts:130–137`, then `workspace.fs.writeFile` (`:30`) | `<project>/.flows/images` | A flow run | As 10 |
| 12 | `src/acp/acpFsProxy.ts:177` (`workspace.fs.writeFile`) | an OpenCode agent's file, with its parents | Agent: an approved write | Yes. Claude Code and ChatGPT write with their own tools, outside Ritemark's code |
| 13 | `src/editorSync/DocumentSyncCoordinator.ts:478` (`workspace.fs.writeFile`) | the document's folder | User: Keep my version, in a conflict | In principle; that path reads the disk first |

Not under a project, so left out:
- the drafts folder `~/Documents/Ritemark` (`extension.ts:112`) and the starter pack in `~/.claude` (`:217–253`);
- the welcome's new project and sample project, in the folder the person chose (`src/welcome/newProject.ts:95–97`; `sampleProject.ts:52`);
- a transcript saved to a folder picked in a dialog (`src/speech/exportTranscript.ts:89`; `transcriptWorkbenchProvider.ts:430–443`);
- Save as Markdown's images, beside a file picked in a save dialog (`src/export/saveAsMarkdown.ts:66–78`);
- Excel's backup, in VS Code's backup folder (`excelEditorProvider.ts:245`);
- the stores under globalStorage (chats, owners, comment tasks, hand-offs, Google Docs, transcripts), the update folders and the dictation models.

Outside the extension: VS Code saves a document with `writeFile`, which makes missing parents, and Ritemark sets `files.autoSave: afterDelay` at 1 s (`package.json:893–894`). A document with unsaved typing, open in a project that is deleted, is saved back with its folders. That keeps the person's words; it is not changed.

**For the plan.** One site brings a folder back with no action: the scheduler's tick, through `listFlows`. W10's fix should be firmer than "a `stat` first":
- `listFlows` creates nothing: a missing `.ritemark/flows` means no flows.
- Only `saveFlow` creates `.ritemark/flows`, after a `stat` of the project folder.

That also stops every project gaining an empty `.ritemark/flows/` when it opens. Sites 2 to 8, 10 and 11 get the same guard through one small helper: the project folder must exist, then `mkdir` below it. Each says in words that the folder is gone. Then R13's "nothing brings a gone folder back" holds for Ritemark's own code. Site 12 is the agent's own write; it is left, and the QA evidence says so. S53 waits at least 35 s after deleting the folder.

## 8. Opening a PDF in Preview, and in its default app on Windows

- `src/utils/openExternal.ts` has two functions:
  - `openInExternalApp(filePath, appName)`: on the Mac `open -a "<app>" "<file>"`; on Windows `start "" "<file>"`, the default app, with the app name ignored; elsewhere `xdg-open` (`:56–69`);
  - `openWithDefaultApp(filePath)`: on the Mac `open <file>` through `execFile`; otherwise the same `start` (`:75–82`).

  There is no Preview function, but `openInExternalApp(file, 'Preview')` already does both: Preview on the Mac, the default app on Windows.
- `openInExternalApp` builds one shell string, with the path inside double quotes (`execAsync`, `:60`, `:64`). On the Mac the shell still reads `$(…)`, backticks and `"` in a file name; on Windows cmd reads `%name%`. A file named that way would run a command. The PDF's new item should not reuse the string form. On the Mac: `execFile('open', ['-a', 'Preview', file])`. On Windows: `vscode.env.openExternal(vscode.Uri.file(file))`, which hands the file to the system without a command line (a live check confirms it opens the default app), or `openWithDefaultApp` as the Word bar does.
- The PDF's provider handles only `ready`, `refresh` and `saveAsMarkdown`, and sends no words (`src/pdfEditorProvider.ts:74–88`). Share's two items need two new messages and a words message.
- The Word bar's Open in Word:
  - on `ready` the host sends `openStatus` with `openLabel` (`officePreviewProvider.ts:157–160`);
  - the label is the first installed of "Open in Word" (Microsoft Word) and, on the Mac only, "Open in Pages"; with neither, "Open in default app" (`:57–60, 301–310`);
  - the button posts `openInExternalApp` (`:166–167`). On the Mac with an app found, it runs `openInExternalApp` with that app; otherwise, on Windows always, `openWithDefaultApp`. Then a toast says "Opening in Microsoft Word..." (`:313–323`);
  - the page shows "Open in Word" until the host answers (`webview/src/components/viewers/DOCXViewer.tsx:163, 193`). Save as Markdown is in that button's menu (`:614–619`).

**Words for the PDF's second item on Windows.** Proposed: **"Open in default app"**. The Word bar already says exactly that when it cannot name the app (`officePreviewProvider.ts:308`), so the two bars agree. "Open with…" would promise the system's app chooser, which this does not open. Naming the app, for example "Open in Microsoft Edge", needs the file association from the registry; the Word bar does not do that either. These go to the Experience lead with the screenshots, as R19 says. On the Mac the item is "Open in Preview".

## 9. `workbench.action.openSettings`

- `workbench.action.openSettings` ("Preferences: Open Settings") runs `IPreferencesService.openSettings` (`workbench/contrib/preferences/browser/preferences.contribution.ts:227–252`). That opens VS Code's Settings editor. It opens `settings.json` instead only when `workbench.settings.editor` is `json` (`workbench/services/preferences/browser/preferencesService.ts:215, 222–270`). Ritemark sets that setting nowhere (`branding/product.json`, `package.json`).
- ⌘, and Ctrl+, run `ritemark.aiSettings` (`package.json:983–987`). Its built-in weight (301) beats VS Code's own ⌘, binding (200), which is still registered.
- No patch redirects `workbench.action.openSettings` or the Settings editor. Two hunks open Ritemark Settings from their own controls instead: 002's global activity button (`GlobalActivityActionViewItem.run`, `patches/vscode/002-ritemark-ui-layout.patch:914–916`) and 018's You menu (`workbench/browser/parts/ritemarkFrameStrip.ts:34, 97`). Neither touches the command.
- The Settings page posts plain messages, `vscode.postMessage({ type: … })` (`webview/src/components/settings/RitemarkSettings.tsx:11`; for example `:243`, `:272`, `:679`). The host receives them in `panel.webview.onDidReceiveMessage` → `handleMessage`, a `switch` on `message.type` (`src/settings/RitemarkSettingsProvider.ts:279–292, 526–531`). The messages are untyped. The page names them `area:verb` in camelCase (`usageData:set`, `updates:checkNow`, `codex:cancelLogin`).

**For the plan.** W17 is one `case` in `handleMessage` that runs `workbench.action.openSettings`, and one link on the page. Name the message `settings:openAdvanced`, as this file does; the plan's `settings:open-advanced` is the board's style. Live check: on a profile that never set `workbench.settings.editor`, the link opens the Settings editor, not `settings.json`.

## 10. The Home place clicked again

- 018 runs `ritemark.placeClickedAgain` with one argument, the container's id (`this.compositeBarActionItem.id`, for example `workbench.view.extension.ritemark-tasks`) (`workbench/browser/parts/paneCompositeBar.ts:860–864`). It does so only when the click is in the places row (the side bar's part) **and** the place is the one already open. **A first click is not reported.** It opens the place (`:866`).
- The extension registers the command once, in `taskBoardHost.ts:303–305`, and acts only for Tasks (`TASKS_PLACE_ID`, `:38`). VS Code refuses a second registration of a command id, so Home cannot register its own.
- A first click is seen today through the view becoming visible. The Tasks view brings the board forward on `onDidChangeVisibility`, and when it is made more than 10 s after activation (a restore at start is not a click) (`src/views/TasksViewProvider.ts:15, 34–38`). Visibility also changes when the left column is hidden and shown again (⌘B), so showing the column on Tasks brings the board forward too.
- Home's place: the container is `ritemark-home` (`package.json:570`), so its id is `workbench.view.extension.ritemark-home`. It is first in the places row (`workbench/browser/parts/compositeBar.ts:31`; order −1 in `viewsExtensionPoint.ts:36`). Its one view is `ritemark.homeView` (`package.json:607`), registered today at `extension.ts:511–520`.

**For the plan.** W5 is right to use both signals, a second click and the view becoming visible. The command moves out of `taskBoardHost.ts` into one handler that dispatches by id (Tasks → the board; Home → `ritemark.openHome`), for example in `permanentTabs.ts`, because it can be registered only once. The projects view copies the Tasks view's 10 s rule, so a window restored on Home leaves the person's tab in front. Live check: ⌘B on Home brings Home's tab forward, as it does for Tasks today; the Experience lead says whether that is wanted.

## What this changes in the plan

- **W7:** the switcher is a flyout drawn inside the head's one context view; its items are `{ id, label, mark, sub, checked }` with a heading. File ▸ Switch project needs a place to open, since the File menu cannot hold the flyout (section 1). 019 has no new-tab command; it gains `ritemark.newTab` (section 6).
- **W4:** New chat and a waiting chat need public, held openers on `UnifiedViewProvider`; `ritemark.newChat` does not focus the sheet today. A card opens on its page (section 3).
- **W10:** `listFlows` stops creating `.ritemark/flows`. Sites 2 to 8, 10 and 11 get a "project folder must exist" guard (section 7).
- **W12:** the row words move from the shell to the extension, through one menu with `activeViewlet` clauses. Browser's empty rows block is hidden. Transcribe's settings command is not in the palette today (section 5).
- **W13:** the PDF's item opens Preview with an argument list, not a shell string. On Windows it reads "Open in default app", pending the Experience lead (section 8).
- **W17:** the message is `settings:openAdvanced` (section 9).
- **W5:** one `placeClickedAgain` handler for Tasks and Home (section 10).
- **W18:** fix the Agents row menu's "Reveal in Finder" on Windows (section 2).
