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

### R2: Composer — unlock input while agent is running (Level 1 + Level 2)

As a user waiting for an agent to finish, I want to be able to type my next prompt — and optionally queue it — while the agent is still running, so I am not blocked from preparing follow-up work.

**Level 1 — Unlock input (must ship):**

Acceptance criteria:
- AC2.1: While `isLoading` is true (agent running), the `ChatInput` textarea is **not** disabled — the user can type freely.
- AC2.2: The Send button remains disabled (or replaced by Stop) while the agent is running — pressing it while the agent is running has no effect; Stop is the only actionable button.
- AC2.3: The value typed while the agent runs is preserved and available to send once the agent finishes.
- AC2.4: The attach-file button remains disabled while the agent is running (opening a file dialog mid-run would disrupt workflow).
- AC2.5: Placeholder text updates to "Agent is running — type your next message…" while `isLoading` is true and the textarea is empty.

**Level 2 — Queue prompt:**

Acceptance criteria:
- AC2.6: When the user presses Enter (or clicks a "Queue" button) while `agentRunning` is true and the textarea has content, the current prompt is stored as `queuedPrompt` in local `ChatInput` state (no Zustand store change required).
- AC2.7: A visual indicator appears below/above the textarea: a chip showing "Queued: [truncated prompt]" with an X button to discard.
- AC2.8: When `agentRunning` transitions to `false`, the queued prompt is automatically dispatched via `handleSend` and the queue indicator clears.
- AC2.9: Pressing X on the queue chip discards the queued prompt and restores normal empty-textarea state.
- AC2.10: Only one prompt may be queued at a time. After a prompt is queued, the textarea is disabled until the agent finishes or the queue is discarded (preventing a second queue).

### R3: Code block — remove unnecessary horizontal scrollbar

As a user reading content with code blocks, I want code blocks to not show a horizontal scrollbar when the code fits within the visible width, so the UI does not look broken.

**Root cause (established during research):**
`Editor.tsx` (the inline `<style>` block) sets `overflow-x: auto !important` on `.wysiwyg-editor .ProseMirror pre.tiptap-code-block`. `overflow-x: auto` shows a scrollbar whenever the scroll content width slightly exceeds the container, which happens due to padding/border-box rounding even when no code line is actually long enough to warrant scrolling. A separate `overflow-x: auto` rule in `index.css` affects `pre` in non-editor contexts.

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

- Multi-message queue for R2 (only one queued prompt at a time).
- Persistence of R2 queue across page reloads or conversation resets.
- Changing the visual design of the plan review card beyond fixing readability.
- Adding syntax highlighting to code blocks (separate concern).
- Changing the link modal to support multi-line display text (out of scope; single-line is sufficient).
- Any backend/extension-host changes for R3 or R4 — both are pure webview changes.

---

## Resolved Questions

- **2026-06-01:** R2 includes both Level 1 (unlock) and Level 2 (queue). Level 2 queue is scoped to local `ChatInput` state — no Zustand changes — keeping blast radius minimal. Auto-send trigger fires on the `agentRunning` false transition via `useEffect`.
- **2026-06-01:** R1 root cause confirmed: the `!turn.pendingPlanApproval` guard in `AgentResponse` is inverted. The live-approval path (via `AgentView` → `AgentPlanApproval`) works correctly; only the post-result display path in `AgentResponse` is broken.
- **2026-06-01:** R4 Display text field: "optional and non-destructive" chosen over "always required". Forcing the user to re-enter text when editing only the URL would be regressive.

## Open Questions

- R1: Should `AgentResponse` be simplified to remove its duplicate plan-approval UI entirely (since `AgentView` already handles the live case with `AgentPlanApproval`)? Or is the `AgentResponse` duplicate serving a legitimate "replay history" purpose? Decision deferred to Phase 3; the minimal fix is to correct the `needsApproval` condition; cleanup of the duplicate is optional.
- R3: Whether `overflow-x: hidden` on the `pre.tiptap-code-block` clips the absolutely-positioned copy-button tooltip. The tooltip uses `position: absolute; z-index: 100` — CSS clips absolutely-positioned children of an `overflow: hidden` ancestor regardless of z-index. If clipping is observed during QA, the fallback is `overflow: visible` on `pre` with `overflow-x: auto` on the `code` child rule only.
- R4: Whether TipTap's `deleteSelection().insertContentAt()` chain is the correct API for replacing selected text with display text + link mark, or whether a direct `setLink` after `insertContent` is more reliable — to be confirmed during Phase 3.
