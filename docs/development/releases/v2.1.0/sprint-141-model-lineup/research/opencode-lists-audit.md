# OpenCode's own model list (A3)

Audit for R2 and R10 (#529), 26–27 October 2026. It used:
- OpenCode's source at v1.19.4 (`148842ef`), compared with v1.18.30, v1.18.34, v1.19.0 and v1.19.3;
- the public models.dev registry;
- OpenRouter's public model list;
- a keyless run of the bundled OpenCode (*The keyless run*, below).

**No provider key was used, and no request reached a provider.** Line numbers are at v1.19.4.

## The registry OpenCode lists from

- **Two sources** (`packages/core/src/models-dev.ts`):
  - a models.dev snapshot compiled into the binary (`build.ts:196`);
  - a runtime fetch of `https://models.opencode.ai/api.json`, the same service as models.dev (`:160`, `:176`).
- **Load order:**
  1. the disk cache (`$XDG_CACHE_HOME/opencode/models.json`, the same file a person's own OpenCode uses unless XDG is isolated);
  2. the compiled snapshot;
  3. an empty registry if `OPENCODE_DISABLE_MODELS_FETCH` is set.
- **Refresh:**
  - at start, then every 60 minutes, when the cache is more than 5 minutes old;
  - 10-second timeout, two retries;
  - errors only logged, so offline startup isn't blocked.
- **Overrides:** `OPENCODE_MODELS_URL` moves the source, `OPENCODE_MODELS_PATH` pins a file.
- **Version differences:** `models-dev.ts` is identical in every OpenCode Ritemark has shipped (1.18.30 to 1.19.4).
- **Older builds** do fetch models released after them. But an `opencode acp` process keeps the list it built at its first `session/new` for a folder, and a model's provider SDK version is fixed at build time. So R8 still gates OpenCode's new rows to 2.0.0 (OpenCode 1.19.3, the version Argon was run on).

## Which providers are listed

- **A provider is listed when one of its environment variables is set** (`provider.ts:1636–1647`):
  - Google: `GOOGLE_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `GEMINI_API_KEY`;
  - `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`.

  Ritemark sets these from its saved keys (`acp/acpKeyEnv.ts`).
- **Listing makes no call to the provider.** A wrong key lists the same models.
- **OpenCode's own `opencode` provider lists its free models with no key at all** (`provider.ts:220–242`).
- **Other providers can appear without a Ritemark key:** keys a person stored with OpenCode itself (`auth.json`), or their own global OpenCode config. Ritemark's menu shows only the providers it has a key for (`byokProviderFlags`), so these don't reach it.
- **Filtering** (`:1747–1748`): models whose status is `deprecated` are removed, and `alpha` ones unless an experimental flag is set. **There is no tool-calling or model-type filter**, so embedding, speech and image models can be listed.

## What Ritemark already receives

- **`session/new` returns `configOptions`** with a `model` option (`acp/config-option.ts:31–50`). Its `options` are `{ value, name }` only:
  - `value` is the route, such as `google/gemini-4-argon`; `name` is "Google/Gemini 4 Argon";
  - there is no description, tool support, status or cost.
- **Order:** providers in the order they were added; models sorted by display name within each.
- **An id that isn't listed is refused.** Setting one via `setSessionConfigOption` or `unstable_setSessionModel` fails with `model not found: <value>` (`service.ts:964–984`). So the list is exactly what this OpenCode will run.
- **What Ritemark does with it:** `AcpManager` keeps `configOptions` for each session (`src/acp/acpManager.ts:178`, `:197`, `:247`), and reads only the thought level from it.
- **`opencode models [provider] --verbose`** prints the same set with each model's full record (`capabilities.toolcall`, `status`, `limit`). But it loads the whole project first (config, plugins, language servers), so it isn't light.

## The keyless run

Filled in on the OpenCode that ships (1.19.4) before merge 2: the free models listed, the list's shape, and the time and process cost of each way to read it.

## Design (proposal for merge 2)

- **The source.** Use OpenCode's own list from the `session/new` that `AcpManager` already makes: no new process.
  - Keep the last `model` option per provider-key fingerprint in globalState, so the next start has it before any chat.
  - Before the first OpenCode chat ever, the static rows serve.
  - `opencode models` would cost a full project load for each probe.
- **The filter** (`opencodeLiveList.ts`), on the route alone, because the ACP list carries no capabilities:
  - patterns per vendor drop embedding, `tts`, `image`, `live`, `audio`, `:batch` and `-customtools` variants;
  - OpenRouter keeps only routes into Google, OpenAI and Anthropic, plus the catalog's own OpenRouter rows.
- **Narrowing** by Google's and OpenAI's own lists for the key, where Flows already asks. Google's troubleshooting page says its list doesn't check what a key may use, so this narrowing can't drop a 2.5 model for a new account (A2).
- **The resolver** merges per vendor: a vendor with live rows takes them, enriched from the static rows, and every other vendor keeps its static rows.
- **The decision for merge 2** follows the keyless run:
  - **go** if reading the kept option costs nothing new and the filtered menu stays short;
  - **cut to v2.2.0** otherwise (decision 2).
