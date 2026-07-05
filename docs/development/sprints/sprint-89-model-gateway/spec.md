# Sprint 89 Spec — Model Gateway

## Purpose

Every AI model surface in Ritemark (Claude Code runtime, Codex runtime, ACP/OpenCode runtime,
Flow LLM nodes, BYOK picker) currently resolves models from a hardcoded array that is frozen
at app-ship cadence. This sprint introduces `src/ai/modelCatalog/` — a single subsystem that
resolves model lists and defaults via a provenance-tracked waterfall (live provider probe →
remote catalog → on-disk cache → bundled baseline), so new models (e.g. `claude-sonnet-5`,
shipping 2026-06-30) appear in the app without a new release. It also kills every zombie
registry and stale hardcoded constant that the audit uncovered.

## Principles

- **Single authority.** One resolver (`modelCatalog`) is the only place model lists and
  defaults are computed. Runtimes and webview are consumers, never sources.
- **Offline-safe floor.** The bundled `model-catalog.json` is always present; zero-network
  startup works identically to today.
- **Provenance-tracked.** Every resolved list carries a `source` tag (`live | remote | cache | bundled`)
  so the UI can show users where data came from (future work; the tag is there from day one).
- **No new npm dependencies.** Existing `fetch` (Node 18+ global in VS Code extension host)
  plus hand-rolled schema validation. No `zod` unless it is already a transitive dependency.
- **Feature-flagged.** The remote fetch path sits behind flag `remote-model-catalog`. Flipping
  the flag off routes the waterfall straight to bundled baseline — zero regressions on disable.
- **Reversibility.** Dead-code deletion (R3) and default-id changes (R2) are irreversible once
  merged. Both are called out in the tasks with explicit "checkpoint Jarmo" notes.

## Requirements

### R1: Model Catalog Subsystem

As a Ritemark developer, I want a `src/ai/modelCatalog/` module that resolves model lists for
all runtimes and surfaces, so that adding a new Claude or OpenAI model requires only a remote
JSON edit, not an app release.

Acceptance criteria:
- `modelCatalog.getModels(provider)` returns a `ModelEntry[]` with at minimum `{ id, label, description, tier, deprecated }`.
- `modelCatalog.getDefault(provider, surface)` returns the correct default model ID for the
  given provider + surface combination (e.g. `provider='anthropic', surface='claude-code'`).
- `modelCatalog.onUpdate(cb)` fires whenever the catalog is refreshed (live probe or remote
  fetch completed); all consumers can subscribe and re-render.
- `modelCatalog.refresh()` forces an immediate re-probe + remote fetch cycle (used on Settings
  open and on API-key change).
- The subsystem is exported from a single `index.ts` entry point; no consumer imports from
  internal files.
- On cold start with no network and no disk cache, the bundled baseline is used; startup does
  not block.
- With `remote-model-catalog` flag disabled, the waterfall skips steps 1 and 2 (live probe +
  remote fetch) and returns bundled data only.

### R2: Waterfall Resolution

As a user, I want the model lists and defaults in every dropdown to reflect live provider state
(when I have an API key or OAuth), so that I see new models as soon as the provider ships them.

Acceptance criteria:
- For Anthropic/Claude: the resolver calls `GET /v1/models` with the stored API key (when
  present); falls back to `supportedModels()` (SDK OAuth path) only when the REST call fails or
  no API key is present.
- For OpenAI: the resolver calls `openai.models.list()` (existing `OpenAI` client) and filters
  to LLM-suitable models.
- For Gemini: the resolver calls `GET /v1/models` via the Gemini REST API.
- For Codex: the resolver reads `~/.codex/models_cache.json` (existing `codexModels.ts` logic,
  absorbed rather than duplicated).
- For OpenCode/ACP: the resolver reads `configOptions[id="model"]` from the ACP provider.
- When a live probe succeeds, its result is tagged `source: 'live'` and supersedes any cached
  or remote data for that provider until the next refresh.
- When a live probe fails (no key, network error, timeout), the resolver falls through to the
  next waterfall level without surfacing an error to the user.
- The waterfall merges live results with the remote catalog's `deprecated` flags, so a
  provider-removed model can still be marked deprecated even if the REST API no longer lists it.
- After refresh, `onUpdate` fires and all subscribed consumers re-render their dropdowns.

### R3: Dead Registry Cleanup

As a developer, I want all zombie model constants and stale defaults removed, so that there is
no ambiguity about which registry is authoritative.

Acceptance criteria:
- `CLAUDE_MODELS` (in `src/ai/modelConfig.ts`) is deleted (it has zero real consumers per audit).
- `DEFAULT_MODEL = 'claude-sonnet-4-5'` (stale, never in dropdowns) is deleted.
- `CLAUDE_FALLBACK_MODELS` in `src/agent/claudeModels.ts` is deleted; `claudeModels.ts` is
  deleted once no callers remain.
- `FALLBACK_MODELS` in `src/codex/codexModels.ts` is deleted; `getCodexModels()` is absorbed
  into `providerDiscovery.ts`.
- `BYOK_PROVIDER_MODELS` in `src/ai/modelConfig.ts` is deleted; BYOK model lists come from
  the catalog.
- Webview store hardcoded defaults (`selectedModel: 'claude-sonnet-4-5'` at line 318,
  `codexSelectedModel: 'gpt-5.3-codex'` at line 337, `pendingRuntime.modelId` at line 342)
  are replaced by the first entry of the resolved list for that runtime, received via host
  message.
- After deletion, `tsc --noEmit` passes with zero new errors.

### R4: Consumer Rewire

As a user, I want all model dropdowns (AI sidebar, Flow editor LLM nodes, Settings connectivity
test, BYOK picker) to draw from the catalog subsystem, so that every surface shows a consistent,
up-to-date list.

Acceptance criteria:
- `UnifiedViewProvider` sends resolved Claude/Codex/BYOK lists to the webview via the existing
  `agent:config` message, supplemented by new `modelCatalog:update` push messages on refresh.
- `FlowEditorProvider.fetchOpenAIModels()` and `fetchGeminiModels()` are replaced by catalog
  calls; the Flow editor model dropdowns update on catalog refresh.
- `LLMNodeExecutor` reads its default model from `modelCatalog.getDefault('openai', 'flow-llm')`
  rather than from `DEFAULT_MODELS` in `modelConfig.ts`.
- Settings connectivity test (line 1051 of `RitemarkSettingsProvider`) uses the resolved model
  list, not `BYOK_PROVIDER_MODELS`.
- ACP layer reads BYOK models from the catalog.
- The webview validates `selectedModel ∈ resolvedList` on receipt of a model list update; if the
  stored `selectedModel` is not in the list, it resets to `getDefault()` for that runtime and
  emits a visible notice (e.g. "Switched to [model] — your previous selection is no longer
  available").
- `UnifiedViewProvider` stays at or below 1100 LOC after the rewire.

### R5: Bundled Baseline + Remote Catalog

As a Ritemark operator (Jarmo), I want a `model-catalog.json` in `jarmo-productory/ritemark-public`
that I can update with a single JSON edit to surface new models to all installed apps within one
refresh interval, so that model currency does not require an app release.

Acceptance criteria:
- `model-catalog.json` in `ritemark-public` at a stable path (e.g. `feeds/model-catalog.json`)
  is served as raw HTTPS and is valid against the `schemaVersion: 1` schema defined in
  `src/ai/modelCatalog/schema.ts`.
- The schema carries: `schemaVersion` (int), `updatedAt` (ISO-8601), `providers` (keyed object
  per `anthropic | openai | gemini | codex | opencode`), each containing `models: ModelEntry[]`
  and `defaults: Record<surface, modelId>`.
- `ModelEntry` carries: `id` (string), `label` (string), `description` (string),
  `tier` (`'low'|'medium'|'high'`), `deprecated` (boolean), `order` (number), optional `minAppVersion` (semver string).
- The extension fetches from the allowlisted origin only (`raw.githubusercontent.com/jarmo-productory/ritemark-public`);
  any other origin is rejected.
- Response size is capped at 512 KB; larger responses are rejected and the resolver falls to
  on-disk cache.
- Fetch happens once on extension activation (when `remote-model-catalog` flag is on) and then
  on a configurable interval (default 6 hours); `refresh()` triggers an immediate cycle.
- Successful fetch is persisted to `globalStorage` as the on-disk cache; subsequent cold starts
  with no network serve from this cache.
- A `minAppVersion` field on a model entry causes that entry to be silently filtered out when
  the running app version is below the stated minimum.
- Pinned-key signature verification is explicitly deferred as future work (Phase 2 follow-up);
  trust v1 is HTTPS + strict schema + size cap + origin allowlist.

### R6: Architecture Doc + Governance

As a team, I want `docs/development/architecture.md` updated to reflect the new subsystem,
close GH #109, and record the evolution of the locked "Model IDs centralised" decision
(mechanism changed from static file to remote catalog + resolver).

Acceptance criteria:
- Architecture.md "Model Configuration" section is rewritten to describe `src/ai/modelCatalog/`
  as the new single source of truth.
- GH #109 is marked resolved in the Open Architectural Debt table.
- The Locked Decisions section is updated: "Model IDs centralised — `src/ai/modelCatalog/`
  (Sprint 89); the canonical location is now the resolver + remote catalog, not a static array
  in `modelConfig.ts`."
- A dated decision memo is recorded inline (no separate cross-repo decisions/ file for a
  repo-internal change).
- Sprint Architecture Gate note is added (as per the Sprint Architecture Gate section pattern).

## Non-Requirements

- Pinned-key signature verification of the remote catalog (explicitly deferred; noted as
  future work in spec and architecture.md).
- Free-tier model tiers or per-user entitlement enforcement — model catalog is purely
  informational; billing gates live in cloud sprints.
- A UI for the user to manually trigger a catalog refresh (the `refresh()` API is internal;
  Settings open already calls it).
- Retry / telemetry gateway unification across runtimes (GH #109 mentions "retry/telemetry
  paths" — those remain separate; this sprint scopes to model-resolution only).
- Background sync of model catalog while the app is closed (requires OS daemon, out of scope).
- `getCodexModels()` live probe against a running Codex binary (the existing `models_cache.json`
  read is sufficient; the catalog provides the fallback list).
- OpenRouter model discovery (OpenRouter serves thousands of models; the catalog carries a
  curated subset only).

## Resolved Questions

- **2026-07-01:** Remote catalog hosting = `jarmo-productory/ritemark-public` raw GitHub
  (reuses the `update-feed.json` mechanism). Decided by Jarmo.
- **2026-07-01:** Trust model for v1 = HTTPS + strict schema + 512 KB size cap + origin
  allowlist. Pinned-key signature deferred. Decided by Jarmo.
- **2026-07-01:** Anthropic `/v1/models` REST = primary live Claude source (over `supportedModels()`
  SDK path which is OAuth-only and bundled-CLI-capped). Decided by Jarmo.
- **2026-07-01:** No new npm dependencies. Decided by Jarmo.
- **2026-07-01:** Feature flag ID = `remote-model-catalog`; flip-off routes to bundled only.
- **2026-07-01:** Phase 0 is an audit gate — implementation phases do not start until Phase 0
  findings confirm REST response shapes and `supportedModels()` CLI-version behaviour.

## Open Questions

1. **`supportedModels()` + `claude-sonnet-5`:** Does the currently bundled Claude CLI binary
   report `claude-sonnet-5` via `supportedModels()`? Phase 0 must answer this empirically
   (the audit brief predicts "no" — the binary cap means it will lag). The answer determines
   whether `supportedModels()` is used as primary or deprioritised to OAuth-only fallback.

2. **Anthropic `/v1/models` auth modes:** Does `/v1/models` accept both API-key (`x-api-key`
   header) and OAuth Bearer tokens, or API-key only? Phase 0 must confirm. If OAuth Bearer
   works, the live probe can run for both key-auth and CLI-OAuth users.

3. **Refresh interval:** 6 hours is the proposed default. Jarmo should confirm this is
   acceptable given the use pattern (app open for days without restart).

4. **`FlowEditorProvider.fetchOpenAIModels()`/`fetchGeminiModels()` retention:** Are these
   methods called from the webview directly (via message), or only internally? Phase 0 should
   trace their call path to confirm they can be safely replaced by catalog calls.

5. **`modelConfig.ts` remainder:** After deleting `CLAUDE_MODELS`, `DEFAULT_MODEL`, and
   `BYOK_PROVIDER_MODELS`, the file retains OpenAI/Gemini static arrays, `DEFAULT_MODELS`,
   and image model types. Should the file be renamed (e.g. `openAiConfig.ts`) to reflect its
   narrowed scope, or left in place? Decision needed before Phase 3.
