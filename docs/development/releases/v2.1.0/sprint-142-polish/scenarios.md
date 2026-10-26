# Sprint 142 Scenarios

These are the manual QA matrix. Each one names the requirement it shows. "S" numbers are stable: a new scenario gets a new number.

**How they run.** Unless a scenario says otherwise, it runs on the Mac:
- on a dev instance launched in the background (`open -n -g -j`), with its own short user-data directory and `--use-mock-keychain` (memory: dev-instance CDP isolation; no pop-up test windows; dev launches need --use-mock-keychain);
- at 1440 × 900 with both side columns showing, in Ritemark Light and then Ritemark Dark;
- on the sample project (Leadership programme), unless a scenario names another project.

One launch serves many scenarios; it is not relaunched per check. Shell-tier scenarios (R2, R7's desk, R12 if patched) need the patches applied to a CoW-cloned `vscode/` in the sprint worktree (memory: CoW-clone vscode for worktree dev).

## Feature: Lists in the AI's answers (R1)

### S1: Bullets
Given a chat on the AI's sheet
When the AI answers with a three-item bulleted list
Then each item has a filled bullet in muted ink
And each item's text starts at the same x as on main (measured)
And the spacing between items is 2 px, with 6 px above and below the list.

### S2: Numbers, as frame 2 offers them
Given the folder-with-files ready request has run (experience 35, frame 2)
When the answer ends with its two offers as a numbered list, then "Say which…"
Then the items read "1." and "2." in muted ink, with tabular figures, hanging in the indent.

### S3: Three levels
Given an answer with a list nested three levels deep
Then the levels show a filled bullet, a hollow bullet and a square.

### S4: A list that starts at 3
Given an answer with `3. Third` then `4. Fourth`
Then the numbers read 3 and 4.

### S5: A task list
Given an answer with `- [ ] Draft` and `- [x] Review`
Then each item shows its checkbox and no bullet before it.

### S6: A plan
Given a Claude chat in Plan only
When the plan review card shows a numbered plan
Then its steps show their numbers, as in S2.

### S7: Dark
Given Ritemark Dark
Then S1–S6's markers are in Dark's muted ink and readable on the sheet.

## Feature: File changes (R2, shell-tier)

### S8: More's File changes
Given a project that is a Git repository
When the person opens More and clicks File changes
Then the left column's head reads "File changes", not "Source Control".

### S9: Its tooltip
Given S8
When the person points at the place (in the places row, if it shows there, or its row in More)
Then the tooltip says "File changes".

### S10: The View menu (if *Open Questions* 4 is yes)
When the person opens View ▸ Advanced
Then the entry reads "File changes" and opens the same panel.

### S11: Inside stays VS Code's
Given S8
Then the panel's own sections (Changes, Repositories, Graph) and its messages are as on main.
And a profile from 2.0.1 that had the panel open opens it in the same place.

## Feature: The project-switch note (R3)

### S12: It shows on one line at Home's foot
Given Leadership programme is open
When the person switches to Team offsite 2027 from the project's menu
Then Home shows "Switched to Team offsite 2027. Leadership programme is kept as you left it." with Go back and ✕
And the note is one line, as wide as its words, centred at the desk's foot, 24 or more from each side.

### S13: It goes after 6 seconds
Given S12, and the person does nothing
Then the note goes 6 seconds after it showed, and doesn't come back.

### S14: Hover keeps it
Given S12
When the person points at the note within 6 seconds and keeps the pointer there for 10 seconds
Then it stays
And when the pointer leaves, it goes 6 seconds later.

### S15: Keyboard focus keeps it
Given S12
When the person tabs to Go back and waits 10 seconds
Then it stays
And when focus moves on, it goes 6 seconds later.

### S16: A press on Home ends it
Given S12
When the person clicks anywhere on Home's page outside the note
Then the note goes at once.

### S17: Typing ends it
Given S12
When the person presses a key in Home, or opens a document and types
Then the note goes at once.

### S18: Files dragged over Home end it
Given a switch to an empty project, whose Home shows "Drop files here"
When the person drags files from Finder over Home
Then the note goes as the drag enters, and "Drop files here" is uncovered.

### S19: Opening something ends it
Given S12
When the person opens a document from Documents, chooses another tab, or sends a message on the AI's sheet
Then the note is gone when they come back to Home.

### S20: A narrow desk
Given S12, with the window at 900 wide (the AI's sheet closed by the layout)
When the desk is too narrow for one line
Then the note wraps, with the ✕ at its end, and nothing goes past the desk's edge.

### S21: Go back still works
Given S12
When the person clicks Go back within 6 seconds
Then the window switches back to Leadership programme, as on main.

### S22: Reduced motion
Given the system's reduce-motion setting
Then the note goes without a fade.

## Feature: Home's path (R4)

### S23: A long path, no gap
Given a project at a long path, such as a temporary folder `…/T/rm-smoke-1234/proj/Leadership programme`
When Home's desk is too narrow for the path
Then the path reads like "…/T/rm-smo…/proj/Leadership programme"
And the gap between the ellipsis and the "/" after it is 0 px, measured from the glyphs' boxes.

### S24: The project's folder is never cut
Given S23
When the desk narrows step by step
Then the start shrinks first, then the parent folder ("proj")
And "Leadership programme" is never cut.

### S25: A folder name wider than the line (*Open Questions* 6)
Given a project folder named with five or more long words, on a narrow desk
Then the folder's name wraps at its spaces onto a second line
And Home doesn't scroll sideways.

### S26: The tooltip
Given S23
When the person points at the path
Then the tooltip's first line is the whole path, and its second "Show its files in Documents".

### S27: A short path; a Windows path
Given a project at `~/Work/Training work`
Then the path shows whole, with no ellipsis.
And on Windows, `C:\Users\Jarmo\Documents\Ritemark\Harbour` cuts at its backslashes the same way.

## Feature: One button, one tone (R5)

### S28: Home's card: hover and press are the whole button
Given the folder-with-files ready request on Home (Training work)
When the pointer rests on the caret
Then the main part and the caret take the same hover fill
And pressing the caret presses the whole button (one scale, one shadow).

### S29: The menu open keeps the rest tone
Given S28
When the person opens Ask with
Then the caret is not darker than the main part, and the whole button shows its rest tone.

### S30: The focus ring is one part's
Given Home
When the person tabs to the main part
Then a 2 px focus ring outlines the main part only
And another Tab moves the ring to the caret only.

### S31: The empty project: the second press opens that chat
Given an empty new project (Board report 2027) and Claude ready
When the person presses "Tell Claude what this project is for"
Then a new chat opens with "This project is for " and the second line, the cursor after "for "
And when they switch to another chat and press the button again
Then the AI's sheet shows that same chat with its box focused, unchanged
And the button never looks disabled.

### S32: The empty project: the request comes back if cleared
Given S31, after the person cleared the box
When they press the button again
Then the box holds the request again, with the cursor after "This project is for ".

### S33: The empty project: the person's words stay
Given S31, after the person typed "This project is for the board's 2027 report"
When they press the button again
Then the chat is focused with their words as they left them.

### S34: The sample's 15 seconds
Given the sample's card "Ask Claude to draft Module 4"
When the person presses it
Then the whole button, caret included, is disabled and reads "Giving it to Claude…" with the spinner
And the note reads "It shows in Doing in a moment."
And when the task shows in Doing, the card goes, as on main.

### S35: Folder with files: a second press (*Open Questions* 1)
Given Training work's card, pressed once (its request sent to Claude, not yet answered)
When the person presses the button again
Then the AI's sheet shows the chat the request went to
And nothing is sent again, and the button was never disabled.

### S36: No AI ready
Given no AI signed in
Then Home's card shows its request's words in the rest tone
And pressing the main part opens Ask with, where each AI shows Sign in or Set up.

### S37: The board's Retry with
Given a task in Doing that failed
When the pointer rests on Retry with's caret
Then the whole button takes the hover fill
And after the press, while it is pending, the whole button is disabled, caret included.

### S38: Review with (outline)
Given an idea in Ideas
Then Review with is one outline frame with a hairline between its parts
And hover lightens the whole frame
And while a review runs, the whole button is disabled, its tooltip saying "Claude is already reviewing this".

### S39: The chosen agent isn't ready (*Open Questions* 2)
Given the board's default agent is ChatGPT, signed out, and Claude is ready
When the person presses "Give to ChatGPT"
Then the agent menu opens, with ChatGPT's row saying "Sign in required"
And the button is in its rest tone, its tooltip saying "ChatGPT is not ready. Choose another agent."
And with no agent ready, the whole button is disabled with "Set up Claude, ChatGPT or OpenCode in the AI sidebar first".

### S40: Send to with no text
Given a card's note box open and empty
Then Send to is disabled as a whole
And typing a word turns the whole button on.

### S41: Dictation (*Open Questions* 3)
Given a document open in the editor
When the pointer rests on the dictation button's language part
Then the whole button takes the hover fill
And while dictation runs, the language part is not faded; pressing it opens the language menu with the languages unavailable and "Stop dictation to change the language"
And while dictation finishes, the whole button is busy.

### S42: Word's Open in Word
Given a .docx open in Ritemark's Word viewer
When the pointer rests on the caret of Open in Word
Then the whole frame takes the hover fill, and the menu opens with the button in its rest tone.

### S43: The spreadsheet's Open in Excel
Given an .xlsx open
Then Open in Excel and its caret are one button in one tone, hover on the whole
And both parts show Ritemark's tooltip on hover and keyboard focus, never a native one.

### S44: Dark
Given Ritemark Dark
Then S28–S43 hold, with Dark's fill, line and ring.

## Feature: Chat Debug (R6)

### S45: The release candidate
Given 2.1's arm64 release candidate, installed
When the person opens More
Then it lists no "Chat Debug"
And `Ritemark.app/Contents/Resources/app/extensions/copilot` does not exist.
And on Windows (Gate 2), More lists no "Chat Debug" either.

## Feature: Sheets' edges (R7)

### S46: The desk's corners, Light
Given Home on the desk, Ritemark Light, 1440 × 900
When the desk's lower right corner is captured at 2×
Then the hairline runs whole round the 10 radius
And the shadow is soft and whole under the bottom and the right edge, or there is no shadow and the hairline is whole (A6's fallback)
And nothing is cut hard.

### S47: The AI's sheet's bottom
Given S46
Then the AI's sheet's bottom corners show the hairline whole and the shadow-xs whole.

### S48: Dark
Given Ritemark Dark
Then the desk and the AI's sheet show hairlines only, whole, with no shadow.

### S49: Two desks; an empty desk; the welcome alone
Given two desks side by side, then an empty desk, then the welcome alone on the ground
Then each sheet's edge follows S46–S48.

### S50: The three brought onto the kit
Given Home's switch note (S12), the Agents place's cards and a Mermaid diagram's expand toolbar
Then their shadows are the kit's, as A6 lists them.

### S51: The frame's measures
Given S46
When `node scripts/qa/frame-geometry.mjs --port <port>` runs
Then every check that passes on main passes, and the desk's edges are where they were.

## Feature: Scrollbars on the ground (R8)

### S52: Transcribe with 19 recordings
Given Transcribe in the left column with 19 recordings
Then the list's scrollbar has no white track, in Light and Dark
And its thumb is thin, shows on hover or while scrolling, and looks like Documents' tree's.

### S53: The other places
Given each left-column webview place A3 lists, filled until it scrolls
Then each scrollbar follows S52.

## Feature: The tooltip after a click (R9)

### S54: Give to Claude, then Stop
Given a task card's page with Claude ready
When the person clicks Give to Claude and moves the pointer off the card
Then Stop takes its place, and its tooltip is not shown
And pointing at Stop shows "Stop the agent. You can give the task again", and moving away hides it.

### S55: The keyboard still gets it
Given a task card's page
When the person tabs to Stop
Then its tooltip shows while it has focus.

### S56: The others that replace themselves
Given the composer and the editor
When the person clicks Send (it becomes Stop), and Start dictation (it becomes Stop)
Then no tooltip stays up after the pointer leaves.

## Feature: The board at 1440 (R10)

### S57: The Mac
Given the Tasks tab at 1440 × 900, with the left column and the AI's sheet showing
Then all four columns show whole, with no sideways scroll on the board
And each card's contents fit their column (a Give to split button keeps its caret).

### S58: Windows at 100%
Given S57 on the Windows test PC at 100% scaling, through the overlay
Then all four columns fit.

### S59: Narrower (*Open Questions* 8)
Given the window at 1300 wide with both side columns
Then the board does as *Open Questions* 8 decides (recommended: four columns down to their least width, then today's sideways scroll).

## Feature: Home at its narrowest (R11)

### S60: The window minimum with the sheet forced open
Given a 402 px wide window, the AI's sheet forced open
Then Home's `scrollWidth` equals its `clientWidth`
And Change image is inside the cover
And the project's name wraps at its spaces, not mid-word ("develo/pment" never)
And each row's time shows under its name.

### S61: Windows, 550 px at 125%
Given the Windows test PC, 125% scaling, a 550 px window, the sheet forced open
Then S60 holds.

## Feature: A restored card's tab (R12)

### S62: The reproducer
Given a task card's page open as a tab (not the active one), and Ritemark quit
When Ritemark starts again and the window restores
Then the tab reads the card's title with the task mark at the first paint
And A2's reproducer, which fails on main, passes.

### S63: The active restored card and the AI's chip
Given a task card's page as the active tab at quit
When the window restores
Then the tab and the AI's chip both name the card by its title.

### S64: A title changed before quitting
Given a card whose title was edited, then Ritemark quit
Then the restored tab shows the new title.

## Feature: Transcribe a file… as a tab (R13)

### S65: From the head
Given Transcribe in the left column and an on-device engine ready
When the person chooses Transcribe a file…, picks an .m4a and chooses the engine
Then the recording opens as a tab in the Transcript Workbench with its progress
And the transcript fills in there when it finishes.

### S66: While typing in a document
Given a document open and the person typing in it
When a file's transcription starts (from the panel's Add recording)
Then the person's typing is not interrupted: the keyboard stays in the document
And the recording's tab is there to choose.

### S67: ElevenLabs
Given the ElevenLabs engine with its key
Then S65 holds.

### S68: Record
Given Record in Transcribe
When a recording is made and its transcription starts
Then it ends the same way as S65.

### S69: Cancelled
When the person cancels the file picker, or the engine choice
Then no tab opens.

## Engineering checks (E1–E6)

### S70: Tests and bundle
`npm test` and the webview's tests pass; `media/webview.js` is measured before and after (E1, E2).

### S71: Windows overlay round
The extension-tier scenarios S28–S43, S52–S53, S57–S58, S60–S61 and S65–S67 on the Windows test PC through the overlay (E4).

### S72: Patches apply
`./scripts/apply-patches.sh --dry-run` applies every patch to the pinned submodule, and the pre-commit validator passes in the worktree (`CLAUDE_PROJECT_DIR="$PWD"`) (E6).
