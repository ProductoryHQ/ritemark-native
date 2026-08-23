# Sprint 109 Technical Plan

Architecture and implementation approach for [spec.md](./spec.md), grounded in [research/current-state-audit.md](./research/current-state-audit.md).

## Architecture Overview

Sprint 109 adds a host-owned conversation subsystem and makes the webview a client of it:

```text
AI Sidebar webview
  ConversationsPanel + transcript view
          ↕ typed conversation messages over bridge.ts
ConversationController (extension host)
          ↕
ConversationStore ─ ProjectScopeResolver ─ LegacyConversationMigrator
          ↕
context.globalStorageUri/conversations/v1/
```

Proposed host files:

```text
extensions/ritemark/src/conversations/
  types.ts
  protocol.ts
  projectScope.ts
  ConversationStore.ts
  LegacyConversationMigrator.ts
  ConversationController.ts
  ConversationTitlePolicy.ts
  ConversationTitleGenerator.ts
```

Proposed webview files:

```text
extensions/ritemark/webview/src/components/ai-sidebar/
  conversationClient.ts
  ConversationsPanel.tsx
  conversationSelectors.ts
```

The controller is composed into `UnifiedViewProvider`; store/migration/runtime-specific logic must not be added directly to that already-large provider. The canonical wire union lives in `src/conversations/protocol.ts`; the webview consumes it as type-only contract while runtime validation remains at the bridge boundary.

## Stored Model

Each `ConversationRecordV1` contains:

- stable Ritemark `conversationId`;
- `projectScopeId` plus non-sensitive normalized scope descriptor;
- title, `createdAt`, `lastActivityAt`, schema version, migration provenance;
- normalized transcript events with stable event/turn IDs and lifecycle state;
- monotonic `bindingGeneration` used to reject pre-delete/pre-restore queued events;
- runtime used per turn and attachment names/metadata only;
- optional opaque continuation descriptor slot reserved for Sprint 110, host-only authority;
- no attachment base64 blobs, webview layout state, pending approval capability, or executable tool state.

Storage layout:

```text
globalStorageUri/conversations/v1/
  index.json
  records/<conversationId>.json
  quarantine/<timestamp>-<source>.json
  migration.json
```

All writes are serialized inside one extension host. A record is written to a same-directory uniquely named temp URI and renamed over the target; the best-effort index is updated only after the record write succeeds. Record files remain canonical, and startup/directory reconciliation repairs an index missing records committed by another window or a failed index write. Delete writes a tombstone before removing the record, uses an in-memory Undo snapshot for the active UI session, and increments `bindingGeneration` on restore so pre-delete events cannot mutate the restored ID.

## Workstream 0: Audit fixtures and schema decisions (R2–R4, R7)

- Build a checked-in synthetic migration corpus for scoped, global, duplicate, malformed, quota/write failure, multi-root, no-folder, and corrupt-index cases; never copy real user transcripts into the repo. The Phase 1 harness consumes these fixtures directly.
- Audit VS Code `globalStorageUri` rename semantics through the extension’s test filesystem abstraction on macOS and Windows, including Windows drive/case normalization, rename-overwrite, and corrupt quarantine. Phase 0 records local macOS execution plus pinned Windows provider semantics; native Windows execution remains a QA-complete gate.
- Decide rollback-window duration, monotonic cutover, `parallelChats` interaction, no-folder scope behavior, explicit folder relink UX, and five-attachment LRU lifecycle; append decisions to all SDD artifacts before schema freeze.
- Produce `design.md` with a compact prototype for the permanent automatic-working-set + Pinned conversation rail, New/All conversations controls, Pin/Unpin/Delete actions, reliable title tooltips, attention priority, migration recovery, delete/Undo, and interim restored-context notice.
- Capture the current store/read/save/delete lifecycle with requirement-linked evidence.
- Stop for Jarmo’s explicit Phase 0 decision approval before Workstream 1.

## Workstream 1: Schema, project identity, and atomic store (R1–R3, R7)

- Implement `types.ts`, `projectScope.ts`, and `ConversationStore.ts` from `research/record-and-protocol-decisions.md`, with versioned codecs/validators and injected filesystem/clock/ID dependencies for tests.
- Normalize and sort all workspace folder URIs; include workspace-file/no-folder discriminator; hash only the normalized descriptor for the scope ID.
- Implement `list/get/create/checkpoint/delete/restore/getDiagnostics`, serialized operation queue, temp-write+rename, record-directory/index reconciliation, tombstones, quarantine, and stable sorting.
- Persist first-turn record before runtime prompt dispatch. A store failure blocks dispatch and produces a host-originated actionable event.

## Workstream 2: Typed host↔webview protocol and controller (R1, R2, R5, R8)

- Add request/result/event unions for initialize, list, get, create-first-turn, checkpoint, select, rename, delete, restore, migrate, and diagnostics.
- Validate conversation ID and project scope host-side for every mutation; unknown/tombstoned IDs are rejected, never redirected to the visible conversation.
- Add `ConversationController` as the lifecycle owner and route thin message cases from `UnifiedViewProvider`.
- Keep provider-native runtime session ownership in the existing runtime registry/session maps; the controller coordinates but does not duplicate adapters.
- Centralize title normalization in `ConversationTitlePolicy`. The first prompt yields the immediate fallback. On the first successful response, `ConversationTitleGenerator` uses `createRuntime(runtimeId)` to open a fresh tool-free/read-only one-shot session on the selected runtime, then disposes it. The controller applies the generated title only if the record still has the exact fallback, so concurrent manual Rename wins.

## Workstream 3: Legacy migration and rollback (R4, R8)

- Convert `chatHistoryStorage.ts` into a read-only legacy adapter during the rollback window.
- Migrate known workspace records to their matching scope; put global/ambiguous records into an unassigned bucket.
- Deduplicate by legacy ID and normalized transcript fingerprint. Persist source key, source ID, migrated record ID, checksum, and completed timestamp in `migration.json`.
- Never dual-write. Define `durableAgentConversations` as `experimental` with a `package.json` setting defaulting to `true`; test actual `featureGate` behavior rather than calling a stable flag a kill switch.
- Persist a monotonic cutover state: legacy-read/write is allowed only before the first host record write. After that write, host storage remains readable and writable on flag-off through a compatibility presentation, legacy becomes read-only, and host-only records can never disappear behind legacy-only UI.
- Define interaction with `parallelChats`: durable history remains canonical under either value; disabling parallel chats limits live runtime capacity to one without deleting records. A protected working/needs-user attachment blocks only Send and uses user-facing work-state copy.
- Make migration restartable after partial failure and preserve conflicts/quarantine evidence.

## Workstream 4: Lifecycle checkpoint integration (R1, R2, R5)

- Refactor the AI sidebar store so conversation records arrive from the host; `vscode.getState()` retains only harmless UI fields plus the selected canonical ID and workspace-scoped `pinnedConversationIds`.
- Checkpoint accepted user turns, assistant results, failure/cancel/interrupted boundaries, attention states, and disposal.
- Ensure switching views does not dispose a running `RuntimeSession`; explicit Stop/Delete does.
- Make Delete host-authoritative and idempotent before removing obsolete close→persist coupling.
- Remove persisted open-thread semantics/selectors and conversation Close state. Convert `ThreadRail` into a permanent conversation rail derived from canonical IDs and authoritative state; explicit Pinned IDs add permanence but never own durable records or runtime lifecycle.
- Implement a five-attachment manager: running/waiting/current attachments are protected; evict LRU non-current idle attachment when starting work; if all five are protected, block only Send with active-work copy. `parallelChats=false` sets attachment capacity to one.

## Workstream 5: Conversations UX (R5, R6, R7)

- Replace `ChatHistoryPanel` with `ConversationsPanel` backed only by host results. Change the overlay from `inset-0` to `inset: 0 56px 0 0` inside the `AISidebar` webview root so it covers the transcript/composer column while the conversation rail remains visible and interactive. The native secondary-sidebar title bar remains outside the overlay. Do not add a competing navigation bar in the panel header.
- Convert `ThreadRail` into the permanent conversation rail: a top-aligned stack in a 56px rail with a strong 40×40 New button; up to five Pinned `chat-circle` shortcuts; all Working/Needs you; three most-recent idle shortcuts; an otherwise-absent current shortcut appended; then a borderless ghost 40×40 `chat-circle` All conversations button immediately after the last chat button. Selection must not reorder Recents. Use approximately 8px horizontal breathing room and 12px vertical spacing, with a scrollable shortcut stack when necessary. Give the open history trigger the soft indigo active treatment. Remove the 28px robot target and nested hover-close; status/pin layers use `pointer-events: none`. Mirror membership under Conversations → Pinned and Active & recent. Preserve the Ritemark AI/Terminal composite switcher, AI Settings, and native maximize/close actions without adding duplicate `view/title` navigation.
- Add `push-pin` and `push-pin-slash` to the shared typed `Icon` map and iconography table. In the rail, render each entry as a non-interactive wrapper containing sibling controls: the 40×40 selection button and a 20×20 upper-right Pin/Unpin ghost button revealed on wrapper hover/`focus-within`. Pin and Unpin stop propagation and mutate only `pinnedConversationIds`; Pin moves the same item before the divider and leaves a passive pin mark at rest, while Unpin moves a still-qualifying item below the divider without hiding it. In panel rows reveal direct 30×30 ghost Pin/Unpin and `trash` buttons with title-specific accessible names. Delete always routes through confirmed Delete / Stop and delete plus Undo.
- Add a shared Ritemark `Tooltip` primitive backed by `@radix-ui/react-tooltip` Provider/Root/Trigger/Portal/Content. Use left-side placement, approximately 250ms delay, a 260px wrap limit, the full title/status string, and the same accessible name. Do not set native `title` on a control that owns a Ritemark tooltip; test that only one tooltip appears.
- Use the shared Phosphor `chat-circle` through `Icon` for every conversation (20px rail, 16px row); current/status remain separate visual layers. No production custom SVGs or per-conversation colors.
- Add a pure `selectRailConversationIds` selector that unions `pinnedConversationIds`, every authoritative Working/Needs you ID, and the three idle IDs with greatest real `lastActivityAt`; append `currentConversationId` only when otherwise absent. Deduplicate by canonical ID and use `conversationId` for stable ties. Selection must not alter recent order. The derived automatic set is never persisted.
- Persist `pinnedConversationIds` as harmless workspace UI state with a five-item bound. Pin and Unpin are explicit; selecting never pins, Ritemark never automatically unpins, and Pin is disabled at capacity with **Unpin a conversation before pinning another.** Unpin removes only permanence, so a still-qualifying automatic shortcut remains. Pin/Unpin never deletes, disposes, selects, or alters runtime state. Keep Stop/Delete separate and confirmed.
- Show current-row treatment, real last-activity time, `Working`, and `Needs you`; carry attention to the closed-panel trigger.
- Add Earlier conversations / Project unknown actions, delete confirmation, Stop and delete, Undo, storage/corrupt/error states.
- Add a row-hover/focus `pencil-simple` Rename action and compact dialog. The webview sends only `conversation/rename`; the host validates scope, binding generation, whitespace, and the 80-character title policy before checkpointing.
- Add the interim restored-transcript/new-working-context boundary until Sprint 110 replaces it with host-derived continuation states; opening/selecting alone stays runtime/network-lazy.
- Aggregate All conversations/conversation-rail state (`Needs you` > `Working` > idle) with accessible counts; add empty/list-failure/long-title states and post-selection focus.
- Follow existing Indigo-Editorial tokens, Phosphor icons, shadcn dialog primitives, accessible names, live regions, contrast/high-contrast, focus trap/restoration, and reduced-motion behavior.

## Workstream 6: Tests, canary, and architecture close (R8)

- Host unit tests: schema, atomic write ordering, index rebuild, corrupt isolation, scope matrix, migration idempotency/dedupe, delete tombstone, Undo.
- Webview tests: selectors/sorting, no synthetic rows, attention, keyboard semantics, delete flow, blank-draft behavior.
- Integration tests: prompt persistence before dispatch, two running conversations, pending-card restart invalidation, five-attachment LRU/protected limit, `parallelChats` interaction, reload/restart, and host rejection of late/pre-delete events after Undo generation changes.
- Live dev matrix: all ★ scenarios with temporary synthetic profiles/workspaces and screenshot evidence under `research/screenshots/`.
- Update architecture subsystem map/protocol/session ownership/feature flag, user docs, changelog, release tracker, and issue before readiness handoff; architecture `Last updated` must be on/after the Sprint 109 branch creation date.

## Implementation Order

W0 audit → W1 store/scope → W2 controller/protocol → W3 migration behind flag → W4 lifecycle integration → W5 UI replacement → W6 QA/docs. Each workstream must be independently committable with requirement IDs. Do not delete the legacy reader until rollback criteria are met in a later explicit cleanup decision.

Phase 0 freeze artifacts: `research/fixtures/`,
`research/atomic-write-audit.md`,
`research/record-and-protocol-decisions.md`, and
`research/migration-and-lifecycle-decisions.md`. Legacy cleanup is prohibited in
v1.10.x; the earliest eligible explicit cleanup is v1.11.0 after 30 days and
verified counts.

## Architecture Gate

Triggered by a new `src/conversations/` subsystem, new webview↔host message union, new feature flag, and changed ownership of conversation state. `docs/development/architecture.md` must be updated before Sprint 109 closes. No locked decision is violated: the webview remains sandboxed, three runtimes remain behind `AgentRuntime`, and `UnifiedViewProvider` is composed with a controller rather than expanded with storage logic.
