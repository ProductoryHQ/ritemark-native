# Sprint 134 Scenarios

These are the manual QA matrix. Each one names the requirement it shows. "S" numbers are stable: a new scenario gets a new number. Unless a scenario says otherwise, it is run on the Mac, in Ritemark Light and in Ritemark Dark, on a dev instance launched in the background with its own short user-data directory (memory: `dev-instance-cdp-isolation`).

The test projects: "Leadership programme" (documents in folders, a board with one card waiting on the person), "Sales proposal Q4" (a board with a decision waiting, a chat with a question), "Board report 2026" (documents, no board), "Empty" (an empty folder), and "Moved" (a project whose folder is renamed outside Ritemark during the test).

## Feature: The project file (R1)

### S1: Defaults, nothing written
Given "Leadership programme" with no `.ritemark/project.json`
When Home opens
Then it shows the folder's name, "LP" as the mark and Ritemark's cover, and no file is written in the folder.

### S2: The line and the cover
When the person writes a line under the name, then picks Change image and an image
Then `.ritemark/project.json` holds the line and `.ritemark/cover.<ext>`, the image is copied there, and Home shows both
When the folder is copied to another place and opened
Then its Home shows the same line and cover.

### S3: A file that cannot be read (negative)
Given `.ritemark/project.json` holds broken JSON
When Home opens and the person changes the line
Then Home shows the defaults and says once that the project's file could not be read; the file is left as it was and the change is not written over it.

### S4: A folder that cannot be written (negative)
Given a read-only project folder
When the person changes the line
Then Home says the change could not be saved, and why, and keeps working.

## Feature: The project list (R2)

### S5: The first fill
Given a v1.14.0 profile with six recent folders, chats in two projects of which one is not among the recent folders, and a board in a third
When this build starts
Then the projects list holds every one of them once, the open project first, then by when each was last open
And no folder outside those sources appears.

### S6: Added when opened
When the person opens a new folder from Open a folder…
Then it joins the list, first.

### S7: Removing (negative: nothing else is touched)
When the person removes "Board report 2026" from the list
Then it leaves the list, and its folder, chats and board are untouched; opening it again adds it back.

### S54: The welcome's lists
Given a finished profile with "Moved" removed from the list, and a v1.14.0 profile after the first fill
When a window with no folder shows "Where do you want to start?", and the v1.14.0 profile shows the update sheet
Then both list projects from Ritemark's project list, in its order, and "Moved" is not on the first.

## Feature: What waits (R3, R6)

### S8: The same number everywhere
Given "Leadership programme" open, its board with one card waiting on the person
Then the Tasks place, the Tasks tab, Home's Waiting for you and the projects list all show 1.

### S9: Another project's count
Given "Sales proposal Q4" with a decision waiting on its board and, in another window, a chat of it waiting for an approval
When Home is shown in "Leadership programme"
Then the list shows 2 beside "Sales proposal Q4", and Home says what waits in the other projects
When the approval is answered in the other window and Home is shown again
Then the count is 1.

### S10: A call only this computer knows
Given a card in "Sales proposal Q4" whose agent's turn failed (a hand-off record, not the card file, says so)
Then the list counts it, as that project's board does.

### S11: A stale chat (negative)
Given a chat of another project left `needs-user` by a crash, with no window holding it
Then it is not counted.

### S62: An unread reply (Jarmo, 19 October)
Given "Sales proposal Q4" open in another window, where a reply in one of its chats finished while another chat was in front
When Home is shown in "Leadership programme"
Then the list counts it beside "Sales proposal Q4", and Home says what waits in the other projects
When the person opens that chat in the other window and Home is shown again
Then it is no longer counted
And a reply that finishes while its chat is in front on the AI's sheet is never counted
And a card's finished turn counts once, as the card's review, not as its chat too
And on a v1.14.0 profile's first start of this build, no old chat counts as unread.

### S12: The Tasks tab's count
Given two cards waiting on the person
Then the Tasks tab shows 2 at its icon's lower right, its tooltip says "Tasks, 2 wait for you", and VoiceOver reads it
When both are answered
Then no count shows.

## Feature: Home (R4)

### S13: Home, full
Given "Leadership programme" open
When Home is in front
Then it shows the cover with Change image, the mark and name, the folder line, the line, Waiting for you with its item, the other projects' line, Start something (Text, Table, Web page) and Last changed with the newest documents, each with its folder and when.

### S14: Home's actions
When the person clicks the folder line, a waiting card, a recent document, and each of Start something's three
Then Documents opens; the card opens on the board; the document opens; a new text document, table and web page open as tabs.

### S15: Home redraws
Given Home in front
When a document is saved, a card is answered on the board, and a chat's question arrives
Then Home's Last changed and Waiting for you change within two seconds, without losing its scroll or focus.

### S16: Names that are markup (negative)
Given a project named `<img src=x onerror=alert(1)>`, and a card titled `<b>Bold</b>`
Then Home, the list and the switcher show those names as plain text; nothing runs and nothing is bold.

### S17: Home by keyboard and screen reader
When the person tabs through Home with VoiceOver on
Then every action is reached in reading order and read with its name.

## Feature: Home and Tasks first (R5)

### S18: A fresh project window
When a project opens for the first time
Then Home and the Task board are the first two tabs, pinned as icons, and Home is in front.

### S19: Restored as they were
Given "Leadership programme" with five documents open and the third in front
When Ritemark restarts
Then Home and Tasks are first, the five documents follow in their order, and the third is in front.

### S20: Close all
When the person runs Close all
Then exactly Home and Tasks remain.

### S21: The Home place
Given a document in front
When the person clicks the Home place, and clicks it again when it is already chosen
Then Home's tab comes forward each time; there is never a second Home tab.

### S22: The board flag off
Given the `task-board` flag off
Then Home is first alone; no Tasks tab, and no task counts; chats still count.

## Feature: The projects list on Home (R7)

### S23: The list
When the person chooses the Home place
Then the left column shows Search all projects, the projects with their marks and counts, the open one as the white row, and Add a project…

### S24: Searching
When the person types "sal"
Then only "Sales proposal Q4" shows; clearing the field shows all.

### S25: Add a project
When the person clicks Add a project… and picks Start a new project
Then the welcome's new project runs (Sprint 133), and the window switches to it.

### S26: A new window
When the person ⌥ clicks "Board report 2026"
Then it opens in a new window, and this window stays as it was.

## Feature: The head's menu (R8)

### S27: Switch project
Given Documents chosen
When the person opens the project's menu and points at Switch project
Then a submenu lists the projects with "1 waits" where something waits, the open one ticked, then All projects, on Home and Open in a new window (⌥ click).

### S28: About this project
Given "Leadership programme" with an `AGENTS.md` of its own, and "Board report 2026" with neither `AGENTS.md` nor `CLAUDE.md`
When the person picks About this project from the project's menu in each
Then in "Leadership programme" its `AGENTS.md` opens, its tab named About this project
And in "Board report 2026" Ritemark offers to create it; Create writes `AGENTS.md`, headed "About this project", and a `CLAUDE.md` holding only `@AGENTS.md`, and opens it
And Documents and Home's Last changed name it About this project, as `research/about-file-audit.md` settled; the tab and the Documents row show the book-open icon, with the tooltip "AGENTS.md, read by Claude and ChatGPT"
And the one-line `CLAUDE.md` is not shown in Documents
When the person writes a line in it and asks Claude, then ChatGPT, in a new chat, what the project is about
Then each answer uses that line.

### S44: A `CLAUDE.md` of the person's own (negative)
Given a project with its own `CLAUDE.md`, in the person's words without `@AGENTS.md`, and no `AGENTS.md`
When the person picks About this project and Create
Then `AGENTS.md` is written and opens, and `CLAUDE.md` is left byte for byte as it was and stays visible in Documents as `CLAUDE.md`
And the top of the page shows, with an info icon, "Claude reads this project's CLAUDE.md. Add one line to it so Claude reads this page too.", with Add the line and Not now
When the person clicks Not now
Then `CLAUDE.md` is unchanged, and no other place in Ritemark asks about it
When the person clicks Add the line instead
Then `CLAUDE.md`'s first line is `@AGENTS.md` and every other byte is as it was, the note goes, and a new chat with Claude uses a line written in About this project.

### S29: File ▸ Switch project
On the Mac's File menu and on Windows' menu button's File menu
Then Switch project is there and opens the switcher.

### S52: File ▸ New tab and Share
On the Mac's File menu and on Windows' menu button's File menu
Then New tab (⌘T, Ctrl+T on Windows), Switch project and Share are where experiences/windows frame 2 draws them
When the person picks New tab, and presses ⌘T (Ctrl+T)
Then the +'s menu opens each time
When a document is in front and the person picks Share
Then the document's Share menu opens
And with Home in front, Share is greyed out.

## Feature: Switching in place (R9)

### S30: Switching and coming back
Given "Leadership programme" with four documents open
When the person switches to "Sales proposal Q4" from the list
Then the window reloads, showing the ground's colour (not a dark block) in Light and in Dark, and opens on "Sales proposal Q4"'s Home with its own tabs
When the person switches back
Then "Leadership programme" comes back on Home with its four documents as they were.

### S31: The AI is working (negative)
Given a chat turn running in "Leadership programme"
When the person switches to "Sales proposal Q4" from Home's list, then from the project's menu, then with Open a folder…
Then each time a dialog asks first: "Claude is still working in Leadership programme" / "Switching projects stops it. Open Sales proposal Q4 in a new window to let Claude finish.", with Cancel, Switch and stop, and Open in a new window as the default
When the person picks Cancel
Then nothing changes and the turn goes on
When the person picks Open in a new window
Then "Sales proposal Q4" opens in a new window and this window and its turn go on
When the person picks Switch and stop
Then the turn stops as Stop would, and the window switches
And with nothing working, switching never asks.

### S32: Go back
When a switch to "Sales proposal Q4" has just happened
Then its Home says "Switched to Sales proposal Q4. Leadership programme is kept as you left it." with Go back
When the person clicks Go back
Then the window switches back, and the note does not show again.

### S33: VS Code's own Open Folder
When the person uses File ▸ Open Folder… while a turn runs
Then Ritemark behaves as `research/switch-audit.md` decided (asks first, or switches as today), and the evidence says which.

## Feature: The landing and What moved (R10, R11)

### S34: The welcome lands on Home
Given a fresh profile
When the person finishes the welcome with a folder
Then the window opens on that project's Home, with the AI's sheet beside it.

### S35: What moved, once
Given a v1.14.0 profile after the update welcome
When the first Home shows
Then the What moved card says where the terminal, Copilot Chat and Settings went
When the person clicks Got it, opens another project and restarts
Then the card never shows again
And a fresh profile never shows it.

## Feature: The document's bar (R12)

### S36: Saved
When the person types in a document and stops
Then the bar shows Saved once the document is written; with a save failing (the file made read-only), Review changes and Retry show in its place as today.

### S37: Share
When the person opens Share
Then it shows Send a copy (PDF, for reading and printing; Word document, for people who edit in Word), Google Docs (Publish to Google Docs), Copy as Markdown (for email and chat) and the foot line, as experience 26's frame 1 draws it
And each works as Export's did
When the document is linked to a Google Doc
Then the Google Docs group offers updating it, opening it, removing the link and reconnecting, as Export did.

## Feature: Missing, empty and boardless (R13)

### S38: A project whose folder is not found
Given "Moved" renamed outside Ritemark
When Home shows, or the window gains focus
Then the list and the switcher show its row muted in its place, with a warning-circle and Not found, the old path in its tooltip
When the person clicks it
Then the window stays in the current project and the desk's Home shows "This project's folder is not where it was", the old path, Find it… and Remove from the list
When the person uses Find it… and picks the renamed folder
Then the list keeps the new place and the project opens there with its line, cover and board.

### S43: Find it… on another project's folder (negative)
Given "Moved" not found
When the person uses Find it… and picks "Board report 2026"'s folder
Then Ritemark says that folder is already another project's, and the list stays as it was.

### S53: A folder that has gone stays gone (negative)
Given "Moved" with a flow in `.ritemark/flows`, open in a window
When its folder is deleted outside Ritemark, and the person opens Flows, runs the flow's schedule check, and shows Home
Then the folder does not come back, the list shows "Moved" as Not found, and no `.ritemark` folder is created at the old path.

### S39: An empty project and no board
When the person opens "Empty"
Then Home shows the empty state with Text, Table, Web page and a drop target; a file dropped on it is copied in and the original stays
When the person opens the Tasks tab
Then it shows "Nothing waits for you" with New task, the tab has no count, and no board file is written until a card is added.

## Feature: Nothing is lost (R14)

### S40: 1.x's Home launcher
When the tester walks R14's table (New document, New table, New AI conversation, recent work, Task board, open a file or folder, recent folders)
Then each works from its 2.0 home
And the Export menu's every item works from Share.

## Feature: Windows (R15)

### S41: Home and switching on Windows
Given a Windows build from main (after the merge) or the test overlay (before it, for the extension side)
When the person runs S13, S18, S23, S27, S30, S36, S45, S48, S50, S51, S55, S58 and S60
Then each holds, with Windows paths, Alt click for a new window, Reveal in File Explorer, Show in File Explorer and Ctrl in every shortcut.

### S42: Other drives
Given projects on D: and on a network share, and one on a disconnected USB drive
Then the first two are listed and open; the third shows as Not found.

## Feature: The project's head on every place (R16)

### S45: Tasks, Browser and Transcribe
Given "Leadership programme" open
When the person chooses Tasks, then Browser, then Transcribe in the places row
Then each shows the project's head: the mark "LP", "Leadership programme" and the chevron, at the numbers Documents has; no "Tasks", "Browser" or "Transcribe" title row
And under it Tasks shows New task and Search, Transcribe shows Record and Transcribe a file…, and Browser shows the Recent label
And each place's content follows as before
When the person clicks the chevron on each
Then the project's menu opens, as on Documents.

### S46: Nothing on a title row is lost
Given Browser and Transcribe chosen in turn
Then Browser's New browser tab and Clear history are at the right of the Recent label, each with its tooltip, and each works as the title row's button did
And Transcribe's settings button is a gear at the right of the Recordings label, with the tooltip "Transcribe settings", and opens Settings at the transcription card
And Record and Transcribe a file… do what Record and Add recording did.

### S47: No folder open (negative)
Given a window with no folder, after the welcome is finished
When the person chooses Browser and Transcribe
Then each shows its plain place name as Sprint 132 left it, and no project's head.

## Feature: Tasks under the head (R17)

### S48: New task and Search
When the person clicks New task
Then the add field shows with the keyboard in it, and Enter adds the task to To do
When the person clicks Search and types "module"
Then only tasks with "module" in their title show; Escape shows them all again.

### S49: The order work moves (and nothing hidden)
Given a board with an idea, two tasks in To do, three in Doing of which one waits on a decision, one failed task in To do, two done and one archived
Then the list shows Ideas folded, To do with the failed task first and marked, Doing with the decision first and marked "Waiting for you", and Done folded
When the person opens Done
Then the archived task is inside it, with Restore and Delete… in its … menu
And the Tasks place and the Tasks tab both count 2.

## Feature: Browser under the head (R18)

### S50: Recent, and plain words
Given a fresh profile
When the person chooses Browser
Then the Recent label heads the column in 11-caps, and the list says "No pages yet" with today's line under it
When the person opens ritemark.app from the + at the right of the label
Then the page shows under Recent with its title
When the person picks Clear history
Then the list is empty again and says "No pages yet".

## Feature: The PDF and Word bars (R19)

### S51: Make an editable copy, and Share
Given a PDF and a Word file in "Leadership programme"
When each opens
Then its bar shows page, zoom, fit and find as today, then Make an editable copy and Share on the PDF, and Open in Word (with Make an editable copy in its menu) and Share on the Word file
When the person clicks Make an editable copy
Then an editable Markdown copy is made exactly as Save as Markdown made it
When the person opens Share on the PDF
Then it holds Show in Finder and Open in Preview, and no Export or Google Docs
When the person picks Show in Finder, then Open in Preview
Then Finder shows the file selected, and Preview opens it
When the person opens Share on the Word file and picks Open in Word
Then Word opens it, as the bar's button does
And nothing from today's bar is gone.

## Feature: The browser's share question (R20)

### S55: Asked on the AI's sheet, and the tabs still work
Given a fresh profile with Claude signed in, the AI's sheet open, and "Leadership programme" open with two documents
When the person opens ritemark.app from the + and the page becomes the AI's context
Then the AI's sheet shows, above the message box, "Share this page with Claude?", its line, Share this page, Not now and the box "Share pages I open in Ritemark without asking", and no dialog opens
While it waits, when the person switches to a document tab, closes the other document, and opens a new tab from the +
Then each works at once (#455)
When the person comes back to the page and picks Share this page
Then the page is shared, the chip shows it, and a question about the page gets an answer that uses it
And with ChatGPT chosen, the title reads "Share this page with ChatGPT?".

### S56: Not now, and sharing without asking
Given the share question on a page
When the person picks Not now
Then nothing about the page is shared, and the question does not come back for that page in this session
When the person opens another page, ticks the box and picks Share this page
Then that page is shared, and every page opened after it is shared without asking, also after a restart.

### S57: Before an answer (negative)
Given the share question waiting on ritemark.app
When the person sends "What is this page about?"
Then the turn carries no address, title or content of the page (the trace shows it), and the question is still there
When the person moves to another page before answering
Then the question is about the page now in front, and ritemark.app is not shared.

## Feature: The command palette (R21)

### S58: No developer commands
When the person opens All commands (⇧⌘P) and types "breakpoint", then "debug", then "developer"
Then "Add Data Breakpoint at Address", "Add Function Breakpoint" and the other IDs on the audit's list do not show, and nothing on the list shows under recently used
And Ritemark's commands, Preferences: Open Settings, the kept developer commands (such as Developer: Reload Window), refreshing the file list and the AI column's Maximize all show
When the person opens View ▸ Debug Console
Then it opens as before: a menu still runs a command the palette dropped.

## Feature: ChatGPT, never Codex (R22)

### S59: The copy pass
Given ChatGPT signed in, then signed out
When the tester walks the audit's list: Ritemark Settings (ChatGPT's card, its approval and sandbox, the Update Center), Ritemark's settings in VS Code's settings page, a failed sign-in's and a sign-out's toasts, the AI's sheet and its setup, the model picker, Give to agent on a card, a flow with a ChatGPT step that fails, and the terminal tab that installs or repairs it
Then each says ChatGPT where it said Codex, and a model's own name, such as "GPT-5.3 Codex Spark", is unchanged
And the approval mode and sandbox set before the change are kept.

## Feature: Advanced settings (R23)

### S60: A way into every setting
When the person opens Ritemark Settings with ⌘, (Ctrl+,) and scrolls to its foot
Then "Advanced settings" is there, with its tooltip
When they click it
Then VS Code's settings open, where the feature switches, the update mode and channel, the excluded folders and the transcription export folder can be found and changed
And nothing else on Ritemark Settings has moved or gone.

## Feature: An agent's colour (R24)

### S61: The chosen colour on the row
Given one agent with a colour chosen in its settings, and one with none
When the person opens the Agents place, in Light and in Dark
Then the first agent's row icon is in its colour, and the second's is muted as before
When the person changes the first agent's colour in its settings
Then its row icon follows, without a reload
And the place is otherwise as Sprint 132 left it: no count line, the empty state's one line with New in the head, Sort inside Search, descriptions and badges in tooltips.
