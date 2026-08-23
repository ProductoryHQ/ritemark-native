# Sprint 110 — Agent Conversation Resume

**Status:** SDD artifacts drafted 2026-08-21 — planned after Sprint 109; awaiting Jarmo approval<br>
**Parent release:** [v1.10.0 Durable Agent Conversations](../release-plan.md)<br>
**GitHub milestone:** [v1.10.0](https://github.com/ProductoryHQ/ritemark-native/milestone/8)<br>
**Issue:** [#204 — Sprint 110: Resume Agent Conversations with truthful context](https://github.com/ProductoryHQ/ritemark-native/issues/204)<br>
**Track:** Full SDD — external runtime protocols, shared interface, cross-runtime UX<br>
**Branch:** `codex/sprint-110-agent-conversation-resume` (not created; create after Sprint 109 merge and approval)<br>
**Worktree:** Not created; after Sprint 109 merge and Jarmo kickoff approval, create/verify dedicated branch/worktree before Phase 0<br>
**Delivery tier:** Extension implementation inside a full app release

## Goal

Make a reopened Agent Conversation continue with as much real agent context as the selected runtime can support, while making native resume, transcript fallback, and unavailable context visibly distinct and testable.

## Release Outcome

Together with Sprint 109, users can find a project conversation after restart and continue it without being misled. Same-runtime native context is restored where proven; all other paths use an explicit bounded fallback or explain why continuation is unavailable.

## SDD Artifacts

- [spec.md](./spec.md) — behavior contract R1–R8.
- [scenarios.md](./scenarios.md) — BDD examples and cross-runtime QA matrix.
- [technical-plan.md](./technical-plan.md) — architecture and workstreams W0–W6.
- [tasks.md](./tasks.md) — implementation checklist.
- [research/runtime-continuation-audit.md](./research/runtime-continuation-audit.md) — known capabilities and required Phase 0 proof.

## In Scope

- Pinned live audit for Claude, Codex, and bundled ACP/OpenCode continuation.
- Shared host-owned continuation request/checkpoint/state contract.
- Same-runtime native resume for each adapter that passes the audit.
- Deterministic bounded transcript-context fallback.
- Explicit cross-runtime Continue with … handoff and context boundaries.
- Truthful continuation/unavailable UX.
- Continuation-aware integration with Sprint 109’s permanent automatic-working-set + Pinned conversation rail and All conversations list.
- Cross-runtime resilience matrix, architecture/user docs, release notes, and release canary.

## Explicitly Out of Scope

- Universal invisible memory or executable history replay.
- Resuming work that was running when the app process exited.
- Tool/approval/plan/progress/attachment-binary replay.
- Cloud sync, collaboration, semantic memory/RAG, tags/folders, export/share.
- Conversation search, rename, All-project browsing, runtime/continuation-state filters, archive, and trash.
- Scheduled-task and Flow history sharing.
- Unproven native-resume promises.

## Deliverables

1. Runtime continuation capability/decision matrix with live evidence.
2. Shared continuation descriptor/state contract and host persistence.
3. Proven native resume adapters plus tested fallback-only declarations.
4. Normalized context pack and explicit runtime handoff.
5. Plain-language continuation UX integrated with the permanent conversation rail and canonical All conversations list.
6. Cross-runtime test matrix, architecture/docs, release canary, and v1.10.0 feature-complete evidence.

## Success Criteria

- [ ] Every runtime has a pinned measured native/fallback decision.
- [ ] Same-runtime native resume retains real context where supported.
- [ ] Unsupported/expired/invalid/auth-loss paths preserve history and take a tested honest fallback/unavailable route.
- [ ] Fallback is deterministic, bounded, disclosed, and excludes executable/provider-specific artifacts.
- [ ] Cross-runtime continuation happens only after explicit confirmation and never transfers opaque IDs.
- [ ] Opening/selecting is runtime/auth/network-lazy; the newly accepted prompt is persisted before negotiation but sent exactly once outside fallback context.
- [ ] Per-runtime coverage watermarks deliver only uncovered canonical delta and handle ambiguous crash without silent duplication.
- [ ] Two concurrent conversations and late events remain isolated.
- [ ] The permanent conversation rail remains selection-only and current-project-scoped; resume/fallback state never creates duplicate rail/history entries, corrupts automatic membership, or changes Pin state implicitly.
- [ ] No UI copy overclaims exact memory.
- [ ] Architecture Gate, QA matrix, user docs, release notes/checklist, canary, and issue tracker are complete.

## Dependencies and Blockers

- Sprint 109 merged with stable ConversationStore/project identity/protocol.
- Ordering gate: Sprint 109 merge → Jarmo Sprint 110 kickoff approval → create/verify dedicated non-`main` branch/worktree → Phase 0 audit → Jarmo Phase 0 decision approval → Phase 1.
- Phase 0 auth/access for live Claude and Codex; OpenCode native scope is conditional on configured provider and advertised capabilities.
- External protocols may expire/invalidate state across binary upgrades; fallback is required release functionality, not an edge-only backup.

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Native API appears available but bundled runtime behaves differently | High | Live pinned audit; per-adapter fallback-only decision. |
| UI transcript duplicates native history | High | Canonical Ritemark transcript; stable turn reconciliation; native history never overwrites silently. |
| Wrong session bound to a conversation | High | Tagged descriptors, scope/version validation, binding generation, two-chat tests. |
| Fallback prompt too large or misleading | High | Deterministic budget, artifact allowlist, truncation disclosure, workspace-recheck instruction. |
| Runtime switch implies shared memory | Medium | Explicit Continue with … confirmation and durable boundary. |
| Crash after provider accepts delta but before watermark save | High | Reconcile with provider evidence or invalidate descriptor and use fresh fallback; never silently resend ambiguous delta. |

## Product Decisions

| Date | Decision | Consequence |
|---|---|---|
| 2026-08-21 | Native same-runtime resume is preferred but must be proven per pinned runtime | Adapter scope can reduce to fallback without false claims. |
| 2026-08-21 | Fallback includes user prompts + assistant final text only | Tools, approvals, plans, progress, and binaries are not replayed. |
| 2026-08-21 | Cross-runtime continuation is explicit | Runtime selector becomes Continue with … on non-empty conversations. |
| 2026-08-21 | Provider IDs stay host-only | Webview receives status and safe metadata, not authority. |
| 2026-08-21 | Per-runtime descriptors carry transcript coverage watermark | Native resume/handoff injects only uncovered canonical delta. |
| 2026-08-22 | Keep the conversation rail permanent through Sprint 110 | Automatic active/recent membership is derived and Pinned is explicit permanence, while All conversations remains durable truth; continuation must preserve all three distinctions. |
| 2026-08-21 | Search/rename/All-project/filter library features are deferred | Keeps the external-protocol sprint on the release-critical continuation path. |

## Architecture Gate

- Changes the shared `AgentRuntime`/`RuntimeSessionConfig` contract and provider protocol clients.
- Extends the conversation store schema and typed webview↔host status contract.
- Preserves three runtimes, shared approval gate, model catalog, and sandbox boundary.
- Requires `docs/development/architecture.md` update before close.

## Approval Gate

- [ ] Sprint 109 merged and its store contract accepted.
- [ ] Jarmo approves R1–R8 and audit-first scope.
- [x] Sprint 110 issue [#204](https://github.com/ProductoryHQ/ritemark-native/issues/204) exists under milestone v1.10.0.
- [ ] Branch `codex/sprint-110-agent-conversation-resume` exists before implementation.
- [ ] Phase 0 runtime/context/watermark decisions are recorded in every SDD artifact and explicitly approved by Jarmo before Phase 1.
