# Sprint 127 Tasks

Implementation checklist for [technical-plan.md](./technical-plan.md). Tick `[x]` only when the named artifact or evidence exists on the sprint branch. No product code before Jarmo approves [sprint-plan.md](./sprint-plan.md).

## Research (done before planning)

- [x] Trace the AS IS chain and reproduce the gap with the unchanged resolver — [research/model-visibility-audit.md](./research/model-visibility-audit.md), [evidence/resolver-repro.txt](./research/evidence/resolver-repro.txt).
- [x] Measure which CLI versions know Opus 5.5 and what 2.1.270 does with an unknown id — [evidence/cli-model-identity-scan.json](./research/evidence/cli-model-identity-scan.json), [evidence/request-capture.json](./research/evidence/request-capture.json).
- [x] Prove `settings.modelPicker` injection on 2.1.270 (listed, deduped, unvalidated ids) — [evidence/supported-models-probes.json](./research/evidence/supported-models-probes.json).
- [x] Jarmo decisions D1–D3 recorded (2026-09-24).

## Phase 0: Audit and approval gate (W0)

- [x] **Jarmo approves this sprint plan** (Phase 2→3 gate) — 2026-09-24, "tee sprint ja asap töösse".
- [x] Resolve Q1 and Q4 in [spec.md](./spec.md#resolved-questions) (publisher payload, branch mapping); Q5 deferred. Q2 (credentials) and Q3 (release vehicle) remain open, and neither blocks code.
- [x] Create branch `sprint-127-day-zero-models`; `git branch --show-current` verified 2026-09-24. It is pushed to `claude/anthropic-models-bundled-cli-gtjld9`.
- Audit items A1–A5 and A7 moved to the Phase 7 QA gate on 2026-09-24 (see sprint-plan Product Decisions). They need Jarmo's accounts and machines; any result that changes a requirement goes through the scope-change protocol.

## Phase 1: Feed bootstrap and publisher (W7 — R4, R7)

The publisher is delivered as a payload under [ritemark-public/](./ritemark-public/APPLY.md) (technical-plan W7 revisions). Test command, from the payload root: `node --test 'scripts/model-catalog/*.test.mjs'` (70 tests, 2026-09-24).

- [x] `extensions/ritemark/scripts/export-bundled-model-catalog.ts` prints the bundled catalog as feed JSON. `--merge` keeps automated rows and tombstones (`src/ai/modelCatalog/feedExport.ts` + `feedExport.test.ts`).
- [x] Payload `feeds/model-catalog.json` holds the complete current lineup for every provider (generated 2026-09-24). `feeds/model-catalog.config.json` sets the watermark to the bundled lineup's `updatedAt` (W7 revision).
- [x] `scripts/model-catalog/candidates.mjs` + tests (S18, S19; the watermark holds below pending models).
- [x] `scripts/model-catalog/rows.mjs` + tests (label, tier, order, effort, `claudeCode`, `minAppVersion`). `fixtures/auto-row.fixture.json` is a copy of the W1 fixture.
- [x] `scripts/model-catalog/canary.mjs` + stubbed-SDK tests, with an integrity check of the packed CLI and SDK. `canary-smoke.mjs` ran the real CLI 2.1.270 and 2.1.281 offline: [evidence](./research/evidence/canary-smoke-2026-09-24.json).
- [x] `scripts/model-catalog/validate.mjs` + `schema.mjs` (schema, size cap, config, additions-only diff) + tests (S21, S30, S31).
- [x] `scripts/model-catalog/autopublish.mjs` (kill switch S20, cooldown, commit message, dry run) + tests (S16, S17).
- [x] `.github/workflows/model-catalog-autopublish.yml` (schedule, dispatch, concurrency, permissions, pinned actions) and `model-catalog-tests.yml`, guarded by `workflows.test.mjs` (S22, S23).
- [x] `feeds/README.md` "Model catalog feed" documentation (spec R8 revision).
- [ ] Jarmo: apply the payload to `ritemark-public` ([APPLY.md](./ritemark-public/APPLY.md) steps 1–3, which regenerate the feed so `updatedAt` is current).
- [ ] Jarmo: `MODEL_CATALOG_ANTHROPIC_API_KEY` (dedicated workspace, spend cap), branch rules, then a dry run, then `MODEL_CATALOG_AUTOPUBLISH=on` (APPLY.md steps 4–5).
- [ ] The first live run detects, canaries and publishes Opus 5.5. Record the commit link and timing (S16).
- [ ] A6: record GitHub schedule latency over the first day of runs (queued time vs cron time), and put the honest "immediate" number in `feeds/README.md`.

## Phase 2: Feed contract and static merge (W1, W2 — R3, R7)

- [x] `schema.ts`: `provenance`, `addedAt`, `retired`, `claudeCode`; anthropic id pattern; validation tests including the shared fixture `testdata/auto-row.fixture.json` (S30).
- [x] `resolver.ts`: `mergeStatic()` per the technical plan, plus `resolveStaticModels()`. A tombstone also hides live rows. `liveKind` was dropped (technical-plan revision).
- [x] Resolver tests: S10, S11, S12, S13, S14, S15, S33; all 23 existing fixtures pass unchanged.

## Phase 3: Runtime declarations (W3 — R1, R7)

- [x] `src/ai/modelCatalog/runtimeDeclarations.ts` + `runtimeDeclarations.test.ts` (auto vs curated `behavesAs` S31, retired, invalid id, `[1m]` shadowing S3, feed-poll decision S25).
- [x] `index.ts`: `getClaudeRuntimeDeclarations()` and `getClaudeSessionDeclaration()`; empty when `remote-model-catalog` is off (S32).
- [x] `agent/discoverModels.ts` + `providerDiscovery.ts`: pass `settings.modelPicker`; drop shadowed declarations.
- [x] `agent/types.ts`, `AgentRunner.ts` (persistent + one-shot via `claudeRuntimeOptions()`), `ClaudeCodeRuntime.ts` (rebuild on a changed declaration), `runtime/AgentRuntime.ts`: `claudeModelDeclaration` → `settings` + env merge; `AgentRunner.test.ts` covers option assembly.
- [x] `UnifiedViewProvider.ts`: fill declarations for the chosen model; `ConversationTitleGenerator.ts`: pass them. `ClaudeCodeNodeExecutor.ts` needs no change, because Flows run the catalog default, which is never an automated row.

## Phase 4: Credential alignment and provider capabilities (W4 — R2)

- [x] `extension.ts`: `/v1/models` only when `authMethod === 'api-key'` (S7); declarations passed to the probe.
- [x] `providerDiscovery.ts`: `capabilities.effort` → `thinkingEffort` via `effortFromCapabilities()`; test (S8).

## Phase 5: Immediate pickup (W5 — R5)

- [x] `remoteSource.ts`: ETag storage, `If-None-Match`, `{ catalog, changed }`; `remoteSource.test.ts` for 304, unchanged body, invalid document and offline (S25, S26, S30).
- [x] `index.ts`: `pollFeed()` every 10 minutes, `pollFeedIfStale()`, a single-flight `refreshDiscovery()` on a declaration signature change; `refresh()` kept for existing callers.
- [x] `UnifiedViewProvider.ts`: `pollFeedIfStale()` in the visibility handler (S27).

## Phase 6: Honest substitution and model errors (W6 — R6)

- [x] `modelCatalog.resolveRequestedModel()` (pure `resolveRequestedModelIn()` tested, S28); `agent-execute` emits the `init` substitution line for a saved model.
- [x] `runtimeErrorPresentation.ts`: `claudeUnavailableModel()` names the model from the CLI 2.1.270 wording and the API `not_found_error`, plus tests (S29). There is no new `failureKind`, because persisted records accept only the auth kinds. A2 still confirms the subscription-plan wording.

## Phase 7: Documentation, QA and closeout (W8 — R8)

- [x] `docs/development/architecture.md`: Model Catalog TO BE → AS IS (new "post-Sprint 127" section; the Sprint 89 section is marked amended), the locked-decision line, a changelog row, and the Sprint 89 memo addendum (S34).
- [x] `.claude/skills/release/SKILL.md`: "Model catalog feed duties" (canary versions with the offline smoke check, lineup refresh with `--merge`, the one-time v1.12.0 gate) and Step 9 item 4.
- [x] `extensions/ritemark/package.json` `test` chain includes the new tests; `npm test` green; `tsc --noEmit` clean (2026-09-24, re-run after `feedExport.test.ts` joined the chain).
- [x] Update the v1.12.0 release plan tracker, `docs/CHANGELOG.md`, the v1.12.0 release notes draft, and `docs/releases/v1.12.0/TEST-CHECKLIST.md` (Sprint 127 Gate 1 rows).
- [x] Walk every `[x]` against the branch diff (SDD discrepancy check, 2026-09-24): every named symbol and file is present on the branch. Phase 1 was reworded for the payload.
- [ ] Audit items, moved here from Phase 0 on 2026-09-24, recorded in `research/phase-0-audit.md`:
  - [ ] A1: Pro and Max subscriptions, CLI 2.1.270, an injected row → listed, runs, init matches, a long session compacts sanely.
  - [ ] A2: capture the error shapes for a model the account cannot use (plan, `availableModels`), and confirm the W6 classifier matches them.
  - [ ] A3: measure the effect of `CLAUDE_CODE_MAX_CONTEXT_TOKENS` on an unknown model's assumed window; decide whether `claudeCode.contextWindow` is needed (Q5).
  - [ ] A4: managed-settings `modelPicker` outranks the SDK layer.
  - [ ] A5: injection on darwin-x64 and win32-x64.
  - [ ] A7: note any `[servedCatalog]` primary-mode behavior seen on the test accounts.
- [ ] QA matrix in `qa-evidence.md`. Use a build reporting a version ≥ `autoRowMinAppVersion`; use a release candidate, or a local uncommitted version bump in the QA worktree.
  - [ ] ★ S1, S2 on a Max subscription; S3 with a newer CLI; S4 with a system CLI; S5 with managed settings; S6 without a workspace.
  - [ ] ★ S7, S8; S9.
  - [ ] ★ S10–S12, S14 (unit evidence); S13, S15.
  - [ ] ★ S16, S17, S21 (publisher runs); S18–S20, S22, S23.
  - [ ] ★ S24 timing; S25–S27.
  - [ ] ★ S28, S29.
  - [ ] ★ S30; S31–S33.
- [ ] Release gate: the publisher is live (first automatic publish recorded) before the client ships. Subscription users with a saved API key lose the key-based `/v1/models` list with R2 (sprint-plan Risks).
- [ ] Recommend `qa-validator` (Phase 4 gate) and `pr-reviewer`; commit and push the sprint branch; open the PR.
