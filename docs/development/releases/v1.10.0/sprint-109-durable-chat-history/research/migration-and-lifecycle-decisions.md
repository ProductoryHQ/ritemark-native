# Sprint 109 Migration and Lifecycle Decisions

**Status:** Approved Phase 0 decisions (Jarmo, 2026-08-22)
**Date:** 2026-08-22

## Decision summary

| Topic | Proposed decision |
|---|---|
| Rollback window | Never delete legacy source automatically in v1.10.x. Earliest cleanup is v1.11.0, at least 30 days after that installation's verified migration, and only through an explicit user action showing record counts. |
| Cutover | Three monotonic modes: `legacy` → `host-canonical` or `host-compat`. First successful host record write permanently establishes host authority. No dual writes. |
| Flag-off before cutover | Use legacy read/write behavior; host migration may be inspected but does not claim authority. |
| Flag-off after cutover | Use a compatibility presentation backed by host list/get/write/delete. Never return to legacy writes and never hide host-only records. |
| Known legacy scope | Auto-map only the current single-root legacy prefix whose path hash is reproducible from that one root. Multi-root/`.code-workspace` first-root prefixes are ambiguous and go to unassigned. |
| Global legacy scope | Always `unassigned-legacy`, including records that may once have come from a no-folder window. Never guess them into current project or new no-folder scope. |
| No-folder | One installation-wide canonical scope, stable across restarts and isolated from all folder/workspace scopes. |
| `parallelChats` | Storage is canonical under both values. `false` changes live runtime capacity to one, not conversation retention or list behavior. |
| Folder moved/renamed | New path creates a new scope. Recovery lists prior scope labels/counts only; user explicitly selects a prior scope and confirms relink. No similarity/content/mtime guessing. |
| Live runtime bound | Five attachments with running, needs-user, and current protected. On Send, release least-recently-used non-current idle attachment. Selecting/reading never consumes capacity. |
| All protected | Block only Send. At capacity five use the spec's exact message. With `parallelChats=false`, say another conversation is still working or waiting and offer navigation/Stop; do not mention internal capacity. |

## Monotonic cutover state

`migration.json` stores a versioned state machine:

```text
legacy
  └─ first successful host record write ─→ host-canonical
host-canonical
  ├─ flag on  ─→ host-canonical (new Conversations UI)
  └─ flag off ─→ host-compat    (compatibility UI, same host store)
host-compat
  └─ flag on  ─→ host-canonical
```

There is no transition from either host mode back to legacy. The cutover marker
is written only after the first record is durably committed; if marker/index
write then fails, startup detects host records and repairs the marker to
`host-canonical`. Legacy localStorage becomes read-only as soon as host authority
is established.

The `durableAgentConversations` flag is `experimental` and defaults to `true` in
`package.json`. It can roll back the new presentation/controller behavior, but
after cutover it cannot make the established store disappear. This is a safety
constraint, not a partial feature-flag implementation.

## Legacy migration classification

1. The host supplies the current normalized descriptor to the webview adapter.
2. For a single-root folder, the adapter may offer the exact legacy hash prefix
   produced from that root path; those records can map to current scope.
3. A multi-root or `.code-workspace` window cannot prove that its old first-root
   hash belonged only to this workspace. Those records are imported as
   unassigned.
4. The global prefix is always unassigned. Current code used it before project
   scoping and in no-folder windows, so ownership cannot be recovered safely.
5. `open-threads`, migration-done markers, and webview state are never migrated
   into durable conversation state.

Migration deduplicates first by `(source key, legacy ID, checksum)` for exact
idempotency. Canonical content fingerprinting then uses ordered user/assistant
display text and runtime provenance after Unicode NFC, CRLF→LF, and trailing
line-whitespace normalization. IDs, timestamps, activity progress, and titles
are excluded. Same fingerprint/different ID deduplicates; same ID/different
fingerprint preserves both and records a conflict.

## Retention and cleanup

- No automatic conversation count, age, or byte quota deletion.
- Legacy source stays untouched throughout v1.10.x.
- Quarantine bytes stay until an explicit diagnostics cleanup action in a later
  requirement; cleanup is not part of Sprint 109.
- The future legacy cleanup action must show migrated/remaining/corrupt counts,
  require confirmation, and never delete a source record not represented by a
  verified host record or quarantine entry.

## Moved-folder recovery

The current project may open a recovery dialog that lists stored scope display
labels (workspace filename or folder basename), normalized path for confirmation,
last activity, and record count. Transcript snippets are not loaded in that
picker. Choosing **Move conversations to this project…** displays source and
destination and requires confirmation. The operation re-scopes records
atomically one at a time with provenance; partial completion is restartable.

## Five-attachment lifecycle

- An attachment is created lazily only when Send needs a runtime session.
- `lastUsedAt` changes on runtime dispatch or user selection of an already-live
  conversation; deterministic ties break by conversation ID.
- Protected: current, Working, or Needs you.
- Releasable: non-current and idle, including completed/failed/interrupted work.
- At Send with no attachment and capacity full, release the least-recently-used
  releasable attachment, append no transcript event, and mark only the next Send
  boundary as a new working context.
- Release never deletes/updates transcript content and never creates an
  `open/closed` conversation state.
- Delete/Stop and delete removes the matching attachment only. Undo restores the
  record but not the stopped runtime.

## Phase 0 approval

Jarmo's 2026-08-22 approval freezes the record/scope protocol above plus the UI decisions already
shown in `design.md`: transitional live rail for Sprint 109, header
Conversations/New controls, `Needs you` priority, Earlier conversations recovery,
confirmed delete with Undo, and the restored-context wording.
