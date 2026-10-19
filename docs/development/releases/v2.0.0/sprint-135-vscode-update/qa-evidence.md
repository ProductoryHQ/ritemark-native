# Sprint 135: QA evidence

VS Code 1.117.0 → 1.142.0 (Electron 39.8.7 → 43.7.7, Node 22.22.1 → 24.18.0), on the Mac, in dev builds launched in the background (`open -n -g`, a short `--user-data-dir` of their own, a CDP port of their own, `--use-mock-keychain`), so no window came in front of Jarmo's work. The test project is the frame baseline's sample, "Harbour leadership programme", with a Files folder of a Word, PDF, PowerPoint, Excel and draw.io fixture from the repo's corpora. Window 1440 × 900.

Most checks ran twice, side by side: on the 1.142 dev build and on a 1.117 build of main (the rollback rehearsal's tree, S20), each on a fresh profile with the same project and the same script. A difference between the two is either the update or a finding; agreement means the update changed nothing there. Images are in [`qa/`](qa/); the screenshot comparison is [`qa/screenshot-diff.md`](qa/screenshot-diff.md).

Status: **Pass**, **Partial** (what was not run is named), **Not run** (with the reason), **After the merge** (Phase 10, D4).

## Found and fixed

Each was found by comparing the two builds, and each fix was checked on 1.142 afterwards.

- **PDFs stayed on "Loading PDF…"** (`Failed to fetch dynamically imported module … pdf.worker.min.mjs`). 1.142's webview service worker dropped the route for requests made by a page's own workers, and pdf.js always loads its worker through one. The host now sends the worker script's text and the page starts pdf.js's worker from it (`pdfWorker.ts`, `GlobalWorkerOptions.workerPort`). Report.pdf draws (Page 1 of 5); Make an editable copy writes Report.md with the PDF's text. `da34c760`.
- **A Markdown document showed "The editor could not be opened"** after a v1.14.0 profile's update welcome landed on its project (`TypeError: … reading 'selection'`). 1.142's custom-editor navigation read `options.selection` when an editor was opened with no options, which `workbench.action.openEditorAtIndex` (the welcome's landing, the permanent tabs, Home, Settings, the Task board) and Open Next Editor do. Caught with the debugger; upstream main has since fixed it in `webviewEditor.ts`, and patch 007 takes that fix. The same profile now lands with Brief.md open, as on 1.117. `92fe4de4`.
- **All commands offered "Ask in Chat: …"**, opening VS Code's own Chat view. `workbench.commandPalette.showAskInChat` pinned off; the row is gone. `e3262c56`.
- **Two Developer commands under IDs the audit had wrong** stayed in All commands ("Export Agent Host Debug Logs…", "Open Agent Host State File"). Patch 003 drops them under their real IDs; the Developer rows left in a dev build are the built-in Copilot's (stripped from every build) and development-only ones. `b7f8c90f`.
- **Two harness scripts** needed 1.142's slower first palette: `welcome-screenshots.mjs` waits for its row (`8e627902`); `frame-screenshots.mjs` and `project-check.mjs` were fixed earlier in the sprint.

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
| S13 No difference | Pass for 32 of 34 scenes | [`qa/screenshot-diff.md`](qa/screenshot-diff.md). |
| S14 A difference upstream forced | Waiting for review | The share question's browser bar: VS Code's Add Element to Chat (only with Copilot Chat installed) and the new Developer Tools icon. To the Experience lead, then Jarmo; the baseline is not changed. |
| S15 A difference from a default | Pass | Six settings pinned in `configurationDefaults`; the table is in `qa/screenshot-diff.md`. |
| S16 The frame's numbers | Pass | `frame-geometry.mjs`, all four scenes, 0 FAIL ([`qa/frame-geometry-*.json`](qa/)); the numbers match Sprint 132 merge 2's, with Sprint 134's permanent tabs. |
| S17 Sprint 132's scenarios | Mostly pass | Table below. |
| S18 Steps 2 and 3's scenarios | Partial | Tables below. |
| S19 A class upstream renamed | Pass | The selector audit found the empty desk's watermark in a new wrapper; `ritemarkSurfaces.css` follows it ([`notes/rebase.md`](notes/rebase.md), 018). |
| S20 The rehearsal | Pass | A scratch branch (never pushed) in `/tmp/s135-rb` followed the rollback recipe: Node 22.22.1, 1.117.0 checked out, `npm ci`, 18 patches applied, the native-module check, compile, Electron 39.8.7, dev mode starts. The recipe's order was fixed on the way (reset and clean before `git submodule update`). The scratch worktree is still on disk, held by the hygiene report (it needs a person's `--clean`). |
| S21 Rolling back on main | After the merge, only if needed | |
| S22 The inventory | Partial | Walked side by side on both builds: the places row and More, the +, the head's menus and New, You, the tabs and folded tabs, terminals, the Task board, a Markdown document (typing, saving, an outside edit), CSV, Word, PowerPoint, Excel, PDF and Make an editable copy, draw.io, a new flow, Settings, the palette, Quick Open, the notification centre, Copilot Chat, high contrast, zoom. Not walked: the AI's chat, Transcribe's recording and dictation (they need a signed-in turn or the microphone), PDF and Word export. |
| S23 Profiles from before the update | Pass, after a fix | A profile used on the 1.117 build (Ritemark Dark chosen, a place dragged, terminals, a zoom, a CSV in front) opens on 1.142 with all of it ([`qa/s23-main-profile-on-1142.png`](qa/s23-main-profile-on-1142.png)). A v1.14.0 profile from the installed app (Ritemark Dark, Search moved to the AI column, two documents) shows the update welcome ([image](qa/s23-v114-update-welcome-1142.png)); landing on its project failed to open Brief.md until the 007 fix ([after](qa/s23-v114-landed-1142-after-fix.png), [1.117](qa/s23-v114-landed-1117.png)). Search goes back to the left column (More), the theme stays. Chats were not part of either profile (no signed-in turn was sent). |
| S24 A new way into chat | Pass | The Agents window cannot open (003); its two commands and 23 new Developer commands are not in All commands; "Ask in Chat" pinned off; the browser bar's Add Element to Chat needs Copilot Chat (S14). Copilot Chat still opens only from More (and ⌃⌘I), as one tab, on both builds. More's "Chat Debug" is the built-in Copilot's own place, shown only in development builds (`!isProduction()`); it is in the approved 1.117 baseline too. |
| S25 A new built-in extension | Pass | `mermaid-markdown-features` and `theme-modern-icons` are stripped like `copilot` in `build-prod.sh`, `build-windows.yml` and `build-macos-x64.yml` (no new visible surface without Jarmo). |
| S26 The browser and the agent | Partial | The share question waits on the AI's sheet and the tab row works meanwhile (`project-check.mjs --share-question`); the bridge's commands and payloads are unchanged (browser-bridge audit). Not run: a page's context reaching the AI and the AI clicking and filling, which need a signed-in turn. |
| S27 The three runtimes | Not run | Each needs an authenticated turn; for Jarmo's Gate 2, and darwin-x64 and Windows after the merge. |
| S28 Saving and the smaller patches | Pass | Both builds: typing then ⌘S saves the text to disk and the bar says Saved (014); an outside edit shows in the editor; the Help menu is Getting started, Support, View License, Advanced ▸ Toggle Developer Tools (015, read from the menu data the workbench sends to the Mac's menu bar). ⌘P from inside a document opens Quick Open. |
| S29 Windows file handles | After the merge | |
| S30 The clean-room build | After the merge | |

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
| S38, S40, S41, S42, S43, S48, S49 | Not run yet | See the open items below. S42's muted extensions show in every baseline scene that matches. |

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
| S28, S29, S31, S33, S44, S46, S48, S50, S52, S56, S57, S61 | Not run yet | See the open items below. |

## Tests

- VS Code's unit tests for Ritemark (`./scripts/test.sh --grep Ritemark` and the patch tests): 76 passing in 12 suites; electron-main: 11 passing.
- The extension's `npm test` on Node 24: passes (after main was merged in, and after the PDF fix).
- `npm run typecheck-client` (tsgo) in `vscode/`: 0 errors; VS Code's `npm run compile`: no errors.
- `check-patch-stacking.mjs`: OK, 18 patches. The pre-commit validator passes.

## Seen, not this sprint's

- Dev builds share the installed app's bundle ID (`ai.productory.ritemark`). macOS keeps one recent-folders list per bundle ID, so a dev window's welcome lists folders other dev windows opened, and a dev build's look at `~/Documents` (the welcome's place for new projects) asks for access every time, since an unsigned build's answer is not kept. Jarmo saw those prompts during this QA. It predates this sprint (every dev harness since Sprint 132 runs this way).
- The extension's `Runtime drift: codex-app-server reports 0.160.0 but manifest says 0.162.1` in the dev log: the worktree's bundled Codex is older than its manifest. Not checked further.

## Open items before the PR

- Sprint 133's S38, S40, S41, S48, S49 and Sprint 134's S28, S29, S31, S33, S44, S46, S48, S50, S52, S56, S57, S61, the Flows mock suite, and PDF and Word export: they need more background windows, which also bring the macOS file prompt above (asked Jarmo on 19 October).
- The Experience lead's review of the share question's bar (S14).
