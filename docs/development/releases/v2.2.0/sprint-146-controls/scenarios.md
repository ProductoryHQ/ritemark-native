# Sprint 146 Scenarios

The manual QA matrix. Each scenario names its requirement; "S" numbers are stable, a new scenario gets a new number.

Unless a scenario says otherwise it runs on the Mac, on a dev instance of the PR's branch launched hidden (`open -n -g -j`, `--use-mock-keychain`, the three backgrounding flags) with its own short profile under `/private/tmp`, on a port checked to be free, one launch per check (no pop-up test windows, no relaunch loops). Input is CDP input only (`Input.dispatchMouseEvent`, `Input.dispatchKeyEvent`), never the system's keyboard or mouse, so a hidden window never takes keys meant for another; the debugging protocol's focus emulation is on. A scenario that needs no AI gets scratch directories for the AIs' homes (`CODEX_HOME`, `CLAUDE_CONFIG_DIR`, `XDG_CONFIG_HOME`); the user's `HOME` is not changed. "On `main`" means the tree the branch starts from, where the scenario's check must fail first (E1). "Light" and "Dark" are Ritemark Light and Ritemark Dark.

## Feature: No ring after a mouse pick (R1)

### S1: The RC3 finding
Given Home's first-day card with its "Ask with" caret
When the caret is clicked, then another AI's row
Then on `main` the caret keeps the 2 px accent ring and its tooltip "Choose which AI asks" opens (#585's RC3 crops)
And on the branch neither shows, in Light and Dark.

### S2: A keyboard pick
Given the same caret
When Tab reaches it, Enter opens the menu, ↓ moves and Enter picks
Then the caret has the focus again, with its ring.

### S3: Escape after a mouse open
Given the menu opened with the mouse
When Escape is pressed
Then the caret has the focus, with its ring.

### S4: A click outside
Given the menu open
When the page is clicked outside it
Then the menu closes with no ring on the caret.

### S5: A Select
Given a Flow step's model Select (no AI needed) and, with an AI, the composer's model and permission pickers
When a value is picked with the mouse
Then on `main` the trigger keeps its `focus:` frame, and on the branch it doesn't
And a keyboard pick leaves the trigger focused with its ring.

### S6: Share's menu is unchanged
Given a document's Share menu
When an item is picked with the mouse, the menu is left with Tab, and it is closed by a click outside
Then Share gets no focus after the mouse pick, Tab closes the menu and returns to Share, and a click outside leaves Share alone, as on `main`.

### S7: A menu with its own close rule
Given the AI sheet's link menu (`ChatLinkMenu`) and the welcome's dialog
When each closes
Then the welcome's dialog does what it did on `main`
And the link menu gives its link the focus back only after the keyboard: after a mouse pick nothing is focused, as with the shared menus (on `main` it focused the link after every close, RC3's mechanism; changed in PR 1's review, #618).

### S8: #585's audit
Given every trigger in #585's audit table
When each is driven with the mouse and with the keyboard, in Light and Dark
Then the table's live columns are filled in `research/menu-focus-audit.md`, and a row that needs a ready AI says whether it ran (ChatGPT through Jarmo's own sign-in in the scratch project) or not.

## Feature: The catalogue (R2)

### S9: Only with the launch setting
Given a dev instance started without the catalogue's setting, and a production build started without it
Then no command in All commands, no menu and no tab opens the catalogue
And given the same started with the setting, the catalogue opens as a tab on the desk.

### S10: Every control, every state
Given the catalogue open
Then each file in `components/ui/` has a row, each with its variants, and each state it has a cell; a state it doesn't have is empty
And the coverage test fails when a new file is added to `components/ui/` without a row, or a new control is exported from a file that already has rows.

### S11: Both themes
Given the catalogue open
When the theme is switched to Dark and back
Then every cell draws in each theme, with no cell left in the other theme's colours.

### S12: Self-contained and still
Given the catalogue open in a window with no folder, no AI and no network
Then every cell draws; no message but its ready goes to the host; nothing animates and no text caret blinks.

## Feature: The tracker decides the ring (R3)

### S13: A pointer press, then a script's focus
Given each non-field control in the catalogue (Button, split parts, Select's trigger, Switch, Tabs, FilterChip, Slider's thumb, a menu's trigger)
When it is clicked, and when a menu or dialog it opened gives the focus back by script
Then no ring shows, though Chromium's `:focus-visible` would match the script's focus.

### S14: The keyboard
Given the same controls
When Tab reaches each, and arrows move within Tabs and the Slider
Then each shows its ring.

### S15: Fields
Given Input, Textarea, the composer and a document
When each is clicked
Then each shows its focused look, as on `main`.

### S16: Tooltips and focus
Given a button with a tooltip
When it gets the focus by Tab
Then the tooltip opens
And when it gets the focus after a press (a card's Give to becoming Stop, Sprint 142's R9 case), the tooltip stays closed until the pointer is over it.

### S17: Shortcuts and modifiers
Given the page in pointer mode
When Shift alone, ⌘ alone, ⌘C and ⌘V are pressed (Ctrl on Windows)
Then the page stays in pointer mode and no ring appears.

### S18: Mixed
Given a menu opened with the mouse
When ↓ moves and Enter picks
Then the trigger has the focus with its ring (the last input was a key).

### S19: Where the keyboard carries on (decision 1)
Given a menu button in a row of buttons, a mouse pick from its menu
When Tab is pressed next
Then, with decision 1's recommended answer, the focus moves to the next button in the row, and only then does a ring show; with the other answer, Tab starts from the top of the page.

### S20: Every webview
Given the editor, the AI's sheet, Home, the projects list, the board, the Tasks side bar, Settings, a Flow, Transcribe and the welcome
Then each page carries the mode mark, and a page reached from the workbench by the keyboard (no key pressed inside it yet) shows the ring on its focused control.

### S21: Windows
Given the overlay on Windows (the "Ritemark on Windows" session), a real mouse and keyboard, and touch or a pen where the PC has one
When S1–S4, S13, S14 and S17 are repeated, with Alt alone pressed too
Then the results are the Mac's, and Alt alone doesn't switch the mode.

## Feature: The state test (R4)

### S22: It fails first
Given the approved images in `docs/development/control-baseline/`
When `control-states.mjs --compare` runs on a branch with R1's shared rule reverted
Then it exits non-zero and names the mouse-pick states of the menus and Select
And on the sprint branch it exits 0.

### S23: Real input only
Given the script's source
Then its unit test finds no `.click()` and no `.focus()` in any expression it evaluates in the page.

### S24: Device pixels, both themes, one count
Given a run
Then each state's cell is captured at device pixels in Light and Dark, the exit code is the number of states that differ or have no image, and `compare.html` shows each one's reference, capture and difference.

### S25: A background window
Given the instance hidden behind other windows
When the script runs once with the window in front and once behind (focus emulation on)
Then the captures are the same.

### S26: A new cell with no image
Given a cell added to the catalogue with no approved image
Then the run counts it as differing and says it has no image.

### S27: The review process runs it
Given the PR template, `REVIEW.md`, the reviewer brief, the `release` skill and the `release-manager` agent
Then the template's Risk section asks for the script's result on a PR that touches `components/ui/`, `index.css` or a control's look; `control-baseline/` is left out of review as `frame-baseline/` is; Gate 1's checks run it on the candidate with the catalogue's launch setting; and `incidents.md` row 10 names it.

## Feature: One tooltip look (R5)

### S28: Light
Given the AI sheet's sign-in button and the status bar's AI item, in Light
When each is hovered
Then the two tooltips have the look the Experience lead chose (colours, border or shadow, corner, padding).

### S29: Dark
Given the same in Dark
Then the same.

### S30: Long words and a disabled button
Given a tooltip with a long text on a 152 px desk, and a disabled button's tooltip
Then the text wraps inside the page, and the disabled button's tooltip still says why.

### S31: Native titles
Given the audit's list of native `title` tooltips
Then each one on a button or another control uses the shared `Tooltip`, and the rest are listed for the lead with what each one shows.

## Feature: Narrow buttons (R6)

### S32: Home at 152
Given Home's first-day card on a desk of 152 (the AI's sheet forced open in a narrow window)
Then the split button shows its icon only, with no ellipsis; its tooltip starts with the whole words; a screen reader reads the whole words
And on `main` the button shows a cut "A…".

### S33: Across the edge
Given the same desk widened and narrowed one pixel at a time across the width where the first word fits
Then the button switches once each way, with no flicker.

### S34: The other cut labels
Given the board's Give to, Word's and PowerPoint's Open in…, the spreadsheet's Open in another app, dictation and Share, each at its narrowest place
Then none shows a cut first word: each shows its icon only, or its toolbar's compact form, as the audit lists.

### S35: No icon
Given a button with only words, at a narrow width
Then it keeps today's cut.

### S36: Screenshots
Given S32 and S34
Then screenshots in Light and Dark go to the Experience lead, and the catalogue's narrow cells are approved.

## Feature: File changes with no Git (R7)

### S37: A folder without Git
Given a scratch folder with no `.git`
When File changes is opened
Then it reads "Git isn't set up in this project", the body in the lead's words, and Set up Git here; no "VS Code", "repository", "initialize" or "source control", no docs link and no Publish to GitHub
And on `main` it shows VS Code's words and Initialize Repository.

### S38: Set up Git here
Given S37
When Set up Git here is pressed
Then the folder gets its Git record and File changes lists the folder's files, as Initialize Repository did.

### S39: No Git on the computer
Given a test profile whose `git.path` names a file that doesn't exist (so Git counts as missing)
When File changes is opened
Then it reads "File changes needs Git" and the body in the lead's words, with no button and no download link.

### S40: Git's other states
Given Git turned off in settings, no folder open, a folder inside a Git repository's subfolder, an unsafe repository, a closed one, and the moment while it scans
Then each says nothing the lead's rule forbids, in the words the lead gave.

### S41: Opened with the mouse, then with the keyboard
Given File changes in More
When it is opened with a click
Then no outline is drawn round the panel
And when the focus reaches it by the keyboard, the outline shows.

### S42: The other places
Given each place in the left column (Documents with no folder, Search, Tasks, Agents, Browser, Transcribe) and a view showing welcome content
When each is opened with a click
Then none draws an outline it wouldn't draw for the keyboard (the audit's list).

### S43: Windows at Gate 2
Given 2.2's Windows candidate on a PC without Git, and the same with Git
Then S37, S39 and S41 hold.

## Feature: A tab's menu (R8)

### S44: A document's tab
Given a Markdown document open in Ritemark's editor
When its tab is right-clicked
Then the menu holds the items the lead kept, and none of the ones the lead dropped
And on `main` it lists Add File to Chat (when chat is on), Reveal in Explorer View, Open Preview, Reopen Editor With… and Find File References.

### S45: The dropped commands still run
Given each dropped item
Then All commands still offers it where it does today, and it runs.

### S46: Other tabs
Given Home, the Task board, a Word file, a PDF, a web page and a terminal
When each tab is right-clicked
Then each holds what the lead named; the terminal's menu is the usual items and Rename, as in 2.0.

### S47: Builds and themes
Given a production build without Copilot Chat and a dev build with Copilot Chat installed, in Light and Dark
Then S44 holds in each.

### S48: An item the filter doesn't name
Given a test that adds an item to the tab's menu under a new command
Then the item shows (the filter names what goes).

## Feature: The hovered row (R9)

### S49: Where it happens
Given each list in the left column with enough rows to scroll, at 1× and 2×, in Light and Dark
When a row is hovered while the thumb shows
Then `research/hover-row-audit.md` says, per list, whether the fill runs under the thumb and by how much
And on `main` at least the list Gate 1 saw shows it.

### S50: The lead's fix
Given every list S49 found
When a row is hovered while the thumb shows
Then the result is the one the lead chose (the fill stops where the thumb begins, or the thumb is one tone over it).

### S51: The desk's edge
Given S50
Then the thumb still stops 2 short of the desk's left hairline, and `frame-screenshots.mjs`' JOINS lines are ok.

## Feature: A card in a dialog (R10)

### S52: A click opens it
Given a board with cards in each column and the board scrolled down
When a card is clicked
Then its dialog opens over the board, behind a scrim, and the board doesn't scroll
And on `main` the card's page opens as a tab.

### S53: Closing
Given the dialog open
When it is closed by Escape, by the close button and by a click on the scrim
Then the board is where it was, and the focus is on the card: with its ring after Escape, without it after a click.

### S54: The keyboard
Given a card with the focus
When Enter is pressed
Then the dialog opens with the focus inside, Tab stays inside, and Escape closes it.

### S55: Open in separate tab
Given the dialog
When Open in separate tab is pressed
Then the card's page opens as a tab, as a click does on `main`, and the dialog closes.

### S56: What it shows
Given cards in each state (To do, Doing with an agent, Waiting for an answer, Review with a result, Done, an idea with a review, a card with files and history)
Then each dialog shows the title, Done when, the state's block and its one action, the files, the history and the text; the action works from the dialog as it does on the page.

### S57: The card changes
Given a card's dialog open
When an agent moves the card, the card page edits it, and another surface deletes it
Then the dialog redraws for the first two, and closes with the board's notice for the third.

### S58: A card file from someone else
Given a card whose text holds a `<script>` tag, an `<img src="https://…">`, raw HTML that would draw a box over the page, and a link
Then nothing runs or draws over the board; the HTML shows as text or not at all; the image is treated as the card page treats it, or not loaded; the link opens through the board's own opener.

### S59: Ideas, Your calls, Log and the side bar
Given a card in Ideas, Your calls and the Log
When it is clicked
Then its dialog opens over the board
And a click on a card in the Tasks side bar still opens its tab (decision 3).

### S60: A narrow board
Given the board in a desk under 640 wide
Then the dialog takes the whole board, as the shared dialog does there.

### S61: Screenshots
Given S52, S56 and S60
Then screenshots in Light and Dark go to the Experience lead before the merge.

## Feature: Engineering (E1–E5)

### S62: Fails first
Given each requirement's check
Then `qa-evidence.md` records it failing on `main` at the branch's start, or says why it can't (R2's catalogue, which doesn't exist on `main`, is checked through R4's revert run instead).

### S63: Records unchanged
Given a card opened in the dialog and closed, and a card file's bytes and modified time before and after
Then nothing was written.

### S64: The bundle
Given `media/webview.js` before and after each webview PR
Then `notes/bundle.md` has both sizes and the catalogue's share.

### S65: Docs
Given the sprint's merges
Then `architecture.md`, `CLAUDE.md`'s patch table, `layout-invariants.md`, `docs/CHANGELOG.md`, `incidents.md` row 10 and the release notes draft say what the code does.
