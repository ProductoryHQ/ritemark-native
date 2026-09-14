# Sprint 117 Tasks

Implementation checklist for [technical-plan.md](./technical-plan.md). Tick `[x]` only when the artifact/code/evidence exists on the approved sprint branch.

> **Gate:** passed 2026-09-14. Depth approved (full), the destination decided by Jarmo, the remaining Phase 0 decisions delegated to engineering ("ülejäänud sprindi otsustes usaldan sind"). Implementation may start at Phase 1. Any later change to user-visible behaviour goes back to Jarmo.

## Phase 0: Audit, design, and freeze (W0 — R1–R10)

- [x] Map all 23 findings to requirement/scenario/workstream/disposition in `research/protocol-and-storage-decisions.md` — done 2026-09-14, plus two Phase 0 findings (F24 cancel mapped to completed/failed, F25 sidebar dispatch timer).
- [x] Create synthetic comment/document/task fixtures; never use real user documents or transcripts — `research/fixtures/`, 2026-09-14.
- [x] Freeze stable-ID upgrade and duplicate-ID behavior for marks and standalone nodes — D3.
- [x] Freeze `CommentTaskRecordV1`, typed protocol, payload bounds, atomic acceptance, queue reservation, and transition table — D2, D6.
- [x] Freeze canonical URI/project scope, rename/move/Save As, deleted-source, retention, cleanup, and retry-generation rules — D4.
- [x] Destination-conversation selection — decided by Jarmo 2026-09-14: the conversation open in the AI sidebar, no confirmation step.
- [x] Approve host-local completion reply projection versus Markdown encoding — D9, host-local.
- [x] Full versus surgical scope — resolved full on 2026-09-14; v1.12.0 Sprint 121 absorbed.
- [x] Freeze the composer resize bounds, the `@` picker behaviour, and the collapsed-marker layout at narrow/normal widths (R10, Sprint 121 absorption) — D10; the narrow-width thresholds are measured on RunDev before Phase 5.
- [x] Approve [design.md](./design.md), including the R10 composer, picker, and collapsed-marker states.
- [x] **Jarmo Phase 0 gate:** authorized 2026-09-14 — destination decided by him, the rest delegated.

## Phase 1: Task store and protocol foundation (W1, W3 — R1, R3, R6)

- [x] Add `src/commentTasks/types.ts` with versioned codecs, task/generation/status/source/destination projections.
- [x] Add atomic `CommentTaskStore` with index rebuild, quarantine, document query, transitions, retry/cancel, and diagnostics.
- [x] Add exact-field `commentTasks/protocol.ts` request/result/event validation and payload bounds.
- [x] Add `CommentTaskController` behind injected dependencies (no `vscode` import), so acceptance and lifecycle run in Node tests.
- [x] Compose the controller into `RitemarkEditorProvider` and `UnifiedViewProvider` — done in Phase 3: built once in `extension.ts` beside `ConversationController`, `recoverUnfinished()` at activation, per-document projection routing in the editor provider, sidebar handshake and turn events in `UnifiedViewProvider`.
- [x] Test duplicate requests, wrong scope, unknown/stale IDs, failed writes, restart, and transition monotonicity.

## Phase 2: Comment capture and stable IDs (W2 — R2, R3)

- [x] Make one collector/assignment stripper/prompt input model serve rail and bulk paths — both Send surfaces build their payload from `collectDocumentComments` + `stripAssignmentMention` through the shared `toRequestComment`; the rail no longer reads the DOM `data-agent` attribute (F01–F03).
- [x] Persist stable IDs for all new standalone comments and preserve anchored/multi-block IDs — `CommentNode` gains `id`, minted by `newCommentId()` on all three creation paths; carrier `<!-- {id:…} body -->` in `commentMarkedExtension.ts` + `commentTurndownRules.ts`; a same-id/same-note multi-block comment stays one comment.
- [x] Implement deterministic undoable legacy-ID assignment before dispatch — `commentIds.ts` `assignMissingCommentIds()`: one dispatched transaction, duplicate ids re-minted, an unresolvable key omitted rather than invented. *Asserted as one transaction in the harness; one observed Cmd+Z restoring a byte-identical file still needs the RunDev pass (Phase 6).*
- [x] Replace both prompt builders with one marker-safe ordered builder using the real document label/path — `src/commentTasks/commentTaskPrompt.ts`; the webview's `buildAgentTaskPrompt` and the rail's prose prompt are deleted, and a test asserts nothing can import the old builder again (F04–F06).
- [x] Add anchored/standalone/multi-block/link split/duplicate/id-less/mention/terminator tests — `commentIds.test.ts` (8 blocks over a real ProseMirror schema), `commentIndex.test.ts`, `commentRoundTrip.test.ts`.

## Phase 3: Acceptance, destination, and queue (W3, W4 — R4, R5)

- [x] Stamp canonical URI/project scope and validate source IDs at host acceptance — the editor provider hands the controller a URI + `scopeId` document; every requested id must be present in the `TextDocument`. *D3's bounded 1 s re-check is absent: the frozen controller does a single check and answers the retryable `document-not-synced` when the document is dirty.*
- [x] Resolve/show exact destination conversation under the approved rule — `comment-task/destination-preview` feeds the caption; `UnifiedViewProvider` reveals the sidebar and waits up to 5 s for its first `conversation/active` report.
- [x] Route each comment task to the conversation open in the AI sidebar and show its title on both Send surfaces without a confirmation step (R4, Jarmo 2026-09-14) — rail caption above **Send to …**, menu caption above **Start tasks**; no picker, no dialog.
- [x] Reuse normalized runtime availability/recovery and atomically enforce queue capacity — one `deriveRuntimeAvailabilities` in `src/runtime/availability.ts` imported by host and sidebar (D12); the sidebar's real `full` verdict becomes `queue-full` and the `accepting` record is deleted (F17, F19).
- [x] Persist before accepted acknowledgment; return per-group bulk results and idempotent retry behavior — `accepting` is durable before the enqueue, the editor hears `queued` only after the sidebar's verdict, bulk sends one request per agent group under one `batchId`, and a repeated `requestId` returns the original result (F18).
- [x] Carry task ID, turn ID, frozen source context, runtime/model/policy/effort through queue and dispatch — `comment-task/enqueue` carries them, `QueueItem` keeps them, and `dispatchQueueItem` uses the host-minted turn id. *`approvalMode` is frozen as `auto`: the composer's Manual/Auto choice is webview state the host cannot read, so honouring it is a contract change that goes back to Jarmo.*
- [x] Ensure runtime receives source document context without active-tab fallback — an `agent-execute` carrying a `taskId` takes its active file from the record's `sourceDisplayPath` and never calls `_getActiveFileContext()` (F11, F12).

## Phase 4: Lifecycle and completion projection (W4, W5 — R6–R8)

- [x] Replace webview-memory/global broadcast authority with host task transitions and document-filtered projections — `comment:task-status` and `broadcastCommentTaskStatus` deleted; `commentTaskStatus.ts` is now a subscription to `comment-task/projection`, posted only to the editors of that document and republished on editor `ready` (F13–F16).
- [x] Map exact queue/turn/approval/question/plan/terminal events to task state by task ID + turn ID — `applyTurnStarted` / `applyTurnAttention` / `applyTurnTerminal` keyed by `(conversationId, conversationTurnId)`; approval, question, and plan review all project as `needs-user` with the attention kind (F21).
- [x] Remove conversation-wide task finalization; add same-conversation parallel-task regressions — `finalizeCommentTasks` and the `commentTasks` store slice are gone; `CommentTaskController.test.ts` asserts that finishing task A leaves its sibling queued and that a composer turn in the same conversation changes nothing (F22).
- [x] Persist and render bounded completion summary/tool-only fallback/error/cancel/interrupted states — `summarizeTerminalText` (≤ 280 chars, plain prose, truthful empty-result sentence) in the record; `commentTaskCopy.ts` renders all eight states, glyph plus sentence, tested.
- [x] Add Open conversation, Retry, Sign in/recovery actions with exact destination identity — `comment-task/open-conversation` reveals the bound conversation; Retry bumps the binding generation; `comment:recover` maps Sign in / Open settings onto `ritemark.claudeLogin`, `ritemark.codexLogin`, `ritemark.aiSettings`.
- [ ] Reject stale callbacks after retry, source deletion, conversation deletion, and generation change — retry/generation and unowned-turn callbacks are covered and tested; a **deleted conversation** has copy and an `interrupted(conversation-deleted)` reason but no code path that detects the deletion and transitions its tasks.

## Phase 5: UX, flag, migration, and regression (W6 — R9, R10)

- [x] Implement approved single/bulk confirmation and source-comment states from `design.md` — the rail's "Sent" flash and the menu's "Queued N tasks" banner are gone; both surfaces show a pending state, correlate every reply by `requestId`, and the menu renders one line per agent group with the host's message verbatim.
- [x] Bounded vertical resize of the comment composer as a reusable primitive — `components/comment/ResizableComposer.tsx`, native `resize: vertical`, min 2 rows, max `min(8 rows, 40vh)`, footer outside the scrolling area, height remembered for the session. *Reachability at the minimum supported width is covered by the unticked verification item below.*
- [x] `@` agent picker: opens immediately, filters, keyboard and pointer selection, explicit selected agent, aliases sourced from `commentModel.ts` — `components/comment/AgentMentionPicker.tsx`, `role="listbox"` with `aria-activedescendant`, anchored above the field so it cannot cover Cancel/Comment/Send; options come from `COMMENT_AGENT_ALIASES` + the shared `ALIAS_LABEL`.
- [x] Collapsed comment as a compact margin marker that never covers document text; bubble content stacks below the note — width-aware gutter (210 px → 40 px → a 30 px chip), bubble bounded to `min(300px, container − 32px)` and offset below the marker at narrow widths. *The thresholds are arithmetic against the current `.ProseMirror` layout, not measured — D10 requires the RunDev pass below.*
- [x] Keep `comment-callouts` default-on and gate UI/host paths coherently without a new flag — the flag is unchanged and `package.json` still contributes `default: true`; flag-off answers `feature-disabled` and sends no projection, and comment tasks additionally require the durable conversation store.
- [ ] Preserve comment add/edit/delete/undo, round-trip, document sync, and export stripping — round-trip and terminator behaviour are covered by `commentRoundTrip.test.ts` and the export chokepoint is untouched; add/edit/delete/**undo** in a real editor is still owed (see the Phase 6 RunDev pass).
- [ ] Verify keyboard, screen reader, high contrast, 200% zoom, reduced motion, narrow/normal widths, and non-overlap — no React rendering harness exists in this repo, so nothing here has been exercised; needs the live pass at the minimum supported width with three adjacent markers and a long note.

## Phase 6: QA and closeout (W7 — R9)

- [ ] Run focused task/comment/conversation/queue/runtime tests and webview/extension builds — the extension compiles, both typechecks are clean, and the comment/task/queue tests pass, but the **webview bundle has not been rebuilt**, so `media/webview.js` is stale against every webview change in this sprint and the pre-commit bundle-freshness check will fail until it is. The sprint's new tests (`commentIds`, `commentTaskPrompt`, `availability`, `commentTaskBridge`, `commentTaskCopy`, `AgentMentionPicker`) are not yet in the `npm run test` list.
- [ ] Walk every ★ scenario and link automated/live evidence — nothing has been run end to end; no track ran RunDev, so the honesty of every projection-driven state on a live instance is unproven. Carries the open live items from Phases 2, 4, and 5: one observed Cmd+Z after an ID upgrade, the three-runtime cancel matrix with a `debugTrace` of Claude's `session.cancel()`, and the narrow-width marker geometry.
- [ ] Run `./scripts/validate-qa.sh` through the repository QA gate.
- [ ] Update architecture, user docs, changelog, v1.11 release notes, release tracker, issue, and PR — **done:** `docs/development/architecture.md` (new Comment tasks subsystem, subsystem map, version history, superseded Sprint 104/105 rows), `docs/user/features/comments.md` + the comment bullet in `ai-agents.md`, the `[Unreleased] — v1.11.0` changelog entry, this checklist, and the "As built" section of `research/protocol-and-storage-decisions.md`. **Still owed:** v1.11 release notes, the release tracker, the GitHub issue, and the PR.
- [ ] Confirm all 23 findings are resolved or explicitly deferred and every checked task is supported by diff/evidence — F01–F23 plus F24/F25 are all implemented in the tree, but the closeout audit that walks each finding against the diff has not been done.
- [ ] Confirm every #281 outcome is covered so #156 and #281 close with this sprint.

### Carried out of the sprint, deliberately

- `comment-task/cancel` is decoded and handled, but no editor surface sends it — `design.md`'s State Vocabulary gives no state a Cancel action, so the branch is intentionally unreached. Confirm with Jarmo whether the editor should expose one.
- D6's persistent ready-queue for enqueues is absent: a sidebar that hydrates later than the 10 s window fails the task as `destination-not-found` rather than delivering late.
- D3's bounded 1 s document re-check and the conversation-deletion transition (Phase 4) are the two protocol behaviours specified but not wired.
