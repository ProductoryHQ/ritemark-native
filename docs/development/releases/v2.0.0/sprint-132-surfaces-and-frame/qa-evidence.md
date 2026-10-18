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
| S7–S11 | Windows | Windows round 1 (below): S7, S8 (as reworded), S9 and S11 pass; S10 for Jarmo by hand. |
| S12 Zoom in and out | Pass | Native captures of the top 52 points at zoom 1.0, 1.2, 1.44 and 0.83 ([`qa/s12-zoom-top-band.png`](qa/s12-zoom-top-band.png)): the lights, toggles, You and the tabs keep their size and the line; the lights' pixels are identical; only the columns under the strip change width. |
| S13 Zoom across a restart | Pass | Zoomed to 1.2, quit and relaunched: zoom 1.2 came back, the lights and toggles at the same pixels as at zoom 1.0 ([`qa/s13-zoom-after-restart.png`](qa/s13-zoom-after-restart.png)). |
| S14 Only the AI | Pass | After a fresh start, restarts and the v1.14 profile (S45), the AI column shows only the AI's sheet with its chat rail: no VS Code title row, no row of icons ([`qa/s1-fresh-start.png`](qa/s1-fresh-start.png)). |
| S15 A view dragged to the AI column | Pass | Search moved into the AI column (View: Move View → New Secondary Side Bar Entry, the same move as a drop) went straight back to the left column; More lists it and opens it there; the AI column kept only the AI. Search then sits last in More rather than second as drawn. |
| S16 The row | Pass | Fresh profile, as S1; places 34 apart from 8, the chosen one filled (geometry). Only Ritemark's six take a spot: with Search open (it lives in More) the row stays the six and More, and More takes the chosen fill ([`qa/s16-more-chosen.png`](qa/s16-more-chosen.png), Search open; confirmed by the Experience lead); a v1.14 profile's extra place no longer pushes More past the column. |
| S17 What does not fit | Pass | More lists Copilot Chat first, then Search, File changes and Extensions, as experiences/home frame 4 draws it. |
| S18 Tasks opens the board | Pass | With a document in front, a click on Tasks brings the Task board forward, from another place and when Tasks is already chosen, also after a reload with the pinned board restored but not yet shown. Two fixes: the places row on top no longer told the extension about a click on the open place (018 now runs `ritemark.placeClickedAgain`), and a pinned restored board could not be replaced, which opened a second board (the extension now shows the restored one). |
| S19 Reordering | Pass | Transcribe dragged before Browser (an HTML5 drag through CDP's drag interception) stayed there after a restart: Home, Documents, Tasks, Transcribe, Browser, Agents, More. |
| S20 Copilot Chat installed | Pass (closeout) | Copilot Chat in More opens as a tab on the desk. At the closeout, with Budget.csv chosen, a second click brought the same Chat tab forward; there was still one. |
| S21 Copilot Chat not installed | Pass (fixed in the closeout) | On the clean-room production build of d781a0e1 (the Development manager's E5 run), More lists Search, File changes and Extensions and no Copilot Chat. Windows round 2 found Ctrl+Alt+I still opened VS Code's own Chat in a bottom panel; fixed in the closeout (see there). |
| S22 Readable tabs | Pass | Each tab is its name plus the kit's padding (34 before the name, 12 after; 32 after on the chosen tab, for its close button), at most 200, with no floor (the prototype; the Experience lead's review): Brief.md 93, Module 1.md 118, Proposal.md (chosen) 135 ([`qa/review-light.png`](qa/review-light.png)). Fixed on the way: core's transparent 1px tab border made every tab 1 wider, and the chosen tab's close button sat 3–5 off the kit (its glyph now centred 16 from the edge). |
| S23 Pointing at a tab | Pass (revised in merge 2) | Under the pointer a tab that is not chosen fills softly and its close button takes the icon's place exactly (both centred 20 from the tab's left); nothing moves. Revised on 18 October: the close button is on the right (see merge 2). The tooltip shows the path inside the project ("Modules/Module 1.md"; "Brief.md" at the top level). |
| S24 A new tab | Pass (closeout) | The + menu matches the drawing (Text, Table, Web page, Terminal). Terminal from it checked (S28). At the closeout, Web page opened a Browser tab, and Text showed that Text and Table made their file in `~/Documents/Ritemark/`, not in the project as the menu says; fixed (see the closeout section). |
| S25 Many tabs | Pass | 13 documents and the pinned board: the tabs used longest ago fold into "N ⌄" before the +; no tab narrower than 120 (121); the row never scrolls. Desk 880 (both columns): 9 fold; desk 1180 (AI hidden): 8; full width: 7. With both columns hidden some still fold, because these 13 names (up to "Workshop outline for spring.md") need about 2,000 wide; the scenario's "none" holds for shorter names. Tabs show in most-recently-used order and stop at the first that does not fit, so a tab used longer ago never shows while a newer one is folded. |
| S26 Bringing a folded tab back | Pass | "N ⌄" lists the folded tabs most recent first, each with its folder and a close button under the pointer, then "Close these N tabs" ([`qa/s26-folded-tabs-menu.png`](qa/s26-folded-tabs-menu.png)). Picking Agenda brought it back in its own place as the chosen tab (it fitted, so nothing else folded); "Close these 7 tabs" closed the folded ones and left the row. |
| S27 Menus close outside | Pass | The +, "N ⌄", the project menu, New, More and You each close on a press in the tree, in a document and on a second press of their button, and on Escape. Before the fix only a press inside a webview closed them (a press in the tree left them open); now one rule in `ritemarkMenu.ts` covers all of them. |
| S28 A terminal from the + | Pass | Opens a tab named "Terminal", then "Terminal 2"; names survive a reload and a restart. The terminal's bar shows the shell's name as a plain label, then Split, Clear and Close (the Experience lead's answer 3, confirmed by Jarmo: the shell menu comes later). |
| S29 Running and Stop | Pass | Running shows while a command runs; Stop ends it. |
| S30 Working behind other tabs | Pass | The working dot shows on a busy terminal's tab behind other tabs. |
| S31 Ritemark's own terminals | Partial | Windows round 1: Codex Repair with the bundled runtime opens no terminal, by design (it says Codex ships with Ritemark and cannot be repaired on its own). Claude Login not run: Claude is connected, and reaching Sign in would sign Jarmo out. The others not run yet. |
| S32 No terminal at start | Pass | No terminal opens on start; the panel stays hidden after restarts. |
| S33 Terminals across a restart | Pass | After a restart, all four terminals came back as tabs; no panel. |
| S34 A pinned Task board tab | Pass | In the app, with the board pinned: ⌘W leaves it and brings the next tab forward; ⌘K ⇧⌘↵ (Unpin) leaves it pinned; ⌃⌘→ leaves it on its desk; ⌘K ⇧⌘← on a document beside it leaves the document behind it; a slip of my palette driver closed every other tab and the emptied desk (most likely Close All Editors) and left only the board; Close all is confirmed by the unit test. `ritemarkPermanentTabs.test.ts` (5 tests) covers the same rules plus a tab opened or dragged to the front, Close others and disposal; it found that a tab *opened* at the front went in front of the board (fixed). ⌃⌘→ used to open an empty desk to the right before the refused move; merge 2 fixed it in the move command (019, `editorCommands.ts`): a desk the command made is taken away again if the move leaves it empty. Checked in the app: ⌃⌘→ on the board leaves one desk with the board active; on a document it still makes a second desk, and ⌃⌘← brings it back. The unit tests don't load the editor commands, so this one is checked in the app. |
| S35 The head on Documents | Pass | The project's mark ("HL", a 24 square of ink at 16, 98) before its name at 48; New at 136, Search at 168, Documents at 214, the tree from 236, the name centred at 110 (geometry). The tree at 8 with 16 per level (icon 16 and 32, label 38 and 54), as the Experience lead's answer 6 asks. |
| S36 The project's menu and New | Pass | Both are Ritemark menus at 16, 4 under their row, 232 wide, with icons and hairlines. The project's menu (after the Experience lead's review): Switch project… (opens the recent folders), Open a folder…, Reveal in Finder, then New folder and Collapse folders ([`qa/s36-project-menu.png`](qa/s36-project-menu.png), [`qa/s36-new-menu.png`](qa/s36-new-menu.png)). Switch project…, New folder, Collapse folders, Text, Table (CSV data), Flow, Other file… and Folder each worked. Open a folder… and Reveal in Finder were not run: they open a system dialog and Finder in front of Jarmo's work. Reveal's wiring is unit-tested. |
| S37 You | Partial | The menu matches experiences/settings frame 1: "Settings ⌘," and Help. ⌘, opens Ritemark Settings (Jarmo's answer of 17 October). By keyboard: You is a button with `aria-haspopup=menu`; Enter and Space open the menu, ↑ ↓ move, Enter on Settings opens Ritemark Settings, Escape closes it and returns focus to You (it did not before; fixed for every Ritemark menu). Not run: Help (it opens ritemark.app in the system browser in front of Jarmo's work) and VoiceOver (it speaks aloud); both for Jarmo's pass. |
| S38 Ritemark's menus | Partial | More, You, the +, "N ⌄" and the head's menus are Ritemark menus (S17, S24, S26, S27, S36, S37). The macOS menu bar staying native is for Jarmo's pass (the app cannot read native menus here without accessibility access); Windows round 1: the application menu is Ritemark's own (32 rows, radius 8, Sofia Sans 13, the indigo chosen row), Pass. |
| S44 The inventory | Partial | The window section, which this sprint moves, walked row by row: Home; the file list on Documents; the + (Text, Table, Web page, Terminal); Search under New; New file and folder in New; open editors as tabs; Source control (File changes) and Extensions from More; Terminal from the + and ⌃`; All commands in the project's menu; Settings in You; one toggle per side; the breadcrumb and the remote and problems items gone; the status bar with notifications, Report AI issue, AI Ready and the word count. The editor, the other kinds of file and the AI are untouched by this sprint and were used throughout the QA (Markdown, CSV, a flow, the Task board, a web page, the AI's sheet); a row-by-row walk of those sections is still to do. Not checkable here: the macOS menu bar (Jarmo's pass). Note: File changes opens with VS Code's head, "Source Control". |
| S45 A lived-in profile | Pass | A v1.14.0 profile made with the installed app (its own instance and profile, in the background): a terminal and Search in the AI column, the Chat view once opened, Agent Library dragged to the top, Ritemark Dark chosen by hand. Opened with this build: the places row on top in R5's order (the drag replaced once), the AI column only the AI, Search in the left column (in More), Chat moved to the panel, the theme still Ritemark Dark ([`qa/s45-lived-in-profile.png`](qa/s45-lived-in-profile.png), taken before the Agents view was renamed: its head reads "Agents: Agent Library", and after the rename it reads "Agents"). Three fixes came out of it (below). Not exercisable: v1.14 keeps no terminal across a quit (its saved buffer state is empty), so there is none to bring over; Copilot Chat is not installed in the shipped app, and Outline is hidden in 1.x, so Search stood in for it. |
| S46 The terminal shortcut | Partial | ⌃` opens a new terminal tab from the tree and from inside a terminal; no panel. The View menu (native on the Mac) is for Jarmo's pass. Windows round 1: Ctrl+` opens terminal tabs and the View menu has no Terminal entry, Pass. |

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

- ⌃⌘→ (Move Editor into Next Group) on a pinned Task board tab opened a new empty desk, then the move was refused, so the empty desk stayed. Fixed in merge 2 (S34).

## After merge 1

- **E5, production build check (the Development manager, at `d781a0e1`):** clean-room release worktree; source verified and preflight passed (19 of 19 patches apply on vanilla 1.117.0); `build-prod` passed both validations, with provenance verified (source commit `d781a0e1`); no absolute symlinks; `webview.js` and `office-preview.js` byte-identical to the source. Launched in the background on a fresh profile: the extension activates with no extension-host errors; More holds no Copilot Chat when it is not installed (S21). The production AI default is Sonnet 5.5; the dev build's "Opus 5 with 1M" is the dev build's own.
- **Drift at merge 1:** 15 of 19 patches fail on VS Code 1.142.0, in 58 file patches ([`notes/drift.md`](notes/drift.md)).
- **Jarmo's Mac pass on merge 1:** Ritemark Settings must lie on white, and the CSV grid lost its edge; both are fixed for merge 2 (tasks.md, Phase 7).
- **More's tooltip over its open menu** (seen by the Development manager on a scripted click): not reproduced, either hovering first or clicking at once and waiting. Found instead and fixed: while the pointer was on More, its glyph painted VS Code's toolbar hover box inside the place's fill.

## Merge 2

| Scenario | Status | Evidence and notes |
| --- | --- | --- |
| S39 Every surface, both themes | Pass (step 1's scope) | Every surface in Ritemark Light and Ritemark Dark, against the scope the Experience lead set on 18 October ([`qa/s39-light-surfaces.png`](qa/s39-light-surfaces.png), [`qa/s39-dark-surfaces.png`](qa/s39-dark-surfaces.png)): a Markdown document, a CSV, a PDF, a Word and a PowerPoint file, a flow, the Task board and the Tasks place, the Browser place, Transcribe, the Agents place, Settings and the command palette; a notification and the notification centre from a fresh profile. In this pass: PDF, Word and PowerPoint pages lie on a canvas in the AI's colour (#F8FAFC, #1A1740 in Dark) with a hairline under the viewer's bar, the pages white ([`qa/s39-pdf-canvas-dark.png`](qa/s39-pdf-canvas-dark.png)); the tree's file icons for .pdf, .docx/.doc, .xlsx/.xls, .csv, .pptx/.ppt, images and audio (Phosphor, muted ink); a CSV row stays one line, 32 high, with an ellipsis; the palette has the menus' sheet with radius 10, a 32 input with radius 8, 32 rows with radius 6, the chosen row in soft indigo, descriptions and keys in muted ink ([`qa/s39-palette-light.png`](qa/s39-palette-light.png), [`qa/s39-palette-dark.png`](qa/s39-palette-dark.png)); toasts and the centre on the menus' sheet with radius 10, the message 13/20, the source in muted ink, 32-high buttons with the default one primary ([`qa/s39-notification-light.png`](qa/s39-notification-light.png), [`qa/s39-notification-centre-dark.png`](qa/s39-notification-centre-dark.png)); Transcribe's buttons 32 with radius 8, its group heads and type as the column's, recordings with the waveform icon. Found and fixed on the way: Settings' Appearance kept showing the theme it opened with when the theme changed elsewhere (it now follows), its Dark preview was the old slate and its check mark was white on the light indigo. Left for later steps, as the Experience lead set: the PDF bar's words and Share, the redrawn Task board, Transcribe and Browser places, the AI's empty state and the status bar's items, the indigo icon on the open row. Not drawn on screen here: a recording in progress (it would use the microphone). |
| S41 Dialogs (experience 31) | Pass | A terminal running a command, closed from its bar: Ritemark's own dialog, 400 × 138 at 520, 360 as drawn, in both themes ([`qa/s41-dialog-light.png`](qa/s41-dialog-light.png), [`qa/s41-dialog-dark.png`](qa/s41-dialog-dark.png): the drawing on the left). Found on the way: the bar's Close ended a running command without asking (it now closes the tab, which asks), and Ritemark Dark still had 35 colours on Tailwind's slate (the notifications, the quick pick, inputs and widgets on #0F172A); they now take the kit's dark tokens: the desk, its hairlines, the soft fills, and ink on the lighter indigo. |
| S41 The Agent Library (experience 31) | Pass (the column) | The Agents place has the project's head, New (Agent, Skill, Command, Flow) and Search, the This project / All projects switch, and the six sections as the column's groups with 32 rows, one icon per kind and file names with their extension; the switch at 208 and the first group at 252, as drawn, in both themes ([`qa/s41-agents-light.png`](qa/s41-agents-light.png), [`qa/s41-agents-dark.png`](qa/s41-agents-dark.png), drawing left; New and Search: [`qa/s41-agents-new-search.png`](qa/s41-agents-new-search.png)). New → Command makes `.claude/commands/<name>.md` and opens it (the library could not make commands before). The descriptions, the Claude/Codex badge and a flow's "used by" moved into each row's tooltip; per-item icons and colours give way to one icon per kind. The agent's settings panel follows the drawing too: 240 wide with hairlines, the fields 28 high with radius 8, 14 checkboxes, six tools then "N more", skills as soft pills by folder name, and the schedule as one field ("Not scheduled", or when it runs) that opens today's editor; Linked flow and Advanced stay under it ([`qa/s41-agent-settings.png`](qa/s41-agent-settings.png), drawing left, light and dark). A toggle in a document's bar that is on now has the ground's fill and ink, as drawn, and the webviews' dark tokens moved from slate to the kit's dark. Then brought to the rows the Experience lead settled on 18 October (ritemark-dev c8108e7): the extension in muted ink ([`qa/s41-agents-settled-dark.png`](qa/s41-agents-settled-dark.png)); Scheduled shows a run's time when done, a spinner while it runs, "Approval needed" in amber and "Failed" in body ink with a warning; an empty list is one muted line ("Agents, skills, commands and flows for this project live here. New makes one.") in place of the two buttons. Not shown on screen: the Scheduled states and the empty list, since the test project has agents and no scheduled runs; they are checked in the code only. |
| S41 Flows (experience 31) | Pass | The flow editor follows frame 2 and dark/theme-2 ([`qa/s41-flows-light.png`](qa/s41-flows-light.png), [`qa/s41-flows-dark.png`](qa/s41-flows-dark.png)). The desk bar runs name, description, schedule, Auto-arrange and Run flow, each with a tooltip. The palette is 176 wide, in rows under Start, AI and Actions; the step descriptions and its tip box moved into tooltips. A node is 202 wide with a 40 head, the step's chip and number, and key–value rows. The canvas has dots every 20 and edges 2 in the strong hairline. The flow sits 56 below the canvas top, centred across, at 100% when it fits, and refits when the right column opens, until the person pans or zooms. A press on the empty canvas no longer counts as a pan. The right column is 248 wide with the chip, the name and close, the fields in the kit's boxes, one help line ("Type / to use what an earlier step made.") and "Delete node" at its foot. The schedule and run panels share that head, in sentence case ([`qa/s41-flows-schedule-dark.png`](qa/s41-flows-schedule-dark.png), [`qa/s41-flows-run-dark.png`](qa/s41-flows-run-dark.png)). In Ritemark Dark every primary button, in the webviews and in VS Code, is the light indigo with the ground's ink on it and no glow (kit: `.dark .btn.primary`). Then, as the Experience lead agreed: the Claude Code and Codex "Note" boxes became one help line under Timeout ("Runs without asking you: its actions are approved for the run."), the run says to sign in under Settings > Agent Runtime when Claude Code or Codex is not signed in, and the prompt field has no grip and grows to 8 lines. The `{date}` chip waits for a later step (a plain text box today). The Experience lead approved Flows in both themes. |
| S44 The inventory, again | Pass, with follow-ups | Every row of the inventory's editor, other-files and AI sections walked in a background dev instance on a fresh profile with every kind of file, plus the window rows this sprint moves (New file and folder, the +, Search, More, You); no AI message or flow was sent or run, and the project ended byte for byte as it began. Most rows pass from their 1.14 place or their new one. Not checkable here: Google Docs (the dev build has no client), Retry on a save problem, sheet tabs (one-sheet file), PowerPoint notes, the transcript workbench, conversation menus, the prompt queue, approvals and sign-in cards, scheduled agents (each needs a recording, a conversation or a running agent). Found and fixed in this merge, in files it changes: a delete in a sorted CSV removed another row (it used the view's position; now the file's), CSV columns sorted numbers as text, the selection menu and the link dialog were white boxes in Dark, and no Tailwind `dark:` style had ever applied (the selected-text chip stayed light grey in Dark). Found, older than this sprint, and fixed in [#450](https://github.com/ProductoryHQ/ritemark-native/pull/450) except the two it looked at and left (the share prompt is deliberate; the screenshot after Deny did not reproduce): after Use disk version in the conflict dialog every save fails until Overwrite; a table's + and delete handles sit off after the editor scrolls; @ and / list agents and commands added while the window is open only after a reload; the share-with-agent prompt opens on a browser tab's first load, and a screenshot was still attached after Deny; the Properties Add menu runs past the panel; the thinking effort popup overhangs the AI's sheet; the dictation language menu ignores Escape; Transcribe's gear opens the top of Settings. |
| S45 A lived-in profile, again | Pass | A new v1.14.0 profile made with the installed app (its own instance, in the background): a terminal and Search moved to the AI column, the Chat view opened, Agent Library dragged to the top, Ritemark Dark chosen by hand; quit with ⌘Q, then opened with merge 2's build. The places row is in R5's order, the AI column holds only the AI, the panel is hidden, Search is in More, and the theme is still Ritemark Dark ([`qa/s45-lived-in-profile-merge-2.png`](qa/s45-lived-in-profile-merge-2.png)). Found and fixed: the Agents place's empty state ("New skill", "New agent") had white text on the light indigo in Dark; its primary buttons now take the theme's button colours, ink on the light indigo with no glow. |
| S42 Narrowing the window | Pass | The workbench laid out at each width in turn (CDP viewport emulation in the dev instance: the workbench sees a resize, the window itself does not move), AI column 400 at the start. Columns (left, AI, desk): 1500: 260, 400, 840; 1300: 260, 336, 704; 1100: hidden, 336, 764; 900: hidden, hidden, 900; and back: 1100 brings the AI back, 1300 the left column, 1500 the AI's 400. The desk never went below 704. `ritemarkWindowSizes.test.ts` covers the same walk, a jump across every width, and a column the person resized. Found later: once the AI's column came back from a narrow moment at 333, not 400; the layout can give the narrowed column a little less than 336, so the window now remembers the width the column got and restores from that (a sixth test). What made the window narrow for that moment was not found again in reloads or theme changes. |
| S40 High contrast | Pass | Light High Contrast and Dark High Contrast, a CSV and a Markdown document open ([`qa/s40-high-contrast.png`](qa/s40-high-contrast.png)). Found and fixed: the open document's row in the tree showed nothing (the frame removes the row's outline), and the desk's and the AI's edges were drawn only at their corners (the sheets' 1px edge is clipped by the editor's content and covered by the tab row). In high contrast each part now keeps its theme's border, the status bar its top line, and the open row an outline in the theme's active border. The chosen tab and place keep theirs. |
| S43 A column the person opened | Pass | At 1100 the left column had hidden itself; its toggle on the desk's strip brought it back, taking room (desk 504, as a toggle does today). It stayed open at 1150 and 1250 and hid again when the window crossed 1200 going down ([`qa/s43-left-opened-1100.png`](qa/s43-left-opened-1100.png)). |
| S37 You, an icon button (Jarmo, 18 October) | Pass (Mac; Windows by layout) | You is a 28 button at 1404, 12 (centred on the 26 line), 8 after the AI's toggle. The user-circle glyph at 17, no ring, no fill at rest. It shares one ink with the toggle beside it, the kit's muted: #617187 in Light, #94A3B8 in Dark, measured in the page and in the pixels; the kit draws both in that ink. Hover and the open menu give it the toggle's hover fill (224,226,229 in Light; 42,42,60 in Dark, the same pixels as the toggle's). The menu is unchanged: "Settings ⌘," and Help. Escape returns focus to You with its focus ring. Drawing on the right in the top row; below: the toggle on hover, You on hover, You open ([`qa/s37-you-light.png`](qa/s37-you-light.png), [`qa/s37-you-dark.png`](qa/s37-you-dark.png)). With Windows' 138 for the window buttons: the toggle at 1230 and You at 1266, before the buttons, as experiences/windows frame 1 draws them ([`qa/s37-you-windows-layout.png`](qa/s37-you-windows-layout.png), drawing right). This is checked on a Windows PC in Windows round 2. The frame baseline was re-taken for it (all 18 scenes changed by 0.04%, in the toggles and You only). |
| S23 Pointing at a tab, revised (Jarmo, 18 October) | Pass (Mac) | Every tab keeps the close button's room: on a fresh profile with Proposal.md, Kickoff notes.md, Budget.csv and a web page (ritemark.app, its own site icon), each tab's name ends 32 from its right edge and its × is centred 16 from it, chosen or not. At rest the × shows on the chosen tab only (opacity 0 on the others). Under the pointer, a tab that is not chosen shows its × at its right edge, its icon stays visible, and no tab's width changes (135.5, 162.2, 128.1 and 200.5 at rest and pointed at). The web page tab with its site icon, which showed no × on Windows round 1, shows it on the right too. Rows: at rest; pointing at Kickoff notes.md; pointing at the web page ([`qa/s23-tab-close-right.png`](qa/s23-tab-close-right.png)). With the extra room per tab, a 200-wide web page tab folded Brief.md into "1 ⌄", as expected. Windows is checked in round 2. |

## Windows round 1

Tested by the Windows session on Jarmo's PC: CI build of `d781a0e1` (run 39048820235), installed over 1.14.0 (exit
0), SHA-256 matching, Authenticode valid (Productory Services OÜ), a fresh profile. The build still reports 1.14.0,
as expected until 2.0's version bump. Screenshots stay on the Windows PC.

| Scenario | Result | Notes |
| --- | --- | --- |
| S7 No title row | Pass | Window buttons at full height from x=1304 of 1440; strip 43. |
| S8 The menu | Pass | The menu button opens File, Edit, View and Help with Ctrl shortcuts; arrows and Escape work. Alt alone focuses the menu button, and Enter or ↓ opens it (Windows' own rule, and 1.14's). The scenario said Alt opens it; reworded to this with the Development manager. |
| S9 The AI hidden | Pass | |
| S10 Snapping and dragging | Pass (Jarmo, by hand) | Jarmo checked it by hand on Windows with 2.0 on 18 October: snap layouts on the maximise button, dragging the strip to a screen edge, and double-clicking the strip. His result: "It worked fine." (relayed by the Development manager). |
| S11 No ⌘ on Windows | Pass | Ctrl everywhere. |
| S28–S30, S32, S33 | Pass | |
| S31 Ritemark's own terminals | Partial | See the merge 1 table. |
| S37 You | Pass | Settings (Ctrl+,) and Help. |
| S38 Ritemark's menus | Pass | |
| S46 The terminal shortcut | Pass | |

Findings, fixed on the merge-2 branch:

- **A terminal tab's menu offered "Move Terminal into Panel"**, a way back into the panel R8 removed (it showed on
  the Mac too), next to "Change Color…", "Change Icon…" and "Toggle Size to Content Width"
  ([`qa/w1-terminal-tab-menu.png`](qa/w1-terminal-tab-menu.png)). The tab's menu is now the usual tab items plus
  Rename…, as the Experience lead decided ([`qa/w1-terminal-tab-menu-after.png`](qa/w1-terminal-tab-menu-after.png));
  the four commands stay in the palette, and a terminal that reaches the panel still moves back onto the desk (019,
  `terminalMenus.ts`).
- **The View menu had "Run" (Ctrl+Shift+D) and "Chat" (Ctrl+Alt+I).** Run is the Run and Debug place, which a fresh
  profile counts as in use until the debugger settles; its View-menu entry is gone (003), as its top-level menu was
  already. Chat opened Copilot Chat in VS Code's bottom panel on the desk (found while checking it on the Mac:
  ⌃⌘I did the same), where 2.0 opens it as a tab from More. The View menu's entry is now "Copilot Chat" and, with
  Ctrl+Alt+I (⌃⌘I), opens the same tab as More, bringing an open one forward (007; 003 drops the panel view's own
  entry). Checked on the Mac: ⌃⌘I opens one "Chat" tab and a second press brings it forward; the panel stays shut
  (before: [`qa/w1-copilot-chat-panel-before.png`](qa/w1-copilot-chat-panel-before.png); after:
  [`qa/w1-copilot-chat-tab.png`](qa/w1-copilot-chat-tab.png)).
- **"Browser Ctrl+Alt+ä"** is VS Code's own shortcut for View → Browser (Ctrl+Alt+/), labelled with the key that types
  "/" on the Estonian layout. It is the same in 1.14; no change.
- **Help → Support asked "Do you want Ritemark to open the external website?"** on a fresh profile. `ritemark.app`
  and its subdomains are now trusted link domains (`linkProtectionTrustedDomains` in both product.json files);
  View License (github.com) still asks.
- **The terminal bar read "Terminal 2" while a command ran and "pwsh" when idle.** On Windows the shell type clears
  while another program runs in the shell; the bar now keeps the last shell name it saw (019,
  `ritemarkTerminalBar.ts`). The Mac keeps its name either way; Windows round 2 confirms the fix.

Still open from round 1: the View menu's Problems, Output and Debug Console entries (when those views exist) open
VS Code's bottom panel, as in 1.14.

## Windows round 2

Tested by the Windows session on Jarmo's PC on 18 October, as relayed by the Development manager:
- **Build:** CI build of main `f492948b` (run 39141563153). It includes merge 2 and #450, but not #451 or the closeout.
- **Install:** signed installer, a fresh test profile, 1440 × 900.

| Scenario | Result | Notes |
| --- | --- | --- |
| S7 No title row | Pass | The caption area starts at 1304 of 1440 and is 43 high. |
| S8 The menu | Pass, as reworded in round 1 | Alt alone focuses the menu button; Enter or ↓ opens it. This is Windows' own rule and 1.14's, accepted and reworded with the Development manager in round 1. |
| S9 The AI hidden | Pass | With the AI hidden, the + moves to 1182–1210, before the toggle, You and the caption buttons; the tabs end at 745. |
| S10 Snapping and dragging | Pass (Jarmo, by hand) | See round 1. |
| S11 No ⌘ on Windows | Pass | The strip's tooltips say Ctrl; no ⌘ anywhere. |
| S21 Copilot Chat not installed | Fail, fixed in the closeout | More doesn't list it. **Ctrl+Alt+I opened VS Code's own Chat in a bottom panel** ("Build with Agent", "Describe what to build", SESSIONS), twice. |
| S23 Pointing at a tab, revised | Pass | At rest only the chosen tab shows its ×. A pointed-at README.md shows its × at 109 of 135. The web page "Protocol Registries" keeps its site icon, with its × at 146 of 172. No width changes on hover. Changing the chosen tab moves widths by 1 (135 ↔ 134, 171 ↔ 172): the fold logic's half pixel, as on the Mac. |
| S37 You, an icon button | Pass | The toggle at 1230 and You at 1266, both 28, in one ink (97, 113, 135), with the hover fill (184, 184, 184, .31). You keeps the fill while its menu is open. Settings (Ctrl+,) opens Ritemark Settings; Help opens "Support \| Ritemark" in Edge. |
| S39 Every surface, both themes | Screenshots taken, review pending | Everything rendered in Light and Dark (26 screenshots). PDF, Word and PowerPoint pages stay white in Dark, as merge 2 designed (the canvas darkens, the pages don't). The Experience lead reviews the screenshots. |
| S42 Narrowing the window | Pass | Left, desk and AI widths, then You 10 before the caption area at every width (below). The AI's webview measured 328 at the 336 column: the 320 sheet and rail plus the 8 of ground after the rail, which lives inside the webview. The Mac measures the same (see the closeout). |
| S31 Ritemark's own terminals | Not reachable | Git and Node.js are installed on that PC, and Codex is bundled. Claude Login is never run there: it would sign Jarmo out. |

The S42 widths (left / desk / AI) at each window width:
- 1500: 256 / 844 / 400
- 1420: 256 / 764 / 400
- 1380: 256 / 788 / 336
- 1250: 256 / 658 / 336
- 1180: hidden / 844 / 336
- 1000: hidden / 664 / 336
- 950 and 900: the AI hidden

Round 1's fixes, confirmed:
- The terminal bar keeps "pwsh | Running | Stop" while a command runs.
- A terminal tab's menu has Rename and no "Move Terminal into Panel".
- View has no Run, and no Copilot Chat when it isn't installed.
- Help → Support opens with no external-site question.
- More on a fresh profile shows Search, File changes and Extensions.

#450, spot checks:
- After Use disk version, the tab is clean and the next autosave works.
- Transcribe's gear opens Settings at the ElevenLabs card.

Seen, not Sprint 132's to fix (drafts for issues in the closeout notes):
- A file conflict shows both VS Code's own "content is newer… Compare/Overwrite" toast and Ritemark's Review changes, two answers to one problem.
- The browser's "Share this page with the agent?" dialog blocks the tab row until it is answered. The prompt itself is deliberate since Sprint 67.
- Saving rewrites tight lists as "-   a" with blank lines: the known #270.

## Closeout

- **New Text and Table now go in the project (S24).** The + offers "Text: A new document in this project". The
  left column's New also has Text and Table. All four ran 1.x's `ritemark.newDocument` / `ritemark.newTable`, which
  always wrote "Untitled N.md/.csv" to `~/Documents/Ritemark/`, outside the project. On the Mac that folder already
  held Untitled 1–19 from earlier tests. The Development manager decided the rule on 18 October, since the + already
  promised it: with a project open, Text and Table make "Untitled.md" / "Untitled.csv", then "Untitled 2" and so on.
  The file goes in the folder chosen in the tree, else the project's root, never over an existing file, and opens as
  a tab. With no project open, it goes in the drafts folder as before.
  - The shell gives the tree's chosen folder by New File's own rule (018, `_ritemark.files.chosenFolder` in
    `fileCommands.ts`).
  - The extension names and places the file (`newDocumentLocation.ts`, with tests in `npm test`), and writes it
    with `wx` so it never replaces a file.
  - Checked on a fresh profile with the sample project, all four from the +:
    - Brief.md open, Text: `Untitled.md` at the root.
    - The Modules folder chosen in the tree, Table: `Modules/Untitled.csv`.
    - Module 1.md open, Text: `Modules/Untitled.md`.
    - Brief.md again, Text: `Untitled 2.md` at the root.
  - `~/Documents/Ritemark/` kept its 29 entries ([`qa/s24-new-in-project.png`](qa/s24-new-in-project.png)).
  - The left column's New runs the same two commands. The no-project case is covered by the tests only: a live run
    would write into the real drafts folder.
- **Ctrl+Alt+I without Copilot Chat (S21, Windows round 2).**
  - Why: Ritemark's binding (Ctrl+Alt+I, ⌃⌘I on the Mac, opening Copilot Chat as a tab) applied only while Copilot Chat was installed. Without it, VS Code's own two bindings on the same key took over (Open Chat and the Chat view) and opened VS Code's Chat in a bottom panel.
  - Found while reproducing on the Mac: a disabled Copilot Chat still counts as "installed" (the `chatSetupInstalled` key). So More listed Copilot Chat, and ⌃⌘I opened VS Code's own "Build with Agent" chat as a tab ([`qa/s21-ctrl-alt-i-before.png`](qa/s21-ctrl-alt-i-before.png)).
  - Fix (007): the shortcut is always Ritemark's, above VS Code's two, and does nothing unless Copilot Chat is usable (installed and not disabled). The View menu's entry and More's launcher use the same rule.
  - Checked in the dev build, with Copilot Chat disabled: More lists only Search, File changes and Extensions, and ⌃⌘I opens nothing, no tab and no panel.
  - With Copilot Chat enabled: More lists it, and ⌃⌘I opens one "Chat" tab, as before.
  - On Windows this is checked on the next build from main.
- **S42, the narrowed AI's width.** Windows measured the AI's webview at 328 in the 336 column. On the Mac, at 1500 and 1380:
  - The column measures 400 and 336; its webview 392 and 328.
  - In the pixels: 8 of ground, then the sheet and the rail to the + button's right edge, then 8 of ground.
  - The sheet and rail measure 384 and 320, the + ends 8 from the window's edge.
  - So the sheet is 320 as R14 says. The 8 after the rail lies inside the webview. No change.
- **E5 at merge 2 (`f492948b`), passed:**
  - A clean-room worktree (`.worktrees/release-f492948b9543`) passed the source gate: exact origin/main, a pristine VS Code at `10c8e557`, physical dependencies, empty output.
  - Preflight: 19 of 19 patches apply on vanilla 1.117.0. Its one warning was the extension symlink, which the build creates.
  - `build-prod` exit 0 (18:57–19:04), with both validations passed. The 8 agent runtimes are arm64, with the Codex package's SHA-256 verified.
  - Provenance written and verified twice: source and release ref `f492948b`, VS Code `10c8e557`, patch set `097b63fd…`, darwin-arm64, Node 22.22.1 arm64.
  - The newest changes are in the app (#450's commands, merge 2's You rule). No absolute symlinks. Not signed or notarized. The worktree was then removed on Jarmo's word.
- **E6 at merge 2:** 15 of 19 patches fail on 1.142.0, in 60 file patches ([`notes/drift.md`](notes/drift.md)).
- **Not done here:**
  - Jarmo's own Mac pass (S4, S5, S6, the native menu bar, Help, VoiceOver on You).
  - The Experience lead's review of round 2's S39 screenshots.
  - Closing #276, #430 and #199, which the Development manager posts with Jarmo's OK.
  - The two issues seen in round 2. Drafts are in the closeout notes; filing them is the Development manager's, with Jarmo's OK.
- **The Experience lead's review of Windows round 2:** S23 and S37 approved, and S39 approved but for three things:
  - **Toasts wrap (S39).** A toast without buttons (VS Code shows those collapsed) was cut to one line: "…If it does n…".
    - Its message now wraps to 3 lines and ends in an ellipsis. The row grows by 20 per line, measured by `notificationsViewer.ts` at the toast's own width (no expand toggle: a wrapped message doesn't overflow sideways).
    - The notification centre keeps one line, its full text behind the expand toggle.
    - Checked in the dev build with three "File not found" toasts (the editor's own message for a link to a missing file, sent from its webview):
      - a short one: 42, one line;
      - a long one: 82, three lines;
      - a longer one: 82, three lines ending "…word…" ([`qa/s39-toast-wraps.png`](qa/s39-toast-wraps.png)).
  - **The places' heads (S39).** Browser's column read "Browser: Recent", because its only view was named "Recent". The view is now named "Browser", so the column reads "Browser" ([`qa/s39-browser-title.png`](qa/s39-browser-title.png)). Tasks and Transcribe already read "Tasks" and "Transcribe". The project head on these places comes in step 3 (sprint-plan.md, 18 October).
  - **The narrowed AI's width (S42).** At 1280, against experience 9's drawing, mine on top ([`qa/s42-ai-1280-vs-drawing.png`](qa/s42-ai-1280-vs-drawing.png)):
    - The desk ends at 944 and the sheet starts at 952 in both.
    - The sheet and rail end 8 before the window's edge, 320 in all.
    - The drawing's rail buttons are 32 wide (the kit's `.rail .rl`) and the product's 40, so its sheet ends at about 1229 and ours at 1224. That's the rail, not the narrowing. Asked the Experience lead.
