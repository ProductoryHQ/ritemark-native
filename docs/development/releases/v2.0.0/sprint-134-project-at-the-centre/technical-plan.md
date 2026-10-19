# Sprint 134 Technical Plan

The plan for [spec.md](spec.md). The release is [v2.0.0](../release-plan.md), step 3; the research behind it is the release's [feasibility read](../feasibility.md), the Experience lead's technical analysis ("The project at the centre", `ritemark-dev`: `product/design/experience/technical/README.md`), and the proof of concept (`/Users/jarmotuisk/Projects/ritemark-2.0-poc`, branch `poc/2.0-surfaces`, read only). Code shapes here are proposals: when the code needs something else, this file changes first. File references are to `main` at `d781a0e1` (Sprint 132 merge 1) unless marked PoC. The rows and workstreams added in the 18 October refresh (R16–R19) refer to `main` at `b1c198af`, after Sprint 132's closeout. Those added on 19 October (R20–R24, W14–W18) refer to `main` at `e31dd7e4`.

## What exists today

| Part | On main | In the proof of concept |
|---|---|---|
| Home's place | 1.x's launcher: the view `ritemark.homeView` in the container `ritemark-home`, its own HTML (no shared bundle, no CSP), behind the experimental flag `home-launcher`. It offers New document (`ritemark.newDocument`), New AI conversation (`ritemark.newChat`), Task board (`ritemark.openTaskBoard`), Open document… , New table (`ritemark.newTable`) and Open folder…; recent documents (five newest `.md`) with a folder, recent folders (`_workbench.getRecentlyOpened`) without one (`views/HomeViewProvider.ts:23–181`; `extension.ts:474–478`) | `ProjectsViewProvider.ts` takes the same slot: the open folder first, then up to 12 folders from `_workbench.getRecentlyOpened` that still exist; HTML with `innerHTML` |
| Home's tab | None. Patch 019 already reserves the permanent view type `mainThreadWebview-ritemark.home` (`RITEMARK_PERMANENT_VIEW_TYPES`) | `HomePanel.ts`, view type `ritemark.home`: cover, mark, name, folder, line, what waits (the board's calls only, no chats), last changed (five newest of several kinds); `innerHTML` with an escape helper; redraws on file changes (1.5 s), on show and on board changes |
| The project file | None | `.ritemark/project.json` with `about` (200 characters) and `cover` (a path under `.ritemark/`); read-merge-write on a change; a new cover copied to `.ritemark/cover<ext>` |
| About this project | None. Claude Code reads a project's `CLAUDE.md` and the files it imports with `@` (`@AGENTS.md`); Codex and OpenCode read `AGENTS.md` | — |
| Home and Tasks pinned | Patch 019's rule keeps a **pinned** Home or Task board tab first and permanent. Nothing on main pins the board: `TaskBoardPanel.show` only respects a restored pinned tab (`taskBoard/TaskBoardPanel.ts:25–33`) | `permanentTabs.ts`: opens whichever is missing in group 1 after 800 ms, pins it (`workbench.action.pinEditor`), moves Home first, returns to the previous tab; again 400 ms after one is closed or unpinned |
| The Tasks place's count | A hidden tree view `ritemark.tasksBadge` carries `snapshot.attention.count`, the board's calls (`taskBoardHost.ts:100–106`; `BoardController.ts:266–340`) | — |
| The Tasks tab's count | None | A hunk in the PoC's patch reads the Tasks container's badge from `IActivityService` and draws it on the board's tab (`multiEditorTabsControl.ts`) |
| A place clicked again | 018 runs `ritemark.placeClickedAgain`; the extension handles only Tasks (`taskBoardHost.ts:37–38, 303–305`) | `RITEMARK_PLACE_TABS` in the shell (dropped by Sprint 132) |
| The head's menu | `ritemark/projectHead`: Switch project… runs `workbench.action.openRecent`; Open a folder…; Reveal in Finder or File Explorer; New folder; Collapse folders (`views/projectHeadCommands.ts:25–41`) | The same, drawn in the shell |
| Chats | One store for every project: `<globalStorage>/conversations/v1/` with `index.json`; each record's scope is `ps1-` + a hash of its folders (`conversations/projectScope.ts:43–66`), and the record keeps the folder URIs. `lifecycle.state: 'needs-user'` with `attentionKind` (`approval`, `question`, `plan-review`) is stored, so it can be read without a runtime. A clean shutdown marks running turns interrupted; after a crash only the opened project's are swept (`ConversationController.ts:651–669`); live owners are in `conversations/owners/<pid>.json`. `list()` with no scope reconciles and rewrites the index | Not read |
| A board | Cards are `<project>/.ritemark/tasks/*.md`, parsed by the pure `parseCardFile`. This computer's hand-off records are `<globalStorage>/task-board/v1/<sha256(folder)[:16]>/<cardId>.json`; they hold no folder path. `deriveWho(card, handoff)` is exported and has no `vscode` import (`BoardController.ts:176–191`) | `waitingInFolder` reads card files only and counts asks and results: it misses the calls only the hand-off records know |
| The splash | Patch 001 sets the dark auto-detect splash to `#1E1B4B`; otherwise VS Code's `partsSplash.ts` saves `editor.background` (white in Ritemark Light) and the bars' colours. `ritemark.ground` is not used | Unchanged |
| The document's bar | `header/DocumentHeader.tsx`: Contents, Properties, comments, Agent; dictation, the sync action (only for a conflict or a retry), Export. `ExportMenu.tsx`: Export PDF, Export Word, Google Docs (Connect…, Create, Reconnect…, Sync, Open, Remove link…), Copy as Markdown. The host sends `document:sync-state` (`synced`, `local-only`, `applying`, `conflict`, `apply-error`, `failed`); nothing shows Saved | — |
| The shared bundle | `webview/src/main.tsx` picks the root by `data-editor-type`; `media/webview.js` is 8,478,880 bytes | — |
| The heads of the other places | 018's `ritemarkProjectHead.ts` draws the project's head only on Documents and Agents (`HEAD_PLACES`), each with a New menu and a Search command from the extension. Tasks, Browser and Transcribe keep their plain title row ("Tasks", "Browser", "Transcribe"; the Browser view was renamed at Sprint 132's closeout) | — |
| Tasks' list | `webview/src/components/tasks/TasksPanel.tsx`: an add field ("Add a task…"), Your calls as a panel of its own, then Doing, To do, Ideas, Done and Archived | — |
| Browser's place | `src/browser/BrowserPanelProvider.ts`: HTML from strings with an escape helper; the empty text "No recent URLs" (`:214`); New browser tab (`ritemark.browser.newTab`) and Clear history (`ritemark.browser.history.clearAll`, no confirmation, `extension.ts:978`) on the view's title row (`package.json` `view/title`) | — |
| Transcribe's place | `webview/src/components/transcribe/TranscribePanel.tsx`: Add recording and Record on one row, then Transcribing, Needs attention and Library (or All projects); a settings button on the view's title row (`ritemark.transcribe.openSettings`) | — |
| The PDF and Word bars | `viewers/PDFViewer.tsx:505` and `viewers/DOCXViewer.tsx:619`: Save as Markdown (`src/export/saveAsMarkdown.ts`), behind `save-as-markdown-from-preview`; no Share | — |
| The File menu | 003 adds New table to VS Code's File menu; there is no New tab and no Switch project | — |
| Flows' storage | `src/flows/FlowStorage.ts:44` makes `.ritemark/flows` with `recursive: true`, which recreates a project folder that was deleted while it was open (Sprint 133's QA) | — |
| The browser's share question | The AI sheet's host polls the active browser tab (`UnifiedViewProvider._sendActiveBrowserContext`, `views/UnifiedViewProvider.ts:2983`) and, for a page not yet shared, calls `BrowserContextStore.ensureSharedForActiveTab` (`browser/BrowserContextStore.ts:114`). It marks the page as asked, then runs 009's `workbench.action.browser.ensureActiveBrowserShared`, which calls upstream's `setSharedWithAgent(true)`. That opens VS Code's modal confirm dialog ("Share with Agent?", Allow, Deny, "Don't ask again"; upstream's `contrib/browserView/common/browserView.ts:596` at the pin), which blocks the whole window (#455). "Don't ask again" is stored only with Allow, in the profile key `browserView.shareWithAgent.dontAskAgain`. No page content reaches a turn unless shared (`buildTurnContext`, Sprint 67 D5). The control question is 010's own modal (`ensureControlConsent`) | — |
| The command palette | All commands lists every enabled `MenuId.CommandPalette` entry (`commandsQuickAccess.ts`, `getGlobalCommandPicks`), and the active editor's actions. Patch 003 drops developer and chat entries from menus only. Debugging commands such as `workbench.debug.viewlet.action.addDataBreakpointOnAddress` and `workbench.debug.viewlet.action.addFunctionBreakpointAction` (`breakpointsView.ts`, `f1: true`) are listed (#456) | — |
| "Codex" in visible strings | A first search on `e31dd7e4` finds about 100 lines with a string literal that names Codex, in some 35 files, not all of them visible, and 10 in `package.json`. Among them: Settings (`RitemarkSettings.tsx`, the ChatGPT card, the Update Center's components), `package.json`'s setting titles and descriptions (its "Codex" section), toasts (`RitemarkSettingsProvider.ts:890–901`, `UnifiedViewProvider.ts:2664`), the AI sheet (`CodexSetupView.tsx`, `RuntimeAvailabilityNotice.tsx`, `aiDisclosure.ts`), the model catalog's descriptions (`bundledCatalog.ts`), flows (`CodexNodeExecutor.ts`, `stepKinds.ts`), the task board (`AgentSplitButton.tsx`, `CardMenu.tsx`) and the install and repair terminals' names. Sprint 133's branch already says ChatGPT in the composer's placeholder and on the welcome | — |
| Ritemark Settings' foot, VS Code's settings | ⌘, and Ctrl+, run `ritemark.aiSettings` (`package.json` keybindings). VS Code's settings open only from the palette ("Preferences: Open Settings"). `RitemarkSettings.tsx` ends after the Update Center and the component cards, with no link to them | — |
| The Agents place's row icons | 018's Agents place draws one icon per kind in muted ink (`AgentLibraryViewProvider.ts:658`). An agent's `color:` is still read (`resolveIconAndColor`, `agent/iconPack.ts:132`) and set from the agent's settings (the Color field, `AgentConfiguratorPanel.tsx:488`), but it is drawn nowhere. v1.14.0 drew each row's own icon on a chip in its colour, chosen or guessed from the name (`COLORS`) | — |

## Architecture overview

| Layer | What changes | Where |
|---|---|---|
| Extension: a new `projects` subsystem | The project file; the project list and its first fill; what waits, in each project and across them; switching | `src/projects/` (new) |
| Extension: views | Home's tab; the projects list in Home's place; the permanent tabs; What moved | `src/views/HomePanel.ts`, `ProjectsViewProvider.ts`, `permanentTabs.ts` (new); `HomeViewProvider.ts` replaced |
| Extension: the head | Switch project ▸ with the projects; About this project (`AGENTS.md`, opened or created) | `src/views/projectHeadCommands.ts`, `src/projects/aboutFile.ts` (new), `package.json` |
| Extension: the board | Opened and pinned by the permanent tabs; Home's place clicked again | `src/taskBoard/taskBoardHost.ts`, `TaskBoardPanel.ts` |
| Webview | Home and the projects list in the shared bundle; Saved and Share on the document's bar | `webview/src/components/home/` (new), `webview/src/main.tsx`, `components/header/` |
| Patch 019 | The Tasks tab's count | `patches/vscode/019-ritemark-tab-row.patch` |
| Patch 018 | The splash in the ground's colour; the head's Switch project submenu; File ▸ Switch project | `patches/vscode/018-ritemark-surfaces.patch` |
| Patch 001 | The dark splash default moves to the dark ground, if the splash audit keeps that hunk | `patches/vscode/001-ritemark-branding.patch` |
| Patch 018 | The head on Tasks, Browser and Transcribe, with each place's rows from the extension; New tab and Share in the File menu | `patches/vscode/018-ritemark-surfaces.patch` |
| Extension: the places | Tasks' rows and list; Transcribe's rows and labels; Browser's Recent label, its two actions and its words | `TasksPanel.tsx`, `TranscribePanel.tsx`, `src/browser/BrowserPanelProvider.ts`, `package.json` |
| Webview: the viewers | Make an editable copy and Share on the PDF and Word bars | `viewers/PDFViewer.tsx`, `viewers/DOCXViewer.tsx`, `viewers/ViewerToolbar.tsx` |
| Extension and webview: the AI's sheet | The share question, asked on the sheet and answered there | `src/browser/BrowserContextStore.ts`, `src/views/UnifiedViewProvider.ts`, `webview/src/components/ai-sidebar/` |
| Patch 009 | The share bridge takes the person's answer, so upstream's dialog does not open | `patches/vscode/009-ritemark-browser-context-bridge.patch` |
| Patch 003 | The palette's filter of command IDs | `patches/vscode/003-ritemark-menu-cleanup.patch` |
| Extension and webview: words | "ChatGPT, never Codex" in every visible string | the files the Codex audit lists, `package.json` |
| Extension and webview: Settings | Advanced settings at the foot | `RitemarkSettings.tsx`, `src/settings/RitemarkSettingsProvider.ts` |
| Extension: the Agents place | An agent's chosen colour on its row's icon; the colours in the theme | `src/views/AgentLibraryViewProvider.ts`, `src/agent/discovery.ts`, `package.json`'s colours |
| Harness | CDP checks for the tabs and switching; Home in the screenshot baseline | `scripts/qa/` |

The release tier is **shell** (`patches/`). The `projects` subsystem is new at `src/<subsystem>/` level, so `architecture.md` gets its section (E6). The new webview ↔ host messages (Home's and the projects list's) are typed in `src/projects/protocol.ts`.

## Phase 1 audits

1. **`research/waiting-audit.md`** (R3, R6): computing another project's calls from its card files and its hand-off records (`projectKey(folder)`), mapped as `CardHandoffLedger.list()` maps them, through `deriveWho`; chats that need the person from `index.json` read as it is (never `list()` with no scope, which rewrites it), mapped to folders through the records' scopes, and kept only when a live owner holds them (a `needs-user` left by a crash is not a call); the cost with 20 projects of 50 cards each. After Jarmo's answer of 19 October ("Also unread answers"), it also settles the read marker: which field records when a chat's newest reply finished (a reply, a failure, or neither for a turn interrupted by a restart), where the marker lives in the record and in `index.json` so another project's unread replies are counted from the raw index, when the sheet marks a chat read (in front on a shown sheet, in the window that has focus or not), how records from before this build count as read, and how a card's chat (`sourceKind: card`) is left to its card.
2. **`research/first-fill-audit.md`** (R2): the three sources and how each gives a folder path:
   - VS Code's recent folders, read once through `_workbench.getRecentlyOpened`;
   - the chat store's records, whose scopes carry their folder URIs;
   - task boards: a hand-off directory is named by a hash of its folder, so a board is found only through a known folder. The audit checks one more read-only source on this computer, VS Code's own record of every folder a window has opened (`workspaceStorage/*/workspace.json`, beside this window's `context.storageUri`), and whether folders found there that hold `.ritemark/tasks` are worth adding. If it is not reliable, boards in folders known from the other two sources are found, and the rest join the list when they are next opened.
3. **`research/switch-audit.md`** (R9): how the host knows a chat in this window is working (a running turn, a card's turn in its chat) and how Switch and stop stops it as Stop does; which ways of switching Ritemark controls (Home's list, the head's switcher and Open a folder…, File ▸ Switch project) and which it does not (VS Code's own File ▸ Open Folder… and Open Recent); whether a small shell veto on the workbench's shutdown with reason LOAD can ask the extension before VS Code's own routes switch, or whether those routes are left as today, where switching stops the work. Experience 33 asks for every switch that reloads the window.
4. **`research/splash-audit.md`** (R9): how `partsSplash.ts` chooses its colours, which colour key carries the ground, the stored splash on a v1.14.0 profile, and the first window of a fresh profile in Light and Dark.
5. **`research/about-file-audit.md`** (R8): where Ritemark draws a file's name, and how each place can say About this project for the project's own `AGENTS.md` (Jarmo, 18 October: shown everywhere by that name):
   - the head's menu (the extension's words);
   - its tab (the Ritemark editor's title for a `.md`);
   - Documents (the resource label, whose name and extension 018 already draws apart since Sprint 133);
   - Home's Last changed (W4), and the AI sheet where it names a file.
   It also settles how Documents hides the one-line `CLAUDE.md` (decided: only Ritemark's pointer-only file is hidden; a `CLAUDE.md` with the person's words stays visible), and how the tab and the Documents row draw the book-open icon and the tooltip "AGENTS.md, read by Claude and ChatGPT". A folder that has its own `CLAUDE.md` but no `AGENTS.md` is decided (Experience lead, 18 October): Create writes `AGENTS.md` and leaves `CLAUDE.md` as it is, and the page shows the note with Add the line and Not now (spec R8).
6. **`research/share-question-audit.md`** (R20): every path that opens upstream's share dialog:
   - `ensureSharedForActiveTab`, the one this sprint moves;
   - the page's own "Share with Agent" toggle (upstream's `browserEditorChatFeatures.ts`);
   - annotation mode and the control question, which share first when a page is not yet shared.
   It records which go through the sheet and which keep today's dialog, and how 009's bridge reads and writes `browserView.shareWithAgent.dontAskAgain` without the dialog. It also checks when the host polls (a hidden sheet, a closed AI column), so a question never waits where it cannot be seen.
7. **`research/palette-audit.md`** (R21): **the list of command IDs to drop**, written into W15's table below. It reads every All commands entry on a dev build of the pin, by category (Debug, Developer, Test, Tasks, Notebook and the rest), with its ID and title. It marks each one drop or keep by spec R21's rule:
   - Ritemark's own commands are kept;
   - a command a Ritemark menu, doc, skill or QA step names is kept (for example `workbench.action.reloadWindow`);
   - a command the parity list reaches through All commands only is kept (refreshing the file list; Maximize for the AI's column, G7; Send feedback);
   - a family that goes whole may be one ID prefix (for example `workbench.debug.`), with every ID it drops listed.
   The first two IDs are known: `workbench.debug.viewlet.action.addDataBreakpointOnAddress` and `workbench.debug.viewlet.action.addFunctionBreakpointAction` (#456).
8. **`research/codex-strings-audit.md`** (R22): **every user-visible "Codex" string**, before any word changes. It is run after Sprint 133 merges, so the welcome's words are counted. For each string it records the file and line, where a person reads it, what it says now and what it will say. It covers string literals in `src/` and `webview/src/`, `package.json` (titles, descriptions, enum descriptions), `flags.ts`, terminal names and the model catalog. It lists apart what stays:
   - setting keys, command IDs, file names, log lines and code identifiers;
   - a model's own name, such as "GPT-5.3 Codex Spark";
   - text the runtime writes itself.
   Its search, with the list of what stays, is kept so QA can run it again.

`research/confirmations.md` records the smaller checks: VS Code's `revealFileInOS` label on Windows, Ritemark's menu (018's `ritemarkMenu.ts`) taking a submenu, and how the AI sheet's new chat is opened from Home. From the refresh it also records:
- how 018's head takes a place's rows from the extension, and what happens to a view's title-row actions under the head (R16);
- what ⌘T and Ctrl+T run today (VS Code binds them to Go to Symbol in Workspace), so New tab can take them (R8);
- every place in the extension that creates a folder with `recursive: true` under a project, besides Flows' storage (R13).

From 19 October it also records:
- how the PDF's provider (`pdfEditorProvider.ts`) opens a file in Preview on the Mac and in its default app on Windows, and what that item says on Windows, checked with the Experience lead (R19);
- that `workbench.action.openSettings` opens VS Code's settings page, not Ritemark Settings, with ⌘, bound to `ritemark.aiSettings` (R23).

## What the audits changed (19 October)

Each workstream below follows these, which override its own text where they differ.

- **W1:** the project's name and mark are the folder's in this sprint: nothing lets a person change them, and 018's head draws the folder's name. A `name` or `mark` in the file is kept, not drawn (`projectFile.ts`).
- **W2** ([first-fill audit](research/first-fill-audit.md)):
  - sources, in order: VS Code's recent folders (their URIs keep VS Code's spelling), then the chat store read raw (`index.json`, then one record per scope for its folder URIs; `records/` only when the index can't be read). Never through `ConversationStore`, whose every method rewrites the index;
  - no board source: a board's records name no folder;
  - VS Code's `workspaceStorage/*/workspace.json` and its `state.vscdb` modified times give each folder's last-open time, for the order only;
  - only single folders that exist at the time (a timeout per check, for network shares); no `.code-workspace`, remote or virtual folders, and not the sample inside the app;
  - on Windows the chat store lower-cases whole paths, so a folder known only from chats is spelled by `fs.realpathSync.native` before it is listed (hand-off records and VS Code's saved tabs are keyed by the exact `fsPath`);
  - the fill is a merge (the union, the later time), so two windows running it together give the same list; `ritemark.projects.filledV1` is written after the list.
- **W3** ([waiting audit](research/waiting-audit.md)): as W3 says above.
- **W4** ([confirmations](research/confirmations.md) §3):
  - `ritemark.newChat` neither reveals nor focuses the AI's sheet, and a chat opens by id only through the private `_revealConversation`. The provider gains public, held openers, as `openLandingChat` is: `openNewChat()` and `openConversation(id)`, which reveal the sheet and wait for it to be ready;
  - a waiting card opens its card page, as `ritemark.openTaskBoard <cardId>` and the Tasks place's rows do.
- **W5** (confirmations §10): `ritemark.placeClickedAgain` can be registered once, so Tasks and Home share one handler, keyed by the container id (`workbench.view.extension.ritemark-home`, `…-tasks`). A first click on a place is seen as its view becoming visible.
- **W7** (confirmations §1, §2, §6):
  - **the switcher** is a flyout inside Ritemark's menu, as experience 3 frame 2 draws it: VS Code shows one context view at a time, and `ritemarkMenu.ts` has no submenu. 018 gains optional `mark`, `checked`, `sub` and `submenu` fields on a menu item, and a table that maps the `package.json` submenu `ritemark/projectHead/switch` to the command `ritemark.projects.switcherItems`. If the command is missing, the flyout shows only its fixed rows;
  - **File ▸ Switch project** shows Home with the projects list and focuses its search (spec R8);
  - **New tab** needs a command: 019 has none, the + is a button. 019 gains `ritemark.newTab`, which opens the +'s menu at the front desk's +; the extension binds ⌘T and Ctrl+T to it with a `when` that outranks Go to Symbol in Workspace and the browser's own new tab. On Windows, the command joins the terminal's commands that skip the shell;
  - Reveal's words follow VS Code's: Reveal in Finder (Mac), Reveal in File Explorer (Windows), as the head already does.
- **W8** ([splash audit](research/splash-audit.md)): 018's hunk in `partsSplash.ts` `_savePartsSplash()` saves `ritemark.ground` (falling back to `sideBar.background`) as the splash's `background` and `editorBackground`, which the main process and `workbench.ts` already use. 001's two defaults in `workbench.ts` become the grounds: `#16132F` (Dark) and `#F1F5F9` (Light). A fresh profile's very first window stays as today (out of R9's scope).
- **W10** (confirmations §4, §7): `FlowStorage.listFlows()` creates nothing; `saveFlow` and the other sites that make a folder under a project (a card's `.ritemark/tasks/`, exports, transcripts: 13 listed in the note) go through one guard, `ensureProjectSubfolder(project, …)`, which refuses when the project's folder itself is gone.
- **W12** (confirmations §5):
  - `HEAD_PLACES` is a fixed map, and its "New" and "Search" words are the shell's. It becomes one extension menu, `ritemark/projectHead/rows`, whose items carry `when: activeViewlet == …`; the head draws up to two of them with their own titles and icons. Documents and Agents keep their rows through it;
  - a place with the head hides its title-row actions by CSS (`ritemarkSurfaces.css`), so Browser's and Transcribe's buttons move into their pages in the same change;
  - `ritemark.transcribe.openSettings` is not in the palette today, so its gear lives in the page only, as in v1.14.0.
- **W13** (confirmations §8): `openInExternalApp(file, 'Preview')` opens Preview on the Mac and the default app on Windows, but builds a shell string, so a crafted file name could run a command. It moves to `execFile` with an argument list in this sprint (the same code path R19 uses). The Windows item says "Open in default app".
- **W17** (confirmations §9): the message is `settings:openAdvanced`, as that file names its messages.
- **W18** (confirmations §2): the Agents place's row menu says "Reveal in Finder" on Windows too; it says "Reveal in File Explorer" there, fixed with R24's change to the same rows.

## Workstream 1: The project file (R1)

- `src/projects/projectFile.ts` (new, no `vscode` import; an injected file system):
  - `readProject(folder)`: `{ name, mark, cover, line, problem? }`, from `.ritemark/project.json` when it is there and readable, otherwise the defaults (the folder's name; initials from it, as 018's `ritemarkProjectInitials` draws them; Ritemark's default cover).
  - `writeProject(folder, change)`: read, merge (unknown keys kept), write atomically (a temporary file, then rename, as `BoardStore` writes). It never writes over a file it could not read.
  - `setCover(folder, file)`: copies the picked image to `.ritemark/cover.<ext>`, removes an earlier `cover.*` that differs, and records it.
  - Schema: `{ "ritemark": "project/1", "name"?, "line"?, "cover"? }`. The PoC's `about` is read as `line` once.
- The default cover is `media/home/cover.jpg` (the PoC's 78 KB file), an image file, never inlined.
- Tests: `projectFile.test.ts` with a fake file system: defaults, a bad file kept, unknown keys kept, the cover's copy, a read-only folder.
- **The sample project** (Sprint 133's `extensions/ritemark/sample-project/`) gains its `.ritemark/project.json` with the line experience 2's frame 4 draws ("A sample project to try things on: a leadership programme, with documents to work on."), so a fresh copy's Home shows it. Its words are the Experience lead's, with the rest of the sample.

## Workstream 2: The project list and its first fill (R2)

- `src/projects/ProjectList.ts` (new): the list in `<globalStorage>/projects/v1/list.json`, one serialized writer, atomic writes, as the other global stores.
  - Each entry: the folder URI, when it was added, when it was last open, how it was found (`opened`, `recent`, `chats`, `board`), and `missing` with when it was last seen.
  - `opened(folder)` on every activation with a folder; `remove(folder)`; `relocate(old, new)` for Find it…; `entries()` ordered by last open.
  - A missing folder is checked on show (a `stat`), marked, and never removed by Ritemark.
- `src/projects/firstFill.ts` (new): runs once per profile (`ritemark.projects.filledV1`), per `research/first-fill-audit.md`; merges the sources, keeps local `file:` folders and network paths, skips `.code-workspace` entries and folders that no longer exist at the time (those that existed once but are gone now are not added: they are not known to be projects).
- The internal recent-folders command is used only by the first fill. Everything after it reads Ritemark's list. The VS Code update sprint checks that the command still exists (its `update-vscode.sh` checklist gains a line).
- Tests: `ProjectList.test.ts`, `firstFill.test.ts` with fake sources: order, duplicates, a missing folder kept, removal, relocation, the fill running once.
- **The welcome's lists** (Sprint 133's `src/welcome/recentProjects.ts`): the update sheet and the "Where do you want to start?" sheet read `ProjectList.entries()` in place of VS Code's recent folders. A project marked missing is left off the first three.

## Workstream 3: What waits (R3, R6)

- `src/projects/waiting.ts` (new), per `research/waiting-audit.md`:
  - **the open project**: the board's own snapshot (`snapshot.attention.count` and its `calls`) and the chat store's live conversations of this window's scope with `lifecycle.state: 'needs-user'`, plus its chats with an unread reply;
  - **another project**: its card files (`parseCardFile`) and its hand-off records (by `projectKey`), through `deriveWho`; and its chats from `index.json`: a `needs-user` with a live owner, or an unread reply, as the audit settles;
  - a chat that a card runs in counts only through the card's call.
- **The read marker** (Jarmo, 19 October: "Also unread answers"). The chat store has none today. Each conversation record and its `index.json` entry gain when the chat was last read (proposed `readAt`), beside when its newest reply finished. The AI's sheet marks a chat read when it is in front on a shown sheet, and at once when a reply finishes while it is so. A record without the marker counts as read, so the first start of this build shows no backlog. The field names and the rules are the waiting audit's; the store's decoder keeps both optional, so an older build reading the store is unaffected.
  - a project whose board cannot be read gives no count (`undefined`), never zero.
- Per [`research/waiting-audit.md`](research/waiting-audit.md):
  - the loop that turns cards into calls moves out of `BoardController.snapshot()` into one exported function, `callsOf(cards, handoffs)`, which the snapshot and `waiting.ts` both call;
  - another project's hand-off records are read by a decode-only reader, never `CardTaskStore.load()`, which renames a record it can't read;
  - **a window marker**, as `TurnOwners` does for chats: each window writes `<globalStorage>/projects/v1/windows/<pid>.json` with its folder at activation and removes it at dispose. A hand-off in an active state in a project no live window holds is read as `interrupted` (a failed call), as `recover()` would make it when that project opens;
  - an unreadable `index.json` gives no count anywhere, rather than counts without chats.
- Other projects are read when Home or the switcher is shown, with a short cache (30 s), never on a timer in the background. The audit measured 46 ms for 20 projects of 50 cards (30 ms warm).
- **The Tasks tab's count** (019, from the PoC): `multiEditorTabsControl.ts` reads the badge of `workbench.view.extension.ritemark-tasks` from `IActivityService` and draws it on the tab whose view type is `mainThreadWebview-ritemark.taskBoard`, up to "99+", with the tab's accessible name including it. The badge is the board's calls, so the tab and the place cannot disagree.
- Tests: `waiting.test.ts` with fixture boards (each call kind, archived, done, a hand-off that needs the person) and fixture chat indexes (live and stale `needs-user`; an unread reply, a read one, one from before this build, a card's chat). The store's tests cover the marker's round trip and an older record without it.

## Workstream 4: Home's tab (R4, R10, R11, R13)

- `src/views/HomePanel.ts` (new, from the PoC's shape): view type `ritemark.home` (the type 019 already keeps permanent), a webview panel in the shared bundle (`data-editor-type="home"`, nonce and CSP as `taskBoard/boardSurface.ts`), `retainContextWhenHidden`, a serializer and `onWebviewPanel:ritemark.home` so it restores after a restart. Local resource roots add the project's `.ritemark/` for the cover.
- **State** sent to the page as one typed message (`home/state`): the project (W1), what waits here (W3) with each item's kind and where it opens, the other projects' total, Start something, Last changed, What moved (when due), and problems (a project file that could not be read, a cover that could not be saved).
- **Redraws** on the board's changes (its subscription), on a chat's lifecycle change, on file changes in the project (a watcher on the document kinds, 1.5 s debounce), and when the tab is shown. The page keeps its scroll and focus across redraws.
- **Actions** (page → host): open Documents (`workbench.view.explorer`); edit the line; change the cover (a file picker for images); open a waiting item (`ritemark.openTaskBoard <cardId>` for a card, the chat for a question or approval); Start something (`ritemark.newDocument`, `ritemark.newTable`, the browser's new tab command, as the + runs them); open a recent document; Got it on What moved.
- **Last changed**: the newest documents of the kinds Ritemark opens, as the PoC finds them (excluding `node_modules`, `.git` and `.ritemark`, capped at 5,000 files), with their folder and when.
- **What moved** (R11): shown when `ritemark.updatedFrom1x` (written by Sprint 133's update welcome) is set and `ritemark.whatMovedSeen` is not; Got it writes the second.
- **The empty project** (R13): no documents → the empty state of experience 29, frame 1, with a drop target; dropped files are copied in through the host (`workspace.fs.copy`), never moved.
- **Page**: `webview/src/components/home/` (new): `HomePage`, `ProjectCover`, `WaitingList`, `StartSomething`, `LastChanged`, `WhatMovedCard`, from the UI components; all text rendered by React as text.
- **Landing** (R10): Sprint 133's landing (`src/welcome/landing.ts`) opens Home first (W5's `revealHome`), then the AI sheet as before.

## Workstream 5: Home and Tasks, always the first two tabs (R5)

- `src/views/permanentTabs.ts` (new, from the PoC): after the window restores its tabs (once the extension has activated and the groups are known), it opens whichever of Home and the board is missing in the first group, pins it (`workbench.action.pinEditor`), moves Home first, and returns to the tab the person was on. It runs again when one of them is closed by the extension or unpinned by an older code path. With the `task-board` flag off, only Home.
- **A fresh project window opens on Home**, and its left column on Home's place (the projects list).
- **The Home place** (`ritemark.placeClickedAgain` and the projects view becoming visible) brings Home's tab forward, as `taskBoardHost.ts` does for Tasks. `ritemark.openHome` is the one command for it.
- **The board** opens through the permanent tabs, not a separate `TaskBoardPanel.show`, so there is only ever one pinned board tab.
- Patch 019's rule (Sprint 132 R9) already keeps both pinned tabs first and permanent; Close all leaves them.
- Tests: `permanentTabs.test.ts` for the restore order (both missing, one missing, the person's tab returned to), and S-level CDP checks.

## Workstream 6: The projects list in Home's place (R7, R14)

- `src/views/ProjectsViewProvider.ts` (new): a webview view in the `ritemark.homeView` slot, in the shared bundle (`data-editor-type="projects"`), replacing `HomeViewProvider`.
- **Rows**: from `ProjectList` (W2) with each project's mark and name (W1) and its waiting count (W3); the open one first, as the column's white row; one whose folder is not found keeps its place, muted, with a warning-circle and Not found and the old path in its tooltip (experience 33, frame 1); clicking it shows its Home's not-found box (W10) instead of switching.
- **Search all projects** filters by name in the page.
- **Add a project…** offers Open a folder… and Start a new project (Sprint 133's `src/welcome/newProject.ts`).
- **A click** switches in place (W8); **⌥ click** (Alt on Windows) opens a new window (`vscode.openFolder(uri, { forceNewWindow: true })`).
- **1.x's launcher**: its functions are on Home's tab (W4) and beside it (spec R14's table). `HomeViewProvider.ts` and its test are deleted once that table is checked (S-level), and the `home-launcher` flag is set to `disabled` with a tombstone description, as `CLAUDE.md`'s flag rule asks.

## Workstream 7: The head's menu, filled (R8)

- `ritemark/projectHead` (`package.json`, `projectHeadCommands.ts`): Switch project ▸, Open a folder…, Reveal in Finder / File Explorer, About this project (Jarmo, 18 October). New folder and Collapse folders stay where Sprint 132 put them, after these. Open a folder… goes through W8's switch, so it asks first too.
- **Switch project ▸** is a submenu whose items come from the extension at the moment it opens: 018's `ritemarkMenu.ts` asks a command (`ritemark.projects.switcherItems`) for `{ id, label, mark, detail, checked }[]` and draws them, then All projects, on Home and Open in a new window. A static `package.json` menu cannot list projects, so this is the one shell change the head needs (per `research/confirmations.md`).
- **About this project** (`src/projects/aboutFile.ts`, new, no `vscode` import in its rules, an injected file system): the file is `AGENTS.md` at the project's root.
  - When it is there, the item opens it in the Ritemark editor.
  - When it is not, the item asks first, in experience 31's dialog style, with Create and Cancel. Create writes `AGENTS.md` headed "About this project" and, when the folder has no `CLAUDE.md`, a `CLAUDE.md` holding only `@AGENTS.md`; each atomically (a temporary file, then rename), never over a file that is there. Then it opens `AGENTS.md`.
  - An `AGENTS.md` or `CLAUDE.md` already in the folder is never written over. A folder that cannot be written says so, as R1 does.
  - **The note.** When the folder's own `CLAUDE.md` has no line `@AGENTS.md`, the Ritemark editor shows the note at the top of About this project, with Add the line and Not now (spec R8). Add the line rereads `CLAUDE.md`, writes `@AGENTS.md` and a newline in front of its bytes (a temporary file, then rename), and drops the note; if the file changed since the note was drawn, it rereads before writing. Not now writes nothing and shows nothing elsewhere.
  - **Pointer-only.** A `CLAUDE.md` whose whole content is `@AGENTS.md`, compared with surrounding whitespace and line endings ignored, is Ritemark's pointer and is hidden in Documents; Create and the sample project both write exactly that. A `CLAUDE.md` with anything more, even one more line, stays visible as the person's own file (Experience lead, 18 October).
  - **How each place draws the name** ([`research/about-file-audit.md`](research/about-file-audit.md)):
    - the tab, the folded list, Quick Open and the window title: a `configurationDefaults` value, `workbench.editor.customLabels.patterns: { "*/AGENTS.md": "About this project" }` (VS Code's own custom labels match from the root folder's parent, so only the root's file). If a fresh profile's first start shows `AGENTS.md` first (live check L2), the default moves to `branding/product.json` (013);
    - Documents' row and both tooltips: one fixed-rule case in 018's `labels.ts`, on Sprint 133's `splitExtension` opt-in, so the row is right on the first frame without waiting for the extension;
    - the pointer: a case in 018's `FilesFilter` (`explorerViewer.ts`) that reads the root `CLAUDE.md` itself (at most 1 KB), as it reads `.gitignore`, and hides it while its trimmed text is `@AGENTS.md` and the root has an `AGENTS.md`;
    - the icon: `"agents.md"` in the file icon theme's `fileNames` (the book-open icon README uses), and `book` (Phosphor `\e0e6`) in the product icon theme for the menu;
    - Home's Last changed and the AI sheet's Active chip and Context line name it themselves.
  - Tests: `aboutFile.test.ts`: open, create both files, an existing `CLAUDE.md` left byte for byte, the note's condition, Add the line (first line, every other byte kept), Not now writing nothing, pointer-only recognised (with surrounding whitespace and CRLF) and a `CLAUDE.md` with one more line not, an existing `AGENTS.md` opened, a read-only folder.
- **The File menu** (experiences/windows frame 2): 018 maps a `ritemark/fileMenu` contribution to the File menu (`MenuId.MenubarFileMenu`), as it did for `ritemark/projectHead`. The extension contributes three items there, in the drawing's order:
  - New tab, which runs the +'s menu (019's new-tab command), bound to ⌘T and Ctrl+T in `package.json`, above VS Code's own binding;
  - Switch project;
  - Share, which asks the document in front to open its Share menu (a message to its webview), and is greyed out by a `when` clause when no Ritemark document is in front.
  On the Mac they show in the native File menu too.

## Workstream 8: Switching in place (R9)

- `src/projects/switchProject.ts` (new): the one path every Ritemark switch takes (Home's list, the head's switcher and Open a folder…, File ▸ Switch project, Go back).
  - It asks the AI sheet's host whether a chat in this window is working (per `research/switch-audit.md`). If so, it asks in a modal dialog drawn in experience 31's style (VS Code's custom dialog, which Sprint 132 themes), 440 wide: "Claude is still working in <project>" / "Switching projects stops it. Open <other> in a new window to let Claude finish.", with Cancel, Switch and stop, and Open in a new window as the default (experience 33, frame 3). Open in a new window opens the other project there; Switch and stop stops the chat as Stop would, then switches; Cancel does nothing. With nothing working it never asks.
  - It then opens the next folder in the same window (`vscode.openFolder(uri, { forceNewWindow: false })`).
  - VS Code keeps each folder's tabs in its own workspace state, so coming back restores them; the permanent tabs (W5) add Home and Tasks where missing and the window opens on Home.
- **The "Switched to…" note** (experience 3, frame 3; kept in experience 33): the switch writes `ritemark.projects.switchedFrom` with the folder and the time; the next window's Home shows "Switched to <project>. <other> is kept as you left it." with Go back, once, and the key is deleted. Go back goes through the same switch.
- **What is working** ([`research/switch-audit.md`](research/switch-audit.md)): `UnifiedViewProvider.workingChats()`, the chats with an entry in `_activeConversationTurnIds` whose record is `working` or `needs-user`, with each one's runtime for the dialog's title. **Switch and stop** cancels each as `agent-cancel` does (the cancel intent, then the session), waits up to 3 s for the turns to end, then switches.
- **The head's Open a folder…** picks the folder itself (`showOpenDialog`, folders only) and then goes through the switch, since `vscode.openFolder` with no URI opens in the main process.
- **VS Code's own routes** (decided in the audit): a small 018 contribution vetoes a `LOAD` shutdown with the answer of the hidden command `_ritemark.projects.beforeReload`, passing the target folder when the window knows it (a stash in the host service's `openWindow`: Open Recent). The guard answers at once when nothing works or when Ritemark started the reload after asking. Without a target (Open Folder…, a drop, the CLI, Close Folder) its dialog has Cancel and Switch and stop, Cancel the default. No answer in 10 s, or no such command: the reload goes on. `RELOAD` and `QUIT` never ask.
- **The splash** (per `research/splash-audit.md`): the window shows the ground's colour while it reloads, in Light and Dark. Expected: 018's hunk in `partsSplash.ts` saves the theme's `ritemark.ground` as the splash background when the theme defines it, and 001's dark default becomes the dark ground (`#16132F`) instead of `#1E1B4B`.
- **⌥ click and Open in a new window** never switch this window.

## Workstream 9: The document's bar (R12)

- `DocumentHeader.tsx`, as `comparison/after-write.png` draws the bar: **Saved** shows when `document:sync-state` is `synced`. `local-only` and `applying` show nothing. `conflict`, `apply-error` and `failed` keep today's actions in Saved's place.
- `ExportMenu.tsx` becomes Share, as experience 26's frame 1 draws it: Send a copy (PDF, for reading and printing; Word document, for people who edit in Word), Google Docs (Publish to Google Docs, one Google Doc you update from here), Copy as Markdown (for email and chat), and the foot line. Each item keeps today's handler. Once a document is linked, the Google Docs group lists today's actions for its state (`googleDocsMenu.ts`: Sync, Open, Remove link, Reconnect), reworded for 2.0. The chip and card of frame 2 are not in this sprint.
- Tests: the header's state from each sync state; every 1.x Export action is reachable from Share in each Google Docs state.

## Workstream 10: Missing, empty and boardless projects (R13)

- A folder that is not found (experience 33): the list (W6) and the switcher (W7) mark it; choosing it keeps the window in the current project and shows, on the desk's Home, the project's head with a muted 56 mark and one box (radius 10, the strong hairline): "This project's folder is not where it was", the old path in a chip, Find it… (primary) and Remove from the list (ghost). Find it… opens the folder picker at the old path's nearest existing parent; the chosen folder replaces the old path (`ProjectList.relocate`) and the project opens there through W8's switch; a folder that is already another project's is refused in words and the list is kept.
- An empty project: Home's empty state (W4).
- No board: Tasks shows the board's empty state, "Nothing waits for you" with New task (experience 29, frame 2), and the tab has no count; `BoardStore` writes nothing until a card is added (it already creates `.ritemark/tasks/` only on the first card, to be confirmed in `research/confirmations.md`).
- **A folder that has gone stays gone:** `FlowStorage` creates `.ritemark/flows` only when the project's folder itself exists (a `stat` first, then `mkdir` of `.ritemark/flows` alone). Any other recursive `mkdir` under a project that `research/confirmations.md` finds gets the same rule. A test deletes the folder and checks that nothing comes back.

## Workstream 12: The project's head on Tasks, Browser and Transcribe (R16, R17, R18)

- **018's head on three more places.** `HEAD_PLACES` gains `workbench.view.extension.ritemark-tasks`, `…ritemark-browser` and `…ritemark-transcribe`. Today each entry has a New menu and a Search command. It becomes a list of up to two rows, each a command or a menu from the extension, with its words and icon from the command's contribution, plus an optional label over the content:
  - Documents: New (menu), Search; label Documents (as today);
  - Agents: New (menu), Search (as today);
  - Tasks: New task (`ritemark.tasks.newTask`), Search (`ritemark.tasks.search`); no label;
  - Transcribe: Record (`ritemark.transcribe.record`), Transcribe a file… (`ritemark.transcribe.addFile`); no label (the page draws its own group labels);
  - Browser: no rows, no label (the page draws Recent).
  With no folder, the head stays off, as today. The command names are proposals; the confirmations settle them.
- **The title rows' actions.** Under the head, a view's title-row actions are not shown, as on Documents. So Browser's two actions move into its page (below), and Transcribe's settings button moves into its page as the Experience lead answered on 19 October: a gear icon button with the tooltip "Transcribe settings", at the right of the Recordings label, as Browser's + and Clear sit at the right of Recent. It posts `ritemark.transcribe.openSettings`. Each stays in the palette.
- **Tasks** (`TasksPanel.tsx`, R17): New task shows the add field and focuses it; Search filters by title in the page (the host sends the command to the view). The list's order becomes Ideas (folded), To do, Doing, Done (folded, with Archived inside); a card with a call is marked and sorted first in its stage. The calls come from the board's snapshot as today, so the count does not change. A unit test covers the order, the filter, a call outside Doing and an archived card inside Done.
- **Transcribe** (`TranscribePanel.tsx`): the Add recording and Record row is replaced by the head's two rows, which run the same handlers; "Library" reads "Recordings" (and "All projects" stays as the switch's other state); the settings gear sits at the right of the Recordings label, in the tokens Browser's Recent label uses.
- **Browser** (`BrowserPanelProvider.ts`, R18): the page draws the Recent label in the column's 11-caps style (the tokens 018's `.ritemark-project-group` uses), with the + and Clear history as icon buttons at its right, each with a tooltip; they post the two existing commands. The empty text becomes "No pages yet". `view/title`'s two entries are removed from `package.json` once the page has them, and both commands stay in the palette.

## Workstream 13: The PDF and Word bars (R19)

- `PDFViewer.tsx` and `DOCXViewer.tsx`: the label "Save as Markdown" becomes "Make an editable copy", with the same handler and the same flag (`save-as-markdown-from-preview`). The flag's label in `flags.ts` follows.
- `ViewerToolbar.tsx`: a Share button at the end of the bar, as the document's bar has. It holds two items, as the Experience lead answered on 19 October:
  - **Show in Finder** (Show in File Explorer on Windows): the host runs `revealFileInOS` on the file;
  - **Open in Preview** on a PDF, or **Open in Word** on a Word file. Open in Word runs the Word bar's own `openInExternalApp` message (`officePreview/officePreviewProvider.ts:166`) and takes the label the host already sends (`openStatus`'s `openLabel`). Open in Preview opens the PDF with `utils/openExternal.ts`: Preview on the Mac, and the default app (`openWithDefaultApp`) on Windows, where the item's words come from `research/confirmations.md`.
- The PDF's provider (`pdfEditorProvider.ts`) gains the two messages; the Word preview's provider gains Show in Finder.
- Make an editable copy stays where it is drawn: on the PDF's bar beside Share, and in the Word bar's Open in Word menu, as today. Share holds no Export and no Google Docs on these files. Nothing on today's bar is removed.
- Tests: the bar's labels and the Share menu's two items for each viewer, with each item's message to the host.

## Workstream 14: The browser's share question, on the AI's sheet (R20)

- **When it asks stays.** `ensureSharedForActiveTab` keeps its rule: the first time a page becomes the AI's context in a session, once per page, never once "share without asking" is stored. Only the dialog goes.
- **009's bridge takes the answer** (per [`research/share-question-audit.md`](research/share-question-audit.md)). `workbench.action.browser.ensureActiveBrowserShared` gains an optional argument, `{ pageId, answer?: 'share' | 'notNow', withoutAsking?: boolean }`; an answer for a tab no longer in front shares nothing and returns `stale: true`:
  - with no answer, it shares at once when `browserView.shareWithAgent.dontAskAgain` is stored, as today; otherwise it returns `needsAnswer: true` and opens nothing;
  - with `share`, it shares the page as Allow does, and stores the key when `withoutAsking` is set, as the dialog's box does;
  - with `notNow`, it shares nothing.
  The model gains a Ritemark method, `shareWithAgentAnswered(withoutAsking)`, beside upstream's `setSharedWithAgent`: what Allow does, without the dialog. The network policy's check and its notice stay as upstream has them. The tab is marked as asked for the session only once answered, so a question withdrawn unanswered is asked again when its tab comes back in front. Annotation mode, control and upstream's own toggle keep upstream's dialog: each answers a click of the person's own.
- **The host** (`BrowserContextStore`, `UnifiedViewProvider`): on `needsAnswer`, it posts `browser:share-question` to the sheet with the page's id and title and the AI's name. The sheet answers with `browser:share-answer`, and the host calls the bridge with it. A question about a page that is no longer in front is withdrawn (`browser:share-question-clear`), and the page stays unshared. The messages are typed in `agentSidebarProtocol.ts`.
- **The sheet** (`webview/src/components/ai-sidebar/ShareQuestionCard.tsx`, new): the card above the message box, as experience 28's frame 1 draws it, from the UI components (`Button`, the checkbox, a tooltip on each button). The page's chip shows beside it as today.
- **The consent boundary stays:** `buildTurnContext` sends nothing about a page that is not shared, so a message sent while the question waits goes without it.
- The control question (010's `ensureControlConsent`) is not changed.
- Tests: `BrowserContextStore.test.ts` (new) for when it asks, Share, Not now, the box, a withdrawn question and nothing sent before Share; a webview test for the card's states; a CDP check that the tab row works while the question waits.

## Workstream 15: The command palette without VS Code's developer commands (R21)

- **Patch 003** gains a short list of command IDs, and ID prefixes for whole families, that All commands does not offer. `commandsQuickAccess.ts` skips them in `getGlobalCommandPicks` and in the editor's command picks, so search and the recently used list never show them.
- The commands stay registered. Their menus, shortcuts and callers are untouched.
- **The list of IDs to drop** is written here by `research/palette-audit.md`, before the hunk is made:

  | ID or prefix | Title in All commands | Why it goes |
  |---|---|---|
  | `workbench.debug.viewlet.action.addDataBreakpointOnAddress` | Add Data Breakpoint at Address | Debugging (#456) |
  | `workbench.debug.viewlet.action.addFunctionBreakpointAction` | Add Function Breakpoint | Debugging (#456) |
  | *the rest: [`research/palette-audit.md`](research/palette-audit.md) §7, the authoritative list (5 prefixes, 86 IDs)* | | |

  The hunk is one filter on the array `getCommandPicks` returns (`commandsQuickAccess.ts:128–131`), which search, similar commands, recently used and the AI's related picks all read, after patch 015's tested pure-function pattern. Sprint 135's VS Code update runs the audit's search again, since new versions add developer commands.

- Kept by rule (spec R21): Ritemark's commands, the commands a Ritemark menu, doc, skill or QA step names, and those the parity list reaches only through All commands.
- Tests: a VS Code unit test that a listed ID and a prefixed ID are not offered and a kept one is; S58 by hand.

## Workstream 16: ChatGPT, never Codex (R22)

- **The audit first** (`research/codex-strings-audit.md`): no word changes before its list is written.
- **Then the copy pass**, file by file from the list: "Codex" becomes "ChatGPT" where it names the AI. Sentences that read oddly after the swap are rewritten in plain words, one point each.
- Nothing else changes: setting keys (`ritemark.codex.*`), command IDs, file and folder names, log lines, code identifiers, a model's own name and text the runtime writes itself.
- `package.json`'s "Codex" section title and descriptions change too, because Advanced settings (W17) shows them.
- Tests whose expected words name Codex change with the words. QA runs the audit's search again (S59).

## Workstream 17: Advanced settings (R23)

- `RitemarkSettings.tsx`: one link at the foot of the page, "Advanced settings", with its tooltip (`ui/tooltip.tsx`). It posts `settings:open-advanced`.
- `RitemarkSettingsProvider.ts` runs `workbench.action.openSettings` for it.
- Nothing on the page moves or goes; the pre-commit validator's Settings page check passes.
- Tests: a webview test that the link is there and posts its message.

## Workstream 18: An agent's colour on its row (R24)

- `agent/discovery.ts`: each agent carries the colour from its file (`color:`) only when the file sets one, apart from the colour `resolveIconAndColor` guesses from the name. The decision names the chosen colour, so a guessed one is not drawn.
- `AgentLibraryViewProvider.ts`: the row's icon (`.row-icon`) takes the agent's colour when it has one, through eight theme colours, one per name the Color field offers (`agentSchema.ts` `COLOR_OPTIONS`: red, blue, green, yellow, purple, orange, pink, cyan; the plan first named another list, corrected at implementation). A file with a name outside the list keeps the muted icon. An agent with none keeps the muted icon.
- The eight colours are `ritemark.*` colours in `package.json`, with a Light and a Dark value, each at 3:1 or more against the column. `themeContrast.test.ts`, which reads those colours, checks them.
- A change in the agent's settings already rewrites its file, and the place already redraws on file changes, so the row follows without a reload.
- Nothing else on the place changes: the count line, the empty state, Sort and the tooltips stay as Sprint 132 left them (Jarmo, 19 October).
- Tests: a unit test for the row data (a chosen colour passed, a guessed one not), and the contrast test.

## Workstream 11: Tests, docs and builds (E3–E7)

- **Extension unit tests** (added to `package.json`'s `test` script): `projects/projectFile.test.ts`, `ProjectList.test.ts`, `firstFill.test.ts`, `waiting.test.ts`, `switchProject.test.ts` (the guard's decisions), `aboutFile.test.ts`, `protocol.test.ts`, `views/permanentTabs.test.ts`, `browser/BrowserContextStore.test.ts` (W14), the Agents place's row data (W18), and `themeContrast.test.ts` with the eight agent colours.
- **Webview tests**: Home's states (full, empty, missing cover, What moved), escaping (a project named `<img src=x onerror=…>` renders as text), the projects list's filter, the document bar's Saved, the Tasks list's order and filter, the viewers' bars, the share question's card (W14) and the Advanced settings link (W17).
- **VS Code unit tests**: the Tasks tab's count (019); the palette's filter (003, W15).
- **CDP checks** (`scripts/qa/`): Home and Tasks first after a fresh window, a restart and Close all; the count on the Tasks tab equal to the place's; switching both ways with tabs restored; the splash's colour during a switch; `frame-geometry.mjs` measures the head on Tasks, Browser and Transcribe as on Documents; the tab row works while the share question waits (W14).
- **Screenshots**: the baseline gains Home (full and empty), the projects list, the switcher and What moved, the Tasks, Browser and Transcribe places with their heads, the share question on the AI's sheet, the foot of Ritemark Settings and the Agents place with a coloured agent, light and dark.
- **Words**: the Codex audit's search run again at QA, with nothing found outside its list of what stays (W16).
- **Bundle**: `media/webview.js` before and after.
- **Docs**: `architecture.md` (a Projects section: the file, the list, what waits, Home, switching; Home's launcher replaced; the version-history row), `references/layout-invariants.md` (Home and Tasks opened by default; on Home the left column holds the projects; every other place has the project's head), the browser's section in `architecture.md` (the share question on the AI's sheet), `CLAUDE.md`'s patch descriptions for 003, 009, 018 and 019, `update-vscode.sh`'s checklist line for the recent-folders command and for the palette's filter.
- **Builds**: after the merge, a production build from a clean-room worktree at the merged commit, as a build check; patches apply on the pin, a second run is clean, the stacking check passes; the drift check into the release plan.

## Delivery plan: one merge

1. Before the merge: Mac QA (S1–S40, S43–S62), and an overlay round on Windows for the extension side (Home, the list, the head's menu, switching, the places' pages, Settings' foot, the copy pass).
2. The merge.
3. After it: the production build check, the Windows round from main for everything (including the Tasks tab's count, the splash, the File menu's three items, the heads on Tasks, Browser and Transcribe, the share question and the palette), and the drift check. Fixes from the Windows round go in a small follow-up PR.

## Proof-of-concept map

| PoC file | Comes over as |
|---|---|
| `views/HomePanel.ts` | W4, rebuilt in the shared bundle; reads chats too; the project file through W1 |
| `views/ProjectsViewProvider.ts` | W6, rebuilt in the shared bundle; the list from W2, counts from W3 |
| `views/permanentTabs.ts` | W5, with tests |
| `views/homeIcons.ts` | Not needed: the UI components' Phosphor icons |
| `media/home-cover.jpg`, `home-tab-*.svg` | W1 and W4, as image files |
| The patch's Tasks tab count (`multiEditorTabsControl.ts`) | W3, into 019 |
| `RITEMARK_PLACE_TABS` | Not at all: the extension's `placeClickedAgain` (W5) |
| `ritemark.poc.addSampleProjects`, the sample project | Not at all: the welcome's sample project is Sprint 133's own, with content written for it |

## Risks inside the sprint

| Risk | Retirement |
|---|---|
| Other projects' counts are slow with many projects | Read on show, cached 30 s; the audit measures 20 projects |
| A stale `needs-user` after a crash counts a chat that waits on nothing | Only chats with a live owner count (audit) |
| The first fill misses boards in folders known from nowhere else | The audit's extra source; otherwise they join when next opened, and the gap is said in the plan's QA evidence |
| The permanent tabs fight the person's restored tabs at start | Run after restore; return to the person's tab; CDP checks across restarts |
| Switching through VS Code's own Open Folder stops the AI without asking | The switch audit; at worst, today's behaviour, recorded. Every Ritemark route asks (experience 33) |
| The splash hunk breaks on a VS Code update | One small hunk in 018; the screenshot check in `update-vscode.sh`'s checklist |
| Removing 1.x's launcher loses a function | R14's table checked row by row before `HomeViewProvider.ts` is deleted |
| About this project's Create touches a `CLAUDE.md` the person wrote | Never written over; changed only by Add the line, which keeps every other byte; S44 |
| Showing `AGENTS.md` as About this project needs a shell hunk in Documents | The about-file audit; expected: one more case in 018's resource-label hunk, which the tree and the tabs share |
| The bundle grows | Images as files; measured before and after |
| Tasks' new order hides a call that sits outside Doing | A call is marked and first in whatever stage it is in; S49 and the list's unit test use a failed task in To do |
| Moving a title row's actions under the head loses one | Each moves into its page before `view/title` drops it, and stays in the palette; S46 |
| ⌘T or Ctrl+T clashes with a binding people use | The confirmations read what they run today; New tab's binding sits above VS Code's; the old command stays in the palette |
| Another recursive `mkdir` brings a gone folder back | The confirmations list every one under a project; S53 |
| A page is shared before the person answers, now that nothing blocks | The bridge shares only with an answer or the stored choice; `buildTurnContext` still sends nothing unshared; S57 and the store's test |
| The share question waits where nobody sees it (a hidden sheet) | The share-question audit checks when the host polls; until it is answered, nothing is shared |
| The palette's filter hides a command someone needs | The audit's keep rule (Ritemark's commands, those our menus, docs and QA name, the parity list's palette-only rows); the commands stay registered; S58 |
| The palette's filter breaks on a VS Code update | One small hunk in 003 with its unit test; `update-vscode.sh`'s checklist line |
| The copy pass renames a setting key or an identifier, and a person's setting is lost | The audit lists what stays before any word changes; keys and IDs are never touched; S59 checks settings made before |
| A "Codex" string is missed | The audit's search is run again at QA |
| An agent's colour is hard to see in Dark | Each colour has a Dark value, checked by `themeContrast.test.ts` |
