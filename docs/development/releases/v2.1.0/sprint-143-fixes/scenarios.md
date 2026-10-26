# Sprint 143 Scenarios

The manual QA matrix. Each scenario names its requirement; "S" numbers are stable, a new scenario gets a new number.

Unless a scenario says otherwise it runs on the Mac, on a dev instance of the sprint branch launched hidden (`open -n -g -j`, `--use-mock-keychain`, the three backgrounding flags) with its own short profile under `/private/tmp`, on a port checked to be free, one launch per check (memory: dev-instance CDP isolation; no pop-up test windows). ChatGPT uses Jarmo's own sign-in in the shared `~/.codex`; Claude and OpenCode aren't signed in on this Mac. "On `main`" means the dev tree of `1e91466c`, where the scenario's check must fail first (E1).

## Feature: Home lets go (R1)

### S1: A project switch logs nothing
Given a project window with Home open
When the person switches to another project from Home's list, then back
Then `exthost.log` has no "disposable.dispose is not a function"
And on `main` the same steps log it once per switch.

### S2: Every subscription is let go
Given a `HomeHost` in the unit test, with a project list, watchers and a panel
When it is disposed
Then every subscription's `dispose` ran, the project list has no listener left, and the panel is disposed
And when one subscription throws, the rest and the panel are still disposed.

## Feature: The first chat's AI (R2)

### S3: Twenty welcomes with ChatGPT
Given a fresh profile each time, ChatGPT signed in, Claude not
When `scripts/qa/landing-check.mjs` finishes the welcome with ChatGPT and opens a folder through Open a folder…, 10 times with the update notice and 10 without
Then every run's chat is on ChatGPT, its box reads "Ask ChatGPT about this project", within 30 s of the reload.

### S4: The chosen AI is saved before the reload
Given the welcome finished with ChatGPT
When the window has reloaded into the project, before the AI's sheet has opened
Then the profile's `settings.json` has `"ritemark.ai.selectedAgent": "codex"`.

### S5: A landing that is lost still lands on the chosen AI
Given the landing record is deleted from global storage by hand between the welcome and the reload (A1's forced case)
When the project's window opens
Then its first chat is on ChatGPT (no "Ask ChatGPT about this project", the sheet's usual words)
And the extension host's log says nothing about a landing (there was none).

### S6: A slow model list doesn't send the chat to Claude
Given the landing test with ChatGPT's list arriving 25 s after the landing
Then the chat is on ChatGPT with the landing's words (unit test)
And OpenCode's landing with no provider after 20 s gives up as today.

### S7: A dropped landing says why
Given a landing record for another folder, or older than 10 minutes
When a project window opens
Then the extension host's log names the reason, and no count is sent.

### S8: The update welcome
Given a 1.x profile updated to this build with Claude signed in
When the update welcome is left for a recent project
Then the landing is on Claude, as today, and `ritemark.ai.selectedAgent` was not written by the welcome.

## Feature: The wait on ChatGPT (R3)

### S9: Codex starts as the person set it up
Given the branch's build
When a ChatGPT turn runs
Then `ps` shows the bundled `codex-app-server` with no arguments, as on `main`
And `~/.codex/config.toml`'s modification time is unchanged after the run.

### S10: The retry line
Given a running ChatGPT turn
When the host receives Codex's `error` with `willRetry: true`, "Reconnecting... 1/5" and `httpStatusCode` 429 (the recorded notification, injected through the bridge)
Then the status line reads "ChatGPT is busy. Ritemark will keep trying (1 of 5)." in amber, and Stop is there
And at "2/5" it reads "(2 of 5)"
And when the first text arrives the line goes back to "Working…".

### S11: A retry that isn't a 429
Given the same with `responseStreamDisconnected` and no status
Then the line reads "Trying again to reach ChatGPT (1 of 5)."

### S12: The retries run out on a 429
Given a ChatGPT turn whose final error is `responseTooManyFailedAttempts` with `httpStatusCode` 429 (the recorded JSON)
Then the turn shows one card, "ChatGPT is busy right now" / "Too many requests reached ChatGPT. Wait a few minutes, then send your message again."
And no "exceeded retry limit" in the chat; the provider's words are in the activity row "What ChatGPT said"
And the status line says nothing under the card
And `agent_used` arrives with `outcome: limit`.

### S13: Another AI ready
Given S12 with Claude ready (unit test of the card's copy, since Claude isn't signed in here)
Then the card offers Continue with Claude, as Sprint 139's plan limit does.

### S14: The app-server's side, recorded
Given `research/repro/mock-429.mjs` answering 429 with `Retry-After: 20`
When `research/repro/codex-first-turn.mjs` runs a turn against it through `-c` overrides
Then the client receives `error` with `willRetry: true` twice, 20 s apart, then `willRetry: false` and a failed turn
And the store test fed exactly these messages draws S10 and S12.

## Feature: Titles in the chat's language (R4)

### S15: The title session loads nothing of the person's
Given the unit test of `ConversationTitleGenerator`
Then its one-shot input has `settingSources: []` and `availableTools: []`, and the prompt's language sentence is unchanged.

### S16: ChatGPT, English and Estonian
Given this Mac (region Estonia)
When `scripts/qa/title-language-check.mjs` titles 10 English and 10 Estonian first messages on ChatGPT
Then 10 English titles and 10 Estonian titles come back.

### S17: Claude, at Gate 2
Given Jarmo's Mac with his own Claude sign-in and skills
When he starts five new English chats with Claude
Then all five automatic titles are English.

## Feature: The mention list (R5)

The four ways are A2's; the check is `research/repro/repro-513-507.mjs`, later `scripts/qa/comment-mention-check.mjs`.

### S18: The list by click
Given a document with a paragraph selected and Comment chosen
When the person types "@", clicks @claude in the list, types "Make this warmer" and presses Enter
Then the file's comment is `<mark data-comment="@claude Make this warmer" … data-agent="claude">`, and the comment shows Claude's name and can be sent.

### S19: The list by Enter
Given the same, choosing @claude with Enter
Then the same.

### S20: Typed by hand
Given the same, typing "@claude Make this typed"
Then the same (as on `main`).

### S21: The list at the end of the text
Given "Please look " typed first, then "@" and @claude chosen
Then the comment is assigned to Claude.

### S22: @codex and @opencode
Given S18 with @codex and with @opencode
Then each is assigned to ChatGPT and OpenCode.

## Feature: Line breaks (R6)

### S23: A task card's message
Given a card "Draft Module 4 from the brief" with Done when and two files
When it is given to ChatGPT
Then its message in the chat shows the title, "Done when: …" and "Files: …" on their own lines
And the same after Reload Window.

### S24: A typed message with Shift+Enter
Given three lines typed with Shift+Enter
When sent to ChatGPT
Then the message shows three lines, and Codex's record of the turn has the same text.

### S25: A long path
Given a message holding a 200-character path
Then it wraps inside the bubble and the sheet doesn't scroll sideways.

### S26: Every AI's bubble
Given the unit test of `UserPromptBubble`
Then the text keeps its newlines in an element with `whitespace-pre-wrap`, the bubble used by Claude's, ChatGPT's and OpenCode's views.

## Feature: ⌘⇧P on Home (R7)

The cases are A3's; the check is `research/repro/repro-513-507.mjs`, later `scripts/qa/home-keys-check.mjs`. Each runs three rounds.

### S27: A click on Home's page
Given a project window on Home
When the person clicks Home's title, then presses ⌘⇧P
Then All commands opens.

### S28: A control on Home has the focus
Given a click on Home, then Tab to a control
When ⌘⇧P
Then All commands opens.

### S29: The line's input
Given the line's input open
When ⌘⇧P
Then All commands opens.

### S30: After Home redraws
Given a click on Home, then a file added to the project (Home redraws)
When ⌘⇧P
Then All commands opens.

### S31: Back on Home by its tab
Given the Task board in front, then Home's tab clicked
When ⌘⇧P, with and without a click inside Home first
Then All commands opens.

### S32: The other shortcuts and places
Given S27's steps
When ⌘P and ⌘, on Home, and ⌘⇧P on the Task board, Transcribe and a Ritemark document
Then each opens Quick Open, Settings or All commands.

### S33: Windows, at Gate 2
Given the Windows build
When Ctrl+Shift+P on Home after S27–S31's steps
Then All commands opens each time.

## Feature: Transcribe's formats and Dismiss (R8)

### S34: The Mac converts as today
Given the Mac
When an .m4a is added and On-device chosen
Then it transcribes, as on `main`.

### S35: A computer that can't convert (unit test)
Given `cannotTakeOnDevice` with no converter
Then .m4a and .aac get ".m4a files need converting before they can be transcribed on this device. Use .mp3 or .wav, or transcribe with ElevenLabs." (with their own extension), and .mp3, .wav, .flac and .ogg get nothing
And `_start` refuses On-device for such a file.

### S36: The pending card on Windows, at Gate 2
Given the Windows build and the kit's `Call with the HR lead.m4a`
When it is added
Then the pending card shows On-device disabled with the sentence, and nothing starts
And with ElevenLabs set up, ElevenLabs can be chosen.

### S37: Dismiss a failed card
Given a text file renamed `broken.mp3`, transcribed On-device on the Mac
When it fails into Needs attention
Then its card has Dismiss with the tooltip "Remove this from the list. The recording stays where it is."
And Dismiss removes the card, and `broken.mp3` is still there.

### S38: Dismiss an interrupted card
Given a job stopped mid-way (Cancel), shown as interrupted
Then Dismiss removes it the same way.

## Feature: The pickers with no Desktop (R9)

### S39: A4 on Windows
Given the Windows build with `USERPROFILE=C:\Ritemark` (no Desktop), launched with `--log trace`
When Transcribe a file… three times and Add a project ▸ Open a folder… three times, each cancelled
Then A4 records each dialog's default folder, any `[DialogMainService]` lock line, and the processes left 10 s and 30 s after quitting.

### S40: Every Ritemark picker starts in a folder that exists (unit test)
Given `pickerDefaultUri` with a project folder, a missing one, and none
Then it gives the project folder, then the home folder, then the home folder
And no `showOpenDialog`/`showSaveDialog` call in `src/` lacks `defaultUri`.

### S41: The Windows check, at Gate 2
Given S39's setup on the branch's build
When Transcribe a file… and Add a project ▸ Open a folder… five times each
Then a picker opens every time
And after quitting, no Ritemark process is left after 10 s.

## Feature: Every fix has its check (E1–E5)

### S42: Before and after
Given each check of S1–S41 that can run on the Mac
Then it fails on `main` at `1e91466c` (or, for R2 and R4's ChatGPT half, is recorded as passing there with the reason) and passes on the branch, with the evidence in `qa-evidence.md`.

### S43: 2.0.1 opens what this build wrote
Given a profile with a chat and a commented document written by this build
When the installed 2.0.1 opens a copy of it
Then nothing is quarantined and the comment's assignment is kept.
