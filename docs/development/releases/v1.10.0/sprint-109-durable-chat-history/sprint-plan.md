# Sprint 109 — Durable Chat History

**Status:** Final QA complete — implementation, cleanup, review, official QA, and macOS live accessibility/visual gates pass in [PR #209](https://github.com/ProductoryHQ/ritemark-native/pull/209) (2026-08-23)<br>
**Parent release:** [v1.10.0 Durable Agent Conversations](../release-plan.md)<br>
**GitHub milestone:** [v1.10.0](https://github.com/ProductoryHQ/ritemark-native/milestone/8)<br>
**Issue:** [#205 — Sprint 109: Durable project-safe Agent Conversations](https://github.com/ProductoryHQ/ritemark-native/issues/205)<br>
**Track:** Full SDD — host persistence, migration, protocol, and UX correctness<br>
**Branch:** `codex/sprint-109-durable-chat-history`<br>
**Worktree:** `/Users/jarmotuisk/Projects/ritemark-dev/ritemark-native/.worktrees/sprint-109-durable-chat-history`<br>
**Delivery tier:** Extension implementation inside a full app release

## Goal

Make Agent Conversations a crash-safe, project-safe host-owned archive with one canonical identity and predictable create/switch/delete/restart behavior. The sprint is complete when History no longer depends on open robot tabs or webview-local transcript storage.

## Release Outcome

After Sprint 109, users can reliably find and reopen every saved conversation in the current project without loss, duplicates, silent pruning, or cross-project leakage. Reopening restores the visible transcript; provider-memory continuation remains explicitly reserved for Sprint 110, so this sprint must not overclaim it.

## SDD Artifacts

- [spec.md](./spec.md) — behavior contract R1–R8.
- [scenarios.md](./scenarios.md) — BDD examples and manual QA matrix.
- [technical-plan.md](./technical-plan.md) — architecture and workstreams W0–W6.
- [design.md](./design.md) — transitional Sprint 109 and final Sprint 110 Conversations UX contract.
- [tasks.md](./tasks.md) — implementation checklist.
- [research/current-state-audit.md](./research/current-state-audit.md) — evidence and migration risks.
- [research/record-and-protocol-decisions.md](./research/record-and-protocol-decisions.md) — freeze candidate schema and typed message contract.
- [research/migration-and-lifecycle-decisions.md](./research/migration-and-lifecycle-decisions.md) — rollback, scope, relink, flag, and live-session decisions.
- [research/atomic-write-audit.md](./research/atomic-write-audit.md) — executed failure/rename evidence and Windows semantics gate.
- [research/fixtures/](./research/fixtures/) — synthetic migration/scope/corruption corpus.

## In Scope

- Versioned host-owned ConversationStore and stable conversation/project identities.
- Atomic persistence and lifecycle checkpointing before runtime dispatch.
- Typed host↔webview conversation protocol and thin controller composition.
- Safe migration of scoped legacy history; explicit recovery bucket for global records.
- Correct switching, background, delete, Undo, restart, corrupt-data, and storage-failure behavior.
- One canonical All conversations archive plus a permanent conversation rail for New, automatic active/recent shortcuts, optional bounded Pinned shortcuts, and All conversations navigation.
- One host-owned title policy: immediate first-prompt fallback, a 3–6-word AI title after the first response, and user rename that always overrides automation.
- Default-on migration kill switch, tests, live restart evidence, and architecture/user docs.

## Explicitly Out of Scope

- Native Claude/Codex/OpenCode session resume or transcript-context replay.
- Search, runtime filter, or general All-projects browser.
- Cloud sync, archive/trash library, tags, folders, export/share, or semantic memory.
- Replaying tools, approvals, plans, progress, or attachment binaries.
- Scheduled tasks and Flows.

## Deliverables

1. `src/conversations/` subsystem and versioned store.
2. Stable project scope resolver and migration registry.
3. Typed conversation protocol/controller.
4. Host-backed Conversations UI and lifecycle semantics.
5. Approved `design.md` covering the permanent automatic-working-set + Pinned conversation rail, Pin/Unpin/Rename/Delete, reliable title tooltips, attention, migration, delete/Undo, and restored-context notice.
6. Migration/restart/corruption/cross-platform/live-attachment test suite and live evidence.
7. Architecture, user documentation, changelog, and release tracker updates.

## Success Criteria

- [x] Exactly one canonical record exists per non-empty conversation.
- [x] First prompt survives immediate process exit because it is persisted before dispatch.
- [x] Hide/show/reload/restart never changes the conversation ID or creates a duplicate.
- [x] Current-project queries never return another project’s transcript.
- [x] Legacy global records remain unassigned until explicit user action.
- [x] Panel close/switch retain records and running work; delete removes exactly one record and late callbacks cannot resurrect it.
- [x] Saved/idle records are unlimited; at most five runtime attachments remain live with protected running/waiting/current and LRU idle release rules.
- [x] Until Sprint 110, a restored transcript without a matching live session states that the agent starts with a new working context; a transcript with its matching live session shows no false warning, and neither case starts runtime work merely on open.
- [x] More than 50 records remain available; no age/count pruning occurs.
- [x] Corrupt/index/storage failures are isolated and visible.
- [x] All conversations is the only durable list with no `OPEN` badge; automatic rail membership is derived and non-persistent, while Pinned membership is explicit bounded workspace UI state. Neither owns, closes, or deletes a durable record.
- [x] Every runtime follows the same host title policy; AI generation is isolated from the active session, and a concurrent or later manual rename is never overwritten.
- [x] macOS scope/filesystem matrix, Architecture Gate, focused tests, live scenarios, QA, docs, and issue tracker preparation are complete; native Windows execution is recorded as a v1.10 Windows candidate distribution gate rather than silently claimed here.

## Dependencies and Blockers

- Phase 0 approval and dedicated non-`main` branch are complete (2026-08-22).
- Native Windows execution of the frozen filesystem cases remains required before v1.10 Windows distribution; the sprint merge is covered by the deterministic Windows path/rename fixtures and the release tracker retains the native gate.
- Sprint 110 depends on the stable ID/store contract from this sprint.

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Wrong-project migration | High | Known-scope only; explicit unassigned bucket; copy-first/idempotent fixtures. |
| Crash between record and index write | High | Record-first atomic write; rebuild index from records. |
| Delete resurrected by late event | High | Host tombstone/unknown-ID rejection; idempotency tests. |
| Flag-off hides host-only conversations | High | Monotonic cutover; host archive remains readable after first host write; no dual writes. |
| Idle runtime sessions grow without bound | High | Five attachments; protect running/waiting/current; evict non-current idle LRU; active-work-only block. |
| Folder identity drift | Medium | Normalized multi-root identity; explicit relink instead of guessing moves. |
| Storage growth | Medium | Metadata-only attachments; diagnostics; no silent deletion. |

## Product Decisions

| Date | Decision | Consequence |
|---|---|---|
| 2026-08-21 | Conversation is durable content, not an open runtime tab | Open/closed state and `OPEN` badge disappear. |
| 2026-08-21 | One Conversations panel | Current/background/past rows share one list and identity. |
| 2026-08-21 | Rail survives Sprint 109 only as a derived bounded live-session view | Avoids losing provider context before Sprint 110 while removing it as durable/history authority. |
| 2026-08-21 | First prompt saved before dispatch | Storage failure blocks agent start instead of risking invisible loss. |
| 2026-08-21 | Global legacy data remains unassigned | User explicitly moves it into a project. |
| 2026-08-21 | No silent retention cap | Cleanup is a future deliberate user action. |
| 2026-08-22 | Kickoff approved; begin Phase 0 only | Branch/worktree may be created and audit fixtures/decisions prepared, but Phase 1 product code remains gated on the separate Phase 0 decision. |
| 2026-08-22 | Phase 0 freeze candidate prepared | Synthetic fixtures, 6/6 local atomic audit, pinned Windows semantics, record/protocol schema, and migration/lifecycle decisions are ready for Jarmo approval. |
| 2026-08-22 | Conversation UI design approved and later refined | `design.md` and `prototype.html` remain the implementation baseline. The S01–S36 exploration is archived; production returns to `chat-circle`, and selection does not reorder Recents. |
| 2026-08-22 | Phase 0 technical freeze approved | Record/schema, project scope, atomic storage, migration/cutover, retention, delete/Undo, and five-live-attachment decisions are approved; Phase 1 product implementation may start. Native Windows execution remains a QA gate. |
| 2026-08-22 | Phase 1 store/scope slice complete | Versioned codecs, canonical project scope, atomic record-first storage, index reconciliation, corrupt quarantine, tombstones, Undo generations, diagnostics, and focused tests are implemented. |
| 2026-08-22 | Phase 2 typed boundary complete | Exact-field conversation protocol validators, safe record projection, current-scope controller enforcement, persist-before-dispatch ordering, and thin `UnifiedViewProvider` routing are implemented and tested. |
| 2026-08-22 | Phase 3 rollout foundation implemented | `durableAgentConversations` is experimental/default-on; canonical records repair a missing or damaged marker, flag-off after cutover resolves to host compatibility, and the legacy adapter has a monotonic read-only guard. Legacy import/dedupe remains in progress. |
| 2026-08-22 | Phase 3 migration and core Phase 4/5 path implemented | Legacy inventory imports idempotently into current/unassigned host scopes; first prompt checkpoints before dispatch; host summaries drive the approved permanent rail and Conversations panel. Rundev restart/Pin/tooltip/panel evidence is recorded; disposal interruption, attachment LRU, recovery UI and full QA remain open. |
| 2026-08-22 | Rail visual/order refinement implemented | Replaced custom color-and-shape marks with stable per-conversation colored Phosphor duotone `chat-circle` icons; recent order is activity-based and selection-neutral, with an otherwise-absent current conversation appended. Focused tests, build, and live run-dev verification passed. |
| 2026-08-23 | Final cleanup and review complete | Removed stale open-thread/cap UI and unused persisted plan-dismissal state; bounded Undo to the one recoverable snackbar; fixed runtime capacity reduction, flag-off-before-cutover store selection, delete-failure tombstone rollback, and provider disposal. Focused tests, official QA, and final `ritemark-demo` reload/visual evidence pass. |
| 2026-08-23 | ChatGPT-style titles approved | Show a shortened first prompt immediately, generate a 3–6-word title after the first successful response through an isolated one-shot session on that conversation's selected runtime, and expose manual Rename in Conversations. Manual rename always wins a race with AI generation. |
| 2026-08-23 | Title flow live-verified | In run-dev with Claude Sonnet 5, the prompt fallback appeared immediately and was replaced after the first response by the five-word title `Durable chat history persistence explained`; manual Rename had already been verified across panel and rail. |
| 2026-08-23 | Stable project-scoped colors implemented in Sprint 109 | Every record persists one of 24 slots: eight base rainbow hues, then deeper and softer rounds. Slots survive every surface, restart, Rename, Move, and Delete+Undo; existing draft records receive deterministic backfill. Exact reuse begins only after all slots are occupied, choosing the least-recently-active ownership. |
| 2026-08-23 | Runtime capacity moved from stale UI tabs to host attachments | The old open-thread localStorage set and “Open anyway” cap dialog are removed. Host runtime context is five-or-one with protected Working/Needs-you/current sessions and LRU non-current idle release; durable reading, selection and creation remain unlimited. |
| 2026-08-23 | Accessibility closeout completed before merge | Live run-dev checks cover 200% zoom, forced-colors focus, reduced-motion, single tooltips, and deterministic post-row-selection focus. The audit fixed Working pulse/transition motion, added the `Message` composer name, and made selecting the already-current row close the panel before restoring focus. |

## Architecture and Feature Flag

- Adds `extensions/ritemark/src/conversations/`; Architecture Gate is mandatory.
- Adds a typed conversation message union while preserving the sandbox boundary.
- Adds `conversation/rename` and host-owned `ConversationTitlePolicy`/`ConversationTitleGenerator`; the generator creates a fresh runtime/session and never appends a classifier turn to the active conversation.
- Composes `ConversationController` into `UnifiedViewProvider`; no runtime/storage logic expansion there.
- Adds `durableAgentConversations` as experimental with `package.json` default true plus monotonic cutover; host archive stays readable on flag-off after first host write.
- Does not change `AgentRuntime` yet; Sprint 110 owns continuation changes.

## Approval Gate

- [x] Jarmo approves R1–R8 kickoff and Phase 0 audit start (2026-08-22).
- [x] Sprint 109 issue [#205](https://github.com/ProductoryHQ/ritemark-native/issues/205) exists under milestone v1.10.0.
- [x] Branch `codex/sprint-109-durable-chat-history` exists and is verified before implementation (2026-08-22).
- [x] Phase 0 audit/schema/design decisions are recorded and explicitly approved by Jarmo before Phase 1 (2026-08-22).
