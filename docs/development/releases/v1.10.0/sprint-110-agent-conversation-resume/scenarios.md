# Sprint 110 Scenarios

BDD examples for [spec.md](./spec.md). These are the manual QA matrix; ★ scenarios are required in the automated/live continuation matrix where credentials are available.

Phase 0 fixture status: Claude SDK `resume`, Codex `thread/resume`, and OpenCode ACP `session/resume` passed process-restart semantic recall plus two-conversation isolation on the pinned versions. OpenCode `session/load` is deliberately excluded because it replayed history. Fallback scenarios use the frozen 32,000 UTF-8 byte budget.

## Feature: Capability audit and descriptor isolation (R1, R2)

### ★ Scenario: Two native descriptors never cross-bind
Given Conversation A and B use the same runtime and each has a persisted native descriptor
When continuation is triggered concurrently for both conversations
Then each runtime event routes to its matching Ritemark conversation ID
And A never receives B’s native context or transcript events

### Scenario: Descriptor is not exposed to the webview
Given a conversation has a native provider session/thread ID
When the webview initializes and opens the conversation
Then payloads contain continuation status only
And raw provider IDs remain in host storage/debug-redacted code paths

### Scenario: Incompatible descriptor is rejected
Given a descriptor belongs to another runtime, project scope, or incompatible adapter version
When resume is attempted
Then the adapter rejects native binding before prompting
And the tested fallback/unavailable path is selected

## Feature: Same-runtime native resume (R3)

### ★ Scenario: Native context survives restart
Given a runtime that passed the native-resume audit and a conversation where the agent learned a unique fact
When I quit Ritemark, reopen the project and continue with the same runtime
Then native resume succeeds
And the agent can answer from provider context without a transcript-restored warning

### ★ Scenario: Opening is lazy
Given a saved conversation has a valid native descriptor
When I select it and only read the transcript
Then no runtime, authentication flow, network request, native resume, or fallback build starts
And continuation remains not attempted until Send or an explicit Continue action

### ★ Scenario: Expired native session falls back honestly
Given the saved native descriptor is expired or rejected
When I continue the conversation
Then the durable transcript remains intact
And a fresh session receives the normalized context pack
And the transcript states Context restored from transcript

### Scenario: Auth loss does not damage history
Given native resume requires authentication that is no longer valid
When I press Send or explicitly choose Continue
Then the UI says the runtime is unavailable or needs sign-in
And no descriptor/history record is deleted or rebound

### Scenario: Runtime process restart retains isolation
Given two conversations have active native contexts in one shared Codex/ACP process
When the process restarts and both conversations resume
Then each follows its own native/fallback result without event leakage

## Feature: Transcript fallback (R4)

### ★ Scenario: Fallback contains only normalized conversational text
Given history includes user prompts, final assistant answers, tools, approvals, progress, rejected plans, and attachment metadata
When fallback context is built
Then it contains ordered user prompts and assistant final text
And excludes raw tools/results, approval state, progress, rejected plans, hidden prompts, and binary attachments

### ★ Scenario: Newly accepted prompt is sent once
Given I press Send on a restored conversation and the prompt is durably persisted before continuation negotiation
When native resume fails and fallback is built
Then the fallback pack ends at the event before that new prompt
And the new prompt is dispatched exactly once as the runtime prompt

### ★ Scenario: Unanswered request survives a failed-runtime handoff
Given I sent Codex a durably saved request and Codex returned no saved final answer
And I switch to Claude and send “Solve it yourself”
When the cross-runtime fallback context is built
Then it includes the earlier Codex-directed request labelled as unanswered
And excludes Codex partial text, tools, progress, approvals, and opaque runtime state
And “Solve it yourself” is excluded from the context pack and dispatched exactly once as Claude’s runtime prompt
And the UI says the previous agent did not return a saved answer

### Scenario: Dispatch certainty does not erase user intent
Given the previous prompt may be known-unsent, known-accepted, or ambiguous after a runtime failure
And no saved final answer exists
When I confirm Continue with another runtime
Then every state preserves the same canonical unanswered user request in normalized context
And safe metadata distinguishes dispatch certainty without claiming that provider work or memory transferred

### Scenario: Multiple unanswered prompts stay ordered and bounded
Given several durably saved user prompts have no matching assistant final answer
When fallback is built under its size budget
Then the most recent unanswered request is preserved ahead of older complete turns
And any omitted older prompts are disclosed rather than silently disappearing

### ★ Scenario: Oversized transcript truncates deterministically
Given a transcript exceeds the context budget
When fallback is built twice
Then both packs are byte-for-byte equivalent
And preserve the purpose/earliest framing plus the most recent complete turns
And the UI discloses that older context was omitted

### Scenario: Agent rechecks workspace state
Given fallback refers to files changed earlier but contains no tool state
When the fresh agent needs those files
Then its context tells it to inspect current workspace state rather than assume previous tool effects

### Scenario: No usable fallback content
Given a legacy/corrupt entry has no valid normalized turns
When I try to continue it
Then the conversation remains readable
And the UI says previous context is unavailable instead of sending an empty fake history

## Feature: Explicit cross-runtime handoff (R5)

### ★ Scenario: Continue with another runtime requires confirmation
> Superseded by R9 on 2026-08-23 after live smoke feedback; retained as decision history.

Given a non-empty Claude conversation
When I choose Continue with Codex
Then a confirmation explains that Claude’s native working context will not transfer
And no Codex call starts until I confirm
And my composer draft remains intact

### Scenario: Confirmed handoff creates visible boundary
Given I confirm Continue with Codex
When the next turn starts
Then Codex receives the normalized context pack, never Claude’s opaque descriptor
And the transcript records a Codex / transcript-context boundary

### Scenario: Late final answer after interrupted handoff cannot replace the active agent
Given I switched away after the previous runtime failed to return a saved final answer
When the invalidated old binding emits a late final or partial event
Then it cannot enter the new runtime binding or alter its continuation watermark
And it cannot hide, reorder, or mark the unanswered canonical request as resolved

### Scenario: Switching back uses only that runtime’s own descriptor
Given a conversation previously used Claude, then Codex
When I explicitly continue with Claude again
Then only Claude’s compatible descriptor is considered
And Codex’s native thread is never bound to Claude
And Claude receives only canonical events after its `coveredThroughEventId` before the current prompt

### ★ Scenario: Ambiguous crash cannot duplicate handoff delta
Given a runtime may have accepted an uncovered transcript delta but Ritemark crashed before saving the new watermark
When the conversation continues again
Then the adapter reconciles acceptance with provider evidence or abandons that descriptor
And a fresh deterministic fallback is used rather than silently sending the same delta twice

## Feature: Truthful continuation UX (R6)

### ★ Scenario: Transcript-restored warning is visible but not noisy
Given native resume failed and fallback succeeded
When the conversation opens
Then an accessible notice appears before the next turn
And it says Previous messages were included, but this is a new agent session
And after acknowledgement it does not remain as a permanent list badge
And the transcript boundary remains visible in history

## Feature: Lightweight runtime switch disclosure (R9)

### ★ Scenario: Runtime choice applies without a dialog
Given a non-empty Claude conversation and text in the composer
When I select Codex
Then Codex becomes the selected runtime immediately
And no confirmation dialog opens
And my composer draft remains intact
And no Codex call starts until I send a message

### Scenario: Runtime handoff is one quiet line between turns
Given I selected Codex after a Claude turn
When I send the next message
Then a durable inline line appears immediately before that new turn
And it says Continuing with Codex. Previous messages were included as context.
And no duplicate transcript-restored banner or card appears

### Scenario: Selecting another runtime while work is active
Given the current runtime is still working
When I select another runtime
Then Ritemark stops the prior runtime through the existing cancellation path
And late output from the old binding cannot enter the conversation
And the composer draft is preserved for the newly selected runtime

### Scenario: Selecting another runtime without continuing
Given I select another runtime in a non-empty conversation
When I leave the conversation without sending
Then no runtime starts and no synthetic transcript turn is created

### Scenario: Legacy read-only conversation
Given an Earlier conversation has not been assigned/migrated
When I open it
Then I can read it
And the composer explains that I must move it to a project before continuing

### Scenario: No false exact-continuation copy
Given continuation state is transcript-restored or unavailable
Then no visible copy claims the agent remembers everything or picked up exactly where it left off

### Scenario: Truncated and unavailable copy is actionable
Given fallback omitted older turns or the runtime is unavailable
Then truncation says Some older messages were left out
And context unavailable says the conversation is readable but earlier context cannot be used
And runtime unavailable offers sign-in, change-agent, or start-new actions as applicable

## Feature: Continuation-safe conversation rail (R7)

### ★ Scenario: Conversation rail preserves canonical identity
Given Sprint 109 has a permanent automatic-working-set + Pinned conversation rail and canonical All conversations list
When Sprint 110 final navigation loads
Then New remains at the top, Pinned shortcuts and automatic current/active/recent shortcuts follow it, and All conversations remains immediately after the final chat button
And adjacent rail buttons retain 12 pixels of vertical spacing
And selecting or continuing any rail conversation uses the same canonical conversation ID
And its chat-bubble visual remains unchanged
And its Recent position does not change until real conversation activity occurs
And native resume or fallback creates no duplicate rail or history row, corrupts no automatic membership, and never changes Pin state implicitly

### Scenario: Trigger aggregates background attention
Given two conversations need me and another is Working
When All conversations is closed
Then Needs you overrides Working
And the accessible label says that 2 conversations need me

### Scenario: Other projects cannot execute here
Given other project scopes contain conversations
When I open All conversations in the current project
Then no other-project row or transcript snippet is returned
And no All projects action can bind another project’s conversation to this workspace runtime

## Negative and hostile paths

### Scenario: Duplicate turns returned by native history (R3, R8)
Given native resume/read returns turns already present in the canonical record
When reconciliation runs
Then stable turn IDs/fingerprints prevent duplicate display
And conflicts are logged without overwriting canonical user text

### Scenario: Late event from invalidated native session (R2, R8)
Given a runtime handoff invalidated the active binding
When the old provider session emits a late event
Then it is ignored/rejected for the new binding
And cannot modify another conversation or continuation descriptor
