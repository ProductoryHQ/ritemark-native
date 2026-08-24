# Sprint 115 — Reliable Editor–Disk Synchronization

**Track:** Full SDD, audit-first  
**Status:** Phase 0 in progress — planning approved 2026-08-24; implementation awaits Phase 0 decision freeze  
**Branch:** `codex/sprint-115-editor-disk-sync`  
**Worktree:** `.worktrees/sprint-115-editor-disk-sync`  
**Issue:** [#221](https://github.com/ProductoryHQ/ritemark-native/issues/221) — linked to milestone v1.10.0  
**Release:** [v1.10.0](../release-plan.md)  
**Created:** 2026-08-24

## Goal

Make the open editor, VS Code document model, and file on disk converge through one revisioned state machine. External agent writes must become visible without closing/reopening, ordinary typing must not trigger a false disk-change action, and a true conflict must never discard local work without an explicit user choice.

## Why This Is a Separate Sprint

The v1.9.0 behavior crosses the filesystem watcher/poll fallback, VS Code working-copy/autosave lifecycle, `RitemarkEditorProvider`, the webview bridge, React state, TipTap focus/selection, Markdown/CSV payloads, and document-header UX. A toolbar-only change cannot fix the missing apply acknowledgement or the destructive reload path.

Sprint 115 introduces a host sync subsystem and a revision/ACK message contract, so the Architecture Gate is mandatory. It is product-code independent from Sprints 109–114 but blocks the v1.10.0 release candidate because the current path has a P0 local-edit loss risk.

## In Scope

- Live reproduction and trace audit of both reported v1.9.0 symptoms.
- Per-URI disk/model/base/view revision state and serialized reconciliation.
- Typed, epoch-scoped `document:update` / `document:applied` / edit / conflict messages.
- Focus-safe clean external updates with bounded ACK retry and stale-message rejection.
- Removal of the fixed 20-hash heuristic and ten-second forced reload.
- Truthful derived header states: quiet for synced/local-only, retry for failed apply, **Review changes** for true conflict.
- Read-only local-versus-disk comparison and explicit compare-and-set resolution.
- Markdown and CSV behavior, multiple views, folder workspace, and standalone-file mode.
- Regression tests, dev smoke evidence, architecture docs, changelog, release notes, and release checklist.

## Explicitly Out of Scope

- Full typed migration of every webview↔host message under issue #106.
- CRDT, Operational Transformation, ProseMirror collaboration backend, multi-user editing, or cloud sync.
- A new custom editor provider, direct webview filesystem access, or a VS Code OSS patch.
- Requiring agents, formatters, or generic external tools to use a Ritemark-specific write API.
- A new feature flag or a fallback to the unsafe timer-based path.
- Unrelated document-header redesign, webview bundle refactor, or editor performance program.

## Deliverables

1. Approved live current-state audit with reproduction traces and frozen decisions (R1–R8).
2. Host-owned per-URI `DocumentSyncCoordinator` and typed sync protocol (R1, R2, R6, R7).
3. Revision-aware webview application and visible-apply ACK for Markdown and CSV (R2, R3, R7).
4. Non-destructive conflict comparison/resolution and truthful header affordance (R4, R5).
5. Automated and dev-smoke regression matrix covering focus, autosave, ordering, lifecycle, and multiple views (R1–R8).
6. Updated architecture, changelog, v1.10.0 release notes, test checklist, and release tracker (R8).

## Success Criteria

- [ ] A clean Codex/Claude/ACP or generic process write appears in an open focused editor without close/reopen.
- [ ] The host never equates successful `postMessage` delivery with TipTap application; only a matching ACK advances the visible revision.
- [ ] Continuous local typing and autosave lag never show an external-change action.
- [ ] No timer, poll, retry, blur, or lifecycle event can discard unresolved local edits.
- [ ] True local/disk divergence preserves both versions and offers **Compare changes**, **Keep my version**, and **Use disk version**.
- [ ] Older, duplicate, previous-epoch, and cross-URI messages cannot replace a newer visible revision.
- [ ] The header action remains visible only for an unresolved external apply/conflict and clears only after confirmed resolution.
- [ ] Markdown front matter/properties/comments/images and CSV rows/cells survive reconciliation unchanged except for the chosen revision.
- [ ] Folder workspace, standalone-file, rapid-write, multiple-view, and close/reopen matrices pass.
- [ ] `docs/development/architecture.md`, changelog, release notes, test evidence, focused tests, and `./scripts/validate-qa.sh` are complete.

## Dependencies and Gates

- Jarmo approves this plan before any implementation work.
- Create and verify `codex/sprint-115-editor-disk-sync` from a clean, synchronized `main` immediately after approval; never implement on `main`.
- Sprint 113 is merged and this branch is rebased onto `origin/main@18c6175`; Sprint 114 external Windows/Store release gates may continue independently.
- Phase 0 requires a separate Jarmo decision on revision/ACK shape, retry deadline, conflict resolutions, selection fallback, protocol source location, and multi-view ownership.
- Keep [#221](https://github.com/ProductoryHQ/ritemark-native/issues/221) aligned with scope, evidence, and decisions.
- The Architecture Gate is unconditional because module structure, document state ownership, and webview messages change.
- Use both `vscode-development` and `webview-development` during implementation; use `ritemark-design` for the conflict/header surface and `qa-validation` before ready handoff.
- No new feature flag is planned: this is a correctness fix and the old behavior is not a safe rollback path.
- Sprint 115 must merge before v1.10.0 release-candidate packaging.

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Timer/retry overwrites unsaved local content | Critical | Delete forced reload; immutable conflict snapshots; explicit resolution; wait-past-10s regression. |
| Host ACKs send instead of visible apply | High | Revisioned `document:applied`, bounded retry, stale rejection, missing-ACK tests. |
| Local autosave lag is misclassified as external change | High | Explicit base/model/disk state; remove bounded self-hash guessing; continuous-typing test. |
| Focus-safe update causes cursor/selection regressions | Medium | Apply while focused, capture/restore or clamp selection, component and smoke evidence. |
| Rapid writes or multiple views reorder revisions | High | Per-URI serialization, view epochs, idempotent revisions, disposal/reference-count tests. |
| Markdown metadata or CSV data comes from mixed revisions | High | One full typed payload per revision; ACK only after atomic view application; parity fixtures. |
| Sync slice expands into global bridge rewrite | Medium | Limit typed protocol to document sync; retain #106 as separate debt. |
| Concurrent Sprint 113 webview work causes merge conflicts | Medium | Retired for kickoff: rebased onto `origin/main@18c6175`; keep sync modules isolated and regenerate the shared bundle only after source work. |

## SDD Artifacts

- [spec.md](./spec.md) — stable R1–R8 product and safety requirements.
- [scenarios.md](./scenarios.md) — BDD acceptance and test matrix.
- [technical-plan.md](./technical-plan.md) — state model, typed protocol, components, testing, and architecture gate.
- [design.md](./design.md) — header, conflict dialog, compare, focus, and accessibility contract.
- [tasks.md](./tasks.md) — gated phase checklist.
- [research/current-state-sync-audit.md](./research/current-state-sync-audit.md) — v1.9.0 source evidence, failure sequence, and external-practice synthesis.

## Product Decisions

| Date | Decision | Rationale |
|---|---|---|
| 2026-08-24 | Add editor–disk synchronization as Sprint 115 under v1.10.0 | The current release can show stale visible content and contains a timer-driven local-edit loss risk. |
| 2026-08-24 | Treat Sprint 115 as a release blocker and full SDD, audit-first sprint | The change crosses filesystem, VS Code model, host, bridge, and webview with ordering and recovery edge cases. |
| 2026-08-24 | Keep `CustomTextEditorProvider`; add one host sync authority | Preserves locked architecture while removing competing hash/boolean sources of truth. |
| 2026-08-24 | Require revision + visible-apply ACK | Message delivery is not evidence that TipTap rendered the update. |
| 2026-08-24 | Never auto-resolve dirty conflicts | A safe editor preserves both versions until the user makes an explicit choice. |
| 2026-08-24 | Derive the header action from unresolved external state, not raw view/disk inequality | Local edits legitimately lead disk during autosave and must remain quiet. |
| 2026-08-24 | Do not add a feature flag or VS Code patch | The old path is unsafe; the fix belongs in the existing extension/webview architecture. |
| 2026-08-24 | Jarmo approved Sprint 115 kickoff in a separate branch/worktree while Sprint 113 closes | Phase 0 may proceed independently; rebase onto the Sprint 113 merge before overlapping webview implementation. |
| 2026-08-24 | Rebased Sprint 115 kickoff onto merged Sprint 113 | `origin/main@18c6175` is the branch base; release-plan overlap was reconciled before product-code work. |

## Planning Approval

- [x] Jarmo approves Sprint 115 scope, release-blocker status, and delivery placement (2026-08-24).
- [x] Jarmo approves branch/worktree creation (2026-08-24).
- [x] GitHub issue [#221](https://github.com/ProductoryHQ/ritemark-native/issues/221) created, assigned to milestone v1.10.0, and linked here.
- [ ] Phase 0 revision/conflict/UX decisions approved before implementation.
