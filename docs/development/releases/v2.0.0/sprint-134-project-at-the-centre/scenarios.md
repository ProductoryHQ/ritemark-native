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
When the person picks About this project in a project that has one, and in one that has none
Then the first opens it; the second offers to create it.

### S29: File ▸ Switch project
On the Mac's File menu and on Windows' menu button's File menu
Then Switch project is there and opens the switcher.

## Feature: Switching in place (R9)

### S30: Switching and coming back
Given "Leadership programme" with four documents open
When the person switches to "Sales proposal Q4" from the list
Then the window reloads, showing the ground's colour (not a dark block) in Light and in Dark, and opens on "Sales proposal Q4"'s Home with its own tabs
When the person switches back
Then "Leadership programme" comes back on Home with its four documents as they were.

### S31: The AI is working (negative)
Given a chat turn running in "Leadership programme"
When the person switches to another project
Then a Ritemark dialog says the AI is working here and switching stops it, with Switch anyway and Stay
When the person picks Stay
Then nothing changes and the turn goes on.

### S32: Go back
Given the Experience lead keeps the note
When a switch has just happened
Then a short note says the other project is kept as it was left, with Go back, which switches back.

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
Then it lists Export PDF, Export Word, the Google Docs items for the document's state, and Copy as Markdown, and each works as Export's did.

## Feature: Missing, empty and boardless (R13)

### S38: A missing project
Given "Moved" renamed outside Ritemark
Then the list and the switcher mark it Missing
When the person chooses it
Then Find it… and Remove from the list are offered; Find it… with the new folder brings it back with its line, cover and board.

### S39: An empty project and no board
When the person opens "Empty"
Then Home shows the empty state with Text, Table, Web page and a drop target; a file dropped on it is copied in and the original stays
When the person opens the Tasks tab
Then the board's empty state shows, and no board file is written until a card is added.

## Feature: Nothing is lost (R14)

### S40: 1.x's Home launcher
When the tester walks R14's table (New document, New table, New AI conversation, recent work, Task board, open a file or folder, recent folders)
Then each works from its 2.0 home
And the Export menu's every item works from Share.

## Feature: Windows (R15)

### S41: Home and switching on Windows
Given a Windows build from main (after the merge) or the test overlay (before it, for the extension side)
When the person runs S13, S18, S23, S27, S30 and S36
Then each holds, with Windows paths, Alt click for a new window, Reveal in File Explorer and Ctrl in every shortcut.

### S42: Other drives
Given projects on D: and on a network share, and one on a disconnected USB drive
Then the first two are listed and open; the third shows as Missing.
