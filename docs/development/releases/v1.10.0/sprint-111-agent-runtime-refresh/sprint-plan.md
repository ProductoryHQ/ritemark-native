# Sprint 111 — Agent Runtime Refresh

**Track:** Full SDD, audit-first<br>
**Status:** Planned; kickoff and Phase 0 approval pending<br>
**Branch after approval:** `codex/sprint-111-agent-runtime-refresh`<br>
**Worktree:** Not created<br>
**Issue:** [#207](https://github.com/ProductoryHQ/ritemark-native/issues/207)<br>
**Release:** [v1.10.0](../release-plan.md)

## Goal

Ship one reproducible, compatibility-tested v1.10.0 baseline for bundled Claude, Codex, and OpenCode runtimes and their SDK edges before building new effort controls on top.

## Why this is a separate sprint

Runtime refresh is a supply-chain, protocol, and packaging change. Combining it with Composer UI would make a failure ambiguous: the runtime could be broken, the effort mapping could be wrong, or the UI could be sending the wrong contract. Sprint 111 retires the external-version risk first; Sprint 112 then adds one user-facing feature against final pins.

## Target snapshot

| Component | Current | Sprint target | Source |
|---|---:|---:|---|
| Codex app-server | 0.144.4 | 0.149.0 | OpenAI GitHub release |
| Claude Code binary | 2.1.217 | 2.1.239 | Anthropic GitHub/npm artifact |
| Claude Agent SDK | 0.3.217 | 0.3.239 | Anthropic npm package |
| OpenCode binary | 1.18.4 | 1.18.21 | anomalyco GitHub/npm artifact |
| ACP TypeScript SDK | 0.22.1 | 1.4.0 | ACP npm package |

These are exact planning pins captured 2026-08-22. Any target change requires a dated Phase 0 decision and refreshed evidence.

## In Scope

- Official-source and license audit for every target.
- Exact binary manifest URLs, checksums, archive layouts, versions, and architecture patterns.
- Claude binary/SDK lockstep update and parity enforcement.
- ACP 1.x major-version compatibility audit and contained adapter migration.
- Codex app-server protocol diff and focused conformance fixes.
- macOS arm64/x64 and Windows x64 fetch, startup, behavior, and packaging verification.
- Existing runtime, policy, concurrency, cancellation, browser, and continuation regression matrices.
- Architecture, runtime README/notices, changelog, release notes, and test evidence.

## Explicitly Out of Scope

- Composer thinking effort, its persistence, and effort runtime mappings (Sprint 112).
- New runtimes, model catalog redesign, remote runtime updates, or runtime marketplace.
- Conversation schema/UI changes beyond diagnostics required by a measured compatibility issue.
- Changing user permission semantics or making unsupported capability claims.

## Deliverables

1. Approved runtime-version audit and target decision.
2. Updated exact manifest and SDK dependency pins.
3. Measured protocol adapter changes and contract fixtures.
4. Native-platform artifact and behavioral evidence.
5. Revalidated Sprint 110 continuation matrix.
6. Updated architecture, notices, release docs, and rollback record.

## Success Criteria

- [ ] Every target version and platform artifact is exact, checksummed, licensed, and reproducible.
- [ ] Claude Code and Agent SDK cannot drift.
- [ ] Codex and ACP protocol changes are measured and pinned by tests.
- [ ] All existing Agent Chat runtime behaviors and two-conversation isolation pass.
- [ ] Sprint 110 continuation truth is revalidated on final runtime versions.
- [ ] One runtime failure does not damage others or durable conversation history.
- [ ] Native-platform and packaging evidence exists for darwin-arm64, darwin-x64, and win32-x64.
- [ ] Architecture, changelog, release notes, tracker, and issue are current.

## Dependencies and Gates

- Sprint 109 and Sprint 110 must be merged or explicitly reordered by a dated release decision before the branch is created.
- Jarmo approves kickoff and the dedicated feature branch before product-code edits.
- Phase 0 ends with a second explicit Jarmo pin/protocol decision before dependency or manifest changes.
- Sprint 112 depends on Sprint 111 merge and consumes its capability evidence.

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| ACP 0.x→1.x breaks client APIs | High | Temporary audit harness; contain changes in `src/acp/`; stop at decision gate if behavior cannot be preserved. |
| Runtime update invalidates continuation findings | High | Rerun the full Sprint 110 matrix on final pins. |
| Wrong platform/archive/checksum ships | High | Exact manifest, verify-before-extract, native CI evidence, packaging hard checks. |
| Claude SDK and binary drift | High | Exact lockstep pins and automated parity failure. |
| Upstream protocol adds fields | Medium | Tolerate optional fields, hard-fail changed required fields with contract fixtures. |
| New patch appears during sprint | Medium | Keep approved exact snapshot; change only through dated re-audit. |

## SDD Artifacts

- [spec.md](./spec.md) — behavior and supply-chain contract.
- [scenarios.md](./scenarios.md) — manual/automated QA matrix.
- [technical-plan.md](./technical-plan.md) — implementation and verification design.
- [tasks.md](./tasks.md) — phase checklist.
- [research/runtime-version-audit.md](./research/runtime-version-audit.md) — Phase 0 evidence template.

## Product Decisions

| Date | Decision | Rationale |
|---|---|---|
| 2026-08-22 | Add runtime refresh as a new v1.10.0 sprint rather than expanding 109/110 | Keeps conversation durability/continuation scope stable and makes runtime regressions independently attributable. |
| 2026-08-22 | Run refresh before Composer effort | Effort capability and mapping must be measured against the versions that ship. |
| 2026-08-22 | Include ACP SDK 1.4.0 in the audit | OpenCode binary and ACP client are one compatibility boundary. |
| 2026-08-22 | Exact snapshot, no floating latest | Reproducible release artifacts and deterministic rollback. |

## Planning Approval

- [ ] Jarmo approves Sprint 111 scope and ordering.
- [ ] Jarmo approves branch creation.
- [ ] Phase 0 target/protocol decision approved.
- [x] GitHub issue #207 created and assigned to milestone v1.10.0.
