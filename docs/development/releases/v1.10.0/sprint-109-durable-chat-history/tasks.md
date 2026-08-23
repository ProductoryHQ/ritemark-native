# Sprint 109 Tasks

Implementation checklist for [technical-plan.md](./technical-plan.md). Tick `[x]` only when the artifact/code exists on branch `codex/sprint-109-durable-chat-history` and can be pointed to in the diff.

> **Gate:** Product-code phases start only after Jarmo approves the SDD plan and the dedicated branch exists. Phase 0 is audit/documentation only.

## Phase 0: Audit and schema freeze (W0)

- [x] Create synthetic migration fixtures for scoped/global/duplicate/malformed/corrupt-index/multi-root/no-folder cases (R3, R4, R7) — `research/fixtures/`.
- [x] Verify atomic rename/failure/quarantine behavior on macOS and Windows semantics, including Windows drive/case normalization (R2, R3, R7) — local harness 6/6 plus pinned Windows provider audit; native Windows execution remains a Phase 6 QA gate.
- [x] Decide rollback-window, monotonic cutover, `parallelChats` interaction, no-folder scope, moved-folder relink, and five-attachment LRU behavior; update all SDD artifacts (R3–R8) — freeze candidate in `research/migration-and-lifecycle-decisions.md`.
- [x] Record a final `ConversationRecordV1` and protocol decision table in `research/` (R1–R4) — `research/record-and-protocol-decisions.md`.
- [x] Approve the permanent conversation-rail direction in `design.md` and `prototype.html`: primary New, Pinned plus automatic active/recent conversations, All conversations, Pin/Unpin/Delete, reliable title tooltip, and no rail Close (R5, R6) — Jarmo revised 2026-08-22; remaining recovery/delete/continuation details stay in the Phase 0 decision gate.
- [x] Confirm experimental/default-true `durableAgentConversations` flag and monotonic host-readable rollback path (R8) — host compatibility stays read/write after cutover; legacy is read-only.
- [x] **Jarmo Phase 0 decision gate:** schema/scope/migration/cutover/live-session/design decisions approved; Phase 1 authorized (2026-08-22).

## Phase 1: Store and project scope (W1 — R1, R2, R3, R7)

- [x] Add `src/conversations/types.ts` with schema/version/provenance/transcript event types — versioned runtime codecs and relationship validation included.
- [x] Add `projectScope.ts` and tests for single-root, multi-root order, workspace-file, no-folder, and moved-folder non-guessing — consumes the frozen Phase 0 scope fixture.
- [x] Add `ConversationStore.ts` with serialized list/get/create/checkpoint/delete/restore/diagnostics operations.
- [x] Implement temp-write+rename, index rebuild, corrupt quarantine, stable sorting, and last-verified-version behavior — canonical records plus recoverable corrupt summaries in the best-effort index.
- [x] Add unit tests for 75+ records, corrupt/missing index, isolated corrupt record, write failure, and concurrent saves — `npm run test:conversations` (80-record corpus plus tombstone/Undo coverage).

## Phase 2: Typed protocol and controller (W2 — R1, R2, R5, R8)

- [x] Add `src/conversations/protocol.ts` request/result/event union and runtime validators — exact-field validation, payload bounds, correlation IDs, and host-safe projections included.
- [x] Add `ConversationController.ts` and thin `UnifiedViewProvider` routing — provider composes the controller and routes only the frozen `conversation/*` union.
- [x] Enforce project scope, canonical ID, tombstone, and unknown-ID rejection host-side — including scope-bound Undo and generation checks.
- [x] Add controller tests for first-turn-before-dispatch, late events, two conversations, and disposal — accepted user record is re-read from disk before the injected runtime dispatch callback executes.
- [x] Add `ConversationTitlePolicy` plus typed `conversation/rename`; verify immediate fallback, strict 3–6-word generated titles, manual normalization, and manual-wins concurrency.

## Phase 3: Migration and rollout (W3 — R4, R8)

Completed 2026-08-22: default-on experimental flag, monotonic cutover, read-only
legacy inventory, idempotent host migration, conflict preservation, and the frozen
scope/global fixture matrix are implemented and tested.

- [x] Add `LegacyConversationMigrator.ts` and make legacy webview storage read-only under the new path.
- [x] Implement known-scope migration, unassigned bucket, provenance map, idempotency, fingerprint dedupe, and conflict preservation.
- [x] Add `durableAgentConversations` as `experimental` plus `package.json` default `true`; pass coherent enabled/cutover state to the webview.
- [x] Add migration/rollback matrix tests; prove monotonic cutover, host-readability on flag-off, `parallelChats` compatibility, and no dual-write split-brain.

## Phase 4: Lifecycle checkpointing (W4 — R1, R2, R5)

- [x] Persist accepted first/subsequent user turns before runtime prompt dispatch.
- [x] Checkpoint attention, terminal, failed, cancelled, interrupted, and disposal boundaries — extension deactivation awaits restart-boundary checkpoints before runtime disposal.
- [x] Remove transcript ownership from webview state/localStorage and restore only selected canonical ID plus harmless UI state.
- [x] Decouple conversation switching/panel close from runtime disposal.
- [x] Remove persisted open-thread semantics/selectors and conversation Close state; retain only selected canonical ID plus harmless workspace-scoped `pinnedConversationIds`.
- [x] Implement/test five live attachments, protected running/waiting/current rules, LRU idle release, capacity one under `parallelChats=false`, and the fixed user-facing active-work message without internal attachment/session-cap terminology.
- [x] Implement host-authoritative confirmed delete, Stop and delete, Undo for idle/running records, Interrupted-after-Undo, and next-selection behavior.

## Phase 5: Conversations UI (W5 — R5, R6, R7)

- [x] Replace `ChatHistoryPanel` with the host-backed `ConversationsPanel`; remove the stale component name and inline modal implementation.
- [x] Preserve the native AI/Terminal composite switcher, AI Settings, and maximize/close controls; do not add Conversations/New `view/title` actions or a duplicate webview header — verified in the macOS rundev evidence.
- [x] Convert `ThreadRail` to the approved 56px top-aligned permanent conversation rail with strong 40×40 New, automatic union, 12px spacing, and immediate borderless All conversations.
- [x] Keep the conversation rail visible and usable while the Conversations panel overlays only the transcript/composer column.
- [x] Add a portalled Radix tooltip with one full title/status tooltip and no native `title` duplication.
- [x] Implement the separate 20×20 upper-right rail Pin/Unpin hover/focus action as a sibling of the 40×40 selection button.
- [x] Use the shared Phosphor duotone `chat-circle` for all rail/list conversations, remove production custom-SVG identity marks, and persist a project-scoped 24-slot base → deep → soft color identity with Delete+Undo stability.
- [x] Implement and unit-test `selectRailConversationIds` for deduplicated Pinned + Working/Needs you + three activity-ordered recent idle IDs + otherwise-absent current; selection does not reorder Recents.
- [x] Mirror items under Pinned and Active & recent; add workspace UI-state Pins, typed pin icons, confirmed Delete and Undo.
- [x] Add ChatGPT-style titles across all runtimes: immediate first-prompt fallback, isolated post-first-response AI title generation, and row Rename dialog with a manual-wins race contract.
- [x] Add current-row, Working, Needs you, aggregated trigger priority/count, real timestamps, and deterministic ordering.
- [x] Add Earlier conversations / Project unknown move/delete flow.
- [x] Add interim restored-transcript/new-context notice without eager runtime/network work.
- [x] Add direct row-hover/focus trash buttons with title-specific accessible names, plus empty, list/load/storage-failure, corrupt-record, migration, confirmed Delete/Stop and delete, and live-region Undo states.
- [x] Verify keyboard, post-selection/dialog focus, contrast/high-contrast, accessible row/conversation-rail labels, reliable tooltip behavior at rail boundaries and 200% zoom, title truncation, scrolling with large unions, and reduced-motion behavior — live CDP checks confirm visible forced-colors focus, no horizontal overflow, no native tooltip duplication, no reduced-motion pulse/transition, and `Message` composer focus after row selection.

## Phase 6: QA and closeout (W6 — R8)

- [x] Run focused host/webview unit and integration tests — `npm run test:conversations` passes.
- [x] Walk every scenario in `scenarios.md`; every non-native-platform ★ path is automated or live-verified with evidence. Native Windows execution is explicitly deferred to the v1.10 Windows candidate gate, where the same frozen fixtures must run before distribution.
- [x] Verify every checked task against the branch diff and demote any unsupported `[x]` — final review completed 2026-08-23; remaining manual/platform gates stay unchecked below/above.
- [x] Run `./scripts/validate-qa.sh` — passed 2026-08-23 after final review fixes, compile/build, focused tests, and rundev verification.
- [x] Update `docs/development/architecture.md` for subsystem/protocol/state ownership/flag; set `Last updated` on/after branch creation date.
- [x] Update `docs/user/features/ai-agents.md`, `docs/CHANGELOG.md`, and v1.10.0 release notes strategy.
- [x] Update release tracker and Sprint 109 GitHub issue; commit, push, PR, and local risk-first review are complete. Merge/issue closure is authoritative in [PR #209](https://github.com/ProductoryHQ/ritemark-native/pull/209), avoiding a stale duplicated boolean after GitHub changes state.
