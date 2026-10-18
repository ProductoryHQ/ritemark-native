# Sprint 134 Spec — The project at the centre

## Purpose

Ritemark 2.0's third step makes the project the place a person works in. Each project has its own Home, a page that says what waits for the person and what changed, and its own Tasks, both always first in the tab row. On Home the left column lists the person's projects, with what waits in each, and switching between them happens in the same window. The document's own bar says Saved and gathers the ways to send a copy under Share.

## Principles

- **The drawings are the contract.** Experience 3 (`ritemark-dev`: `product/design/experience/experiences/home/`), experience 29 (`empty/`), experience 32's frame 5 (`update/`) and the comparison's document bar. Where a drawing and this spec disagree, the drawing wins and this spec changes first.
- **The project is the place** (principle 1). Projects by name, never by path; where a project lives is one muted line.
- **What needs the person comes first** (principle 4). The same number for the same thing everywhere: the projects list, Home, the Tasks tab and the Tasks place.
- **The folder holds what the person owns, the computer holds the rest.** The project's name, mark, cover and line travel with the folder; the list of projects and what Ritemark knows about them stay on this computer (as the task board does, `architecture.md`).
- **Nothing leaves the computer.** The list is filled from what is already on it.
- **Nothing is lost** (HARD RULE #1). Everything 1.x's Home launcher and Export menu do keeps a home.

## Requirements

### R1: The project file

As a writer, I want my project's name, picture and line to travel with the folder.

Acceptance criteria:
- A project's own details live in `.ritemark/project.json` in the folder: its name, its mark (initials by default), its cover image and its line.
- The file is written only when the person changes something. Until then the folder's name, initials from it and Ritemark's default cover are used, and no file is written.
- A changed cover is copied into `.ritemark/` and referred to from the file by name, so it travels with the folder.
- A file that cannot be read (bad JSON, an unknown version) is never overwritten: Ritemark uses the defaults, keeps the file as it is, and says so once on Home.
- Unknown keys are kept when the file is written.
- A folder that cannot be written (read-only, a synced folder that refuses writes) keeps working with the defaults, and Home says why a change could not be saved.

### R2: The project list

As a writer with several projects, I want them all listed, from the first day of 2.0.

Acceptance criteria:
- Ritemark keeps its own list of projects on this computer. A folder is added whenever a window opens it.
- On the first start of this build, the list is filled once from what is already on the computer: VS Code's recent folders, every project that has chats in Ritemark's chat store, and every project that has a task board record (decided by engineering, 17 October).
- A project whose folder is missing or moved stays in the list, shown as missing, with Find it… (pick its new place) and Remove from the list. It is never dropped silently.
- Remove from the list removes it from the list only; its folder, chats and board are untouched.
- The list is ordered by when each project was last open, the open project first.
- The list never contains a path the person did not open in Ritemark, and nothing in it leaves the computer.
- The list replaces the proof of concept's use of VS Code's internal recent-folders command for everything after the first fill.

### R3: What waits, in each project and across them

As a writer, I want to see what needs me, here and in my other projects.

Acceptance criteria:
- For each project, what waits is the sum of:
  - chats that need the person: a question or an approval waiting in a chat of that project (from the chat store);
  - tasks that wait on the person: the board's Your calls (from that project's board).
- The project's total shows in the projects list, in the switcher and in Home's Waiting for you. The board's part of it is the number the Tasks place shows today, and the Tasks tab shows the same (R6).
- A task counts exactly as the board counts it today (its four kinds of call: needs you, a decision, a review, failed), from the same rules, including what only this computer's hand-off records know.
- Other projects' counts are read without opening them: from their card files, this computer's hand-off records and the chat store.
- Counts update when a board or a chat changes in the open project at once, and for other projects when Home or the switcher is shown.
- A project whose board cannot be read shows no count rather than a wrong one.

### R4: Home, the project's own page

As a writer, I want my project's own page to start from.

Acceptance criteria:
- Home is a Ritemark page in the shared React bundle, built from the UI components (experience 3, frame 1):
  - the cover image, Ritemark's illustration by default, with Change image;
  - the project's mark and name, not the word Home;
  - the folder it works in, as one muted line, which opens Documents when clicked;
  - the project's line, which the person can edit in place;
  - **Waiting for you**, with its count, listing what waits (a card's call or a chat's question), each opening where it waits;
  - one line for what waits in the other projects, which are counted in the list;
  - **Start something in <project>**: Text, Table and Web page, as the + offers (experience 2, frame 4; experience 29, frame 1);
  - **Last changed in <project>**: the documents changed last, each with its folder and when, each opening the document.
- Project names, card titles, chat names and file names are shown as text, never as markup.
- Home redraws when the board's calls, the chats' states or the project's files change, without losing its scroll or focus.
- An empty project's Home says it is empty for now, offers the three starts and a place to drop files (experience 29, frame 1). Dropped files are copied in; the originals stay where they are.
- Home works with the keyboard and VoiceOver, and in Light and Dark.

### R5: Home and Tasks, always the first two tabs

As a writer, I want my project's own tabs always first and always there (Jarmo, 16 October).

Acceptance criteria:
- Every project window has Home and the Task board as its first two tabs, pinned and drawn as icons, using Sprint 132's rule (R9 there): they cannot be closed, unpinned or moved, and Close all leaves exactly these two.
- After the window restores its tabs, Ritemark opens whichever of the two is missing, pins it, puts Home first, and returns to the tab the person was on.
- A fresh project window opens on Home.
- A click on the Home place always brings Home's tab forward, as the Tasks place does for the board (Jarmo, 17 October: "when I click Tasks, the board ALWAYS opens too").
- Anything that opens Home or the board brings the pinned tab forward instead of making a second one.
- With the `task-board` flag off, the Tasks tab is not added and Home stays first alone.

### R6: The Tasks tab carries the count

As a writer, I want the Tasks tab to tell me something waits (Jarmo, 16 October).

Acceptance criteria:
- The Tasks tab shows the same count as the Tasks place (the board's calls), drawn the same way at the icon's lower right, up to "99+".
- No count shows when nothing waits.
- The tab's tooltip and accessible name say the count in words ("Tasks, 1 waits for you").

### R7: On Home, the left column holds the projects

As a writer, I want to choose a project where I choose everything else: on Home.

Acceptance criteria:
- With Home chosen in the places row, the left column shows (experience 3, frame 1):
  - Search all projects, on the head's line, which filters the list by name as the person types;
  - Projects: each project by its mark and name, with what waits in it as a muted count, the open one as the column's white row;
  - Add a project…, which offers Open a folder… and Start a new project (as on the welcome).
- A click on a project switches to it in place (R9). ⌥ click (Alt click on Windows) opens it in a new window.
- A missing project is drawn muted with "Missing" and offers Find it… and Remove from the list (R2).
- This list replaces 1.x's Home launcher in the left column. What the launcher did keeps a home (R14).

### R8: The left column's head, filled

As a writer, I want my project's name to be where I switch and manage it.

Acceptance criteria:
- On Documents and the other places, the head shows the project's mark and name (Sprint 132 R10). Its menu holds, in order (experience 3, frames 2 and 4):
  - Switch project ▸, listing the projects with what waits in each ("1 waits"), the open one ticked, then All projects, on Home, and Open in a new window (⌥ click);
  - Open a folder…;
  - Reveal in Finder (Reveal in File Explorer on Windows);
  - About this project, which opens the project's About this project file, or offers to create it.
- New and Search keep Sprint 132's behaviour.
- The menu's words and entries come from the extension (Sprint 132's `ritemark/projectHead` menus).
- On Windows, the menu button's File menu gains Switch project, where experiences/windows frame 2 draws it.

### R9: Switching projects in place

As a writer, I want to move between projects in the same window and find each as I left it.

Acceptance criteria:
- Switching opens the next project in the same window. The window reloads, as VS Code does when the folder changes (the release plan: its API offers no way around it).
- While it reloads, the window shows the ground's colour, in Light and in Dark, not a dark block.
- The next project opens on its Home, and keeps its own tabs: coming back to a project brings its tabs back as they were.
- When the AI is working in the project being left (a turn running, a card's task running, a flow running), Ritemark says so before switching and offers to switch anyway or stay. Switching stops that work, as closing the window does today.
- After switching, a short note says the other project is kept as it was left, with Go back (experience 3, frame 3), if the Experience lead keeps it.
- Open in a new window, and ⌥ click, open the project in a new window instead and leave this one as it is.

### R10: The welcome lands on Home

As someone who just finished the welcome, I want to land on my project's Home.

Acceptance criteria:
- The welcome's landing (Sprint 133 R6) opens Home first, with the AI's sheet beside it as before.
- The update welcome's "Open when you left" restores the window's own tabs, with Home and Tasks added first if missing.

### R11: What moved, once

As someone updating from Ritemark 1, I want to know where three habits went, once.

Acceptance criteria:
- On a profile that used Ritemark 1, Home shows a card once, under the project's folder line (experience 32, frame 5): the terminal is a tab (a new one comes from the +); Copilot Chat is in More and opens as a tab; Settings and Help are under You, and ⌘, (Ctrl+, on Windows) opens Settings.
- Got it closes it for good, on this profile. A fresh profile never sees it.
- The card shows on whichever project's Home the person sees first after updating.

### R12: The document's bar: Saved and Share

As a writer, I want to see that my document is saved, and find the ways to send a copy in one place.

Acceptance criteria:
- The document's bar shows Saved when the document on disk matches the editor, from the sync state the host already sends. It shows nothing while a save is in progress for less than a moment, and the save-problem actions (Review changes, Retry) in Saved's place when a save fails (as today).
- Export becomes Share, with the same items in the same groups: Export PDF, Export Word, Google Docs (connect, create, sync, open, unlink, reconnect) and Copy as Markdown (comparison inventory, "Moved, renamed").
- Every item works as it does today.

### R13: Missing, empty and boardless projects

As a writer, I want Ritemark to say plainly when a project is not as expected.

Acceptance criteria:
- A missing or moved folder: in the projects list and the switcher it is muted and marked Missing; choosing it offers Find it… and Remove from the list; it never opens an empty window.
- An empty project: Home as R4 says.
- A project with no task board yet: the Tasks tab opens the board's empty state (experience 29, frame 2); no board file is written until the person adds a card.
- With the `task-board` flag off: no Tasks tab, no task counts; chats still count.

### R14: Nothing v1.14.0 does is lost

As someone who used Ritemark 1.14, I want every function of Home and the Export menu to still be there.

Acceptance criteria:
- Every function of 1.x's Home launcher works from 2.0's Home or beside it:

  | 1.x Home launcher | 2.0 |
  |---|---|
  | New document | Home's Start something: Text; the + |
  | New table | Home's Start something: Table; the + |
  | New AI conversation | The AI sheet's New chat, beside Home |
  | Recent work | Home's Last changed in <project> |
  | Task board | The Tasks tab, second in the row; Home's Waiting for you |
  | Open a file or folder | Add a project…; the head's Open a folder… |
  | Recent folders (with no folder open) | The projects list |

- The Export menu's every item works from Share (R12).
- 1.x's Home view (`ritemark.homeView`) and its tests are replaced only once every row above is checked.

### R15: Windows

As a writer on Windows, I want Home, the projects and switching to work the same way.

Acceptance criteria:
- Home, the projects list, the head's menu, switching, Alt click, Reveal in File Explorer and the document's bar work on a Windows PC, with Windows paths and Ctrl in every shortcut.
- Projects on other drives and on network paths are listed and opened; a disconnected drive shows the project as missing (R13).

## Engineering requirements

### E1: The project list is one module

- One module owns the project list (storage, the first fill, adding, removing, missing folders, ordering), with no `vscode` import in its rules, unit tested.
- One module reads a project's file (R1) and one computes what waits (R3), both unit tested, both reused by Home, the projects list, the switcher and the Tasks tab.
- The task board's rules (`BoardController`) compute another project's Your calls; nothing re-implements them.

### E2: Home in the shared bundle

- Home and the projects list are React in `webview/src`, built from the UI components. No HTML built from strings, no `innerHTML`.
- New webview ↔ host messages are typed in one protocol file.

### E3: Tests

- Extension unit tests: the project file, the list (first fill, add, remove, missing, order), what waits (counts from fixtures of boards and chats), the permanent tabs' restore order, the switch guard.
- Webview unit tests for Home's states (full, empty, missing, no board) and for escaping.
- CDP checks on a dev instance: Home and Tasks first, Close all, the count on the Tasks tab, switching both ways with tabs restored.
- The screenshot baseline gains Home, the projects list and the switcher, light and dark.

### E4: The bundle (#107)

- `media/webview.js` is measured before and after; the default cover is an image file, not inlined.

### E5: Builds and Windows

- Merging into main is followed by a production build from a clean-room worktree at the merged commit and a Windows build from main. Before the merge, the extension side is tried on Windows through the test overlay.
- All patches apply on the pinned VS Code; the stacking check passes.

### E6: Docs

- `architecture.md`: a Projects subsystem section (the project file, the list, what waits, Home, switching), the 1.x Home launcher's replacement, the version-history row.
- `references/layout-invariants.md`: Home and Tasks opened by default; on Home the left column holds the projects.

### E7: Drift is measured

- At the merge, the stack is dry-applied on the newest VS Code release and the release plan's risk register updated.

## Non-Requirements

- **Search across projects.** Search all projects filters the list by name (release plan, Not in 2.0).
- **Switching without a reload.** It would mean rebuilding how VS Code runs extensions.
- **Sub-projects inside one big folder** (experience 3, open question 1).
- **Recent documents across projects** on Home (experience 3, open question 2).
- **Picking an icon or picture as a project's mark.** Marks are initials in ink.
- **About this project written by Claude** (experience 24).
- **A VS Code update.** The pin stays at 1.117.0.

## Resolved Questions

- **2026-10-15 (Jarmo):** Home states the project's name, with a header image the person can change; the first window after the welcome is Home; chats are kept privately on this computer, never in the project's folder.
- **2026-10-16 (Jarmo):** Home and Tasks pinned permanently as the first two tabs, icons only; "yes, yes, yes" to the projects list on Home, the count on the Tasks tab, and sending it to the Development manager.
- **2026-10-17 (Jarmo):** "when I click Tasks, the board ALWAYS opens too"; the Home tab comes in step 3 ("ok").
- **2026-10-17 (engineering, on Jarmo's "You decide"):** the project list fills on the first 2.0 start from recent folders, chats and task boards.
- **Release plan:** the reload stays; the splash takes the ground's colour; switching asks first when the AI is working; ⌥ click opens a new window.

## Open Questions

Each has a recommendation; Jarmo answers at this plan's approval.

1. **Home's Start something row for a project with content.** Experience 3's frame 1 has none; welcome frame 4 and experience 29 have it. HARD RULE #1 needs 1.x's New document reachable from Home. **Recommendation:** always show it, under Waiting for you. Asked of the Experience lead.
2. **What counts as "waits" in a chat.** **Recommendation:** a question or an approval the AI is waiting on; a finished turn the person has not read does not count (it is the chat rail's dot, not a call).
3. **The Go back note after a switch** (experience 3, frame 3). **Recommendation:** keep it, for a few seconds, if the Experience lead keeps it in the drawing.
4. **Removing 1.x's Home view** (`ritemark.homeView`, the `home-launcher` flag). **Recommendation:** the projects list takes its container and place; the old view's code is deleted only after R14's table is checked, and the `home-launcher` flag is set to disabled with a tombstone, as `CLAUDE.md`'s flag rule asks.

Design questions sent to the Experience lead on 18 October: Home's Start something row; the drawings for an empty project, a missing folder and a project with no board; What moved arriving with Home; the Go back note and the words when the AI is working in the project being left; the document's bar with Saved and Share.
