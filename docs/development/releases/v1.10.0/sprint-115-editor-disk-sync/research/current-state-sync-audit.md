# Sprint 115 Research — Current Editor–Disk Sync Audit

**Status:** Planning baseline; live reproduction and trace evidence remain Sprint 115 Phase 0 work  
**Audited baseline:** v1.9.0 tag `421aa08` and the current editor-sync source in this worktree  
**Created:** 2026-08-24

## Executive Finding

The stale-editor symptom and the almost-always-active “file changed on disk” action are two outcomes of the same missing state model. The host tracks hashes it has *sent*, the React shell tracks a boolean notification, and TipTap may reject the content while focused. No acknowledgement tells the host what the user can actually see.

The current dirty-conflict path also schedules a forced disk reload after ten seconds. That can replace uncommitted local work without a final user decision, so Sprint 115 is a release-blocking data-integrity correction rather than a cosmetic refresh-button fix.

The three primary files are unchanged between v1.9.0 and the audited current baseline:

- [`extensions/ritemark/src/ritemarkEditor.ts`](../../../../../../extensions/ritemark/src/ritemarkEditor.ts)
- [`extensions/ritemark/webview/src/App.tsx`](../../../../../../extensions/ritemark/webview/src/App.tsx)
- [`extensions/ritemark/webview/src/components/Editor.tsx`](../../../../../../extensions/ritemark/webview/src/components/Editor.tsx)

## Evidence

| Priority | Finding | Source evidence | User impact |
|---|---|---|---|
| P0 | A dirty document plus different disk bytes schedules an automatic reload after 10 seconds. | `ritemarkEditor.ts:1522-1539` posts `fileChanged` and calls `scheduleAutoReload`; `ritemarkEditor.ts:1624-1627` calls `reloadFile` unconditionally. | Uncommitted local edits can be replaced without an explicit resolution choice. |
| P1 | The host treats message send as visible application. | `ritemarkEditor.ts:1558-1579` posts `externalChange` and immediately stores the disk hash as `lastSentToWebview`. | Subsequent polling believes the webview is current even when TipTap never applied the payload. |
| P1 | TipTap deliberately skips external content while focused and has no later retry. | `App.tsx:220-229` updates React content; `Editor.tsx:791-799` returns when `editor.isFocused`. | Agent edits remain invisible until the editor is reconstructed by close/reopen. |
| P1 | The toolbar action is an imperative boolean, not derived sync state. | `App.tsx:210-218` sets the boolean; `App.tsx:228-229` and `App.tsx:623-625` clear it before confirmed convergence. | The icon can be stale, premature, or absent while the visible document is stale. |
| P1 | A bounded 20-hash list guesses whether disk content is self-authored. | `ritemarkEditor.ts:1331-1339` evicts old hashes; `ritemarkEditor.ts:1522-1527` uses membership to suppress conflict handling. | Sustained typing can evict the disk baseline and turn ordinary autosave lag into a false external-change warning. |
| P1 | VS Code intentionally postpones autosave while content keeps changing. | `vscode/src/vs/workbench/browser/parts/editor/editorAutoSave.ts:228-253` discards and reschedules the timer on each content change. | A three-second poll can observe an older disk snapshot while the user is simply typing. |
| P2 | No revision, base revision, apply acknowledgement, or stale-message rule crosses the bridge. | The current `externalChange`/`fileChanged` payloads contain content and a dirty boolean only. | Rapid writes, delayed messages, multiple views, and retries are not ordered or provably convergent. |

## Reconstructed Failure Sequences

### Clean document, external agent write, editor focused

1. An agent writes new bytes to disk.
2. The watcher or poll reads those bytes and sends `externalChange`.
3. The host immediately records the new hash as already sent.
4. React receives the new `content` prop.
5. TipTap is focused and refuses `setContent` to avoid a cursor jump.
6. No `document:applied` acknowledgement or blur retry exists.
7. Polling sees the disk hash equal to `lastSentToWebview` and does nothing.
8. Closing and reopening reconstructs TipTap from disk, making the supposedly completed agent edit visible.

### Local typing, autosave delay, false conflict

1. TipTap emits successive local edits into the VS Code document model.
2. VS Code pushes autosave forward while typing continues.
3. The disk therefore legitimately trails the dirty model.
4. After enough edits, the bounded self-hash list can forget the still-current disk baseline.
5. A watcher/poll reads the older disk bytes and classifies them as foreign.
6. The UI shows “file changed on disk” and the host starts a destructive reload timer even though no external writer changed the file.

## Architecture Conclusion

Keep the existing `CustomTextEditorProvider` and sandboxed webview boundary, but introduce one per-URI `DocumentSyncCoordinator` as the sync authority. It must distinguish:

- the last confirmed disk revision;
- the VS Code `TextDocument`/working-copy revision and dirty state;
- the external base revision on which local edits were made;
- the revision TipTap has acknowledged as visibly applied.

Watcher, `onDidChangeTextDocument`, and polling events are invalidation hints. They trigger reconciliation; none independently declares the UI synchronized. The coordinator serializes state transitions and derives whether an unresolved external revision exists.

The correct indicator rule is not `viewHash !== diskHash`: ordinary local edits would make that true. The action is visible only when the disk has advanced externally beyond the view's acknowledged base, application has failed or timed out, or disk and local edits diverged from the same base.

## External Practice Synthesis

- VS Code custom text editors are views over a `TextDocument`; edits should participate in the document/working-copy lifecycle instead of creating a second file authority. See [VS Code Custom Editor API](https://code.visualstudio.com/api/extension-guides/custom-editors).
- Dirty content must not be silently replaced by a changed disk version; compare/review and explicit resolution are the safe recovery pattern. See [VS Code editing tips: prevent dirty writes](https://code.visualstudio.com/docs/editing/tips-and-tricks#_preventing-dirty-writes).
- TipTap's `setContent` can update without emitting a normal editor update, but sending that command is still not proof that the visible editor accepted the requested revision. See [TipTap `setContent`](https://tiptap.dev/docs/editor/api/commands/content/set-content).
- ProseMirror collaboration uses ordered versions and rejects or rebases stale work. Sprint 115 adopts the version/base principle without adopting full collaborative editing. See [ProseMirror collaboration guide](https://prosemirror.net/docs/guide/#collab).
- HTTP conditional requests provide a useful compare-and-set analogy: mutate only if the caller's base still matches the current resource; otherwise return a conflict. See [RFC 9110 conditional requests](https://datatracker.ietf.org/doc/html/rfc9110#section-13).

## Phase 0 Evidence Still Required

- Reproduce both reported symptoms on the exact v1.9.0 binary and on the Sprint 115 branch.
- Capture timestamps for watcher, poll, VS Code document change, autosave, host send, TipTap apply, and acknowledgement.
- Verify behavior in folder workspace and single-file mode, with the editor focused and blurred.
- Confirm the compiler-safe location for a shared, Node-free sync protocol type.
- Freeze cursor/selection restoration, conflict comparison, and multi-view behavior before implementation.

## Decision

Proceed as a dedicated full-SDD, audit-first Sprint 115. Do not patch only the toolbar boolean or add another timing delay: either change would retain the split-brain architecture and the P0 overwrite path.
