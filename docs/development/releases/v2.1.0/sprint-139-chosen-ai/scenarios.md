# Sprint 139 Scenarios

These are the manual QA matrix. Each one names the requirement it shows. "S" numbers are stable: a new scenario gets a new number.

Unless a scenario says otherwise, it runs on the Mac, on a dev instance launched in the background with its own short user-data directory and `--use-mock-keychain` (memory: dev-instance CDP isolation; no pop-up test windows). Usage data is on, and the PostHog key points at a local stand-in that logs what arrives (memory: CDP folder picker + PostHog stand-in, #469). "Signed in" uses Jarmo's own Claude and ChatGPT sign-ins on the Mac, except where a scenario names a test account. Those accounts are signed in under a separate macOS user, never in Jarmo's own (*Open Questions* 5).

## Feature: Which plans work, before sign-in (R1)

### S1: The step-1 cards on a fresh profile
Given a fresh profile with no AI signed in
When the welcome opens
Then ChatGPT's card says "Sign in with any plan, free included."
And Claude's card says "Sign in with a paid plan, such as Pro or Max."
And OpenCode's card says "Open models, with an API key of your own."
And no other notice is on the sheet, and the word Codex appears nowhere.

### S2: Add another on the update welcome
Given a v2.0.1 profile updated to this build with Claude signed in, and the update welcome showing (or a test profile set up to show it)
When the person clicks Add another
Then ChatGPT's and OpenCode's cards show their plan lines as in S1.

### S3: A card with a state shows the state
Given Claude is signed in before the welcome opens
Then Claude's card shows Checking…, then Signed in, and no plan line
And when a ChatGPT sign-in has ended, ChatGPT's card shows that reason, not its plan line.

### S4: Settings
Given no AI is set up
When the person opens Ritemark Settings
Then Claude's card leads with "Sign in with a paid plan, such as Pro or Max." and still offers its API key
And ChatGPT's card leads with "Sign in with any plan, free included." and still says paid plans get higher limits
And the OpenCode section says "Open models, with an API key of your own."

### S5: The AI sheet's sign-in cards (if *Open Questions* 2 is yes)
Given the welcome was skipped, and a project is open with no AI
When the AI's sheet shows its sign-in cards
Then Claude's and ChatGPT's cards carry the same lines as S1.

## Feature: When Claude refuses for the plan (R2)

The words in these scenarios are the drawn draft. They change only after A1, spec first.

### S6: A Claude Free account's first message
Given the Claude Free test account is signed in, and a project is open
When the person sends "What is here?" to Claude
Then the chat shows Ritemark's card in place of an answer, with no AI name above it: "Claude needs a paid plan here", the body sentence, Use ChatGPT, See Claude's plans and the muted line
And the status line under it says nothing
And no raw error text is in the main line.

### S7: Use ChatGPT, signed in
Given S6, and ChatGPT is signed in
When the person clicks Use ChatGPT
Then a new chat with ChatGPT opens and sends "What is here?"
And ChatGPT's answer arrives in the new chat
And the Claude chat still shows its card, unchanged.

### S8: Use ChatGPT, not signed in
Given S6, and ChatGPT is not signed in
When the person clicks Use ChatGPT
Then ChatGPT's own sign-in starts, as from the welcome
When it finishes
Then the new chat sends "What is here?".

### S9: Use ChatGPT, sign-in cancelled (negative)
Given S8's sign-in in progress
When the person cancels it
Then the new chat stays open, with "What is here?" in its message box, unsent.

### S10: A refused message with an attachment
Given the refused message had a file attached
When the person clicks Use ChatGPT
Then the new chat's message box holds the text, nothing is sent, and the person can attach the file again.

### S11: See Claude's plans
When the person clicks See Claude's plans
Then Claude's pricing page opens in the browser, with no question from Ritemark first.

### S12: The status bar
Given S6
Then the status bar's AI item reads "Claude needs a paid plan" with an amber dot
When a message goes through, with ChatGPT after S7 or with Claude after an upgrade
Then the item returns to its usual state
And clicking the item while it shows the plan opens the AI's sheet.

### S13: After a restart
Given S6
When Ritemark restarts and the chat is opened again
Then the same card shows in its place.

### S14: A refusal at sign-in (only if A1 finds one)
Given A1 found that Claude refuses a free plan at sign-in, or that the plan can be read at sign-in
When the person signs in to Claude on the welcome with the Claude Free account
Then Claude's card says the body sentence, with Use ChatGPT and See Claude's plans, and the welcome doesn't treat Claude as ready
And Settings' Claude card says the same.

### S15: A ready request on Home (with Sprint 138)
Given Sprint 138's ready request on Home, and the Claude Free account
When the person presses Ask Claude what is here
Then the chat shows S6's card, and Home's card stays in place.

### S16: Other Claude failures never show the plan card (negative)
Given Claude signed in on a paid plan
When a turn fails for another reason (an ended sign-in, a refused model, no connection)
Then the plan card does not show; R3's or R4's words do.

## Feature: One sentence, once, with one way on (R3)

### S17: A Codex error envelope
Given ChatGPT signed in
When a turn fails with Codex's JSON envelope (the #376 shape, reproduced with a refused model, or injected through the bridge's message trace)
Then one sentence shows, the one inside the envelope or R4's card, and the JSON shows nowhere in the chat
And the status line says "Failed" (or nothing under a card)
And the sentence is not repeated anywhere else in the chat.

### S18: Claude's status line
Given a Claude turn fails with an error that has no card
Then the sentence shows once in the turn, and the status line says only "Failed".

### S19: ChatGPT's sign-in ended
Given ChatGPT's sign-in has ended (signed out in Codex, or a stale token)
When the person sends a message with ChatGPT
Then the turn says "Your ChatGPT sign-in has ended. Sign in again, then send your message again." with Sign in to ChatGPT, which starts ChatGPT's own sign-in.

### S20: No connection
Given the network is off
When the person sends a message with any AI
Then the turn says Ritemark couldn't reach that AI and to check the connection, once, with no JSON.

### S21: A restored failed turn
Given S17 or S19
When Ritemark restarts and the chat is opened again
Then the same sentence or card shows.

### S22: Comment tasks and task cards
Given a comment assigned to ChatGPT, and a task card given to OpenCode, each failing with a provider envelope
Then the comment's bubble and the card's failure say the same unwrapped sentence as the chat.

### S23: An answer about an error is not an error (negative)
Given a turn whose answer quotes an error message (for example "The API returned invalid_request_error…")
Then the answer shows as an answer, with no card and no "Failed".

### S24: The raw text stays for diagnosis
Given S17
When the person opens the turn's activity details, or Report AI issue
Then the provider's raw text is there.

## Feature: A model the AI refuses (R4)

### S25: ChatGPT refuses the model
Given ChatGPT signed in, and a chat on a model Ritemark's Codex can't run (or the refusal injected through the bridge)
When the person sends a message
Then the card reads "ChatGPT couldn't use <model>", "It isn't available in Ritemark right now. Switch to <default>, then send your message again.", with Use <default> and its tooltip
When the person clicks Use <default>
Then the chat's model switches, nothing is resent, and the card reads "Switched to <default> — send your message again when you're ready."

### S26: The default is the model that failed
Given the refused model is the catalog's default
Then the card has no button, and its message ends "Choose another model in the model menu below."

### S27: Claude refuses the model
Given Claude, and a model the account can't use (Sprint 127 R6's case)
Then the same card shows, with Claude's name.

### S28: OpenCode's provider doesn't have the model
Given OpenCode with a Google key, and a model id Google doesn't serve
Then the same card shows, and since OpenCode has no catalog default, it has no button and says to choose another model.

## Feature: Limits, quotas and credits (R5)

### S29: Google credits through OpenCode
Given OpenCode with a Google key whose project has no credits left (the case Jarmo met on 24 October)
When the person sends a message
Then the turn says "Google stopped this request: your Gemini API credits have run out." with a button that names Google's page
When the person clicks it
Then that page opens (with no question, or as A3 decides).

### S30: An OpenAI key's quota through OpenCode
As S29, with an OpenAI key out of quota, naming OpenAI.

### S31: ChatGPT's usage limit
Given ChatGPT has hit its plan's usage limit (the Free test account, if A1's session can reach it), and Claude is ready
Then the turn says the limit is used and when it resets, with Use Claude
When the person clicks Use Claude
Then a new chat with Claude asks the same.

### S32: A limit with no other AI ready
As S31, with no other AI ready: the sentence only, with no button.

## Feature: A chat keeps its model after a restart (R6)

### S33: ChatGPT
Given a ChatGPT chat that ran on a model other than the default
When Ritemark quits and opens again, and the chat is opened
Then the model button shows that model
When the person sends a message
Then it runs on that model, and no "Previous messages were included as context." line appears.

### S34: Claude
As S33, with a Claude chat on a model other than the app-wide last pick.

### S35: OpenCode
As S33, with an OpenCode chat on a model other than the first configured one.

### S36: The Conversations list
Given two chats on different models with the same AI
When the person opens the older one from the Conversations list, in a running window
Then it shows its own model, not the open chat's.

### S37: A pick without a send
Given a saved chat
When the person picks another model and quits without sending
Then after a restart the chat shows the picked model.

### S38: A saved model no longer offered
Given a chat saved on a model the catalog no longer offers (a test catalog, or a feed tombstone on a dev run)
When the chat is opened after a restart
Then the model button shows the catalog's default
When the person sends
Then the chat says once, before the turn, "<model> isn't available right now — using <default>."

### S39: A chat saved by 2.0
Given a chat saved by 2.0.1, with no saved model
When it is opened in this build
Then it behaves as in 2.0.1
And after one turn, a restart keeps that turn's model.

## Feature: Count each AI turn (R7)

### S40: Chat turns
Given usage data on
When the person sends one message each with Claude, ChatGPT and OpenCode
Then the stand-in logs three `agent_used` events, with `agent` `claude`, `chatgpt` and `opencode` and `source: chat`, and nothing else beyond the shared properties.

### S41: Flow steps
Given a Flow with a Claude step, a ChatGPT step and an LLM step
When it runs
Then the stand-in logs `agent_used` for `claude` and `chatgpt` with `source: flow`, and `feature_used` with `feature: flow_llm_step` for the LLM step.

### S42: A continuation is not a new turn
Given a Claude turn in Ask mode that waits for an approval
When the person approves and the turn carries on
Then one `agent_used` was logged for that turn, not two.

## Feature: The first reply's outcome (R8)

### S43: The first reply arrives
Given a fresh profile, the welcome finished with usage data on
When the person sends the first message and the answer arrives
Then the stand-in logs `first_message_sent`, then `first_reply` with `outcome: arrived`, and no text.

### S44: The first reply is an error
Given a fresh profile, the welcome finished with the Claude Free account (or with ChatGPT and the network dropped after the send)
When the first message fails
Then `first_reply` carries `plan` (or `network`).

### S45: No reply (negative)
Given a first message sent
When the window is closed before the turn ends
Then no `first_reply` is logged.

### S46: A message that failed to save (negative, the adjacent fix)
Given the conversation store fails to save the message (a test hook)
Then no `first_message_sent` is logged, and the next message that is saved is counted as the first.

### S47: Usage data off, and dev runs
Given usage data off on the welcome
When the person sends messages, dictates and runs a Flow
Then nothing reaches the stand-in, and no marker or voice list is written in globalState
And on a run from source with usage data on, every event carries `build_channel: dev`.

## Feature: Voice captures that become drafts (R10)

### S48: Captures
Given usage data on
When the person dictates a sentence into a document
Then `voice_captured` with `source: dictation` is logged once for that dictation
When the person records in Transcribe and the recording becomes text, then transcribes an audio file
Then `voice_captured` with `source: transcribe` is logged twice, with `input: recorded`, then `input: file`.

### S49: Edited again on a later day
Given S48's dictated document, and the computer's clock (or the list's stored day, through a test hook) a day later
When the person changes the document and it saves
Then `voice_note_edited` with `source: dictation` and `days_since_capture: 1` is logged once
And further saves log nothing more for that capture.

### S50: Not counted, and forgotten (negative)
Given a dictated document
When it saves again on the same day
Then nothing is logged
And a capture older than 30 days is no longer in the list and logs nothing
And turning usage data off in Settings clears the list at once.

## Feature: The same for Claude, ChatGPT and OpenCode (R12)

Each run is one launch, reused for every step (memory: no pop-up test windows), against the stand-in. Each records screenshots and the stand-in's log in the QA evidence.

### S51: The Claude run
Given a fresh test profile, the welcome finished with Claude
Then step 1 showed the plan lines (S1)
When the person sends a first message
Then the answer arrives, and `first_message_sent`, `agent_used` (`claude`, `chat`) and `first_reply` (`arrived`) are logged
When the person picks a model other than the default, sends, and Ritemark restarts
Then the chat shows that model, and the next turn continues Claude's own session
When a turn is forced to fail (a model the account can't use)
Then the failure shows as one sentence or R4's card, once, with "Failed" or nothing on the status line.

### S52: The ChatGPT run
As S51, with ChatGPT. The forced failure is a model Ritemark's Codex can't run, or a refusal injected through the bridge (memory: webview bridge trace + hold-back).

### S53: The OpenCode run
As S51, with OpenCode and the test key (*Open Questions* 7). The forced failure is a model id the provider doesn't serve.

### S54: Windows
Given the latest Windows build from main with this branch's extension through the test overlay
When S51 and S52 run on the Windows PC (and S53 if a key is in its vault)
Then the results match the Mac's.

## Feature: The bets' insights and the privacy page (R9, R10, R11)

### S55: The insights
Given S40–S50 run from source with `RITEMARK_POSTHOG_PROJECT_KEY` set to Ritemark's PostHog project, so their events arrive marked `build_channel: dev`
When R9's and R10's insights are filtered to `dev` for the check
Then R9's insight shows the share of users with two or more agents
And R10's insights show voice captures per week and notes edited again
And the insights are left filtered to `prod`, as the bets read them.

### S56: What is sent matches what the page says
Given every new event from S40–S50 in the stand-in's log
Then each property sent appears in R11's lines, and nothing in the log is outside them.

## Feature: Records stay readable both ways (E2)

### S57: 2.1 and 2.0.1 on the same chats
Given a profile whose chats were written by this build (a saved model, a plan card, a model card)
When the installed 2.0.1 opens the same profile (in its own instance, on a copy)
Then every chat opens, none is quarantined, and each failed turn shows its saved sentence, without 2.1's cards
When this build opens the profile again
Then the chats open, and those that 2.0.1 wrote back have lost only their saved model.
