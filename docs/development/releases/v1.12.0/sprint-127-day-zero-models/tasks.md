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

## Phase 1: Feed bootstrap and publisher (W7 — R4, R7) — withdrawn 2026-09-24 (D4)

The publisher was built and tested as a `ritemark-public` payload in commit `e03b8fc`: 70 `node --test` tests, workflows, the bootstrap feed and `APPLY.md`. D4 withdrew it the same day, and the payload was removed. What stays:

- [x] `extensions/ritemark/scripts/export-bundled-model-catalog.ts` prints the bundled catalog as feed JSON. `--merge` keeps automated rows and tombstones (`src/ai/modelCatalog/feedExport.ts` + `feedExport.test.ts`). It is the starting point for any hand edit to the feed.
- The real-CLI smoke evidence ([canary-smoke-2026-09-24.json](./research/evidence/canary-smoke-2026-09-24.json)) still shows that 2.1.270 and 2.1.281 honor a `settings.modelPicker` declaration. That is the W3 mechanism kept for hand-added feed rows.

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

- [x] `docs/development/architecture.md`: Model Catalog TO BE → AS IS (new "post-Sprint 127" section; the Sprint 89 section is marked amended), the locked-decision line, a changelog row, and the Sprint 89 memo addendum (S34). The D4 revision replaces the publisher paragraph with "Claude Code currency" and updates the changelog row and the memo.
- [x] `.claude/skills/release/SKILL.md`: "Model catalog feed duties" and Step 9 item 4. D4 rewrote the section as "Claude Code and model currency": the pre-release check table, the Claude Code bump steps, the rules for hand edits to the feed, and the v1.12.0 gate. It also added Step 0, the extension-release step and release-manager Gate 1 rows.
- [x] `extensions/ritemark/package.json` `test` chain includes the new tests; `npm test` green; `tsc --noEmit` clean (2026-09-24, re-run after `feedExport.test.ts` joined the chain).
- [x] Update the v1.12.0 release plan tracker, `docs/CHANGELOG.md`, the v1.12.0 release notes draft, and `docs/releases/v1.12.0/TEST-CHECKLIST.md` (Sprint 127 Gate 1 rows). All four were revised for D4: Opus 5.5 via Claude Code 2.1.281, the check gate, and Gate 2 rows.
- [x] Walk every `[x]` against the branch diff (SDD discrepancy check, 2026-09-24): every named symbol and file is present on the branch. Phase 1 was reworded for the payload.
- [ ] Audit items, moved here from Phase 0 on 2026-09-24, recorded in `research/phase-0-audit.md`:
  - [ ] A1: Pro and Max subscriptions, CLI 2.1.270, an injected row → listed, runs, init matches, a long session compacts sanely. *(D4: run it on v1.12.0 with Claude Code 2.1.281 and the native Opus 5.5 instead; S35.)*
  - [ ] A2: capture the error shapes for a model the account cannot use (plan, `availableModels`), and confirm the W6 classifier matches them.
  - [ ] A3: measure the effect of `CLAUDE_CODE_MAX_CONTEXT_TOKENS` on an unknown model's assumed window; decide whether `claudeCode.contextWindow` is needed (Q5).
  - [ ] A4: managed-settings `modelPicker` outranks the SDK layer.
  - [ ] A5: injection on darwin-x64 and win32-x64.
  - [ ] A7: note any `[servedCatalog]` primary-mode behavior seen on the test accounts. See [anthropic-served-catalog.md](./research/anthropic-served-catalog.md).
- [ ] QA matrix in `qa-evidence.md`. Use a build reporting a version ≥ `autoRowMinAppVersion`; use a release candidate, or a local uncommitted version bump in the QA worktree.
  - [ ] ★ S1, S2 on a Max subscription; S3 with a newer CLI; S4 with a system CLI; S5 with managed settings; S6 without a workspace. *(D4: no current model qualifies for a declaration, so S1–S2 rest on unit evidence plus the real-CLI smoke evidence.)*
  - [ ] ★ S7, S8; S9.
  - [ ] ★ S10–S12, S14 (unit evidence); S13, S15.
  - ~~★ S16, S17, S21 (publisher runs); S18–S20, S22, S23.~~ Withdrawn (D4).
  - [ ] ★ S24 timing; S25–S27.
  - [ ] ★ S28, S29.
  - [ ] ★ S30; S31–S33.
  - [ ] ★ S35 on a Max subscription with v1.12.0; S36, S37 (unit evidence).
  - [ ] ★ S38 against the live catalog; ★ S39, ★ S40 (unit evidence).
- ~~Release gate: the publisher is live (first automatic publish recorded) before the client ships.~~ *(Replaced 2026-09-24, D4.)* Release gate: `npm run check:anthropic-models` passes on the release candidate's source (R10), and v1.12.0 bundles Claude Code 2.1.281 (R9).
- [ ] Recommend `qa-validator` (Phase 4 gate) and `pr-reviewer`; commit and push the sprint branch; open the PR.

## Phase 8: Claude Code currency and the pre-release check (W9, W10 — R9, R10; added 2026-09-24, D4)

- [x] Scope change recorded first: D4 in `sprint-plan.md`; R4 withdrawn; R1 and R8 revised; R9 and R10 added in `spec.md`; S35–S40 in `scenarios.md`; W9 and W10 in `technical-plan.md`; audit [anthropic-served-catalog.md](./research/anthropic-served-catalog.md) with [evidence](./research/evidence/anthropic-served-catalog-2026-09-24.json).
- [x] W9: `manifest.json` Claude rows → 2.1.281 with measured npm integrity, archive SHA-256 and installed SHA-256 for all three targets. `fetch-agent-runtimes` gives PASS for darwin-arm64, darwin-x64 and win32-x64.
- [x] W9: `validate-agent-runtime-manifest.mjs` approved snapshots (2.1.281 / 0.3.281) + its test (11/11); `package.json` + `package-lock.json` Agent SDK 0.3.281 through npm. Only the SDK and its eight platform packages changed.
- [x] W9: evidence in `docs/development/agent-runtime-compatibility.md`: validator, fetch verification, SDK type diff (additive), `tsc` + tests, linux-x64 probes ([cli-2.1.281-probes.json](./research/evidence/cli-2.1.281-probes.json)), and the not-proven items (native execution, an authenticated turn).
- [x] W9: Opus 5.5 id in `modelConfig.ts`; curated row in `bundledCatalog.ts` (lineup dated 2026-09-24); Sonnet 5 stays the default (S37); tests. The shared fixture moved to a hypothetical `claude-opus-6`, and the older resolver tests derive their date from the lineup.
- [x] W10: `anthropicCatalogCheck.ts` + `anthropicCatalogCheck.test.ts` (S38–S40, 11 tests) + trimmed sample fixture; `scripts/check-anthropic-model-catalog.ts`; `check:anthropic-models` npm script; test in the `test` chain. Live run: [evidence](./research/evidence/anthropic-models-check-2026-09-24.txt).
- [x] W10: the `release` skill (Step 0, extension-only release, "Claude Code and model currency") and release-manager Gate 1 (red-flag row and extension step 1b).
- [x] Remove the `ritemark-public/` payload; update `architecture.md`, `docs/CHANGELOG.md`, the v1.12.0 release notes, `TEST-CHECKLIST.md` and the release plan.
- [ ] `tsc`, `npm run compile`, full `npm test`, validator tests, pre-commit hook; `qa-validator` before commit; commit and push.

## Phase 9: PR #347 review follow-ups (added 2026-09-25)

Codex review of PR #347 (merged by Jarmo's admin merge on 2026-09-24) found three issues. Jarmo asked for the fixes in a new PR.

- [x] P1: the Codex harness mirrors the R10 gate: `.agents/skills/release-process/SKILL.md` (start-of-release commands, full-release step 1, extension-only release, and "Claude Code and Model Currency") and `.codex/agents/release-manager.toml` (Gate 1, extension-only).
- [x] P2 (R3): `enrichLive()` matches live alias rows by `resolvedModel`, so `opus` → `claude-opus-5-5` shows the curated "Opus 5.5" label and order and keeps its id. Test: "live alias rows take the curated presentation…".
- [x] P2 (R6, S28): the substitution notice is reachable in the normal sidebar path. The host compares each Claude turn with the saved `ritemark.ai.selectedModel` (`substitutionForTurn()`), because the webview already sends the replacement. The notice is shown once per conversation. Test: "S28: a turn on the replacement…".

