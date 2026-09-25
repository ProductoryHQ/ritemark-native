# Sprint 127 — Model visibility audit

**Captured:** 2026-09-24.<br>
**Question (Jarmo):** why do Ritemark users not see a newly released Anthropic model in the bundled Claude Code runtime as soon as it is available, and what should the source-of-truth priority be so this never depends on the CLI version or a Ritemark update?<br>
**Evidence:** [probes/](./probes/README.md) · [evidence/](./evidence/) · Sprint 116 [runtime-model-audit.md](../../../v1.11.0/sprint-116-runtime-model-baseline/research/runtime-model-audit.md)

## Outcome

The bundled CLI is not the blocker. Ritemark's own model-catalog resolver is.

- For users signed in with a Claude subscription (OAuth), the resolver treats the bundled CLI's `supportedModels()` as a *live* source and makes it the only allowed set of models. That list is compiled into CLI 2.1.270 and changes only with a shell-tier release.
- The remote catalog in `ritemark-public`, whose purpose is to add a model without an app release, cannot add a Claude model for these users. It is also ignored everywhere at the moment, because it is older than the bundled catalog.
- API-key users already see new models on day zero through `GET /v1/models`.
- CLI 2.1.270 can run a model it has never heard of: it treats unknown first-party models as current-generation. It can also list one, through the SDK-injectable `settings.modelPicker` setting. Both were verified against the shipped binary.

## How it works today

1. `extension.ts:425` wires `discoverAnthropic()` as the live source:
   - if SecretStorage holds `anthropic-api-key` → `GET /v1/models` (`providerDiscovery.ts:66`);
   - otherwise → the bundled CLI's `supportedModels()` through a short SDK session (`providerDiscovery.ts:78`, `agent/discoverModels.ts:64`).
2. `resolver.ts:71-73`: when the live probe returns rows, `enrichLive()` keeps **only live ids** plus deprecated extras (`resolver.ts:223`). Remote, cache and bundled rows can relabel, never add.
3. The remote feed and its cache are used only when `updatedAt >= bundled.updatedAt` (`resolver.ts:115`, Sprint 116 A2).
4. A selected model that is not in the resolved list is silently replaced by the default: `ai-select-model` (`UnifiedViewProvider.ts:544`), `_reconciledClaudeModel()` (`UnifiedViewProvider.ts:2596`), and the bootstrap selection (`agentSidebarBootstrap.ts:77-79`).
5. The catalog refreshes at activation, every 6 hours (`modelCatalog/index.ts:24`), and after a Claude sign-in state change.

## Reproduction

[probes/resolver-repro.ts](./probes/resolver-repro.ts) runs the unchanged resolver on real inputs. Output: [evidence/resolver-repro.txt](./evidence/resolver-repro.txt).

| Case | Winning source | `claude-opus-5-5` visible |
|---|---|---|
| A. OAuth user today | live (CLI) | no — `opus[1m]→claude-opus-5[1m]`, `claude-fable-5-1[1m]`, `sonnet`, `haiku` |
| **B. OAuth user after a fresh feed that lists Opus 5.5** | live (CLI) | **no** |
| C. OAuth user, CLI probe unavailable, fresh feed | remote | yes |
| D. OAuth user, CLI probe unavailable, today's feed | bundled | no |
| E. API-key user | live (`/v1/models`) | yes |

Case B is the core finding: publishing a model does not reach subscription users. They see a new model only when discovery is broken (C). The same user also sees two different lineups depending on whether the probe succeeded (A: four CLI aliases; D: six curated rows).

## Root causes

**C1 — A build-cadence list is ranked as provider truth.** `supportedModels()` answers "what this CLI build ships in its picker", not "what Anthropic has released". The resolver gives it the same authority as `/v1/models` and lets it suppress every other source. Sprint 89 already recorded that `supportedModels()` is "capped at the CLI version", but kept it as the OAuth live source.

**C2 — The runtime is shell-tier.** `extensions/ritemark/binaries/agents/` is on the shell-tier path list. Extension releases exclude it, and shell releases batch runtime refreshes roughly every 4–6 weeks ([seamless-update plan](../../../../analysis/2026-07-07-seamless-update-delivery-plan.md)). Claude Code published ten releases in the eleven days after 2.1.270 ([evidence/cli-model-identity-scan.json](./evidence/cli-model-identity-scan.json)).

**C3 — The remote feed is inert.**
- `feeds/model-catalog.json` is dated 2026-07-25, while the bundled catalog is dated 2026-09-13, so every current build ignores the feed for every provider.
- The feed was published twice: 2026-07-01 initially, and 2026-07-25 to add Opus 5.
- It lacks Fable 5.1 and Opus 5.5, as well as Sprint 116's OpenAI, Gemini and Codex lineup.
- Sprint 116 A2 made the stale feed harmless and noted that a refreshed publish "can follow separately"; it never did.
- Every app release moves the bundled date forward, so a feed that is not republished after each release goes inert again. No one owns that step, and nothing automates it.

**C4 — No escape hatch.** Even a manually set `ritemark.ai.selectedModel: claude-opus-5-5` is coerced to the default (see step 4 above).

**C5 — The list can describe the wrong account.** Discovery uses the stored API key whenever one exists (`extension.ts:430`), but the runtime uses it only when `authMethod === 'api-key'` (`UnifiedViewProvider.ts:749`). A subscription user who also saved an API key for other features gets the key's model list while requests run on the subscription.

**C6 — Dead wiring.** `AgentSession.onModelsDiscovered` (`AgentRunner.ts:595`) is never assigned, so in-session `supportedModels()` results are discarded. This is harmless, but it shows that in-session discovery was never part of the catalog.

## Runtime evidence (CLI 2.1.270, SDK 0.3.270)

### Which CLI knows Opus 5.5

| CLI | Published | `claude-opus-5-5` in binary | `opus` family points to |
|---|---|---|---|
| 2.1.270 (bundled) | 2026-09-12 | 0 | `claude-opus-5` |
| 2.1.278 | 2026-09-19 | 0 | `claude-opus-5` |
| 2.1.280 | 2026-09-22 | 41 | `claude-opus-5-5` |
| 2.1.281 | 2026-09-23 | 51 | `claude-opus-5-5` |

2.1.281 also adds an `opus_5_5_prompt_bundle` capability, a model-specific prompt tuning that no older CLI can have.

### Unknown first-party models are treated as current-generation

For a model id missing from its compiled table, CLI 2.1.270 falls back to `XI(provider)`, which is `true` for `firstParty`, Anthropic-on-AWS/Google Cloud, Foundry and Mantle. Unknown first-party models therefore get adaptive thinking, the full effort ladder (low…max), and are treated as rejecting `thinking: disabled`. That matches Opus 5.5, whose breaking changes are that thinking cannot be disabled and forced `tool_choice` returns 400.

Captured first main-loop request ([probes/request-capture.mjs](./probes/request-capture.mjs), [evidence/request-capture.json](./evidence/request-capture.json)):

| Model sent | Declaration | `thinking` | effort | `tool_choice` | `max_tokens` |
|---|---|---|---|---|---|
| `claude-opus-5` (known) | — | adaptive | high | none | 64000 |
| `claude-opus-5-5` | none | adaptive | high | none | **32000** |
| `claude-opus-5-5` | `CLAUDE_CODE_MAX_OUTPUT_TOKENS=64000` | adaptive | high | none | 64000 |
| `claude-opus-5-5` | `modelPicker` + `behavesAs: claude-opus-5` | adaptive | high | none | 64000, plus the refusal-fallback beta |

Without a declaration, the degradations are:
- a 32K output default;
- a conservative assumed context window: the CLI says it keeps unknown models within the window it assumes unless `[1m]` or `CLAUDE_CODE_MAX_CONTEXT_TOKENS` says otherwise;
- no model-specific prompt bundle.

The request shape itself is valid.

### `settings.modelPicker` — the supported host lever

The SDK 0.3.270 `Settings` type documents it:

> Curate the /model picker: an ordered list of models with your own labels, **independent of the built-in lineup and of Claude Code releases**. availableModels still applies to these rows. Honored from managed, --settings/SDK, and user settings only (not from a project checkout); the highest-precedence of those that defines modelPicker wins outright (no merging across sources).

> `behavesAs`: For a model this version of Claude Code does not know: the ID of a model it does know … whose client-side handling — prompt profile, capability and effort defaults — applies to it.

The SDK `settings` option feeds the flag-settings layer. CLI 2.1.270 always enables `flagSettings` and `policySettings`, even with `settingSources: []`, which is how Ritemark calls it. Probe results ([probes/model-picker-probe.mjs](./probes/model-picker-probe.mjs), [evidence/supported-models-probes.json](./evidence/supported-models-probes.json)):

- **Plain:** four rows (`default`, `sonnet`, `opus → claude-opus-5`, `haiku`).
- **Injected `claude-opus-5-5`:** a fifth row with `resolvedModel: claude-opus-5-5`, effort low…max, adaptive thinking. This works with or without `behavesAs`.
- **Injected duplicates of native identities** (`claude-sonnet-5`, `claude-opus-5`): the CLI drops them.
- **An injected garbage id** (`not a model; rm -rf /`) is accepted verbatim as a row. The id travels as an argv element, not through a shell, but Ritemark must validate ids before injecting.

Managed (enterprise) settings outrank the SDK layer, so an organization's own `modelPicker` or `availableModels` still wins. That is correct.

### `behavesAs` is not safe to automate

Some CLI side paths build their thinking setting with `yX(model)`, which sends `thinking: { type: "disabled" }` for models whose profile accepts disabled thinking. `claude-opus-5` is on that explicit list. The paths are the transcript classifier, plugin `$.model.complete` and memory selection; memory selection uses the Sonnet alias. Opus 5.5 returns 400 for disabled thinking at every effort level. If `behavesAs: claude-opus-5` makes the CLI treat Opus 5.5 as Opus 5 in those paths, they would fail. This was not reproduced; the capture sees only the main loop. **Decision input:** automation never sets `behavesAs`; the output budget comes from `CLAUDE_CODE_MAX_OUTPUT_TOKENS` instead, which was verified above.

### Anthropic's own served catalog (context, not controllable)

CLI 2.1.270 already contains two server-driven catalogs:
- `servedCatalog` — `GET /api/organizations/:orgUUID/model_selector/<surface>`. In primary mode, it logs that "the served list replaces the compiled picker for this session".
- `publishedCatalog` — a signed document.

Both are limited to first-party claude.ai OAuth sessions and switched by the server feature `tengu_delegated_quail` (`off` / `shadow` / `primary`). A served row for a model the build does not know is offered only with a `behaves_as` mapping. Ritemark cannot rely on this rollout. It also does not suppress it: no `CLAUDE_CODE_*` variable that disables it is set anywhere in `extensions/ritemark/src`. The CLI's own `/v1/models` capability fetch is compiled off (`Gtn() { return false }`), and gateway discovery applies only to a non-first-party `ANTHROPIC_BASE_URL`.

## Feed delivery facts

- `raw.githubusercontent.com` serves the feed with `cache-control: max-age=300` and an `ETag`. A conditional request returns **304**, so polling every few minutes costs a header exchange.
- The feed's origin allowlist (`https://raw.githubusercontent.com/jarmo-productory/`), strict schema v1, and 512 KB cap stay in force. The pinned-key signature is still deferred from Sprint 89.
- `ritemark-public` is a public repository, so scheduled GitHub Actions minutes are free. It has no workflows today.
- Older clients use whole-document freshness: a feed newer than their bundled catalog replaces it for every provider. Any published feed must therefore stay a complete, current catalog for every provider, not only Anthropic.

## Source-of-truth model (approved 2026-09-24)

Jarmo approved the split (existence / runnability / presentation), showing a model before the CLI knows it natively, and fully automatic, immediate publishing.

| Question | Owner | Priority |
|---|---|---|
| **Existence** — is the model released and available to this account? | Anthropic | 1) `/v1/models` with the same credential the runtime uses → 2) the runtime's served list ∪ Ritemark's auto-published feed → 3) cache → 4) bundled |
| **Runnability** — can the pinned runtime drive it correctly? | The runtime, informed by Ritemark | 1) native knowledge → 2) a feed declaration injected through `settings.modelPicker` plus an output budget → 3) never shown if the runtime does not echo it |
| **Presentation** — label, order, default, deprecation | Ritemark | freshest feed row → cache → bundled → provider or runtime display name |
| **Effort levels** | Measured | runtime `supportedModels()` → `/v1/models` `capabilities.effort` → catalog |
| **User choice** | User | never silently replaced; an unavailable choice is said out loud |

Rules that follow:
- `supportedModels()` is authoritative for *what the runtime can run*, not for *what exists*.
- A stale document can neither hide a newer bundled row nor resurrect a row the build dropped.
- Automated rows add; they never change defaults, never remove rows, and never set `behavesAs`.
- The first real API response is the final word for subscription accounts, which have no listing: a model the account cannot use gets a clear error, not a generic one.
- Ritemark never borrows Claude Code's OAuth token for its own API calls.

## Open audit items (Sprint 127 Phase 0)

| ID | Item | Why |
|---|---|---|
| A1 | End-to-end on real Pro and Max subscriptions with CLI 2.1.270: an injected row appears, runs, the init model matches, and a long session auto-compacts sanely | Only unauthenticated probes and API-key captures exist |
| A2 | Exact error shape when an account cannot use a model (plan limits, `availableModels`) | Needed for the R6 error mapping |
| A3 | Effect of `CLAUDE_CODE_MAX_CONTEXT_TOKENS` on an unknown model's assumed window | Decides whether the feed carries `contextWindow` |
| A4 | Managed-settings `modelPicker` precedence over the SDK layer | Confirms enterprise control stays intact |
| A5 | darwin-x64 and win32-x64 parity of injection | Same CLI code, different binaries |
| A6 | GitHub Actions schedule latency in `ritemark-public` | Sets the honest "immediate" number |
| A7 | Behavior when Anthropic's served catalog is in primary mode alongside an injected row | Cannot be forced; observe if an account shows `[servedCatalog]` logs |
