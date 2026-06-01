# Sprint 74 Tasks

## Phase 1: R1 — Plan Review Card Fix

**Logic fix (AgentResponse.tsx):**
- [x] Change `needsApproval` condition: `!turn.pendingPlanApproval` → `!!turn.pendingPlanApproval`
- [x] Verify `approvePlan(turn.id)` and `rejectPlan(turn.id, feedback)` are still called correctly by the inline approval buttons in `AgentResponse`
- [x] (Optional, non-blocking) Evaluate whether the duplicate inline approval UI in `AgentResponse` (lines ~118-158) can be removed in favour of `AgentPlanApproval` — document decision in this file

> **Decision (2026-06-01):** Kept the inline approval UI in `AgentResponse`, gated behind the corrected `planTurnNeedsApproval()` predicate (new export in `planText.ts`, regression-tested). Since `agent-result` always clears `pendingPlanApproval`, the inline UI can no longer falsely render dead buttons. Full removal deferred — the live approval path is `AgentView` → `AgentPlanApproval` → `PlanReviewCard`.

> **Implementation note:** the `needsApproval` fix is `planTurnNeedsApproval(turn)` rather than an inline `!!` expression, so `planText.test.ts` covers the exact production logic.

**Plan text fix (planText.ts):**
- [x] Simplify `extractPlanDisplayText` to return `planText.trim()` — remove the backward-scan logic that returns only the last list/heading block (see technical-plan.md § Plan Card Visual Redesign)

**Visual redesign (PlanReviewCard.tsx):**
> Reference: `prototypes/plan-review-card.html` Column B. Plan card = Claude's chat artifact, not a composer element.
- [x] Remove the nested inner card (`max-h-[300px]` div with "Plan" eyebrow label and inner border) from `PlanReviewCard.tsx`
- [x] Add indigo-tinted header row: clipboard icon + "Claude is waiting for plan approval" + pulse dot; background `rgba(224,231,255,0.35)`; bottom border `rgba(67,56,202,0.10)`
- [x] Place `<RenderedMarkdown>` directly in the card body (no wrapper card): `px-2.5 py-2 max-h-[150px] overflow-y-auto`
- [x] Move action row (`Approve plan` + `Reject`) into a `border-top: rgba(67,56,202,0.08)` footer row; Approve = indigo filled (`bg-[var(--r-accent)] text-white`), Reject = ghost
- [x] Change outer card border from `var(--r-hairline)` to `rgba(67,56,202,0.18)` to give subtle indigo tint
- [ ] Verify: card renders correctly in chat feed; Approve/Reject fire the same callbacks as before; reject feedback input still works

## Phase 2: R2 Level 1 — Unlock Textarea

- [x] In `ChatInput.tsx`, remove `disabled={isLoading}` from the `<textarea>` element
- [x] Add conditional placeholder: when `isLoading && isAgentMode`, show "Agent is running — type your next message…"; otherwise use existing placeholder logic
- [x] Keep `disabled={isLoading}` on the attach-file `<button>` element
- [ ] Verify: textarea accepts input while agent runs; Send button is still shown as Stop (not active Send); typed text is preserved when agent finishes

## Phase 3: R2 Level 2 — Queue Prompt

- [x] Add `const [queuedPrompt, setQueuedPrompt] = useState<string | null>(null)` to `ChatInput`
- [x] Add `const prevAgentRunning = useRef(agentRunning)` for transition detection
- [x] Modify `handleSend` to accept an optional `overridePrompt?: string` parameter — use `overridePrompt ?? buildFinalPrompt()` as the prompt source
- [x] In `handleSend`, add queue branch: if `isLoading && isAgentMode && !overridePrompt`, queue the prompt via `setQueuedPrompt(buildFinalPrompt())`, clear `value`, and return early
- [x] Add `useEffect` that fires on `agentRunning` change: when transition from `true` → `false` and `queuedPrompt` is set, call `handleSend(queuedPrompt)` and clear queue
- [x] Add queue notch JSX **above** the input-box div (same location as `SelectedContextTab`, not inside the input card): pending circle + truncated prompt text + X discard button; use `mx-2.5 -mb-px rounded-t-lg border border-b-0` pattern matching `SelectedContextTab` (see technical-plan.md § Queue notch and `prototypes/composer-queue.html` Column B)
- [x] When both `queuedPrompt` and `selectedContext` are active, wrap both notch rows in a single `.notch-stack` container with `.ns-section` children so there is no visible seam between them (see `prototypes/composer-queue.html` Column C)

> **Implementation note:** instead of a literal `.notch-stack` wrapper (which would require restructuring `SelectedContextTab`), the queue notch reads `selection` from the store and switches to a "stacked" variant when selected text is showing: top rounding and outer top border are dropped and replaced by a thin internal divider (`rgba(148,163,184,0.14)`). Visual result is identical to the prototype's notch-stack — one block, zero seams — with `SelectedContextTab` untouched.

- [x] Ensure parent `input-wrap` has no `border-top` when any notch is present (prevents separator stripe between messages area and notch) — the ChatInput container drops `border-t` whenever `hasSelectedContext || queuedPrompt`
- [x] When `queuedPrompt` is set, change textarea `disabled` to `true` (prevents second queue entry)
- [x] When X on queue chip is clicked, clear `queuedPrompt` and re-enable textarea
- [ ] Verify end-to-end: type → Enter queues → chip shows → agent finishes → prompt auto-sends → chip clears
- [ ] Verify discard: queue → click X → textarea re-enabled → no auto-send

## Phase 4: R3 — Code Block Scrollbar Fix

- [x] In `Editor.tsx` inline `<style>`, change `overflow-x: auto !important` to `overflow: visible !important` on `.wysiwyg-editor .ProseMirror pre.tiptap-code-block`
- [x] In `Editor.tsx`, add `display: block !important; overflow-x: auto !important; min-width: 0 !important` to the existing `.wysiwyg-editor .ProseMirror pre.tiptap-code-block code` rule
- [x] In `index.css`, change `overflow-x: auto` to `overflow-x: hidden` on `.ProseMirror pre` (non-editor context fallback)
- [ ] Verify: short code block → no scrollbar; long code block → scrollbar on `code` element; copy-button tooltip not clipped; mermaid blocks unaffected

## Phase 5: R4 — Edit Link Display Text Field

- [x] In `FormattingBubbleMenu.tsx`, add `const [linkDisplayText, setLinkDisplayText] = useState('')`
- [x] In `handleOpenLinkDialog`, after setting `linkUrl`, extract selected text from `editor.state.selection` and pre-populate `linkDisplayText`
- [x] In the `externalLinkEdit` `useEffect`, pre-populate `linkDisplayText` from selected text (same logic)
- [x] In `handleSetLink`, implement the conditional display-text save logic:
  - If `displayText` is non-empty: use ProseMirror `tr.replaceWith` (selection) or `tr.insert` (cursor) with the link mark
  - If `displayText` is empty: existing `setLink` chain only
- [x] In `handleRemoveLink`, also reset `linkDisplayText` to `''`
- [x] Add the "Display text (optional)" `<input>` field to the dialog JSX, hidden when `isFileSearchMode` is true
- [x] Add `linkDisplayText` reset to dialog close handler (`onOpenChange`)
- [ ] Verify tab order: URL field → Display text field → Cancel → Update/Add
- [ ] Verify add-link no-selection case: no pre-population; typed display text is inserted at cursor with link
- [ ] Verify edit-link case: pre-populated from selected text; clearing field and saving leaves link text unchanged
- [ ] Verify file-search mode: Display text field hidden while `@` prefix is in URL field

## Phase 6: QA and Closeout

### Manual QA — run all scenarios from scenarios.md

**R1 Plan Review Card:**
- [ ] S: "Plan approval UI appears when agent requests approval"
- [ ] S: "Approve button sends approval to extension host"
- [ ] S: "Reject button with feedback sends rejection"
- [ ] S: "Plan text is rendered as Markdown in the preview"
- [ ] S: "Approve button is not shown for turns without pending approval"
- [ ] S: "Plan approval state is cleared when agent is cancelled"

**R2 Level 1:**
- [ ] S: "Textarea accepts input while agent is running"
- [ ] S: "Send button is disabled while agent runs"
- [ ] S: "Typed content is preserved when agent finishes"
- [ ] S: "Placeholder text changes during agent run"

**R2 Level 2:**
- [ ] S: "Pressing Enter while agent runs queues the prompt"
- [ ] S: "Queue chip shows truncated text for long prompts"
- [ ] S: "Queued prompt auto-sends when agent completes"
- [ ] S: "User discards queued prompt via X button"
- [ ] S: "Only one prompt can be queued at a time"

**R3 Code Block:**
- [ ] S: "Short code block shows no horizontal scrollbar"
- [ ] S: "Long code block still scrolls horizontally"
- [ ] S: "Mermaid blocks are unaffected"
- [ ] S: "Copy-button tooltip is not clipped"

**R4 Edit Link:**
- [ ] S: "Display text field is shown in the link dialog"
- [ ] S: "Display text pre-populated from selection when adding new link"
- [ ] S: "Display text pre-populated when editing existing link"
- [ ] S: "Saving with empty Display text does not change link text"
- [ ] S: "Saving with non-empty Display text updates link text (selection case)"
- [ ] S: "Saving with non-empty Display text inserts linked text (cursor case)"
- [ ] S: "Display text field is hidden in file-search mode"
- [ ] S: "Tab order through dialog is correct"

### Pre-commit gate
- [ ] Run pre-commit hook (`./scripts/validate-qa.sh` equivalent or invoke `qa-validator`)
- [ ] TypeScript compiles without errors (`cd extensions/ritemark/webview && npx tsc --noEmit`)
- [ ] No debug `console.log` statements introduced
- [ ] Update `CHANGELOG.md` with sprint-74 entries
- [ ] Update linked GitHub issues: #86, #82, #84, #93
- [ ] Commit and push sprint branch
