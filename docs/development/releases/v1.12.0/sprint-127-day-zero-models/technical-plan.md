# Sprint 127 Technical Plan

Architecture for [spec.md](./spec.md). Snippets are proposed shapes; when the code diverges, update this file first. Evidence: [research/model-visibility-audit.md](./research/model-visibility-audit.md).

## Revisions (2026-09-24, at implementation start)

- **W1/W3 — `contextWindow` deferred (Q5).** The field is not in the schema until audit A3; only `maxOutputTokens` maps to the runtime environment.
- **W2 — no `liveKind`.** Nothing consumes it. `ResolvedProvider.source` keeps its values, and the static layer reports `remote` or `cache` when that document contributed rows at least as fresh as the bundled catalog, else `bundled`.
- **W3 — sessions declare only what they run.** Discovery declares every declared row. A session declares only the model it runs, and only when that model is a declared row. `modelPicker` from the flag layer replaces a user's own `modelPicker` for that session ("wins outright"), so a session that does not need it must not carry it.
- **W6 — no new `failureKind`.** `conversations/types.ts` validates persisted `failureKind` against the authentication kinds, so a new value would change a stored format. Model-unavailable errors get their own message and no kind.
- **W3 — Flows unchanged.** A Flow's Claude Code node runs the catalog default, and defaults are never automated rows, so it never needs a declaration.
- **W7 — payload location.** Push access to `ritemark-public` was denied for this session. The publisher is built under [ritemark-public/](./ritemark-public/APPLY.md), mirroring the target layout. Jarmo applies it, and `ritemark-public` then owns it. A nested `.github/` under `docs/` does not run in this repository.

## Revisions (2026-09-24, W7 implementation)

- **Watermark = the bundled lineup's `updatedAt` (`2026-09-13T00:00:00Z`)**, not the newest bundled Claude model's `created_at`. The lineup was curated from every model that existed on that date, so anything created earlier and left out was left out on purpose. It also needs no API call to derive. Opus 5.5 appeared after CLI 2.1.278, which does not know it, so it stays a candidate. If the first dry run does not list it, compare its `created_at` with the watermark ([APPLY.md](./ritemark-public/APPLY.md) step 5).
- **The watermark stays below every pending model.** A candidate that is cooling down, over the per-run cap, or failed holds the watermark below its `created_at`. Otherwise a newer model's publish would skip it for good. `selectCandidates()` became `newModels()`, and the cap and cooldown moved into `publishOnce()`.
- **Schema rules live in `schema.mjs`.** `validate.mjs` is the command-line check: schema, size cap, config, and, with `--base <ref>`, the additions-only diff (S21). The workflow runs it after rebasing onto `origin/main` and before it pushes.
- **The canary is stricter than planned.** It uses streaming input so the list check runs before the one prompt (as in the probes). It also requires every assistant message to come from the declared model or a dated snapshot of it. A runtime that cannot be fetched counts as a failed canary, not a crashed run.
- **Dry run.** `workflow_dispatch` has a `dry_run` input. It runs the canary and writes nothing, even while `MODEL_CATALOG_AUTOPUBLISH` is off. The kill switch is enforced at job level and again in the script.
- **Failures are reported last.** The script exits 0 after a failed canary and sets the `failed` output. The workflow commits any model that passed in the same run, then fails in its last step. The cooldown state is saved to the Actions cache only when it changed, under a key per run.
- **A feed dated in the future stops a publish** with a clear message, instead of failing the additions-only check.
- **Tests use frozen fixtures** (`fixtures/feed.fixture.json`, `fixtures/config.fixture.json`) because the live feed changes with every publish. Only one test reads the live files, to check that they are valid. `workflows.test.mjs` guards the workflow files: triggers, pinned SHAs, permissions, where the secret is used, and `persist-credentials: false`.
- **Offline smoke check** `canary-smoke.mjs` runs the real CLI and SDK against a local API stand-in, with no key. Use it before adding a Claude Code version to the canary list. Evidence: [evidence/canary-smoke-2026-09-24.json](./research/evidence/canary-smoke-2026-09-24.json) (2.1.270 and 2.1.281 both pass).
- **Export keeps what only the feed carries.** `buildPublishedFeed()` (`src/ai/modelCatalog/feedExport.ts`, tested, not bundled) writes the bundled lineup. It keeps automated rows and tombstones that the lineup does not curate, and providers the app does not know. `--merge <feed>` makes a release-time refresh safe.
- **Docs location.** The publisher's documentation is `feeds/README.md` in `ritemark-public` (spec R8 revision).

## Architecture Overview

```
Anthropic GET /v1/models ──(Ritemark key, every ≤10 min)──► ritemark-public publisher (W7)
                                                              │ canary: pinned CLI + modelPicker
                                                              ▼
                                        feeds/model-catalog.json  (append-only automated rows)
                                                              │ raw CDN, ETag / 304
                                                              ▼
extension host ── modelCatalog.pollFeed() (W5) ──► static merge: feed ∪ cache ∪ bundled (W2)
      │                                                       │
      │                                  runtime declarations: claudeCode.inject rows (W3)
      │                                                       │
      ├── discovery probe: SDK query + settings.modelPicker ──┘──► CLI 2.1.270 supportedModels()
      │        └─ credential alignment: /v1/models only in API-key mode (W4)
      ├── resolver: provider-live | runtime-live | static  ──► picker (existing bootstrap)
      └── sessions: AgentRunner query + settings.modelPicker + CLAUDE_CODE_MAX_OUTPUT_TOKENS (W3)
                    └─ substitution notice + model-unavailable error (W6)
```

Boundaries crossed:
- **Host ↔ binary.** A new `settings` option carries `modelPicker` into the CLI's flag-settings layer. Managed settings still outrank it, and older CLIs ignore it.
- **Host ↔ network.** Conditional feed polling.
- **Cross-repository.** The publisher lives in `ritemark-public`.

Not crossed: no webview change, no shell-tier path, no new dependency, no new feature flag. `remote-model-catalog` gates the whole path.

Locked-decision check (architectural-design skill):
- *Model IDs in one file* holds. No new model id is hardcoded in code; automated ids are feed data, which the Sprint 89 memo made the availability authority.
- `UnifiedViewProvider` grows by a visibility hook and a substitution notice only. Logic stays in `src/ai/modelCatalog/`.

## Workstream 0: Phase 0 audit (gate)

Run audit items A1–A7 from the research doc on real accounts and targets before product code. Record the results in `research/phase-0-audit.md`. Any finding that changes a requirement goes through the scope-change protocol.

## Workstream 1: Feed contract — schema v1, additive (R3, R4, R7)

`src/ai/modelCatalog/schema.ts`:

```ts
export interface ModelEntry {
  // …existing fields…
  /** Who wrote the row. Omitted = 'curated'. Automated rows never become defaults. */
  provenance?: 'curated' | 'auto';
  /** When the row entered the feed. Omitted = the document's updatedAt. */
  addedAt?: string;
  /** Tombstone: never offered, never declared to a runtime. */
  retired?: boolean;
  /** How to declare the model to the Claude Code runtime (anthropic rows only). */
  claudeCode?: {
    inject?: boolean;          // declare through settings.modelPicker
    maxOutputTokens?: number;  // → CLAUDE_CODE_MAX_OUTPUT_TOKENS for sessions on this model
    contextWindow?: number;    // → CLAUDE_CODE_MAX_CONTEXT_TOKENS, only if audit A3 confirms
    behavesAs?: string;        // curated rows only (R7); ignored on automated rows
  };
}
```

`validateEntry`:
- Type-checks the new fields: `addedAt` must be a parseable ISO date; the numbers must be positive integers.
- Rejects an `anthropic` row whose id fails `^claude-[a-z0-9]+(?:-[a-z0-9]+)*(?:\[1m\])?$`. That is fail-closed and throws, as for every other violation (R7).
- Keeps `schemaVersion: 1`. Older validators construct entries field by field, so they drop the new fields.

Tests (`modelCatalog.test.ts`): accepts an automated row fixture shared with the publisher (W7); rejects a bad id, a bad `addedAt`, and a non-integer budget.

## Workstream 2: Static merge (R3)

`src/ai/modelCatalog/resolver.ts` replaces the document-level eligibility gate with a per-row merge between the bundled catalog `B` and one overlay `O`. The overlay is the fresh feed, else the cache.

```ts
function mergeStatic(provider, B: ModelCatalog, O: ModelCatalog | null): ProviderCatalog {
  // rows in both   → metadata from the fresher document; bundled capabilities stay the floor
  // only in B      → kept
  // only in O      → kept iff row.provenance === 'auto' || (row.addedAt ?? O.updatedAt) > B.updatedAt
  // retired        → dropped (a retired row from the fresher document wins the conflict)
  // defaults       → fresher document's default if it names a kept, non-auto row; else the other; else first row
}
```

`resolveProvider()` then:
- Uses `mergeStatic` as the static layer: the `remote` / `cache` / `bundled` sources collapse into one merged layer whose `source` is reported as its dominant contributor.
- Keeps the live-layer rules unchanged, except that `ResolvedProvider` gains `liveKind: 'provider' | 'runtime'`. Existing consumers read only `source`.
- Filters by `minAppVersion` after the merge (existing).
- Leaves `isCatalogAtLeastAsFresh` exported for tests and the dev script.

Tests: the Sprint 116 A2 cases (S10, S11), an auto row after the build (S12), relabel (S13), tombstone (S14), and an auto row never becoming the default (S15). The existing fixtures run unchanged except where A2 behavior is now defined per row.

## Workstream 3: Runtime declarations (R1, R7)

New `src/ai/modelCatalog/runtimeDeclarations.ts`. It is pure, so it can be tested with tsx.

```ts
export interface ClaudeModelPickerOption { model: string; label: string; description?: string; behavesAs?: string }
export interface ClaudeRuntimeDeclarations {
  pickerOptions: ClaudeModelPickerOption[];     // stable order, for settings.modelPicker.options
  envFor(modelId: string): Record<string, string>; // CLAUDE_CODE_MAX_OUTPUT_TOKENS (+ context if A3)
  signature: string;                             // changes when options/env change (W5 re-probe trigger)
}
export function buildClaudeRuntimeDeclarations(staticAnthropic: ModelEntry[]): ClaudeRuntimeDeclarations;
export function dropShadowedDeclarations(rows: ModelEntry[], declaredIds: string[]): ModelEntry[];
```

Rules:
- Declare every non-retired, id-valid anthropic row with `claudeCode.inject`.
- Include `behavesAs` only when `provenance !== 'auto'`.
- `dropShadowedDeclarations` removes a declared row when another probe row resolves to the same identity modulo a trailing `[1m]`. This covers S3, where the runtime also knows the model natively.

The public API in `index.ts` adds `getClaudeRuntimeDeclarations()`, computed from the merged static layer and empty when the flag is off.

Discovery:
- `discoverClaudeModels()` (`agent/discoverModels.ts`) accepts `settings?: { modelPicker: { options } }` and passes it into the SDK `query` options.
- `discoverAnthropic()` passes the declarations and applies `dropShadowedDeclarations` to the rows it maps.
- The CLI's own dedupe of exact identities was observed in the probe.

Sessions:
- `AgentSessionConfig` and `AgentExecutionOptions` (`agent/types.ts`) gain `claudeDeclarations?: { pickerOptions; env }`.
- `AgentRunner` adds `settings: { modelPicker: { options } }` when non-empty and merges `env`. The persistent path at `AgentRunner.ts:1043` builds `env` only for API keys today; it becomes `{ ...process.env, ...apiKeyEnv, ...declarationEnv }`. The one-shot path follows `AgentRunner.ts:394`.
- `RuntimeSessionConfig` → `ClaudeCodeRuntime._build` passes the declarations through. `UnifiedViewProvider` fills them from `modelCatalog.getClaudeRuntimeDeclarations()` with `envFor(pinnedModel)`.
- `ClaudeCodeNodeExecutor` and the title generator pass them for one-shot runs, best effort: an automated row carries no `behavesAs`, so a missing declaration only loses the output budget.
- A change in declarations changes the runtime's model identity key, so `ClaudeCodeRuntime.applyConfig` rebuilds the session only when the chosen model's declaration changed.

Tests: declaration building (auto vs curated `behavesAs`, retired, bad id), shadowing modulo `[1m]`, and `AgentRunner` option assembly with and without an API key. The existing `AgentRunner.test.ts` pattern mocks the SDK query.

## Workstream 4: Credential alignment and provider capabilities (R2)

- `extension.ts:425` passes `apiKey` to `discoverAnthropic` only when `claudeSetup.authMethod === 'api-key'`, matching `UnifiedViewProvider.ts:749`.
- `providerDiscovery.discoverAnthropic` maps `capabilities.effort.{low,medium,high,xhigh,max}.supported` to `thinkingEffort.levels` in canonical order. It omits the field when `effort.supported` is false, so the model is Auto only.
- The refresh after a Claude status change already exists at `UnifiedViewProvider.ts:2159`. It now also re-probes, because the credential kind is part of the probe key.

Tests: a fixture `/v1/models` payload with the capability tree, and the credential-kind selection.

## Workstream 5: Immediate pickup (R5)

`remoteSource.ts`:
- Stores the response `ETag` next to the cache (`modelCatalog_v1_etag`) and sends `If-None-Match`.
- Returns `{ catalog, changed }`. A 304 means `changed: false` with the cached catalog. The allowlist, cap, timeout and `redirect: 'error'` are unchanged.

`index.ts`:

```ts
const FEED_POLL_MS = 10 * 60 * 1000;       // R5
const DISCOVERY_REFRESH_MS = 6 * 60 * 60 * 1000;
export async function pollFeed(): Promise<void>;          // conditional fetch → merge → if declarations.signature changed → refreshDiscovery()
export function pollFeedIfStale(): void;                   // called when the sidebar becomes visible
export async function refreshDiscovery(): Promise<void>;  // probe + resolve + emit (activation, status change, 6h, declaration change)
export async function refresh(): Promise<void>;           // kept: pollFeed() then refreshDiscovery(); existing callers unchanged
```

`UnifiedViewProvider.ts:1397` adds a one-line `modelCatalog.pollFeedIfStale()` to the existing visibility handler.

Tests: 304 keeps the cache and does not probe; a changed body with the same declarations does not probe; changed declarations probe once.

## Workstream 6: Honest substitution and model errors (R6)

- `modelCatalog.resolveRequestedModel('anthropic', requested)` returns `{ id, substitutedFrom?: string }`.
- `_reconciledClaudeModel()` and the `agent-execute` path use it. On substitution, `UnifiedViewProvider` emits one `init` progress line through the session's `onProgress` before `prompt()`, for example "Opus 5.5 isn't available here — using Sonnet 5." It renders like the existing "Model mismatch" line, so the webview is unchanged.
- `ai-select-model` keeps persisting only resolvable ids (existing).
- `src/runtime/runtimeErrorPresentation.ts` adds a `model_unavailable` class for the shapes audit A2 records (for example `not_found_error` or `permission_error` naming the model, or the CLI's own model message). The text names the model and points to the model menu, and the conversation stays open.

Tests: substitution notice text; error classification fixtures from A2.

## Workstream 7: Publisher in `ritemark-public` (R4, R7)

Files in `jarmo-productory/ritemark-public` (public repository, so Actions minutes are free):

| Path | Purpose |
|---|---|
| `.github/workflows/model-catalog-autopublish.yml` | `schedule: '*/10 * * * *'` + `workflow_dispatch`; `permissions: contents: write`; `concurrency: model-catalog-autopublish`; actions pinned by SHA; Node 22 |
| `scripts/model-catalog/autopublish.mjs` | kill switch → `/v1/models` → candidates → canary → append → validate → commit |
| `scripts/model-catalog/candidates.mjs` | Claude id filter, watermark (`created_at`), dated-snapshot skip, max additions per run |
| `scripts/model-catalog/rows.mjs` | label (`display_name` minus "Claude "), tier by family (opus/fable/mythos high, sonnet medium, haiku low), order (0.5 before the family's lowest-order row), effort from capabilities, `claudeCode: { inject: true, maxOutputTokens: min(max_tokens, 64000) }`, `provenance: 'auto'`, `addedAt`, `minAppVersion` |
| `scripts/model-catalog/canary.mjs` | `npm pack` the pinned CLI (linux-x64) and SDK, verify `dist.integrity`, isolated home, SDK query with `settings.modelPicker` + the candidate model, `tools: []`, deny-all `canUseTool`, `maxTurns: 1`, "Reply with OK." → assert that it is listed, the init model matches, the result succeeds and the text is not empty |
| `scripts/model-catalog/validate.mjs` | schema rules mirroring `validateCatalog`, 512 KB cap, and an **additions-only diff** against `HEAD` (S21) |
| `scripts/model-catalog/*.test.mjs` | `node --test` unit tests; the shared automated-row fixture also used in W1 |
| `feeds/model-catalog.config.json` | `watermark`, `canary.claudeCodeVersions` (`["2.1.270"]`), `canary.agentSdkVersion`, `autoRowMinAppVersion`, `maxAdditionsPerRun: 3`, `maxOutputTokensCap: 64000` |

Secrets and variables, set up by Jarmo:
- `MODEL_CATALOG_ANTHROPIC_API_KEY`: a dedicated workspace with a spend cap. Listing models is free; one canary costs a single short turn per CLI version.
- `MODEL_CATALOG_AUTOPUBLISH=on`.

Failure handling:
- A failed canary fails the workflow run, and GitHub's scheduled-workflow failure email is the alert. The run fails in its last step, after any model that passed has been committed (W7 revision).
- The candidate's cooldown (1 h, doubling to 24 h) is kept in the Actions cache, so a persistent failure cannot burn API spend every 10 minutes.

Bootstrap:
1. `extensions/ritemark/scripts/export-bundled-model-catalog.ts` prints the bundled catalog as feed JSON.
2. Commit it as the complete current lineup for every provider, with the watermark set to the newest bundled Claude model's `created_at`. The watermark was later revised to the bundled lineup's `updatedAt` (W7 revision). This repairs C3 for older clients.
3. The first scheduled run then detects, canaries and publishes Opus 5.5. It is the pipeline's live acceptance test.

## Workstream 8: Documentation, release process, QA (R8)

- `docs/development/architecture.md`: Model Catalog AS IS → TO BE (authority split, merge rule, runtime declarations, publisher), a changelog row, and a Sprint 89 memo addendum.
- `.claude/skills/release/SKILL.md`: when a shell release changes the bundled Claude Code version, add it to `canary.claudeCodeVersions`. Before a release, refresh the feed's non-Anthropic lineup with `export-bundled-model-catalog.ts` so older clients stay current.
- `ritemark-public/feeds/README.md`: the "Model catalog feed" documentation, covering how it works, switches, secrets, the tombstone how-to, lineup refresh and operations (revised 2026-09-24).
- `extensions/ritemark/package.json` `test` chain: add `src/ai/modelCatalog/runtimeDeclarations.test.ts` and the new resolver and remote-source tests.
- `qa-evidence.md`: the scenario matrix, with S24 timing.
