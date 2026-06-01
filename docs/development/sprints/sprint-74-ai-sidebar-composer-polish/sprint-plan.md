# Sprint 74: AI Sidebar & Composer Polish

Track: SDD
Branch: sprint-74-ai-sidebar-composer-polish
Status: Phase 2 (PLAN) — awaiting Jarmo approval

## SDD Artifacts

- [spec.md](spec.md) — behaviour contract (source of truth for R1–R4)
- [scenarios.md](scenarios.md) — BDD examples / manual QA matrix
- [technical-plan.md](technical-plan.md) — implementation approach per workstream
- [tasks.md](tasks.md) — implementation checklist

## Goal

Fix four quality issues in the AI sidebar and document editor: a broken plan-approval UI that silently prevents Approve from working, locked Composer input during agent runs, a spurious code-block horizontal scrollbar, and a missing Display text field in the Edit Link modal.

## Linked Issues

- [#86] Claude plan review card: unreadable preview + Approve button does nothing
- [#82] Composer: allow drafting/queuing the next prompt while agent is running (Level 1 = unlock input; Level 2 = queue)
- [#84] Code block shows unnecessary horizontal scrollbar (cosmetic, quick fix)
- [#93] Add optional Display text field to the Edit Link modal

## MVP Scope

| Workstream | Requirement | Primary file |
|------------|-------------|--------------|
| W1 | R1: Fix `needsApproval` inversion in `AgentResponse.tsx` | `AgentResponse.tsx` |
| W2 | R2: Unlock textarea + prompt queue in `ChatInput.tsx` | `ChatInput.tsx` |
| W3 | R3: Remove spurious scrollbar on code blocks | `Editor.tsx` + `index.css` |
| W4 | R4: Display text field in Edit Link dialog | `FormattingBubbleMenu.tsx` |

Full requirements and acceptance criteria: [spec.md](spec.md).

## Feature Flag Check

- None of these changes introduce new user-visible features behind a flag. The Composer queue (R2 Level 2) is a UX improvement to existing functionality, not an experimental feature. No feature flag needed.

## Success Criteria

- [ ] R1: The plan-approval card renders correctly and Approve/Reject buttons send the correct messages to the extension host (AC1.1–AC1.6).
- [ ] R2: Textarea is focusable and accepts text during agent run; queued prompt auto-sends when run completes; queue chip discards correctly (AC2.1–AC2.10).
- [ ] R3: No spurious horizontal scrollbar on short code blocks; long code blocks still scroll; tooltip not clipped; mermaid unaffected (AC3.1–AC3.4).
- [ ] R4: Display text field pre-populates correctly; saving with display text updates/inserts linked text; empty field preserves existing behaviour (AC4.1–AC4.8).
- [ ] Pre-commit hook passes.
- [ ] TypeScript compiles without errors.

## Product Decisions

- **2026-06-01:** R2 includes both Level 1 (unlock) AND Level 2 (queue) per Jarmo's issue brief. Queue is scoped to local `ChatInput` state (no Zustand) to keep blast radius minimal.
- **2026-06-01:** R3 fix strategy: `overflow: visible` on `pre.tiptap-code-block`, `overflow-x: auto` on `code` child, to avoid tooltip clipping. Alternative (`overflow-x: hidden` on `pre`) rejected due to tooltip clip risk.
- **2026-06-01:** R4 "Display text" field is always shown (when not in file-search mode), not conditional on whether text is already selected. Pre-population from selection makes it convenient; leaving it empty is a no-op.

### Prototype-validated decisions (2026-06-01, after prototype review)

- **R1 — Plan card stays in chat feed:** Plan approval card is Claude's response artifact. It lives in the chat message stream, not above the composer. The composer area is reserved exclusively for user input. (Earlier draft incorrectly placed the card as a notch above the composer — rejected.)
- **R1 — Flat card, no nested inner card:** `PlanReviewCard.tsx` is redesigned as a single-level card: indigo-tinted header row, flat `<RenderedMarkdown>` body, action footer. The existing nested inner card ("Plan" eyebrow + inner border) is removed. Reference: `prototypes/plan-review-card.html` Column B.
- **R1 — Full plan text shown:** `extractPlanDisplayText` simplified to `planText.trim()` — the backward-scan-for-last-block logic is removed. The card body uses `max-h-[150px] overflow-y-auto` to contain long plans visually.
- **R2 — Queue UI is a notch above the input box:** The queue indicator uses the existing `SelectedContextTab` notch pattern (`mx-2.5 -mb-px rounded-t-lg border border-b-0`), not a chip inside the input card. Reference: `prototypes/composer-queue.html` Column B. This keeps the input card clean for user text only.
- **R2 — Notch stacking with `.notch-stack`:** When both queue notch and `SelectedContextTab` ("Working on selected text") are visible simultaneously, they are wrapped in a single `.notch-stack` container with `.ns-section` children separated by a thin internal divider. This avoids any visible seam between stacked notch sections. Reference: `prototypes/composer-queue.html` Column C.
- **R2 — No `border-top` on `input-wrap` when notch is present:** The stripe that appears between the messages area and the notch is caused by `border-top` on the `input-wrap` container. It must be removed whenever any notch is active.

## Pre-Implementation Gate

Phase 3 (DEVELOP) must not begin until:
1. This sprint plan is approved by Jarmo ("approved" / "proceed").
2. Sprint branch `sprint-74-ai-sidebar-composer-polish` is checked out (HARD GATE — no code on `main`).

## Approval

- [ ] Jarmo approved this sprint plan
