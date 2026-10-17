# Sprint 132: QA evidence

Manual QA on the Mac, in a dev instance of the sprint branch, launched in the background (`open -n -g`, its own
short user-data dir, a CDP port of its own) so no window came in front of Jarmo's work. The test project is a
small folder, "Harbour leadership programme". Window 1440 × 900 unless a row says otherwise. Images and
measurements are in [`qa/`](qa/).

`scripts/qa/frame-geometry.mjs` measures the frame against the drawing's numbers over CDP. Its latest runs, stored
in `qa/`: normal 44 pass, 1 skipped ([`frame-geometry-normal.json`](qa/frame-geometry-normal.json)); left column
hidden 36 pass, 6 skipped ([`frame-geometry-left-hidden.json`](qa/frame-geometry-left-hidden.json)); both columns
hidden 40 pass, 10 skipped ([`frame-geometry-both-hidden.json`](qa/frame-geometry-both-hidden.json)); two desks 36
pass ([`frame-geometry-two-desks.json`](qa/frame-geometry-two-desks.json)). Skipped checks are those that do not
apply to the layout (a hidden column's own measures). Its numbers are zoom-0 CSS pixels, so zoom is checked from
native window captures instead (S12, S13).

Status: **Pass**, **Partial** (what was not run is named), **Open** (not run yet), **Windows** (Windows round).

## Merge 1: the frame

| Scenario | Status | Evidence and notes |
| --- | --- | --- |
| S1 A fresh start | Pass | With no tab open the desk keeps its white sheet (256–1040, from 44 to 8 above the status bar) and its + and shows no letterpress ([`qa/empty-desk.png`](qa/empty-desk.png)). Fresh profile: no title row, Documents open, the left column 256 and the AI 400, the row Home, Documents, Tasks, Browser, Agents, Transcribe, More ([`qa/s1-fresh-start.png`](qa/s1-fresh-start.png)). A fresh window first opened on Search; fixed in 1854d997 (Documents stays a place while its tree is not registered yet). |
| S2 Two desks | Pass | Desks 8 apart, each with its own strip and tabs from 16 (geometry, two desks). The 1px separator line Jarmo saw in the gap is gone ([`qa/s2-desk-gap.png`](qa/s2-desk-gap.png)); geometry now checks it. |
| S3 Columns hidden | Pass | Geometry with the left column hidden, and with both hidden: the desk 8 from the edges, the toggles on the desk's strip. |
| S4 Moving the window | Open (Jarmo) | Needs a real pointer on the window: a synthetic press cannot move a window by its drag region. |
| S5 The traffic lights after a restart | Partial | After restarts the lights sit on the line at the same pixels as before ([`qa/s13-zoom-after-restart.png`](qa/s13-zoom-after-restart.png)). Full screen and back is for Jarmo's pass (it takes over the screen). |
| S6 A sheet dialog | Open (Jarmo) | A native sheet would come up over Jarmo's work. |
| S7–S11 | Windows | Windows round 1, after merge 1. |
| S12 Zoom in and out | Pass | Native captures of the top 52 points at zoom 1.0, 1.2, 1.44 and 0.83 ([`qa/s12-zoom-top-band.png`](qa/s12-zoom-top-band.png)): the lights, toggles, You and the tabs keep their size and the line; the lights' pixels are identical; only the columns under the strip change width. |
| S13 Zoom across a restart | Pass | Zoomed to 1.2, quit and relaunched: zoom 1.2 came back, the lights and toggles at the same pixels as at zoom 1.0 ([`qa/s13-zoom-after-restart.png`](qa/s13-zoom-after-restart.png)). |
| S14 Only the AI | Pass | After a fresh start, restarts and the v1.14 profile (S45), the AI column shows only the AI's sheet with its chat rail: no VS Code title row, no row of icons ([`qa/s1-fresh-start.png`](qa/s1-fresh-start.png)). |
| S15 A view dragged to the AI column | Pass | Search moved into the AI column (View: Move View → New Secondary Side Bar Entry, the same move as a drop) went straight back to the left column; More lists it and opens it there; the AI column kept only the AI. Search then sits last in More rather than second as drawn. |
| S16 The row | Pass | Fresh profile, as S1; places 34 apart from 8, the chosen one filled (geometry). Only Ritemark's six take a spot: with Search open (it lives in More) the row stays the six and More, and More takes the chosen fill ([`qa/s16-more-chosen.png`](qa/s16-more-chosen.png), Search open; confirmed by the Experience lead); a v1.14 profile's extra place no longer pushes More past the column. |
| S17 What does not fit | Pass | More lists Copilot Chat first, then Search, File changes and Extensions, as experiences/home frame 4 draws it. |
| S18 Tasks opens the board | Pass | With a document in front, a click on Tasks brings the Task board forward, from another place and when Tasks is already chosen, also after a reload with the pinned board restored but not yet shown. Two fixes: the places row on top no longer told the extension about a click on the open place (018 now runs `ritemark.placeClickedAgain`), and a pinned restored board could not be replaced, which opened a second board (the extension now shows the restored one). |
| S19 Reordering | Pass | Transcribe dragged before Browser (an HTML5 drag through CDP's drag interception) stayed there after a restart: Home, Documents, Tasks, Transcribe, Browser, Agents, More. |
| S20 Copilot Chat installed | Partial | Copilot Chat in More opens as a tab on the desk. A second click (it should show the same tab) not checked yet. |
| S21 Copilot Chat not installed | Pass | On the clean-room production build of d781a0e1 (the Development manager's E5 run), More lists Search, File changes and Extensions and no Copilot Chat. |
| S22 Readable tabs | Pass | Each tab is its name plus the kit's padding (34 before the name, 12 after; 32 after on the chosen tab, for its close button), at most 200, with no floor (the prototype; the Experience lead's review): Brief.md 93, Module 1.md 118, Proposal.md (chosen) 135 ([`qa/review-light.png`](qa/review-light.png)). Fixed on the way: core's transparent 1px tab border made every tab 1 wider, and the chosen tab's close button sat 3–5 off the kit (its glyph now centred 16 from the edge). |
| S23 Pointing at a tab | Pass | Under the pointer a tab that is not chosen fills softly and its close button takes the icon's place exactly (both centred 20 from the tab's left); nothing moves. The tooltip shows the path inside the project ("Modules/Module 1.md"; "Brief.md" at the top level). |
| S24 A new tab | Partial | The + menu matches the drawing (Text, Table, Web page, Terminal). Terminal from it checked (S28); the other three not run yet. |
| S25 Many tabs | Pass | 13 documents and the pinned board: the tabs used longest ago fold into "N ⌄" before the +; no tab narrower than 120 (121); the row never scrolls. Desk 880 (both columns): 9 fold; desk 1180 (AI hidden): 8; full width: 7. With both columns hidden some still fold, because these 13 names (up to "Workshop outline for spring.md") need about 2,000 wide; the scenario's "none" holds for shorter names. Tabs show in most-recently-used order and stop at the first that does not fit, so a tab used longer ago never shows while a newer one is folded. |
| S26 Bringing a folded tab back | Pass | "N ⌄" lists the folded tabs most recent first, each with its folder and a close button under the pointer, then "Close these N tabs" ([`qa/s26-folded-tabs-menu.png`](qa/s26-folded-tabs-menu.png)). Picking Agenda brought it back in its own place as the chosen tab (it fitted, so nothing else folded); "Close these 7 tabs" closed the folded ones and left the row. |
| S27 Menus close outside | Pass | The +, "N ⌄", the project menu, New, More and You each close on a press in the tree, in a document and on a second press of their button, and on Escape. Before the fix only a press inside a webview closed them (a press in the tree left them open); now one rule in `ritemarkMenu.ts` covers all of them. |
| S28 A terminal from the + | Pass | Opens a tab named "Terminal", then "Terminal 2"; names survive a reload and a restart. The terminal's bar shows the shell's name as a plain label, then Split, Clear and Close (the Experience lead's answer 3, confirmed by Jarmo: the shell menu comes later). |
| S29 Running and Stop | Pass | Running shows while a command runs; Stop ends it. |
| S30 Working behind other tabs | Pass | The working dot shows on a busy terminal's tab behind other tabs. |
| S31 Ritemark's own terminals | Open | |
| S32 No terminal at start | Pass | No terminal opens on start; the panel stays hidden after restarts. |
| S33 Terminals across a restart | Pass | After a restart, all four terminals came back as tabs; no panel. |
| S34 A pinned Task board tab | Pass | In the app, with the board pinned: ⌘W leaves it and brings the next tab forward; ⌘K ⇧⌘↵ (Unpin) leaves it pinned; ⌃⌘→ leaves it on its desk; ⌘K ⇧⌘← on a document beside it leaves the document behind it; a slip of my palette driver closed every other tab and the emptied desk (most likely Close All Editors) and left only the board; Close all is confirmed by the unit test. `ritemarkPermanentTabs.test.ts` (5 tests) covers the same rules plus a tab opened or dragged to the front, Close others and disposal; it found that a tab *opened* at the front went in front of the board (fixed). Minor: ⌃⌘→ still opens an empty desk to the right before the refused move (listed under Open findings). |
| S35 The head on Documents | Pass | The project's mark ("HL", a 24 square of ink at 16, 98) before its name at 48; New at 136, Search at 168, Documents at 214, the tree from 236, the name centred at 110 (geometry). The tree at 8 with 16 per level (icon 16 and 32, label 38 and 54), as the Experience lead's answer 6 asks. |
| S36 The project's menu and New | Pass | Both are Ritemark menus at 16, 4 under their row, 232 wide, with icons and hairlines. The project's menu (after the Experience lead's review): Switch project… (opens the recent folders), Open a folder…, Reveal in Finder, then New folder and Collapse folders ([`qa/s36-project-menu.png`](qa/s36-project-menu.png), [`qa/s36-new-menu.png`](qa/s36-new-menu.png)). Switch project…, New folder, Collapse folders, Text, Table (CSV data), Flow, Other file… and Folder each worked. Open a folder… and Reveal in Finder were not run: they open a system dialog and Finder in front of Jarmo's work. Reveal's wiring is unit-tested. |
| S37 You | Partial | The menu matches experiences/settings frame 1: "Settings ⌘," and Help. ⌘, opens Ritemark Settings (Jarmo's answer of 17 October). By keyboard: You is a button with `aria-haspopup=menu`; Enter and Space open the menu, ↑ ↓ move, Enter on Settings opens Ritemark Settings, Escape closes it and returns focus to You (it did not before; fixed for every Ritemark menu). Not run: Help (it opens ritemark.app in the system browser in front of Jarmo's work) and VoiceOver (it speaks aloud); both for Jarmo's pass. |
| S38 Ritemark's menus | Partial | More, You, the +, "N ⌄" and the head's menus are Ritemark menus (S17, S24, S26, S27, S36, S37). The macOS menu bar staying native is for Jarmo's pass (the app cannot read native menus here without accessibility access); the Windows application menu is for the Windows round. |
| S44 The inventory | Partial | The window section, which this sprint moves, walked row by row: Home; the file list on Documents; the + (Text, Table, Web page, Terminal); Search under New; New file and folder in New; open editors as tabs; Source control (File changes) and Extensions from More; Terminal from the + and ⌃`; All commands in the project's menu; Settings in You; one toggle per side; the breadcrumb and the remote and problems items gone; the status bar with notifications, Report AI issue, AI Ready and the word count. The editor, the other kinds of file and the AI are untouched by this sprint and were used throughout the QA (Markdown, CSV, a flow, the Task board, a web page, the AI's sheet); a row-by-row walk of those sections is still to do. Not checkable here: the macOS menu bar (Jarmo's pass). Note: File changes opens with VS Code's head, "Source Control". |
| S45 A lived-in profile | Pass | A v1.14.0 profile made with the installed app (its own instance and profile, in the background): a terminal and Search in the AI column, the Chat view once opened, Agent Library dragged to the top, Ritemark Dark chosen by hand. Opened with this build: the places row on top in R5's order (the drag replaced once), the AI column only the AI, Search in the left column (in More), Chat moved to the panel, the theme still Ritemark Dark ([`qa/s45-lived-in-profile.png`](qa/s45-lived-in-profile.png), taken before the Agents view was renamed: its head reads "Agents: Agent Library", and after the rename it reads "Agents"). Three fixes came out of it (below). Not exercisable: v1.14 keeps no terminal across a quit (its saved buffer state is empty), so there is none to bring over; Copilot Chat is not installed in the shipped app, and Outline is hidden in 1.x, so Search stood in for it. |
| S46 The terminal shortcut | Partial | ⌃` opens a new terminal tab from the tree and from inside a terminal; no panel. The View menu (native on the Mac) is for Jarmo's pass; on Windows it is checked in round 1. |

## Found and fixed during QA

- A 1px line in the gap between two desks (Jarmo): core's group separator; the frame hides it (6be0bbf5).
- A fresh window opened on Search, pushing Transcribe into More (1854d997).
- The project menu never showed Reveal in Finder: the menu registry does not know `revealFileInOS` (6be0bbf5).
- The places were called Folder and Agent Library; now Documents and Agents, as R5 names them (6be0bbf5).
- With a flow open, `.ritemark/flows` showed in the tree (6be0bbf5).
- Ritemark's menus stayed open on a press in the tree (S27); they now close on any press outside them and on a second press of their button.
- A click on Tasks when Tasks was already chosen did nothing (S18); now it brings the board forward. With a pinned board restored from the last session, it opened a second board; now it shows the restored one.
- Escape in You's, More's or the head's menus left the keyboard nowhere; it now returns to the menu's button. The ⋯ button was still called "Additional Views"; now More.
- Updating from v1.14 reset a hand-chosen theme: the extension re-applied its Sprint 52 theme set-up whenever the version changed ("1.14.0-0" in the shipped app, so every update). It now runs once per profile (S45, R16).
- A place of another extension new to a v1.14 profile went in among Ritemark's six (a saved place carries no order); it now goes after them (S45, R5).
- The Agents place's head read "Agents: Agent Library"; its view is called Agents too.
- The Experience lead's screenshot review (17 October): the project's mark was missing; tabs had a 120 floor; an empty desk lost its sheet and + and showed the letterpress; another extension's place could push More past the column; the Agent Library's section header was unreadable in dark ([`qa/agents-dark.png`](qa/agents-dark.png)); the project's menu lacked Switch project… and held All commands; the open tree row had a border and a larger radius; `.flow.json` had the JSON icon. All fixed; the extension in muted ink moved to step 2.
- A tab opened at the front of the row (dropped there, or dragged from the other desk) went in front of a pinned Task board tab (R9); found by the unit test, fixed in `editorGroupView.ts`.

## Open findings

- ⌃⌘→ (Move Editor into Next Group) on a pinned Task board tab opens a new empty desk, then the move is refused, so the empty desk stays. Harmless, ⌘W closes it; a fix belongs in the move commands (`editorCommands.ts`), not in this merge.

## After merge 1

- **E5, production build check (the Development manager, at `d781a0e1`):** clean-room release worktree; source verified and preflight passed (19 of 19 patches apply on vanilla 1.117.0); `build-prod` passed both validations, with provenance verified (source commit `d781a0e1`); no absolute symlinks; `webview.js` and `office-preview.js` byte-identical to the source. Launched in the background on a fresh profile: the extension activates with no extension-host errors; More holds no Copilot Chat when it is not installed (S21). The production AI default is Sonnet 5.5; the dev build's "Opus 5 with 1M" is the dev build's own.
- **Drift at merge 1:** 15 of 19 patches fail on VS Code 1.142.0, in 58 file patches ([`notes/drift.md`](notes/drift.md)).
- **Jarmo's Mac pass on merge 1:** Ritemark Settings must lie on white, and the CSV grid lost its edge; both are fixed for merge 2 (tasks.md, Phase 7).
- **More's tooltip over its open menu** (seen by the Development manager on a scripted click): not reproduced, either hovering first or clicking at once and waiting. Found instead and fixed: while the pointer was on More, its glyph painted VS Code's toolbar hover box inside the place's fill.
