# Sprint 116 — Runtime and Model Baseline

**Track:** Audit-first SDD<br>
**Status:** Implementation complete; issue #286 and PR #287 are the lifecycle records. Clean Ritemark RUNDEV, authenticated three-runtime document smoke, and local QA pass. Full behavior matrices and native Intel/Windows evidence are deferred to v1.11 release gates by the release owner.<br>
**Branch:** `codex/sprint-116-runtime-model-baseline`<br>
**Worktree:** `.worktrees/sprint-116-runtime-model-baseline`<br>
**Issue:** [#286 — Sprint 116: Runtime and model baseline](https://github.com/ProductoryHQ/ritemark-native/issues/286)<br>
**PR:** [#287 — Runtime: refresh v1.11 agent and model baseline](https://github.com/ProductoryHQ/ritemark-native/pull/287)<br>
**Milestone:** [v1.11.0](https://github.com/ProductoryHQ/ritemark-native/milestone/11)<br>
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
- [research/runtime-model-audit.md](./research/runtime-model-audit.md) — dated Phase 0 evidence, reproduced defects and remaining verification gaps.
- [research/phase-0-recommendation.md](./research/phase-0-recommendation.md) — approved exact pins, bounded fixes and catalog/default policy.
- [research/rundev-smoke.md](./research/rundev-smoke.md) — accepted Ritemark shell launch, per-runtime UI canaries, and starred-scenario disposition.

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

- [x] Every shipped runtime component is exact, checksummed, licensed, and reproducible on all supported release platforms.
- [x] Claude binary and SDK parity is automatically enforced.
- [x] All model IDs remain centralized in `src/ai/modelConfig.ts`; static validation rejects production duplicates elsewhere.
- [x] Catalog aliases resolve to one canonical identity and the dated bundled floor remains usable offline.
- [ ] Continuation, effort, approval, cancellation, provider-isolation, and browser-tool matrices pass on final pins.
- [x] Extension target-copy, runtime-tree expansion, archive/hash/architecture, and local Apple Silicon packaging checks pass; native Intel/Windows execution is explicitly deferred to the v1.11 release gates.
- [x] Architecture, changelog/release-note disposition, sprint tracker, issue, and PR evidence are current.
- [x] Repository QA passes before readiness handoff; see [qa-validation.md](./research/qa-validation.md).

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
| 2026-09-13 | Jarmo approved Sprint 116 scope and instructed work to start | Audit-only Phase 0 started in its dedicated branch/worktree. This does not approve a candidate pin set or the scope of Sprints 117–119. |
| 2026-09-13 | Candidate artifacts and selected live behavior audited | All 14 archives passed, Apple Silicon startup and candidate SDK compile passed; three existing defects reproduced. Direct API/BYOK, complete behavior matrices and final pin decision remain open. |
| 2026-09-13 | Jarmo approved the exact Phase 0 package and bounded fixes | Implementation pins 12 source rows producing 25 installed files; approved adapter and catalog changes may proceed. |
| 2026-09-13 | Final Apple Silicon runtime and Codex cancellation checks passed | All target archives and installed hashes passed cross-inspection; native arm64 startup passed, and immediate Stop + resend passed on the final Codex adapter. |
| 2026-09-13 | Local repository QA passed | The full QA gate, VS Code native TypeScript, extension compile, runtime/lifecycle/Flow/security tests, and schema-v3 packaging fixtures pass after installing worktree-local dependencies. |
| 2026-09-14 | Clean Ritemark RUNDEV and all three document turns passed | A clean compile produced the Ritemark shell. Claude completed a question/file-edit turn; Codex passed exact response, file-tool, Stop, and resend canaries; OpenCode/Gemini completed a file edit after its ACP `end_turn` status was normalized from a false visible `Failed` to `Done`. |
| 2026-09-14 | Jarmo authorized Sprint 116 publication and merge after green checks | GitHub issue #286 was created under milestone `v1.11.0`, and PR #287 was opened for review and native CI. |
| 2026-09-14 | Native Intel/Windows CI does not block today's implementation merge | Jarmo confirmed that no installer build is being produced now. Local repository QA, archive cross-inspection, Apple Silicon startup, and authenticated three-runtime RUNDEV are the merge evidence; native execution remains a v1.11 release gate. |

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

- [x] Jarmo approves Sprint 116 scope and first-sprint kickoff (2026-09-13).
- [x] GitHub issue [#286](https://github.com/ProductoryHQ/ritemark-native/issues/286) is created and linked to milestone `v1.11.0`.
- [x] Dedicated branch/worktree created at Jarmo's request; audit begins after scope approval.
- [x] Phase 0 recommendation received the separate pin/protocol/catalog decision from Jarmo (2026-09-13).
