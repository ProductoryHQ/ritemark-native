# Sprint 127 Tasks

Implementation checklist for [technical-plan.md](./technical-plan.md). Tick `[x]` only when the named artifact or evidence exists on the sprint branch. No product code before Jarmo approves [sprint-plan.md](./sprint-plan.md).

## Research (done before planning)

- [x] Trace the AS IS chain and reproduce the gap with the unchanged resolver — [research/model-visibility-audit.md](./research/model-visibility-audit.md), [evidence/resolver-repro.txt](./research/evidence/resolver-repro.txt).
- [x] Measure which CLI versions know Opus 5.5 and what 2.1.270 does with an unknown id — [evidence/cli-model-identity-scan.json](./research/evidence/cli-model-identity-scan.json), [evidence/request-capture.json](./research/evidence/request-capture.json).
- [x] Prove `settings.modelPicker` injection on 2.1.270 (listed, deduped, unvalidated ids) — [evidence/supported-models-probes.json](./research/evidence/supported-models-probes.json).
- [x] Jarmo decisions D1–D3 recorded (2026-09-24).

## Phase 0: Audit and approval gate (W0)

- [ ] **Jarmo approves this sprint plan** (Phase 2→3 gate).
- [ ] Resolve open questions Q1–Q4 in [spec.md](./spec.md) (publisher location and access, credentials, release vehicle, branch).
- [ ] Create branch `sprint-127-day-zero-models`; verify with `git branch --show-current`.
- [ ] A1: Pro and Max subscriptions, CLI 2.1.270, an injected row → listed, runs, init matches, a long session compacts sanely.
- [ ] A2: capture the error shapes for a model the account cannot use (plan, `availableModels`).
- [ ] A3: measure the effect of `CLAUDE_CODE_MAX_CONTEXT_TOKENS` on an unknown model's assumed window; decide on `claudeCode.contextWindow`.
- [ ] A4: managed-settings `modelPicker` outranks the SDK layer.
- [ ] A5: injection on darwin-x64 and win32-x64.
- [ ] A7: note any `[servedCatalog]` primary-mode behavior seen on the test accounts.
- [ ] Write `research/phase-0-audit.md`; apply the scope-change protocol if any result changes a requirement.

## Phase 1: Feed bootstrap and publisher (W7 — R4, R7)

- [ ] `extensions/ritemark/scripts/export-bundled-model-catalog.ts` prints the bundled catalog as feed JSON.
- [ ] `ritemark-public`: commit the complete current lineup as `feeds/model-catalog.json` (every provider), plus `feeds/model-catalog.config.json` with the watermark set to the newest bundled Claude model.
- [ ] `ritemark-public/scripts/model-catalog/candidates.mjs` + tests (S18, S19).
- [ ] `ritemark-public/scripts/model-catalog/rows.mjs` + tests (label, tier, order, effort, `claudeCode`, `minAppVersion`); fixture shared with W1.
- [ ] `ritemark-public/scripts/model-catalog/canary.mjs` + dry-run test; integrity check of the packed CLI and SDK.
- [ ] `ritemark-public/scripts/model-catalog/validate.mjs` (schema, size cap, additions-only diff) + tests (S21).
- [ ] `ritemark-public/scripts/model-catalog/autopublish.mjs` (kill switch S20, cooldown, commit message).
- [ ] `ritemark-public/.github/workflows/model-catalog-autopublish.yml` (schedule, dispatch, concurrency, permissions, pinned actions) — S22, S23.
- [ ] Jarmo: `MODEL_CATALOG_ANTHROPIC_API_KEY` (dedicated workspace, spend cap) and `MODEL_CATALOG_AUTOPUBLISH=on`.
- [ ] First live run detects, canaries and publishes Opus 5.5 — commit link and timing recorded (S16).
- [ ] `ritemark-public/README.md` "Model catalog feed" section.

## Phase 2: Feed contract and static merge (W1, W2 — R3, R7)

- [ ] `schema.ts`: `provenance`, `addedAt`, `retired`, `claudeCode`; anthropic id pattern; validation tests including the shared fixture (S30).
- [ ] `resolver.ts`: `mergeStatic()` per the technical plan; `liveKind` on `ResolvedProvider`.
- [ ] Resolver tests: S10, S11, S12, S13, S14, S15; existing fixtures pass.

## Phase 3: Runtime declarations (W3 — R1, R7)

- [ ] `src/ai/modelCatalog/runtimeDeclarations.ts` + `runtimeDeclarations.test.ts` (auto vs curated `behavesAs` S31, retired, invalid id, `[1m]` shadowing S3).
- [ ] `index.ts`: `getClaudeRuntimeDeclarations()`; empty when `remote-model-catalog` is off (S32).
- [ ] `agent/discoverModels.ts` + `providerDiscovery.ts`: pass `settings.modelPicker`; drop shadowed declarations.
- [ ] `agent/types.ts`, `AgentRunner.ts` (persistent + one-shot), `ClaudeCodeRuntime.ts`: `claudeDeclarations` → `settings` + env merge; `AgentRunner.test.ts` covers option assembly.
- [ ] `UnifiedViewProvider.ts`: fill declarations for the chosen model; `ClaudeCodeNodeExecutor.ts` and the title generator: pass them for one-shot runs.

## Phase 4: Credential alignment and provider capabilities (W4 — R2)

- [ ] `extension.ts`: `/v1/models` only when `authMethod === 'api-key'` (S7).
- [ ] `providerDiscovery.ts`: `capabilities.effort` → `thinkingEffort`; fixture test (S8).

## Phase 5: Immediate pickup (W5 — R5)

- [ ] `remoteSource.ts`: ETag storage, `If-None-Match`, `{ catalog, changed }`; tests for 304 and unchanged declarations (S25).
- [ ] `index.ts`: `pollFeed()` every 10 minutes, `pollFeedIfStale()`, `refreshDiscovery()` on a declaration signature change; `refresh()` kept for existing callers.
- [ ] `UnifiedViewProvider.ts`: `pollFeedIfStale()` in the visibility handler (S27).

## Phase 6: Honest substitution and model errors (W6 — R6)

- [ ] `modelCatalog.resolveRequestedModel()`; `_reconciledClaudeModel()` and `agent-execute` emit the `init` substitution line (S28).
- [ ] `runtimeErrorPresentation.ts`: `model_unavailable` class from A2 shapes + tests (S29).

## Phase 7: Documentation, QA and closeout (W8 — R8)

- [ ] `docs/development/architecture.md`: Model Catalog TO BE → AS IS, changelog row, Sprint 89 memo addendum (S34).
- [ ] `.claude/skills/release/SKILL.md`: canary-version and feed-lineup steps.
- [ ] `extensions/ritemark/package.json` `test` chain includes the new tests; `npm test` green; `tsc --noEmit` clean.
- [ ] Update the v1.12.0 release plan tracker, `docs/CHANGELOG.md`, and the v1.12.0 release notes draft.
- [ ] Walk every `[x]` against the branch diff (SDD discrepancy check).
- [ ] QA matrix in `qa-evidence.md`. Use a build reporting a version ≥ `autoRowMinAppVersion`; use a release candidate, or a local uncommitted version bump in the QA worktree.
  - [ ] ★ S1, S2 on a Max subscription; S3 with a newer CLI; S4 with a system CLI; S5 with managed settings; S6 without a workspace.
  - [ ] ★ S7, S8; S9.
  - [ ] ★ S10–S12, S14 (unit evidence); S13, S15.
  - [ ] ★ S16, S17, S21 (publisher runs); S18–S20, S22, S23.
  - [ ] ★ S24 timing; S25–S27.
  - [ ] ★ S28, S29.
  - [ ] ★ S30; S31–S33.
- [ ] Recommend `qa-validator` (Phase 4 gate) and `pr-reviewer`; commit and push the sprint branch; open the PR.
