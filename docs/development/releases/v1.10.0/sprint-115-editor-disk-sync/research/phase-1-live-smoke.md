# Sprint 115 Phase 1 Live Smoke Evidence

**Date:** 2026-08-24  
**Branch:** `codex/sprint-115-editor-disk-sync`  
**Build:** local VS Code OSS RunDev shell with the Sprint 115 extension-development path  
**Profile:** disposable, `files.autoSave: off`  
**Fixtures:** disposable Markdown and CSV files under a temporary folder workspace; no user document was modified

This evidence complements the exact released-v1.9.0 reproduction in [v1.9.0-live-reproduction.md](./v1.9.0-live-reproduction.md). Host logs below are content-free: file basename, truncated session/view identity, revision, transition, attempt, and elapsed milliseconds only.

## Passed live cases

| Case | Result | Evidence |
|---|---|---|
| Focused Markdown external write | Pass | The disk write appeared in the already-focused TipTap view without close/reopen. Focus stayed in the editor; the selection around the stable section remained usable. No Review/Retry action remained. |
| Visible receipt | Pass | Normal loaded-document update receipts completed in 5–75 ms; a cold service-worker initialization took 337 ms in the final rerun and 1,426 ms in an earlier run, still before the 2.5 s retry and 5 s error boundaries. |
| Local-only/autosave-off | Pass | A local edit stayed visible for longer than the former ten-second timer, disk bytes remained unchanged, and no header action appeared. |
| True conflict safety | Pass | Local and disk changes from the same base produced only **Review changes**. Waiting beyond ten seconds, polling, focus changes, and dialog close changed neither version. |
| Continue typing during conflict | Pass | Text entered after the conflict action appeared advanced the host's local conflict snapshot; **Keep my version** later persisted that final local content rather than the earlier partial snapshot. |
| Read-only comparison | Pass | **Compare changes** opened `My version ↔ Disk version` in memory-backed `.txt` diff inputs. Returning to the editor kept the conflict. Using `.txt` prevented recursive activation of the Ritemark custom editor. |
| Use disk + recovery | Pass | **Use disk version** replaced the model/view with the exact disk snapshot. Cmd-Z restored the exact prior local snapshot as dirty while disk stayed unchanged and the header stayed quiet. |
| Keep local + recovery | Pass | The first implementation attempt proved that public `TextDocument.save()` correctly refuses stale etags with `File Modified Since`. The final path rechecked the exact disk SHA-256, wrote through `workspace.fs.writeFile`, then used a same-content VS Code revert to refresh etag/clean state. Disk and view converged, the action cleared after ACK, and Cmd-Z still undid the last local edit without changing disk. The post-audit final-bundle rerun opened and closed **Compare changes** first, then repeated Keep-local: resolution ACK took 7 ms, the final local marker was on disk/view, no action remained, and Cmd-Z removed it only from the view/model while disk stayed saved. |
| CSV clean external write | Pass | The visible table changed from the initial cell value to the external value without reopen and without Review/Retry. Parsing completed before the receipt. |
| Two Markdown views | Pass | Splitting the same URI produced distinct view epochs under one document session. Both visible views received and acknowledged the next external revision. |
| Dispose one split view | Pass | After closing one view, the remaining view received the next external revision; the URI watcher/poll was not disposed early. |
| Hide/show | Pass | Returning from the VS Code diff caused the original hidden view to receive current state and acknowledge it (75 ms in the observed run). |
| Header truth | Pass | Synced, applying-within-budget, and local-only states rendered no action; conflict rendered **Review changes**. The legacy pulsing disk button and independent React/CSV booleans are absent from the editable Markdown/CSV path. |

## Deterministic evidence

The fake-clock delivery suite proves the exact resend budget without slowing the live run:

```text
attempt 1: immediate
attempt 2: 750 ms
attempt 3: 2,500 ms
apply-error: 5,000 ms
```

Wrong revision or payload hash receipts do not clear the budget; an exact receipt and a superseding revision do. The state/protocol/reducer suite also covers logical EOL/BOM equality, initial dirty versus clean-lagging attachment, local-only/external/converged/conflict classification, conflict-time typing, visible-view resolution ACKs, exact message fields, stale host revisions, and truthful action selection.

The final focused suite is 24/24, extension compile and webview typecheck/production build pass, and `./scripts/validate-qa.sh` passes on the Sprint 115 branch.

## Diagnostics observed

Representative content-free lines:

```text
[EditorSync] delivery file=editor-sync.md session=… view=… revision=… event=send attempt=1
[EditorSync] transition file=editor-sync.md session=… revision=… state=conflict views=1 reason=watcher:conflict
[EditorSync] transition file=editor-sync.md session=… revision=… state=synced views=1 reason=resolution-acknowledged
[EditorSync] delivery file=editor-sync.md session=… view=… revision=… event=ack elapsedMs=26
```

No log line included Markdown text, front matter values, or CSV cell data.

## Remaining release-level manual matrix

- Inject a real visible-webview receipt loss and verify the five-second **Retry document update** surface end to end. The deterministic fake-clock and reducer paths pass; the live webview normally acknowledges too quickly to reach it.
- Repeat the final candidate on light, dark, and high-contrast themes, keyboard-only navigation, a screen reader, and 200% zoom.
- Repeat rename/delete/save-as, formatter, multi-root, rapid large-file, and previous-epoch lifecycle rows on the merged release candidate.
- Repeat agent-origin writes through each available Claude/Codex/ACP runtime on the exact release build; the sync path itself is source-agnostic and generic process writes pass.

These remaining rows are explicit release QA. They do not weaken the verified no-reopen, no-false-local-action, no-timer-loss, exact-ACK, Markdown/CSV, conflict-recovery, and multi-view behaviors above.
