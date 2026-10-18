# Sprint 134 Technical Plan

The plan for [spec.md](spec.md). The release is [v2.0.0](../release-plan.md), step 3; the research behind it is the release's [feasibility read](../feasibility.md), the Experience lead's technical analysis ("The project at the centre", `ritemark-dev`: `product/design/experience/technical/README.md`), and the proof of concept (`/Users/jarmotuisk/Projects/ritemark-2.0-poc`, branch `poc/2.0-surfaces`, read only). Code shapes here are proposals: when the code needs something else, this file changes first. File references are to `main` at `d781a0e1` (Sprint 132 merge 1) unless marked PoC.

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
| Harness | CDP checks for the tabs and switching; Home in the screenshot baseline | `scripts/qa/` |

The release tier is **shell** (`patches/`). The `projects` subsystem is new at `src/<subsystem>/` level, so `architecture.md` gets its section (E6). The new webview ↔ host messages (Home's and the projects list's) are typed in `src/projects/protocol.ts`.

## Phase 1 audits

1. **`research/waiting-audit.md`** (R3, R6): computing another project's calls from its card files and its hand-off records (`projectKey(folder)`), mapped as `CardHandoffLedger.list()` maps them, through `deriveWho`; chats that need the person from `index.json` read as it is (never `list()` with no scope, which rewrites it), mapped to folders through the records' scopes, and kept only when a live owner holds them (a `needs-user` left by a crash is not a call); the cost with 20 projects of 50 cards each.
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

`research/confirmations.md` records the smaller checks: VS Code's `revealFileInOS` label on Windows, Ritemark's menu (018's `ritemarkMenu.ts`) taking a submenu, and how the AI sheet's new chat is opened from Home.

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

## Workstream 3: What waits (R3, R6)

- `src/projects/waiting.ts` (new), per `research/waiting-audit.md`:
  - **the open project**: the board's own snapshot (`snapshot.attention.count` and its `calls`) and the chat store's live conversations of this window's scope with `lifecycle.state: 'needs-user'`;
  - **another project**: its card files (`parseCardFile`) and its hand-off records (by `projectKey`), through `deriveWho`; and its chats from `index.json` with a live owner, as the audit settles;
  - a project whose board cannot be read gives no count (`undefined`), never zero.
- Other projects are read when Home or the switcher is shown, with a short cache (30 s), never on a timer in the background.
- **The Tasks tab's count** (019, from the PoC): `multiEditorTabsControl.ts` reads the badge of `workbench.view.extension.ritemark-tasks` from `IActivityService` and draws it on the tab whose view type is `mainThreadWebview-ritemark.taskBoard`, up to "99+", with the tab's accessible name including it. The badge is the board's calls, so the tab and the place cannot disagree.
- Tests: `waiting.test.ts` with fixture boards (each call kind, archived, done, a hand-off that needs the person) and fixture chat indexes (live and stale `needs-user`).

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
  - The name About this project is drawn where `research/about-file-audit.md` says; if Documents needs a hunk, it goes into 018's resource-label hunk from Sprint 133.
  - Tests: `aboutFile.test.ts`: open, create both files, an existing `CLAUDE.md` left byte for byte, the note's condition, Add the line (first line, every other byte kept), Not now writing nothing, pointer-only recognised (with surrounding whitespace and CRLF) and a `CLAUDE.md` with one more line not, an existing `AGENTS.md` opened, a read-only folder.
- **File ▸ Switch project** (experiences/windows frame 2): 018 maps a `ritemark/fileMenu` contribution to the File menu (`MenuId.MenubarFileMenu`), as it did for `ritemark/projectHead`; the extension contributes Switch project there. On the Mac it shows in the native File menu too.

## Workstream 8: Switching in place (R9)

- `src/projects/switchProject.ts` (new): the one path every Ritemark switch takes (Home's list, the head's switcher and Open a folder…, File ▸ Switch project, Go back).
  - It asks the AI sheet's host whether a chat in this window is working (per `research/switch-audit.md`). If so, it asks in a modal dialog drawn in experience 31's style (VS Code's custom dialog, which Sprint 132 themes), 440 wide: "Claude is still working in <project>" / "Switching projects stops it. Open <other> in a new window to let Claude finish.", with Cancel, Switch and stop, and Open in a new window as the default (experience 33, frame 3). Open in a new window opens the other project there; Switch and stop stops the chat as Stop would, then switches; Cancel does nothing. With nothing working it never asks.
  - It then opens the next folder in the same window (`vscode.openFolder(uri, { forceNewWindow: false })`).
  - VS Code keeps each folder's tabs in its own workspace state, so coming back restores them; the permanent tabs (W5) add Home and Tasks where missing and the window opens on Home.
- **The "Switched to…" note** (experience 3, frame 3; kept in experience 33): the switch writes `ritemark.projects.switchedFrom` with the folder and the time; the next window's Home shows "Switched to <project>. <other> is kept as you left it." with Go back, once, and the key is deleted. Go back goes through the same switch.
- **VS Code's own routes** (File ▸ Open Folder…, Open Recent): per the audit, either a small 018 veto asks the extension before a LOAD shutdown, or they are left as today and the audit records it.
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

## Workstream 11: Tests, docs and builds (E3–E7)

- **Extension unit tests** (added to `package.json`'s `test` script): `projects/projectFile.test.ts`, `ProjectList.test.ts`, `firstFill.test.ts`, `waiting.test.ts`, `switchProject.test.ts` (the guard's decisions), `aboutFile.test.ts`, `protocol.test.ts`, `views/permanentTabs.test.ts`.
- **Webview tests**: Home's states (full, empty, missing cover, What moved), escaping (a project named `<img src=x onerror=…>` renders as text), the projects list's filter, the document bar's Saved.
- **VS Code unit test**: the Tasks tab's count (019).
- **CDP checks** (`scripts/qa/`): Home and Tasks first after a fresh window, a restart and Close all; the count on the Tasks tab equal to the place's; switching both ways with tabs restored; the splash's colour during a switch.
- **Screenshots**: the baseline gains Home (full and empty), the projects list, the switcher and What moved, light and dark.
- **Bundle**: `media/webview.js` before and after.
- **Docs**: `architecture.md` (a Projects section: the file, the list, what waits, Home, switching; Home's launcher replaced; the version-history row), `references/layout-invariants.md` (Home and Tasks opened by default; on Home the left column holds the projects), `CLAUDE.md`'s patch descriptions for 018 and 019, `update-vscode.sh`'s checklist line for the recent-folders command.
- **Builds**: after the merge, a production build from a clean-room worktree at the merged commit, as a build check; patches apply on the pin, a second run is clean, the stacking check passes; the drift check into the release plan.

## Delivery plan: one merge

1. Before the merge: Mac QA (S1–S40, S43, S44), and an overlay round on Windows for the extension side (Home, the list, the head's menu, switching).
2. The merge.
3. After it: the production build check, the Windows round from main for everything (including the Tasks tab's count, the splash and File ▸ Switch project), and the drift check. Fixes from the Windows round go in a small follow-up PR.

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
