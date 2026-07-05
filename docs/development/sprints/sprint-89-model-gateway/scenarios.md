# Sprint 89 Scenarios — Model Gateway

These scenarios are the manual QA matrix for Sprint 89. The tasks.md Phase 5 (QA) section
refers back to this file by scenario title. Each scenario maps to one or more requirements
from spec.md.

---

## Feature: Catalog subsystem API (R1)

### Scenario: Cold start — no network, no disk cache
Given the app starts for the first time with no internet and no `globalStorage` cache
When the extension activates
Then `modelCatalog.getModels('anthropic')` returns the bundled baseline Claude models
And startup does not throw or block
And the UI does not show an empty model dropdown

### Scenario: Cold start — no network, disk cache present
Given the extension has previously fetched and cached a remote catalog
And the app starts with no internet
When the extension activates
Then `modelCatalog.getModels('anthropic')` returns the disk-cached models (tagged `source: 'cache'`)
And any model entries with `deprecated: true` from the cache are filtered from dropdowns
  or visually marked

### Scenario: onUpdate fires after live probe completes
Given the AI sidebar is open with the bundled model list
When a live Anthropic `/v1/models` probe completes successfully
Then `modelCatalog.onUpdate` fires
And the AI sidebar model dropdown re-renders with the live list (tagged `source: 'live'`)
And no page reload or restart is required

### Scenario: refresh() called on Settings open
Given the user opens the Settings page
When `RitemarkSettingsProvider` calls `modelCatalog.refresh()`
Then a fresh live probe + remote fetch cycle starts
And on completion `onUpdate` fires and all subscribed dropdowns update

### Scenario: remote-model-catalog flag disabled
Given the `remote-model-catalog` feature flag is set to disabled
When the extension activates
Then neither the live probe nor the remote fetch runs
And `modelCatalog.getModels('anthropic')` returns bundled data only
And startup is functionally identical to the pre-Sprint 89 state

---

## Feature: Waterfall resolution (R2)

### Scenario: Anthropic live probe — API key present
Given the user has a valid Anthropic API key in Settings
When the extension runs the live probe for Anthropic
Then it calls `GET https://api.anthropic.com/v1/models` with `x-api-key: <key>`
And the response includes current models (including post-bundle releases like `claude-sonnet-5`)
And the resolved list is tagged `source: 'live'`

### Scenario: Anthropic live probe — no API key, OAuth present
Given the user has no Anthropic API key stored
And the user is logged in via Claude CLI OAuth
When the waterfall runs for Anthropic
Then the API-key REST probe is skipped
And `supportedModels()` (SDK OAuth path) is tried as the fallback live source
And if it succeeds, the list is tagged `source: 'live'`

### Scenario: Anthropic live probe — no key, no OAuth
Given the user has no API key and no OAuth session
When the waterfall runs for Anthropic
Then both the REST probe and `supportedModels()` are skipped or fail silently
And the resolver falls through to remote catalog (if available) then cache then bundled
And no error is shown to the user (silent degradation)

### Scenario: Live probe — network timeout
Given the user has an API key but the network is unreachable
When the live probe for Anthropic times out (default 8 s)
Then the resolver falls to the next waterfall level
And the UI receives the best available list without delay after the timeout
And no error toast is shown (timeout is expected in offline mode)

### Scenario: Codex model discovery from cache file
Given `~/.codex/models_cache.json` exists and contains valid model entries
When `providerDiscovery.ts` resolves Codex models
Then the list is built from the cache file (sorted by priority, filtered to `visibility === 'list'`)
And `FALLBACK_MODELS` is only used when the file is missing or unparseable

### Scenario: OpenCode model discovery from ACP configOptions
Given the OpenCode runtime is running and exposes `configOptions[id="model"]`
When `providerDiscovery.ts` resolves OpenCode models
Then the returned list matches the ACP-advertised options
And the list supersedes any cached entry for the `opencode` provider

### Scenario: deprecated flag merging
Given the remote catalog marks `claude-opus-4-6` as `deprecated: true`
But the live `/v1/models` API still returns `claude-opus-4-6` in its list
When the waterfall resolves
Then `claude-opus-4-6` appears in the merged list with `deprecated: true`
And it is visually distinguished in the dropdown (e.g. greyed out or labeled "deprecated")

---

## Feature: Dead registry cleanup (R3)

### Scenario: CLAUDE_MODELS import removed
Given Sprint 89 Phase 3 is complete
When a developer runs `grep -rn "CLAUDE_MODELS" extensions/ritemark/src/`
Then there are zero matches (constant deleted from modelConfig.ts, import from agent/index.ts removed)

### Scenario: DEFAULT_MODEL import removed
Given Sprint 89 Phase 3 is complete
When a developer runs `grep -rn "DEFAULT_MODEL[^S]" extensions/ritemark/src/`
Then there are zero matches

### Scenario: CLAUDE_FALLBACK_MODELS removed
Given Sprint 89 Phase 3 is complete
When a developer runs `grep -rn "CLAUDE_FALLBACK_MODELS" extensions/ritemark/src/`
Then there are zero matches and `claudeModels.ts` either does not exist or is an empty re-export

### Scenario: TypeScript compiles cleanly after deletions
Given all zombie constants and stale defaults have been deleted
When `tsc --noEmit` is run on the extension host
Then exit code is 0 and no new type errors are introduced by the deletions

### Scenario: Webview store default no longer hardcoded
Given the webview store initialises
When no model list has arrived from the host yet
Then `selectedModel` is `''` (empty) or explicitly `undefined` — not a hardcoded stale ID
And once the host sends `agent:config` with resolved models, the store sets the default

---

## Feature: Consumer rewire (R4)

### Scenario: AI sidebar model dropdown — Claude runtime
Given the AI sidebar is open for the Claude Code runtime
And the live probe has succeeded
When the user opens the model dropdown
Then the dropdown shows the live Claude model list (e.g. includes `claude-sonnet-5`)
And the previously selected model is retained if it is still in the list

### Scenario: AI sidebar model dropdown — selected model no longer available
Given `claude-sonnet-4-5` was the user's selected model
And the resolved model list after catalog refresh no longer includes `claude-sonnet-4-5`
When the webview receives the new model list
Then `selectedModel` is reset to the catalog default for that runtime
And a visible notice is shown: "Switched to [new default] — your previous selection is no longer available"

### Scenario: Flow editor LLM node model dropdown
Given a Flow with an LLM node using provider `openai`
When the user opens the LLM node in the Flow editor
Then the model dropdown shows the OpenAI-resolved list (not `OPENAI_LLM_MODELS` static array)
And the list updates on next catalog refresh without app restart

### Scenario: Settings connectivity test respects catalog
Given the user opens Settings and tests an Anthropic API key
When the connectivity test runs
Then it selects a test model from `modelCatalog.getModels('anthropic')` (not from deleted `BYOK_PROVIDER_MODELS`)
And the test completes normally

### Scenario: UnifiedViewProvider LOC gate
Given Sprint 89 Phase 3 is complete
When `wc -l extensions/ritemark/src/views/UnifiedViewProvider.ts` is run
Then the output is 1100 or fewer lines

---

## Feature: Bundled baseline + remote catalog (R5)

### Scenario: Remote catalog fetch — happy path
Given the `remote-model-catalog` flag is enabled
And the extension activates with network access
When `remoteSource.ts` fetches from `raw.githubusercontent.com/jarmo-productory/ritemark-public/...`
Then the response is parsed against schema v1
And if valid, it is stored to `globalStorage` and merged into the waterfall

### Scenario: Remote catalog fetch — schema validation failure
Given `ritemark-public` hosts a catalog with an unexpected `schemaVersion: 2`
And the local resolver only understands v1
When `remoteSource.ts` fetches the catalog
Then schema validation fails
And the resolver falls to on-disk cache (or bundled if no cache)
And no error is surfaced to the user

### Scenario: Remote catalog fetch — size cap exceeded
Given `ritemark-public` accidentally hosts a 600 KB model-catalog.json
When `remoteSource.ts` reads the response
Then the fetch is aborted after 512 KB
And the resolver falls to cache/bundled

### Scenario: Remote catalog fetch — wrong origin
Given some code attempts to fetch a model catalog from `example.com`
When `remoteSource.ts` validates the URL
Then the fetch is rejected before the network call is made
And a trace log entry is written

### Scenario: minAppVersion filtering
Given the remote catalog contains a model entry `{ id: 'claude-sonnet-5', minAppVersion: '1.9.0' }`
And the running app version is `1.8.5`
When the catalog is resolved
Then `claude-sonnet-5` is silently excluded from the resolved list for that version

### Scenario: Interval refresh
Given the `remote-model-catalog` flag is enabled
And the extension has been running for 6 hours without a manual refresh
When the interval fires
Then `remoteSource.ts` runs a new fetch cycle
And on success, `onUpdate` fires and consumers re-render

### Scenario: Seeded catalog contains claude-sonnet-5
Given `feeds/model-catalog.json` has been published to `ritemark-public`
When a developer reads the file
Then it contains a `claude-sonnet-5` entry under `providers.anthropic.models`
And it does not contain `CLAUDE_MODELS`-era stale ids as the default

---

## Feature: Architecture doc + governance (R6)

### Scenario: Architecture.md reflects new subsystem
Given Sprint 89 Phase 4 is complete
When a developer reads `docs/development/architecture.md` section "Model Configuration"
Then it describes `src/ai/modelCatalog/` as the single source of truth
And it no longer describes `CLAUDE_MODELS` / `DEFAULT_MODEL` as canonical

### Scenario: GH #109 closed
Given Sprint 89 is merged to main
When a developer opens GH #109
Then the issue is closed with a link to the Sprint 89 PR

---

## Edge Cases and Rejection Paths

### Scenario: Catalog update race — two concurrent refresh() calls
Given two refresh cycles are triggered simultaneously (e.g. Settings open + interval)
When both complete
Then the later-completing cycle's result wins (last-write wins on `globalStorage`)
And `onUpdate` fires at most once per cycle (not twice for the same data)

### Scenario: Partial provider failure
Given the live probe succeeds for Anthropic but times out for OpenAI
When the waterfall resolves
Then Anthropic models are tagged `source: 'live'` (fresh)
And OpenAI models are resolved from the best available non-live source (remote/cache/bundled)
And neither failure blocks the other provider

### Scenario: modelCatalog.getModels() called before activation completes
Given some consumer calls `getModels()` synchronously at module load time
When the catalog has not yet run its first waterfall pass
Then `getModels()` returns the bundled baseline synchronously (never throws, never returns empty)
