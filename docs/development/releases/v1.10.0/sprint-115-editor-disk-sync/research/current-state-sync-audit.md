# Sprint 115 Research — Current Editor–Disk Sync Audit

**Status:** Static/source audit, executable failure model, protocol compile spike, decision candidate, and exact v1.9.0 standalone-file reproduction complete; broader RunDev matrices remain
**Audited baseline:** v1.9.0 tag `421aa08` and `origin/main@18c6175` in the Sprint 115 worktree
**Created:** 2026-08-24

## Executive Finding

The stale-editor symptom and the almost-always-active “file changed on disk” action are two outcomes of the same missing state model. The host tracks hashes it has *sent*, the React shell tracks a boolean notification, and TipTap may reject the content while focused. No acknowledgement tells the host what the user can actually see.

The current dirty-conflict path also schedules a forced disk reload after ten seconds. The exact released v1.9.0 binary confirmed that this can replace uncommitted `TextDocument` work while the stale webview continues to show those edits. Sprint 115 is therefore a release-blocking data-integrity correction rather than a cosmetic refresh-button fix.

See [v1.9.0-live-reproduction.md](./v1.9.0-live-reproduction.md) for timestamped standalone-file evidence of the focused stale view, destructive timer, and false disk-change action with unchanged disk bytes.

The three primary files are unchanged between v1.9.0 and the audited current baseline:

- [`extensions/ritemark/src/ritemarkEditor.ts`](../../../../../../extensions/ritemark/src/ritemarkEditor.ts)
- [`extensions/ritemark/webview/src/App.tsx`](../../../../../../extensions/ritemark/webview/src/App.tsx)
- [`extensions/ritemark/webview/src/components/Editor.tsx`](../../../../../../extensions/ritemark/webview/src/components/Editor.tsx)

## Evidence

| Priority | Finding | Source evidence | User impact |
|---|---|---|---|
| P0 | A dirty document plus different disk bytes schedules an automatic reload after 10 seconds. | `ritemarkEditor.ts:1522-1539` posts `fileChanged` and calls `scheduleAutoReload`; `ritemarkEditor.ts:1624-1627` calls `reloadFile` unconditionally. The released v1.9.0 Save/reopen experiment confirms the model replacement. | Uncommitted local edits can be replaced without an explicit resolution choice while the stale view temporarily hides the loss. |
| P1 | The host treats message send as visible application. | `ritemarkEditor.ts:1558-1579` posts `externalChange` and immediately stores the disk hash as `lastSentToWebview`. | Subsequent polling believes the webview is current even when TipTap never applied the payload. |
| P1 | TipTap deliberately skips external content while focused and has no later retry. | `App.tsx:220-229` updates React content; `Editor.tsx:791-799` returns when `editor.isFocused`. | Agent edits remain invisible until the editor is reconstructed by close/reopen. |
| P1 | The toolbar action is an imperative boolean, not derived sync state. | `App.tsx:210-218` sets the boolean; `App.tsx:228-229` and `App.tsx:623-625` clear it before confirmed convergence. | The icon can be stale, premature, or absent while the visible document is stale. |
| P1 | A bounded 20-hash list guesses whether disk content is self-authored. | `ritemarkEditor.ts:1331-1339` evicts old hashes; `ritemarkEditor.ts:1522-1527` uses membership to suppress conflict handling. | Sustained typing can evict the disk baseline and turn ordinary autosave lag into a false external-change warning. |
| P1 | VS Code intentionally postpones autosave while content keeps changing. | `vscode/src/vs/workbench/browser/parts/editor/editorAutoSave.ts:228-253` discards and reschedules the timer on each content change. | A three-second poll can observe an older disk snapshot while the user is simply typing. |
| P1 | Clean external bytes bypass the standard text model. | `ritemarkEditor.ts:1549-1580` builds the payload directly from disk because `TextDocument` may still be old. | Disk, model, and view can each contain a different version even while the UI claims success. |
| P1 | Per-path resources are disposed by a per-view callback. | `ritemarkEditor.ts:1458-1462` and `1595-1598` create only one watcher/poll per path; `955-970` removes them whenever any view closes. | Closing one split view can disable sync and clear history for another live view of the same file. |
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

The deterministic [Phase 0 sync model](./phase0-sync-model.test.ts) executes this sequence and proves that the second level-triggered poll is suppressed by `lastSentToWebview` while the simulated view remains stale.

### Local typing, autosave delay, false conflict

1. TipTap emits successive local edits into the VS Code document model.
2. VS Code pushes autosave forward while typing continues.
3. The disk therefore legitimately trails the dirty model.
4. After enough edits, the bounded self-hash list can forget the still-current disk baseline.
5. A watcher/poll reads the older disk bytes and classifies them as foreign.
6. The UI shows “file changed on disk” and the host starts a destructive reload timer even though no external writer changed the file.

The same executable fixture retains 20 local revisions, proves that the original base is evicted, and then fires the legacy timer to show the model/view returning to stale disk content.

### Split view, dispose one view

1. View A opens the file and creates the per-path watcher/poll.
2. View B opens the same `TextDocument`; the keyed maps reject a second watcher/poll.
3. View A closes and its per-view `onDidDispose` removes the per-path watcher, poll, sent hash, self hashes, and timer.
4. View B remains open without those shared resources.

The fixture reproduces this lifecycle independently from VS Code timing.

## Architecture Conclusion

Keep the existing `CustomTextEditorProvider` and sandboxed webview boundary, but introduce one per-URI `DocumentSyncCoordinator` as the sync authority. It must distinguish:

- the last confirmed disk revision;
- the VS Code `TextDocument`/working-copy revision and dirty state;
- the external base revision on which local edits were made;
- the revision TipTap has acknowledged as visibly applied.

Watcher, `onDidChangeTextDocument`, and polling events are invalidation hints. They trigger reconciliation; none independently declares the UI synchronized. The coordinator serializes state transitions and derives whether an unresolved external revision exists.

The correct indicator rule is not `viewHash !== diskHash`: ordinary local edits would make that true. The action is visible only when the current external/model revision exhausted its apply receipt budget, application threw an error, or disk and local edits diverged from the same base. The exact recommended contract is frozen in [phase-0-decision.md](./phase-0-decision.md).

## External Practice Synthesis

- VS Code custom text editors are views over a `TextDocument`; edits should participate in the document/working-copy lifecycle instead of creating a second file authority. See [VS Code Custom Editor API](https://code.visualstudio.com/api/extension-guides/custom-editors).
- VS Code explicitly documents that `Webview.postMessage()` returning true does not mean the message was received and recommends a confirmation message when receipt matters. See [VS Code Webview API](https://code.visualstudio.com/api/references/vscode-api#Webview).
- TipTap's `setContent` replaces the document and can suppress a normal update event; the current focused early return occurs before that command and therefore needs an application-level receipt. See [TipTap `setContent`](https://tiptap.dev/docs/editor/api/commands/content/set-content).
- ProseMirror collaboration uses ordered versions and rejects or rebases stale work. Sprint 115 adopts the version/base principle without adopting full collaborative editing. See [ProseMirror collaboration guide](https://prosemirror.net/docs/guide/#collab).
- ProseMirror transactions map selections through document steps; Sprint 115 uses that mechanism for focused external updates and keeps whole-document replacement only as a clamped fallback. See [ProseMirror transactions](https://prosemirror.net/docs/guide/#state.transactions).
- Node documents that file-watcher behavior varies by platform and can be unreliable on network/virtualized filesystems, supporting watcher-as-invalidation plus level polling rather than watcher-as-truth. See [Node.js watcher caveats](https://nodejs.org/api/fs.html#fswatchfilename-options-listener).
- HTTP `If-Match` provides the compare-and-set analogy: a state-changing operation must fail when its strong validator is no longer current, preventing the lost-update problem. See [RFC 9110 conditional requests](https://www.rfc-editor.org/rfc/rfc9110.html#section-13).

## Phase 0 Evidence Still Required

- Capture timestamps for watcher, poll, VS Code document change, autosave, host send, TipTap apply, and acknowledgement.
- Verify behavior in folder workspace and single-file mode, with the editor focused and blurred.
- Measure apply/ACK latency for ordinary and large Markdown/CSV payloads against the proposed retry budget.
- Prove transactional selection mapping and Use-disk Undo on live editor state.

Completed in Phase 0 source work:

- The exact v1.9.0 standalone-file build reproduced both user-reported symptoms and confirmed the timer-driven model overwrite; see [v1.9.0-live-reproduction.md](./v1.9.0-live-reproduction.md).
- A Node-free shared protocol source under `extensions/ritemark/src/editorSync/` compiled in the host and, with a runtime validator imported by value, passed webview TypeScript and a production Vite build.
- Epoch/revision/hash, retry, poll, conflict, selection fallback, recovery, and multi-view recommendations are frozen in [phase-0-decision.md](./phase-0-decision.md) for the separate Jarmo decision.

## Decision

Proceed as a dedicated full-SDD, audit-first Sprint 115. Do not patch only the toolbar boolean or add another timing delay: either change would retain the split-brain architecture and the P0 overwrite path.
