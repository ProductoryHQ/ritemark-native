# Sprint 109 Research — Current Conversation History Audit

**Date:** 2026-08-21<br>
**Decision:** Ship a new host-owned store and migrate safely; do not patch the existing merged-list model in place.

## What was inspected

- `webview/src/components/ai-sidebar/ChatHistoryPanel.tsx`
- `webview/src/components/ai-sidebar/ThreadRail.tsx`
- `webview/src/components/ai-sidebar/chatHistoryStorage.ts`
- `webview/src/components/ai-sidebar/store.ts`
- `webview/src/components/ai-sidebar/AISidebar.tsx`
- `src/runtime/AgentRuntime.ts` and all three runtime adapters
- Existing Sprint 99 architecture/session documentation and focused thread-rail/conversation reset tests

## Findings

| ID | Finding | Consequence |
|---|---|---|
| F1 | History merges webview-localStorage archive records with in-memory open conversations. | Rows are synthesized from two owners; list content/timestamps can disagree with persisted data. |
| F2 | The robot rail represents the in-memory open set and shares conversation IDs with `OPEN` History rows. | User sees two competing navigation/state models. |
| F3 | Legacy storage keys are scoped by a hash of only the first workspace path and capped at 50. | Multi-root identity is incomplete and old conversations are silently pruned. |
| F4 | Legacy global migration copies global entries into whichever workspace initializes migration. | Cross-project leak/duplication risk. |
| F5 | Persistence happens mostly on new/close or terminal result, not before first runtime dispatch. | Immediate crash can lose the accepted prompt and entire first conversation. |
| F6 | `AISidebar.tsx` restores transcript fields from `vscode.getState()` into a fresh random active ID while open IDs restore separately. | Reload can create ghost/duplicate records. |
| F7 | Closing disposes the runtime session; reopening restores transcript only. | Visible history overstates continuation; provider memory is not restored. |
| F8 | Delete removes storage and then calls close logic that can persist the same conversation again. | Deleted open conversations can resurrect. |
| F9 | Runtime-native IDs are memory-only and absent from durable records. | Sprint 110 needs explicit host-only continuation descriptors. |

## Surviving behavior worth preserving

- Conversation-scoped runtime/session routing introduced in Sprint 99 prevents cross-chat callbacks.
- Unknown runtime conversation IDs are dropped rather than redirected to the visible chat.
- Parallel sessions can continue independently; the new UI/store must not collapse runtime isolation.
- Existing lifecycle/status selectors provide reusable authoritative Working/Needs-you inputs.

## Alternatives considered

### Patch localStorage and keep rail + History

Rejected. It leaves the webview as durable-data owner, preserves two navigation models, and cannot provide atomic host writes or a clean Sprint 110 continuation handle.

### Keep only webview state and replay it to runtimes

Rejected. `vscode.getState()` is panel UI persistence, not a project database; it also repeats the fresh-ID ghost failure.

### Host-owned canonical store

Selected. It respects the sandbox boundary, provides atomic/versioned migration, keeps opaque runtime descriptors off the webview, and gives Sprint 110 a stable identity.

## Audit-first work still required in Phase 0

- Measure atomic rename/failure/quarantine semantics through the selected VS Code filesystem API for macOS and Windows behavior, including drive/case normalization.
- Freeze synthetic migration fixtures and content-fingerprint normalization.
- Decide monotonic cutover, rollback window, host-readable flag-off behavior, `parallelChats` interaction, and cleanup behavior for legacy source data.
- Decide no-folder scope lifetime and explicit moved-folder relink wording.
- Decide the permanent conversation rail, its derived active/recent working set, explicit bounded Pin/Unpin state, five-attachment LRU/protected runtime lifecycle, and the approved `design.md` states without conflating rail membership with durable or runtime ownership.

No implementation should start until these decisions are reflected in `spec.md`, `scenarios.md`, and `technical-plan.md`.
