# Sprint 115 Tasks — Reliable Editor–Disk Synchronization

Tick `[x]` only when the artifact/evidence exists on `codex/sprint-115-editor-disk-sync` and can be linked from the diff or release evidence.

> **Gate:** Implementation starts only after Jarmo approves the plan and the dedicated non-`main` branch exists. Phase 0 is audit, reproduction, and decision freeze only.

Branch/worktree and Phase 0 decision gates satisfied 2026-08-24.

## Phase 0 — Reproduce and Freeze the Contract (R1–R8)

- [x] Reproduce the invisible focused-editor agent write on the exact v1.9.0 binary; capture disk bytes, inferred model state through Save, visible bytes, focus state, and timestamps in [`research/v1.9.0-live-reproduction.md`](./research/v1.9.0-live-reproduction.md).
- [x] Reproduce ordinary local typing/autosave lag and confirm the current external-change action activates while disk bytes remain unchanged; preserve the evidence in [`research/v1.9.0-live-reproduction.md`](./research/v1.9.0-live-reproduction.md).
- [x] Prove both in the exact released binary and the legacy transition model that the former ten-second auto-reload can replace unsaved work; preserve only disposable evidence and the safe executable fixture in [`research/phase0-sync-model.test.ts`](./research/phase0-sync-model.test.ts), never real user data.
- [ ] Trace watcher, `onDidChangeTextDocument`, poll, autosave, host send, webview receive, TipTap apply, and ACK timing in folder and standalone-file modes.
- [ ] Audit Markdown, CSV, multiple-view, panel hide/show, and close/reopen lifecycles.
- [x] Spike the Node-free shared protocol location and runtime validator; verify host TypeScript, webview TypeScript, and a production Vite build. The temporary source spike was removed after evidence capture.
- [x] Freeze the recommended epoch/revision identity, 750 ms / 2.5 s / 5 s ACK budget, three-second poll fallback, and three distinct hash rules in [`research/phase-0-decision.md`](./research/phase-0-decision.md).
- [x] Freeze transactional ProseMirror selection mapping, clamped fallback, scroll behavior, and the read-only conflict snapshot/diff mechanism.
- [x] Freeze **Keep my version** and **Use disk version** recovery/Undo semantics, with Use-disk Undo retained as a hard live acceptance test.
- [x] Update `research/current-state-sync-audit.md` with executable/static evidence, exact released-binary evidence, official-practice synthesis, the model-bypass finding, and the split-view lifecycle finding.
- [x] **Jarmo Phase 0 gate:** protocol, state model, conflict UX, selection fallback, multi-view ownership, and implementation scope approved 2026-08-24.

## Phase 1 — Typed Protocol and Host Coordinator (R1, R2, R6, R7)

- [x] Add typed document update, sync-state, applied-ACK, edit, and conflict-action messages with runtime validation.
- [x] Add per-URI coordinator lifecycle and per-view epochs.
- [x] Add serialized transition processing and deterministic disk/model/base/view revision state.
- [x] Route watcher, document, save, and poll invalidations through one reconciliation entry point.
- [x] Implement idempotent send, bounded ACK retry, stale rejection, and apply-error state.
- [x] Implement clean-external, local-only, and true-conflict classification without the 20-hash heuristic.
- [x] Ensure multiple views share URI state and dispose independently.
- [x] Add content-free diagnostic transition logging.
- [ ] Add pure coordinator/protocol tests with fake disk, view, and clock.

## Phase 2 — Webview Apply and ACK (R2, R3, R7)

- [x] Add the pure webview sync reducer and derived selectors.
- [x] Replace the focused-editor early return with revision-aware application.
- [x] Preserve or safely clamp focus, selection, and scroll position.
- [x] Apply Markdown content, properties, front matter state, comments, and image mappings as one revision.
- [x] Apply CSV content under the same epoch/revision contract.
- [x] Emit `document:applied` only after serialized visible content matches the target identity.
- [x] Prevent host-applied revisions from echoing as local edit messages.
- [x] Reject duplicate, stale, previous-epoch, and cross-URI messages.
- [ ] Add reducer/component tests for focused apply, partial payload prevention, ACK, retry, and stale ordering.

## Phase 3 — Conflict Resolution and Header Truth (R4, R5, R6)

- [x] Remove the independent `showFileChangeNotification` boolean and derive the header from sync state.
- [x] Keep the action hidden for synced and local-only/autosave states.
- [x] Implement **Retry document update**, **Review changes**, and apply-error states per `design.md`.
- [x] Add immutable local/disk conflict snapshots and open them through VS Code's diff view.
- [x] Implement compare-and-set **Keep my version**; recalculate if disk advanced.
- [x] Implement explicit **Use disk version** with confirmed local-discard behavior and ACK.
- [x] Remove the ten-second automatic reload and prove no replacement timer remains.
- [x] Remove `lastSentToWebview`/bounded self-hash behavior after coordinator coverage is complete.
- [ ] Complete keyboard, screen-reader, tooltip, light/dark, high-contrast, and 200%-zoom checks.

## Phase 4 — Integration and Regression Matrix (R1–R8)

- [ ] Run all scenarios in `scenarios.md` for Markdown and CSV.
- [ ] Test external writes from Codex, Claude/ACP where available, a generic process, and a formatter.
- [ ] Test focused/blurred editors, continuous typing, delayed autosave, burst writes, duplicate messages, lost ACK, and retry exhaustion.
- [ ] Test folder workspace, multi-root where applicable, and standalone-file windows.
- [ ] Test initial open, panel hide/show, multiple views, dispose-one-view, close/reopen, and previous-epoch messages.
- [ ] Verify front matter, properties, comments, relative images, CSV rows/cells, undo/recovery, and save semantics.
- [x] Wait beyond the former ten-second danger window during a true conflict and prove local bytes remain intact.
- [x] Run the Ritemark dev smoke workflow and attach content-free evidence in [`research/phase-1-live-smoke.md`](./research/phase-1-live-smoke.md).

## Phase 5 — Documentation, QA, and Closeout (R8)

- [x] Update `docs/development/architecture.md` core file flow, `src/editorSync/`, revision ownership, typed messages, retries, conflicts, and #106 boundary.
- [x] Ensure the architecture `Last updated` date is not earlier than the Sprint 115 branch creation date.
- [x] Update `docs/CHANGELOG.md`, `docs/releases/v1.10.0/release-notes.md`, and the v1.10.0 test checklist/evidence.
- [x] Record that no feature flag, VS Code patch, new provider, dependency, or full bridge rewrite was added.
- [x] Run focused host and webview tests plus builds (24/24 focused tests, extension compile, webview typecheck/build on 2026-08-24).
- [x] Run `./scripts/validate-qa.sh` on the sprint branch (pass 2026-08-24).
- [x] Complete adversarial QA/code review and resolve the initial-dirty, conflict-time queued edit, resolution-ACK, cross-field payload, stale edit-result, full-replacement Undo, and post-Compare focus findings.
- [x] Update Sprint 115 issue/tracker and link the implementation/QA evidence in [issue #221](https://github.com/ProductoryHQ/ritemark-native/issues/221#issuecomment-5400936217).
- [ ] Merge the dedicated sprint PR before v1.10.0 release-candidate packaging.
- [ ] Verify on the merged release candidate that agent writes are visible without reopen and no local edit can be timer-discarded.
