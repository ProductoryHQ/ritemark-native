# Sprint 135: QA evidence

VS Code 1.117.0 → 1.142.0 (Electron 39.8.7 → 43.7.7, Node 22.22.1 → 24.18.0), on the Mac, in dev builds launched in the background (`open -n -g`, a short `--user-data-dir` of their own, a CDP port of their own, `--use-mock-keychain`), so no window came in front of Jarmo's work. The test project is the frame baseline's sample, "Harbour leadership programme", with a Files folder of a Word, PDF, PowerPoint, Excel and draw.io fixture from the repo's corpora. Window 1440 × 900.

Most of Sprint 132's checks ran twice, side by side: on the 1.142 dev build and on a 1.117 build of main (the rollback rehearsal's tree, S20), each on a fresh profile with the same project and the same script. A difference between the two is either the update or a finding; agreement means the update changed nothing there. The Mac restarted during the QA and emptied `/tmp`, the 1.117 tree with it; the checks after that (most of Sprints 133 and 134's) ran on 1.142 against the frame baseline and those sprints' own evidence. Images are in [`qa/`](qa/); the screenshot comparison is [`qa/screenshot-diff.md`](qa/screenshot-diff.md).

Status: **Pass**, **Partial** (what was not run is named), **Not run** (with the reason), **After the merge** (Phase 10, D4).

## Found and fixed

Each was found by comparing the two builds, and each fix was checked on 1.142 afterwards.

- **PDFs stayed on "Loading PDF…"** (`Failed to fetch dynamically imported module … pdf.worker.min.mjs`). 1.142's webview service worker dropped the route for requests made by a page's own workers, and pdf.js always loads its worker through one. The host now sends the worker script's text and the page starts pdf.js's worker from it (`pdfWorker.ts`, `GlobalWorkerOptions.workerPort`). Report.pdf draws (Page 1 of 5); Make an editable copy writes Report.md with the PDF's text. `da34c760`.
- **A Markdown document showed "The editor could not be opened"** after a v1.14.0 profile's update welcome landed on its project (`TypeError: … reading 'selection'`). 1.142's custom-editor navigation read `options.selection` when an editor was opened with no options, which `workbench.action.openEditorAtIndex` (the welcome's landing, the permanent tabs, Home, Settings, the Task board) and Open Next Editor do. Caught with the debugger; upstream main has since fixed it in `webviewEditor.ts`, and patch 007 takes that fix. The same profile now lands with Brief.md open, as on 1.117. `92fe4de4`.
- **All commands offered "Ask in Chat: …"**, opening VS Code's own Chat view. `workbench.commandPalette.showAskInChat` pinned off; the row is gone. `e3262c56`.
- **Two Developer commands under IDs the audit had wrong** stayed in All commands ("Export Agent Host Debug Logs…", "Open Agent Host State File"). Patch 003 drops them under their real IDs; the Developer rows left in a dev build are the built-in Copilot's (stripped from every build) and development-only ones. `b7f8c90f`.
- **The browser bar, as the Experience lead decided (D5):** 1.142's Add Element to Chat is left off the bar, and Developer tools moved into its ⋯ menu (patch 010). Not a defect: the screenshot comparison's one difference, reviewed. `7337f5bc`.
- **Harness scripts** needed 1.142's slower first palette and a fresh window's first shortcut: `welcome-screenshots.mjs` waits for its row and hands the keyboard to the palette before typing (`8e627902`, `8812c3e7`); `validate-chrome-fast.sh` runs 1.142's `typecheck-client` (`9e58c95e`); `frame-screenshots.mjs` and `project-check.mjs` were fixed earlier in the sprint.

## Sprint 135's scenarios

| Scenario | Status | Evidence and notes |
|---|---|---|
| S1 The target | Pass | 1.142.0 (`d956e8a6`) from GitHub's releases list on 19 October, frozen in [`notes/freeze.md`](notes/freeze.md) with its Node, Electron and server Node. |
| S2 A recovery release | Did not arise | No 1.142.x came out during the sprint. |
| S3 A new minor | Did not arise yet | 1.143.0 was expected on 21 October; noted in `freeze.md` for after 2.0 (D2). |
| S4 A change hidden in a hunk | Pass | Every patch's `+`/`-` lines compared with main's, file by file; each difference explained in [`notes/rebase.md`](notes/rebase.md); file counts before and after per patch. |
| S5 From pristine, and again | Pass | `apply-patches.sh` from a pristine 1.142.0: 18 applied; a second run applies nothing and exits 0; the dry run: 18 can apply, 0 conflicts (also after every later patch change). |
| S6 A cascade | Pass, as it stands now | 016 applies unchanged on 1.142.0; 017 was retired by Sprint 133. |
| S7 A wrong Node | Pass for VS Code's preinstall | `vscode/build/npm/preinstall.ts` under Node 22.22.1 stops: "Please use Node.js v24.18.0 or newer with the same major version (24)". `validate-build-env.sh` switches to the `.nvmrc` version through nvm before it checks, so with Node 24.18.0 installed it passes from a Node 22 shell (by design). Its arm64 check was not exercised: there is no x64 Node 24 on this Mac. |
| S8 A fresh clone, from the docs | Partial | The sprint's own `vscode/` was set up by `SKILL.md`'s steps (a copy-on-write clone, Node 24.18.0 arm64, `npm ci`, `apply-patches.sh`, `npm run electron` after the patches, compile) and dev mode starts. The About box was not opened; `vscode/package.json` says 1.142.0 and `.build/electron/version` 43.7.7. A clone from scratch was not made (disk). |
| S9 An x64 module | Pass | `check-native-modules.sh` names a planted x86_64 `.node` file with its `file` output and the fix; its list comes from the `.node` files present. |
| S10 The native features | Partial | Dev: the terminal runs commands (S28–S30 below); an edit made outside Ritemark shows in the editor (S28); no `ERR_DLOPEN_FAILED` or `NODE_MODULE_VERSION` in any dev log of the sprint. Not run: switching the keyboard layout (it would change Jarmo's input source). The production build is After the merge. |
| S11 Windows CI | After the merge | D4: the Development manager dispatches it on the merged commit. |
| S12 The frame on Windows | After the merge | |
| S13 No difference | Pass for 32 of 34 scenes | [`qa/screenshot-diff.md`](qa/screenshot-diff.md). Re-run after main was merged in and the bar changed, on a fresh profile with the shared recent folders cleared: 32 of 34 again; the share question's scenes differ by 0.7% and 0.94% (the decided bar, one button fewer than 1.117's), home by 0.13% (two "today" rows in another order, from the fresh copy's file times). Two earlier attempts carried a stray Settings tab (a missed ⌘W in the script, fixed) and a shared-recents project in the switcher; `qa/screenshot-diff.md` says how. |
| S14 A difference upstream forced | Reviewed and approved by the Experience lead; the baseline waits for Jarmo | The share question's browser bar. The Experience lead decided (D5): Add Element to Chat stays off the bar, Developer tools goes into ⋯; both are in patch 010, checked on 1.142 ([image](qa/browser-bar-more-menu-1142.png)), and the Experience lead approved the result (the ⋯ menu's title-case words are VS Code's, left for a later copy pass). The baseline's share-question scenes change only with Jarmo's approval. |
| S15 A difference from a default | Pass | Six settings pinned in `configurationDefaults`; the table is in `qa/screenshot-diff.md`. |
| S16 The frame's numbers | Pass | `frame-geometry.mjs`, all four scenes, 0 FAIL ([`qa/frame-geometry-*.json`](qa/)); the numbers match Sprint 132 merge 2's, with Sprint 134's permanent tabs. |
| S17 Sprint 132's scenarios | Mostly pass | Table below. |
| S18 Steps 2 and 3's scenarios | Partial | Tables below. |
| S19 A class upstream renamed | Pass | The selector audit found the empty desk's watermark in a new wrapper; `ritemarkSurfaces.css` follows it ([`notes/rebase.md`](notes/rebase.md), 018). |
| S20 The rehearsal | Pass, with one gap found later | A scratch branch (never pushed) in `/tmp/s135-rb` followed the rollback recipe: Node 22.22.1, 1.117.0 checked out by `git submodule update vscode`, `npm ci`, 18 patches applied, the native-module check, compile, Electron 39.8.7, dev mode starts. The recipe's order was fixed on the way (reset and clean before `git submodule update`). Found later by the qa-validator review: the vscode gitlink move had not been committed (`254f3684` commits it), so the rehearsal's squash commit did not contain it; with it, the revert returns the gitlink to main's `10c8e557`, the commit the rehearsal checked out. The Mac's restart removed `/tmp/s135-rb`; its stale registration was pruned and the scratch branch deleted. |
| S21 Rolling back on main | After the merge, only if needed | |
| S22 The inventory | Partial | Walked side by side on both builds: the places row and More, the +, the head's menus and New, You, the tabs and folded tabs, terminals, the Task board, a Markdown document (typing, saving, an outside edit), CSV, Word, PowerPoint, Excel, PDF and Make an editable copy, draw.io, a new flow, Settings, the palette, Quick Open, the notification centre, Copilot Chat, high contrast, zoom. Then, on 1.142: export to PDF and to Word from the document's Share menu (the save dialog in the window; Proposal.pdf 1,573 bytes, Proposal.docx 7,539 bytes), and the JSON and CSS language servers (a broken file of each gets its problem marks). Not walked: the AI's chat, Transcribe's recording and dictation (they need a signed-in turn or the microphone). |
| S23 Profiles from before the update | Pass, after a fix | A profile used on the 1.117 build (Ritemark Dark chosen, a place dragged, terminals, a zoom, a CSV in front) opens on 1.142 with all of it ([`qa/s23-main-profile-on-1142.png`](qa/s23-main-profile-on-1142.png)). A v1.14.0 profile from the installed app (Ritemark Dark, Search moved to the AI column, two documents) shows the update welcome ([image](qa/s23-v114-update-welcome-1142.png)); landing on its project failed to open Brief.md until the 007 fix ([after](qa/s23-v114-landed-1142-after-fix.png), [1.117](qa/s23-v114-landed-1117.png)). Search goes back to the left column (More), the theme stays. Chats were not part of either profile (no signed-in turn was sent). |
| S24 A new way into chat | Pass | The Agents window cannot open (003); its two commands and 23 new Developer commands are not in All commands; "Ask in Chat" pinned off; the browser bar's Add Element to Chat needs Copilot Chat (S14). Copilot Chat still opens only from More (and ⌃⌘I), as one tab, on both builds. More's "Chat Debug" is the built-in Copilot's own place, shown only in development builds (`!isProduction()`); it is in the approved 1.117 baseline too. |
| S25 A new built-in extension | Pass | `mermaid-markdown-features` and `theme-modern-icons` are stripped like `copilot` in `build-prod.sh`, `build-windows.yml` and `build-macos-x64.yml` (no new visible surface without Jarmo). |
| S26 The browser and the agent | Partial | The share question waits on the AI's sheet and the tab row works meanwhile (`project-check.mjs --share-question`); Not now, sharing without asking and the question following the page in front (Sprint 134's S56, S57); Browser Recent lists and clears pages (S50); the bridge's commands and payloads are unchanged (browser-bridge audit). Not run: a page's context reaching the AI and the AI clicking and filling, which need a signed-in turn. |
| S27 The three runtimes | Not run | Each needs an authenticated turn; for Jarmo's Gate 2, and darwin-x64 and Windows after the merge. |
| S28 Saving and the smaller patches | Pass | Both builds: typing then ⌘S saves the text to disk and the bar says Saved (014); an outside edit shows in the editor; the Help menu is Getting started, Support, View License, Advanced ▸ Toggle Developer Tools (015, read from the menu data the workbench sends to the Mac's menu bar). ⌘P from inside a document opens Quick Open. |
| S29 Windows file handles | After the merge | |
| S30 The clean-room build | Pass | The third run, at `d60b9652`, passes every check (see "E5 after the merge" below). The first run found a stop in gulp (#476); the second, a blank terminal and the agent host (#484). |

## S17: Sprint 132's scenarios on 1.142

| Scenario | Status | Notes |
|---|---|---|
| S1 A fresh start | Pass | No title row; the places row Home, Documents, Tasks, Browser, Agents, Transcribe, More; left 256, AI 400. |
| S2, S3 Desks and hidden columns | Pass | Geometry (S16) and the baseline's scenes. |
| S4 Moving the window, S6 a sheet dialog | Not run | As in Sprint 132: a real pointer, a native sheet over Jarmo's work. |
| S5 The traffic lights after a restart | Partial | Restarts keep the window's state (S13, S33); the lights are native and not in a CDP capture. |
| S12 Zoom | Pass | At zoom 1.2 the strip's controls keep their CSS place and size on both builds alike (You at 1404, 12, 28 wide). |
| S13 Zoom across a restart | Pass | Zoom 1.2 comes back after a clean quit, on both builds. |
| S14 Only the AI | Pass | One view in the AI column. |
| S15 A view moved to the AI column | Pass | View: Move View, Search → New Secondary Side Bar Entry: the AI column keeps only the AI, Search is in More, on both builds. |
| S16 The row | Pass | Geometry. |
| S17 What does not fit | Pass | More: Copilot Chat, Search, File changes, Extensions (and the dev-only Chat Debug, see S24). |
| S18 Tasks opens the board | Pass | From a document and when Tasks is already chosen; one board. |
| S19 Reordering | Pass | Transcribe dragged before Browser (CDP drag interception) stays there after a restart, on both builds. |
| S20, S21 Copilot Chat | Pass for S20 | More ▸ Copilot Chat opens one "Chat" tab, again brings it forward, ⌃⌘I the same, no panel, on both builds. S21 (not installed) is the production build's: After the merge. |
| S22 Readable tabs | Pass | Proposal.md 135, Kickoff notes.md 162.2, Budget.csv 128.6, identical on 1.117. |
| S23 Pointing at a tab | Pass | At rest only the chosen tab's × shows, 16 from its edge; pointed at, the other tab's × shows there and no width changes. |
| S24 A new tab | Pass | The +: Text, Table, Web page, Terminal; Text makes Untitled.md at the project's root. |
| S25, S26 Many tabs, folded tabs | Pass | 13 documents: "13 ⌄", no overflow; the menu lists them, a pick brings one back into the row, "Close these 13 tabs" closes them. The narrowest tab is 113 (Brief.md): Sprint 132's review removed the 120 floor. The baseline's many-tabs scene matches. |
| S27 Menus close outside | Pass | The +, the project menu, You and More each close on a press in the tree, on Escape and on a second press of their button. |
| S28–S30 Terminals | Pass | "Terminal", "Terminal 2"; the bar's name, Split, Clear, Close; Running and Stop; the working dot on a tab behind a document. |
| S31 Ritemark's own terminals | Not run | As in Sprint 132 (Claude Login would sign Jarmo out). |
| S32 No terminal at start | Pass | |
| S33 Terminals across a restart | Pass | Both terminals come back as tabs after a clean quit, no panel, on both builds. |
| S34 A pinned Task board | Pass | Close Editor leaves it; Unpin leaves it pinned; Move Editor into Next Group leaves one desk with the board in front. |
| S35 The head | Pass | Geometry. |
| S36 The project's menu and New | Pass | Switch project, Open a folder…, Reveal in Finder, About this project, New folder, Collapse folders; New: Text, Table, Flow, Other file…, Folder. |
| S37 You | Pass | Settings ⌘, and Help; by keyboard Enter opens, ↓ moves, Escape returns focus to You. |
| S38 Ritemark's menus | Pass for the window's menus | The Mac's own menu bar read from the workbench's menu data (S28). |
| S39 Every surface | Pass | Side by side with 1.117 ([`qa/screenshot-diff.md`](qa/screenshot-diff.md)). |
| S40 High contrast | Pass | Both themes, the parts and the open row outlined, identical frame on both builds. |
| S41 Dialogs | Pass | Closing a running terminal from its bar: Ritemark's dialog, 400 × 138 at 520, 361, "Close Terminal 2?"; the same position on 1.117. |
| S42, S43 Narrowing the window | Pass | 1500 → 900 → 1500 and the opened column at 1100–1250: identical widths on both builds (e.g. 1300: 256 / 708 / 336; 900: the desk alone). |
| S44 The inventory | Partial | See Sprint 135's S22. |
| S45 A lived-in profile | Pass | Sprint 135's S23. |
| S46 The terminal shortcut | Pass | ⌃` from a document opens a terminal tab, no panel. |

## S18: Steps 2 and 3's scenarios on 1.142

Sprint 133 (the welcome):

| Scenario | Status | Notes |
|---|---|---|
| S1 A fresh start with no folder | Pass | `welcome-check.mjs --expect alone`: 8 of 8. Steps 1 and 2 match the baseline at 0% in both themes. |
| S3 Dark | Pass | The welcome's dark scenes match the baseline. |
| S54 The default first window | Pass | A fresh profile's first window is 1440 × 900. |
| S38 A document on the first launch | Pass | `<folder> <folder>/note.md` on a fresh profile: one tab, note.md, in the Ritemark editor; no welcome. |
| S40 Every way in | Pass | Help: Welcome opens Ritemark's welcome ("Welcome to Ritemark"), never VS Code's Getting Started; All commands offers only Help: Welcome and Help: Getting started (the walkthrough pickers stay hidden); Help has Getting started beside Support; `workbench.startupEditor` is none. Help: Getting started opens ritemark.app in the system browser and was not run. |
| S41 The launch check's rows | Pass | Settings: "Git found on this computer."; no Node.js row (Ritemark's own Claude runs); the sign-in states; Usage data with Privacy Policy and Terms of Use. |
| S42 The tree and the tabs | Pass | The muted extensions in every baseline scene that matches. |
| S43 The inventory | Partial | As in Sprint 133: the sign-in, setup, repair and recovery cards need signed-out or broken runtimes. |
| S48 A finished profile's window with no folder | Pass | A profile that opened Sales proposal Q4 from the welcome's Open a folder…, then a window with no folder: "Where do you want to start?" with the recent projects, Open another folder… and Start a new project; no Your AI, no usage switch; alone on the ground. |
| S49 Every empty desk | Pass | A second desk emptied: Text, Table and Web page tiles; each opened its kind (Untitled.md, Untitled.csv, a Browser tab). Since Sprint 134's permanent tabs, a desk that empties closes (VS Code's `workbench.editor.closeEmptyGroups`), so the check turned that off in the test profile to see the tiles drawn. |

Sprint 134 (the project at the centre):

| Scenario | Status | Notes |
|---|---|---|
| S8, S12 The count | Pass | `project-check.mjs`: the Tasks tab's count is the place's. |
| S13 Home, full; S21 the Home place | Pass | The baseline's home scenes. |
| S18–S20 Home and Tasks first, restored, Close all | Pass | `project-check.mjs`: first after a fresh window, after a restart and after Close All Editors; Close all leaves only them. |
| S27 Switch project | Pass | The baseline's switcher scene. |
| S30 Switching and coming back | Pass | `project-check.mjs --switch-to`: in place and back, the tabs restored in order. |
| S45 Tasks, Browser and Transcribe | Pass | The baseline's scenes. |
| S55 The share question | Pass | `project-check.mjs --share-question`: asked on the AI's sheet; the tab row works while it waits. |
| S58 No developer commands | Pass | After the 003 fix (above). |
| S28 About this project | Pass; the AI's answers at Gate 2 | Harbour (no AGENTS.md): "Create About this project?" with Cancel and Create; Create wrote AGENTS.md ("# About this project") and CLAUDE.md of exactly `@AGENTS.md` and a newline, and opened it as "About this project"; Documents lists About this project and hides CLAUDE.md; a second time it opens without asking. |
| S29 File ▸ Switch project | Pass on the Mac | The File menu (menu data): New tab first, Switch project after Open Folder…, Share after Save. Its command chose Home with "Search all projects" focused. |
| S31 The AI is working | Not run | It needs a chat turn working. The shell's half, the switch guard handing the folder to the extension, is shown by S33. |
| S33 VS Code's own Open Folder and Open Recent | Pass with nothing working; with a chat working at Gate 2 | Open Folder… (the in-window dialog) and Open Recent switched in place without asking, and Home said "Switched to Harbour leadership programme. Sales proposal Q4 is kept as you left it." (the extension writes it only when the shell passes the folder about to open); Reload Window never asked. Opening a project for the first time lands without that line. |
| S44 A CLAUDE.md of the person's own | Pass; the AI's answer at Gate 2 | "Own notes" (a CRLF CLAUDE.md in prose): the dialog says "Your CLAUDE.md stays as it is."; AGENTS.md written; CLAUDE.md byte for byte unchanged (SHA-1) and listed as CLAUDE.md; the note "Claude reads this project's CLAUDE.md. Add one line to it so Claude reads this page too."; Not now: gone, unchanged; after a reload it is back; Add the line: `@AGENTS.md` then the original CRLF text. |
| S46 Nothing on a title row is lost | Pass; Record and Transcribe a file… not run | Browser: New page in the head, Clear history at Recent's right; Transcribe: Record and Transcribe a file… in the head, the gear "Transcribe settings" opened Settings at the transcription section. Record and Transcribe a file… would bring the microphone prompt and the native picker. |
| S48 New task and Search | Pass | New task focused "Add a task…"; two tasks added to To do; Search ("Search tasks"), "module" left only "Print the Module 4 handouts"; Escape showed both again. |
| S50 Recent, and plain words | Pass | "No pages yet" with "Pages you visit in Ritemark Browser appear here."; New page focused the address; a local page listed as "Page alpha / 127.0.0.1:…"; Clear history emptied it. A local page instead of ritemark.app. |
| S52 File ▸ New tab and Share | Pass on the Mac | ⌘T opened the +'s menu (Text, Table, Web page, Terminal); Share with Proposal.md in front opened its Share menu (PDF, Word document, Copy as Markdown). |
| S56 Not now, and sharing without asking | Pass; after a restart not run | Not now: the question went; a new page asked again; ticked and shared: the question went, and the next page was shared without asking. |
| S57 Before an answer | Pass for the page; the turn at Gate 2 | On a fresh profile, page one asked ("127.0.0.1:…/one"); opening page two moved the question to it ("…/two"). A turn sent while it waits needs a signed-in turn (`BrowserContextStore.test.ts` covers it). |
| S61 The chosen colour on the row | Pass | `proofreader.md` (`color: green`): its icon rgb(21, 128, 61) in Light and rgb(74, 222, 128) in Dark; `summariser.md` muted (rgb(97, 113, 135), rgb(148, 163, 184)). |

## E5 after the merge

**First run, at `440988a8`.** It stopped in gulp's packaging: "Copilot SDK directory not found". The fix-forward was #476 (patch 004 skips the shim when the packaged Copilot has no SDK), and `release-preflight.sh` now reads the pinned VS Code. macOS x64 CI failed the same way.

**Second run, at `3113b080`** (#478 fixed Windows CI's signtool). The release worktree was `.worktrees/release-3113b0802137`.

The build:
- `build-prod.sh` passed in 7 minutes. #476's skip was logged; #471's known "Extension files corrupted during build!" was restored from backup as usual.
- `validate-build-output.sh` passed: 17 native modules, all darwin-arm64; the runtimes arm64; Check 5d's fonts.
- The provenance names VS Code `d956e8a6`, and the app is 2.2 GB.

The app, run hidden on a fresh profile with the baseline's sample:
- `project-check.mjs` 6/6 and `frame-geometry.mjs` 22 pass, 0 fail, 2 skipped.
- The frame baseline: 32 of 34 the same. More differs (1.05%, 1.02%), because a production build has no Copilot Chat.
- PDFs render, the file watcher works, Sofia Sans and Phosphor load, and More has no Copilot.

**Found: the terminal opened blank, and code had no colours.**
- The window asked `app/node_modules/` for xterm.js, vscode-textmate and vscode-oniguruma (ERR_FILE_NOT_FOUND). VS Code 1.142's packaging moves them into `node_modules.asar`, which the window reads only when `product.json` has a commit.
- The build had none: VS Code reads it from `vscode/.git/HEAD`, and in a release worktree `vscode/.git` is a `gitdir:` file. v1.14.0 had none either, but its `node_modules` was a folder.
- Evidence: [e5-no-commit-terminal-blank.png](qa/e5-no-commit-terminal-blank.png); a JSON file showed only `mtk1`.
- Fixed by patch 004 and Check 5e, which also fixes #463 (no V8 code cache).

**Found with the fix: a commit lets VS Code's agent host find the Copilot SDK runtime.**
- Its prewarm then started GitHub's Copilot runtime in every window at launch ("CopilotClient started successfully"), scanning for Copilot CLI sessions.
- Without a commit, it started at launch, failed 4 times and idled, at about 77–100 MB.
- Patch 003 now removes the prewarm, so the agent host starts only when something asks for it. Mission Control asks only after someone turns its sharing on; the web client is web-only.

**The fix shown on a gulp build of `3113b080`'s source** with both changes, `RITEMARK_SOURCE_COMMIT` set, and the bundled extension and the three stripped built-ins as `build-prod.sh` leaves them:
- `product.json` names `3113b080…`.
- For a minute after launch there was no `agenthost.log`, no "agent host started" and no Copilot process: 3 Node utility processes, against the 4 on E5's app.
- A terminal ran `echo e5-$((6*7)) > file` ([e5-commit-terminal.png](qa/e5-commit-terminal.png)).
- A JSON file had 5 token colours.
- About names the commit ([e5-commit-about.png](qa/e5-commit-about.png)).
- `CachedData/3113b080…` filled to 14 MB.
- No ERR_FILE_NOT_FOUND.

**Seen in passing:** the AI composer kept an "Active: settings-e5.json" chip after that file was closed and deleted (#485).

**Third run, at `d60b9652`** (#483 and #484 merged). The release worktree was `.worktrees/release-d60b96521b88`.

The build:
- The full preflight passed, with only the expected symlink warning.
- `build-prod.sh` passed. #476's skip was logged; #471's warning was restored from backup.
- `validate-build-output.sh` passed: 17 native modules, all darwin-arm64; the runtimes arm64; the fonts; Check 5e, "product.json's commit... OK (d60b96521b88)".
- The provenance names source `d60b9652`, VS Code `d956e8a6` and patch set `8344ff53…`. The app is 2.1 GB.

The app, run hidden on a fresh profile with the shared recents cleared and the baseline's sample:
- **No agent host at launch.** For 60 s there was no `agenthost.log`, no "agent host started" in `main.log` and no Copilot process, with 3 Node utility processes. After all the checks below, still no `agenthost.log`.
- **No missing files.** No ERR_FILE_NOT_FOUND. `main.log`'s only error is the older `phosphor.woff2` line, which 1.117's dev build shows too.
- **#463.** `CachedData/d60b96521b88…` filled to 14 MB.
- **Terminal and highlighting.** A terminal ran a command ([terminal](qa/e5-d60b9652-terminal.png)), and a JSON file has 5 token classes.
- **About** names `d60b96521b8818e82d86cfdbf1fc92926ce93fbb` ([About](qa/e5-d60b9652-about.png)).
- **Project and frame.** `project-check.mjs` 6/6, with the share question waiting while the tab row works; `frame-geometry.mjs` 22 pass, 0 fail, 2 skipped. Against the baseline with the new share-question files, 32 of 34 scenes are the same. More differs (1.05%, 1.02%): a production build has no Copilot Chat.
- **Features.** PDFs render, the file watcher works, Sofia Sans and Phosphor load, and More has no Copilot.

## Tests

- VS Code's unit tests for Ritemark (`./scripts/test.sh --grep Ritemark` and the patch tests): 76 passing in 12 suites; electron-main: 11 passing. Re-run at the end with the browser view's tests (`--grep "Ritemark|BrowserView|Browser"`, after the 007 and 010 changes): 316 passing, 0 failing.
- The extension's `npm test` on Node 24: passes (after main was merged in, and after the PDF fix). It includes the Flows mock suite (`FlowIntegration`, `FlowExecutor`, `FlowScheduler`, the node executors' hermetic tests and the Save File integration test).
- `./scripts/validate-qa.sh`: passes (its fast chrome check now runs 1.142's `typecheck-client`, `9e58c95e`).
- `npm run typecheck-client` (tsgo) in `vscode/`: 0 errors; VS Code's `npm run compile`: no errors.
- `check-patch-stacking.mjs`: OK, 18 patches. The pre-commit validator passes.
- New in `validate-build-output.sh`, Check 5d: Ritemark's three fonts (Phosphor, Sofia Sans latin and latin-ext) must be in the built app's `out/` and referenced by the workbench's CSS. It passes on the installed v1.14.0 app; S30 runs it on 1.142's build.

## Seen, not this sprint's

- A dev build's look at `~/Documents` (the welcome's place for new projects) makes macOS ask for file access each time: dev builds are unsigned and share the installed app's bundle ID (`ai.productory.ritemark`), so no answer is kept. Jarmo saw those prompts during this QA. It predates this sprint (every dev harness since Sprint 132 runs this way).
- **Recent folders are shared across profiles from 1.142** (the Development manager asked). VS Code 1.142 stores the recently opened list in `StorageScope.APPLICATION_SHARED` (`workspacesHistoryMainService.ts`), that is `~/<sharedDataFolderName>/sharedStorage/state.vscdb`, here `~/.ritemark-shared/` (the new product field). 1.117 kept it per profile. So a brand-new profile's Open Recent, the welcome's recent projects and the projects list's first fill start with every folder any Ritemark 2.0 build on the Mac opened, dev builds and test profiles included; a fresh 1.117 profile showed none. Harmless for one person with one install; for tests, a fresh profile is no longer fresh for recents (clear `history.recentlyOpenedPathsList` in that file, or give test builds their own `sharedDataFolderName`).
- The extension's `Runtime drift: codex-app-server reports 0.160.0 but manifest says 0.162.1` in the dev log: the worktree's bundled Codex is older than its manifest. Not checked further.
- **VS Code 1.142's agent host starts at launch** in the dev build ("AgentHostProcessManager: agent host started", asked for by the window at startup). It sits idle: Ritemark's `product.json` has no `agentSdks`, the Agents window is closed and chat tools are pinned off. Whether the production build starts it too, and what it costs, is for S30's check after the merge; keeping it from starting would be a follow-up.
- **Patch 009's share test is broader than Ritemark's session** (the pr-reviewer review): `ritemarkSharedWithAgent` counts any agent audience, while Ritemark's Playwright session sees only audiences for every session. A page shared only with another agent session would read as shared. It cannot happen while `workbench.browser.enableChatTools` is pinned off and the Agents window is closed; tightening it to the wildcard or `ritemark` session is a follow-up for 009's next change.

## Left for Gate 2 and after the merge

- What needs a signed-in AI turn: S26's page context and actions, S27, the AI's answers in Sprint 134's S28 and S44, S31, S33 with a chat working, S57's turn.
- What needs the microphone or a native picker: Sprint 134's S46 Record and Transcribe a file…, dictation.
- The HTML language server: `.html` opens in Ritemark's browser by default, so it was not opened as text.
- Jarmo's approval of the share question's new bar for the frame baseline (S14).
- After the merge (D4): the clean-room production build (S30, S10's production half), macOS x64 CI, Windows CI and the Windows PC round (S11, S12, S27, S29).
