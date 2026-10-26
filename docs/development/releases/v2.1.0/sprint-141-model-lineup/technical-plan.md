# Sprint 141 Technical Plan

The plan for [spec.md](spec.md). The release is 2.1.0. Its shape is in `ritemark-dev`: `releases/v2.1.0/shape.md`, item 4, approved by Jarmo on 21 October 2026.

Code shapes here are proposals. When the code needs something else, this file changes first. File references are to `main` at `1e91466c` (Sprint 137's merge). Paths are under `extensions/ritemark/` unless they say otherwise.

## What exists today

| Part | Today | File |
|---|---|---|
| Model ids | `GEMINI_MODEL_IDS` has 3.1 Pro preview, 3.8 Flash, 3.5 Flash Lite and the three 2.5s; no Argon. `OPENROUTER_MODEL_IDS` has only Llama 3.3 70B. Other OpenRouter routes are composed from provider ids with `toOpenCodeModelId` | `src/ai/modelConfig.ts:61–69`, `:84` |
| Flows' defaults | `DEFAULT_MODELS.flowLLM` (GPT-5.2) and `flowLLMGemini` (Gemini 2.5 Flash) | `src/ai/modelConfig.ts:417–432` |
| The bundled catalog | `updatedAt` 2026-10-19. Gemini `flow-llm` default `GEMINI_MODEL_IDS.FLASH_2_5`, written separately from `DEFAULT_MODELS`. OpenCode's groups: Google (4), OpenAI (6), Anthropic (Sonnet 5, Opus 5, Opus 4.8), OpenRouter (9), with no default | `src/ai/modelCatalog/bundledCatalog.ts:39`, `:70–80`, `:97–124` |
| The resolver | Row-by-row merge of bundled and feed (`mergeStatic`), defaults picked over rows already filtered by `minAppVersion` (`mergeDefaults`), a live list that replaces a provider's whole list (`resolveProvider`) | `src/ai/modelCatalog/resolver.ts:52`, `:81`, `:197`, `:237`, `:381` |
| Claude declarations | Built from the merged static Anthropic rows. Any feed row with `claudeCode.inject` is declared, including a model the bundled CLI knows natively | `src/ai/modelCatalog/index.ts:185` (`computeDeclarations`); `runtimeDeclarations.ts` |
| Live probes | Anthropic, OpenAI, Gemini and Codex. `discoverOpenCode()` returns `null` ("deferred") | `src/ai/modelCatalog/providerDiscovery.ts:233`; wired in `src/extension.ts:491–510` |
| OpenCode's lists to the sheet | `getByokProviderModels()` groups `opencode` rows by vendor prefix, for `agent:bootstrap` and one-shot settings | `src/ai/modelCatalog/index.ts:253`; `src/views/UnifiedViewProvider.ts:2132`, `:2383`, `:2741` |
| OpenCode's readiness | Ready only when a provider with a key has at least one row | `src/runtime/availability.ts:128–138` |
| OpenCode's own model list | `session/new` returns `configOptions` with a `model` option whose `options` are every model OpenCode can run with the providers in its environment. Ritemark keeps `configOptions`, and reads only the thought level and sets the model | `src/acp/acpManager.ts:178`, `:197`, `:247`; `scripts/lib/verify-opencode.mjs:97–114` reads the model options |
| The feed export | Bundled rows plus the feed's automated rows and tombstones; curated feed-only rows dropped; defaults from bundled. It drops every feed-only field on a row the bundled lineup also has | `src/ai/modelCatalog/feedExport.ts:26`, `:39`; `scripts/export-bundled-model-catalog.ts` |
| Flows' Gemini default | The run uses the catalog's default (`getDefault('gemini', 'flow-llm')`). The editor uses `DEFAULT_MODELS` sent by the host, so a feed default reaches the run and never the editor | `src/flows/nodes/LLMNodeExecutor.ts:280`; `src/flows/FlowEditorProvider.ts:241–256`; `webview/src/config/modelConfig.ts:84`; `NodeConfigPanel.tsx:443`; `flowEditorStore.ts:270`; `nodes/LLMNode.tsx:29` |
| A Gemini step's error | Google's `error.message` or "Gemini API error: <status>", then mapped for rate limit, invalid key and quota; else "LLM error: …" | `src/flows/nodes/LLMNodeExecutor.ts:300–305`, `:350–364` |
| Error matchers | Sprint 139's `unwrapProviderMessage` and the `model` kind's matchers, including Google's "is not found for API version v1beta" (documented) | `src/runtime/runtimeErrorPresentation.ts:173`, `:300` |
| The Anthropic check | `npm run check:anthropic-models` | `scripts/check-anthropic-model-catalog.ts`, `src/ai/modelCatalog/anthropicCatalogCheck.ts` |
| The id rule | `modelConfig.test.ts` fails on a model id literal outside `modelConfig.ts` | `src/ai/modelConfig.test.ts` |
| The flows skill | Lists `gpt-5-mini` (default), `gemini-2.5-flash`, `gemini-3-pro`, `imagen-4`: stale | `.claude/skills/ritemark-flows/SKILL.md:170–186` (repo root) |

## Checked while planning (26 October)

These facts shape the requirements. Each is reproducible from the note beside it. The scripts were scratch files, not part of the plan.

1. **The resolver families.** The catalog first shipped in v1.8.1 (Sprint 89). So fourteen releases read the feed: 1.8.1, 1.8.3–1.8.6, 1.9.0, 1.10.0, 1.10.1, 1.11.0, 1.12.0, 1.13.0, 1.14.0, 2.0.0 and 2.0.1.
   - **1.8.1–1.11.0** use the feed's provider list *whole*:
     - 1.8.1–1.10.1 whatever its date (v1.8.1's and v1.10.1's `resolver.ts`: remote, then cache, then bundled);
     - 1.11.0 only when the feed is at least as new as its bundled catalog (`isCatalogAtLeastAsFresh`, Sprint 116).

     They take the feed's defaults as written, and their `getDefault` falls back to the first visible row when the default's row is gated away. v1.11.0's schema ignores `provenance`, `addedAt`, `retired` and `claudeCode`, so a tombstone would show there as an ordinary row; A1 confirms the same for 1.8.1–1.10.1.
   - **v1.12.0's `resolver.ts`** differs from v2.0.0's (and `main`'s) only in `hideOlderClaudeModels`. Its `mergeDefaults` picks among rows already filtered by `allowedByAppVersion`.
   - **2.0.1** shipped from `7810385d` (its release plan). The native repository has no `v2.0.1` tag; its catalog sources equal `main`'s.
2. **The claim that a gated feed default falls through holds for 1.12.0, not for 1.11.0.** Each release's resolver and bundled catalog (`git archive` of the tag) resolved a test feed. The test feed was today's feed, with:
   - `updatedAt` 2026-11-01;
   - a Codex default `gpt-6.1-sol` on a row gated `minAppVersion: '1.14.0'`;
   - a Claude default `claude-sonnet-5-5`.

   | Version | Codex default resolved | Claude default |
   |---|---|---|
   | 1.11.0 | `gpt-6-astra` (the first visible row) | `claude-sonnet-5-5` |
   | 1.12.0 | `gpt-5.6-sol` (its bundled default) | `claude-sonnet-5-5` |
   | 1.13.0 | `gpt-5.6-sol` (its bundled default) | `claude-sonnet-5-5` |
   | 1.14.0 | `gpt-6.1-sol` | `claude-sonnet-5-5` |
   | 2.0.0 / 2.0.1 | `gpt-6.1-sol` | `claude-sonnet-5-5` |

   The same run showed what a fresher feed does on 1.14.0 and 2.0.x: its older shared rows win. Sonnet 5 sorts before Sonnet 5.5, and Opus 4.8 and Haiku 4.5 lose their deprecation. This is #530's point 2, and why the refresh must carry 2.1's lineup whole.
3. **Today's feed** (`ritemark-public` `c4808be`, `updatedAt` 2026-09-29, a 2026-10-24 `addedAt` on the two Argon rows):
   - **1.8.1–1.11.0** show it whole (1.11.0's bundled catalog is from 2026-09-13, older than the feed);
   - **1.12.0** (bundled 2026-09-24) takes its shared rows and defaults: Claude Sonnet 5, Codex GPT-5.6 Sol, and Sonnet 5.5 through `claudeCode.inject`;
   - **1.13.0, 1.14.0 and 2.0.x** keep their bundled rows and gain only the Argon rows.
4. **Only 1.12.0 needs Sonnet 5.5's declaration.**
   - Claude Code 2.1.281 (1.12.0) resolves `sonnet` to Sonnet 5.
   - 2.1.289 (1.13.0) and later resolve it to `claude-sonnet-5-5` natively (`docs/development/agent-runtime-compatibility.md`).
   - Haiku 5.5 is native from 2.1.296 (1.14.0).
   - On 2.1.304, the model-picker probe with a `modelPicker` declaring a model it already knows listed the same rows (the v2.0.0 entry), so the list doesn't change. Whether a session on the declared id carries the 64,000-token cap is what A1 checks.
5. **Bundled lineups by release:**

   | Release | Bundled `updatedAt` | Claude default | Codex default | Gemini `flow-llm` | Claude Code |
   |---|---|---|---|---|---|
   | 1.11.0 | 2026-09-13 | Sonnet 5 | GPT-5.6 Sol | 2.5 Flash | — |
   | 1.12.0 | 2026-09-24 | Sonnet 5 | GPT-5.6 Sol | 2.5 Flash | 2.1.281 |
   | 1.13.0 | 2026-10-04 | Sonnet 5.5 | GPT-5.6 Sol | 2.5 Flash | 2.1.289 |
   | 1.14.0 | 2026-10-13 | Sonnet 5.5 | GPT-6.1 Sol | 2.5 Flash | 2.1.296 |
   | 2.0.0 / 2.0.1 | 2026-10-19 | Sonnet 5.5 | GPT-6.1 Sol | 2.5 Flash | 2.1.304 |

6. **OpenRouter's public model list** (`GET https://openrouter.ai/api/v1/models`, no key; 468 models, 400 with tool calling):
   - it serves `google/gemini-4-argon`, `anthropic/claude-sonnet-5.5`, `anthropic/claude-opus-5.5` and `openai/gpt-6.1-sol`, all with tools;
   - its Claude ids use a dot (`claude-sonnet-5.5`). `anthropic/claude-sonnet-5`, the current route, exists.
7. **models.dev** (`https://models.dev/api.json`, the registry OpenCode reads) lists every R1 and R2 row under `google`, `anthropic`, `openai` and `openrouter`, with `tool_call: true`. Whether the bundled OpenCode reads it live or from a snapshot built into the binary is A3's.
8. **`npm run check:anthropic-models`** on `main`: OK.
   - Catalog v3177, issued 2026-10-26.
   - Bundled Claude Code 2.1.304.
   - Main models: Opus 5.5 (2.1.280+), Sonnet 5.5, Fable 5.1 (2.1.251+), Haiku 5.5.
   - No warnings.
9. **Latest runtimes:**
   - npm `@anthropic-ai/claude-code` 2.1.310 and `@anthropic-ai/claude-agent-sdk` 0.3.310;
   - Codex `rust-v0.164.0` (23 October);
   - OpenCode 1.19.4 (22 October);
   - `@agentclientprotocol/sdk` 2.0.2 (bundled 1.4.0).

## Architecture overview

| Layer | What changes | Where |
|---|---|---|
| Model ids | Argon; OpenRouter's own ids for the new routes; `GEMINI_LLM_MODELS`' Argon row | `src/ai/modelConfig.ts` |
| Bundled catalog | Argon (R1); OpenCode's new rows (R2); Gemini defaults from `DEFAULT_MODELS`; 2.5 rows deprecated; gates ≤ `main`'s version; `updatedAt` | `src/ai/modelCatalog/bundledCatalog.ts` |
| Declarations | Bundled ids take their declaration from the bundled row (R7) | `src/ai/modelCatalog/runtimeDeclarations.ts`, `index.ts` |
| Feed tooling | The export's carry-over (R6); the per-version check (R9) | `src/ai/modelCatalog/feedExport.ts`; `scripts/check-model-feed.ts` (new) |
| Flows | The editor's defaults from the catalog (R4); the Gemini step's refusal sentence (R5) | `src/flows/FlowEditorProvider.ts`, `src/flows/nodes/LLMNodeExecutor.ts` |
| OpenCode live lists | `discoverOpenCode()`, a pure filter, a per-vendor merge in the resolver (R10) | `src/ai/modelCatalog/providerDiscovery.ts`, `opencodeLiveList.ts` (new), `resolver.ts`, `src/extension.ts`; maybe `src/acp/acpManager.ts` (A3) |
| Runtimes | Manifest rows, the SDK pin, the lockstep snapshots, the compatibility matrix (R11) | `binaries/agents/manifest.json`, `package.json`, `scripts/validate-agent-runtime-manifest.mjs` (repo root), `docs/development/agent-runtime-compatibility.md` |
| The feed | Exported, gated, checked, published with 2.1 (R8) | `jarmo-productory/ritemark-public` `feeds/model-catalog.json` |

**Release tier: shell**, because of W4. The manifest is under `extensions/ritemark/binaries/`, and the Claude Agent SDK is an esbuild external that only a full release delivers. Every other change is under `extensions/ritemark/src/` or `webview/`. It ships in 2.1.0's shell release. If the runtime review decides no update, the tier is extension.

No new runtime, no change to `AgentRuntime`, no new subsystem. The `remote-model-catalog` flag keeps gating the feed, the probes and the declarations, OpenCode's live list included.

## Phase 1 audits

1. **`research/feed-readers-audit.md` (A1; R6–R9).** Who reads the feed, and what the refresh does to each.
   - **Version counts.** The Development manager reads them from PostHog: distinct ids with `app_session_start` per `app_version`, over the last 30 days, `build_channel = prod`. This decides how much weight 1.8.1–1.11.0 get (*Open Questions* 9).
   - **The candidate.** Exported from this branch with R6, and gated. The check (R9) runs over every release, and its report goes in this audit.
   - **Sonnet 5.5's declaration** on the Claude Code of 1.12.0, 1.13.0, 1.14.0, 2.0.x and 2.1. Sprint 127's `model-picker-probe.mjs` (unauthenticated, isolated home) with and without the declaration, and `request-capture.mjs` (a local server, a placeholder key). It records:
     - the listed rows;
     - the request id and `max_tokens` a session sends for the catalog's default and for a saved `claude-sonnet-5-5`.

     Old Claude Code builds come from their npm tarballs (the manifest's `sourceUrl` of each tag).
   - **The gates per row:**
     - GPT-6.1 Sol (from which Codex);
     - Haiku 5.5;
     - OpenCode's new rows, which depend on A3's finding about older OpenCode builds;
     - anything the runtime review adds.
   - **`getDefault`** has the same rule in every release's `index.ts` (confirmed by reading each tag's file).
   - **The decision:** the gate list, the accepted report, 1.8.1–1.11.0's Codex default, and whether R7's rule changes anything for 1.13–2.0.x users (they can't get it; it is noted).
2. **`research/gemini-default-audit.md` (A2; R3, R5).**
   - Google's models page and deprecation notes, dated and quoted under 15 words each:
     - what "legacy, limited to past users" means;
     - the documented error for a model a key can't use.
   - Gemini 3.8 Flash's and 3.5 Flash Lite's thinking:
     - whether thinking tokens count against `maxOutputTokens`;
     - the default thinking level over the REST API;
     - whether a step at Max tokens 2,000 can end with `finishReason: MAX_TOKENS` and no text.

     That decides R3's default.
   - Flows in the repo, the starter pack and the flows skill that name a 2.5 model.
   - **Not run:** a new account's answer for 2.5 Flash and 2.5 Pro (no key).
   - **The decision:** the default, the matchers R5 may use (documented wording only), and the words, decided by the Development manager as small wording.
3. **`research/opencode-lists-audit.md` (A3; R2, R10).** On the OpenCode that ships (W4 first).
   - **The source.** OpenCode's model list read three ways, with time and process cost recorded:
     - `session/new`'s `configOptions` (an ACP handshake Ritemark already makes for a chat);
     - `opencode models` with the provider environment;
     - OpenCode's source for both.

     Run keyless in an isolated XDG home, where it lists the free `opencode/*` models.
   - **Providers from the environment.** From OpenCode's source: which environment variables register a provider, and that listing makes no provider call. No placeholder key is used unless the Development manager agrees, and even then it proves only the list, never a turn.
   - **The registry.**
     - Does the bundled OpenCode read models.dev live, from a snapshot, or both?
     - How often, and what happens offline?
     - Do older OpenCode builds (1.18.30 in 1.12.0, 1.19.0, 1.19.3) know models released after them? That sets R8's gates for OpenCode's rows.
   - **The shape.** What each option carries (`value`, `name`, more?), the list's size per provider (OpenRouter's ~390), and fixtures recorded for the tests (`src/ai/modelCatalog/testdata/opencode-models-*.json`).
   - **The filter.** Patterns per provider for chat models with tools (no `embedding`, `tts`, `image`, `live`, `:batch`), the families kept on OpenRouter, and the menu's resulting length. The Experience lead gets a screenshot of the composer's OpenCode groups built from the fixtures.
   - **Narrowing.** How Google's `/v1/models` and OpenAI's `/v1/models` answers for a key would intersect, from documented response shapes. A new account's actual answer is not run.
   - **R2's evidence still missing:** OpenAI's own model page for GPT-6.1 Sol through the API.
   - **The decision:** the source, the filter, the gates, and go or cut for merge 2 (*Open Questions* 2).
4. **`research/runtime-review.md` (A4; R11).**
   - For each runtime, every release between the bundled one and the latest, with the changes that touch Ritemark:
     - Claude Code: SDK options, models, background work;
     - Codex: JSON-RPC methods Ritemark uses, models, resume (0.164.0 "restores saved thread settings" on resume);
     - OpenCode: ACP, `session/request_permission`, MCP, models.
   - A recommendation for each runtime, `check:anthropic-models`, and the verification plan.
   - The release plan's *Runtime versions* section is updated from it.

## Workstream 1: The lineup (R1, R2)

- **`modelConfig.ts`:**
  - `GEMINI_MODEL_IDS.ARGON_4 = 'gemini-4-argon'`, and a `GEMINI_LLM_MODELS` row (`api: 'chat'`, `reasoning: 'medium'`, `costTier: 'high'`);
  - `OPENAI_MODEL_IDS.SOL_6_1 = CODEX_MODEL_IDS.SOL_6_1`, for OpenCode's OpenAI row;
  - `OPENROUTER_MODEL_IDS` gains OpenRouter's own ids for the new routes, `anthropic/claude-sonnet-5.5` among them. Routes whose OpenRouter id equals `<vendor>/<provider id>` keep using `toOpenCodeModelId`.
- **`bundledCatalog.ts`:**
  - **Gemini:** Argon at order 0, then 3.1 Pro, 3.8 Flash, 3.5 Flash Lite; the three 2.5s after them, `deprecated: true`, "Retained for saved selections".
  - **OpenCode's Google group:** `google/gemini-4-argon` first; `google/gemini-2.5-pro` deprecated, the same words.
  - **OpenCode's Anthropic group:** Sonnet 5.5, Opus 5.5, Haiku 5.5 before Sonnet 5 and Opus 5; Opus 4.8 stays.
  - **OpenCode's OpenAI group:** GPT-6.1 Sol first.
  - **OpenCode's OpenRouter group:** Argon, Claude Sonnet 5.5 and GPT-6.1 Sol.
  - **Gates:** a bundled row may carry `minAppVersion` ≤ `main`'s version (2.0.1 today) when A1 needs it for the feed. A unit test checks every bundled gate against `package.json`'s version.
  - **`updatedAt`** moves to the merge's day. The header comment records the lineup's change and the runtime versions.
- **Tests:**
  - `modelConfig.test.ts`: the literal scan, and the Argon and default rows;
  - `modelCatalog.test.ts`:
    - bundled-only resolution with Argon first;
    - today's feed (a fixture copy of `c4808be`) with Argon once;
    - OpenRouter's ids;
    - Claude below 5 hidden in `getByokProviderModels()`.

## Workstream 2: Flows (R3–R5)

- **The default (R3):** `DEFAULT_MODELS.flowLLMGemini` becomes A2's model. The bundled catalog's `flow-llm` defaults become `DEFAULT_MODELS.flowLLM` and `DEFAULT_MODELS.flowLLMGemini`, so the default is written once.
- **One default (R4):**
  - `FlowEditorProvider.sendModelConfig()` sends `defaults` with `flowLLM` and `flowLLMGemini` from `modelCatalog.getDefault('openai' | 'gemini', 'flow-llm')`. The image defaults stay `DEFAULT_MODELS`' (image lists aren't in the catalog).
  - It re-sends on `modelCatalog.onUpdate`, as the sheet does, so a feed change reaches an open editor.
  - The webview's `modelConfig.ts` is unchanged: it already reads `defaults` from the message.
- **The refusal sentence (R5):**
  - `LLMNodeExecutor`'s Gemini path keeps the status and Google's body.
  - On failure it asks a small pure helper, `providerModelRefusal(provider: 'google', status, body)`, which uses Sprint 139's `unwrapProviderMessage` and the `model` kind's documented Google matchers from `runtimeErrorPresentation.ts`, exported for this, not copied.
  - When it matches, the step throws R5's sentence, with the model's catalog label (`modelCatalog.getModel('gemini', id)?.label ?? id`).
  - The raw body goes to the execution log, where the run's details show it.
  - Today's rate-limit, key and quota mapping comes first and is unchanged.
- **The flows skill (E5):** its model list points to `modelConfig.ts` and the catalog's `flow-llm` defaults, with no ids of its own.
- **Tests:**
  - `LLMNodeExecutor` with a mocked `fetch`:
    - a step with no `model` requests the catalog's default;
    - the documented 404 gives R5's sentence;
    - an unmatched error gives Google's sentence once;
    - key, quota and rate limit unchanged;
  - `FlowEditorProvider`'s config message carries the catalog's defaults (a test feed);
  - the webview: a new Gemini step takes `defaults.flowLLMGemini`.

## Workstream 3: The feed tooling (R6–R9)

- **The export (R6),** in `feedExport.ts`:

  ```ts
  /** Sprint 141 R6: fields older apps need that only the feed carries. */
  function carryOver(bundledRow: ModelEntry, currentRow: JsonObject | undefined): Partial<ModelEntry> {
    if (!currentRow) return {};
    return {
      ...(bundledRow.claudeCode === undefined && isObject(currentRow.claudeCode) ? { claudeCode: currentRow.claudeCode } : {}),
      ...(bundledRow.minAppVersion === undefined && typeof currentRow.minAppVersion === 'string' ? { minAppVersion: currentRow.minAppVersion } : {}),
    };
  }
  ```

  It is applied to each bundled row with the current feed's row of the same id. `validateCatalog` still checks the result.
- **The bundled-id rule (R7),** in `runtimeDeclarations.ts`:

  ```ts
  /** Sprint 141 R7: a bundled Claude model's declaration is the bundled row's (this build knows its CLI). */
  export function withBundledDeclarations(rows: readonly ModelEntry[], bundled: readonly ModelEntry[]): ModelEntry[];
  ```

  `index.ts` `computeDeclarations()` applies it before `buildClaudeRuntimeDeclarations()`. Discovery and sessions both read `_declarations`, so both follow.
- **The check (R9),** `scripts/check-model-feed.ts` (new; `npm run check:model-feed`; not bundled):
  - **Refs:** the release tags v1.8.1 to v1.14.0 and v2.0.0, 2.0.1 by `7810385d`, and the working tree. `--refs` overrides.
  - **Per ref:**
    - `git archive <ref> extensions/ritemark/src/ai extensions/ritemark/src/runtime/thinkingEffort.ts extensions/ritemark/package.json` into a fresh directory under `os.tmpdir()`. A UUID-free path, because npm redacts UUID segments (memory);
    - import that ref's `schema.ts`, `resolver.ts`, `bundledCatalog.ts` and, where present, `runtimeDeclarations.ts`;
    - `appVersion` from that ref's `package.json`.
  - **Resolution:** the current and the candidate feed, each as the remote with no cache and no live probe: the worst case, a person with no key or no probe. `getDefault` is the rule every release's `index.ts` uses (A1 confirms): the configured default's row, else the first row, else empty.
  - **Report:** Markdown per version and provider:
    - rows added, removed or changed (label, order, deprecated, hidden);
    - defaults per surface, before and after;
    - declared Claude models before and after.
  - **Exit 1:** a version's validator throws; a provider resolves to no rows; a default falls to the first row on a version where it resolved before.
  - Tests with fixture feeds under `src/ai/modelCatalog/testdata/`.
- **The release skill (R9):** *Hand edits to the feed* is rewritten:
  - the refresh at each shell release, step by step: export with `--merge` from the release source; add gates above `main`'s version by hand; `check:model-feed`; the report in the release evidence; publish with the release;
  - a hand edit between releases, as `c4808be`: its own `addedAt`, `updatedAt` left alone, and the check when a default or a shared row changes;
  - "Bump `updatedAt` with every edit" is replaced.
- **The candidate (R8)** is not committed in this repository. A1 records the branch's candidate and its report. At the release, the candidate is exported again from the release source and checked again, then published (*Delivery*).
- **Tests:** `feedExport.test.ts` (S20–S23); `runtimeDeclarations.test.ts` (S24, S25); `check-model-feed` (S32–S34).

## Workstream 4: The runtime review and updates (R11)

After A4 and the decision (*Open Questions* 8), the release skill's way.
- **Claude Code and the SDK in lockstep:**
  - the three `claude/runtime` manifest rows, every value measured from the npm tarballs;
  - `npm install --save-exact @anthropic-ai/claude-agent-sdk@0.3.N`;
  - the approved snapshots in `scripts/validate-agent-runtime-manifest.mjs` and its test;
  - `anthropicCatalogCheck.test.ts`'s pinned Claude Code version (it broke at S38 on the 2.0.0 update).
- **Codex:** the three `codex` rows from the GitHub release assets, with the archive members checked, the Mac and Windows layouts listed, and the snapshots.
- **OpenCode:** the three `opencode` rows from npm; ripgrep unchanged unless it moved.
- **Verify:**
  - `node scripts/validate-agent-runtime-manifest.mjs`;
  - `fetch-agent-runtimes.mjs --all-platforms`, then `--verify-only`;
  - `tsc --noEmit` and the full `npm test`;
  - `./scripts/verify-agent-runtimes.sh` (OpenCode's permission gate, the HARD GATE, with a free model);
  - Sprint 127's `model-picker-probe.mjs` and `request-capture.mjs`;
  - Codex `model/list` with an isolated `CODEX_HOME`;
  - `npm run check:anthropic-models`;
  - Sprint 128's background probes only with Jarmo's Claude sign-in, else recorded as not run.
- **The lineup follows:** S44 and S45. A change goes into W1's rows in the same merge.
- **Records:**
  - a v2.1.0 section in `docs/development/agent-runtime-compatibility.md` (pre-commit check 11);
  - the release plan's *Runtime versions* through the Development manager.
- **Known side effects to say before the merge:**
  - a re-signed `codex-app-server` asks once more for the Keychain items of Codex's MCP credentials on Jarmo's Mac (memory: Codex keychain prompt storm);
  - every Mach-O under `binaries/agents/` is re-signed at release (memory: agent binary signing).

## Workstream 5: OpenCode's live lists (R10), merge 2

The shape after A3. If A3 says cut, this workstream moves to v2.2.0 with its audit.

- **`discoverOpenCode({ env, read })`** in `providerDiscovery.ts` returns OpenCode's rows for the providers with keys, as `<vendor>/<model>` entries, or `null`. The read is A3's choice:
  - **(a)** the `model` option of the last `session/new` that `AcpManager` saw, kept per provider-key fingerprint in globalState (no new process; empty until the first OpenCode chat);
  - **(b)** one `opencode models` run with the provider environment at discovery time (activation, every 6 hours, a key change);
  - **(c)** (b) until (a) has an answer.
- **`opencodeLiveList.ts`** (new, pure):
  - `filterOpenCodeModels(rows, lineup)`: A3's patterns per vendor; OpenRouter limited to the lineup's families plus the catalog's own OpenRouter rows;
  - `narrowToProvider(rows, vendor, providerRows)`: Google and OpenAI, with the probes already made for Flows (`discoverGemini`, `discoverOpenAI`).
- **The resolver** gains a per-vendor merge for `opencode`. Today a live list replaces a provider's whole list, which would empty the groups of providers that weren't probed. Instead:
  - each vendor with live rows takes them, enriched from the static rows (`enrichLive`'s rules: catalog labels and order for known ids, OpenCode's name for new ones, deprecated extras kept);
  - each other vendor keeps its static rows.

  `hideOlderClaudeModels` applies as today.
- **Wiring:** `extension.ts`'s discovery provider sets `results.opencode` when `opencode-integration` is on and a BYOK key exists. A BYOK key change already refreshes the sheet's provider flags (Sprint 78); it also calls `modelCatalog.refreshDiscovery()`.
- **Invariant:** a provider with a key never has an empty group (`availability.ts`'s readiness), tested with a probe that returns nothing for it.
- **Tests:** the filter, the narrowing, the per-vendor merge and the fallback with A3's fixtures (S35–S38); the readiness invariant; Claude below 5 hidden.

## Workstream 6: QA, Windows and docs (E3–E6)

- **Manual QA** per `scenarios.md`, on a dev instance with:
  - the bridge trace for the payloads;
  - a test feed in the cache for S14, S24 and S31;
  - Jarmo's ChatGPT sign-in for S46.

  Every **Not runnable** scenario is recorded as not run, with why.
- **Windows:** the overlay round (E6) before each merge.
- **The bundle:** `media/webview.js` before and after (`notes/bundle.md`).
- **Docs:** `architecture.md` (E5), the release skill, the flows skill, the compatibility matrix and `docs/CHANGELOG.md`. The release notes draft goes through the Development manager.

## Delivery

1. **Merge 1:** W1–W4, with QA S1–S34 and S42–S48, the Windows overlay round, and A1, A2 and A4 in the PR. It is shell-tier because of W4, and ships with 2.1.0.
2. **Merge 2:** W5 (#529), after A3 says go and the Experience lead has seen the OpenCode groups built from the fixtures. QA S35–S41. The first to cut: if the appetite runs out, or A3 says cut, #529 moves to v2.2.0.
3. **The release step (R8),** at 2.1's publication, after Gate 2:
   - export the candidate from the release source with `--merge` against the live feed;
   - add A1's hand gates;
   - run `check:model-feed`;
   - put the report in the release evidence;
   - commit `feeds/model-catalog.json` to `jarmo-productory/ritemark-public` as `jarmo-productory`.

   It is a cross-repo step and part of the release, which is Jarmo's to approve. The release plan gains a checklist row for it.

## Coordination

- **Sprint 139 (merged):** its classifier's Google matchers are exported for R5, not copied. Its model card (R4) names the catalog's default, so it names Flows' new default where it applies. OpenCode still has no default, so its card keeps no button.
- **Sprint 138 (about to merge)** and **Sprint 140 (merged):** no shared files.
- **#377** (Codex's model source) stays separate. W5's per-vendor merge is OpenCode's only.
- **The release:**
  - the feed publish row;
  - *Runtime versions*;
  - #515 (Electron and Node) checked by the release on the pinned VS Code;
  - the missing native `v2.0.1` tag on `7810385d` is the release owner's call (the D1 rule tags the source commit).

## Risks inside the sprint

| Risk | Retirement |
|---|---|
| The refresh changes or hides a model on an older version | R9's check over every release, S30, publish only with 2.1. A bad publish is reverted by a commit in `ritemark-public`; clients re-check every 10 minutes |
| 1.8.1–1.11.0 take the feed whole | No tombstones (R8); every validator checked (S29); A1's version counts; *Open Questions* 9 |
| The carried Sonnet 5.5 declaration changes sessions on 1.13–2.0.x | A1's probes on each Claude Code; R7 keeps it away from 2.1. If A1 finds harm on 1.13–2.0.x, the declaration is dropped and the feed's Sonnet 5.5 row is gated to 1.13.0. 1.12.0 then falls back to its bundled Sonnet 5, as the planning check showed for a gated default |
| A bundled gate above `main`'s version hides a row in dev and tests | R6's rule, with a unit test against `package.json` |
| The new Gemini default can't be run without a key | A2's docs rule for the thinking budget, with 3.5 Flash Lite as the fallback; S12 listed as not run |
| Google's real refusal wording is unseen | Only documented wording is matched; anything else shows Google's sentence once (S17) |
| OpenCode's live list is long or noisy | A3's filter, the Experience lead's look before merge 2, the first to cut |
| Reading OpenCode's list costs a process | A3 measures it; a new process per probe means cut (*Open Questions* 2) |
| A probe empties a provider's group and OpenCode looks unready | The per-vendor merge and the readiness invariant (S37) |
| A runtime update regresses (background work, resume, the permission gate) | The verification set, the HARD GATE, S46, and the Sprint 128 probes where a sign-in exists |
| The runtimes move again before the candidate | The release's call, at its own runtime review |
| The feed is published by mistake before 2.1 | It is a release task, not a sprint task; nothing in merge 1 or 2 writes to `ritemark-public` |
