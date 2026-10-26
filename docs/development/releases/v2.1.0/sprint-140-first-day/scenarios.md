# Sprint 140 Scenarios

These are the manual QA matrix. Each one names the requirement it shows. "S" numbers are stable: a new scenario gets a new number. Unless a scenario says otherwise, it runs on the Mac, in Ritemark Light and Ritemark Dark, on a dev instance launched in the background with its own short user-data directory and `--use-mock-keychain` (memory: `dev-instance-cdp-isolation`, `dev-launch-mock-keychain`). "Each AI" means the scenario is run three times: with Claude, with ChatGPT and with OpenCode. "Training work" is the spike's fictional folder (technical plan, *Phase 1*). A "new project" is one added through the welcome or Add a project… on this profile.

## Feature: What each AI can read (R1)

### S1: The first look reads the newest documents (each AI, Mac and Windows)
Given Training work, new to Ritemark, with each AI
When the person presses Ask <AI> what is here
Then the answer gives the planted fact of each of the five newest documents, or names each one it could not open
And no approval is asked of the person in Auto, nothing fails and nothing runs past three minutes.

### S2: Ritemark's Markdown of a Word file (R1a only, each AI)
Given R1a is built
When the AI reads a Word document in the project
Then its steps show Ritemark's document tool, its answer quotes the document's planted fact, and nothing in the folder changes.

### S3: The document tool refuses what it should (R1a only; negative)
When the tool is asked for a path outside the project, a file that is not a Word document, or a Word file the Office preview refuses for its size or packing
Then it answers with one sentence saying why, reads nothing outside the project and writes nothing.

### S4: Saying what was skipped (each AI)
Given a folder whose newest document is a file no AI can open (a scanned PDF, a password-protected Word file)
When the first look runs
Then the answer says which file it could not open.

### S5: A Word file in front (each AI)
Given `Proposal to Harbour Logistics.docx` open and in front
When the person asks "What did we promise Harbour about the team survey?"
Then the answer comes from that document (R1a), or says it could not open it (R1b), never only from other files without saying so.

## Feature: Home's order (R2)

### S6: A new project's Home
Given a new project with files
When Home shows
Then it draws the cover and head, Waiting for you, the ready request's card, Start something and Last changed, in that order, and nothing else between them.

### S7: Updated from 1.x
Given a profile updated from 1.x, on its first landing
When Home shows a project the first fill found
Then What moved shows under Waiting for you, and no ready request shows, then or after Got it.

### S8: What moved first, then the ready request
Given a profile updated from 1.x and a project added since
When Home shows that project
Then What moved shows and the ready request does not
When the person presses Got it
Then the ready request's card takes its place.

### S9: Waiting for you holds something
Given a card waiting on the person's check in this project
Then Waiting for you lists it first, and the guidance card sits under it.

## Feature: The ready request card (R3)

### S10: A folder with files
Given Training work, new to Ritemark, with Claude ready
Then the card reads "Nothing in this folder was moved or changed", "Claude works only inside it. 37 files: 20 Word documents, 10 PDFs, 4 spreadsheets and 3 text documents", "Ask Claude what is here" and "Reads the names, then the five newest documents.", as experience 35 frame 1 draws it, with the folder icon and the × at the top right.

### S11: The counts line's edges
Given folders holding: one PDF; one of each of six kinds; 10,001 files; a `.ritemark/` folder, dot-files and a pointer `CLAUDE.md`
Then the line reads "1 file: 1 PDF"; names four kinds, most first, and "others" last; "More than 10,000 files."; and counts none of Ritemark's own files or the hidden ones.

### S12: Counting a synced folder downloads nothing (Mac and Windows)
Given a OneDrive folder (Mac and Windows), a SharePoint library and a Google Drive folder, each with online-only files
When Home shows the card
Then the counts line appears within a second, and no file is downloaded (the sync client's state stays online-only for every file).

### S13: An empty project
Given a new empty project with Claude ready
Then the card reads "Start with what this project is for", "A sentence is enough. Claude writes About this project from it, and a first outline as a document.", "Tell Claude what this project is for" and "Nothing goes until you press Send.", with the pencil icon (experience 35, frame 3).

### S14: The sample
Given the sample, copied by the welcome
Then the card reads "Claude can draft Module 4", its body as drawn, "Ask Claude to draft Module 4" and "Reads two documents, writes a new one.", with the check-square icon (experience 35, frame 4).

### S15: Keyboard, screen reader, Dark
When the person moves through the card with Tab, with VoiceOver on, in Ritemark Dark
Then focus reaches the button, its caret and the ×, in that order; VoiceOver reads the heading, the body, "Ask Claude what is here", "Ask with" and "Hide this in Training work"; every text meets 4.5:1.

## Feature: Ask with (R4)

### S16: Choosing another AI
Given Claude and ChatGPT signed in
When the person opens Ask with and chooses ChatGPT
Then the menu shows Claude, ChatGPT and OpenCode with their icons and states, the button reads "Ask ChatGPT what is here", and the body reads "ChatGPT works only inside it."

### S17: Signing in from the card
Given ChatGPT not signed in
When the person chooses ChatGPT's Sign in
Then ChatGPT's own sign-in starts, as on the welcome
When it finishes
Then ChatGPT is chosen and the button names it.

### S18: Setting up OpenCode from the card
When the person chooses OpenCode's Set up
Then the welcome's OpenCode sheet opens over Home
When a key is saved and the person presses Done
Then OpenCode is chosen once it is ready.

### S19: No AI ready
Given no AI signed in or set up
Then the card shows and names Claude
When the person presses the button
Then Ask with opens, and nothing is sent.

## Feature: What the ready request does (R5)

### S20: What is here (each AI)
When the person presses Ask <AI> what is here
Then the AI's sheet shows a new chat in front with that AI, and the message "What is here? Look at the names first, and read only the five newest documents." is sent at once and reads in the chat as the person's own message (experience 35, frame 2).

### S21: An empty project (each AI)
When the person presses Tell <AI> what this project is for
Then a new chat opens in front with that AI, the box holds "This project is for " with the cursor after it and has focus, and nothing is sent.

### S22: The sample (each AI)
When the person presses Ask <AI> to draft Module 4
Then the sample's card "Draft Module 4 from the brief" runs as the board's Give does, with that AI: the board shows it in Doing, and its chat appears on the rail.

### S23: A blank chat is reused
Given the landing's blank chat is open
When the person presses the ready request's button
Then the request goes in that chat; no second blank chat appears.

## Feature: When the ready request shows and goes (R6)

### S24: Answered
Given the first look was sent
When the AI's reply completes
Then the card is gone from Home, and stays gone after Reload Window and after a restart.

### S25: Refused or failed (each AI; negative)
Given the first look was sent with Claude on a free plan, or with the network off
When the request is refused or fails
Then the card stays on Home
When the person presses the button again
Then a new request is made.

### S26: A chat of one's own
Given the card is showing
When the person starts any other chat in this project
Then the card is gone.

### S27: Hiding it
When the person presses the × ("Hide this in Training work")
Then the card is gone in this project only; another new project still shows its own card.

### S28: Not on known projects (negative)
Given a project the list's first fill found from 1.x, and a project added in 2.0 that already has a chat
Then neither shows a ready request.

### S29: An empty project gains files
Given an empty project with its card showing
When the person drops two Word files in
Then the card becomes the folder-with-files kind, with "2 files: 2 Word documents".

### S30: Nothing in the folder changes
Given Training work under Git
When the card shows, its AI is changed, it is hidden, and its request is answered
Then `git status` shows nothing that Ritemark wrote.

## Feature: The answer's two offers (R7, only if built)

### S31: Two offers as cards (each AI)
When the first look's answer ends
Then two offer cards show under it, About this project and one piece of real work named from the folder, as experience 35 frame 2 draws them
When the person clicks one
Then its request is in the box and nothing is sent until they press Send.

### S32: No offers elsewhere (negative)
When the person asks five ordinary things ("Tighten this paragraph", …)
Then no offer cards appear.

## Feature: The AI's empty sheet (R8)

### S33: A project with files, nothing open (each AI)
Given Training work, Home in front
Then the empty chat shows "What shall we work on?", "<AI> can work across your open documents and the whole project." and What is here? · Find what I wrote about… · Write About this project.

### S34: An empty project
Then the starting points are This project is for… · Plan a first document with me (experience 35, frame 3).

### S35: A Word file and a PDF in front (each AI)
Given `Northfield Bank notes.docx` in front, with ChatGPT
Then the starting points are Summarise this in five points · Turn this into a one-page brief · What does this say about…? (experience 35, frame 5); the same for a PDF, unless the spike left that kind out (R1), when the project's points show.

### S36: Short and long text
Given a Markdown document of 19 words in front, then one of 900 words
Then the first shows Fill in the outline · Write a first draft from my notes, the second Tighten this for a client · What is missing? · Add a summary at the top.

### S37: A table
Given a CSV in front, then an Excel file in the table editor
Then both show What stands out here? · Write a short summary of this table.

### S38: The sample
Given the sample, Home in front
Then the starting points are Draft Module 4 from the brief · Summarise the call with the HR lead · What is here?

### S39: Filling, and where the cursor waits
When the person clicks Summarise this in five points
Then the box holds exactly those words with the cursor at the end, focused, and nothing is sent
When they click Find what I wrote about…
Then the box holds "Find what I wrote about " with the cursor at the end
When they click What does this say about…?
Then the box holds "What does this say about ?" with the cursor before the "?".

### S40: Typing moves them aside
When the person types in the empty chat's box
Then the starting points step aside
When the box is emptied
Then they come back.

### S41: About this project exists
Given a project with files and an `AGENTS.md`
Then Write About this project is not offered.

### S42: ChatGPT's notice stays
Given ChatGPT's compatibility notice is due
Then it shows above the starting points.

### S43: Something else in front
Given a web page, a picture or a flow in front
Then the project's starting points show.

## Feature: Empty places (R9)

### S44: Tasks
Given a project with no cards
Then the Task board's Board view and the Tasks side bar draw as experience 29 frame 2, with the ways agreed in J4, and New task on the bar.

### S45: The chats
Given a project with no chats
When the person opens the conversations panel
Then it shows R9's two lines (experience 29, frame 3).

### S46: Transcribe
Given a project with no recordings, with and without an engine set up
Then the empty library says what Transcribe is for and offers Record and Transcribe a file…; the accepted kinds and the engine's first run still show.

## Feature: The doors (R10)

### S47: The status bar (Mac and Windows)
Then the right group reads, left to right, the AI's status, any scheduled tasks, "Send feedback" and the bell; "Report AI issue" is gone; the tooltip reads "Send feedback or report an AI issue"; a click opens the sheet.

### S48: Help (Mac and Windows)
When the person opens Help
Then Send feedback is there, after Support, on the Mac's menu bar and in Windows' menu, and opens the sheet.

### S49: AI information
When the person opens AI information in a chat and presses Report an AI issue
Then the sheet opens titled "Report an AI issue", with the box ticked.

### S50: All commands
When the person runs "Send Feedback" from All commands
Then the same sheet opens.

## Feature: The sheet (R11)

### S51: The straight route, usage data on and off
Given usage data on, then off
When the person types a message and presses Send with neither box ticked
Then the sheet closes, the toast says "Thank you. It's with the people who make Ritemark.", and PostHog's live events (or the local stand-in) show `feedback_sent` carrying the message and nothing else; with usage data off, from a one-off id.

### S52: I'd like an answer
When the person ticks I'd like an answer
Then the note about info@productory.eu appears, the button reads Open in e-mail, the foot reads "Only what you see here goes."
When they press it
Then their e-mail app opens a message to info@productory.eu with what they wrote, and the hand-off sheet shows (S58).

### S53: Keys
When the person presses Enter in the field
Then a new line starts
When they press ⌘Enter (Ctrl+Enter on Windows)
Then the sheet's button is pressed
When they press Escape
Then the sheet closes and nothing goes.

### S54: Nothing typed (negative)
Then Send and Open in e-mail are disabled.

## Feature: Report an AI issue (R12)

### S55: The last answer (each AI)
Given a chat with an answer from the AI
When the person ticks Add the AI's last answer in this chat
Then the answer shows as a quote in the sheet, and the e-mail holds exactly that quote, the version, the platform, the time and what they typed, and nothing else.

### S56: A long answer
Given an answer longer than an e-mail link can carry
When it is ticked
Then the quote shows the shortened text marked as shortened, and the e-mail opens with exactly it.

### S57: No chat (negative)
Given no chat open on the AI's sheet
Then the last-answer box does not show.

## Feature: After pressing (R13)

### S58: Handed to e-mail
Then the sheet reads "Your e-mail app is opening", says it isn't on its way until Send is pressed there, shows what went in, and offers Copy and Done; no word says sent.

### S59: No e-mail app (Windows with no mail account; negative)
Then the same sheet says no e-mail app answered, and Copy copies the whole message.

### S60: Offline (negative)
Given the network off
When the person presses Send on the straight route
Then the sheet stays open with the message, says it didn't go, and offers the e-mail route.

## Feature: The feedback card (R14)

### S61: The third day
Given a profile on which documents were saved on two days of this release
When a document is saved on a third day and Home shows
Then the card shows under Waiting for you (experience 34, frame 1, in experience 35's order).

### S62: The day with a ready request
Given the third saved day falls on a day the ready request showed
Then the feedback card waits
When Home opens the next day
Then the feedback card shows in the ready request's place
When the person presses Not now
Then the ready request returns.

### S63: Once per release
When the person presses Send with a line typed, or Not now
Then the card never shows again in this release, and not after an extension update within it.

### S64: Usage data off, and a send that fails
Given usage data off
When the person sends a line
Then it goes, as the person's own send
Given the network off
When they send
Then the card keeps the line and says it didn't go.

## Feature: Counts (R15)

### S65: The ready request's count (each AI)
Given usage data on
When each kind's request goes to the AI
Then `ready_request_used` arrives once with its kind and provider; for the empty project, only when the filled message is sent.

### S66: A starting point's count
When a filled starting point is sent as it is, then another after editing it
Then `starting_point_used` arrives twice, with the place and `edited` false, then true.

### S67: Made something
When, after a ready request, the AI writes a new document in the project, and later the person exports a PDF and publishes to Google Docs
Then `made_something` arrives once for each way, with `after_ready_request` true
Given a sync client adds a file to the folder
Then nothing is counted.

### S68: The door's count, and no count without a yes (negative)
When the sheet opens from each door with usage data on
Then `feedback_opened` arrives with its `from`
Given usage data off, or the welcome not yet left
Then none of the new events leaves the computer.

### S69: Nothing personal (negative)
When every new event is captured by the local stand-in
Then none carries words, a file or project name, a path, a file count or an address.

## Feature: Nothing is lost (R16)

### S70: The parity walk
Then every row of spec R16's table works from its 2.1 home, on the Mac and on Windows.

## Feature: Windows (E5)

### S71: Before merge 1
Given the latest Windows build from main with merge 1's extension through the test overlay
Then S6, S10, S16, S20–S22 (each AI), S33, S35 and S44–S46 pass.

### S72: After merge 2
Given a Windows build from main after merge 2
Then S47–S60 pass, with Windows' menu, Ctrl+Enter and Windows' e-mail handler.
