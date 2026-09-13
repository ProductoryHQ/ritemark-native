# Sprint 116 Spec — Runtime and Model Baseline

**Parent:** [sprint-plan.md](./sprint-plan.md) · **Release:** [v1.11.0](../release-plan.md) · **Issue:** pending · **Evidence:** [research/current-state-audit.md](./research/current-state-audit.md)

## Purpose

Freeze a current, reproducible v1.11.0 baseline for the three supported agent runtimes and every curated model surface. The sprint changes versions and compatibility code only when Phase 0 evidence proves the candidate set is complete and behaviorally safe.

## Principles

- **Exact beats latest.** Every shipped component and SDK uses an approved exact version.
- **A runtime is a component set.** Codex is not valid without every helper its selected execution modes require.
- **One model identity.** Canonical IDs live in `src/ai/modelConfig.ts`; projections may not invent aliases.
- **Measure before adapting.** Protocol code changes only for observed candidate behavior.
- **Cross-platform means native evidence.** A manifest row alone is not proof that a binary starts on its target.
- **Rollback is designed.** The previous complete snapshot remains documented and restorable.

## Requirements

### R1: Approved exact release snapshot

As the release owner, I want one dated version decision, so the release cannot drift while later sprints are implemented.

Acceptance criteria:
- Phase 0 records current, latest-official, tested-candidate, and recommended versions for Claude Code, Claude Agent SDK, Codex, OpenCode, and ACP SDK.
- Exact pins are approved together; partial runtime updates are rejected unless an explicit deferral records why the old cross-component set remains compatible.
- Candidate changes after approval require a new dated audit and decision.
- No `latest`, caret, tilde, floating URL, unversioned asset, or mutable download endpoint enters release inputs.

### R2: Complete and reproducible runtime supply chain

As a user, I want every selected agent to start from the shipped application, so a nominal runtime update cannot omit a required component.

Acceptance criteria:
- The manifest enumerates the complete component matrix for darwin-arm64, darwin-x64, and win32-x64, including platform-scoped Codex helpers.
- Every row records vendor, version, source URL, archive name/layout, install name, SHA-256, target architecture, invocation validation where applicable, and redistribution evidence.
- Manifest validation fails on a missing/extra component, target gap, cross-component version drift, duplicate install name, wrong architecture expectation, or SDK mismatch.
- Fetch verifies checksums before extraction, refuses archive traversal, and produces only the expected executable names.
- Build and packaging validation prove the selected target contains the same manifest-defined component set.

### R3: SDK and protocol compatibility

As a user, I want upgrades to preserve runtime behavior, so dependency freshness does not silently break approvals, tools, continuation, or cancellation.

Acceptance criteria:
- Claude Code and `@anthropic-ai/claude-agent-sdk` obey the repository lockstep rule and their optional platform packages are exact in the lockfile.
- OpenCode and `@agentclientprotocol/sdk` are tested as one ACP boundary.
- Codex app-server and code-mode-host share an exact version and are exercised through the real JSON-RPC paths Ritemark uses.
- Adapter changes are tied to captured request/response evidence; speculative compatibility branches are not added.
- Unknown optional protocol fields are tolerated while missing/changed required fields fail with bounded, user-visible errors.

### R4: Truthful canonical model catalog

As a user, I want model labels and capabilities to match what providers actually accept, so a picker selection does not lie or fail later.

Acceptance criteria:
- All identifiers originate in `src/ai/modelConfig.ts`; `bundledCatalog.ts` imports or projects canonical values instead of establishing a competing identity.
- OpenAI, Gemini, Claude, Codex, and OpenCode/OpenRouter curated entries are checked against official/provider discovery evidence available at Phase 0.
- Alias spellings that resolve to one model collapse to one canonical picker item.
- Each entry has a truthful label, provider, availability/deprecation state, ordering, tier, and thinking-effort capability where supported.
- `DEFAULT_MODELS` resolves to available non-deprecated entries, with an explicit rationale for assistant, Flow, and provider-specific defaults.
- Offline/cached startup keeps a usable bundled floor without claiming that it is live data.

### R5: Preserved runtime behavior

As a user, I want existing Agent Chat behavior to survive the refresh across all providers.

Acceptance criteria:
- Start, stream, tool use, unified approval, question, plan-first, stop/cancel, failure, auth recovery, and terminal completion are exercised for each applicable runtime.
- One provider being unavailable never hides or disables another ready provider.
- Browser tools remain injected only through `BrowserToolsInjector`; no runtime-specific browser implementation is introduced.
- Conversation callbacks remain scoped by canonical `conversationId`; unknown IDs are dropped.
- Sprint 110 continuation truth and Sprint 112 thinking-effort mappings are re-run on final candidates, including supported, downgraded, and rejected paths.

### R6: Native-platform verification

As the release owner, I want evidence from each supported target, so architecture or loader failures are found before RC packaging.

Acceptance criteria:
- darwin-arm64 candidates are fetched, identified, started, and behavior-tested locally.
- darwin-x64 and win32-x64 candidates run the pinned native CI matrix with artifact identity recorded.
- macOS `file`/Mach-O and Windows PE architecture checks match the manifest.
- Non-invocable IPC helpers are checksum/architecture/completeness verified and are not given fake `--version` smoke tests.
- The final full app release gates still verify bundled runtime bytes inside mounted/signed artifacts; sprint evidence does not replace release gates.

### R7: Deterministic rollout and rollback

As the team, we want a failed candidate to be reversible without reconstructing old state.

Acceptance criteria:
- The audit records the last known-good manifest, dependency pins, lockfile identity, model snapshot, and relevant compatibility tests.
- Rollback changes the coherent set, not one binary in isolation.
- Runtime/model diagnostics expose selected source and version without leaking credentials.
- No migration or durable-data rewrite makes rollback unsafe.

### R8: Architecture, documentation, and regression close

As the team, we want the baseline to remain maintainable after the sprint.

Acceptance criteria:
- Focused manifest, runtime, continuation, thinking-effort, model resolver, picker projection, and bootstrap tests pass.
- `docs/development/architecture.md` records final runtime/component and model-catalog contracts if they changed; its date satisfies the Architecture Gate.
- Runtime README/notices, changelog, v1.11.0 release notes, release tracker, issue, and PR evidence are current.
- Repository QA passes before readiness handoff.

## Non-Requirements

- Adding a fourth runtime or runtime marketplace.
- Floating runtime/model updates after release.
- New thinking-effort UI or permission semantics.
- Replacing remote model discovery/caching architecture unless Phase 0 proves a blocking defect.
- Comment task, Transcribe recording, or Google Docs implementation.

## Phase 0 Questions

1. What exact complete candidate set is available on the audit date?
2. Do any candidates change required protocol fields, helper components, authentication, sandbox, continuation, or effort behavior?
3. Which curated model entries/defaults are stale, aliases, deprecated, unavailable, or missing?
4. Can every candidate be verified on all three release targets before pin approval?
5. What exact prior snapshot and tests form the rollback record?
