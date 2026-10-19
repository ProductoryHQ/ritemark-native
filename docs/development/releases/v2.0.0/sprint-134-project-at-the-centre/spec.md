# Sprint 134 Spec — The project at the centre

## Purpose

Ritemark 2.0's third step makes the project the place a person works in. Each project has its own Home, a page that says what waits for the person and what changed, and its own Tasks, both always first in the tab row. On Home the left column lists the person's projects, with what waits in each, and switching between them happens in the same window. The document's own bar says Saved and gathers the ways to send a copy under Share.

Refreshed on 18 October 2026 with what Sprint 132 handed to step 3 (R16–R19, and changes to R2, R8 and R13), and with the gaps the [v1.14 parity list](../parity-v1.14.md) gives this step.

Updated on 19 October 2026 with Jarmo's decisions of that day (R20–R24) and the Experience lead's answers to the refresh's design questions (R16, R19), and at the plan's approval the same day with Jarmo's answers to its open questions (R3: unread replies count).

## Principles

- **The drawings are the contract.** Experience 3 (`ritemark-dev`: `product/design/experience/experiences/home/`), experience 29 (`empty/`), experience 32's frame 5 (`update/`), experience 33 (`missing/`), experience 26's frame 1 (`share/`), experience 28's frame 1 (`web/`) and the comparison's document bar (`comparison/after-write.png`). Where a drawing and this spec disagree, the drawing wins and this spec changes first.
- **People's names for things.** ChatGPT, never Codex, wherever a person reads the AI's name (R22). The welcome already follows this (Sprint 133).
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
- On the first start of this build, the list is filled once from what is already on the computer: VS Code's recent folders, every project that has chats in Ritemark's chat store, and every task board in those folders (decided by engineering, 17 October; the [first-fill audit](research/first-fill-audit.md)):
  - a board's records on this computer name no folder, so a board in a folder neither source knows joins the list when it is next opened;
  - only folders that are there at the time are added. A recent folder that has since gone is not known to be a project, and adding it would open 2.0 with rows marked Not found;
  - single folders only, on this computer or a network share. Workspace files (`.code-workspace`) and remote folders are left out.
- A project whose folder is not found (moved, renamed, deleted, or on a drive that is not connected) stays in the list, shown as Not found (R13), with Find it… and Remove from the list. It is never dropped silently. Folders are checked when Home shows and when the window gains focus.
- Remove from the list removes it from the list only; its folder, chats and board are untouched.
- The list is ordered by when each project was last open, the open project first.
- The list never contains a path the person did not open in Ritemark, and nothing in it leaves the computer.
- The list replaces the proof of concept's use of VS Code's internal recent-folders command for everything after the first fill.
- The welcome's project lists read this list too: the update sheet's projects and the "Where do you want to start?" sheet. In Sprint 133 they read VS Code's recent folders, until this list exists (Sprint 133's technical plan, W6).

### R3: What waits, in each project and across them

As a writer, I want to see what needs me, here and in my other projects.

Acceptance criteria:
- For each project, what waits is the sum of:
  - chats that need the person (from the chat store; Jarmo, 19 October):
    - a question or an approval the AI is waiting on in a chat of that project;
    - a reply the person has not read: the AI finished it after the person last had that chat in front on the AI's sheet;
  - tasks that wait on the person: the board's Your calls (from that project's board).
- A reply is read once its chat is in front on the AI's sheet while the sheet is shown. A reply that finishes while its chat is in front and shown is read at once.
- A chat that a card runs in is counted through the card's call only, never twice.
- A question or an approval counts only while a window holds its chat, so a crash leaves no count behind. An unread reply counts until it is read, after a restart too.
- Chats from before this build count as read, so the first 2.0 start shows no backlog.
- The chat store has no read marker today. It gains one, kept in the record and in its index, so another project's unread replies are counted without opening that project.
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
  - **Waiting for you**, with its count, listing what waits (a card's call, a chat's question or approval, or a chat's reply not yet read), each opening where it waits;
  - one line for what waits in the other projects, which are counted in the list;
  - **Start something in <project>**: Text, Table and Web page, as the + offers, on every Home, under Waiting for you and above Last changed (experience 2, frame 4; experience 29, frame 1; the Experience lead, 18 October);
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
- A project whose folder is not found keeps its place: its row is muted, with a warning-circle and Not found at the right and the old path in its tooltip. Clicking it does not switch (R13).
- This list replaces 1.x's Home launcher in the left column. What the launcher did keeps a home (R14).

### R8: The left column's head, filled

As a writer, I want my project's name to be where I switch and manage it.

Acceptance criteria:
- On Documents and the other places, the head shows the project's mark and name (Sprint 132 R10). Its menu holds, in order (experience 3, frames 2 and 4):
  - Switch project ▸, listing the projects with what waits in each ("1 waits"), the open one ticked, then All projects, on Home, and Open in a new window (⌥ click);
  - Open a folder…;
  - Reveal in Finder (Reveal in File Explorer on Windows);
  - About this project, which opens the project's About this project file or offers to create it (Jarmo, 18 October; below).
- About this project is one file in the project's folder: `AGENTS.md`, which both Claude and Codex read, with a `CLAUDE.md` that only points to it, holding `@AGENTS.md` (Jarmo, 18 October):
  - when the folder has an `AGENTS.md`, the item opens it;
  - when it has none, the item offers to create it. Create writes `AGENTS.md`, headed "About this project", and the one-line `CLAUDE.md` when the folder has no `CLAUDE.md`, then opens it;
  - an `AGENTS.md` or `CLAUDE.md` already in the folder is never written over. The person's own `CLAUDE.md` changes only when they click Add the line (below).
- When the folder has its own `CLAUDE.md` without `@AGENTS.md`, About this project shows one line at the top of the page, in body ink with an info icon: "Claude reads this project's CLAUDE.md. Add one line to it so Claude reads this page too." The buttons are Add the line (primary) and Not now (Experience lead, 18 October):
  - Add the line writes `@AGENTS.md` as `CLAUDE.md`'s first line and changes nothing else, then the note goes;
  - Not now leaves the note on this page only, and Ritemark doesn't ask anywhere else.
- Ritemark shows the file as "About this project" everywhere, never as `AGENTS.md`: the menu, its tab, Documents and Home's Last changed (Jarmo, 18 October). The tab and the Documents row read "About this project" with the book-open icon, and the tooltip reads "AGENTS.md, read by Claude and ChatGPT". It is the one file shown by its plain name (Experience lead, 18 October). Per the [about-file audit](research/about-file-audit.md):
  - only the project root's `AGENTS.md` is About this project. An `AGENTS.md` in a subfolder keeps its name, though it shares the book-open icon, as README files do. Matching ignores case, as the Mac's and Windows' file systems do;
  - "everywhere" is the menu, the tab (with the folded tabs' list, Quick Open and the window's title), Documents, Home's Last changed, and the AI sheet's Active chip and Context line. Search, Source Control, the AI's activity and changed-file lists, and the file names Share suggests keep `AGENTS.md`;
  - in a folder under Git, the tooltip carries Git's status after it ("… • Untracked").
- Documents hides only the root's `CLAUDE.md` whose whole content is `@AGENTS.md` (surrounding whitespace, line endings and a byte-order mark ignored), and only while the root has an `AGENTS.md`. Home's Last changed leaves it out too. Search, Quick Open and Source Control show it as it is. A `CLAUDE.md` with the person's own words stays visible as it is, extension and all (Experience lead, 18 October; the about-file audit).
- New and Search keep Sprint 132's behaviour.
- The menu's words and entries come from the extension (Sprint 132's `ritemark/projectHead` menus).
- The File menu gains three items, where experiences/windows frame 2 draws them:
  - New tab (⌘T, Ctrl+T on Windows), which opens the +'s menu;
  - Switch project, which shows Home with the projects list, its search ready for typing. A native menu can't hold the switcher's list, which changes as projects come and go ([confirmations](research/confirmations.md) §1);
  - Share, which opens the Share menu of the document in front (R12), and is greyed out when none is.
  This holds for Windows' menu button and for the Mac's menu bar. Sprint 132 left New tab and Switch project for this step (its technical plan, W3).

### R9: Switching projects in place

As a writer, I want to move between projects in the same window and find each as I left it.

Acceptance criteria:
- Switching opens the next project in the same window. The window reloads, as VS Code does when the folder changes (the release plan: its API offers no way around it).
- While it reloads, the window shows the ground's colour, in Light and in Dark, not a dark block.
- The next project opens on its Home, and keeps its own tabs: coming back to a project brings its tabs back as they were.
- Any switch that reloads the window (Home's list, the project's menu, Open a folder…) while a chat in this window is working (a card's turn runs in a chat too) asks first, in experience 31's dialog, 440 wide (experience 33, frame 3):
  - title: "Claude is still working in <project>" (the AI's name as it is; with chats of two AIs working, both names: "Claude and ChatGPT are still working in <project>");
  - detail: "Switching projects stops it. Open <other> in a new window to let Claude finish.";
  - buttons: Cancel, Switch and stop, and Open in a new window as the default.
  Open in a new window opens the other project in a new window and leaves this one as it is; Switch and stop stops the chat as Stop would, then switches; Cancel does nothing. With nothing working, switching never asks.
- "Working" means a turn is running in a chat of this window, or waits on the person's answer, a card's turn included. A card waiting for room and a prompt queued behind a finished turn are not working ([switch audit](research/switch-audit.md)).
- VS Code's own ways of opening a folder ask too: File ▸ Open Recent, File ▸ Open Folder…, a folder dropped on the Dock icon, and File ▸ Close Folder. Where Ritemark can't know the folder about to open (all but Open Recent), the dialog has Cancel and Switch and stop, with Cancel as the default (switch audit, 19 October). If Ritemark doesn't answer within 10 seconds, the switch goes on as today, so the window is never stuck.
- After a switch, Home's note says "Switched to <project>. <other> is kept as you left it." with Go back, which switches back (experience 3, frame 3; experience 33).
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
- Export becomes Share ("Share, not Export"), one menu in experience 26's frame 1 order:
  - **Send a copy**: PDF (for reading and printing), then Word document (for people who edit in Word);
  - **Google Docs**: Publish to Google Docs (one Google Doc you update from here);
  - **Copy as Markdown** (for email and chat);
  - the foot line: the document stays on this computer; sharing sends a copy.
- Every 1.x Export item keeps working from Share. Publish to Google Docs runs today's connect-and-create flow; once a document is linked, the Google Docs group holds today's actions for that state (update the Google Doc, open it, remove the link, reconnect), in 2.0's words.
- The Google Doc chip and its card (experience 26, frame 2) and bringing edits back in (frame 3, a concept) are not in this sprint.

### R13: Missing, empty and boardless projects

As a writer, I want Ritemark to say plainly when a project is not as expected.

Acceptance criteria:
- A project whose folder is not found (experience 33, frames 1 and 2):
  - in the projects list and the switcher its row is muted, with a warning-circle and Not found, the old path in its tooltip, in its place;
  - clicking it does not switch: the window stays in the current project, and the desk's Home shows the project's head with a muted mark and one box: "This project's folder is not where it was", the old path, Find it… (primary) and Remove from the list;
  - Find it… opens the folder picker at the old path's nearest existing parent; the chosen folder replaces the old path in the list and the project opens there; if the chosen folder is another project's, Ritemark says so and keeps the list as it was.
- An empty project: Home as R4 says (experience 29, frame 1).
- A project with no task board yet: Tasks shows the board's empty state, "Nothing waits for you" with New task (experience 29, frame 2), and its tab has no count; no board file is written until the person adds a card.
- With the `task-board` flag off: no Tasks tab, no task counts; chats still count.
- Nothing in Ritemark brings back a project folder that has gone. Today Flows' storage does: it creates `.ritemark/flows` with every missing parent, so a deleted project folder comes back empty (`FlowStorage.ts:44`; Sprint 133's QA, open findings). A folder that is not found stays not found until the person finds it or removes it from the list.
  - Flows' storage creates nothing when it only lists flows. Today the flow scheduler lists them at start and every 30 seconds, so every project gains an empty `.ritemark/flows/` the moment it opens, and a deleted one comes back within 30 seconds ([confirmations](research/confirmations.md) §7).
  - Everything that creates a folder under a project (a new card's `.ritemark/tasks/`, a saved flow, an export, a transcript) first checks that the project's folder is still there.

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
  | Open document…, Open folder… | File ▸ Open… (⌘O, Ctrl+O on Windows) for a single document; Add a project… and the head's Open a folder… for a folder |
  | Recent folders (with no folder open) | The projects list |

- The Export menu's every item works from Share (R12).
- 1.x's Home view (`ritemark.homeView`) and its tests are replaced only once every row above is checked.

### R15: Windows

As a writer on Windows, I want Home, the projects and switching to work the same way.

Acceptance criteria:
- Home, the projects list, the head's menu, switching, Alt click, Reveal in File Explorer and the document's bar work on a Windows PC, with Windows paths and Ctrl in every shortcut.
- Projects on other drives and on network paths are listed and opened; a disconnected drive shows the project as missing (R13).
- R16 to R24 hold on Windows too, with Reveal in File Explorer in the project's menu and Show in File Explorer in a PDF's or Word file's Share.

### R16: The project's head on Tasks, Browser and Transcribe

As a writer, I want my project's name on top of every place, so I always know which project I am in.

Acceptance criteria:
- On Tasks, Browser and Transcribe, the left column's head is the project's head, as on Documents and Agents (Sprint 132 R10; experience 31): the project's mark, its name and the chevron, with the project's menu (R8). Every place but Home has it in the Experience lead's drawings.
- The place's own title row goes. Sprint 132 left the plain place name there: "Tasks", "Browser", "Transcribe" (the Experience lead's review of Windows round 2, 18 October).
- Each place's own content stays under the head. Only the rows its drawing gives are added:
  - Tasks: New task and Search (experience 6, frame 1; R17);
  - Transcribe: Record and Transcribe a file… (experience 20, frames 2 and 3). They are today's Record and Add recording, with the same actions. The library follows under the column's group labels, with "Recordings" in place of "Library";
  - Browser: no rows; the Recent label and its actions (R18).
- An action that the place's title row carries today keeps a home:
  - Browser's New browser tab and Clear history go to the Recent label (R18);
  - Transcribe's settings button, which opens Settings at the transcription card, becomes a small icon button at the right of the "Recordings" group label, under the project's head (the Experience lead, 19 October). It is the gear, with the tooltip "Transcribe settings", in the column's icon-button style beside the 11-caps label. It is the same pattern as Browser's + and Clear at the right of "Recent".
- The head's row words and their commands come from the extension, as Documents' and Agents' do, so an extension release can change them.
- With no folder open, each place keeps its plain name, as Sprint 132 left it.
- The head and its rows work by keyboard and VoiceOver, as on Documents (Sprint 132, S35–S37).

### R17: Tasks under the head

As a writer, I want the Tasks place to start a task and find one, with the tasks in the order work moves.

Acceptance criteria:
- New task, the head's first row, starts a task as today's add field does: it shows the field ("Add a task…") and puts the keyboard in it.
- Search, the second row, filters the list by a task's title as the person types. Escape clears it.
- The list runs in the order work moves, as experience 6's frame 1 draws it and as the board does (Jarmo, 15 October):
  - Ideas, folded;
  - To do;
  - Doing, with the tasks that wait for the person first and marked "Waiting for you";
  - Done, folded, with today's Archived inside it.
- A task that waits for the person (the board's calls: needs you, a decision, a review, failed) is marked and first in its stage, wherever it is. No call is hidden by the order, and the count is unchanged (R6).
- Every task the list shows today is still listed, and every action on a row stays: open, the … menu, and Restore and Delete… for an archived task.
- Your calls is no longer a panel of its own, and Archived is no longer a section of its own. This changes a 1.x behaviour; Jarmo said yes on 19 October ("Yes, as drawn").

### R18: Browser under the head

As a writer, I want the Browser place to say plainly what it holds.

Acceptance criteria:
- Under the head, a group label, "Recent", heads the recent pages in the column's 11-caps style, as Documents' label heads the tree.
- New browser tab (+) and Clear history sit at the right of the Recent label, in the column's icon-button style, each with a tooltip that says what it does. They do what the title row's two buttons do today, and stay in the palette.
- With no pages, the list says "No pages yet" in place of "No recent URLs" (the Experience lead, 18 October: plain words). The line under it stays as today.
- The recent pages, their remove button and opening a page work as today (Sprint 131).

### R19: The PDF and Word bars

As a writer, I want a PDF's and a Word file's bar to use the same words as a document's bar.

Acceptance criteria:
- On the PDF viewer's bar and the Word preview's bar, Save as Markdown becomes **Make an editable copy** (decided with Jarmo on 14 October; the comparison's "Decided with Jarmo"). It does what Save as Markdown does today, behind the same `save-as-markdown-from-preview` flag.
- Each bar ends in **Share**, as the document's bar does (R12; the comparison's `after-pdf.png`). On a PDF or a Word file, Share holds two items (the Experience lead, 19 October):
  - **Show in Finder** (Show in File Explorer on Windows), so the file can be attached to an email or a message;
  - **Open in Preview** for a PDF, or **Open in Word** for a Word file, where the system's own Share is. Open in Word takes the name the bar's button already shows.
- On Windows, where there is no Preview, a PDF's second item opens the file in its default app, as "Open in default app", the words the Word bar already uses ([confirmations](research/confirmations.md) §8). They go to the Experience lead with the screenshots.
- Share has no Export and no Google Docs on a PDF or a Word file.
- Make an editable copy stays on the bar, as drawn. On the PDF's bar it sits beside Share (`after-pdf.png`). On the Word bar it stays in Open in Word's menu, as today (`after-word.png`).
- Nothing on today's bar is removed.
- Page, zoom, fit and find stay as they are. The PowerPoint preview keeps its bar.
- The Experience lead's scope of 18 October left these words and Share to this step (Sprint 132's sprint plan).

### R20: The browser's share question, on the AI's sheet

As a writer, I want the browser's share question to wait beside my work, not block it (#455).

Acceptance criteria:
- When Ritemark asks whether to share a web page with the AI, it asks on the AI's sheet, above the message box, as experience 28's frame 1 draws it. No dialog opens (Jarmo, 19 October).
- The question reads (experience 28, frame 1):
  - title: "Share this page with Claude?" (the AI's name as it is);
  - line: "Claude reads the page you have open, so you can ask about it. It cannot click or type on it without asking.";
  - Share this page (primary) and Not now;
  - a box: "Share pages I open in Ritemark without asking".
- When and whether it asks stay as today (`BrowserContextStore.ensureSharedForActiveTab`):
  - it asks the first time a page becomes the AI's context in a session, once per page;
  - it never asks once the person has chosen to share pages without asking (today's "Don't ask again").
- Share this page shares the page, as Allow does today. With the box ticked, later pages are shared without asking, as "Don't ask again" does today.
- Not now shares nothing, as Deny does today. The question is not asked again for that page in this session.
- The tabs stay usable while the question waits. Switching tabs, closing a tab, the + and the page itself all work (#455: today they do nothing until the dialog is answered).
- The question is about the page in front. If the person moves to another page before answering, it asks about that page instead, and the page left unanswered is not shared. It is asked about again when it comes back in front: only an answer marks a page as asked for the session ([share-question audit](research/share-question-audit.md)).
- Nothing about a page (its address, title or content) reaches the AI before Share (Sprint 67's consent boundary). A message sent while the question waits goes without the page.
- The question is reached by keyboard and read by VoiceOver, and draws in Light and Dark.
- A page the network policy blocks still gets today's notice.
- The AI's request to control a page ("Allow AI to control this browser tab?") stays today's dialog (*Non-Requirements*).

### R21: The command palette without VS Code's developer commands

As a writer, I want All commands to list what I can use in Ritemark (#456).

Acceptance criteria:
- All commands (⇧⌘P, Ctrl+Shift+P on Windows) no longer lists VS Code's developer and debugging commands, such as "Add Data Breakpoint at Address" and "Add Function Breakpoint" (Jarmo, 19 October).
- It is a filter of command IDs, in patch 003, beside its menu cleanup. The commands stay registered, so a menu, a shortcut or another command that runs one still works.
- The list of IDs to drop is written first, by an audit (technical plan, Phase 1).
- A command stays in the palette when:
  - it is Ritemark's own;
  - a Ritemark menu, doc, skill or QA step names it (for example Developer: Reload Window);
  - the parity list reaches a v1.14.0 function through All commands only, such as refreshing the file list and maximising the AI's column (G7).
- Search and the recently used list never offer a dropped command.
- The commands keep VS Code's names. Plain-word names (experience 22) come after 2.0.

### R22: ChatGPT, never Codex

As a writer who uses ChatGPT, I want Ritemark to call it ChatGPT everywhere I read it.

Acceptance criteria:
- Every visible string that names the AI "Codex" says "ChatGPT" (Jarmo, 19 October). This covers:
  - Ritemark Settings, including its ChatGPT card and the Update Center;
  - the descriptions VS Code's settings page shows for Ritemark's settings (reached through Advanced settings, R23);
  - toasts and notifications;
  - flow error messages and the flow editor's words;
  - the AI's sheet, the model picker, the task board and comments;
  - the names of the terminal tabs that install or repair ChatGPT's runtime;
  - anywhere else a person reads "Codex" as the name of the AI.
- The list comes first: an audit lists every user-visible "Codex" string, with where it is, what it says and what it will say (technical plan, Phase 1).
- This is a copy pass only. Internal names, setting keys, command IDs, file names, log lines and code identifiers stay as they are, so nothing a person set is lost.
- A model's own name stays as OpenAI writes it, such as "GPT-5.3 Codex Spark". The audit lists these apart.
- Text that the bundled runtime itself writes, such as its own error, is shown as it came. Ritemark's words around it say ChatGPT.
- Settings keeps its layout. The Settings redesign (experience 15) comes after 2.0.

### R23: Advanced settings

As a writer, I want a visible way into every setting, now that ⌘, opens Ritemark Settings (parity gap G4).

Acceptance criteria:
- At the foot of Ritemark Settings, one link, "Advanced settings", opens VS Code's own settings (`workbench.action.openSettings`) (Jarmo, 19 October).
- Its tooltip says what it opens: "Feature switches, updates, excluded folders and every other setting".
- It is needed because ⌘, (Ctrl+, on Windows) opens Ritemark Settings since Sprint 132. These settings live only in VS Code's settings:
  - the feature switches;
  - the update mode and channel;
  - the excluded folders;
  - the transcription export folder.
- Nothing on Ritemark Settings moves or goes (HARD RULE #1).
- The palette's "Preferences: Open Settings" keeps working (R21).

### R24: An agent's colour on its row

As a writer, I want to know my agents apart at a glance, by the colour I gave them (parity gap G5).

Acceptance criteria:
- In the Agents place, an agent whose settings give it a colour (the Color field, `color:` in its file) shows its row's icon in that colour, as v1.14.0's rows did (Jarmo, 19 October).
- An agent with no colour of its own keeps today's muted icon.
- Each of the eight colours has a Light and a Dark value, and each meets 3:1 against the column.
- A change of colour in the agent's settings shows on its row without a reload.
- The Agents place's other changes since v1.14.0 are accepted as they are (Jarmo, 19 October):
  - the count line is gone;
  - the empty state's two buttons became one line, with New in the head;
  - Sort sits inside Search;
  - descriptions, badges and a flow's "used by" are in each row's tooltip.
  Nothing else on the place changes.

## Engineering requirements

### E1: The project list is one module

- One module owns the project list (storage, the first fill, adding, removing, missing folders, ordering), with no `vscode` import in its rules, unit tested.
- One module reads a project's file (R1) and one computes what waits (R3), both unit tested, both reused by Home, the projects list, the switcher and the Tasks tab.
- The task board's rules (`BoardController`) compute another project's Your calls; nothing re-implements them.

### E2: Home in the shared bundle

- Home and the projects list are React in `webview/src`, built from the UI components. No HTML built from strings, no `innerHTML`.
- New webview ↔ host messages are typed in one protocol file.

### E3: Tests

- Extension unit tests: the project file, the list (first fill, add, remove, missing, order), what waits (counts from fixtures of boards and chats), the permanent tabs' restore order, the switch guard, About this project (open, create, an existing `CLAUDE.md` or `AGENTS.md` left as it is).
- Webview unit tests for Home's states (full, empty, missing, no board) and for escaping.
- Webview unit tests for the Tasks list's order and its filter (R17), and for Make an editable copy and Share on the PDF and Word bars (R19).
- Extension and webview unit tests for the share question: when it asks, Share, Not now, the box, and nothing sent before Share (R20); for the Advanced settings link (R23); and for an agent's row colour, chosen or not (R24).
- A VS Code unit test for the palette's filter: a dropped ID is not offered and a kept one is (R21).
- The theme's contrast test covers the eight agent colours in Light and Dark (R24).
- The copy pass's audit search is run again at QA and finds no user-visible "Codex" outside its list of what stays (R22).
- CDP checks on a dev instance: Home and Tasks first, Close all, the count on the Tasks tab, switching both ways with tabs restored, and the tab row usable while the share question waits (R20).
- CDP geometry checks: the head on Tasks, Browser and Transcribe has the numbers it has on Documents (R16).
- The screenshot baseline gains Home, the projects list and the switcher, light and dark, and the Tasks, Browser and Transcribe places with their heads. It also gains the share question on the AI's sheet, the foot of Ritemark Settings and the Agents place with a coloured agent.

### E4: The bundle (#107)

- `media/webview.js` is measured before and after; the default cover is an image file, not inlined.

### E5: Builds and Windows

- Merging into main is followed by a production build from a clean-room worktree at the merged commit and a Windows build from main. Before the merge, the extension side is tried on Windows through the test overlay.
- All patches apply on the pinned VS Code; the stacking check passes.

### E6: Docs

- `architecture.md`: a Projects subsystem section (the project file, the list, what waits, Home, switching), the 1.x Home launcher's replacement, the version-history row. The browser's section says the share question is asked on the AI's sheet.
- `references/layout-invariants.md`: Home and Tasks opened by default; on Home the left column holds the projects; every other place has the project's head.
- `CLAUDE.md`'s patch table: what 003 (the palette's filter) and 009 (the share answer from the sheet) gain.

### E7: Drift is measured

- At the merge, the stack is dry-applied on the newest VS Code release and the release plan's risk register updated.

## Non-Requirements

- **Search across projects.** Search all projects filters the list by name (release plan, Not in 2.0).
- **Switching without a reload.** It would mean rebuilding how VS Code runs extensions.
- **Sub-projects inside one big folder** (experience 3, open question 1).
- **Recent documents across projects** on Home (experience 3, open question 2).
- **Picking an icon or picture as a project's mark.** Marks are initials in ink.
- **About this project written by Claude**, or offered at other moments than the project's menu (experience 24's open question on when to offer it).
- **A VS Code update.** The pin stays at 1.117.0.
- **The AI asking to use a page** (experience 28, frames 2 and 3). The control question stays today's dialog. This sprint moves only the share question (R20).

After 2.0 (Jarmo, 19 October):
- **The Task board tab redrawn** as experience 6 draws it: its bar with Board, Ideas, Log and New task, and the tasks that wait inside Doing on the board too. This sprint changes the left column's list only (R17).
- **Transcribe redrawn** as experience 20 draws it: the recording's card at the foot of the left column, the transcript saved as a document, and its insights in the AI's sheet. This sprint gives Transcribe its head and its two rows only (R16).
- **The AI step:** the AI's empty state and the status bar's items.
- **The indigo icon** on the open row and on the open tab.
- **The {date} chip** in a flow's prompt.
- **Plain-word command names** in the palette (experience 22). This sprint only drops the developer commands (R21).
- **The Settings redesign** (experience 15). This sprint only changes words (R22) and adds Advanced settings (R23).

## Resolved Questions

- **2026-10-15 (Jarmo):** Home states the project's name, with a header image the person can change; the first window after the welcome is Home; chats are kept privately on this computer, never in the project's folder.
- **2026-10-16 (Jarmo):** Home and Tasks pinned permanently as the first two tabs, icons only; "yes, yes, yes" to the projects list on Home, the count on the Tasks tab, and sending it to the Development manager.
- **2026-10-17 (Jarmo):** "when I click Tasks, the board ALWAYS opens too"; the Home tab comes in step 3 ("ok").
- **2026-10-17 (engineering, on Jarmo's "You decide"):** the project list fills on the first 2.0 start from recent folders, chats and task boards.
- **2026-10-18 (the Experience lead's answers to this plan's design questions, and experience 33):** Start something is on every Home, under Waiting for you; an empty project is experience 29's frame 1 and a project with no board its frame 2, with no count on the Tasks tab; a folder that is not found and switching while Claude works are drawn as experience 33; What moved arrives with Home, once per profile; the "Switched to…" note with Go back stays; the document's bar is `comparison/after-write.png`, with Share as experience 26's frame 1.
- **2026-10-18 (Jarmo, via the Experience lead's question form):**
  - **About this project** is one file, `AGENTS.md`, which both Claude and Codex read, with a `CLAUDE.md` that only points to it, shown everywhere in the UI as "About this project". The project's menu item opens it or offers to create it (R8).
  - **The sample project:** yes. Ritemark ships one, offered on the welcome's step 2 (Sprint 133). Here it is an ordinary project in the list; it gains its line on Home (R1).
  - **Usage data for people updating from 1.x:** an OK on 1.x's notice carries over as a yes, shown on and changeable on the update sheet; anyone who opted out or never answered starts off (Sprint 133). This sprint adds no event (*Analytics and privacy* in the sprint plan).
- **2026-10-18 (the Experience lead, About this project's details):** a folder with its own `CLAUDE.md` gets the note and Add the line or Not now, and its `CLAUDE.md` never changes without that click; Documents hides only Ritemark's pointer-only `CLAUDE.md`; the tab and the Documents row read About this project with the book-open icon and the tooltip "AGENTS.md, read by Claude and ChatGPT" (R8).
- **Release plan:** the reload stays; the splash takes the ground's colour; switching asks first when the AI is working; ⌥ click opens a new window.
- **2026-10-18 (Sprint 132's handover to this step):**
  - The Experience lead's review of Windows round 2: the project's head on Tasks, Browser and Transcribe comes in this step, with their content under it. Browser's + and Clear sit at the right of a "Recent" group label in the column's 11-caps style. Tasks' drawing has New task and its list (R16–R18).
  - The Experience lead: Browser's empty text in plain words, "No pages yet" (R18).
  - The Experience lead's scope for step 1: the PDF bar's words and Share are this step's (R19).
  - Sprint 132's technical plan: New tab and Switch project join the File menu in a later step, which is this one (R8).
- **2026-10-19 (Jarmo, "all recommendations ok"):**
  - 2.0's scope adds three items to this sprint:
    - the browser's share question is asked on the AI's sheet, as experience 28 draws it, in place of a dialog that blocks the tab row (#455). When and whether it asks stays as today; only where it asks changes (R20);
    - the command palette drops VS Code's developer and debugging commands, as a filter of command IDs in patch 003 (#456). Plain-word command names (experience 22) come after 2.0 (R21);
    - "ChatGPT, never Codex" in every visible string, as a copy pass. The Settings redesign (experience 15) comes after 2.0 (R22).
  - An "Advanced settings" link at the foot of Ritemark Settings opens VS Code's own settings (parity gap G4; R23).
  - The Agents place's other changes are accepted: the count line, the empty state's buttons, Sort behind Search, and descriptions and badges in tooltips. An agent's chosen colour shows on its row's icon again (parity gap G5; R24).
  - After 2.0: the Task board tab's redraw (experience 6), Transcribe's redraw (experience 20), the AI step (the AI's empty state and the status bar's items), the indigo icon on the open row and tab, and the Flows {date} chip (*Non-Requirements*).
- **2026-10-19 (the Experience lead's answers to the refresh's design questions):**
  - **Transcribe's settings button** is a small icon button, the gear with the tooltip "Transcribe settings", at the right of the "Recordings" group label, under the project's head. It is the same pattern as Browser's + and Clear at the right of "Recent" (R16).
  - **Share on a PDF or a Word file** holds Show in Finder (Show in File Explorer on Windows), so the file can be attached to an email or a message, and Open in Preview for a PDF or Open in Word, where the system's own Share is. Make an editable copy stays on the bar beside Share, as drawn (`comparison/after-pdf.png`). Share has no Export or Google Docs on these files (R19).
- **2026-10-19 (Jarmo, at this plan's approval):**
  - **What counts as "waits" in a chat:** "Also unread answers". A chat waits while the AI waits on a question or an approval, and also while it has a finished reply the person has not read (R3). The recommendation had been questions and approvals only.
  - **Removing 1.x's Home view:** yes, as recommended. The projects list takes its container and place; the old view's code is deleted only after R14's table is checked, and the `home-launcher` flag is set to disabled with a tombstone (R14).
  - **Tasks' list as experience 6 draws it:** "Yes, as drawn" (R17).

## Open Questions

Still open for the Experience lead:
- Whether Browser has rows under the head (from the refresh). The handover names only the Recent label and its two actions, so the plan draws none.
- How a chat's unread reply is drawn in Home's Waiting for you, and whether the AI sheet's chat rail marks an unread chat (from Jarmo's answer of 19 October, R3). Until they answer, the reply is listed as a chat's question is, with its own words, and the rail is unchanged.

The first design questions sent to the Experience lead on 18 October were all answered the same day, with experience 33 drawn for the folder that is not found and for switching while Claude works (*Resolved Questions*). Jarmo's answers of the same day settled About this project's file, and the Experience lead's of the same day its note, its name and what Documents hides. Of the refresh's three design questions, the Experience lead answered two on 19 October: Transcribe's settings button and Share on a PDF or a Word file (*Resolved Questions*). Jarmo answered this plan's three open questions at its approval on 19 October (*Resolved Questions*).
