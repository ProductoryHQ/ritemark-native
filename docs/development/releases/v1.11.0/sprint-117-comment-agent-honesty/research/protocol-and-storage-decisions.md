# Sprint 117 Phase 0 — Protocol and Storage Decisions

**Status:** Approved 2026-09-14. Jarmo decided D5 himself (the destination is the open sidebar conversation, no confirmation) and delegated the rest: "ülejäänud sprindi otsustes usaldan sind". Implementation may start at Phase 1. A later change to user-visible behaviour goes back to him.<br>
**Inputs:** [current-state-audit.md](./current-state-audit.md) (F01–F23), [spec.md](../spec.md) R1–R10, code on `main` at `d0328249`.<br>
**Fixtures:** [fixtures/](./fixtures/) — synthetic documents, records, and protocol samples referenced below.

Every decision below names the evidence it rests on (file and line on `main`) and separates what is observed from what is proposed. The "Needs" column records how each decision was settled: **Jarmo** where he decided or would have had to, **engineering** where the call was ours. All of them are approved as written.

## 0. Decisions at a glance

| # | Decision | Recommendation | Needs |
|---|---|---|---|
| D1 | Task ownership and storage | Host-owned `CommentTaskController` + `CommentTaskStore` under `<globalStorage>/comment-tasks/v1/`, built on the `ConversationStore` file pattern | Jarmo |
| D2 | `CommentTaskRecordV1` | Shape, bounds, and transition table in §3 | Jarmo |
| D3 | Stable IDs for every comment kind | Standalone carrier `<!-- {id:<uuid>} body -->`; legacy IDs minted in one undoable transaction at dispatch; duplicate IDs re-minted | Jarmo |
| D4 | Source binding, rename, deletion, retention | Canonical `file:` URI + project `scopeId`; in-app renames follow; no relink flow; 30-day terminal retention, 500-record cap | Jarmo |
| D5 | Destination | The conversation open in the AI sidebar, a fresh empty one included; no confirmation, no picker; the Send surface names it | decided by Jarmo 2026-09-14 |
| D6 | Acceptance protocol and atomicity | Persist `accepting` → sidebar enqueue ack → `queued` → editor result; bounded waits; per-group bulk results | engineering |
| D7 | Lifecycle derivation | Derived from the host conversation record by exact `(conversationId, conversationTurnId)`; cancel normalised above adapters | engineering |
| D8 | Capture and prompt | One collector (`commentIndex.ts`), one host prompt builder, `stripAssignmentMention` everywhere, runtime context from the record, never from the active tab | engineering |
| D9 | Completion reply | Host-local projection; plain-text summary ≤ 280 chars; Markdown untouched | Jarmo |
| D10 | R10 ergonomics | Native vertical resize with CSS bounds; `@` listbox from `COMMENT_AGENT_ALIASES`; gutter marker never over text; narrow-width numbers measured on RunDev before Phase 5 | Jarmo |
| D11 | Flag and rollout mode | `comment-callouts` stays the only flag; comment tasks require the durable conversation store (`rolloutMode !== 'legacy'`) | engineering |
| D12 | Shared availability policy | Move `deriveRuntimeAvailabilities` to `src/runtime/availability.ts`; host and webview import the same function | engineering |

## 1. Finding traceability

| Finding | Requirement | Scenario | Workstream | Disposition |
|---|---|---|---|---|
| F01 rail and menu build dispatches independently | R2 | Bulk and single produce the same normalized prompt | W2, W3 | Required — one typed `comment-task/accept`, prompt built on the host (D8) |
| F02 rail reads DOM `data-agent`, bulk parses the body | R2 | same | W2 | Required — `detectAgentAlias(note)` is the only assignment source |
| F03 rail strips every mention, bulk only the assigned one | R2 | Meaningful second agent mention survives | W2 | Required — `stripAssignmentMention` on both surfaces |
| F04 marker guard only in the bulk prompt | R2 | same as F01 | W2 | Required — the host builder always emits the guard |
| F05 prose prompt vs structured entries | R2 | same as F01 | W2 | Required — structured builder for one or many comments |
| F06 bulk hardcodes `the active document` | R2, R3 | Tab switch cannot retarget queued work | W2, W3 | Required — host stamps `source.displayPath` |
| F07 `commentIds`/metadata optional and unvalidated | R1 | Empty or oversized payload is rejected; hostile paths | W3 | Required — exact-field protocol (D6) |
| F08 standalone nodes persist no ID | R3 | Standalone note receives a stable ID before dispatch | W2 | Required — `{id:…}` carrier (D3) |
| F09 legacy id-less marks stay positional | R3 | same | W2 | Required — upgrade transaction at dispatch (D3) |
| F10 relative display path used as identity | R3 | Two documents reuse the same legacy comment text | W1, W3 | Required — canonical URI + `scopeId` (D4) |
| F11 `documentPath` missing from `agent-execute` | R3 | Tab switch cannot retarget queued work | W4 | Required — `agent-execute.taskId`; host reads the record (D8) |
| F12 active-tab fallback at drain time | R3 | same | W4 | Required — comment turns never call `_getActiveFileContext()` |
| F13 status broadcast to every editor | R6 | Parallel documents and runtimes stay isolated | W5, W6 | Required — per-document projection (D6) |
| F14 module-global map keyed by comment ID | R6 | same; Reload preserves status | W5, W6 | Required — replaced by the projection |
| F15 webview map never initialised from durable state | R6 | Reload preserves status | W1, W5 | Required — projection on editor ready |
| F16 sidebar store owns the ledger | R1, R6 | same | W1 | Required — host ledger (D1) |
| F17 `enqueuePrompt` returned `full` is ignored | R5 | Queue is full | W3 | Required — enqueue ack precedes `queued` (D6) |
| F18 bulk and rail show success before any acknowledgment | R5 | Bulk has mixed acceptance results | W3, W6 | Required — per-request results; the rail's `sentKey` flash goes too |
| F19 no availability gate before enqueue | R5 | Runtime is signed out; Runtime status is refreshing | W3 | Required — host gate using the shared policy (D12) |
| F20 destination chosen silently in the sidebar | R4 | Destination is the open conversation | W3, W6 | Required — the host binds the sidebar's open conversation at acceptance and the Send surface names it (D5) |
| F21 approval/question only in the destination conversation | R6 | Approval or question needs the user | W4, W5 | Required — `needs-user` projection with Open conversation |
| F22 terminal handlers finalise every running task in a conversation | R6, R8 | Two tasks share one conversation | W4 | Required — derivation by exact turn (D7) |
| F23 no reply on the source comment (#156) | R7 | Successful result replies to the source comment | W5 | Required (D9) |
| F24 *(new)* host records a cancelled Claude turn as `completed` when no error is reported, and a cancelled Codex/OpenCode turn as `failed` | R8 | Cancel is not completion | W4 | Required — cancel-intent normalisation (D7) |
| F25 *(new)* `submitCommentPrompt` dispatches on a 400 ms timer when the sidebar view is not resolved; the message is lost if the view is slower | R5 | A persisted accepted task either dispatches or restores | W3 | Required — sidebar ready handshake with a bounded wait (D6) |

Evidence for F24: `src/views/UnifiedViewProvider.ts:822-834` (`status: error ? 'failed' : 'completed'`) and `:876-889` (`runtimeCompleted` folds `cancelled` into `failed`). Evidence for F25: `src/views/UnifiedViewProvider.ts:1240-1256`.

Every finding is **required**; nothing is deferred. This is the full scope Jarmo approved.

## 2. D1 — Ownership and storage

**Observed.** The only durable host store with the needed properties is `ConversationStore` (`src/conversations/ConversationStore.ts`): injected filesystem, serialized mutation tail, `tmp-<id>` + rename atomic writes (`:710-712`), quarantine on unreadable records, index reconciliation, versioned directory `<globalStorage>/conversations/v1/` (`:171-173`).

**Decision.** Add `src/commentTasks/CommentTaskStore.ts` with the same shape and the same injected `ConversationStoreFileSystem`, under `<globalStorage>/comment-tasks/v1/` with `records/`, `quarantine/`, and `index.json`. No new persistence pattern. The store never holds transcript content, tool payloads, approval capabilities, or attachments.

`src/commentTasks/CommentTaskController.ts` owns identity and lifecycle. It is composed in `extension.ts` next to `ConversationController` and receives: the store, the `ConversationController` (for destination resolution, turn identity, and change events), a runtime-availability probe, and two message ports (editor webviews via `RitemarkEditorProvider`, the sidebar via `UnifiedViewProvider`). View providers only forward validated messages; they hold no task logic.

## 3. D2 — `CommentTaskRecordV1`

```ts
interface CommentTaskRecordV1 {
  schemaVersion: 1;
  taskId: string;                 // UUID, host-minted at acceptance
  bindingGeneration: number;      // 1 on acceptance, +1 per retry
  requestId: string;              // webview-minted UUID; idempotency key
  createdAt: string; updatedAt: string;               // ISO 8601
  source: {
    documentUri: string;          // vscode.Uri.toString(); scheme must be file:
    scopeId: string;              // projectScopeId() of the document's workspace folders — same rule as conversations
    displayPath: string;          // workspace.asRelativePath(uri, false); label only, never identity
    documentVersion: number;      // TextDocument.version at acceptance
    contentSha256: string;        // document text at acceptance
  };
  comments: Array<{               // 1..50, document order, unique commentId
    commentId: string; kind: 'mark' | 'node';
    note: string;                 // verbatim body, ≤ 4 096 chars
    instruction: string;          // stripAssignmentMention(note), ≤ 4 096 chars
    anchoredText?: string;        // marks only, ≤ 8 192 chars
  }>;
  assignment: { alias: 'claude' | 'codex' | 'opencode'; runtimeId: AgentId; surface: 'rail' | 'menu' };
  runtime: { modelId: string | null; approvalMode: 'auto' | 'ask'; planFirst: false; thinkingEffort: ThinkingEffort };
  destination: { conversationId: string; bindingGeneration: number; titleSnapshot: string; created: boolean };
  turn: { conversationTurnId: string };                // host-minted; the sidebar MUST use it as the turn id
  prompt: { text: string; sha256: string };            // ≤ 65 536 chars; needed for retry and audit
  lifecycle:
    | { state: 'accepting';   since: string }
    | { state: 'queued';      since: string }
    | { state: 'running';     since: string }
    | { state: 'needs-user';  since: string; attentionKind: 'approval' | 'question' | 'plan-review' }
    | { state: 'completed';   since: string; terminalEventId: string; summary: string }   // summary ≤ 280 chars
    | { state: 'failed';      since: string; safeMessage: string; failureKind?: RuntimeFailureKind }
    | { state: 'cancelled';   since: string }
    | { state: 'interrupted'; since: string; reason: 'restart' | 'sidebar-unreachable' | 'conversation-deleted' | 'runtime-exited' };
  history: Array<{ state: string; at: string; generation: number; note?: string }>;    // ≤ 32 entries
}
```

**Transition table** (per binding generation; anything else is rejected and logged):

| From | To |
|---|---|
| accepting | queued, interrupted(sidebar-unreachable), failed |
| queued | running, cancelled, failed, interrupted |
| running | needs-user, completed, failed, cancelled, interrupted |
| needs-user | running, completed, failed, cancelled, interrupted |
| completed / failed / cancelled / interrupted | accepting — only through `retry`, which bumps `bindingGeneration`, mints a new `conversationTurnId`, and appends the previous outcome to `history` |

Rejected requests never create a record. Sample records: [fixtures/records/](./fixtures/records/).

## 4. D3 — Stable IDs

**Observed.** Anchored marks already carry `data-comment-id` UUIDs (`webview/src/extensions/comment/CommentMark.ts:24-31`, minted by `newCommentId()`; Markdown carrier `commentTurndownRules.ts:41-45`). Standalone `CommentNode` has only `note` and `agentAlias` (`CommentNode.ts:22-25`); its Markdown carrier is the bare body `<!-- body -->` (`commentTurndownRules.ts:22-27`, `commentMarkedExtension.ts:30-52`).

**Decision.**
- `CommentNode` gains an `id` attribute (`data-comment-id`), minted with the same `newCommentId()` on every creation path (`insertCommentNode`, the `///` Enter lift, `Mod-/`).
- Markdown carrier for standalone notes: `<!-- {id:<id>} body -->`. The `marked` tokenizer strips a leading `{id:…}` token (regex `^\{id:([0-9a-fA-F-]{36}|c-[a-z0-9]+-[a-z0-9]+)\}\s*`) into `data-comment-id`; Turndown re-emits it. Documents without the token load unchanged (`id: null`). Fixture: [fixtures/standalone-with-id.md](./fixtures/standalone-with-id.md).
- **Legacy upgrade** happens only at dispatch, never on open: when the user confirms Send, the webview runs `assignMissingCommentIds(editor, targets)` — one TipTap transaction (`addToHistory: true`, one undo step) that sets ids on exactly the comments being dispatched. The accept request is sent after that transaction.
- **Duplicates.** Same `id` + same `note` on adjacent or separate ranges = one multi-block comment (today's #150 behaviour). Same `id` + different `note` (copy-paste) = duplicate; the upgrade transaction re-mints the later occurrence in document order. The collector reports duplicates so the host can reject any request that still carries one (`duplicate-comment-id`). Fixture: [fixtures/duplicate-ids.md](./fixtures/duplicate-ids.md).
- **Host verification.** `comment-task/accept` carries `documentVersion`; the host checks `document.getText()` contains `data-comment-id="<id>"` or `{id:<id>}` for every requested id. Because the custom editor syncs webview edits to the `TextDocument` asynchronously, the host retries the check for up to 1 s before answering `document-not-synced`.

**Jarmo:** the `{id:…}` token makes standalone notes noisier in raw Markdown (36 characters). Anchored comments already carry the same UUID in `data-comment-id`, so this is consistency, not new noise. Alternative rejected: mint ids only when assigned — leaves unassigned notes positional and breaks R3.

## 5. D4 — Source binding, rename, deletion, retention

**Observed.** The editor stamps `workspace.asRelativePath(document.uri, false)` (`src/ritemarkEditor.ts:743`); the same relative path can exist in two windows or two folders. Conversations already scope by project through `resolveProjectScope()` (`src/conversations/projectScope.ts:47-67`).

**Decision.**
- Identity is `document.uri.toString()` plus `scopeId = projectScopeId(descriptor)` where the descriptor is resolved from the document's workspace folder set, exactly as the conversation store does. The destination conversation must belong to the same `scopeId`; otherwise `destination-not-found`.
- Only `file:` documents can be dispatched. `untitled:` and other schemes are rejected with `save-document` recovery ("Save the document first"). Rationale: no stable identity and the runtime cannot read the content.
- **Rename/move inside Ritemark:** the controller listens to `workspace.onDidRenameFiles` and rewrites `source.documentUri` for matching records (old → new). Nothing else follows.
- **Save As:** the new file has no tasks; the original keeps its records. **External move or delete:** records stay bound to the old URI; they are never projected again and expire by retention. No relink flow, no guessing across projects.
- **Retention:** terminal records are removed 30 days after `lifecycle.since`; at most 500 records per store (oldest terminal first). Non-terminal records found at activation move to `interrupted(restart)` unless the destination conversation still shows that exact turn active. Cleanup runs at activation and every 24 h.
- **Source comment deleted while a task runs:** the record keeps the comment snapshot; the projection simply has no target; nothing is reinserted.

## 6. D5 — Destination

**Observed.** The sidebar picks a destination with no user visibility (`webview/src/components/ai-sidebar/store.ts:802-818`): first ready conversation of the runtime, else the newest, else a new background one. The margin rail flashes "Sent" immediately (`MarginCommentRail.tsx:397-399`); the menu shows "Queued N tasks" right after posting (`CommentsMenuButton.tsx:90-93`).

**Decided by Jarmo, 2026-09-14.** The task goes to the conversation that is open in the AI sidebar at the moment of sending. A fresh empty conversation counts and simply starts with the task. No confirmation dialog, no picker, no "prefer a ready conversation" logic.

- The sidebar reports its active conversation to the host (`conversation/active { conversationId }`) whenever it changes, so the host can bind without a round trip. The host binds that canonical id at acceptance; later switching the visible conversation does not retarget the task (R3, R4).
- If the open conversation is currently running a turn, the task enters that conversation's queue behind it (Sprint 104 semantics, unchanged).
- If the open conversation belongs to another runtime, the task still goes there and runs as the assigned runtime, with the usual runtime-switch boundary in the transcript. Bulk send with two agent groups therefore produces two tasks in the same open conversation. *(Assumption stated to Jarmo; revisit only if he objects.)*
- If the sidebar has never been opened this session, the host focuses it and uses the conversation it restores as active; if that resolves to nothing within 5 s the request fails with `sidebar-unreachable` (D6).
- Visibility without a step: the rail shows a one-line caption with the conversation title above the Send button, and the menu's existing confirming step names it in its summary line. After acceptance the bubble shows `Queued for <Runtime>` and `In "<title>"` with Open conversation, from the projection.

## 7. D6 — Acceptance protocol and atomicity

Messages are exact-field validated at the host boundary in `src/commentTasks/protocol.ts`, in the style of `src/conversations/protocol.ts`. Samples: [fixtures/protocol/](./fixtures/protocol/).

**Editor webview → host**

- `comment-task/accept` `{ requestId, batchId?, surface, alias, documentVersion, comments: [{ commentId, kind, note, instruction, anchoredText? }] }` → `comment-task/result` `{ requestId, ok: true, taskId, state: 'queued', destination: { conversationId, title, created } }` or `{ requestId, ok: false, error: { code, message, retryable, recovery? } }`. The request carries no destination: the host uses the sidebar's open conversation (D5).
- `comment-task/destination-preview` `{ requestId }` → `{ requestId, conversationId | null, title | null }` — read-only, used only to render the caption on the Send surface.
- `comment-task/open-conversation` `{ taskId }`, `comment-task/retry` `{ taskId }`, `comment-task/cancel` `{ taskId }` → `comment-task/result`.

Error codes: `invalid-request`, `feature-disabled`, `durable-conversations-disabled`, `document-not-file`, `document-not-synced`, `comment-not-found`, `duplicate-comment-id`, `unsupported-alias`, `empty-instruction`, `payload-too-large`, `runtime-unavailable` (with the normalised state and a `recovery` of `sign-in` | `configure` | `install` | `retry`), `destination-not-found`, `queue-full`, `sidebar-unreachable`, `store-degraded`, `unknown-task`, `stale-generation`.

**Host → editor webview**

- `comment-task/projection` `{ documentUri, tasks: [{ taskId, commentIds, runtimeId, state, attentionKind?, summary?, safeMessage?, destination: { conversationId, title }, since }] }` — a full snapshot for one document, sent on editor `ready` and after every change to a task bound to that document. The host keeps a `Map<documentUri, Set<Webview>>` in `RitemarkEditorProvider` (registered in `resolveCustomTextEditor`, `src/ritemarkEditor.ts:512-560`) so nothing is broadcast to unrelated editors.

**Host ↔ AI sidebar**

- Sidebar posts `sidebar/ready` once its store is hydrated, and `conversation/active { conversationId }` on every selection change. The host queues `comment-task/enqueue` until ready, at most 5 s.
- `comment-task/enqueue` `{ taskId, conversationId, conversationTurnId, runtimeId, prompt, displayText, modelId, autonomy, thinkingEffort, sourceDisplayPath }` → `comment-task/enqueue-result` `{ taskId, outcome: 'queued' | 'full' | 'no-conversation' }`. The sidebar's `QueueItem` gains `taskId`, `conversationTurnId`, and `sourceDisplayPath`; `dispatchQueueItem` uses the host-minted turn id instead of `nextId()` and sends `taskId` in `agent-execute`.
- A user removing the queued item sends `comment-task/dequeued` `{ taskId }` → the host records `cancelled`.

**Acceptance sequence** (one serialized mutation per request): validate → resolve document, scope, ids (bounded 1 s sync wait) → availability (D12) → destination = the sidebar's open conversation (D5) → persist `accepting` → sidebar enqueue → on `queued` persist `queued` and answer the editor; on `full` delete the `accepting` record and answer `queue-full`; on timeout persist `interrupted(sidebar-unreachable)` and answer `sidebar-unreachable` (Retry offered). A restart with `accepting` records yields `interrupted(restart)`.

**Idempotency.** `requestId` is unique per (surface, group). A repeated `requestId` returns the original result; a second click while a request is in flight is disabled in the UI and ignored by the host. Bulk sends one `accept` per agent group under one `batchId`; the menu renders each result as it arrives and never a blanket success.

## 8. D7 — Lifecycle derivation and runtime parity

**Observed.** The host conversation record already carries the facts: `lifecycle.working/needs-user` with `activeTurnId` (`src/conversations/types.ts:41-53`), attention checkpoints (`UnifiedViewProvider.ts:802,854,919,930`), and terminal `assistant-message`/`boundary` events keyed by `turnId` (`ConversationController.ts:453-546`). The webview's `finalizeCommentTasks` marks every running task of a conversation (`store.ts:674-680`) — F22.

**Decision.** `CommentTaskController` subscribes to `ConversationController` change events and derives task state from the record for its exact `(conversationId, conversationTurnId)`:

| Record fact | Task state |
|---|---|
| sidebar `enqueue-result: queued` | queued |
| `lifecycle.working` with `activeTurnId === conversationTurnId` | running |
| `lifecycle.needs-user` with that turn | needs-user(attentionKind) |
| `assistant-message` for that turn with `terminalStatus: 'completed'` | completed(summary from `content`) |
| `boundary` for that turn with `boundaryKind: 'failed'` | failed(safeMessage) |
| `boundary` for that turn with `boundaryKind: 'cancelled'` | cancelled |
| `lifecycle.interrupted` with that turn (restart, deleted-running, runtime exit) | interrupted(reason) |
| conversation tombstoned before the turn ran | interrupted(conversation-deleted) |

Events for other turns, other generations, or unknown tasks are ignored and logged. No runtime adapter is touched; the mapping sits above all three.

**Cancel normalisation (F24).** `UnifiedViewProvider` records cancel intent per `(conversationId, conversationTurnId)` when `agent-cancel` arrives (`:1012-1016`). A terminal callback for that turn with cancel intent, or a Codex/OpenCode `status` of `cancelled`, calls `completeRuntimeTurn({ status: 'cancelled' })`; `interrupted` maps to `failed` with `failureKind: 'runtime-interrupted'` at the conversation level and to `interrupted(runtime-exited)` at the task level. This fixes the conversation record for composer turns as well; it is the one change outside the comment-task subsystem and must be covered by the three-runtime matrix.

## 9. D8 — Capture and prompt

- `collectDocumentComments` (`commentIndex.ts:57-123`) stays the only collector. The rail's DOM scan keeps positioning but takes assignment and instruction from the collector's result for the same `commentId`, not from `data-agent`.
- Instruction = `stripAssignmentMention(note, alias)`; `stripAgentMentions` is no longer used for dispatch.
- The webview sends structured comment snapshots; the **host** builds the prompt in `src/commentTasks/commentTaskPrompt.ts` with the semantics of today's `buildAgentTaskPrompt` (`commentIndex.ts:150-168`): real `displayPath`, ordered entries, comment ids, anchored text, standalone note marker, and the marker-preservation guard. One builder for one or many comments; the rail's prose prompt is retired.
- Runtime context: `agent-execute` carrying `taskId` makes the host use `{ path: record.source.displayPath }` as the active file for that turn and skip `_getActiveFileContext()` (`UnifiedViewProvider.ts:558`). Composer turns are unchanged.
- Bounds are enforced in the collector and again at the host (§3).

## 10. D9 — Completion reply

- Source: the `assistant-message` event of the exact terminal turn. Text is flattened to plain prose (fenced code, heading and list markers, link syntax removed) and cut at the first sentence boundary at or before 280 characters, with an ellipsis if cut. Empty text → `The task finished. Open the conversation for details.`
- Failure copy comes from `presentRuntimeError` (already normalised on the host); raw provider diagnostics never reach the comment.
- The projection lives in the record and the bubble only. The user's note, the anchored text, the Markdown carriers, and exports are untouched; the export chokepoint needs no change.
- Retry keeps the previous outcome in `history`; only the current generation projects, so no duplicate reply appears.

**Jarmo:** alternative rejected — writing the reply into the Markdown comment body would travel with the file but silently rewrites the user's note and breaks the round-trip contract.

## 11. D10 — R10 ergonomics

- **Composer.** The compose textarea (`MarginCommentRail.tsx:242-245`, fixed `rows={2}`) becomes a `ResizableComposer` primitive: native `resize: vertical`, `min-height` = 2 rows, `max-height` = `min(8 rows, 40vh)`, footer (Cancel, Comment/Save, Send) outside the scrolling area. No custom drag code; native resize is keyboard-neutral and accessible. Height is component state for the session. Sprint 122 reuses the primitive for the agent composer.
- **Agent picker.** A listbox that opens when `@` is typed at a word boundary, filters on every keystroke, closes when nothing matches; ArrowUp/Down, Enter or Tab insert `@alias ` at the caret, Escape closes without inserting, pointer click inserts and keeps focus. Options come from `COMMENT_AGENT_ALIASES` with labels from a new `ALIAS_LABEL` map in `commentModel.ts` (moved from `CommentsMenuButton.tsx:23-27`). No availability hint in the picker: the editor webview does not receive runtime status today, and availability is enforced at acceptance with a specific recovery. `role="listbox"`, `aria-activedescendant`, selected agent shown as a footer pill.
- **Collapsed marker.** The rail already positions markers in a gutter with collision spacing (`MarginCommentRail.tsx:180-187`). Overlap at narrow widths comes from the marker's text preview and the bubble width. Rule: hide `rm-marker-txt` below a container-width threshold, bound the bubble to the gutter width, never a negative offset into the text column, and stack status/reply/actions below the note. The threshold values are measured on RunDev at the minimum supported editor width before Phase 5 (§13).

## 12. D11 — Flag and rollout mode

- `comment-callouts` (`src/features/flags.ts:100-106`) remains the only flag. Off: the editor registers no comment extensions (existing), the host controller answers `feature-disabled`, and no projection is sent.
- Comment tasks require the durable conversation store: `currentRolloutMode() === 'legacy'` answers `durable-conversations-disabled`. Without host-canonical turns there is no turn identity to bind to.

## 13. Evidence still required before the affected phase

- RunDev measurement of the narrowest supported editor width and the gutter width to fix the preview threshold and bubble bounds (D10) — before Phase 5.
- The sidebar message that selects a conversation by id (for Open conversation) — locate in W6; expected to exist for History.
- Confirm every anchored-mark creation path mints `newCommentId()` (bubble menu "Comment" action, toolbar) — W2.
- Trace what `session.cancel()` delivers to `onComplete` for Claude (error or clean result) with `debugTrace` — W4, before relying on cancel intent alone.

## 14. Approval record (2026-09-14)

- [x] D5 the conversation open in the AI sidebar, no confirmation, no picker — **decided by Jarmo**, overriding the drafted confirmation-and-picker proposal.
- [x] D1 host-owned store under `comment-tasks/v1`, `ConversationStore` pattern — delegated.
- [x] D2 record shape, bounds, and transition table — delegated.
- [x] D3 `{id:…}` carrier for standalone notes; ids minted at dispatch for legacy comments; duplicates re-minted — delegated. This is the one decision that changes what a user sees in raw Markdown; it was put to Jarmo in plain language and he did not object.
- [x] D4 canonical URI + scope; in-app renames follow; no relink flow; 30-day / 500-record retention; `untitled:` rejected — delegated.
- [x] D9 host-local plain-text summary ≤ 280 chars; Markdown untouched — delegated.
- [x] D10 native vertical resize with the stated bounds; `@` listbox without availability hints; gutter-marker rule with thresholds measured before Phase 5 — delegated.
- [x] D6, D7, D8, D11, D12 — engineering, unchanged.
- [x] design.md states as amended 2026-09-14.

Jarmo: "ülejäänud sprindi otsustes usaldan sind." Anything that later changes user-visible behaviour beyond what is written here goes back to him before it ships.

---

## 15. As built (2026-09-14)

The decisions above stand as written. This section records only where the implementation departed from them, or left one unfinished — nothing here rewrites a decision. Nothing in it changes user-visible behaviour beyond what D1–D12 describe, except where it says so explicitly.

### D1 — Ownership and storage

- `extension.ts` exports **both** `commentTaskController` and `commentTaskStore`. The rename listener in `ritemarkEditor.ts` needs `store.renameSource`, and the controller has no rename entry point.
- The projection port is composed in `extension.ts` and calls `RitemarkEditorProvider.publishCommentTaskProjection` directly rather than going through a `UnifiedViewProvider` method. Same effect, one fewer cross-module require.
- The controller is constructed with `randomId: () => randomUUID()`. Its default `randomId` is a sha256 hex string, which the record codec rejects — without the override every acceptance would fail at `store.create`.

### D2 — `CommentTaskRecordV1`

- `applyTurnTerminal` is called without a `terminalEventId`: `completeRuntimeTurn` mints the terminal event id internally and does not return it synchronously, so the controller's documented fallback (`terminalEventId = conversationTurnId`) applies.
- `runtime.approvalMode` is frozen as `auto` for every comment task. The per-conversation Manual/Auto choice is webview state (`conversationState.ts` `pendingRuntime.mode`) that the host cannot read and nothing persists host-side. `auto` matches the product default, but a user whose composer is set to Manual still gets an auto comment task. **This is a user-visible gap and goes back to Jarmo** — honouring the composer needs the sidebar to report autonomy, which is a contract change.
- `runtime.thinkingEffort` comes from the destination conversation record's `composerPreferences.thinkingEffortByRuntime` when the composer-thinking-effort flag is on, else `auto`. The record is read during destination resolution and cached for the one synchronous `runtimeSettings` call that follows, because that dependency cannot await.
- `runtime.modelId`: Claude → the reconciled Claude model; Codex → the catalog default; OpenCode → `null`, which the sidebar turns into `undefined` so the conversation's own BYOK selection applies.

### D3 — Stable IDs

- **The host's bounded 1 s re-check is not implemented.** The frozen `CommentTaskController` performs a single containment check and falls back to `document-not-synced` when the document is dirty. The error is retryable, so the user is told the truth, but a fast Send right after an edit can be refused where D3 promised a short wait.
- `assignMissingCommentIds` repairs duplicate ids across the **whole** document, not only among the requested keys. The collector groups two comments sharing an id into one entry, so a duplicate can never itself be a requested key; a duplicate-only-if-requested rule would never fire. The repair stays inside the same single transaction / single undo step.
- A requested key that resolves to no comment in the document (deleted between collection and Send) is **omitted** from the returned map rather than given an invented id. Callers treat a missing entry as `comment-not-found` and do not dispatch that comment.
- An `m:<from>-<to>` marker key is matched by range **overlap**, not equality: the rail builds it from `getMarkRange` (the whole mark) while the collector builds it from the first fragment, and the two differ for a link- or format-split comment.
- `collectDocumentComments` keeps the marker key `n:<pos>` for a standalone note even once that note has an id; only the new `commentId` field is populated. Both Send surfaces match collector entries by `commentId`, never by key.
- The tokenizer consumes only spaces and tabs after the `{id:…}` token, so the token cannot swallow a newline. A body written as `<!-- {id:x}\nbody -->` still normalises to `<!-- {id:x} body -->` on save, as it did before this sprint.
- Untested edge: the Turndown rule emits `<!-- {id:<id>} -->` for a standalone note that has an id and an empty body. The rail deletes an empty placeholder note on blur, but that state was not proven unreachable from every path.
- The one-undo claim is asserted as **one dispatched transaction** in a harness built on the real ProseMirror schema; TipTap's history plugin is not in that harness, so one observed Cmd+Z restoring a byte-identical file still needs the RunDev pass.

### D5 — Destination

Implemented as decided. Two additions:

- The host treats the pre-existing sidebar message `conversation:selected` as an active-conversation report alongside the new `conversation/active`. A superset of the contract; it makes destination binding work regardless of which message the sidebar emits.
- The host reveals a bound conversation by posting `conversation/select { conversationId }` to the sidebar, which opens it through the same path History uses.

### D6 — Acceptance protocol and atomicity

- **No persistent ready-queue.** The handshake waits for the sidebar to report an open conversation and gives up after 10 s (`no-conversation`); D6 specified a 5 s queue of undelivered enqueues. A sidebar that hydrates later than that window fails the task as `destination-not-found` instead of delivering late.
- Destination resolution reveals the sidebar and waits up to 5 s for its first report, as specified.
- One message was added to the contract: editor → host `comment:recover { recovery, alias }`, deliberately **outside** the `comment-task/` prefix so the protocol decoder never sees it as an invalid request. The editor webview cannot reach the sidebar's sign-in commands, so `ritemarkEditor.ts` maps it to `ritemark.claudeLogin` / `ritemark.codexLogin` / `ritemark.aiSettings`. `RECOVERY_LABEL` only ever produces a button for `sign-in` / `configure` / `install`, so the mapping is total.
- The editor webview applies its own 15 s timeout per request and resolves with a synthetic retryable error coded `sidebar-unreachable`, whose message says plainly that Ritemark did not answer. The code is the nearest existing one; it is the webview giving up, not a host verdict.
- A per-group retry from the Comments menu sends `batchId: null` — it is a single re-send, not a bulk send. A fresh bulk send always mints a shared `batchId`, including when only one group is included.
- The sidebar acknowledges `comment-task/enqueue` before any dispatch, which is why enqueue and drain are split into `enqueueCaptured` plus an explicit `maybeDrainQueue`.
- The sidebar posts `conversation/active` only once its store is `ready`; the `sidebar/ready` handshake itself always restates the open conversation, forced past the dedupe. (`UnifiedViewProvider`'s `case 'sidebar/ready'` still reads a `conversationId` the store never sends on that message — harmless dead defensive code.)
- The sidebar's `ExtensionMessage` union now declares `comment-task/enqueue` and `conversation/select` in place of the deleted `comment:submit`, so the webview and `protocol.ts` agree at compile time rather than through two hand-copied literals.

### D7 — Lifecycle derivation and runtime parity

- Cancel normalisation is implemented (cancel intent recorded per conversation + turn on `agent-cancel`; a terminal callback for that turn, or a literal Codex/OpenCode `cancelled`, writes `cancelled`), but it has **no automated test**: the decision lives inside `UnifiedViewProvider`'s `agent-execute` closure with no pure-function seam. It needs either an extraction or the three-runtime manual matrix.
- §13's `debugTrace` of what Claude's `session.cancel()` delivers to `onComplete` was **not run**.
- The `interrupted(conversation-deleted)` reason exists in the record, the projection, and the comment copy, but **nothing detects a deleted conversation** and transitions its tasks. Retry, generation change, and callbacks for a turn no task owns are covered and tested.

### D8 — Capture and prompt

- `agent-execute` carries `taskId` **as well as** `sourceDisplayPath` for comment items, so the host can use the record's document instead of the active tab. Additive; absent on composer turns.
- The prompt builder stamps the real `displayPath` and always emits the marker-preservation guard, the stable ids, anchored text, and a standalone-note marker, reusing the previous wording verbatim otherwise.

### D10 — R10 ergonomics

- **The narrow-width numbers were never measured.** The breakpoints (1280 / 960 px), gutter widths (210 / 40 / 30 px, 2 px inset when compact) and bubble bound (`min(300px, container − 32px)`, offset 26 px below the marker) are derived arithmetically from the current `.ProseMirror` layout. §13's RunDev measurement is still owed.
- The marker now stays mounted while its bubble is open (previously they swapped). With the bubble offset below the marker at narrow widths, unmounting left a pointer gap that immediately closed the bubble.
- The picker shows no availability hint, per D10. `design.md`'s picker bullet mentions one; D10 is the governing text and the editor webview receives no runtime status.
- No React rendering harness exists in this repo, so the picker's keyboard flow, the composer's resize bounds, the listbox never covering the footer, and the 200 % zoom / high-contrast / screen-reader matrix are covered only by pure-logic tests plus the typecheck.
- `index.css` changes are scoped to comment-rail selectors; `cursor: pointer` is set within that scope rather than as the project-wide preflight override, which belongs outside this sprint.

### D12 — Shared availability policy

- The shared module is `src/runtime/availability.ts`, exporting `deriveRuntimeAvailabilities`, `listReadyAlternatives`, `RUNTIME_LABELS` and the availability types, plus two host-facing helpers (`recoveryForRuntimeAvailability`, `messageForRuntimeAvailability`). Input types are structural, so the sidebar keeps passing its own concrete status objects.
- The webview's `runtimeAvailability.ts` keeps its own concrete input interface and delegates, rather than re-exporting the host's structural one, so the object literals in its existing test do not trip excess-property checks. There is still one derivation.
- `availability.ts` iterates a fixed ACP provider key list (`google`, `openai`, `anthropic`, `openrouter`) instead of the webview's `Object.entries`. Behaviourally identical for those four; required for the shared optional-field input type.
- The host's `checkAvailability` reports runtime hydration phase `ready` for all three runtimes, because it reads the authoritative status synchronously at that moment. A probe that throws returns `{ usable: false, recovery: 'retry' }` rather than a usable runtime.

### Not exercised

`comment-task/cancel` is decoded and handled by the controller and listed in the contract, but **no webview surface sends it**: `design.md`'s State Vocabulary gives no state a Cancel primary action (`cancelled` is what the sidebar's own Stop produces, and its action is Retry). The branch is deliberately unreached — confirm with Jarmo whether the editor should expose a Cancel.

Nothing in this sprint was run end to end: verification across all four workstreams is compile plus unit tests. The live evidence listed in §13 remains owed.
