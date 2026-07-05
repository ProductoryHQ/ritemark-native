# Sprint 89 Tasks — Model Gateway

Status is the source of truth for what is done. Do not pre-tick — tick only when the
corresponding code change exists on the active branch (`git diff main...HEAD -- <file>`
must show the work).

> **Progress (2026-07-01) — see `sprint-plan.md` Status Log for the canonical record.**
> DONE + verified green (compile 0 / webview tsc 0 / 12·12 catalog tests / all runnable unit tests):
> WS0 audit · WS1 subsystem (`schema`/`bundledCatalog`/`resolver`/`remoteSource`/`providerDiscovery`/`index` + tests)
> · WS2 host rewire + zombie deletions · WS3 webview defaults + stale-id reconcile · WS5 `architecture.md`.
> Independent `qa-validator` pass found + fixed 5 defects.
> **REMAINING:** WS4 — publish `feeds/model-catalog.json` to `ritemark-public` (outward-facing, awaiting Jarmo);
> commits (worktree lacks vscode symlink/patches → pre-commit blocks); Settings connectivity-test model repoint (optional).

---

## Phase 0: Audit (gate on results before any implementation)

- [ ] Make a real `GET https://api.anthropic.com/v1/models` call with a test API key; record
      response schema fields (id, display_name, created_at, etc.) in `research/phase0-audit.md`
- [ ] Confirm whether `claude-sonnet-5` appears in the `/v1/models` response
- [ ] Confirm whether `/v1/models` accepts Bearer (OAuth) tokens in addition to `x-api-key`
- [ ] Run `discoverModels.ts` against the bundled CLI binary; record the exact model list
      returned by `supportedModels()` — does it include `claude-sonnet-5`?
- [ ] Confirm OpenAI `models.list()` response shape and the filter needed to isolate LLM models
      (exclude embeddings, TTS, image models)
- [ ] Confirm Gemini `/v1/models` field names for text-generative models
- [ ] Trace `FlowEditorProvider.fetchOpenAIModels()` and `fetchGeminiModels()` call paths:
      are they triggered by a webview message type or purely internal? Record in audit doc.
- [ ] Run `wc -l extensions/ritemark/src/views/UnifiedViewProvider.ts` and record baseline LOC
- [ ] Run grep audit for all callers of `CLAUDE_MODELS`, `DEFAULT_MODEL`, `BYOK_PROVIDER_MODELS`,
      `CLAUDE_FALLBACK_MODELS` — confirm or refute the "zero real consumers" claim for the
      first two; record every call site
- [ ] Write `research/phase0-audit.md` answering all Open Questions 1, 2, 4, 5 from spec.md
- [ ] Review audit findings with Jarmo; confirm Phase 1 can proceed (CHECKPOINT — do not
      continue until Jarmo says "proceed" or "approved")

---

## Phase 1: `src/ai/modelCatalog/` subsystem (R1, R5)

Prerequisite: Phase 0 audit complete and approved.

### Schema + validator (Workstream 1)
- [ ] Create `extensions/ritemark/src/ai/modelCatalog/schema.ts` with `ModelEntry`,
      `ProviderCatalog`, `ModelCatalog` types and `validateCatalog()` hand-rolled validator
- [ ] Write unit tests for `validateCatalog()` covering: valid v1 catalog, wrong schemaVersion,
      missing `providers`, malformed `models` array
- [ ] Confirm `resolveJsonModule: true` in `extensions/ritemark/tsconfig.json` (needed for
      JSON import of bundled-catalog.json)

### Bundled baseline (Workstream 1)
- [ ] Create `extensions/ritemark/src/ai/modelCatalog/bundled-catalog.json` seeded with:
      Anthropic (`claude-sonnet-5`, `claude-opus-4-8`, `claude-haiku-4-5-20251001`,
      `claude-fable-5`), OpenAI (current GPT-5 family), Gemini (current Gemini family),
      Codex (current FALLBACK_MODELS), OpenCode (current BYOK curated subset)
- [ ] Validate the JSON against `validateCatalog()` in a test — must pass with zero errors

### remoteSource.ts (Workstream 1)
- [ ] Create `extensions/ritemark/src/ai/modelCatalog/remoteSource.ts` with:
      - `fetchRemoteCatalog(storage)`: origin allowlist check, size cap (512 KB), fetch,
        `validateCatalog()`, persist to `globalStorage`
      - `getCachedCatalog(storage)`: read + parse + validate from `globalStorage`
      - `saveCatalogToCache(catalog, storage)`: write to `globalStorage` with timestamp
- [ ] Write unit test: origin outside allowlist → rejected before fetch
- [ ] Write unit test: response body > 512 KB → aborted, returns null
- [ ] Write unit test: invalid schema → returns null, does not persist

### providerDiscovery.ts (Workstream 2 — absorbs discoverModels.ts + codexModels.ts)
- [ ] Create `extensions/ritemark/src/ai/modelCatalog/providerDiscovery.ts` with:
      - `discoverAnthropic(apiKey, oauthAvailable)`: REST probe first, SDK fallback
        (shapes from Phase 0 audit)
      - `discoverOpenAI(apiKey)`: `openai.models.list()` with LLM filter
      - `discoverGemini(apiKey)`: Gemini REST probe with text-generative filter
      - `discoverCodex()`: reads `~/.codex/models_cache.json` (logic from codexModels.ts)
      - `discoverOpenCode(acpRuntime)`: reads ACP `configOptions[id="model"]`
- [ ] 8-second timeout per probe (independent; one probe failing does not block others)
- [ ] All probes return `ModelEntry[] | null` (null = unknown/unavailable, not an error)

### resolver.ts (Workstream 1)
- [ ] Create `extensions/ritemark/src/ai/modelCatalog/resolver.ts` with `resolveAll()`
      implementing the four-level waterfall: live → remote → cache → bundled
- [ ] `minAppVersion` filtering: entries where `semver(appVersion) < minAppVersion` are excluded
- [ ] `deprecated` flag merging: live results inherit `deprecated` from the first catalog tier
      that has data for that model ID
- [ ] Write unit test: live result available → tagged `source: 'live'`
- [ ] Write unit test: live null, remote available → tagged `source: 'remote'`
- [ ] Write unit test: all upstream null → bundled returned, tagged `source: 'bundled'`
- [ ] Write unit test: `minAppVersion` filtering excludes correct entries

### index.ts (Workstream 1)
- [ ] Create `extensions/ritemark/src/ai/modelCatalog/index.ts` exporting:
      `activate`, `getModels`, `getDefault`, `onUpdate`, `refresh`
- [ ] `activate()` calls `refresh()` immediately then sets 6-hour interval
      (interval cleared in the returned Disposable)
- [ ] `getModels()` / `getDefault()` return synchronously from `_resolved` or bundled fallback;
      never throw, never return empty
- [ ] `refresh()` runs discovery + remote fetch concurrently, merges via `resolveAll()`,
      stores in `_resolved`, fires `onUpdate`
- [ ] Wire `isEnabled('remote-model-catalog')` gate: when false, skip probes + remote fetch

### Feature flag
- [ ] Add `remote-model-catalog` flag to `extensions/ritemark/src/features/flags.ts`
      with `status: 'enabled'`

### TypeScript compile check (Phase 1 gate)
- [ ] Run `tsc --noEmit` on extension host — zero new errors before continuing to Phase 2

---

## Phase 2: Consumer rewire — extension host (R3, R4)

Prerequisite: Phase 1 complete and compiling.

### Dead registry removal (R3)
- [ ] Delete `CLAUDE_MODELS` export from `extensions/ritemark/src/ai/modelConfig.ts`
      (CHECKPOINT: confirm zero callers per Phase 0 audit before deleting)
- [ ] Delete `DEFAULT_MODEL` export from `src/ai/modelConfig.ts`
- [ ] Delete `BYOK_PROVIDER_MODELS`, `ByokProvider`, `ByokModelOption`, `toOpenCodeModelValue`
      from `src/ai/modelConfig.ts`
- [ ] Delete `CLAUDE_FALLBACK_MODELS` from `src/agent/claudeModels.ts`;
      delete `claudeModels.ts` if no other exports remain
- [ ] Absorb `getCodexModels()` into `providerDiscovery.discoverCodex()`;
      delete `src/codex/codexModels.ts` or reduce to thin stub if imports remain
- [ ] Remove `CLAUDE_MODELS` / `DEFAULT_MODEL` re-exports from `src/agent/index.ts`
- [ ] Run `tsc --noEmit` — must pass with zero errors after each deletion batch

### UnifiedViewProvider rewire (R4)
- [ ] Remove inline model-list assembly; replace with `modelCatalog.getModels('anthropic')`
      and `modelCatalog.getDefault('anthropic', 'claude-code')`
- [ ] Subscribe to `modelCatalog.onUpdate()` in `activate()`; on update push
      `{ type: 'modelCatalog:update', payload: { resolved } }` to the webview
- [ ] Run `wc -l` on `UnifiedViewProvider.ts` — must be ≤ 1100 LOC

### FlowEditorProvider rewire (R4)
- [ ] Replace `fetchOpenAIModels()` / `fetchGeminiModels()` with `modelCatalog.getModels()`
      calls (or convert to thin wrappers per Phase 0 call-path finding)
- [ ] Wire `modelCatalog.onUpdate()` subscription to push updated Flow model lists to webview

### LLMNodeExecutor rewire (R4)
- [ ] Replace `DEFAULT_MODELS.flowLLM` import with `modelCatalog.getDefault('openai', 'flow-llm')`

### RitemarkSettingsProvider connectivity test (R4)
- [ ] Replace `BYOK_PROVIDER_MODELS` lookup at line ~1051 with `modelCatalog.getModels(provider)`

### ACP layer (R4)
- [ ] Identify ACP layer usage of `BYOK_PROVIDER_MODELS` (from Phase 0 audit);
      replace with `modelCatalog.getModels('opencode')` or appropriate provider

### TypeScript compile check (Phase 2 gate)
- [ ] Run `tsc --noEmit` — zero errors after all rewires

---

## Phase 3: Consumer rewire — webview (R3, R4)

Prerequisite: Phase 2 complete; webview message contract for `modelCatalog:update` defined.

- [ ] In `webview/src/components/ai-sidebar/store.ts`: replace `selectedModel: 'claude-sonnet-4-5'`
      with `selectedModel: ''`
- [ ] Replace `codexSelectedModel: 'gpt-5.3-codex'` with `codexSelectedModel: ''`
- [ ] Replace `pendingRuntime.modelId: 'claude-sonnet-4-5'` with `modelId: ''`
- [ ] Add `reconcileSelectedModel()` helper: if `current ∈ list` keep; else reset to `defaultId`
      and emit visible notice "Switched to [label] — your previous model is no longer available"
- [ ] Wire `modelCatalog:update` message handler in the webview store to call
      `reconcileSelectedModel()` for each runtime + update stored lists
- [ ] Verify `webview/src/config/modelConfig.ts` has no hardcoded model lists; if it does,
      wire it to the push message (document finding)
- [ ] Build the webview bundle (`npm run build` in webview dir) — zero errors
- [ ] Smoke test: open AI sidebar → model dropdown shows catalog-resolved list (not stale defaults)

---

## Phase 4: Remote catalog publish + bundled seed (R5)

Prerequisite: Phase 1 `bundled-catalog.json` drafted; Phase 2-3 confirmed working.

- [ ] Create `feeds/model-catalog.json` in `jarmo-productory/ritemark-public` with the same
      seed content as `bundled-catalog.json` (Anthropic includes `claude-sonnet-5`,
      `claude-opus-4-8`, `claude-haiku-4-5-20251001`, `claude-fable-5`; OpenAI/Gemini/Codex/
      OpenCode current)
- [ ] Validate the published JSON at the raw URL: `curl -s <url> | python3 -m json.tool` — valid
- [ ] Confirm `remoteSource.ts` allowlist accepts the published URL
- [ ] End-to-end smoke: with `remote-model-catalog` flag enabled, activate extension, observe
      `modelCatalog:update` fires with `source: 'remote'` in trace log

---

## Phase 5: Architecture doc (R6)

Prerequisite: Phase 2 dead-registry deletions confirmed.

- [ ] Rewrite `docs/development/architecture.md` "Model Configuration" section to describe
      `src/ai/modelCatalog/` subsystem
- [ ] Mark GH #109 as "Resolved in Sprint 89" in the Open Architectural Debt table
- [ ] Update Locked Decisions: "Model IDs centralised" entry updated to reference
      `src/ai/modelCatalog/` and note the Sprint 89 evolution
- [ ] Add dated inline decision memo (format from technical-plan.md Workstream 5)
- [ ] Add Sprint Architecture Gate note for Sprint 89

---

## Phase 6: QA and Closeout

Manual QA — for each item, verify against `scenarios.md` by scenario title.

- [ ] scenarios.md: "Cold start — no network, no disk cache" — bundled floor works
- [ ] scenarios.md: "Cold start — no network, disk cache present" — cache survives
- [ ] scenarios.md: "onUpdate fires after live probe completes" — dropdown re-renders
- [ ] scenarios.md: "remote-model-catalog flag disabled" — bundled only, no fetches
- [ ] scenarios.md: "Anthropic live probe — API key present" — `/v1/models` called, list updated
- [ ] scenarios.md: "AI sidebar model dropdown — selected model no longer available" — notice shown
- [ ] scenarios.md: "Catalog update race — two concurrent refresh() calls" — no double-fire
- [ ] scenarios.md: "TypeScript compiles cleanly after deletions" — `tsc --noEmit` passes
- [ ] scenarios.md: "UnifiedViewProvider LOC gate" — `wc -l` ≤ 1100
- [ ] scenarios.md: "CLAUDE_MODELS import removed" — grep returns zero matches
- [ ] scenarios.md: "DEFAULT_MODEL import removed" — grep returns zero matches
- [ ] scenarios.md: "Remote catalog fetch — schema validation failure" — falls to bundled silently
- [ ] scenarios.md: "Remote catalog fetch — size cap exceeded" — aborted, no crash
- [ ] scenarios.md: "Remote catalog fetch — wrong origin" — rejected before network call
- [ ] Invoke `qa-validator` via main session for pre-commit sign-off
- [ ] Run `./scripts/validate-qa.sh` — all checks green
- [ ] Update `CHANGELOG.md` with Sprint 89 entry
- [ ] Link PR to GH #109 in PR description; close #109 on merge
- [ ] Update Sprint 89 sprint-plan.md status to "Phase 6 — QA"
- [ ] Push branch; open PR; request `pr-reviewer`

---

## Notes on irreversible steps

The following tasks are irreversible once committed to the branch:

- Deletion of `CLAUDE_MODELS` and `DEFAULT_MODEL` (R3): once deleted, callers that were
  importing these (even transitively) will fail to compile. The Phase 0 audit must confirm
  zero real callers before proceeding.
- Deletion of `BYOK_PROVIDER_MODELS` (R3): the ACP layer and Settings connectivity test must
  be rewired before this is deleted.
- Changing webview store defaults to `''` (R3): once shipped, a user whose stored model ID is
  stale will be silently reset. This is the intended behaviour but cannot be undone.
- Seeding `bundled-catalog.json` with `claude-sonnet-5` as the default (R5): this changes the
  default model for all users on next install or update. Confirm Jarmo approves the new default
  before Phase 4.
