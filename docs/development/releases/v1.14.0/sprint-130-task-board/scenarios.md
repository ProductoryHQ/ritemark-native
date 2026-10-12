# Sprint 130 Scenarios

These are the manual QA matrix on a dev instance. Run the Give to agent rows once per runtime (Claude Code, Codex, OpenCode) unless a row names one. Side bar at 280 px and 420 px.

## Feature: Tasks in the activity bar (R1, R13)

### S1: First look in a project folder
Given a project folder with no `.ritemark/tasks/`
When I click Tasks in the activity bar
Then the Tasks button sits just above Transcribe, the first of Ritemark's own tools
And the side bar shows "Tasks for this project live here. Give any of them to an agent.", the "Add a task…" field and the Open board icon button beside it
And no `.ritemark/tasks/` folder exists yet

### S2: No folder open
Given a window with no folder
When I click Tasks
Then the side bar says "Open a folder to keep a task board" and offers Open folder…
And nothing is written to disk

### S3: Flag off
Given `ritemark.features.task-board` is false
When I click Tasks
Then the side bar shows "The task board is turned off."
And a Claude conversation's system context has no TASK BOARD section and no `ritemark_board` tools

### S4: Badge
Given two cards wait on me and I have not opened Tasks since Ritemark started
Then the Tasks icon shows 2 and its tooltip says "2 tasks need you"
When I mark one done
Then it shows 1, and nothing when none wait

## Feature: Board and cards (R2, R3)

### S4a: What waits on me stands out
Given three calls, one of them an agent waiting for an approval for 12 minutes and the oldest waiting 2 hours
Then the side bar shows Your calls as its own panel with "oldest 2h" and "1 agent can’t continue until you answer"
And each call says how long it has waited
And on the Board tab those three cards have the accent (or amber) left bar and a "Your move" tag, and the header says "3 wait on you · oldest 2h · 1 agent blocked"
When I click that header
Then the Your calls tab opens

### S5: Add from the side bar
When I type "Draft the workshop agenda" in "Add a task…" and press Enter
Then a card appears at the top of To do on both surfaces and the field keeps focus
And `.ritemark/tasks/<id>-draft-the-workshop-agenda.md` exists with `ritemark: task/1`, `stage: todo` and a "Created" history entry

### S6: Open the board
When I press the Open board button beside the add field, then run "Tasks: Open Board"
Then exactly one "Task board" tab is open, showing the view I used last

### S6a: Add without leaving the document
Given the cursor is in a document
When I run "Tasks: Add a Task…", type "Call Maria" and press Enter
Then the card is at the top of To do and the cursor is back in the document where it was

### S6b: Tick off my own task
When I click the circle in front of a To do card
Then it moves to Done with "Marked done" in its history
When I choose Reopen on it
Then it is back in To do

### S6c: Next up and Done when
Then the top card of To do reads "Next up" on both surfaces
When I open a card without Done when
Then its state says "Add what done looks like below. Agents finish better with it."
When I type "One page, three to five themes" in Done when and press Enter
Then the card file has `done_when`, and Give to sends it as "Done when: …" in the first message

### S7: Move by drag and by keyboard
When I drag a card from To do to Doing
Then only that card's file changes and the history says "Moved to Doing"
When I focus a card, open More actions and choose Move to → Done
Then it moves the same way
When I change the stage menu on a card's page
Then it moves the same way

### S7a: A working card stays in Doing
Given an agent is working on a card
Then Move to… and Mark done are disabled and say "(the agent is still working)"
And dragging it out of Doing puts it back with a polite message

### S8: Edit a card
When I open a card and change its title, Done when, body and files
Then the file's front matter and body change accordingly and other keys I added by hand are still there

### S8a: A card opens as a page (revised 2026-10-12)
When I click a card in the side bar, on the board, in Your calls, Ideas or the Log
Then its Markdown file opens in the editor area as a Ritemark document with the card strip on top
And no front matter shows, and the tab reads the card's file name
And the card is highlighted in the side bar while its page is the active tab
When I click another card without editing the first
Then the second page replaces the first in the same tab
When I type in a card's page and then click another card
Then the edited page stays open in its own tab

### S8b: Review on the page
Given a card is Ready to review
When I open it
Then the result sits under the title with Changed files, Check these, Mark done and Ask for changes…
And each file opens in one click
When I press Mark done on the page
Then the card moves to Done and the page shows Done with Reopen

### S8c: The board writes while I type
Given a card's page is open and I am typing in its body
When its agent finishes, or I move the card on the board
Then my typing is kept, the page shows the new state, and no "file is newer" conflict appears
And the file's front matter is the board's, byte for byte, apart from the change

### S9: Files that left the project
Given a card names `docs/plan.md`
When I delete `docs/plan.md`
Then the card shows the file as missing and keeps it in the list
When I try to add a file outside the project through the picker
Then it is refused with a sentence why

### S10: Delete
When I choose Delete… on a card and confirm
Then the file is in the system trash and the card is gone from both surfaces and the Log

### S11: Restore after restart
Given the board tab is open on Ideas
When I restart Ritemark
Then the tab is back on Ideas

## Feature: Data in the folder (R4)

### S12: Edited outside Ritemark
When I change a card's title in another editor and save
Then both surfaces show the new title within one second
When I `git checkout` a branch where a card was added
Then the card appears

### S13: A broken card file
Given I break a card's YAML by hand
Then that card shows "Couldn't read this card", and clicking it opens the file as a plain document
And moving or editing other cards works
And the broken file is byte-for-byte unchanged after five minutes of board use

### S14: Copied card file
When I duplicate a card file in Finder
Then both cards show; the next change to the copy gives it a new id and a history line "Copied from …"

### S15: Interrupted write
Given a card write is interrupted (kill the extension host during a write, dev only)
Then the card file holds the previous or the new version, never a partial one, and a leftover `.tmp-*` file is ignored

## Feature: Give to agent (R5, R6)

### S16: Hand a card to an agent
Given Claude is signed in and the AI sidebar shows another conversation
When I press Give to Claude on "Draft the workshop agenda"
Then the card moves to Doing and reads "Sending to Claude…", then "Queued for Claude", then "Working · Claude"
And the AI sidebar's rail shows a new conversation titled "Draft the workshop agenda" as Working
And its first message is the card's title, description and file paths, with no instructions to the agent in it
And the conversation I had open stays open, and focus stays on the Give button

### S16b: The side bar stays
Given I gave a card to an agent from the Tasks side bar
When the agent finishes
Then the side bar still shows Tasks (not the Explorer), and the card is in Your calls as Ready to review

### S16a: AI sidebar hidden
Given I closed the AI sidebar
When I press Give to Claude
Then the AI sidebar is shown, focus stays where it was, and the card follows the same states

### S17: Result comes back
When the agent finishes and called `report_result`
Then the card shows its report as the result, "Ready to review", "Claude finished in …" and the files it changed, and Your calls lists it
And the card file has `result` (with `files` and `seconds`) and a "Finished: …" history entry
When the agent finishes without calling `report_result`
Then the result is a summary of its last message (Codex and OpenCode: the conclusion, not the first sentence it streamed)

### S17a: Check these
When the agent reports two things to check
Then the result shows "Check these" with both, the call says "2 to check", and the card file's `result.check` has both

### S18: Review
When I press Ask for changes…, type "Shorter, please" in the note box and send
Then the same conversation gets a new turn with my words and the card reads Working again
When I press Mark done after the next result
Then the card moves to Done and leaves Your calls

### S19: Needs you mid-turn
Given the agent asks a question mid-turn (card turns run with autonomy `auto`, as comment tasks do: G7 is out of scope, so a file-write approval does not happen on a card turn)
Then the card reads "Needs you · question", there is no answer box on the board, and Your calls offers Open conversation
When I answer in the sidebar
Then the card reads Working again before the turn ends

### S20: Agent not available
Given Codex is signed out
When I open the Give menu
Then Codex shows "Sign in required"; choosing it offers Sign in and starts nothing
And no handoff record is written

### S20a: The agent can be picked on every agent button
Given Claude is the board's default
When I open the dropdown of Review with Claude on an idea and choose Codex
Then Codex reviews the idea, and every agent button on the board now reads "… Codex"
And Give to…, Review with… and Retry with… in a card's More actions menu list the same three agents
And the note box's Send to Codex ▾ and a failed card's Retry with Codex ▾ offer the same choice

### S21: Stop and retry
When I press Stop on a working card
Then the turn stops, the card reads Stopped and offers Give to Claude again
When the handoff failed (network off)
Then the card reads "Failed · {safe reason}" with Retry, and Retry continues the same conversation

### S22: Ritemark quits mid-task
Given a card is working
When I quit and reopen Ritemark
Then the card reads "Interrupted when Ritemark closed" with Retry

### S23: Three at once
When I give three cards to three agents
Then each gets its own conversation, each card follows its own turn, and finishing one does not change the others

### S23a: Two agents, one file
Given "Draft the steering committee deck outline" is working on findings-draft.md
When I press Give to Claude on "Send the draft to Henrik", which also names findings-draft.md
Then nothing starts; the card says which task works on which file and offers Wait for it, Start now and ×
When I press Wait for it
Then the card stays in To do with "Starts after “Draft the steering…”"
When the deck outline's turn ends
Then "Send the draft to Henrik" starts by itself with Claude, and its history says why
When I press Start now instead
Then it starts at once

### S23b: Doing is full
Given the Doing limit is 3 and Doing holds 3 cards
Then Doing's header reads "3/3 full" and the side bar says "Doing · 3/3"
When I press Give to Claude on a To do card
Then nothing starts; the card says "Doing is full: 3 of 3" and offers Queue it, Start anyway and ×
When I press Queue it and then mark another Doing card done
Then the queued card starts by itself with Claude, and its history says why
When I set the limit to "No limit" from the Doing header
Then queued cards start at once

### S23c: The AI sidebar is busy
Given five conversations are working or waiting on me (cards and my own chats together) and the Doing limit is No limit
When I press Give to Claude on a To do card
Then nothing fails; the card reads "Starts when the AI sidebar has room"
When one of the five finishes
Then the card starts by itself, and its history says why

### S24: Card on another computer
Given a card with a result, copied to another computer
Then it shows the result and history, no Open conversation, and Give to agent starts a new conversation there

### S25: Queued task cannot be edited
Given a card task is queued behind a running turn in its conversation
Then the queue item offers Remove only
When I remove it
Then the card reads Stopped (from queued)

## Feature: Your calls and decisions (R7)

### S26: Agent leaves a decision
When an agent calls `ask_user` on a card with options "Trainers first" and "Consultants first"
Then Your calls shows "Decision for you", the question, those two buttons and Something else…
When I press "Trainers first"
Then the card's history says "You chose: Trainers first", the call disappears and the card's conversation gets that answer as a new turn

### S26a: Order of Your calls
Given one card needs an approval, one has a decision, one is ready to review and one failed
Then Your calls lists them in that order, and the stopped card I also have is not listed

## Feature: Agent tools (R8)

### S27: Turn notes into cards (each runtime)
Given an open conversation not started from a card
When I ask "turn the action items in notes/meeting.md into cards on the board"
Then the agent calls `add_card` for each, the cards appear in To do, and their history says who created them

### S28: Agents cannot finish a card
When I ask an agent to mark a card done
Then `move_card` returns "Only the user marks a card done." and the card stays where it was

### S29: No approval prompt for board tools
Given a conversation in Manual mode
When the agent lists and updates cards
Then no approval card appears for board tools, and file writes still ask as before

### S30: Browser tools unchanged (macOS)
Given browser control is on
Then each runtime still sees the browser tools under the same names as in v1.13.0, and a navigate + snapshot works

## Feature: Ideas (R9)

### S31: Capture and review
When I add the idea "workshop follow-up email template" and press Review with Claude
Then "Good to go" (or Needs detail / Already on the board / Not a task), one sentence why, a size and a suggested title and description appear under it, no conversation is created, and the idea itself is unchanged
When I press Make it a task
Then it moves to the top of To do with the suggested title and description, and its history keeps the original line

### S31a: Drop and bring back
When I press Drop on an idea
Then it moves under the Dropped chip and its file still exists with `dropped: true`
When I press Bring back
Then it is back under To decide

### S32: Review that fails
Given the agent is offline
When I press Review
Then the idea says the review did not come back and offers Review again

## Feature: Log (R10)

### S33: Day by day
Given cards were created, given to agents, finished and marked done over two days
Then the Log shows two days, newest first, each entry linking to its card

## Feature: Narrow width and accessibility (R11)

### S34: 280 px
Then no button row wraps, titles wrap to two lines before they are cut, and every icon button shows a tooltip on hover and keyboard focus

### S35: Keyboard only
Then I can add a card, open it, move it to Doing, give it to an agent, open its conversation and mark it done without a mouse

## Feature: Comment tasks unchanged (R12)

### S36: Comment task regression
When I send a comment to the open conversation
Then it behaves as in v1.13.0, except that an answered approval returns it to Working and its result is the agent's conclusion

### S37: One meaning for "task"
When I open Home
Then the quick action reads "New AI conversation" and starts a new conversation as before
