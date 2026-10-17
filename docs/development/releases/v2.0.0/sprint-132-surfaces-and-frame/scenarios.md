# Sprint 132 Scenarios

These are the manual QA matrix. Each one names the requirement it shows. "S" numbers are stable: a new scenario gets a new number. Unless a scenario says otherwise, it is run in Ritemark Light and in Ritemark Dark.

## Feature: The frame on the Mac (R1)

### S1: A fresh start
Given a new profile on a Mac and a project folder
When Ritemark opens
Then there is no title row; the traffic lights, the left toggle, the tabs, the AI's toggle and You sit on one line 26 from the top
And the desk and the AI's sheet start at 44 and end 8 above the status bar, 8 apart and 8 from the window's edges.

### S2: Two desks
Given one document open
When the person splits the desk
Then two desks lie 8 apart, each with its own tabs in its strip, and both webviews follow their sheets.

### S3: Columns hidden
Given both side columns are shown
When the person hides the left column, then the AI
Then each column's controls appear on the desk's strip in a space of their own, the tabs start after them, and the desk stays 8 from the window's edges.

### S4: Moving the window
Given the window is not full screen
When the person drags the empty strip, then double-clicks it
Then the window moves, then zooms or minimises as the macOS setting says
And dragging from a tab or a toggle does not move the window.

### S5: The traffic lights after a restart
Given the window was closed in full screen
When Ritemark starts again and leaves full screen
Then the traffic lights sit inside the window on the centre line.

### S6: A sheet dialog
When the person picks Save As… on an untitled document
Then the macOS sheet hangs from 44, under the strip.

## Feature: The frame on Windows (R2)

### S7: Writing on Windows
Given a Windows build from main and a project
When Ritemark opens
Then there is no title row; the menu button and the left toggle sit at the start of the left strip, and minimise, maximise and close sit at full height at the right end of the AI's strip, after the AI's toggle and You.

### S8: The menu
When the person clicks the menu button, or presses Alt
Then File, Edit, View and Help open with today's items and Ctrl shortcuts, and the arrow keys and Escape work.

### S9: The AI hidden on Windows
When the person hides the AI
Then the window buttons move to the right end of the desk's strip, and the tabs and the + stop before them.

### S10: Snapping and dragging
When the person hovers maximise, drags the strip to the screen's edge, and double-clicks the strip
Then snap layouts show, the window snaps, and it maximises and restores.

### S11: No ⌘ on Windows
When the person reads any tooltip in the strips, the + and the menus
Then every shortcut says Ctrl.

## Feature: Zoom (R3)

### S12: Zoom in and out
When the person zooms in twice and out three times
Then the documents and the tree zoom, while the strips, their centre line, the traffic lights or window buttons stay where they were.

### S13: Zoom across a restart
Given the window is zoomed in
When Ritemark restarts
Then the zoom stays and the top line is still at 26.

## Feature: The AI column (R4)

### S14: Only the AI
When the person opens the AI column
Then it shows only the AI's sheet with its chat rail: no VS Code title rows and no row of icons.

### S15: A view dragged to the AI column (negative)
When the person drags Search or Outline towards the AI column
Then it cannot be dropped there; it stays in the left column or goes into More.

## Feature: The places row and More (R5)

### S16: The row
Given a fresh profile
When the left column is shown at 248 wide
Then the row shows Home, Documents, Tasks, Browser, Agents, Transcribe and ⋯, and the chosen place has the soft fill.

### S17: What does not fit
When the person opens ⋯
Then it lists the places that do not fit in their order (Search, File changes, Extensions in a fresh profile), in Ritemark's menu.

### S18: Tasks opens the board
Given the Task board tab is open but behind other tabs
When the person clicks Tasks, even when Tasks is already the chosen place
Then the Task board tab comes forward.

### S19: Reordering
When the person drags Transcribe before Browser
Then the row keeps the new order after a restart.

## Feature: Copilot Chat behind More (R6)

### S20: Copilot Chat installed
Given GitHub Copilot Chat is installed
When the person opens ⋯ and picks Copilot Chat
Then Copilot Chat opens as a tab on the desk, and the AI column is unchanged.

### S21: Copilot Chat not installed (negative)
Given Copilot Chat is not installed
Then ⋯ does not list it, and nothing else about it shows.

## Feature: The tab row (R7)

### S22: Readable tabs
Given four documents with names of different lengths
Then each tab is as wide as its name (120 to 200), and the gaps between names are equal.

### S23: Pointing at a tab
When the person points at a tab that is not chosen
Then its own shape fills softly, its close button takes the icon's place, and nothing else moves
And its tooltip shows its path inside the project.

### S24: A new tab
When the person clicks the +
Then a menu opens leftward over the desk with Text, Table (CSV data), Web page and Terminal, and each makes that kind of tab.

### S25: Many tabs
Given 13 documents open with both columns shown
Then the tabs used longest ago fold into "N ⌄" before the +, no tab is narrower than 120, and the row does not scroll
When the person hides the left column
Then fewer tabs fold, and with both columns hidden none do.

### S26: Bringing a folded tab back
When the person opens "N ⌄" and picks a document
Then it comes back in its place, and the tab used longest ago in the row folds instead
When the person picks "Close these N tabs"
Then the folded tabs close and the row's tabs stay.

### S27: Menus close outside
Given the +'s menu or "N ⌄" is open
When the person clicks inside a document, the AI or the tree
Then the menu closes.

## Feature: The terminal is a tab (R8)

### S28: A terminal from the +
When the person picks + → Terminal twice
Then two terminal tabs open in the project's folder, named "Terminal" and "Terminal 2".

### S29: Running and Stop
Given a terminal tab
When the person runs a long command
Then the terminal's bar shows Running and Stop
When the person clicks Stop
Then the command is interrupted and Running goes away.

### S30: Working behind other tabs
Given a terminal running a command behind a document tab
Then its tab shows the working dot, and the dot goes away when the command ends.

### S31: Ritemark's own terminals
When Settings → Claude → Sign in opens Claude Login, or Codex Repair runs
Then each opens as a terminal tab with its name, never in the AI column.

### S32: No terminal at start (negative)
Given a fresh profile
When Ritemark opens and is left alone for 10 s
Then no terminal opens.

### S33: Terminals across a restart
Given two terminal tabs
When Ritemark restarts
Then both come back as tabs.

### S46: The terminal shortcut (R8, revised)
When the person presses Ctrl+` on Windows, or ⌃` on the Mac, twice
Then two new terminal tabs open on the desk, and no panel appears
And the View menu has no Terminal entry.

## Feature: Home and Tasks keep the front (R9)

### S34: A pinned Task board tab
Given the Task board tab is pinned
When the person tries ⌘W, Close, Unpin, dragging it to the other desk, dragging a document in front of it, and Close all
Then it stays first, pinned and open, and Close all leaves only it.

## Feature: The left column's head (R10)

### S35: The head on Documents
Given a project called "Harbour leadership programme"
When Documents is chosen
Then the head shows the whole name with a chevron, then New and Search as rows, then Documents over the tree, and `.ritemark` is not in the tree.

### S36: The project's menu and New
When the person opens the chevron, then New
Then the chevron offers Open a folder, Reveal in Finder (Reveal in File Explorer on Windows), All commands and the folder tools, and New lists every kind of new file Ritemark makes today; each works.

## Feature: You and the menus (R11, R12)

### S37: You
When the person clicks You, or tabs to it and presses Enter
Then a Ritemark menu offers Settings and Help; Settings opens Ritemark's settings page, and Help opens ritemark.app's support pages in the browser.

### S38: Ritemark's menus
When the person right-clicks in the tree, in a document and on a tab, on the Mac and on Windows
Then each menu is Ritemark's own, with rows 32 and the soft indigo chosen row
And the macOS menu bar stays native.

## Feature: The theme pass (R13)

### S39: Every surface, both themes
When the person opens each surface (a Markdown document, a CSV, a PDF, a Word and a PowerPoint file, a web page, the task board, Transcribe, Settings, a notification, the command palette), in Ritemark Light and Ritemark Dark
Then each matches its drawing, with no line between parts and no surface in its own off-colour.

### S40: High contrast
When the person switches to a high-contrast theme
Then every control, border and chosen state is visible.

### S41: The three surfaces still being drawn
When the drawings for modal dialogs, Flows and the Agent Library arrive
Then S39 is repeated for them (added to this list then).

## Feature: Window sizes (R14)

### S42: Narrowing the window
When the person narrows the window from 1500 to 900 points
Then below 1400 the AI's sheet narrows to 320, below 1200 the left column hides, below 960 the AI hides, and the document column never drops below 560.

### S43: A column the person opened
Given the window is 1100 wide and the left column hid itself
When the person opens the left column with its toggle
Then it stays open, taking room, until the window crosses 1200 again.

## Feature: Nothing is lost (R15)

### S44: The inventory
When the tester walks every row of `comparison/README.md`'s inventory
Then each function works from the home this sprint gives it, or from its 1.14 place for the parts later steps move.

## Feature: Updating from v1.14.0 (R16)

### S45: A lived-in profile
Given a v1.14.0 profile with:
- a terminal in the AI column;
- Copilot Chat installed and once opened;
- Outline moved to the AI column;
- Agent Library dragged to the top of the Activity Bar;
- Ritemark Dark chosen by hand
When the first build with this sprint starts on it
Then the places row is on top in R5's order (Agent Library's drag is replaced once by the 2.0 order), and the AI column holds only the AI
And the terminal is a tab, Copilot Chat is in ⋯, Outline is in the left column, and the theme is still Ritemark Dark
When the person reorders the places and restarts
Then their order is kept.
