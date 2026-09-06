# Sprint 110 — Agent Conversation Resume

**Status:** Complete — product-approved by Jarmo and merged through [PR #211](https://github.com/ProductoryHQ/ritemark-native/pull/211) as `64cfd8a` on 2026-08-23; implementation, R9 lightweight handoff revision, live Claude → Codex smoke, independent review, official QA, and release screenshots complete<br>
**Parent release:** [v1.10.0 Durable Agent Conversations](../release-plan.md)<br>
**GitHub milestone:** [v1.10.0](https://github.com/ProductoryHQ/ritemark-native/milestone/8)<br>
**Issue:** [#204 — Sprint 110: Resume Agent Conversations with truthful context](https://github.com/ProductoryHQ/ritemark-native/issues/204)<br>
**Track:** Full SDD — external runtime protocols, shared interface, cross-runtime UX<br>
**Branch:** `codex/sprint-110-agent-conversation-resume` — created from `origin/main` at Sprint 109 merge `e2a0f70` on 2026-08-23<br>
**Worktree:** `.worktrees/sprint-110-agent-conversation-resume` — dedicated worktree; isolated audit fixture/evidence only until Phase 1 approval<br>
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
- Immediate cross-runtime selection with a send-lazy inline context boundary.
- Truthful continuation/unavailable UX.
- Continuation-aware integration with Sprint 109’s permanent automatic-working-set + Pinned conversation rail and All conversations list.
- Cross-runtime resilience matrix, architecture/user docs, release notes, and release canary.

## Explicitly Out of Scope

- Universal invisible memory or executable history replay.
- Resuming work that was running when the app process exited.
- Tool/approval/plan/progress/attachment-binary replay.
- Cloud sync, collaboration, semantic memory/RAG, tags/folders, export/share.
- Conversation search, All-project browsing, runtime/continuation-state filters, archive, and trash. Rename already shipped in Sprint 109.
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

- [x] Every runtime has a pinned measured native/fallback decision.
- [x] Same-runtime native resume retains real context where supported.
- [x] Unsupported/expired/invalid/auth-loss paths preserve history and take a tested honest fallback/unavailable route.
- [x] Fallback is deterministic, bounded, disclosed, and excludes executable/provider-specific artifacts.
- [x] Cross-runtime continuation happens only after deliberate runtime selection plus the next Send and never transfers opaque IDs.
- [x] A durably saved user prompt that received no final answer survives runtime failure/switch as explicitly labelled canonical context, while the new handoff prompt is sent exactly once.
- [x] Opening/selecting is runtime/auth/network-lazy; the newly accepted prompt is persisted before negotiation but sent exactly once outside fallback context.
- [x] Per-runtime coverage watermarks deliver only uncovered canonical delta and handle ambiguous crash without silent duplication.
- [x] Two concurrent conversations and late events remain isolated.
- [x] The permanent conversation rail remains selection-only and current-project-scoped; resume/fallback state never creates duplicate rail/history entries, corrupts automatic membership, or changes Pin state implicitly.
- [x] No UI copy overclaims exact memory.
- [x] Architecture Gate, Sprint 110 QA matrix plus explicit release deferrals, user docs, release notes/checklist, canary, and issue tracker are complete.

## Dependencies and Blockers

- Sprint 109 merged through [PR #209](https://github.com/ProductoryHQ/ritemark-native/pull/209) plus final rail polish [PR #210](https://github.com/ProductoryHQ/ritemark-native/pull/210); final main merge `e521c53` is incorporated into the Sprint 110 branch.
- Ordering gate: Sprint 109 merge ✓ → dedicated non-`main` branch/worktree ✓ → Jarmo Sprint 110 SDD/Phase 0 approval → Phase 0 live audit → Jarmo Phase 0 decision approval → Phase 1.
- Phase 0 auth/access for live Claude and Codex; OpenCode native scope is conditional on configured provider and advertised capabilities.
- External protocols may expire/invalidate state across binary upgrades; fallback is required release functionality, not an edge-only backup.

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Native API appears available but bundled runtime behaves differently | High | Live pinned audit; per-adapter fallback-only decision. |
| UI transcript duplicates native history | High | Canonical Ritemark transcript; stable turn reconciliation; native history never overwrites silently. |
| Wrong session bound to a conversation | High | Tagged descriptors, scope/version validation, binding generation, two-chat tests. |
| Fallback prompt too large or misleading | High | Deterministic budget, artifact allowlist, truncation disclosure, workspace-recheck instruction. |
| Runtime switch implies shared memory | Medium | Immediate but send-lazy selection plus one quiet durable boundary between turns. |
| Runtime failure leaves the user's last request invisible to the next agent | High | Treat every durably saved user prompt as canonical context even without a matching final answer; audit dispatch certainty and label the request as unanswered rather than silently dropping or replaying it. |
| Crash after provider accepts delta but before watermark save | High | Reconcile with provider evidence or invalidate descriptor and use fresh fallback; never silently resend ambiguous delta. |

## Product Decisions

| Date | Decision | Consequence |
|---|---|---|
| 2026-08-21 | Native same-runtime resume is preferred but must be proven per pinned runtime | Adapter scope can reduce to fallback without false claims. |
| 2026-08-21 | Fallback includes user prompts + assistant final text only | Tools, approvals, plans, progress, and binaries are not replayed. |
| 2026-08-21 | Cross-runtime continuation is explicit | Runtime selector becomes Continue with … on non-empty conversations. |
| 2026-08-23 | Runtime selection itself is sufficient intent (R9, revises the earlier confirmation decision) | Remove the overblown handoff dialog, preserve the draft, keep Send lazy, and disclose transcript fallback as one quiet durable line between turns. |
| 2026-08-23 | Unanswered user prompts survive runtime failure and handoff | A saved prompt without a final assistant answer remains in normalized context and is labelled unanswered; it is context for the new agent, not an executable replay. |
| 2026-08-23 | Jarmo approved Sprint 110 SDD and Phase 0 start | Run the pinned live audit and return a measured native/fallback matrix before any continuation production code is implemented. |
| 2026-08-23 | Claude, Codex, and OpenCode passed native semantic resume plus two-conversation isolation on exact pinned versions | All three are `native-resume-with-limits`; exact compatibility and deterministic fallback remain mandatory. |
| 2026-08-23 | ACP production path is `session/resume`, never `session/load` | Live `session/load` replayed provider history and would risk duplicate canonical transcript/UI events. |
| 2026-08-23 | Context pack is capped at 32,000 UTF-8 bytes and 12,000 bytes per selected message | Deterministic purpose/latest-unanswered/recent-turn retention; no summarization-model call. |
| 2026-08-23 | Coverage advances only with an atomically saved assistant final | Accepted or ambiguous no-final crash invalidates only that runtime descriptor and takes fresh fallback. |
| 2026-08-23 | Dispatch certainty is append-only and pessimistic | Persist `not-sent`, then `ambiguous` before transport, then `accepted` only on positive provider signal; unknown never upgrades optimistically. |
| 2026-08-23 | Jarmo approved the final Sprint 110 behavior and release evidence | Product scope is closed; delivery remains a separate commit/PR/merge step. |
| 2026-08-21 | Provider IDs stay host-only | Webview receives status and safe metadata, not authority. |
| 2026-08-21 | Per-runtime descriptors carry transcript coverage watermark | Native resume/handoff injects only uncovered canonical delta. |
| 2026-08-22 | Keep the conversation rail permanent through Sprint 110 | Automatic active/recent membership is derived and Pinned is explicit permanence, while All conversations remains durable truth; continuation must preserve all three distinctions. |
| 2026-08-21 | Search/All-project/filter library features are deferred; Rename is inherited from Sprint 109 | Keeps the external-protocol sprint on the release-critical continuation path without contradicting delivered history behavior. |

## Architecture Gate

- Changes the shared `AgentRuntime`/`RuntimeSessionConfig` contract and provider protocol clients.
- Extends the conversation store schema and typed webview↔host status contract.
- Preserves three runtimes, shared approval gate, model catalog, and sandbox boundary.
- Requires `docs/development/architecture.md` update before close.

## Approval Gate

- [x] Sprint 109 merged and its final store/UI contract accepted through PRs #209 and #210 (2026-08-23).
- [x] Jarmo approves R1–R8 and audit-first scope (2026-08-23).
- [x] Sprint 110 issue [#204](https://github.com/ProductoryHQ/ritemark-native/issues/204) exists under milestone v1.10.0.
- [x] Branch `codex/sprint-110-agent-conversation-resume` and its dedicated worktree exist from merged `origin/main` (2026-08-23).
- [x] Phase 0 runtime/context/watermark decisions are recorded in every SDD artifact and explicitly approved by Jarmo before Phase 1 (2026-08-23).
- [x] Jarmo approves the final R9 handoff behavior and Sprint 110 product closure (2026-08-23).
- [x] Independent PR review finds no P0/P1/P2 blockers and PR #211 is ready to merge (2026-08-23).
- [x] PR #211 merged to `main` as `64cfd8a` and issue #204 closed (2026-08-23).

## Implementation Evidence

- Shared continuation contract: `src/runtime/continuation.ts`, `src/runtime/AgentRuntime.ts`.
- Durable descriptor/receipt/watermark state: `src/conversations/types.ts`, `ConversationStore.ts`, `ConversationController.ts`.
- Deterministic fallback: `src/conversations/contextPack.ts` (32,000 bytes total; 12,000-byte per-message ceiling).
- Native adapters: Claude SDK resume, Codex `thread/resume`, capability-gated ACP `session/resume`; ACP `session/load` is absent by design.
- Handoff UX: immediate draft-safe runtime selection plus host-owned context construction and one durable transcript boundary, persisted synchronously with the first accepted cross-runtime turn and mirrored optimistically in the live webview; the overblown confirmation dialog and old banner/preambles were removed.
- Automated evidence: extension compile, webview typecheck/build, focused continuation/runtime/webview tests, complete conversation suite, and broad npm suite through the repository's pre-existing missing-`vscode` integration-test environment boundary.
- Live evidence: [research/rundev-visual-evidence.md](./research/rundev-visual-evidence.md) records fresh-profile cutover, explicit handoff, semantic transcript recall, desktop restart, three defects found/fixed, and the remaining unexercised matrix.
- Final review also closed the bounded-import edge: 205 legacy records migrate as `100 / 100 / 5`, and a wholly invalid non-empty inventory cannot advance host authority.
