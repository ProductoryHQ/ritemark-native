# Sprint 115 — Reliable Editor–Disk Synchronization

**Track:** Full SDD, audit-first  
**Status:** Repository scope complete — PR #222 admin-merged as `b889dcd` after Jarmo's explicit authorization; release-candidate manual matrix remains
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
- Read-only local-versus-disk comparison and explicit strong-validator-guarded resolution.
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

- [x] A clean Codex/Claude/ACP or generic process write appears in an open focused editor without close/reopen.
- [x] The host never equates successful `postMessage` delivery with TipTap application; only a matching ACK advances the visible revision.
- [x] Continuous local typing and autosave lag never show an external-change action.
- [x] No timer, poll, retry, blur, or lifecycle event can discard unresolved local edits.
- [x] True local/disk divergence preserves both versions and offers **Compare changes**, **Keep my version**, and **Use disk version**.
- [x] Older, duplicate, previous-epoch, and cross-URI messages cannot replace a newer visible revision.
- [x] The header action remains visible only for an unresolved external apply/conflict and clears only after confirmed resolution.
- [ ] Markdown front matter/properties/comments/images and CSV rows/cells survive reconciliation unchanged except for the chosen revision.
- [ ] Folder workspace, standalone-file, rapid-write, multiple-view, and close/reopen matrices pass.
- [x] `docs/development/architecture.md`, changelog, release notes, test evidence, focused tests, and `./scripts/validate-qa.sh` are complete.

## Dependencies and Gates

- Jarmo approved the sprint plan/kickoff and the D1–D12 Phase 0 implementation contract on 2026-08-24.
- Branch/worktree creation and the post-Sprint-113 rebase are complete; never implement on `main`.
- Sprint 113 is merged and this branch is rebased onto `origin/main@18c6175`; Sprint 114 external Windows/Store release gates may continue independently.
- The approved Phase 0 contract fixes revision/ACK shape, retry deadline, conflict resolutions, selection fallback, protocol source location, and multi-view ownership; any exception must return as an explicit decision.
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
- [research/v1.9.0-live-reproduction.md](./research/v1.9.0-live-reproduction.md) — exact released-binary evidence for the stale focused view, destructive timer, and false disk-change action.
- [research/phase-0-decision.md](./research/phase-0-decision.md) — approved D1–D12 implementation contract, retry/hash values, and recovery semantics.
- [research/phase0-sync-model.test.ts](./research/phase0-sync-model.test.ts) — executable legacy-failure and proposed-invariant model (7/7 pass).
- [research/phase-1-live-smoke.md](./research/phase-1-live-smoke.md) — focused Markdown/CSV/multi-view/conflict/Undo evidence and the explicit release-candidate manual matrix.

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
| 2026-08-24 | Prepare the D1–D12 Phase 0 contract candidate | Official VS Code, TipTap, ProseMirror, Node, and conditional-write practices support per-URI ownership, exact view receipts, strong disk validators, three-way conflicts, and bounded retries; live timing/Undo evidence and Jarmo approval remain. |
| 2026-08-24 | Confirm the three legacy failures on the exact v1.9.0 standalone build | Focused and blurred views stayed stale, local-only typing activated the disk-change action with unchanged disk bytes, and the timer replaced model work while stale rendered content concealed the loss. |
| 2026-08-24 | Jarmo approved D1–D12 as the Sprint 115 implementation contract | Product-code work may proceed on the dedicated branch; failed hard acceptance rules return as named exceptions rather than silently weakening the contract. |
| 2026-08-24 | Keep-local uses exact-validator recheck, public filesystem write, byte verification, and same-content VS Code revert | `TextDocument.save()` correctly rejects the stale etag after a true conflict; the selected path refreshes the model's clean/etag state while retaining the existing Undo history. |
| 2026-08-24 | Treat residual theme/accessibility, forced live receipt-loss, rename/delete/save-as, multi-root, large-file, and exact agent-runtime repetitions as release-candidate QA | Focused implementation invariants, generic external writes, Markdown/CSV, multi-view, conflict safety, both recovery paths, and repository gates are sprint evidence; the broader platform/UI matrix remains explicitly visible rather than being overclaimed. |
| 2026-08-25 | Admin-merge reviewed Sprint 115 through protected `main` | Jarmo explicitly authorized the override after post-review stale-edit/keep-local hardening and the 26/26 focused, compile, typecheck, build, and repository QA gates passed; PR #222 merged as `b889dcd` and closed #221. |

## Planning Approval

- [x] Jarmo approves Sprint 115 scope, release-blocker status, and delivery placement (2026-08-24).
- [x] Jarmo approves branch/worktree creation (2026-08-24).
- [x] GitHub issue [#221](https://github.com/ProductoryHQ/ritemark-native/issues/221) created, assigned to milestone v1.10.0, and linked here.
- [x] Phase 0 revision/conflict/UX decisions approved before implementation (2026-08-24).
