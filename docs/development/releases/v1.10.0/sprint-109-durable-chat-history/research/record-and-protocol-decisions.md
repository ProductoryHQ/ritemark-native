# Sprint 109 Record and Protocol Decisions

**Status:** Approved Phase 0 schema freeze (Jarmo, 2026-08-22)
**Date:** 2026-08-22
**Applies to:** `ConversationRecordV1`, project identity, host↔webview conversation protocol

## Canonical record

`ConversationRecordV1` is the only durable transcript. It is host-internal; the
webview receives a projection that omits continuation descriptors and migration
source details.

```ts
interface ConversationRecordV1 {
  schemaVersion: 1;
  conversationId: string;                 // host-generated UUID, stable forever
  scopeId: string;                        // ps1- + 20-byte SHA-256 prefix in hex
  scope: ProjectScopeDescriptorV1;
  title: string;
  createdAt: string;                      // UTC ISO-8601
  lastActivityAt: string;                 // UTC ISO-8601, list sort source
  revision: number;                       // monotonic per record
  bindingGeneration: number;              // increments after delete/Undo restore
  lifecycle: ConversationLifecycleV1;
  runtimeSummary: RuntimeId[];             // first-seen order, deduplicated
  events: ConversationEventV1[];           // stable sequence, no executable state
  continuation?: ContinuationDescriptorV1; // opaque, host-only, Sprint 110 slot
  migration?: MigrationProvenanceV1;
}
```

### Scope descriptor

```ts
interface ProjectScopeDescriptorV1 {
  kind: 'single-root' | 'multi-root' | 'workspace-file' | 'no-folder' | 'unassigned-legacy';
  workspaceFileUri: string | null;
  folderUris: string[];                    // normalized, unique, sorted
}
```

- URI scheme and authority are lowercase.
- File URI trailing separators are removed except at a filesystem root.
- On Windows, file URI paths are case-folded and separators normalized before
  sorting/hashing. This matches the default case-insensitive file provider and
  makes drive-letter/case variants stable.
- Folder enumeration order has no meaning.
- A `.code-workspace` URI participates in identity, so opening the same folders
  ad hoc is intentionally a different project scope.
- No `realpath`, inode, transcript content, project-name guess, or current file
  participates in identity.
- `no-folder` is one installation-wide scope. It is stable across restart and
  never appears in a folder project. Multiple no-folder windows therefore share
  the same conversation library and rely on record-file reconciliation rather
  than an authoritative central index.
- `unassigned-legacy` is not a current project scope. Its records are visible
  only in the explicit Earlier conversations recovery section.

`scopeId` is `ps1-` plus the first 20 bytes of SHA-256 over canonical JSON with
the fields ordered as `kind`, `workspaceFileUri`, `folderUris`, encoded as
lowercase hexadecimal. The descriptor remains stored alongside the hash for
diagnostics and collision detection.

### Lifecycle

```ts
type ConversationLifecycleV1 =
  | { state: 'idle' }
  | { state: 'working'; activeTurnId: string }
  | { state: 'needs-user'; activeTurnId: string; attentionKind: 'approval' | 'question' | 'plan-review' }
  | { state: 'interrupted'; turnId: string | null; reason: 'restart' | 'cancelled' | 'failed' | 'deleted-running' | 'runtime-released' };
```

On extension-host startup, persisted `working` and `needs-user` states are
converted to an appended `interrupted` boundary before they are shown. Old
approval/question/plan events remain historical but have no request capability.

### Transcript events

Every event has `eventId`, `turnId`, integer `sequence`, `occurredAt`, and
`runtimeId`. Sequence is allocated by the host and is strictly increasing in one
record.

| Event kind | Durable content | Explicitly excluded |
|---|---|---|
| `user-message` | User-visible text, autonomy/mode snapshot, attachment name/kind/media type/size | Attachment bytes/base64, transient selection capability |
| `assistant-message` | User-visible markdown/text and terminal status | Provider event object or SDK handle |
| `activity` | Display-safe title/status, workspace-relative file references, plan steps | Executable tool input, approval token, shell capability |
| `attention` | Historical prompt/summary and `pending/resolved/invalidated` state | Request ID as an actionable capability after restart |
| `boundary` | `failed/cancelled/interrupted/context-restored` kind plus honest display message | Fabricated assistant response |

`ContinuationDescriptorV1` may contain a runtime ID, opaque native reference,
capture time, and compatibility version. It never crosses into the webview and
is never used in Sprint 109 to claim provider memory was restored.

### Delete protection

Deletion writes a small `TombstoneV1` before removing the record and index entry.
The tombstone contains only ID, scope ID, deleted generation, and timestamp. It
rejects queued/pre-delete callbacks. Undo uses an in-memory snapshot and opaque
token, restores the same record identity, increments `bindingGeneration`, then
removes the tombstone. A running deletion first stops that exact runtime and
adds an Interrupted boundary to the Undo snapshot.

## Storage projections

```text
globalStorageUri/conversations/v1/
  index.json                         best-effort cache, never source of truth
  records/<conversationId>.json     canonical records
  tombstones/<conversationId>.json  late-event guard
  quarantine/<timestamp>-<name>     original corrupt bytes + reason sidecar
  migration.json                    provenance and monotonic cutover state
```

The records directory is reconciled with `index.json` on every initialization
and whenever directory membership differs. This is required for two extension
hosts writing different record IDs at the same time. The index may accelerate
metadata loading but may not hide a valid record absent from the cache.

## Protocol decision table

All messages use a discriminated union and a `requestId`. The host derives the
scope from VS Code state; a webview-supplied scope is never trusted. Runtime
validation rejects unknown fields at the mutation boundary where practical and
always validates ID, generation, event sequence, and payload size.

| Direction | Message | Decision |
|---|---|---|
| Webview → host | `conversation/initialize` | Return current scope label/ID, rollout mode, selected canonical ID if valid, list summary, migration diagnostics, and live attachment summaries. |
| Webview → host | `conversation/list` | List current scope plus separately labelled unassigned summaries; never accept an arbitrary scope ID from UI. |
| Webview → host | `conversation/get` | Validate that the ID belongs to current scope or an explicitly selected recovery bucket; return a webview-safe projection. Opening does not create a runtime. |
| Webview → host | `conversation/accept-turn` | `conversationId` is optional for a blank draft. Host assigns/validates identity, writes the user event first, acknowledges canonical ID, then dispatches the selected runtime. This is the only first-turn path. |
| Webview → host | `conversation/respond-attention` | Require current ID, binding generation, runtime request binding, and live attachment; stale/restored cards are rejected. |
| Webview → host | `conversation/delete` | Require current generation and confirmation intent. Host returns an opaque, session-lifetime Undo token. Running work requires `stopRunning: true`. |
| Webview → host | `conversation/undo-delete` | Accept only the opaque Undo token, restore same ID with incremented generation, and return the restored projection. |
| Webview → host | `conversation/move-unassigned` | Explicitly re-scope one selected unassigned record to current project; preserve migration provenance. |
| Webview → host | `conversation/relink-scope` | Explicitly select a prior stored scope descriptor and move its records to the current scope after a count/label confirmation; never infer a folder rename. |
| Webview → host | `conversation/diagnostics` | Return counts, bytes, corrupt/quarantine counts, rollout mode, and safe paths; never transcript text. |
| Webview → host | `legacy/discover` | Report legacy key inventory only after host requests it. Open-thread IDs are ignored. |
| Webview → host | `legacy/import-batch` | Send bounded, validated records from the host-approved current scoped prefix or global prefix. Global/ambiguous input is forced to unassigned. |
| Host → webview | `conversation/result` | Correlated success/error; storage errors are user-actionable and never silently converted to success. |
| Host → webview | `conversation/changed` | Canonical record projection changed; revision/generation allow stale UI events to be ignored. |
| Host → webview | `conversation/live-state` | Derived runtime attachment state only; never persisted as History/open/closed state. |
| Host → webview | `conversation/store-status` | Loading, migration, degraded/corrupt, storage-full, permission, and retry state. |

Host-internal runtime callbacks call `ConversationController.checkpoint`; there
is deliberately no generic webview `checkpoint` mutation that could overwrite a
record with stale presentation state.

## Rejected schema/protocol options

- Reusing a runtime-native thread/session ID as `conversationId`: runtimes do not
  provide one portable lifecycle.
- Persisting the existing `ConversationState` object: it contains presentation,
  capabilities, attachment payloads, and provider-specific transient state.
- Letting the webview create and later reconcile IDs: this recreates the current
  fresh-ID ghost failure.
- Treating `index.json` as authoritative: concurrent windows or an index write
  failure could hide valid records.
