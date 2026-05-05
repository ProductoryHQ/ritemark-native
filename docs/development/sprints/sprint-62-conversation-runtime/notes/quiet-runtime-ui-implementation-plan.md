# Quiet Runtime UI Implementation Plan

## Decision

Implement the sprint-62 runtime switcher UI using the **C3 Quiet Card** direction from `ux-options.html`.

C3 is the preferred production base because it keeps the input visually calm while still making runtime, mode, context, attachments, and send/stop actions available at the point of composition. C3b is the stress-test/reference variant for existing advanced states.

## Design Contract

### Must preserve

- One durable mixed-runtime conversation view.
- Per-turn runtime/model provenance.
- Runtime selection per next run, not a global conversation identity.
- Codex Plan/Edit mode as a run-level setting.
- Existing Claude and Codex provider behavior, approvals, questions, streaming, attachments, and cancellation.
- Current attachment behavior: image/screenshot thumbnails, file chips, remove affordance, drag/drop, paste, and send payload mapping.
- Existing advanced states:
  - compatibility notices
  - active/current plan banner
  - Claude plan approval
  - Codex plan review
  - Codex command/file approval
  - pending user questions
  - activity/running indicators
  - subagent progress cards
  - @agent mention chips
  - slash commands
  - active file and dropped path chips

### Must change

- The primary composer should become a unified quiet input card.
- The runtime/model/mode selector should live in the card footer.
- The old selector/header affordance should stop competing with the input once the quiet card is in place.
- Advanced state cards should be visually softened so the page reads as one calm conversation, not many loud widgets.

## Target UX Hierarchy

### 1. Conversation content first

Messages and markdown output remain the dominant visual content. Runtime/status chrome should be readable but low-saturation.

### 2. Current plan and active blocking states second

Blocking states get clear structure, but not warning-level visual volume unless user action is truly required.

Priority order:

1. pending approval/question
2. running activity/subagents
3. current plan
4. compatibility notices
5. provenance/status metadata

### 3. Composer controls third

Footer controls should be compact and quiet:

```text
[ runtime · model ▾ ] [ Edit | Plan when Codex ] [ context/attachment count ]          [ attach ] [ send/stop ]
```

When attachments or context are present, show them above the footer inside the card:

```text
Ask Codex in Plan mode…

[ screenshot thumbnail ] [ store.ts file chip ] [ active/path chips if present ]

[ Codex · gpt-4.1 ▾ ] [ Edit | Plan ] [ 2 attached ]                [ paperclip ] [ send ]
```

## Implementation Phases

### Phase 0 — Guardrails and inventory

Goal: ensure this is a UI-shell change, not a provider runtime rewrite.

Tasks:

- Confirm whether runtime-switching v2 UI/storage guard is currently enabled by default or internal-only.
- Identify the current top-level render path in `AISidebar.tsx`:
  - `UnifiedConversationView`
  - `ChatInput`
  - `AgentSelector`
  - setup/offline/history panels
- Decide whether to keep a small header status line during transition or remove the old selector immediately.

Output:

- Short note in this file or sprint-plan if the rollout flag changes.

### Phase 1 — Extract quiet UI primitives

Goal: avoid styling every existing card ad hoc.

Create or update small presentational primitives under:

```text
extensions/ritemark/webview/src/components/ai-sidebar/
```

Recommended new files:

- `QuietComposerCard.tsx`
- `RuntimePickerFooter.tsx`
- `QuietStateCard.tsx`
- `AttachmentPreviewStrip.tsx`
- `ContextChipStrip.tsx`

Alternatively, keep `AttachmentPreviewStrip` and `ContextChipStrip` inside `ChatInput.tsx` for the first patch if extraction creates churn.

Design token rules:

- Use existing VS Code/theme variables and Ritemark CSS variables.
- Prefer Tailwind utility classes already used in the webview.
- Keep accent color for selected runtime/mode only; avoid filled indigo blocks for normal state.
- Keep borders at `var(--r-hairline)` or lower-opacity equivalents.
- Maintain keyboard focus visibility even when visual style is quiet.

### Phase 2 — Rebuild `ChatInput` around the quiet card

Primary file:

```text
extensions/ritemark/webview/src/components/ai-sidebar/ChatInput.tsx
```

Keep existing behavior:

- file input and `ALL_ACCEPTED`
- drag/drop overlay
- paste image/file support
- `attachments` state and `removeAttachment`
- `pathChips` state and `removePathChip`
- active file chip/dismiss behavior
- `@` mention popup
- `/` command popup
- `buildFinalPrompt`
- send routing:
  - Claude: `sendAgentMessage(prompt, attachments, { skipActiveFile })`
  - Codex: `sendCodexMessage(prompt, attachments, pendingRuntime.mode)`
  - Chat: `sendChatMessage(prompt)`
- stop/cancel routing via `cancelRequest`

UI changes:

- Wrap textarea, context chips, attachment strip, and footer in one quiet card.
- Move attach/send buttons into the footer.
- Add runtime/model picker in the footer.
- Show Plan/Edit segmented control only for Codex.
- Show attachment count/context count only when present.
- Keep drag overlay on the whole composer zone.

Runtime footer behavior:

- For Claude: show `Claude · {model}` if model is available, otherwise `Claude` or `Claude · Sonnet`.
- For Codex: show `Codex · {model}` and Plan/Edit segment.
- For Chat: show `Chat` and hide Plan/Edit.
- Clicking runtime should reuse existing pending-runtime setter/store behavior. If the current store lacks a single selector action, add a small action rather than coupling the footer to legacy `AgentSelector` internals.

Open questions to resolve during implementation:

- Where is the canonical selected model stored for Claude and Codex today?
- Does model selection already exist as a dropdown action, or only as labels/config?
- Should the first implementation support model switching directly or only runtime + mode while preserving model display?

Recommended narrow first pass:

- Implement runtime switching and Codex Plan/Edit in the footer.
- Display current model text.
- Defer full model dropdown if model picker wiring is non-trivial.

### Phase 3 — Quiet advanced state cards

Primary files:

```text
extensions/ritemark/webview/src/components/ai-sidebar/UnifiedConversationView.tsx
extensions/ritemark/webview/src/components/ai-sidebar/AgentView.tsx
extensions/ritemark/webview/src/components/ai-sidebar/CodexView.tsx
extensions/ritemark/webview/src/components/ai-sidebar/ActivePlanBanner.tsx
extensions/ritemark/webview/src/components/ai-sidebar/AgentPlanApproval.tsx
extensions/ritemark/webview/src/components/ai-sidebar/PlanReviewCard.tsx
extensions/ritemark/webview/src/components/ai-sidebar/AgentQuestion.tsx
extensions/ritemark/webview/src/components/ai-sidebar/SubagentCard.tsx
extensions/ritemark/webview/src/components/ai-sidebar/RunningIndicator.tsx
```

Approach:

- Do not rewrite behavior.
- Restyle containers via shared quiet card classes/primitives.
- Keep approval/question cards clearly actionable.
- Soften warning/approval borders unless the state is destructive or blocked.
- Keep subagents as nested, low-volume progress rows.
- Keep activity sections collapsible.

Specific state mapping:

| Existing state | Target treatment |
| --- | --- |
| Compatibility notice | Quiet warning card, dismiss still visible |
| Current plan banner | Low-volume card above turns; expanded steps remain readable |
| Claude/Codex plan review | Quiet card with clear primary/secondary buttons |
| Command/file approval | Slight warning tint, but avoid heavy border unless dangerous |
| Pending question | Quiet form card; selected option still obvious |
| Subagent progress | Left rail + small robot/status icon, compact result text |
| Running indicator | One-line status; subagent count chip if relevant |
| Provenance | Tiny muted runtime/model line above or beside assistant content |

### Phase 4 — Remove/reduce old competing selector chrome

Primary files:

```text
extensions/ritemark/webview/src/components/ai-sidebar/AISidebar.tsx
extensions/ritemark/webview/src/components/ai-sidebar/AgentSelector.tsx
```

Tasks:

- Confirm whether `AgentSelector` can be removed from the primary composer path once footer runtime picker exists.
- Keep setup/onboarding affordances for unavailable runtimes.
- Preserve history badges and runtime summary in `ChatHistoryPanel.tsx`.
- If a full removal is risky, keep `AgentSelector` hidden or collapsed behind an internal guard during the first implementation patch.

Target:

- The user changes “next reply via” from the quiet card footer.
- Header area should show conversation-level status only, not duplicate runtime controls.

### Phase 5 — Test coverage

Focused tests to add or update:

```text
extensions/ritemark/webview/src/components/ai-sidebar/runtimeSwitching.test.ts
extensions/ritemark/webview/src/components/ai-sidebar/conversationModel.test.ts
extensions/ritemark/webview/src/components/ai-sidebar/lifecycle.test.ts
```

Potential new tests:

- `ChatInput` pending runtime mode routes sends correctly:
  - Claude send preserves attachments and active-file skip option.
  - Codex send passes attachments and Plan/Edit mode.
  - Chat send ignores agent-only attachments if needed.
- Runtime switch updates placeholder/footer state without changing existing conversation arrays.
- Codex Plan/Edit segment updates `pendingRuntime.mode` before send.
- Cancel still routes to the currently running runtime, not selected footer runtime.
- Attachment strip still removes attachments and clears after send.
- Path chips still prepend prompt content.

If component tests are unavailable or expensive, add pure-store tests around pending runtime actions and keep manual UI validation explicit.

### Phase 6 — Build and QA

Because this touches webview UI, run:

```bash
cd extensions/ritemark/webview
npm run build
```

Before ready handoff, per repo rules, use `qa-validation` and run:

```bash
./scripts/validate-qa.sh
```

If source changes affect the built extension bundle, ensure this generated file is updated as expected:

```text
extensions/ritemark/media/webview.js
```

## Suggested Patch Slices

### Slice A — Composer shell only

- Add quiet card composer layout to `ChatInput.tsx`.
- Keep existing advanced state cards unchanged.
- Keep old selector if needed but reduce duplicate visual emphasis.

Definition of done:

- Attachments, path chips, active file, mentions, slash commands, runtime switching, Plan/Edit, send, and stop all still work.

### Slice B — Advanced card quieting

- Restyle `PlanReviewCard`, `AgentQuestion`, `SubagentCard`, `RunningIndicator`, `ActivePlanBanner`, and Codex approval cards.
- No behavior changes.

Definition of done:

- C3b stress states are visually represented in production components.

### Slice C — Header/selector cleanup

- Remove or collapse old competing runtime selector from primary UI.
- Keep setup/discovery/status affordances.

Definition of done:

- There is one obvious place to choose the next runtime: the composer footer.

### Slice D — Validation and polish

- Add/update focused tests.
- Build webview bundle.
- Run QA gate before ready/commit.

## Manual QA Checklist

Test both light and dark themes if possible.

- [ ] Empty conversation with Claude selected.
- [ ] Mixed Claude + Codex conversation with provenance visible.
- [ ] Switch Claude → Codex → Chat → Claude from footer.
- [ ] Codex Plan/Edit mode toggles and affects send.
- [ ] Send with screenshot thumbnail.
- [ ] Send with PDF/text/file chip.
- [ ] Paste image into composer.
- [ ] Drag/drop file and folder path.
- [ ] Remove attachment before send.
- [ ] Remove path chip before send.
- [ ] Active file chip can be dismissed.
- [ ] `@agent` mention popup still appears and inserts mention.
- [ ] `/` command popup still appears and command runs.
- [ ] Claude plan approval card works.
- [ ] Codex plan review card works.
- [ ] Codex shell/file approval card works.
- [ ] Pending question answer submit works.
- [ ] Subagent running/done state remains readable.
- [ ] Cancel/stop routes to running runtime.
- [ ] History panel still summarizes mixed-runtime conversations.
- [ ] Setup/offline/API-key states remain reachable.

## Risks

- Moving runtime controls into `ChatInput` may duplicate or conflict with `AgentSelector` state if there are two sources of truth.
- The quiet style may under-signal dangerous approvals. Keep command/file approval slightly stronger than passive cards.
- Component tests may be limited; if so, rely on store tests plus manual QA.
- The built `webview.js` must be regenerated after source changes or the app will show stale UI.

## Implementation Recommendation

Start with **Slice A**. It gives the biggest user-visible win and keeps behavior risk constrained. Then do **Slice B** once the quiet composer is stable.

Do not combine runtime-provider behavior changes with this UI polish unless a tiny adapter is necessary for the footer runtime selector.
