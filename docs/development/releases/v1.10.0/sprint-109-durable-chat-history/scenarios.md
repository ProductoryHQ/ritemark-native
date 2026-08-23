# Sprint 109 Scenarios

BDD examples for [spec.md](./spec.md). These are the manual QA matrix; ★ scenarios must also be automated or exercised by the restart/migration harness.

## Feature: Canonical conversation identity (R1)

### ★ Scenario: First prompt creates one record before dispatch
Given a blank Agent Chat composer
When I send my first prompt
Then one durable conversation record is created before the runtime starts
And the Conversations list shows exactly that record
And hide/show does not change its ID or add a second row

### Scenario: Empty draft stays out of the list
Given I open a new blank conversation
When I switch away without sending anything
Then no Conversations row or durable record is created

### ★ Scenario: Reload does not create a ghost clone
Given a saved current conversation
When the webview reloads and restores its UI state
Then the transcript opens under the same saved conversation ID
And the list contains no fresh-ID copy

### ★ Scenario: Title evolves without changing identity
Given I send the first prompt in a new conversation
Then the list immediately shows a shortened version of that prompt
When the selected runtime completes its first successful response
Then an isolated tool-free one-shot session produces a 3–6-word title in my language
And the classifier turn is absent from the visible transcript and active runtime context
And a title-generation failure leaves the immediate fallback unchanged

### Scenario: Manual rename always wins
Given AI title generation is still in flight
When I rename the conversation from its row
Then the host saves my normalized title under the same conversation ID
And the later AI result cannot overwrite it

## Feature: Crash-safe checkpoints (R2)

### ★ Scenario: Quit immediately after Send
Given a persisted conversation or blank composer
When I send a prompt and terminate Ritemark before the runtime replies
Then reopening the project shows the user prompt
And an inline Interrupted boundary explains that no completed response was saved

### Scenario: Storage write fails before dispatch
Given the conversation store cannot write
When I press Send
Then the runtime call does not start
And the UI explains that the message could not be saved and offers retry

### Scenario: Attention checkpoint survives reload
Given a runtime is waiting for an approval or answer
When the webview is hidden and shown again
Then the conversation still displays the pending user-attention state without changing identity

### ★ Scenario: Restart invalidates stale approval cards
Given a conversation is waiting on an approval, question, or plan review
When Ritemark restarts
Then the transcript restores that prior card as historical/read-only with an Interrupted boundary
And clicking its old actions cannot send a response or mutate runtime state

## Feature: Project isolation (R3)

### ★ Scenario: Switching projects never leaks transcripts
Given Project A and Project B each have conversations
When I open Project B and view Conversations
Then only Project B records are listed
And Project A transcript content is absent from the webview payload

### Scenario: Multi-root order is stable
Given the same multi-root workspace is opened with folders enumerated in a different order
When the project scope is resolved
Then it maps to the same scope ID and conversations

### ★ Scenario: Windows scope and filesystem semantics
Given equivalent Windows workspace URIs differ only by drive-letter case or folder enumeration order
When project scope and atomic record writes are exercised
Then the scope ID is stable
And rename-overwrite, index rebuild, and corrupt quarantine follow tested Windows behavior

### Scenario: No-folder window stays isolated
Given a no-folder window has a conversation
When I open a folder project in another window
Then the no-folder conversation does not appear there
And reopening a no-folder window in this installation finds the same no-folder library

### Scenario: Renamed folder is not guessed
Given a project folder is renamed outside Ritemark
When I open the renamed folder
Then old conversations are not silently attached
And an explicit recovery/relink path can identify the prior scope without exposing other projects’ transcripts

## Feature: Legacy migration (R4)

### ★ Scenario: Known workspace history migrates once
Given legacy localStorage has three valid records scoped to this project
When the new store initializes twice
Then all three records exist once with migration provenance
And the legacy source remains available during the rollback window

### ★ Scenario: Global history is quarantined
Given legacy global history with unknown project ownership
When I open any project after upgrade
Then those entries appear only under Earlier conversations — Project unknown
And none is part of the current-project list until I choose Move to this project

### Scenario: Duplicate ghost records are deduplicated
Given two legacy rows share an ID or normalized transcript fingerprint
When migration runs
Then one canonical record is created
And conflicting non-identical data is preserved for review rather than overwritten

### Scenario: Malformed legacy item does not hide valid history
Given one malformed and two valid legacy records
When migration runs
Then both valid records are available
And the malformed record is quarantined with a diagnostic

## Feature: Lifecycle and deletion (R5)

### ★ Scenario: Switching keeps background work alive
Given Conversation A is Working
When I select Conversation B
Then Conversation A keeps running and remains one record
And its row still says Working

### ★ Scenario: Delete cannot resurrect an open conversation
Given the current conversation is durably stored
When I delete it
Then its record disappears exactly once
And subsequent UI close/dispose callbacks cannot save it again

### Scenario: Undo idle deletion
Given I delete an idle conversation
When I confirm Delete conversation and then choose Undo in the announced notification
Then the same ID, transcript, title, timestamps, and scope are restored
And its binding generation is newer so pre-delete queued events are rejected

### Scenario: Cancel idle deletion
Given an idle conversation is selected
When I open Delete conversation but cancel the confirmation
Then no record, selection, timestamp, or runtime state changes

### Scenario: Undo after Stop and delete
Given a running conversation was stopped and deleted
When I choose Undo in the visible notification
Then the same ID, transcript, title, timestamps, and scope are restored
And an inline Interrupted boundary states that stopped work did not resume

### Scenario: Stop and delete running work
Given a conversation is Working
When I confirm Stop and delete…
Then only that runtime session is stopped and disposed
And only that durable conversation is deleted
And other running conversations continue

## Feature: One Conversations UI (R6)

### ★ Scenario: All conversations owns history; rail shows the automatic working set plus Pinned
Given current, idle, working, and needs-you conversations exist
When I open Conversations
Then all current-project rows are in one list sorted by last activity
And no row has an OPEN badge or persisted open/closed state
And the permanent rail contains New at the top, Pinned shortcuts, the current conversation, every Working or Needs you conversation, the three most recently used idle conversations, and All conversations immediately after the final chat button
And adjacent 40-pixel buttons have 12 pixels of vertical spacing
And each 40-pixel button has approximately 8 pixels of horizontal breathing room inside the 56-pixel rail
And Conversations mirrors permanent shortcuts under Pinned and automatic shortcuts under Active & recent with chat icons and explicit statuses
And every saved conversation remains in All conversations whether or not it is Pinned

### ★ Scenario: Three to five parallel tasks remain available without pinning
Given five conversations are Current, Working, or Needs you and none is Pinned
When their statuses or last activity update
Then all five remain on the rail without any Pin action
And the three most recently used idle conversations are also shown
And older idle conversations remain saved in All conversations

### Scenario: Rail membership is deduplicated and recent idle shortcuts rotate
Given a Pinned conversation is also Working and four idle conversations have distinct real last-activity times
When Ritemark derives the rail
Then the Pinned and Working conversation appears only once under Pinned
And only the three newest idle conversations appear as automatic Recent shortcuts
When an older idle conversation receives new activity
Then it enters the recent set and the least-recent idle shortcut leaves the rail
And neither conversation is deleted, closed, or unpinned

### ★ Scenario: Conversation rail is safe to click and understandable
Given a conversation is Pinned on the rail
Then its button is 40 by 40 pixels inside a 56-pixel rail and uses the 20-pixel Phosphor chat-circle icon
When I click anywhere on that button
Then Ritemark only selects the conversation
And no hover Close, Stop, or Delete target overlaps the button
And status marks do not receive pointer events
And destructive or stop actions are available only from that conversation's All conversations row with explicit wording and confirmation
When I hover the button or focus it with the keyboard
Then a Ritemark tooltip reliably shows its full untruncated title and status to the left
And no native browser tooltip appears on top of or after it
Given an unpinned automatic shortcut is on the rail
When I hover it or focus it with the keyboard
Then the tooltip shows its title and Current, Working, Needs you, or Recent reason without calling it Pinned
And a separate Pin button appears at the shortcut's upper-right corner
When I activate that Pin button
Then the same canonical conversation moves into Pinned without being selected
And it shows a non-interactive pin mark while idle
When I hover or keyboard-focus that Pinned shortcut
Then the passive mark is replaced visually by a separate Unpin button
When I activate Unpin
Then the Pin guarantee is removed without selecting, closing, or deleting the conversation
And if it still qualifies automatically it moves below the divider and remains on the rail

### ★ Scenario: Conversation selection does not reorder Recents
Given three idle conversations appear in descending real last-activity order
When I select the second or third recent conversation
Then the same recent conversations remain in the same order
And only the Current visual state moves
When an older conversation outside the recent set becomes current
Then it is appended after Recents without disturbing their order

### ★ Scenario: Pin and Unpin are explicit and separate from Delete
Given fewer than five conversations are Pinned and another saved conversation exists
When I choose Pin from that conversation's row
Then it becomes a Pinned rail shortcut without changing its transcript or runtime
When I choose Unpin from either its rail shortcut or its Pinned conversation row
Then only its permanent shortcut guarantee is removed
And it remains on the rail if it is still current, Working, Needs you, or one of the three recent idle conversations
And the conversation remains unchanged in All conversations
And Delete conversation remains a separate confirmed action

### Scenario: Pinned shortcut capacity is full
Given five conversations are Pinned
When I inspect Pin for another conversation
Then Pin is disabled and explains Unpin a conversation before pinning another.
And Ritemark does not automatically unpin any conversation
And I can still read, select, create, and run conversations subject only to the separate Send-time runtime limit

### ★ Scenario: Secondary-sidebar shell remains intact
Given Ritemark AI is open in the VS Code secondary sidebar
Then the native title bar shows the Ritemark AI and Terminal composite actions
And AI Settings appears before native maximize and close
And the webview starts below that title bar without a duplicate AI Assistant header
And New, Pinned plus automatic active/recent conversations, and All conversations remain in the right rail
When I open Conversations
Then the panel covers only the webview-owned transcript and composer column
And the 56-pixel conversation rail remains visible and usable
And the native title bar remains visible above it
And the panel header does not add a competing navigation bar

### ★ Scenario: History reveals Delete without deleting immediately
Given All conversations is open
When I hover a standard conversation row or focus within it
Then direct Pin or Unpin and trash icon buttons are immediately visible
And their accessible names include the action plus the full conversation title
When I activate it
Then Ritemark opens the existing Delete conversation or Stop and delete confirmation
And no record is deleted before I confirm

### ★ Scenario: Saved conversations never consume live-attachment capacity
Given the project has 75 idle saved conversations and fewer than five protected live attachments
When I create, read, or select another conversation
Then no make-room or open-thread-cap dialog appears
And starting a turn may release the least-recently-used non-current idle attachment without deleting its record

### Scenario: All live attachments are protected
Given five attachments are running, waiting for the user, or current
When I try to start another turn
Then the turn does not start and the UI says Five conversations are already working or waiting for you. Finish, answer, or stop one before starting another.
And the UI does not say attachment, session cap, or make room
And I can still create, read, select, and delete saved conversations

### Scenario: Background attention while panel is closed
Given two hidden conversations need the user and another is Working
When the Conversations panel is closed
Then Needs you overrides Working on both the All conversations button and conversation rail
And the accessible label says that 2 conversations need me
And opening the panel shows the row with amber marker plus Needs you text

### Scenario: Keyboard and reduced-motion behavior
Given reduced motion is enabled and I use only the keyboard
When I open Conversations, navigate, select a row, and close it
Then focus order and restoration are predictable
And status remains textual without pulse/spinner animation

### Scenario: Row selection focus
Given Conversations is open and I navigate with the keyboard
When I press Enter on a row
Then the panel closes, that canonical transcript is displayed
And focus moves to the transcript/composer in a predictable place

### ★ Scenario: Restored transcript without a live session does not imply restored memory
Given a saved conversation no longer has its matching live runtime session before Sprint 110 continuation exists
When I view its composer
Then an inline notice says previous messages are visible but the agent starts with a new working context
And merely opening the conversation starts no runtime or network action

### Scenario: Live session does not show a false restored-context notice
Given a saved conversation still has its matching live runtime session
When I leave it, select another conversation, and return
Then its working context remains live
And no new-working-context notice is shown

### Scenario: Empty, load-error, and long-title states
Given one project has no conversations, another store query fails, and another row has a very long title
Then the empty state says No conversations in this project yet and offers New conversation
And list/load failure is distinct from one corrupt row
And the long title truncates visually while its full accessible name/tooltip and timestamp remain available

## Feature: Corruption and retention honesty (R7)

### ★ Scenario: Corrupt index is rebuilt
Given the index file is unreadable but three record files are valid
When the store initializes
Then all three conversations are listed after index rebuild
And the corrupt index is quarantined for diagnostics

### Scenario: One corrupt record stays isolated
Given one record file is corrupt among valid records
When I open Conversations
Then valid rows remain usable
And the damaged entry shows Couldn’t open this conversation without creating a ghost replacement

### Scenario: Undo is announced accessibly
Given I confirm conversation deletion
When the Undo notification appears
Then a screen reader live region announces the deletion and Undo action
And focus is not stolen from the current workflow

### Scenario: More than fifty conversations remain
Given the project has 75 valid conversations
When I restart and open Conversations
Then all 75 remain available and none is silently pruned

## Negative and hostile paths

### Scenario: Stale delete callback is idempotent (R5)
Given a deleted conversation still has queued webview or runtime events
When those late events arrive
Then the host rejects them for the tombstoned/unknown ID
And the record is not recreated

### Scenario: Flag rollback never mixes stores (R8)
Given migration completed and the kill switch is disabled for rollback
When Conversations loads
Then exactly one coherent read path is active
And the legacy source is not modified by the new path
And host-only conversations remain readable and writable through the compatibility path

### Scenario: Ambiguous multi-root legacy prefix is not guessed (R4)
Given a legacy scoped prefix was derived from only the first folder of a multi-root workspace
When migration runs in that multi-root workspace
Then the records enter Earlier conversations — Project unknown
And none is assigned to the current project without explicit user action
