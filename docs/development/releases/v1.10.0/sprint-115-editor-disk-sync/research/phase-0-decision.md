# Sprint 115 Phase 0 Implementation Contract

**Status:** Approved by Jarmo on 2026-08-24; implementation authorized on the dedicated Sprint 115 branch
**Branch base:** `origin/main@18c6175`
**Prepared:** 2026-08-24

## Decision Summary

Keep `CustomTextEditorProvider`, but stop treating the webview, the disk watcher, or `postMessage` as an authority. Add one host-owned coordinator per URI, use the VS Code `TextDocument` as the working-copy model, use strong disk validators for lost-update protection, and require each webview epoch to acknowledge the exact revision and complete render payload it applied.

The current refresh button is removed as a generic disk indicator. Healthy, local-only, and normally applying states stay quiet. A header action exists only after bounded application failure or a proven three-way conflict. No timer resolves or discards content.

## Evidence Behind the Decision

- The exact v1.9.0/current source can mark disk content as sent while focused TipTap rejects it, after which the level poll suppresses the same revision forever.
- The last-20 self-hash list can evict the legitimate disk base during ordinary typing; the remaining ten-second callback then applies old disk content over the model.
- The released v1.9.0 standalone-file build reproduced both sequences: a focused and then blurred view stayed stale across repeated polls, a purely local 26-step edit activated the disk-change action without changing disk bytes, and the timer replaced model content while the stale view temporarily concealed the loss. See [v1.9.0-live-reproduction.md](./v1.9.0-live-reproduction.md).
- The per-path watcher/poll maps are shared by split views, but disposing either view deletes the shared entry while another view remains open.
- Clean external content is currently parsed directly from disk and sent to the webview even when the `TextDocument` has not caught up, creating a second document authority.
- The executable [Phase 0 sync model](./phase0-sync-model.test.ts) reproduces all three legacy failures and asserts the proposed three-way, exact-ACK, multi-view, and stale-precondition rules.
- A temporary Node-free runtime-validator spike under `extensions/ritemark/src/editorSync/` passed host TypeScript, webview TypeScript, and a production Vite build when imported by value from the webview. The spike was removed after the check; the existing conversation protocol already uses the same source direction in production.

## D1 — Provider and Ownership

Retain `RitemarkEditorProvider` as a `CustomTextEditorProvider`. Text files should continue using VS Code's standard `TextDocument`, undo, save, backup, and hot-exit lifecycle. Moving to `CustomEditorProvider` would make Ritemark reimplement those guarantees and is not justified by this defect.

Add one `DocumentSyncCoordinator` service with one URI record and zero or more view leases:

```text
URI record
├── one VS Code TextDocument / working copy
├── one disk observer + one 3 s fallback poll
├── one serialized transition queue
├── zero or one unresolved conflict snapshot pair
└── view lease A, view lease B, ...
```

Disposing one view removes only its lease. URI resources are disposed after the final view/document lease ends.

## D2 — Authority and Reconciliation Path

The authority order is:

1. `TextDocument` owns the editable working copy and undo/save state.
2. The coordinator owns the relationship between working copy, disk base, and view receipts.
3. Disk reads are observations with strong validators, not direct webview updates.
4. A webview owns rendering only and proves application with a receipt.

Clean external disk content is never posted straight to the view. Reconciliation first converges the `TextDocument`:

- If VS Code already updated the clean model, publish that model revision.
- If standalone-file mode left a clean model behind disk, capture `TextDocument.version`, the clean/base state, and the disk validator; apply the disk snapshot through a version-sensitive `WorkspaceEdit`; then verify model, dirty state, and disk again. A failed or superseded edit is re-reconciled, never forced.
- If a local edit appears before that import commits, classify against the unchanged base and enter conflict instead of overwriting it.
- Save participants or formatters that alter the imported model produce a new normal model revision and are reconciled again.

All Markdown payloads are built from one captured model revision: body, properties/front matter, feature fields, and image mappings. CSV uses the same revision contract. XLS/XLSX remain on their existing read-only/binary path.

## D3 — Identities and Hashes

Use separate identities for separate questions:

| Identity | Shape | Purpose |
|---|---|---|
| Document session | random UUID per open URI lifetime | Reject records from a disposed/reopened coordinator. |
| View epoch | random UUID sent by each webview bootstrap | Reject receipts/messages from a reloaded or disposed view. |
| Server revision | monotonic safe integer per document session | Order authoritative model payloads. |
| Client sequence | monotonic safe integer per view epoch | Order optimistic webview edits and correlate acceptance/rejection. |
| Strong disk validator | SHA-256 of exact disk bytes | Resolution precondition and lost-update mitigation; not an atomic filesystem CAS primitive. |
| Logical text hash | SHA-256 of UTF-8 text with one BOM removed and CRLF/CR normalized to LF | Three-way content classification without false EOL-only visual conflicts. |
| Render payload hash | SHA-256 of canonical, key-sorted JSON for the complete Markdown/CSV render payload | Prove that all view-owned fields belong to one revision. |

Disk format metadata (BOM and observed EOL form) is retained separately. A raw-byte-only formatting change advances the disk validator but stays visually quiet when logical content is equal; the next safe model import/save must still preserve the chosen VS Code encoding/EOL behavior.

SHA-1 and the bounded hash history are removed. Hashes are content identities, not security claims, but SHA-256 provides a standard strong validator with negligible cost at this scale.

## D4 — Three-Way State Classification

Every local-edit epoch retains both `baseDiskValidator` and `baseModelHash`. Classification is deterministic:

| Disk vs base | Model vs base | Disk vs model | Result | Header |
|---|---|---|---|---|
| same | same | same | synced | none |
| same | changed | different | local-only/autosave pending | none |
| changed | same | different | clean external update | none while applying |
| changed | changed | same | converged/save caught up | none |
| changed | changed | different | true conflict | **Review changes** |

`TextDocument.isDirty` is supporting lifecycle evidence, not the sole classifier. Dirty-state-only events can trigger reconciliation but cannot activate the conflict action.

## D5 — Typed Protocol

The shared Node/VS Code-free source is `extensions/ritemark/src/editorSync/protocol.ts`. Both boundaries use runtime guards; the webview may import the guards by value because the production Vite spike passed.

Required message families:

- Host → view: `document:update`, `document:sync-state`, `document:edit-result`, `document:conflict`.
- View → host: `document:ready`, `document:applied`, `document:edit`, `document:conflict-action`.

Every document message carries URI, document session, and view epoch. Updates/receipts carry server revision and render payload hash. Edits carry based-on server revision and client sequence. Conflict actions carry the exact conflict/disk revision they intend to resolve.

Unknown types, malformed payloads, wrong URI/session/epoch, stale revisions, and non-current conflict actions are rejected with content-free diagnostics. A newer server revision supersedes all pending delivery for an older revision.

## D6 — Visible-Apply Receipt and Retry Budget

`webview.postMessage()` success means only that VS Code posted to a live webview; it is not an application receipt. Therefore:

1. Send attempt 1 immediately.
2. If no exact `document:applied` arrives, resend the same idempotent revision at 750 ms.
3. Retry once more at 2.5 s.
4. At 5 s without the exact receipt, enter `apply-error` and expose **Retry document update**.

There are three automatic sends total. Manual retry starts a fresh budget only for the current revision. A wrong epoch/revision/hash never clears pending state. A newer revision cancels the older budget. If `postMessage` returns false or the view is hidden/disposed, mark that lease dormant and send the newest snapshot after its next `document:ready`; do not show an error in an invisible view.

## D7 — Watcher and Poll Fallback

Watcher, `onDidChangeTextDocument`, save, visibility/ready, and polling events are coalesced invalidation hints into the same serialized reconcile function.

- Keep one three-second full-content fallback poll per open URI, not per view.
- Poll only while at least one view/document lease exists.
- Hash exact bytes after the read and exit without messages when the strong validator is unchanged.
- Coalesce concurrent watcher/poll/model events; never run two transitions for one URI at once.
- Correctness is level-triggered and does not require every watcher event. The three-second cadence can be tuned only from measured performance evidence, not used as a conflict heuristic.

## D8 — Focus, Selection, Scroll, and Feedback Suppression

Focused editors apply clean external revisions. The focused-state early return is removed.

Preferred Markdown application:

1. Parse the target payload into a ProseMirror document using the existing Markdown/HTML pipeline.
2. Compute the smallest structural changed range and dispatch one transaction tagged with the server revision and `addToHistory: false`.
3. Let ProseMirror map the existing selection through that transaction.
4. Restore the nearest scroll anchor and keep focus.

If structural mapping is not possible, replace content atomically, clamp anchor/head to a valid `Selection.near` position, and restore the nearest scroll position. Content correctness wins over an impossible exact caret mapping. CSV retains the selected cell only when row/column identity remains valid; otherwise it clamps to the nearest surviving cell.

Host-applied transactions carry sync metadata and cannot emit `document:edit`. The view sends `document:applied` only after the editor/table plus properties, front matter state, and mappings all reflect the same payload hash.

## D9 — Conflict, Compare, Resolution, and Recovery

On true divergence, freeze immutable base/local/disk snapshots and stop automatic application. No retry, polling tick, timeout, focus change, or dialog dismissal resolves it.

- **Compare changes** opens memory-backed `ritemark-sync:` virtual documents in VS Code's diff editor. It mutates nothing.
- **Keep my version…** re-reads the exact disk validator immediately before writing. A mismatch creates a refreshed conflict. VS Code's public `TextDocument.save()` correctly rejects the stale etag after a true conflict, so the implementation writes through `workspace.fs.writeFile`, verifies the selected bytes, then performs a same-content VS Code revert to refresh etag/clean state without changing model content or its Undo stack.
- **Use disk version…** re-reads the exact disk validator, then applies that snapshot to the `TextDocument` as one undoable `WorkspaceEdit`. Ctrl/Cmd-Z must restore the prior local snapshot as dirty; this is an acceptance test, not an assumption.
- For Keep my version, the model did not change, so editor Undo is intentionally unchanged. The discarded disk snapshot remains available through the open diff until resolution verification completes, then the explicit choice is final.

Neither destructive action is default-focused. If the public VS Code edit path cannot prove the required Use-disk Undo behavior in the live spike, implementation stops at the Phase 1 gate and the design returns for an explicit recovery action; it does not silently ship weaker semantics.

## D10 — Multiple Views

All views share URI disk/model/base/conflict state but track delivery independently.

- Each view has its own epoch, pending revision, ACK revision, retry budget, visibility, and client sequence.
- A local edit accepted from one view advances the shared server revision. Other views receive the authoritative model payload; the source receives `document:edit-result` and may acknowledge without replacing equal visible content.
- Conflict starts and resolves once per URI and is broadcast to every live view.
- Closing one split view never stops the URI watcher/poll or clears another view's receipt.
- A late message from a closed/reloaded view is ignored.

## D11 — Header Truth

The header selector is derived, never separately set:

- synced, local-only, clean external applying inside 5 s: no action;
- current revision exhausted its ACK budget: **Retry document update**;
- true conflict: **Review changes**;
- parser/render exception: **Document update failed**.

Clicking an action does not clear it. Only an exact receipt or successful explicit conflict resolution changes the derived state. Ordinary success stays silent.

## D12 — Rollout Boundary

No feature flag, new editor provider, VS Code patch, CRDT/OT layer, direct webview filesystem access, or new dependency is approved. The legacy timer, `lastSentToWebview`, bounded self hashes, per-view duplicate listeners, and independent React/CSV booleans are deleted only after replacement tests cover their paths.

The architecture document must change in the implementation sprint because module ownership and webview message contracts change.

## Phase 0 Evidence Commands

```text
npx tsx docs/development/releases/v1.10.0/sprint-115-editor-disk-sync/research/phase0-sync-model.test.ts
  7/7 pass

npx tsc --noEmit -p extensions/ritemark
  pass with temporary runtime protocol spike

npm run typecheck --prefix extensions/ritemark/webview
  pass with temporary runtime protocol spike

npx vite build --outDir /private/tmp/ritemark-sprint-115-runtime-protocol-spike --emptyOutDir
  pass; 7,521 modules transformed
```

## Implementation Evidence

- Content-free transition tracing and folder-workspace RunDev evidence are recorded in [phase-1-live-smoke.md](./phase-1-live-smoke.md).
- Normal loaded-document ACKs were 5–75 ms; cold initialization was 337 ms in the final run and 1,426 ms in an earlier run, inside the approved retry budget.
- Focused Markdown application, selection usability, CSV application, split views, dispose-one, hide/show, and conflict-time typing pass live.
- Both explicit recovery paths pass: Use-disk Undo restores the exact prior local snapshot as dirty, while Keep-local converges disk/model/view and retains the existing Undo history.
- Local-only and true-conflict states remain safe beyond the removed ten-second reload window.
- The residual forced live receipt-loss, accessibility/theme, rename/delete/save-as, multi-root, large-file, previous-epoch, and exact agent-runtime rows are retained as release-candidate QA rather than overclaimed here.

## Approval Requested

Jarmo approved D1–D12 as the Sprint 115 implementation contract on 2026-08-24. The remaining implementation-dependent live evidence must confirm the values and acceptance rules before its corresponding phase can close; any failed hard acceptance rule returns as a named exception for a second decision.

## Primary References

- [VS Code Custom Editor API](https://code.visualstudio.com/api/extension-guides/custom-editors)
- [VS Code Webview API reference](https://code.visualstudio.com/api/references/vscode-api#Webview)
- [VS Code `WorkspaceEdit` custom editor example](https://github.com/microsoft/vscode/blob/main/extensions/markdown-language-features/src/preview/markdownEditorProvider.ts)
- [TipTap `setContent`](https://tiptap.dev/docs/editor/api/commands/content/set-content)
- [ProseMirror guide](https://prosemirror.net/docs/guide/)
- [ProseMirror reference](https://prosemirror.net/docs/ref/)
- [Node.js file watcher caveats](https://nodejs.org/api/fs.html#fswatchfilename-options-listener)
- [RFC 9110 conditional requests](https://www.rfc-editor.org/rfc/rfc9110.html#section-13)
