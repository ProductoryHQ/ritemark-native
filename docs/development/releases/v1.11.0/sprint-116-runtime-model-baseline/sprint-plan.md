# Sprint 116 — Runtime and Model Baseline

**Track:** Audit-first SDD<br>
**Status:** Draft — prepared, not approved, no branch created<br>
**Branch after approval:** `sprint-116-runtime-model-baseline`<br>
**Issue:** Pending release mapping<br>
**Release:** [v1.11.0](../release-plan.md)

## Goal

Establish one exact, reproducible runtime and model baseline for v1.11.0 before later sprints exercise agent work against it.

## Why this is first

Runtime and catalog drift can make later failures ambiguous. Sprint 116 isolates supply-chain, protocol, model-identity, continuation, and effort compatibility before comment tasks, recording, or Google Docs work starts.

## Release Outcome

After Sprint 116, every bundled runtime component and every curated model shown by Ritemark is backed by a dated, reproducible source of truth. Later v1.11 sprints run against one frozen baseline rather than a moving provider target, and rollback means restoring an exact known-good snapshot rather than guessing versions.

## SDD Artifacts

- [spec.md](./spec.md) — behavior and supply-chain contract R1–R8.
- [scenarios.md](./scenarios.md) — BDD and native-platform verification matrix.
- [technical-plan.md](./technical-plan.md) — architecture and workstreams W0–W6.
- [tasks.md](./tasks.md) — phase checklist and approval gates.
- [research/current-state-audit.md](./research/current-state-audit.md) — present pins, validators, and known gaps.
- `research/runtime-model-audit.md` — Phase 0 evidence artifact to be completed after kickoff.

## Scope

- Audit the latest official Claude Code, Claude Agent SDK, Codex app-server/code-mode-host, OpenCode, and ACP SDK releases at Phase 0 start.
- Select exact pins only from measured artifacts; preserve Claude binary/SDK lockstep.
- Verify all required darwin-arm64, darwin-x64, and win32-x64 runtime components, archive layouts, checksums, licenses, and startup behavior.
- Refresh the bundled model catalog and the authoritative identifiers/defaults in `src/ai/modelConfig.ts` from live provider evidence.
- Re-run the Sprint 110 continuation and Sprint 112 thinking-effort matrices against the final pins.
- Re-check provider isolation, cancellation, approvals, browser-tool injection, and durable conversation behavior.
- Update packaging evidence, notices, architecture, changelog, and v1.11.0 release notes where the measured changes are user-visible.

## Deliverables

1. Dated Phase 0 runtime and model audit with current, candidate, and recommended exact pins.
2. Jarmo-approved pin/protocol decision before dependency, lockfile, manifest, or adapter changes.
3. Reproducible runtime manifest and lockstep SDK dependencies.
4. Curated model-catalog refresh with provider evidence and stable fallbacks.
5. Cross-platform runtime artifact/startup evidence and compatibility matrices.
6. Rollback record identifying the last known-good pins.

## Definition of Done

- [ ] Every shipped runtime component is exact, checksummed, licensed, and reproducible on all supported release platforms.
- [ ] Claude binary and SDK parity is automatically enforced.
- [ ] All model IDs remain centralized in `src/ai/modelConfig.ts`; no sprint code hardcodes an identifier elsewhere.
- [ ] Catalog aliases resolve to one canonical identity and offline fallback remains usable.
- [ ] Continuation, effort, approval, cancellation, provider-isolation, and browser-tool matrices pass on final pins.
- [ ] Extension bundle and native runtime packaging checks pass.
- [ ] Architecture, changelog/release-note disposition, sprint tracker, issue, and PR evidence are current.
- [ ] Repository QA passes before readiness handoff.

## Dependencies and Gates

- v1.11.0 release scope must be approved and mapped before sprint kickoff.
- Jarmo must separately approve this sprint; create the branch immediately after approval and before any product-code edit.
- Phase 0 is audit-only. A second explicit decision is required before changing manifests, dependencies, lockfiles, model config, or adapters.
- Sprint 117 should validate against the merged Sprint 116 baseline. Sprints 118 and 119 do not technically depend on it, but the release plan keeps 116 first to minimize moving inputs.

## Feature Flag Decision

No new flag is planned. This sprint refreshes existing runtime and catalog behavior; rollback is through exact pins and manifest evidence, not a parallel runtime path.

## Requirement Traceability

| Requirement | Outcome | Workstream |
|---|---|---|
| R1 | One approved exact snapshot | W0–W1 |
| R2 | Complete reproducible runtime supply chain | W1 |
| R3 | Compatible SDK/protocol edges | W2 |
| R4 | Truthful canonical model catalog | W3 |
| R5 | Preserved user/runtime behavior | W4 |
| R6 | Native target evidence | W5 |
| R7 | Deterministic rollback and rollout | W1, W5 |
| R8 | QA, architecture, and release close | W6 |

## Product Decisions

| Date | Decision | Consequence |
|---|---|---|
| 2026-09-07 | Runtime and model refresh is a separate first sprint | Later v1.11 features validate against final inputs and failures stay attributable. |
| 2026-09-13 | Use full audit-first SDD rather than a dependency-only bump | Exact artifacts, model identities, live behavior, and rollback all require evidence. |
| 2026-09-13 | No new feature flag | Exact pins plus a documented rollback snapshot are the control mechanism. |

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| A current runtime changes protocol behavior | High | Measure official binaries first; pin exact versions; add contract fixtures only for observed changes. |
| A model alias produces duplicate or misleading picker entries | High | Canonical identity tests plus authenticated provider resolution. |
| One platform archive differs from the others | High | Verify every required component natively and fail manifest completeness. |
| Runtime refresh changes continuation or effort semantics | High | Re-run both existing behavior matrices before approval. |
| Live provider data changes during the sprint | Medium | Date the snapshot; freeze approved pins/catalog inputs; record later changes for another decision. |

## Out of Scope

- New runtime kinds, runtime marketplace, or floating `latest` dependencies.
- New Composer controls or new effort levels.
- Comment dispatch changes, Transcribe recording, or Google Docs integration.
- Broad model-catalog architecture redesign beyond evidence-backed refreshes.

## Planning Approval

- [ ] Jarmo approves scope and ordering.
- [ ] GitHub issue is created and linked to milestone `v1.11.0`.
- [ ] Dedicated branch is created after approval.
- [ ] Phase 0 recommendation receives the separate pin/protocol decision.
