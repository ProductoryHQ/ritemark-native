# Sprint 105 Technical Plan

```
editor webview                     host                          sidebar webview
commentIndex.ts (NEW, W1)          ritemarkEditor.ts             store.ts comment-task registry (W4)
CommentsToolbarButton+Overview     comment:send-to-ai (+ids)     comment:submit (+ids/doc) → enqueuePrompt
MarginCommentRail (status dots)  ← comment:task-status relay  ←  status updates from queue/turn facts
```

## W1 `webview/src/extensions/comment/commentIndex.ts`
Pure scan of `editor.state.doc`: descend nodes; CommentMark ranges merged by `attrs.id` (fallback positional), CommentNodes by pos; alias/instruction via `parseCommentBody`; anchored text via `doc.textBetween` per fragment, joined. Returns `IndexedComment[]` in doc order + `summarizeComments()` (total/assigned/unassigned/per-agent). Rail refactors its identity logic onto the same helper where practical without changing layout behavior. Tests: `commentIndex.test.ts` (JSDOM-free — construct minimal PM doc via the editor schema? if heavy, test against a lightweight fake doc implementing descendants/textBetween).

## W2 Editor UI
`CommentsMenuButton.tsx` in the editor toolbar (find the existing toolbar component; reuse its button style): badge count from index recomputed on `editor.on('update')` (debounced). Overview popover (editor-side, absolutely positioned panel like existing menus): totals row, per-agent group rows with include-checkboxes (default all), unassigned note, bulk button → confirm state ("Start N tasks for M agents") → dispatch. Design: chrome tone, same vocabulary as design.md; dispatch-only wording.

## W3 Dispatch payload
Per agent: `buildAgentTaskPrompt(documentPath, comments[])` — numbered list: instruction + `Comment id: <id>` + anchored quote/position. `sendToExtension('comment:send-to-ai', { agentId, prompt, commentIds, documentPath })`. Host `ritemarkEditor.ts` forwards extra fields; `UnifiedViewProvider` includes them in `comment:submit`; store's Sprint 104 handler already accepts commentIds/documentPath on the QueueItem — wire through.

## W4 Status registry + backflow
Store: `commentTasks: Record<taskId, { commentIds, documentPath, conversationId, status }>` — created at enqueue (comment source), `running` when the item dispatches (turn created), `done|failed` from that conversation's next terminal result. On every transition → `vscode.postMessage({type:'comment:task-status', documentPath, commentIds, status})`; `UnifiedViewProvider` relays to `RitemarkEditorProvider.broadcast` (find the provider's editor-webview push channel); editor listens and MarginCommentRail renders per-comment status dot (map commentId→status in a React state fed by bridge `onMessage`).

## Order
W1 → W3 (payload/host) → W2 (UI) → W4 (status) → tests → live validation (badge/overview/bulk on demo content; busy-runtime queueing; failure state) → docs/PR/merge.
