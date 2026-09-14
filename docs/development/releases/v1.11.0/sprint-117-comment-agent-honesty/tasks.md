# Sprint 117 Tasks

Implementation checklist for [technical-plan.md](./technical-plan.md). Tick `[x]` only when the artifact/code/evidence exists on the approved sprint branch.

> **Gate:** Phase 0 may create research, fixtures, protocol/schema candidates, and design evidence only. Depth was approved (full) on 2026-09-14; product code starts after Jarmo approves the complete Phase 0 freeze.

## Phase 0: Audit, design, and freeze (W0 — R1–R10)

- [ ] Map all 23 findings to requirement/scenario/workstream/disposition in `research/protocol-and-storage-decisions.md`.
- [ ] Create synthetic comment/document/task fixtures; never use real user documents or transcripts.
- [ ] Freeze stable-ID upgrade and duplicate-ID behavior for marks and standalone nodes.
- [ ] Freeze `CommentTaskRecordV1`, typed protocol, payload bounds, atomic acceptance, queue reservation, and transition table.
- [ ] Freeze canonical URI/project scope, rename/move/Save As, deleted-source, retention, cleanup, and retry-generation rules.
- [ ] Freeze deterministic destination-conversation selection and visibility/confirmation timing.
- [ ] Approve host-local completion reply projection versus Markdown encoding.
- [x] Full versus surgical scope — resolved full on 2026-09-14; v1.12.0 Sprint 121 absorbed.
- [ ] Freeze the composer resize bounds, the `@` picker behaviour, and the collapsed-marker layout at narrow/normal widths (R10, Sprint 121 absorption).
- [ ] Approve [design.md](./design.md), including the R10 composer, picker, and collapsed-marker states.
- [ ] **Jarmo Phase 0 gate:** authorize the frozen contract before implementation.

## Phase 1: Task store and protocol foundation (W1, W3 — R1, R3, R6)

- [ ] Add `src/commentTasks/types.ts` with versioned codecs, task/generation/status/source/destination projections.
- [ ] Add atomic `CommentTaskStore` with index rebuild, quarantine, document query, transitions, retry/cancel, and diagnostics.
- [ ] Add exact-field `commentTasks/protocol.ts` request/result/event validation and payload bounds.
- [ ] Add `CommentTaskController`; compose it into providers/controllers without growing runtime-specific logic in view providers.
- [ ] Test duplicate requests, wrong scope, unknown/stale IDs, failed writes, restart, and transition monotonicity.

## Phase 2: Comment capture and stable IDs (W2 — R2, R3)

- [ ] Make one collector/assignment stripper/prompt input model serve rail and bulk paths.
- [ ] Persist stable IDs for all new standalone comments and preserve anchored/multi-block IDs.
- [ ] Implement deterministic undoable legacy-ID assignment before dispatch.
- [ ] Replace both prompt builders with one marker-safe ordered builder using the real document label/path.
- [ ] Add anchored/standalone/multi-block/link split/duplicate/id-less/mention/terminator tests.

## Phase 3: Acceptance, destination, and queue (W3, W4 — R4, R5)

- [ ] Stamp canonical URI/project scope and validate source IDs at host acceptance.
- [ ] Resolve/show exact destination conversation under the approved rule.
- [ ] Show the agent and destination conversation before dispatch on both the margin rail and the Comments menu (R4, decided 2026-09-14).
- [ ] Reuse normalized runtime availability/recovery and atomically enforce queue capacity.
- [ ] Persist before accepted acknowledgment; return per-group bulk results and idempotent retry behavior.
- [ ] Carry task ID, turn ID, frozen source context, runtime/model/policy/effort through queue and dispatch.
- [ ] Ensure runtime receives source document context without active-tab fallback.

## Phase 4: Lifecycle and completion projection (W4, W5 — R6–R8)

- [ ] Replace webview-memory/global broadcast authority with host task transitions and document-filtered projections.
- [ ] Map exact queue/turn/approval/question/plan/terminal events to task state by task ID + turn ID.
- [ ] Remove conversation-wide task finalization; add same-conversation parallel-task regressions.
- [ ] Persist and render bounded completion summary/tool-only fallback/error/cancel/interrupted states.
- [ ] Add Open conversation, Retry, Sign in/recovery actions with exact destination identity.
- [ ] Reject stale callbacks after retry, source deletion, conversation deletion, and generation change.

## Phase 5: UX, flag, migration, and regression (W6 — R9, R10)

- [ ] Implement approved single/bulk confirmation and source-comment states from `design.md`.
- [ ] Bounded vertical resize of the comment composer as a reusable primitive; Save, Cancel, and Send stay reachable at the minimum supported width (R10).
- [ ] `@` agent picker: opens immediately, filters, keyboard and pointer selection, explicit selected agent, aliases sourced from `commentModel.ts` (R10).
- [ ] Collapsed comment as a compact margin marker that never covers document text; bubble content stacks below the note (R10).
- [ ] Keep `comment-callouts` default-on and gate UI/host paths coherently without a new flag.
- [ ] Preserve comment add/edit/delete/undo, round-trip, document sync, and export stripping.
- [ ] Verify keyboard, screen reader, high contrast, 200% zoom, reduced motion, narrow/normal widths, and non-overlap.

## Phase 6: QA and closeout (W7 — R9)

- [ ] Run focused task/comment/conversation/queue/runtime tests and webview/extension builds.
- [ ] Walk every ★ scenario and link automated/live evidence.
- [ ] Run `./scripts/validate-qa.sh` through the repository QA gate.
- [ ] Update architecture, user docs, changelog, v1.11 release notes, release tracker, issue, and PR.
- [ ] Confirm all 23 findings are resolved or explicitly deferred and every checked task is supported by diff/evidence.
- [ ] Confirm every #281 outcome is covered so #156 and #281 close with this sprint.
