# Sprint 117 Research — Current Comment-to-Agent Audit

**Date:** 2026-09-13<br>
**Decision:** Do not patch individual symptoms in the existing relay. Freeze one task identity/owner/protocol first; the 23 findings cross editor webview, host relay, AI sidebar queue, conversation lifecycle, and all runtimes.

## What Was Inspected

- `webview/src/components/MarginCommentRail.tsx`
- `webview/src/components/header/CommentsMenuButton.tsx`
- `webview/src/extensions/comment/commentModel.ts`, `commentIndex.ts`, `commentTaskStatus.ts`
- `src/ritemarkEditor.ts`
- `src/views/UnifiedViewProvider.ts`
- `webview/src/components/ai-sidebar/store.ts`, `promptQueue.ts`, and message types
- Conversation scoping, provider availability, runtime terminal events, and comment round-trip/export contracts

## Findings

| ID | Finding | Consequence |
|---|---|---|
| F01 | Margin rail and Comments menu build dispatches independently. | Equivalent actions can create different task inputs. |
| F02 | Rail assignment reads rendered DOM `data-agent`; bulk re-parses the comment body. | Cached/rendered attributes can disagree with body truth. |
| F03 | Rail strips every recognized agent mention; bulk removes only the assigned mention. | Meaningful secondary mentions are lost only on one path. |
| F04 | Bulk prompt includes the “do not remove markers” guard; rail prompt does not. | Single tasks can delete their own source markers. |
| F05 | Rail prompt is prose around one anchored range; bulk uses ordered structured entries. | Runtime context differs by entry point. |
| F06 | Bulk prompt hardcodes `the active document`. | The agent receives a placeholder instead of source identity. |
| F07 | The editor→host message treats `commentIds` and metadata as optional/unvalidated. | Invalid/empty identity can be acknowledged silently. |
| F08 | Standalone `CommentNode` uses positional key and persists no stable ID. | Valid standalone tasks commonly dispatch with `commentIds: []`. |
| F09 | Legacy id-less anchored marks remain positional for dispatch/status. | Their task status cannot survive edit/reload reliably. |
| F10 | Editor stamps a relative display path, not a canonical URI/project identity. | Same relative path can collide across windows/projects. |
| F11 | `documentPath` is stored on the webview queue item/visible turn but omitted from `agent-execute`. | Host runtime context does not receive the frozen source path. |
| F12 | Host runtime context can therefore fall back to whichever editor/selection is active at drain time. | Switching tabs can tell the agent it is editing the wrong file. |
| F13 | `broadcastCommentTaskStatus` sends every event to every active editor webview. | Correctness depends on consumers filtering perfectly. |
| F14 | `commentTaskStatus.ts` ignores `documentPath` and keys a module-global map only by comment ID. | Status can cross documents/windows or survive the wrong view lifecycle. |
| F15 | The module-global webview map is not initialized from durable host state. | Reload/reopen loses queued/running/completed truth. |
| F16 | The sidebar webview store owns `commentTasks`; host only relays messages. | Closing/reloading the sidebar can lose the task ledger. |
| F17 | `enqueuePrompt` returns `full`, but the `comment:submit` handler ignores the result. | Queue-full may still look successful to the editor. |
| F18 | The bulk UI sets its dispatched success state immediately after posting messages. | “Queued N tasks” is not an acceptance acknowledgment. |
| F19 | Comment dispatch does not reuse the normalized runtime availability gate before enqueue. | Signed-out/broken runtime failure arrives late and inconsistently. |
| F20 | Destination selection happens silently in the sidebar (`ready` candidate else newest else new). | The source comment does not know or show where work landed. |
| F21 | Approval/question/plan-review UI exists only in the destination conversation. | Background comment tasks can need input invisibly. |
| F22 | Terminal handlers finalize every running comment task in a conversation. | One turn can mark multiple unrelated tasks done/failed. |
| F23 | No task-scoped terminal summary is projected to the source comment (#156). | The answer remains invisible unless the user finds the conversation. |

## Surviving Behavior Worth Preserving

- Comment body remains assignment truth and `commentIndex.ts` already provides a mostly reusable pure document-order collector.
- Shared IDs correctly group multi-block anchored fragments.
- Sprint 104 queue freezes conversation/runtime/policy/model/effort/prompt inputs and never drains another conversation's queue.
- Conversation-scoped inbound routing drops unknown IDs instead of falling back to the visible conversation.
- Runtime terminal shapes are already normalized enough to distinguish many error/interrupted cases.
- Comment Markdown round-trip, TipTap edit/remove behavior, document sync, and the shared export chokepoint are established contracts.
- `comment-callouts` is an existing default-on experimental gate.

## Selected Direction to Validate in Phase 0

Add a host-owned task ledger/controller, one collector/prompt builder, canonical source URI, stable IDs for every comment kind, task/turn correlation, deterministic destination visibility, and host-projected status/reply. Keep full conversation/approval UI in Agent Chat and keep the user's Markdown note unchanged.

## Phase 0 Evidence Still Required

- Exact record codec, storage location, retention/cleanup, and corruption behavior.
- Atomic relationship between task persistence, destination creation, queue capacity, and accepted acknowledgment.
- Document rename/move/Save As and comment deletion behavior.
- Stable standalone/legacy ID encoding and undo/round-trip fixtures.
- Completion summary bounds and the exact safe terminal event source.
- Full-versus-surgical disposition for each finding.
- Approved interaction states in `design.md`.

No product-code change is authorized by this audit alone.
