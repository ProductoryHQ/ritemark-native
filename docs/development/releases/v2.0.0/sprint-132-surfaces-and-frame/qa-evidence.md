# Sprint 132: QA evidence

Manual QA on the Mac, in a dev instance of the sprint branch, launched in the background (`open -n -g`, its own
short user-data dir, a CDP port of its own) so no window came in front of Jarmo's work. The test project is a
small folder, "Harbour leadership programme". Window 1440 × 900 unless a row says otherwise. Images and
measurements are in [`qa/`](qa/).

`scripts/qa/frame-geometry.mjs` measures the frame against the drawing's numbers over CDP. Its runs:
normal 43 pass; left column hidden 32 pass, 5 skipped; both columns hidden 30 pass, 9 skipped; two desks
36 pass ([`qa/frame-geometry-two-desks.json`](qa/frame-geometry-two-desks.json)). Its numbers are zoom-0 CSS
pixels, so zoom is checked from native window captures instead (S12, S13).

Status: **Pass**, **Partial** (what was not run is named), **Open** (not run yet), **Windows** (Windows round).

## Merge 1: the frame

| Scenario | Status | Evidence and notes |
| --- | --- | --- |
| S1 A fresh start | Pass | Fresh profile: no title row, Documents open, the left column 256 and the AI 400, the row Home, Documents, Tasks, Browser, Agents, Transcribe, More ([`qa/s1-fresh-start.png`](qa/s1-fresh-start.png)). A fresh window first opened on Search; fixed in 1854d997 (Documents stays a place while its tree is not registered yet). |
| S2 Two desks | Pass | Desks 8 apart, each with its own strip and tabs from 16 (geometry, two desks). The 1px separator line Jarmo saw in the gap is gone ([`qa/s2-desk-gap.png`](qa/s2-desk-gap.png)); geometry now checks it. |
| S3 Columns hidden | Pass | Geometry with the left column hidden, and with both hidden: the desk 8 from the edges, the toggles on the desk's strip. |
| S4 Moving the window | Open | |
| S5 The traffic lights after a restart | Partial | After restarts the lights sit on the line at the same pixels as before ([`qa/s13-zoom-after-restart.png`](qa/s13-zoom-after-restart.png)). Full screen and back not run yet. |
| S6 A sheet dialog | Open | |
| S7–S11 | Windows | Windows round 1, after merge 1. |
| S12 Zoom in and out | Pass | Native captures of the top 52 points at zoom 1.0, 1.2, 1.44 and 0.83 ([`qa/s12-zoom-top-band.png`](qa/s12-zoom-top-band.png)): the lights, toggles, You and the tabs keep their size and the line; the lights' pixels are identical; only the columns under the strip change width. |
| S13 Zoom across a restart | Pass | Zoomed to 1.2, quit and relaunched: zoom 1.2 came back, the lights and toggles at the same pixels as at zoom 1.0 ([`qa/s13-zoom-after-restart.png`](qa/s13-zoom-after-restart.png)). |
| S14 Only the AI | Partial | The AI column shows only the AI after a fresh start and after restarts. Not yet checked with other views placed there by an older profile (S45). |
| S15 A view dragged to the AI column | Open | |
| S16 The row | Pass | Fresh profile, as S1; places 34 apart from 8, the chosen one filled (geometry). |
| S17 What does not fit | Pass | More lists Copilot Chat first, then Search, File changes and Extensions, as experiences/home frame 4 draws it. |
| S18 Tasks opens the board | Pass | With a document in front, a click on Tasks brings the Task board forward, from another place and when Tasks is already chosen, also after a reload with the pinned board restored but not yet shown. Two fixes: the places row on top no longer told the extension about a click on the open place (018 now runs `ritemark.placeClickedAgain`), and a pinned restored board could not be replaced, which opened a second board (the extension now shows the restored one). |
| S19 Reordering | Open | |
| S20 Copilot Chat installed | Partial | Copilot Chat in More opens as a tab on the desk. A second click (it should show the same tab) not checked yet. |
| S21 Copilot Chat not installed | Open | |
| S22 Readable tabs | Partial | Widths 120 to 200 (geometry). Tooltips not checked yet. |
| S23 Pointing at a tab | Open | |
| S24 A new tab | Partial | The + menu matches the drawing (Text, Table, Web page, Terminal). Terminal from it checked (S28); the other three not run yet. |
| S25 Many tabs | Partial | Tabs fold into "N ⌄" per desk; its menu not yet checked against the drawing. |
| S26 Bringing a folded tab back | Open | |
| S27 Menus close outside | Pass | The +, "N ⌄", the project menu, New, More and You each close on a press in the tree, in a document and on a second press of their button, and on Escape. Before the fix only a press inside a webview closed them (a press in the tree left them open); now one rule in `ritemarkMenu.ts` covers all of them. |
| S28 A terminal from the + | Pass | Opens a tab named "Terminal", then "Terminal 2"; names survive a reload and a restart. A terminal picked from the shell list is named after the shell ("bash"); asked the Experience lead (question 3). |
| S29 Running and Stop | Pass | Running shows while a command runs; Stop ends it. |
| S30 Working behind other tabs | Pass | The working dot shows on a busy terminal's tab behind other tabs. |
| S31 Ritemark's own terminals | Open | |
| S32 No terminal at start | Pass | No terminal opens on start; the panel stays hidden after restarts. |
| S33 Terminals across a restart | Pass | After a restart, all four terminals came back as tabs; no panel. |
| S34 A pinned Task board tab | Pass | In the app, with the board pinned: ⌘W leaves it and brings the next tab forward; ⌘K ⇧⌘↵ (Unpin) leaves it pinned; ⌃⌘→ leaves it on its desk; ⌘K ⇧⌘← on a document beside it leaves the document behind it; a slip of my palette driver closed every other tab and the emptied desk (most likely Close All Editors) and left only the board; Close all is confirmed by the unit test. `ritemarkPermanentTabs.test.ts` (5 tests) covers the same rules plus a tab opened or dragged to the front, Close others and disposal; it found that a tab *opened* at the front went in front of the board (fixed). Minor: ⌃⌘→ still opens an empty desk to the right before the refused move (listed under Open findings). |
| S35 The head on Documents | Pass | New at 136, Search at 168, Documents at 214, the tree from 236, the name centred at 110 (geometry). The tree at 8 with 16 per level (icon 16 and 32, label 38 and 54), as the Experience lead's answer 6 asks. |
| S36 The project's menu and New | Pass | Both are Ritemark menus at 16, 4 under their row, 232 wide, with icons and hairlines ([`qa/s36-project-menu.png`](qa/s36-project-menu.png), [`qa/s36-new-menu.png`](qa/s36-new-menu.png)). All commands, New folder, Collapse folders, Text, Table (CSV data), Flow, Other file… and Folder each worked. Open a folder… and Reveal in Finder were not run: they open a system dialog and Finder in front of Jarmo's work. Reveal's wiring is unit-tested. |
| S37 You | Partial | The menu matches experiences/settings frame 1 (Settings, Help); ⌘, stays off it until Jarmo decides (Experience lead, answer 8). Keyboard and VoiceOver not run yet. |
| S38 Ritemark's menus | Partial | More, You, the + and the head's menus are Ritemark menus. The application menu on Windows is for the Windows round. |
| S44 The inventory | Open | |
| S45 A lived-in profile | Open | |
| S46 The terminal shortcut | Partial | ⌃` opens a new terminal tab from the tree and from inside a terminal; no panel. The View menu not checked yet. |

## Found and fixed during QA

- A 1px line in the gap between two desks (Jarmo): core's group separator; the frame hides it (6be0bbf5).
- A fresh window opened on Search, pushing Transcribe into More (1854d997).
- The project menu never showed Reveal in Finder: the menu registry does not know `revealFileInOS` (6be0bbf5).
- The places were called Folder and Agent Library; now Documents and Agents, as R5 names them (6be0bbf5).
- With a flow open, `.ritemark/flows` showed in the tree (6be0bbf5).
- Ritemark's menus stayed open on a press in the tree (S27); they now close on any press outside them and on a second press of their button.
- A click on Tasks when Tasks was already chosen did nothing (S18); now it brings the board forward. With a pinned board restored from the last session, it opened a second board; now it shows the restored one.
- A tab opened at the front of the row (dropped there, or dragged from the other desk) went in front of a pinned Task board tab (R9); found by the unit test, fixed in `editorGroupView.ts`.

## Open findings

- ⌃⌘→ (Move Editor into Next Group) on a pinned Task board tab opens a new empty desk, then the move is refused, so the empty desk stays. Harmless, ⌘W closes it; a fix belongs in the move commands (`editorCommands.ts`), not in this merge.
