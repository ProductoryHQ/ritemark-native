# Sprint 115 Technical Plan — Reliable Editor–Disk Synchronization

## Status and Gate

This is an architecture proposal, not implementation authorization. Phase 0 reproduces the failure and freezes the protocol, selection, comparison, and multi-view decisions. Product-code work begins only after Jarmo approves the sprint and Phase 0 decisions on a dedicated `codex/sprint-115-editor-disk-sync` branch.

## Architectural Decision

Retain `RitemarkEditorProvider` as a VS Code `CustomTextEditorProvider` and keep the webview sandboxed. Add a host-owned, per-URI `DocumentSyncCoordinator` that is the only authority allowed to derive sync/conflict state.

The provider becomes an adapter for VS Code lifecycle, file invalidations, and webview messages. The coordinator owns ordering and state. The webview owns rendering and must acknowledge what it actually applied; it never gains filesystem access.

This deliberately advances only the document-sync slice of architectural debt issue #106. It does not convert the entire application bridge in this sprint.

## Requirement Coverage

| Requirement | Technical owner |
|---|---|
| R1 | Per-URI coordinator, view epochs, serialized state model |
| R2 | Typed update/ACK protocol and retry lifecycle |
| R3 | Revision-aware focused application and selection restoration |
| R4 | Conflict snapshots and compare-and-set resolution |
| R5 | Pure webview reducer and derived header state |
| R6 | Deterministic reconciliation, coalescing, and stale rejection |
| R7 | Markdown/CSV payload parity and multi-view leases |
| R8 | Test strategy, diagnostics, architecture gate, and release docs |

## State Model

Each open URI has one coordinator record and one or more view sessions.

| State | Identity | Owned by | Meaning |
|---|---|---|---|
| Disk | content hash plus observed file metadata | Coordinator | Latest bytes confirmed by a disk read. |
| Model | `TextDocument.version`, content hash, `isDirty` | VS Code/coordinator snapshot | Current working-copy content. |
| Base | disk revision/hash | Coordinator | External revision on which current local edits began. |
| View | epoch, last sent revision, last acknowledged revision/hash | Coordinator per webview | What TipTap/table state proved it rendered. |
| Pending | target revision, attempt, deadline | Coordinator per webview | Update sent but not yet acknowledged. |
| Conflict | base, local snapshot, disk snapshot | Coordinator | Local and disk changed independently from the same base. |

A revision identity is `{ epoch, sequence, contentHash }`. Sequence is monotonic within the epoch; content hash detects equal bytes and supports idempotency. Epoch changes whenever a view is reconstructed.

The external-change affordance is derived from `pending`, `applyError`, or `conflict`. Local-only divergence does not satisfy that predicate.

## Typed Sync Protocol

Create a Node/VS Code-free discriminated union for the document-sync messages and runtime validation at the boundary. Phase 0 verifies a shared source location that compiles in both the host and webview TypeScript builds; the preferred location is `extensions/ritemark/src/editorSync/protocol.ts` with type-only consumption by the webview.

### Host to webview

```ts
type DocumentUpdateMessage = {
  type: 'document:update'
  uri: string
  epoch: string
  revision: number
  baseRevision: number
  contentHash: string
  reason: 'open' | 'external' | 'revert' | 'resolution'
  payload: MarkdownDocumentPayload | CsvDocumentPayload
}

type DocumentSyncStateMessage = {
  type: 'document:sync-state'
  uri: string
  epoch: string
  state: 'synced' | 'applying' | 'conflict' | 'apply-error'
  diskRevision: number
  acknowledgedRevision: number
  attempt?: number
}
```

### Webview to host

```ts
type DocumentAppliedMessage = {
  type: 'document:applied'
  uri: string
  epoch: string
  revision: number
  visibleContentHash: string
}

type DocumentEditMessage = {
  type: 'document:edit'
  uri: string
  epoch: string
  baseRevision: number
  clientSequence: number
  payload: MarkdownEditPayload | CsvEditPayload
}

type DocumentConflictActionMessage = {
  type: 'document:conflict-action'
  uri: string
  epoch: string
  diskRevision: number
  action: 'compare' | 'keep-local' | 'use-disk' | 'retry-apply'
}
```

Unknown messages, mismatched URIs/epochs, stale revisions, and invalid payloads are rejected with content-free diagnostic logs.

## Host Workstream

### `DocumentSyncCoordinator`

- One instance owns all open-document records; each URI record uses a serial promise queue or equivalent non-reentrant transition executor.
- Registers and unregisters view epochs independently from the URI lifecycle.
- Reconciles disk, model, base, and each acknowledged view after invalidation hints.
- Coalesces rapid observations to the newest confirmed disk revision.
- Sends idempotent updates, waits for ACK, retries within a bounded budget, and exposes apply failure without claiming success.
- Detects local-only, clean external, and true conflict states without a bounded self-hash history.
- Disposes watchers/polls only after the last view/document lease ends.

### `RitemarkEditorProvider`

- Routes VS Code document changes, saves, watcher events, and polling ticks into the coordinator.
- Routes typed edit/ACK/action messages to the matching URI and epoch.
- Keeps existing file parsing/rendering helpers but assembles one revision-consistent payload.
- Removes `lastSentToWebview`, `selfContentHashes`, the `showFileChangeNotification` contract, and the ten-second auto-reload path after replacement coverage exists.

### Conflict snapshots

For **Compare changes**, register a small read-only `TextDocumentContentProvider` under a `ritemark-sync:` scheme. It exposes immutable, revision-named local and disk snapshots to VS Code's diff command. Snapshot content is memory-only, scoped to the conflict, never saved automatically, and disposed after resolution/document close.

**Keep my version** and **Use disk version** both re-read current disk identity before changing state. If the expected disk revision no longer matches, the coordinator creates a new conflict instead of writing.

## Webview Workstream

### Pure sync reducer

Add a small reducer/state module that accepts typed sync messages, rejects stale epoch/revision updates, and derives the header state. App-level React state must not carry a second independent boolean.

### Editor application and acknowledgement

- Remove the focused-editor early return for revisioned external updates.
- Apply the full payload atomically from the webview's perspective.
- Preserve focus; restore the previous selection/scroll position where valid and clamp it when the new document is shorter or structurally different.
- Compute the visible serialized content identity after application.
- Send `document:applied` only after content, properties/image mappings, or CSV data correspond to the same revision.
- Never emit a normal local-edit message as a side effect of applying a host revision.

### Header and conflict UX

Implement [design.md](./design.md): no action for synced/local-only states, a bounded retry/review state for failed application, and a persistent **Review changes** action for true conflict. Clicking opens the conflict flow; it does not optimistically clear state.

Use the existing Phosphor icon wrapper and design tokens. No new icon library, one-off SVG, success toast, or persistent “synced” ornament is added.

## Detection and Reconciliation

1. File watcher, `onDidChangeTextDocument`, save event, or polling fallback invalidates a URI.
2. The serial coordinator snapshots model state and, when needed, reads disk.
3. Equal content identities converge metadata without a UI event.
4. Local-only divergence retains the base and stays quiet.
5. Clean external divergence advances disk/base and sends one new view revision.
6. Two-sided divergence captures immutable snapshots and enters conflict.
7. Only a matching `document:applied` ACK advances visible state.

Polling remains a single-file reliability fallback, but its cadence and stat/read optimization are frozen from trace evidence in Phase 0. Polling must be level-triggered and idempotent; correctness cannot depend on receiving every watcher event.

## File Surface

Expected implementation surface, subject to Phase 0 naming/compile verification:

- `extensions/ritemark/src/editorSync/DocumentSyncCoordinator.ts` — state machine and serialized reconciliation.
- `extensions/ritemark/src/editorSync/protocol.ts` — typed messages and validators without Node/VS Code imports.
- `extensions/ritemark/src/editorSync/ConflictSnapshotProvider.ts` — immutable compare URIs.
- `extensions/ritemark/src/ritemarkEditor.ts` — provider adapter and legacy-path removal.
- `extensions/ritemark/webview/src/editorSync/syncState.ts` — pure view reducer/selectors.
- `extensions/ritemark/webview/src/App.tsx` — typed message routing and derived header state.
- `extensions/ritemark/webview/src/components/Editor.tsx` and CSV equivalent — revision application/ACK.
- Document-header/conflict dialog components — truthful action and explicit resolution.
- Focused host/webview tests plus a Ritemark dev smoke scenario.
- `docs/development/architecture.md`, changelog, v1.10.0 release notes, and test evidence.

No VS Code submodule or patch change is planned.

## Test Strategy

- Pure coordinator tests with an in-memory disk/model/view harness and a deterministic fake clock.
- Protocol codec tests for every union member plus malformed/stale payloads.
- Webview reducer tests for ordering, epoch replacement, ACK, retry, conflict, and action visibility.
- Editor component tests proving focused application and no feedback edit emission.
- Provider integration tests using temporary files for watcher/poll/save sequencing, Markdown/CSV, and multiple views.
- Dev smoke test in folder and standalone-file modes with an external process writing while the editor is focused.
- Conflict smoke test proving no state changes after at least the former ten-second danger window.

## Performance and Diagnostics

- Hash only after an invalidation or validated polling signature change; do not maintain an arbitrary last-20 history.
- Coalesce bursts, cap retries, and keep one timer/poll lease per URI rather than per view.
- Log URI-safe identity, epoch suffix, revision numbers, transition, source, attempt, and elapsed time. Never log document content, front matter values, or CSV cells.

## Rollout and Rollback

No feature flag is added. The old path contains a data-loss risk and is deleted only after replacement tests pass. Rollback is the Sprint 115 PR/release commit; there is no runtime path back to the timer-based behavior.

No new runtime dependency is expected. Full ProseMirror collaboration/rebase remains a future option if whole-document replacement cannot meet the measured selection requirements, but it is not silently added to this sprint.

## Architecture Gate

The gate is unconditional because this sprint adds a host subsystem, changes document state ownership, and adds webview↔host message contracts. Before close, `docs/development/architecture.md` must document:

- `src/editorSync/` ownership and lifecycle;
- disk/model/base/view revisions;
- update/ACK/edit/conflict protocol;
- retry, stale-message, and multi-view rules;
- the revised core file-editing flow;
- the relationship to unresolved global typed-protocol debt #106.

Its `Last updated` date must be on or after the Sprint 115 branch creation date.
