# Sprint 109 Spec — Durable Chat History

**Parent:** [sprint-plan.md](./sprint-plan.md) · **Release:** [v1.10.0](../release-plan.md) · **Issue:** [#205](https://github.com/ProductoryHQ/ritemark-native/issues/205) · **Evidence:** [research/current-state-audit.md](./research/current-state-audit.md)

## Purpose

Make every non-empty agent conversation a canonical, crash-safe record belonging to one project scope. Replace the current merge of webview localStorage and open runtime tabs with one host-owned source of truth, so switching, closing, deleting, restarting, and migrating have predictable meanings.

## Principles

- **One conversation, one identity, one record.** UI surfaces are views and never alternate stores.
- **Persist before work.** An accepted prompt survives even if the process dies before the runtime responds.
- **Project privacy by construction.** Ambiguous records are quarantined, never guessed into the current project.
- **Close is not delete.** Dismissing UI cannot destroy durable content.
- **Local and honest.** No cloud-sync implication, no silent retention, no invisible repair that hides loss.
- **Host owns durable data.** The sandboxed webview owns only ephemeral presentation state.

## Requirements

### R1: Canonical durable conversation

As a user, I want each agent conversation to exist as one persistent project record, so History cannot disagree with the conversation I am viewing.

Acceptance criteria:
- Every non-empty conversation has one stable Ritemark `conversationId` that survives panel hide/show, runtime switches, app reload, and restart.
- The extension-host `ConversationStore` is the only durable source of transcript truth; webview localStorage and `vscode.getState()` do not own transcripts.
- A blank draft has no durable record and does not appear in Conversations until the first prompt is accepted.
- List, open, update, and status operations resolve the same canonical record; the UI never synthesizes an extra history row from open-tab state.

### R2: Crash-safe persistence and checkpoints

As a user, I want sent messages and completed agent responses to survive interruption, so a crash cannot make a conversation disappear.

Acceptance criteria:
- The first user prompt is durably written before any runtime `prompt()` call starts.
- Checkpoints occur after user-turn acceptance, runtime/progress state transitions that require user attention, assistant terminal result, failure, cancellation, and webview disposal.
- Store operations are serialized; records and index use temp-write + atomic rename, with schema version and timestamps.
- Immediate process exit after Send restores the user turn with an honest `Interrupted` state rather than losing or fabricating a response.
- Restart while approval/question/plan-review is pending restores the transcript with an `Interrupted` boundary; stale cards are historical/read-only and cannot still be clicked.
- A failed write is surfaced in the conversation UI and debug log; the app does not silently continue as if history were safe.

### R3: Project-safe scope identity

As a user, I want Conversations to show the current project’s chats and nothing from unrelated projects.

Acceptance criteria:
- Project scope is derived host-side from a normalized, sorted set of all workspace folder URIs plus workspace-file/no-folder identity where applicable; it never uses only the first folder.
- Single-root, multi-root, `.code-workspace`, and no-folder windows have distinct tested scopes.
- Windows scope handling covers drive-letter/case normalization and URI ordering; filesystem tests cover rename-overwrite and corrupt quarantine on both macOS and Windows semantics.
- Current-project list queries cannot return records from another scope.
- A renamed or moved folder is not probabilistically matched. Its prior conversations remain recoverable through explicit relink/import behavior and are never attached to the new path silently.
- The stored scope descriptor contains no transcript-derived data and can be inspected for diagnostics.

### R4: Safe, idempotent legacy migration

As an existing user, I want old conversations preserved without leaking into the wrong project.

Acceptance criteria:
- Workspace-scoped localStorage records migrate only to their known matching scope.
- Legacy global/unscoped records enter an **Earlier conversations — Project unknown** bucket and require explicit **Move to this project** or **Delete** action.
- Migration is copy-first, idempotent, schema-versioned, and records provenance; reloading cannot duplicate migrated records.
- Duplicate/ghost candidates are deduplicated by stable legacy ID first and normalized-content fingerprint second, with conflicts preserved for review rather than overwritten.
- Malformed records are isolated and reported without preventing valid records from loading.
- Legacy source data is retained during the rollback window and removed only after verified migration plus explicit cleanup policy.

### R5: Correct conversation lifecycle

As a user, I want switching, background work, and deletion to behave independently, so managing the UI does not kill or resurrect chats.

Acceptance criteria:
- Selecting another conversation changes the current view; it does not delete, clone, or dispose unrelated running sessions.
- Dismissing the Conversations panel has no effect on stored records or runtime sessions.
- **Delete conversation** removes exactly one durable record and cannot be resaved by a subsequent close/dispose callback.
- Deleting any conversation requires explicit confirmation and offers Undo in the current UI session; Undo restores the same ID, scope, transcript, title, and timestamps but increments the binding generation so pre-delete queued events cannot mutate the restored record.
- Deleting a running conversation uses **Stop and delete…**, stops/disposes that runtime session, then removes exactly that record. Undo restores the record with an inline Interrupted boundary but does not restart the stopped work.
- Deleting the current conversation selects the next most recent record or a clean starter state.

### R6: Canonical Conversations plus bounded live sessions

As a user, I want one predictable place to find current, background, and past chats.

Acceptance criteria:
- The panel title is **All conversations**, not Chat History; user-facing `thread`, `open`, `closed`, and `reopen` terminology is removed from this flow.
- The existing native secondary-sidebar title bar keeps the Ritemark AI/Terminal composite switcher, AI Settings, and native maximize/close controls. It does not receive duplicate Conversations/New actions, and the webview does not add a duplicate header.
- The permanent 56px **conversation rail** owns all conversation navigation in one top-aligned stack: a strong 40×40 primary New button; up to five Pinned shortcuts; every Working/Needs you conversation; the three idle conversations with latest real activity; the current conversation only when otherwise absent; then a 40×40 All conversations button immediately after the final chat button. Targets have approximately 8px horizontal breathing room and 12px vertical spacing; the shortcut stack scrolls if necessary rather than shrinking targets.
- Opening All conversations overlays only the webview-owned transcript/composer column and reserves the rail's 56px width. The conversation rail and native secondary-sidebar title bar remain visible and interactive, and the panel does not add a competing navigation bar.
- The All conversations rail trigger is a borderless ghost icon button. Its open state uses `--r-accent-soft` plus the active indigo icon; it never uses a permanent outline container.
- Every conversation button uses the same 20px Phosphor `chat-circle`; the active item uses the standard indigo active state. Clicking anywhere in the 40px selection button only selects the conversation. Status and persistent pin marks do not receive pointer events, and no Close/Stop/Delete control appears on or over it. Every rail entry may expose a separate sibling 20×20 Pin or Unpin button at the upper-right on hover/focus; destructive actions remain in All conversations.
- Every conversation button exposes its full untruncated title and status through one Ritemark-owned portalled tooltip on hover and keyboard focus, with an approximately 250ms delay and left-side placement. Pinned shortcuts use **Pinned — Title — Status**; automatic shortcuts use **Title — Current/Working/Needs you/Recent**. The same text is available in its accessible name. Native `title` is omitted on these controls so the browser cannot display a duplicate tooltip.
- The upper-right rail action has the accessible name **Pin {conversation title}** or **Unpin {conversation title}** and an independent hit target. Pin mutates only `pinnedConversationIds`, moves the same canonical entry into the Pinned rail segment without selecting it, and leaves a non-interactive pin mark at rest. Hover/focus on a Pinned entry replaces that passive mark visually with the `push-pin-slash` Unpin action. Unpin removes only the Pin guarantee; a still-qualifying automatic entry moves below the divider and remains visible. At five-Pin capacity Pin is disabled with the existing capacity explanation.
- Pinned membership is harmless workspace UI state (`pinnedConversationIds`), not canonical conversation state, runtime state, or open/closed state. Persisted open-thread semantics and conversation-level Close state are removed. Selecting a saved conversation never Pins it implicitly and never asks the user to make room.
- Rail membership is a deduplicated derived union of `pinnedConversationIds`, every authoritative Working/Needs you conversation ID, the three idle IDs with greatest real `lastActivityAt` (stable tie-break by `conversationId`), and `currentConversationId` only when otherwise absent. Each ID appears once; Pinned owns the display group, followed by active work, recent idle, then an otherwise-absent current conversation. Selection never updates `lastActivityAt` or reorders Recents. Automatic membership is never persisted and rotates only after real activity without deleting or closing a conversation.
- At most five conversations may be Pinned. **Pin** guarantees the shortcut remains after it leaves the automatic set; **Unpin** removes only that guarantee, so a still-current/active/recent conversation remains automatically visible. Neither changes selection, transcript, runtime, or durable storage. Ritemark never automatically unpins. A sixth Pin is disabled with **Unpin a conversation before pinning another.** The runtime-work limit remains independent and is evaluated only on Send.
- Standard history rows reveal direct 30×30 ghost Pin/Unpin and `trash` icon buttons on row hover and `focus-within`, with exact accessible names containing the title. Delete opens the existing confirmation flow; running work maps to **Stop and delete…** and no hover action deletes immediately.
- A new conversation immediately uses a whitespace-normalized, word-boundary-shortened version of its first prompt as the host title. After the first successful assistant response, the host asks that conversation's selected runtime for one 3–6-word title in the user's language through a fresh tool-free, read-only one-shot session. Title generation never enters or mutates the active conversation context, and failure silently retains the deterministic fallback.
- Standard history rows also reveal a direct `pencil-simple` Rename action. Rename accepts a non-empty title up to 80 characters through the typed host protocol. If the user renames while AI title generation is in flight, the manual title wins and is never overwritten.
- At most five runtime attachments remain live. Running/waiting/current attachments are protected; a non-current idle attachment is released least-recently-used when capacity is needed. Releasing it retains the canonical transcript and marks the next continuation as a new working context until Sprint 110.
- If all five live sessions are running or waiting for the user, starting another turn is blocked with the exact user-facing message **Five conversations are already working or waiting for you. Finish, answer, or stop one before starting another.** Reading/selecting/creating/saving conversations remains unlimited. User-facing copy never says `attachment`, `session cap`, or `make room`.
- The current conversation uses the standard indigo active-row treatment and never an `OPEN` badge.
- Rows sort by real `lastActivityAt`, with stable tie-breaking by `conversationId`; no synthetic current-time timestamps.
- Idle rows show title and last-updated time only. `Interrupted` appears inline in the transcript, not as a permanent list status.
- The All conversations button and conversation rail aggregate authoritative state with `Needs you` overriding `Working`, include counts in accessible labels, and have no status indicator when all conversations are idle. All conversations mirrors permanent shortcuts under **Pinned** and derived shortcuts under **Active & recent**, using the same chat icon and explicit Current/Working/Needs you status.
- The panel supports keyboard focus entry, arrow/tab navigation, Enter to select, Escape to return, and restores focus to its trigger. Selecting a row closes the panel and moves focus predictably to the transcript/composer.
- Opening a saved transcript before Sprint 110 continuation exists shows **This conversation was restored. Previous messages are visible, but the agent starts with a new working context.** only when no matching live runtime session remains, such as after app restart or LRU release. A conversation still backed by its matching live session shows no warning because its working context remains live. Neither state silently implies provider memory that is not present.
- Empty state says **No conversations in this project yet** and offers New conversation. List/load failure is distinct from one corrupt row; long titles retain a full accessible name/tooltip and visible timestamp.
- Status is never color-only; reduced-motion keeps textual status while disabling spinner/pulse animation.

### R7: Storage, corruption, and retention honesty

As a user, I want the app to preserve all my conversations or tell me when it cannot.

Acceptance criteria:
- There is no automatic count cap and no silent deletion of oldest conversations.
- Store diagnostics report record count and byte usage; attachment payloads are metadata-only unless a later requirement explicitly adds managed blobs.
- One corrupt record cannot hide the list; opening it shows **Couldn’t open this conversation** and never creates a replacement ghost.
- A corrupt/missing index is rebuilt from valid record files; unrecoverable entries are quarantined and logged.
- Storage-full/permission/write failures produce an actionable visible state and retain the last verified record version.

### R8: Rollout, architecture, and regression coverage

As the team, we want migration to be reversible and the new contract pinned by tests before it becomes the release foundation.

Acceptance criteria:
- `durableAgentConversations` is `experimental` with `ritemark.features.durableAgentConversations` defaulting to `true`, so it is default-on yet runtime-disableable; stable flags are not used because they cannot serve as runtime kill switches.
- Cutover is monotonic: before the first host-store write, flag-off may use the legacy read path; after the first host-store write, host storage remains the authoritative readable archive even when the new write/UI path is disabled. Flag-off can never strand host-only conversations behind a legacy-only view.
- During the rollback window legacy data is read-only and no dual-write split-brain is introduced. Compatibility behavior with `parallelChats` is tested: when parallel chats are disabled, durable storage remains canonical while active runtime capacity collapses to one.
- Unit/integration tests cover R1–R7, including immediate-exit, delete idempotency, migration matrix, corrupt data, multi-root, no-folder, and two parallel conversations.
- A live dev restart matrix and screenshot set exercise the scenarios in [scenarios.md](./scenarios.md).
- Accessibility validation covers contrast/high-contrast mode, dialog focus trap/restoration, row names containing title/time/status, live-region announcement of Undo, reliable conversation-rail tooltips, and accessible New/All conversations/recovery controls.
- `docs/development/architecture.md`, user docs, changelog, release tracker, and Sprint 109 issue are updated before close.

## Non-Requirements

- Provider-native session/thread resume; that is Sprint 110.
- Search, runtime filter, or All-projects browsing beyond explicit legacy recovery; deferred beyond v1.10.0.
- Search and cross-project browsing in All conversations.
- Cloud sync, export/share, archive/trash library, tags, folders, semantic memory, or retention automation.
- Resuming a turn that was executing when the desktop process exited.
- Replaying old attachments, tools, approvals, plans, or progress into a runtime.
- Scheduled-task or Flow conversation persistence changes.

## Resolved Questions

- **Source of truth:** host-owned `ConversationStore`, not webview localStorage.
- **Conversation rail:** permanent navigation UI whose automatic working set is derived from canonical IDs and authoritative runtime state. Its bounded workspace-scoped `pinnedConversationIds` only add permanence; they never own transcript data, deletion, runtime capacity, or an open/closed lifecycle.
- **Legacy global items:** explicit unassigned recovery bucket; never silently assigned.
- **Retention:** no count/age pruning in v1.10.0.
- **Rollout:** experimental/default-true flag plus monotonic cutover; host-only records remain readable on flag-off, with no dual writes.
- **Folder moves:** explicit relink/recovery; no unsafe content/path guessing.
- **Rollback window:** legacy sources are never automatically removed in v1.10.x; earliest cleanup is v1.11.0, at least 30 days after verified migration, and only through an explicit counted confirmation.
- **No-folder identity:** one installation-wide canonical scope, stable across restart and isolated from every folder/workspace scope.
- **Ambiguous multi-root legacy data:** an old first-folder hash cannot prove multi-root ownership and therefore migrates to unassigned, not the current project.
- **Flag-off after cutover:** presentation may roll back, storage authority may not; host-backed compatibility read/write remains active and legacy stays read-only.
- **Conversation titles:** the host is the sole policy owner across Claude, Codex, and OpenCode. The fallback is immediate, AI generation happens once after the first successful response in an isolated session, and explicit user Rename always wins.

## Phase 0 Freeze Note — 2026-08-22

The fixture corpus and schema/protocol/lifecycle decisions are recorded under
`research/`. Jarmo approved the complete Phase 0 freeze candidate and the
separately reviewed `design.md` baseline on 2026-08-22. Phase 1 implementation
is authorized; native Windows execution of the frozen filesystem cases remains
a QA-complete gate.
