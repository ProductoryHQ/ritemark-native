# Sprint 74 Spec

## Purpose

This sprint addresses four discrete quality issues in the AI sidebar and the Ritemark editor: a broken plan review card (the Approve button silently no-ops), input locked during agent runs, a cosmetic scrollbar on code blocks, and a missing Display text field in the Edit Link modal. Together they bring the AI interaction loop and the document editor to a higher fit-and-finish bar.

## Principles

- Do not regress any existing plan-approval or chat-input behaviour.
- Fix state bugs with targeted surgical changes; avoid refactoring unrelated code paths.
- CSS changes must not affect mermaid blocks or any other specialised block type.
- The Edit Link modal must remain fully backwards-compatible — existing links without display text are not affected.

---

## Requirements

### R1: Plan review card — readable plan preview and working Approve/Reject buttons

As a user reviewing a Claude plan, I want to see the plan text clearly and have the Approve and Reject buttons work, so I can control the agent's next action.

**Root cause (established during research):**
`AgentResponse.tsx` line 89 computes `needsApproval` as:
```
turn.isPlan && !turn.planHandled && !turn.pendingPlanApproval
```
The `!turn.pendingPlanApproval` condition excludes the exact turns that carry a live approval request. When `pendingPlanApproval` is set, the whole approve/reject UI block inside `AgentResponse` is suppressed. The `AgentView` renders the live `AgentPlanApproval` card correctly via `turn.pendingPlanApproval`, but `AgentResponse` (which handles the finished-turn case shown after the result arrives) still has the inverted condition.

`store.ts` `approvePlan`/`rejectPlan` both guard with `if (!targetTurn?.pendingPlanApproval) return;` — so clicking Approve when `pendingPlanApproval` is undefined is a silent no-op.

`PlanReviewCard` itself renders correctly when it receives data; the rendering issue is that `AgentResponse` also calls `extractPlanDisplayText` on `turn.planText` but never shows it because the `needsApproval` block is hidden by the inverted condition.

Acceptance criteria:
- When the agent sends a plan-approval request (`pendingPlanApproval` set, `isPlan = true`, turn still running), the `AgentPlanApproval` card in `AgentView` shows the plan text extracted via `extractPlanDisplayText(turn.planText)`.
- Clicking Approve dispatches `agent-answer-plan` to the extension host with `approved: true` and the correct `toolUseId`.
- Clicking Reject with optional feedback dispatches `agent-answer-plan` with `approved: false` and the feedback string.
- After the turn completes (result arrives, `isRunning = false`), a plan-approved/rejected label is shown by `AgentResponse` with no broken button state.
- The `AgentPlanApproval` plan text box shows rendered Markdown (via `RenderedMarkdown`) at a readable font size, not raw text.
- If `planText` is empty (the agent sent no thinking text), the plan preview section is hidden but the buttons remain visible.

### R2: Composer — unlock input while agent is running (Level 1)

As a user waiting for an agent to finish, I want to be able to type my next prompt while the agent is still running, so I am not blocked from preparing follow-up work.

**Scope: Level 1 only.** Level 2 (queuing and auto-send on completion) is explicitly out of scope for this sprint. Only the input-unlock (textarea enabled, value accepted, send deferred until agent completes) is delivered here.

Acceptance criteria:
- While `isLoading` is true (agent running), the `ChatInput` textarea is **not** disabled — the user can type freely.
- The Send button remains hidden/replaced by Stop while the agent is running (pressing Send before completion does nothing; only Stop is actionable).
- The value typed while the agent runs is preserved and available to send once the Stop button transitions back to Send.
- The attach-file button remains disabled while the agent is running (it opens a dialog that would disrupt workflow).
- Placeholder text does not change — it continues to read the normal prompt hint.
- Switching away from agent mode to chat mode while the textarea has pre-typed content clears the textarea (existing `setValue('')` on handleSend already handles this for normal sends; no regression).

### R3: Code block — remove unnecessary horizontal scrollbar

As a user reading content with code blocks, I want code blocks to not show a horizontal scrollbar when the code fits within the visible width, so the UI does not look broken.

**Root cause (established during research):**
`index.css` sets `overflow-x: auto` on `pre` elements (the code block container). `overflow-x: auto` shows a scrollbar whenever the scroll content width slightly exceeds the container, which happens due to padding/border-box rounding even when no code line is actually long enough to warrant scrolling.

Acceptance criteria:
- Short code blocks (content narrower than the panel width) show no horizontal scrollbar.
- Long code blocks (content genuinely wider than the panel width) still show a horizontal scrollbar so the user can scroll to see the full line.
- Mermaid blocks (`mermaid-block` / `.mermaid-block--diagram`) are unaffected.
- Fix applies to both the editor-embedded code blocks and any code blocks rendered inside `RenderedMarkdown` in the AI sidebar.

### R4: Edit Link modal — optional Display text field

As a user editing a link in the document, I want to optionally set a Display text label for the link, so I can create `[Display text](url)` links directly from the dialog instead of having to edit the Markdown source manually.

**Scope:** Display text field is only shown when the dialog is opened for a link that already has text, or when the user has text selected. It is not shown for new links added to empty selections (where no link text exists yet). If the user leaves the Display text field blank, the existing link text is preserved unchanged — the field is optional and non-destructive.

Acceptance criteria:
- The Edit Link dialog (`FormattingBubbleMenu.tsx`) contains a labelled "Display text" input field below the URL field.
- The Display text field is pre-populated with the currently selected text (or the existing link text) when the dialog opens.
- When the user submits with a non-empty Display text, `editor.chain().setLink().run()` is accompanied by an `insertContent` or `updateAttributes` call that also updates the link's text node to match the Display text value.
- When the user leaves the Display text field blank, link text is not modified — only the `href` attribute changes.
- The Display text field accepts the same keyboard shortcuts as the URL field (Enter to submit, Escape to cancel).
- The dialog title stays "Edit Link" / "Add Link" (no title change needed).
- Existing link add/remove/update flows are fully preserved.

---

## Non-Requirements

- R2 Level 2 (prompt queue — store queued prompt, auto-send when agent completes): explicitly deferred. A separate sprint or issue should track this.
- Changing the visual design of the plan review card beyond fixing readability.
- Adding syntax highlighting to code blocks (separate concern).
- Changing the link modal to support multi-line display text (out of scope; single-line is sufficient).
- Any backend/extension-host changes for R3 or R4 — both are pure webview changes.

---

## Resolved Questions

- **2026-06-01:** R2 scope bounded to Level 1 only. Level 2 adds queue complexity (store state, auto-send trigger, ordering guarantees) and is not justified by the issue description alone.
- **2026-06-01:** R1 root cause confirmed: the `!turn.pendingPlanApproval` guard in `AgentResponse` is inverted. The live-approval path (via `AgentView` → `AgentPlanApproval`) works correctly; only the post-result display path in `AgentResponse` is broken.
- **2026-06-01:** R4 Display text field: "optional and non-destructive" chosen over "always required". Forcing the user to re-enter text when editing only the URL would be regressive.

## Open Questions

- R1: Should `AgentResponse` be simplified to remove its duplicate plan-approval UI entirely (since `AgentView` already handles the live case with `AgentPlanApproval`)? Or is the `AgentResponse` duplicate serving a legitimate "replay history" purpose? — **Decision deferred to Phase 3; the minimal fix is to correct the `needsApproval` condition; cleanup of the duplicate is optional.**
