# Sprint 145 Scenarios

The manual QA matrix. Each scenario names its requirement; "S" numbers are stable, a new scenario gets a new number.

Unless a scenario says otherwise it runs on the Mac, on a dev instance of the sprint branch launched hidden (`open -n -g -j`, `--use-mock-keychain`, the three backgrounding flags) with its own short profile under `/private/tmp`, on a port checked to be free, one launch per check (no pop-up test windows, no relaunch loops). A scenario that needs no AI gets scratch directories for the AIs' homes (`CODEX_HOME`, `CLAUDE_CONFIG_DIR`, `XDG_CONFIG_HOME`); the user's `HOME` is not changed. "On `main`" means the tree the branch starts from, where the scenario's check must fail first (E1). "The writer" is a plain script that reads and writes the file; no AI is involved unless the scenario says so.

## Feature: Words a person typed and saved stay (R1)

The setup of S1–S8 is a three-line Markdown file in a scratch project, open in Ritemark's editor. "Typing" is key events over CDP at the end of line 3; "auto-save" is waiting for Ritemark's own save.

### S1: The stale write (the reproducer)
Given the file, and the document clean
When the person types a sentence and it auto-saves, the writer reads the file, the person types a second sentence and it auto-saves, and the writer then writes the copy it read with line 1 changed
Then on `main` the second sentence is gone from the editor and from the file, with no question and no log line (the record says whether Ctrl+Z brings it back)
And on the branch Review changes appears, the editor still shows both sentences and the writer's line 1 is on disk, and choosing Keep my version puts both sentences back on disk, Use disk takes the writer's copy, and Compare shows both
And the same on Windows, through the test overlay, ten times.

### S2: A writer that read the latest save
Given the file, a sentence typed and auto-saved, the document clean
When the writer reads the file, and writes it back five seconds later with line 1 changed
Then the editor takes the change silently, as today, and no question appears.

### S3: A writer that writes while the document is dirty (#454)
Given the same, and the person is typing when the writer writes
Then Review changes appears, as it does on `main`.

### S4: A writer rewrites the sentence just typed
Given the person typed a sentence and it auto-saved
When a writer that read the file after that save replaces that very sentence with other words
Then Review changes appears (the words the save wrote are gone), and the person decides. This is the cost named in decision 1.

### S5: Line endings and the byte order mark
Given a file with LF endings, and another with CRLF and a byte order mark
When the writer saves the same words with the other line endings, or with or without the mark
Then no question appears and the document keeps its words.

### S6: A sync client touches the file
Given the file
When only its modified time changes (and, separately, its bytes are rewritten with the same words)
Then no question appears (#454's R11).

### S7: CSV, front matter, CRLF
Given a CSV file, a Markdown file with front matter and a Markdown file with CRLF endings
When S1's steps run on each
Then Review changes appears for each, and S2's steps stay silent for each.

### S8: The limit
Given S1's steps, but the writer writes long after the person's last save (the window's length is the audit's number)
Then the record says what happens, and the issue and the release notes' known limits say it in plain words: a writer that read long ago and writes much later can still win.

### S9: What each AI's tool does
Given a scratch project, a file, and each AI that is signed in on the test Mac (ChatGPT through Jarmo's own sign-in; Claude and OpenCode if signed in)
When the AI reads the file, the file is changed by the writer, and the AI is asked to edit one line
Then the record says, for each, whether its tool refuses a write when the file changed since the read, and what the 27 October sighting's ChatGPT write used (from its session record, if it is still on disk)
And an AI that isn't signed in is listed as not run.

## Feature: A card the board can't read (R2)

### S10: Three cards that time out
Given a file system whose read of three card files times out (a unit test), and a render test of the rows
Then the board lists "Couldn't read · 3", each row says what happened once, in plain words, with no error code and no repeated "Couldn't read"
And on `main` the rows only open the file and say "Couldn't read" twice, with the code.

### S11: Try again, and it reads
Given S10, and the file system now answers
When the person presses Try again on one row
Then the card appears in its column, the row goes, and the count drops.

### S12: Try again, and it fails again
Given S10, and the file still times out
When Try again is pressed
Then the row stays, with the same words, with a quiet moment while it reads; nothing stacks or flickers, and the other rows are untouched.

### S13: Remove asks once
Given an unreadable card
When the person presses Remove
Then one question on the board names the file and says it goes to the Trash (Recycle Bin on Windows)
And Remove in the question moves the file there (checked in the Mac's Trash; on Windows through the overlay), the row goes, and the rest of the board is unchanged.

### S14: Cancel the question
Given S13's question
When the person cancels
Then nothing changes and the file is where it was.

### S15: A card whose front matter doesn't parse
Given a card file with broken front matter
Then its row keeps Open to fix it and has Remove too, and Try again isn't offered for it.

### S16: The Trash can't take the file
Given a file system that refuses to trash
When Remove is confirmed
Then the row stays and says why in plain words.

### S17: Only this board's unreadable files
Given the host's handler
When a request names `../elsewhere.md`, a path, a name that isn't an unreadable entry of this board, or a card that reads fine
Then it is refused and nothing is trashed (a unit test).

## Feature: A dropped card moves at once (R3)

### S18: Where the second goes
Given a project with a board of about 40 cards, some with attached files, on the real disk and again on a file system with delays (and, if the Mac has a cloud-synced folder, in it)
When a card is dropped into another column
Then a table gives the time from the drop to the card's new place, and the share of the host's steps (the read, the rank, the write, the snapshot, the file checks, the wait on the store's tail), in `research/`, before any fix.

### S19: The card lands at once
Given S18's board
When a card is dropped into another column
Then the card is in the new column in the next frame after the drop, before the host has answered
And on `main` it is still in its old column until the snapshot comes.

### S20: The host refuses
Given a card an agent is working on
When it is dropped into another column
Then it goes back to where it was and the notice gives the host's words.

### S21: Doing is full, the card is gone
Given Doing at its limit (a move by an agent), and a card deleted by another surface while it is dragged
Then the card goes back, with the host's notice.

### S22: The write fails
Given a file system that refuses the write
Then the card goes back, with the notice.

### S23: A snapshot arrives mid-move
Given a move pending, and then a snapshot built before the move was written (a unit test, in order)
Then the card does not return to its old column for a frame; the next snapshot that shows it in the new column ends the pending state.

### S24: The other ways to move
Given Move to…, Mark done and Reopen, on the card menu and on a card's page
Then each moves the card at once and goes back on a refusal, as S19–S22.

### S25: The quiet sign, and a drop within a column
Given a save made slow, the card shows the sign the Experience lead drew, and a fast save shows none
And a drop within the same column reorders at once.

## Feature: Selecting a Flow step writes nothing (R4)

### S26: The store (unit test)
Given `onNodesChange`
Then `select` and `dimensions` changes leave `isDirty` false; `position` (a drag), `add`, `remove` and `replace` set it.

### S27: The harness
Given Sprint 144's headless harness (`docs/development/releases/v2.1.0/sprint-144-release-harness/research/repro/flow-step-panel/shoot.mjs`)
When a step is clicked
Then no `flow:save` is posted within two seconds
And on `main` one is.

### S28: Real edits still save
Given a flow in a dev instance
When a step is dragged, a field is edited, a step is added and a step is removed
Then each saves once after its debounce.

### S29: Opening writes nothing
Given a flow file with a known modified time
When it is opened and a step is selected
Then the modified time is unchanged.

## Feature: A step without its key (R5)

### S30: The OpenAI image step, no key
Given no OpenAI key
When an OpenAI image step's panel is open
Then it reads "This step needs an OpenAI API key to run. Add it in Settings", with "Add it in Settings" as a link whose tooltip is "Open Settings at the OpenAI API key"
And the link opens Settings scrolled to the OpenAI key's card
And its model list no longer says "OpenAI API key not configured".

### S31: An AI step on OpenAI, no key
Given an AI step on OpenAI and no OpenAI key
Then its panel shows the same sentence and link
And running it fails with the sentence as plain text.

### S32: An AI step on Gemini, no key
Given an AI step on Gemini and no Google AI key
Then the sentence is "This step needs a Google AI API key to run. Add it in Settings", the tooltip "Open Settings at the Google AI API key", and the link opens that key's card.

### S33: The Google image step
Given a Google image step and no key
Then it reads and behaves as it does on `main` (Sprint 144).

### S34: Keys set
Given both keys set
Then no panel shows a sentence, the steps run as before, and the webview never receives a key.

## Feature: The failed turn's done card (R6)

### S35: Ink, not green
Given a failed turn whose card is done
Then its check is in ink (as "You're all set!"), with the background the Experience lead chose, in Light and Dark (a render test and screenshots).

### S36: The other greens
Given the list of the other uses of the success colour
Then the Experience lead has marked each as the ready dot or not, and none changed without that word.

## Feature: Settings' version (R7)

### S37: The label
Given the label helper
Then `2.2.0-0` shows as `2.2.0`, `2.2.0-ext.1` as `2.2.0-ext.1`, `2.2.0` as `2.2.0`, an empty value as empty (unit tests)
And Settings on a floored build reads "App 2.2.0 · Extension 2.2.0".

### S38: Updates are unaffected
Given the update service's tests
Then they pass unchanged, on the floored version.

## Feature: The release logs (R8)

### S39: The font request
Given a fresh hidden launch with the network listed over CDP
Then every font request is at a real place, `main.log` has no "Refused to load resource /phosphor.woff2", and the icons still draw (a screenshot)
And before the fix the list shows which request asked for the root.

### S40: DEP0169
Given a fresh launch, and several window loads
Then `exthost.log` has no DEP0169 line at error level
Or the record shows the stack, names the caller as VS Code's own, and says what stays.

### S41: On the candidate
Given 2.2's arm64 candidate
Then S39 and S40 hold in its logs (Gate 1).

## Feature: A project switch (R9)

### S42: The measurement
Given `node scripts/qa/project-check.mjs --port <port> --switch-to <folder> --measure 10`
When it runs on `main`'s dev build and on the shipped 2.1.0
Then a table gives, for each switch, the time of the first tab, of Home in front, of a document in front first, and of the AI column, with the markers that name who shows the AI column.

### S43: After the fix
Given the same, both directions
Then in 10 of 10 switches no document is in front before Home, and the AI column is within 300 ms of Home, either order.

### S44: The first switch
Given a launch whose first switch starts from a project left on Home
Then that switch passes too; if the first switch is the outlier because of the launch, the record says so.

## Feature: The first Windows start after an update (R10)

### S45: The reproduction (Windows)
Given a 1.14.0 install whose AI column had a terminal at quit, updated to the 2.1.0 installer
When the app starts the first time
Then the times a restored terminal is in front before the welcome and after it are recorded (the issue: about 12 s, and 0.2 s)
And a warm second start is recorded clean.

### S46: After the fix (Gate 2)
Given 2.2's Windows build, S45's steps
Then a restored terminal is never in front of the welcome.

### S47: The Mac, and a terminal the person opens
Given a dev instance with a held extension host on the Mac, and a profile with a restored terminal
Then the record says whether the Mac shows it
And a terminal the person opens themselves still opens in front, named Terminal, Terminal 2, as before.

## Feature: ⌘⇧P on Home (R11)

### S48: A real keyboard on Windows
Given the Windows build and a project window on Home
When a person presses Ctrl+Shift+P ten times in each of: after a click on Home's title; after Tab to a control; in the line's input; after Home redraws (a file added to the project); after coming back to Home's tab from the Task board
And Ctrl+P and Ctrl+, in the first of them
Then All commands, Quick Open and Settings open every time, or each failure is recorded with the active elements and whether the key was forwarded.

### S49: The Mac
Given Jarmo's ten presses per case at 2.1's Gate 1 (all opened)
Then they are not repeated unless S48 fails.

## Feature: The Electron (R12)

### S50: Availability
Given Electron's release list
Then the newest 43.x and its Node version are recorded with the date, at the sprint's start and before the candidate.

### S51: If a fixed Electron exists
Given a 43.x on Node 24.22.1 or later
When patch 020 moves to it
Then `./scripts/apply-patches.sh --dry-run` passes, the checksums are Electron's own, About shows the Node version, the native-module check passes, and the extension host and the integrated browser start.

### S52: If none exists
Given no such Electron when the candidate is built
Then the risk is in the release plan and on the issue, with Sprint 144's finding, and Jarmo's answer to decision 4 is recorded.

## Feature: Every fix has its check (E1–E5)

### S53: Before and after
Given each unit check and scripted run
Then it was run on `main` first and its failure recorded, or the evidence says why it couldn't be (E1).

### S54: Records unchanged
Given a card, a flow and a document written by this build
Then 2.1.0 opens them unchanged (E2).

### S55: Bundle and docs
Given the branch
Then `media/webview.js` is measured before and after, `architecture.md` and `docs/CHANGELOG.md` say what changed, and the release notes lines are drafted (E4, E5).
