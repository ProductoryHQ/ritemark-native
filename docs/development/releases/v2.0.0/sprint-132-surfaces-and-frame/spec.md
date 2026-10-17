# Sprint 132 Spec — Surfaces and frame, theme first

## Purpose

Ritemark 2.0's first step changes how the window looks and is organised:
- a flat ground with no lines between the parts;
- the AI on its own sheet;
- the documents on a raised desk, with their tabs at the top of the window;
- one top line shared by the Mac and Windows.

The terminal becomes a kind of tab and Copilot Chat moves behind More, so that the AI column holds only Ritemark's AI. Everything Ritemark 1.14 can do stays reachable.

## Principles

- **One frame for both computers.** Windows follows the Mac as closely as it can (Jarmo, 17 October: "try to mimic as much apple as possible"). The only differences are each system's own window buttons, menu and shortcut words.
- **Nothing is lost.** Every function in the before-and-after inventory keeps a place (`ritemark-dev`: `product/design/experience/comparison/README.md`).
- **The drawings are the contract.** Numbers come from the canon (`surfaces/README.md`, "Measurements"; `framework.md`), and the drawings decide where they disagree with the proof of concept.
- **Every colour comes from the theme.** Ritemark Light and Ritemark Dark follow the same rules.
- **Patches own one thing each.** The new patches own sizes and drawing, and patch 002 keeps what sits where.

## Requirements

### R1: The frame on the Mac

As a writer on a Mac, I want one calm window with no title row, so the documents and the AI get the room.

Acceptance criteria:
- There is no title row. Each column has a 44 strip at its top:
  - over the left column, the traffic lights and the left column's toggle;
  - over the desk, the tabs;
  - over the AI, the AI's toggle and You.
- Everything in the strip sits on one line, 26 from the top: the traffic lights, both toggles, You and every tab label. Measured in the running window.
- The ground is flat. The desk is a raised sheet with radius 10, a hairline and a soft shadow, and the chosen tab joins it with concave fillets. The AI's sheet sits between them.
- Gaps of 8 between the left column, the desk, the AI's sheet and the window's edges. Both sheets end 8 above the status bar.
- Two desks lie 8 apart, each with its own tabs in its strip.
- When a side column is hidden, its controls move onto the desk's strip, each in a space of its own, and the tabs start after them. The desk still sits 8 from the window's edges.
- The strip drags the window. A double-click on its empty part does what the system setting says (zoom or minimise). The controls in it are not drag regions.
- The traffic lights sit on the centre line on a fresh start, after a restart, in full screen and out of it. macOS sheets (dialogs) hang from 44.
- The status bar is 24, with the bell at the right and no remote or problems signals. Rows in the document tree are 32.

### R2: The frame on Windows

As a writer on Windows, I want the same window as on the Mac, with Windows' own buttons and menu where Windows hands expect them.

Acceptance criteria:
- There is no title row; the strips are as in R1.
- The menu sits behind a button at the start of the left column's strip, where the Mac has its traffic lights, followed by the left column's toggle.
- The button opens File, Edit, View and Help, with the same items as today's menu bar. Alt opens it from the keyboard, and the arrow keys move through it.
- Minimise, maximise and close sit at full height at the right end of the AI's strip, after the AI's toggle and You. When the AI is hidden they sit at the right end of the desk's strip, and the tabs and the + stop before them.
- Hovering maximise shows Windows' snap layouts. Dragging the strip moves the window, and a double-click on it maximises and restores.
- Every tooltip and menu shows Ctrl, never ⌘.
- It is seen working on a Windows PC from a build of main.

### R3: Zoom

As a writer who zooms the window, I want the documents to grow while the top line stays put.

Acceptance criteria:
- At every zoom level between the smallest and the largest:
  - the strips keep their height and their centre line;
  - the traffic lights (Mac) and the window buttons (Windows) stay on that line;
  - the documents, the tree and the AI's sheet zoom.
- After a zoom, a restart keeps the line.

### R4: The AI column holds only Ritemark's AI

As a writer, I want the AI's sheet to be only the AI, so I never lose it behind something else.

Acceptance criteria:
- The AI's sheet has no VS Code title rows and no row of icons. Its own header and the chat rail draw it.
- No other view opens in the AI column: not the terminal (R8), not Copilot Chat (R6), and not a view a person drags there.
- A view a v1.14.0 profile had put in that column moves to the left column on the first 2.0 start (R16).
- The AI's webview follows its sheet when the window or the column changes size.

### R5: The places row and More

As a writer, I want Ritemark's places in one row at the top of the left column, and the rest one click away.

Acceptance criteria:
- The row is at the top of the left column and shows Ritemark's six places first: Home, Documents, Tasks, Browser, Agents, Transcribe (Jarmo, 16 October). The other places follow in their own order.
- The places are 32 × 32 with radius 6, and the chosen place has the soft fill. The first icon's edge is on the column's text edge.
- ⋯ sits at the end of the row. It holds the places that do not fit, in their order, and Copilot Chat (R6). It opens Ritemark's menu.
- Clicking Tasks always brings the Task board tab forward, as main's [#431](https://github.com/ProductoryHQ/ritemark-native/pull/431) does today.
- A place can be dragged to another spot in the row, and the order is kept.

### R6: Copilot Chat behind More, as a tab

As someone who uses GitHub Copilot Chat, I want it to stay reachable without taking the AI's column.

Acceptance criteria:
- With Copilot Chat installed, More lists Copilot Chat.
- Choosing it opens Copilot Chat as a tab on the desk, never in the AI column.
- Without Copilot Chat, nothing about it shows, as today.
- A v1.14.0 profile that had Copilot Chat in the AI column finds it in More and opens it as a tab.

### R7: The tab row

As a writer with many documents, I want tabs I can read, and a way to make a new one where the tabs are.

Acceptance criteria:
- The tabs sit in the desk's strip, 36 high, each as wide as its whole name, up to 200 (no floor: the proof of concept, the Experience lead's review of 17 October). The gaps between names are equal.
- Pointing at a tab shows its own shape in the frame's soft fill, and its close button takes the icon's place, so nothing moves.
- The tab's tooltip shows the path inside the project, never the system path.
- The + sits at the right end of the tab row, 18 in from the desk's edge. It opens Ritemark's menu leftward over the desk: Text, Table (CSV data), Web page, Terminal.
- When the row is full, the tabs used longest ago fold into "N ⌄" before the +; Home, Tasks and the open document never fold.
  - "N ⌄" lists the folded tabs, most recent first, each with its folder and a close button, then "Close these N tabs".
  - Picking one brings it back in its place, and the tab used longest ago in the row folds instead.
  - The row never scrolls sideways unless it is too narrow for the open tab itself.
- Each desk folds on its own.
- The +'s menu and "N ⌄" close on a click anywhere outside them, inside a webview too.

### R8: The terminal is a tab

As someone who uses the terminal, I want it as a tab on the desk, like any other document (Jarmo, 17 October: "Terminal must be one type of tab").

Acceptance criteria:
- The +'s Terminal opens a terminal tab in the project's folder, named "Terminal", then "Terminal 2" and so on.
- Every terminal opens as a tab: those Ritemark opens itself (Claude Login, Install Git, Install Node.js, Install Codex, Codex Repair) and the shortcut.
- A running command shows a Running chip and Stop in the terminal's bar. Stop interrupts the command.
- A terminal working behind other tabs carries the chat rail's working dot on its tab.
- No terminal opens by itself at start.
- Terminal tabs come back as tabs after a restart. Terminals a v1.14.0 profile had in the AI column come back as tabs too (R16).
- A terminal never opens in the AI column.

**R8 (revised 2026-10-17, before Phase 0).** The keyboard and the View menu:
- Ctrl+` (⌃` on the Mac) opens a new terminal tab in the project's folder. It does not toggle a panel.
- The View menu gets no Terminal entry. The + is where a terminal is made.
- Why: patch 002 removes VS Code's Toggle Terminal shortcut and its View-menu entry today. Sending that file wholly back to upstream would bring back both, as a toggle for a bottom panel that 2.0 does not use. Found by the Development manager's planning session on 17 October.

### R9: Home and Tasks keep the front of the row

As a writer, I want the project's own tabs always first and always there.

Acceptance criteria:
- A pinned Home or Task board tab cannot be closed, unpinned or moved to another group, by a person or by a command. No other tab moves in front of them.
- "Close all" and "Close others" leave them.
- In this sprint the rule applies to a pinned Task board tab. Step 3 opens and pins Home and Tasks by default.
- Only the extension can dispose them.

### R10: The left column's head

As a writer, I want the left column to start with my project and the things I do with its files.

Acceptance criteria:
- On Documents, the head shows:
  - the project's name in full, with a chevron;
  - New and Search as rows;
  - Documents over the tree.
- The positions follow the drawing's measurements (New at 136, Search at 168, Documents at 214, the tree from 236).
- The chevron's menu holds project things only: Switch project…, Open a folder, Reveal in Finder (Reveal in File Explorer on Windows) and the folder tools. All commands stays on ⇧⌘P and in the View menu (the Experience lead's review, 17 October).
- New lists every kind of new file Ritemark can make today. Search opens the search across files.
- Ritemark's own `.ritemark` folder is out of the tree.
- The words and menu entries come from the extension, so an extension change can change them.
- Other places keep their own simple head.

### R11: You

As a writer, I want my menu in one quiet place.

Acceptance criteria:
- You is an outline circle at the AI toggle's weight, at the right end of the AI's strip (before the window buttons on Windows). The new-chat + is the corner's only filled shape.
- Its menu holds Settings, which opens Ritemark's own settings page, and Help, which opens https://ritemark.app/en/support/.
- ⌘, (Ctrl+, on Windows) opens Ritemark's own settings page, and Settings shows it (Jarmo, 17 October).
- It works with the mouse, Enter and Space, and VoiceOver and Narrator announce it as a menu button.

### R12: Ritemark's menus

As a writer, I want menus that look like Ritemark on both computers.

Acceptance criteria:
- Context menus and drop-down menus are Ritemark's own on the Mac and on Windows:
  - a white sheet with radius 10 and padding 6;
  - rows 32 with radius 6;
  - the chosen row in the theme's soft indigo.
- The macOS menu bar stays native.

### R13: The theme pass, light and dark

As a writer, I want every part of Ritemark to belong to the same calm frame, in light and in dark.

Acceptance criteria:
- Ritemark Light and Ritemark Dark set:
  - the ground, the AI's sheet and the desk from the seven `ritemark.*` surface colours;
  - no lines between parts;
  - no indigo line on tabs.
- High contrast keeps every control visible and every border readable.
- The window's chrome uses Phosphor icons through the product icon theme, with 50 icons. The file icons have a light and a dark colour each.
- Every surface matches its drawing in both themes:
  - the Markdown editor, CSV, the PDF, Word and PowerPoint previews, the browser, the task board, Transcribe;
  - the Settings page, notifications, the command palette and quick picks;
  - modal dialogs, Flows and the Agent Library once their drawings arrive.
- Webviews take the desk's colour from the theme, not from their own copy.
- Text on the ground and the fine print meet 4.5:1.

### R14: Window sizes

As a writer on a smaller screen, I want the window to make room for the document by itself. This is the simple part of `framework.md`'s window sizes, recommended on 17 October; Jarmo confirms it with this plan.

Acceptance criteria:
- At 1400 points wide and above, all three levels are at full width.
- Below 1400, the AI's sheet narrows to 320.
- Below 1200, the left column hides itself. Below 960, the AI's sheet hides itself too.
- Each column's toggle brings it back and takes room as today. A column a person opened stays open until the window crosses that width again.
- The document column never drops below 560 with one desk.
- The columns coming over the desk are not in this sprint.

### R15: Nothing v1.14.0 does is lost

As a writer who used Ritemark 1.14, I want every function I know to still be there.

Acceptance criteria:
- Every row of the before-and-after inventory (`comparison/README.md`, "Every function, today and now") is checked against the build at each merge. Its home is one of:
  - its 2.0 place, for the parts this sprint builds;
  - its 1.14 place, for the parts later steps move (the document's bar, the welcome, Home);
  - the three "Left out" rows the inventory names (the file list's Refresh, the breadcrumb, the remote and problems signals).
- Functions whose 1.14 place this sprint removes keep a reachable home: the settings gear, the accounts entry, Report AI output, Send feedback, the updates actions, the terminal beside the AI, Copilot Chat's place in the row.

### R16: A v1.14.0 profile opens in the new frame

As a writer updating from 1.14, I want my window to move into 2.0 without losing anything.

Acceptance criteria:
- On the first start with this sprint, a v1.14.0 profile shows the new frame:
  - the places row on top in R5's order;
  - the AI column with only the AI;
  - terminals back as tabs;
  - Copilot Chat in More;
  - any other view from the AI column in the left column.
- Settings the person chose keep winning, for example their own theme.
- Each move happens once. After that, the person's own placement is kept.

## Engineering requirements

### E1: The patches fold

- The surfaces and frame live in a new patch, `018-ritemark-surfaces.patch`, and the tab row in another, `019-ritemark-tab-row.patch`.
- No hunk in 018 or 019 removes, or uses as context, a line another patch wrote.
- Patch 002's size lines (tab height, row height, the places bar's height) move into the new patches. Its terminal guards are removed from 002 itself, not overridden; in `terminal.contribution.ts`, 002 keeps its removal of the Toggle Terminal shortcut and View-menu entry (R8, revised). The 2.0 order of the places and the layout toggle's condition go into 002's own lines.
- Patch 007's Copilot Chat launcher changes in 007.
- A script checks the rule, with today's known stacked pairs listed (009 → 010, 001 → 016 → 017).
- `PATCH-RULES.md` §8: 002's file list is counted and diffed before and after.

### E2: What the proof of concept leaves behind

- Nothing from the proof-of-concept branch merges as it is, including its patch name and header.
- Code that only served the proof of concept is dropped (`feasibility.md` §6).
- The editor's walks up the DOM are replaced where VS Code gives the same information.

### E3: Tests

- VS Code unit tests for R9's rule and for the terminal's location (R8), run with VS Code's test runner.
- Extension unit tests for every extension module the sprint adds or changes.
- CDP geometry checks for R1's and R7's numbers, on the Mac.
- A screenshot comparison of the base window in light and dark, which becomes the baseline for later steps and for VS Code updates.

### E4: Docs

- `references/layout-invariants.md`: the changed and the new rules, each with what enforces it.
- `architecture.md`: the locked decision on layout ownership (patches 002 and 018/019).
- `CLAUDE.md`'s patch table and count.
- `PATCH-RULES.md`'s patch table.
- `update-vscode.sh`'s checklist, with the screenshot check.

### E5: Builds

- Each merge into main is followed by a production build from a clean-room worktree at that commit (a build check, not a release) and by a Windows build from main.
- All patches apply on the pinned VS Code, and a second run of `apply-patches.sh` is clean.

### E6: Drift is measured

- At each merge, the whole stack is dry-applied on the newest VS Code release, and the failing files are recorded in the release plan. The VS Code update sprint then starts from known numbers.

## Non-Requirements

- **The welcome (step 2):** sign-in, set up project, the usage-data choice and the four events.
- **The project at the centre (step 3):** the project file and list, Home as the project's page, the projects list in the left column, the project's mark and Switch project in the head, switching in place, the document's bar with Saved and Share, and pinning Home and Tasks by default.
- **The columns coming over the desk** in narrow windows.
- **A VS Code update.** The pin stays at 1.117.0 in this sprint; the update is its own sprint after step 3 (release plan).
- **Changes to the AI's message box and model picker** in the before-and-after drawings, beyond what the proof of concept already draws.
- **A switch between 1.x and 2.0** (Jarmo, 17 October: "We will focus on 2.0 from now on").

## Resolved Questions

- **2026-10-15 (Jarmo):** 2.0 ships the theme, the welcome and the project together; the theme comes first; patching VS Code is fine.
- **2026-10-16 (Jarmo):** the places order (Home, Documents, Tasks, Browser, Agents, Transcribe); every place stays in the row, and what does not fit folds; tabs fold instead of scrolling.
- **2026-10-17 (Jarmo):**
  - "We will focus on 2.0 from now on": no switch, and no releases from main until 2.0.
  - "Terminal must be one type of tab."
  - Windows "mimic as much apple as possible".
  - More holds what does not fit, and Copilot Chat goes behind it.
  - You holds only Settings and Help.
  - Ritemark's menus on the Mac too.
- **2026-10-17 (engineering, on Jarmo's "You decide"):**
  - 018 and 019 own sizes and drawing, and 002 keeps placement.
  - Windows rounds are built from main.
  - Copilot Chat opens as a tab.
  - The VS Code pin stays for steps 1–3 and is updated once, in its own sprint, before step 4 (release plan, Risks and Blockers).

## Open Questions

- **The drawings for modal dialogs, Flows and the Agent Library** are the Experience lead's next work. R13 waits for them for those three surfaces only.
- **The Windows menu's last item:** Exit or Close window? It is drawn as Exit, the Windows word. Exit unless Jarmo says otherwise.
