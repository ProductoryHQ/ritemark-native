# Sprint 89 Technical Plan — Model Gateway

## Architecture Overview

Sprint 89 introduces `src/ai/modelCatalog/` as a new subsystem in the extension host. It sits
alongside (and partially absorbs) `src/ai/modelConfig.ts`. The subsystem is the single resolver
all runtimes and views call; no runtime or view is allowed to maintain its own model list going
forward.

```
Extension host
├── src/ai/
│   ├── modelCatalog/             NEW subsystem (this sprint)
│   │   ├── schema.ts             schema v1 type + validator
│   │   ├── bundled-catalog.json  baseline (shipped in VSIX)
│   │   ├── remoteSource.ts       fetch/cache/validate from ritemark-public
│   │   ├── providerDiscovery.ts  live probes (Anthropic REST, OpenAI, Gemini, Codex, ACP)
│   │   ├── resolver.ts           waterfall: live → remote → cache → bundled
│   │   └── index.ts              public API: getModels, getDefault, onUpdate, refresh
│   └── modelConfig.ts            RETAINED (narrowed): OpenAI/Gemini static arrays for Flow
│                                  executor types + image models; Claude/BYOK sections deleted
├── src/agent/
│   ├── claudeModels.ts           DELETED (absorbed into providerDiscovery.ts + catalog)
│   └── discoverModels.ts         RETAINED but demoted: called by providerDiscovery.ts only
├── src/codex/
│   └── codexModels.ts            getCodexModels() absorbed into providerDiscovery.ts; file
│                                  deleted or reduced to a thin re-export if callers remain
├── src/views/
│   └── UnifiedViewProvider.ts    rewired: sends catalog-resolved lists; subscribes to onUpdate
└── src/flows/
    └── FlowEditorProvider.ts     rewired: model dropdown calls catalog not local fetchers

Webview
└── webview/src/components/ai-sidebar/store.ts
    selectedModel/codexSelectedModel/pendingRuntime.modelId: remove hardcoded defaults;
    validate ∈ list on each agent:config / modelCatalog:update message
```

The data flow for a fully-wired user (API key present, network available):

```
Extension activates
  → modelCatalog.refresh() called
  → providerDiscovery runs live probes concurrently for each provider
  → remoteSource fetches jarmo-productory/ritemark-public feeds/model-catalog.json
  → resolver merges: live results win; remote catalog fills gaps + deprecation flags
  → onUpdate fires
  → UnifiedViewProvider sends agent:config (claude/codex/byok lists + defaults)
  → FlowEditorProvider sends flow:modelConfig (openai/gemini/byok lists + defaults)
  → Webview stores re-render dropdowns
```

---

## Workstream 0: Phase 0 — Audit (R1, R2, gate all other workstreams)

### Scope

Phase 0 is an empirical audit; no production code changes until it concludes. Results live
in `research/phase0-audit.md`.

### What to audit

1. **Anthropic `/v1/models` response shape.** Make a real `GET https://api.anthropic.com/v1/models`
   call with a test API key. Record:
   - Response schema (field names, pagination if any)
   - Whether `claude-sonnet-5` appears
   - Whether the endpoint accepts both `x-api-key` and Bearer auth

2. **`supportedModels()` + bundled CLI version.** Call `discoverModels.ts` against the bundled
   binary and record the exact model list it returns. Confirm whether `claude-sonnet-5` is in
   the list. This determines whether `supportedModels()` is used as primary or secondary/fallback
   in the waterfall.

3. **OpenAI `models.list()` shape.** Verify the filter logic needed to extract LLM-suitable
   models from the full list (many embeddings/TTS/image models must be excluded).

4. **Gemini `/v1/models` shape.** Verify field names and filter for text-generative models.

5. **`FlowEditorProvider.fetchOpenAIModels()` call path.** Trace whether the webview triggers
   it via a message type or whether it is purely internal. Determines rewire strategy.

6. **`UnifiedViewProvider` current LOC.** Baseline count before rewire to track the ≤1100 guard.

7. **`modelConfig.ts` callers.** Full grep of every import of `CLAUDE_MODELS`, `DEFAULT_MODEL`,
   `BYOK_PROVIDER_MODELS`, and `CLAUDE_FALLBACK_MODELS`. Confirm the audit claim that
   `CLAUDE_MODELS` + `DEFAULT_MODEL` have zero real consumers.

### Output

`research/phase0-audit.md` must answer Open Questions 1 and 2 from spec.md and provide:
- Confirmed Anthropic API response shape (with enough field names to write `schema.ts`)
- List of every call site for the dead constants
- `supportedModels()` empirical result (does it report `claude-sonnet-5`?)
- Confirmed baseline for `UnifiedViewProvider` LOC

Phase 1–4 are BLOCKED until this audit is done.

---

## Workstream 1: `src/ai/modelCatalog/` subsystem (R1, R5)

### `schema.ts`

Defines the catalog schema and the runtime validator:

```typescript
export interface ModelEntry {
  id: string;
  label: string;
  description: string;
  tier: 'low' | 'medium' | 'high';
  deprecated: boolean;
  order: number;
  minAppVersion?: string;  // semver; entry filtered if app version < this
}

export type Provider = 'anthropic' | 'openai' | 'gemini' | 'codex' | 'opencode';
export type Surface = 'claude-code' | 'flow-llm' | 'flow-image' | 'byok' | 'codex' | 'opencode';

export interface ProviderCatalog {
  models: ModelEntry[];
  defaults: Partial<Record<Surface, string>>;
}

export interface ModelCatalog {
  schemaVersion: 1;
  updatedAt: string;  // ISO-8601
  providers: Partial<Record<Provider, ProviderCatalog>>;
}

export function validateCatalog(raw: unknown): ModelCatalog  // throws on invalid schema
```

The validator is hand-rolled (no zod): check `schemaVersion === 1`, check `providers` is an
object, check each `ProviderCatalog` has `models: ModelEntry[]` and `defaults: Record`.

### `bundled-catalog.json`

Seeded at Phase 4 publish time. Until then, a temporary seed JSON is used during development.
Minimum viable seed includes:
- `anthropic`: `claude-sonnet-5`, `claude-opus-4-8`, `claude-haiku-4-5-20251001`, `claude-fable-5`
  with defaults `claude-code: 'claude-sonnet-5'`
- `openai`: current GPT-5 family (from existing `OPENAI_LLM_MODELS`)
- `gemini`: current Gemini family (from existing `GEMINI_LLM_MODELS`)
- `codex`: current `FALLBACK_MODELS` from `codexModels.ts`
- `opencode`: current BYOK curated subset

### `remoteSource.ts`

```typescript
const REMOTE_URL = 'https://raw.githubusercontent.com/jarmo-productory/ritemark-public/main/feeds/model-catalog.json';
const SIZE_CAP_BYTES = 512 * 1024;
const CACHE_KEY = 'modelCatalog_v1';

export async function fetchRemoteCatalog(storage: vscode.Memento): Promise<ModelCatalog | null>
export function getCachedCatalog(storage: vscode.Memento): ModelCatalog | null
export function saveCatalogToCache(catalog: ModelCatalog, storage: vscode.Memento): void
```

Implementation notes:
- Use global `fetch` (Node 18+; VS Code extension host has it).
- Validate origin before fetching: URL must start with `https://raw.githubusercontent.com/jarmo-productory/`.
- Stream body and abort if `content-length` > 512 KB or if streamed bytes exceed cap.
- Call `validateCatalog()` on parsed JSON; on failure, log trace and return `null`.
- On success, call `saveCatalogToCache()` and return the catalog.
- Interval: store last-fetch timestamp alongside cache; `refresh()` skips remote if last
  fetch was within 6 hours (unless called from `modelCatalog.refresh()` explicit path).

### `providerDiscovery.ts`

Consolidates all live probes. Each probe is independent and returns `ModelEntry[] | null`.

```typescript
export async function discoverAnthropic(apiKey: string | null, oauthAvailable: boolean): Promise<ModelEntry[] | null>
export async function discoverOpenAI(apiKey: string | null): Promise<ModelEntry[] | null>
export async function discoverGemini(apiKey: string | null): Promise<ModelEntry[] | null>
export async function discoverCodex(): Promise<ModelEntry[] | null>   // reads models_cache.json
export async function discoverOpenCode(acpRuntime: ACPRuntime | null): Promise<ModelEntry[] | null>
```

`discoverAnthropic` implementation:
1. If `apiKey` present: `fetch('https://api.anthropic.com/v1/models', { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' } })`.
   Map response fields to `ModelEntry[]`. (Exact field names: Phase 0 audit result.)
2. Else if `oauthAvailable`: call `discoverClaudeModels()` from existing `discoverModels.ts`.
   Map its `ModelOption[]` to `ModelEntry[]` (fabricate `tier`, `deprecated: false`, `order: index`).
3. Else: return `null`.

Timeout per probe: 8 seconds (consistent with existing `DISCOVERY_TIMEOUT_MS: 10_000` but
tighter since we are doing concurrent probes).

### `resolver.ts`

```typescript
export type ProvenanceSource = 'live' | 'remote' | 'cache' | 'bundled';

export interface ResolvedProvider {
  models: ModelEntry[];
  defaults: Partial<Record<Surface, string>>;
  source: ProvenanceSource;
}

export async function resolveAll(
  discovery: DiscoveryResults,
  remoteCatalog: ModelCatalog | null,
  cachedCatalog: ModelCatalog | null,
  bundledCatalog: ModelCatalog,
  appVersion: string,
): Promise<Record<Provider, ResolvedProvider>>
```

Waterfall logic per provider:
1. If `discovery[provider]` non-null → use live; merge `deprecated` flags from remote/cache/bundled if available.
2. Else if `remoteCatalog?.providers[provider]` non-null → use remote.
3. Else if `cachedCatalog?.providers[provider]` non-null → use cache.
4. Else → use bundled.

Post-merge: filter out entries where `minAppVersion` is set and `semver.lt(appVersion, entry.minAppVersion)`.
(Implement semver comparison with a minimal regex — no new dep.)

### `index.ts`

```typescript
export async function activate(context: vscode.ExtensionContext): Promise<void>
export function getModels(provider: Provider): ModelEntry[]
export function getDefault(provider: Provider, surface: Surface): string
export function onUpdate(cb: (resolved: Record<Provider, ResolvedProvider>) => void): vscode.Disposable
export function refresh(): Promise<void>
```

State:
- `_resolved: Record<Provider, ResolvedProvider> | null` — null before first resolve pass.
- `_updateEmitter: vscode.EventEmitter<...>`.
- `activate()` calls `refresh()` once immediately, then sets a 6-hour interval.
- `getModels()` / `getDefault()` return from `_resolved` (or bundled if null) — always sync,
  never throws.

---

## Workstream 2: Consumer rewire — extension host (R3, R4)

### `UnifiedViewProvider.ts`

Changes:
- Remove `CLAUDE_MODELS`, `CLAUDE_FALLBACK_MODELS`, `DEFAULT_MODEL` imports.
- On activation: subscribe to `modelCatalog.onUpdate()`.
- Replace the model-list assembly logic (currently inlined) with:
  ```typescript
  const claudeModels = modelCatalog.getModels('anthropic');
  const claudeDefault = modelCatalog.getDefault('anthropic', 'claude-code');
  ```
- On `onUpdate`: push a new `modelCatalog:update` message to the webview with the full
  resolved set so the webview does not need to reload.
- LOC target: ≤ 1100 (baseline from audit; rewire should not add significant LOC since we
  are removing inline logic).

Message shape (new push message type):
```typescript
{ type: 'modelCatalog:update', payload: { resolved: Record<Provider, ResolvedProvider> } }
```

### `FlowEditorProvider.ts`

Changes:
- Remove `fetchOpenAIModels()` and `fetchGeminiModels()` methods (or convert them to thin
  wrappers calling `modelCatalog.getModels('openai')` etc. if the webview requests them by
  message type — Phase 0 will confirm).
- On `flow:modelConfig` message handling: assemble model lists from catalog.

### `LLMNodeExecutor.ts`

- Import `modelCatalog.getDefault('openai', 'flow-llm')` instead of `DEFAULT_MODELS.flowLLM`.
- The static `DEFAULT_MODELS` constant in `modelConfig.ts` may be retained for other executors
  if they have no catalog equivalent yet (image models are out of catalog scope for this sprint).

### `RitemarkSettingsProvider.ts` (line ~1051 connectivity test)

- Replace `BYOK_PROVIDER_MODELS` lookup with `modelCatalog.getModels('anthropic')` (or
  `'openai'` / `'gemini'` per the test's selected provider).

### `src/agent/claudeModels.ts` + `src/codex/codexModels.ts`

- `claudeModels.ts`: delete `CLAUDE_FALLBACK_MODELS`. Delete file if no other exports remain.
- `codexModels.ts`: `getCodexModels()` moved into `providerDiscovery.discoverCodex()`.
  The file is deleted or reduced to a thin re-export stub to avoid import churn if it is
  still transitively imported somewhere. Full deletion preferred; Phase 0 audit confirms.

### `src/agent/index.ts`

- Remove `CLAUDE_MODELS` and `DEFAULT_MODEL` re-exports (they are dead per audit, but the
  backward-compat re-export must be checked against any external callers before deletion).

### `src/ai/modelConfig.ts`

- Delete: `CLAUDE_MODELS`, `DEFAULT_MODEL`, `BYOK_PROVIDER_MODELS`, `ByokProvider`,
  `ByokModelOption`, `toOpenCodeModelValue`.
- Retain: `OPENAI_LLM_MODELS`, `GEMINI_LLM_MODELS`, `OPENAI_IMAGE_MODELS`,
  `GEMINI_IMAGE_MODELS`, `DEFAULT_MODELS` (for image executor defaults until those are
  catalogued), `ModelConfig`, `ImageModelConfig`, `APIType`, `ReasoningEffort`, utility fns.
- Rename decision (Q5 in spec.md): deferred until after deletions land; rename is cosmetic
  and can be a follow-on commit.

---

## Workstream 3: Consumer rewire — webview (R3, R4)

### `webview/src/components/ai-sidebar/store.ts`

Remove hardcoded defaults:
- `selectedModel: 'claude-sonnet-4-5'` → `selectedModel: ''`
- `codexSelectedModel: 'gpt-5.3-codex'` → `codexSelectedModel: ''`
- `pendingRuntime: { ..., modelId: 'claude-sonnet-4-5' }` → `modelId: ''`

Add validation logic in the `agent:config` / `modelCatalog:update` handler:
```typescript
function reconcileSelectedModel(current: string, list: ModelEntry[], defaultId: string): string {
  if (list.some(m => m.id === current)) return current;  // still valid
  return defaultId;  // reset + emit notice
}
```

If the model was reset, push a transient notice: "Switched to [label] — your previous model is
no longer available."

### `webview/src/config/modelConfig.ts`

This file mirrors model config for the webview side (receives `flow:modelConfig`). Verify it
does not carry hardcoded lists; if it does, wire it to receive from the new push message.

---

## Workstream 4: Remote catalog publish (R5)

### `jarmo-productory/ritemark-public`

Create `feeds/model-catalog.json` containing the seeded catalog (see bundled-catalog.json
shape above). This file is maintained manually going forward — adding a model = editing this
JSON, no app release.

### `bundled-catalog.json` (shipped in VSIX)

The same seed content goes into `extensions/ritemark/src/ai/modelCatalog/bundled-catalog.json`
(imported at compile time via `require()` / `JSON.parse(readFileSync(...))`). This is the
offline floor.

No build-script changes needed — JSON files in `src/` are copied to `out/` by `tsc` if
`tsconfig.json` includes `resolveJsonModule: true` (already set in this project).
Verify this during Phase 4.

---

## Workstream 5: Architecture doc update (R6)

### `docs/development/architecture.md`

Sections to update:
- "Model Configuration (Single Source of Truth)": rewrite to describe `src/ai/modelCatalog/`.
- "Open Architectural Debt": move #109 to a "Resolved in Sprint 89" row.
- "Locked Decisions": update the "Model IDs centralised" entry.
- Add "Sprint Architecture Gate" note for Sprint 89.

Inline decision memo format (consistent with existing sprint notes in the doc):
```
**2026-07-01 Sprint 89 Model Gateway:** The "Model IDs centralised in modelConfig.ts" locked
decision (Sprint 79) is evolved: the single authority is now `src/ai/modelCatalog/` (resolver +
remote catalog), not a static array. The spirit (one place to look) is preserved; the mechanism
is now dynamic. Old static arrays (`CLAUDE_MODELS`, `BYOK_PROVIDER_MODELS`) deleted.
Remote-catalog hosting: `jarmo-productory/ritemark-public`. Trust model: HTTPS + schema v1 +
512 KB cap + origin allowlist. Pinned-key signatures: deferred (Phase 2 follow-up issue).
```

---

## Feature Flag

Flag ID: `remote-model-catalog`
File: `extensions/ritemark/src/features/flags.ts`

```typescript
{
  id: 'remote-model-catalog',
  status: 'enabled',
  description: 'Fetch model catalog from ritemark-public; falls back to bundled on disable.',
  platforms: ['all'],
}
```

When `isEnabled('remote-model-catalog')` returns false, `resolver.ts` skips live probes and
remote fetch, using only bundled/cached data.

---

## Phase 0 Gate

All implementation workstreams (1–5) are blocked until `research/phase0-audit.md` is complete.
The audit answers Open Questions 1, 2, 4, and 5 from spec.md and provides the Anthropic API
response shape needed to write `schema.ts` correctly.
