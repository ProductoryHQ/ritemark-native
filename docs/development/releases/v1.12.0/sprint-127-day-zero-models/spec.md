# Sprint 127 Spec — New Anthropic models on day zero

**Parent:** [sprint-plan.md](./sprint-plan.md) · **Release:** [v1.12.0](../release-plan.md) · **Issue:** [#343](https://github.com/ProductoryHQ/ritemark-native/issues/343) · **Evidence:** [research/model-visibility-audit.md](./research/model-visibility-audit.md)

## Purpose

When Anthropic releases a model, every Ritemark user can choose it in the Claude Code agent within minutes, whether they sign in with a Claude subscription or an API key. This must not wait for a Claude Code CLI update or a Ritemark update. Today subscription users see only the models compiled into the bundled CLI, and the remote catalog meant to fix that cannot reach them.

## Principles

- **Existence belongs to Anthropic, runnability to the runtime, presentation to Ritemark.** (Jarmo, 2026-09-24.) No single source answers all three.
- **The runtime is told, not bypassed.** A model Ritemark shows before the CLI knows it is declared to the CLI through the supported `settings.modelPicker` channel. The runtime then lists it, runs it, and remains the authority on what it can run.
- **Automation adds; people curate.** Fully automatic publishing adds models immediately (Jarmo, 2026-09-24). It never changes defaults, never removes rows, and never guesses a behavior profile.
- **Stale data cannot hide newer truth.** Neither an old remote document nor an old build can hide what the other knows is current.
- **Say it out loud.** A model the user asked for but cannot have is named, never silently swapped.
- **One-time client change.** After the client that ships this sprint, a new Anthropic model needs no app or CLI update.

## Requirements

### R1: Subscription users see and can run a newly published model on the bundled CLI

As a Claude Pro or Max user, I want a newly released Anthropic model to appear in the Claude Code model menu and work, so I am not stuck with the models compiled into Ritemark's bundled CLI.

Acceptance criteria:
- With bundled CLI 2.1.270 and a feed row for `claude-opus-5-5` declared for the Claude Code runtime, the model menu shows exactly one "Opus 5.5" row after the next catalog refresh, without restarting Ritemark.
- Choosing it starts a session whose init reports `claude-opus-5-5`, with no "Model mismatch" line. Requests use adaptive thinking (never `disabled`, never `budget_tokens`) and the output budget the feed declares.
- The runtime is the runnability authority. A declared model the runtime does not echo back from `supportedModels()` is not shown; an example is an older system-installed CLI without `modelPicker`.
- When the runtime also knows the model natively, including as a `[1m]` variant of the same identity, the menu shows one row, not two.
- An organization's managed `modelPicker` or `availableModels` settings still take precedence over Ritemark's declaration.

### R2: The model list follows the credential that runs the request

As a user who signs in one way and may have saved an API key for another feature, I want the Claude model list to describe the account that actually runs my requests.

Acceptance criteria:
- `GET /v1/models` supplies the Claude list only when the Claude runtime authenticates with that API key (`authMethod === 'api-key'`). Otherwise the runtime's list, plus declared feed models, is used.
- For API-key users, a `/v1/models` row with no other effort metadata gets its effort levels from `capabilities.effort`; levels the provider marks unsupported are not offered.
- A change of sign-in method re-resolves the list. This is the existing refresh after a Claude status change.

### R3: Remote, cache and bundled catalogs merge without hiding or resurrecting models

As a user of any Ritemark build, I want the model menu to include every current model known to either my build or the published feed, and none that either one deliberately dropped.

Acceptance criteria:
- A feed or cache document older than the bundled catalog cannot hide a bundled row. The Sprint 116 A2 cases still pass.
- A feed row absent from the bundled catalog is added when it was published after the bundled snapshot, or when it is an automated row. A row older than the snapshot that the build omits stays hidden, so no resurrection.
- A row present in both takes presentation metadata from the fresher document. Bundled exact-pin capabilities remain the floor (existing behavior).
- A feed tombstone (`retired: true`) from a document fresher than the bundled catalog removes the row from menus and from runtime declarations.
- Defaults come from the fresher document that names a visible row, and are never an automated row.

### R4: New Anthropic models are published fully automatically and immediately

As the product owner, I want Ritemark's feed to learn about a new Anthropic model within minutes of Anthropic listing it, with no human step.

Acceptance criteria:
- A scheduled job in `jarmo-productory/ritemark-public` runs at least every 10 minutes, and on demand.
- It reads `GET /v1/models` with a Ritemark-owned API key and selects Claude ids that are newer than the feed's watermark and absent from the feed. It skips dated snapshots of known ids and non-Claude ids.
- For each candidate, a canary on every configured pinned Claude Code version must pass before publishing: the model is listed after injection, the init model matches, and one short turn completes. A failing canary publishes nothing, fails the workflow visibly, and retries after a cooldown.
- A publish only appends rows. Each new row carries provenance `auto`, `addedAt`, a Claude Code declaration (inject; output budget from `max_tokens`, capped at 64000), provider effort levels, and a deterministic label, tier and order. The document's `updatedAt` and watermark advance. Nothing else in the document changes.
- The published document passes the same schema rules as the client validator and the 512 KB cap.
- The commit message names each added model and the canary evidence: CLI versions and duration.
- A repository variable switches publishing off without a code change.
- The workflow runs only on schedule and dispatch, never on pull-request code, with least-privilege permissions and pinned actions. Secrets never appear in logs.

### R5: Clients pick up a publish within minutes

As a user with Ritemark open, I want a newly published model to appear without restarting.

Acceptance criteria:
- An online client checks the feed at least every 10 minutes, and when the Agent sidebar becomes visible after more than 10 minutes, using conditional requests (`If-None-Match` → 304).
- The runtime probe re-runs only when the set of models declared to the runtime changes, in addition to its existing triggers: activation, sign-in change, every 6 hours.
- An open model menu updates through the existing catalog `onUpdate` → bootstrap path.
- Measured in QA: feed commit → model menu within 15 minutes; Anthropic listing → model menu typically within 30 minutes.
- Offline, the last good cache is used, with no error surfaced.

### R6: No silent model substitution

As a user, I want to know when Ritemark cannot use the model I chose.

Acceptance criteria:
- If the saved or requested Claude model is not available, the transcript names the requested model and the one actually used, in one line, before the turn runs.
- If the API rejects a model — not found, or not permitted for this account or plan — the error names the model and suggests choosing another. The conversation stays usable. The Phase 0 audit (A2) records the exact error shapes.

### R7: Guardrails and kill switches

As the product owner, I want automatic publishing to be safe to leave on.

Acceptance criteria:
- The client rejects Claude feed ids that do not match `^claude-[a-z0-9]+(?:-[a-z0-9]+)*(?:\[1m\])?$` and never injects them.
- Automated rows cannot become defaults. The client ignores `behavesAs` on automated rows; only curated rows may carry one.
- With the `remote-model-catalog` flag off, there is no feed fetch, no live probe and no runtime declaration. Only the bundled or cached floor is used.
- A tombstone committed to the feed removes a model from menus within one refresh cycle (R5).
- Automated rows carry `minAppVersion` set to the first app version with this sprint's client, so older clients keep their current behavior.

### R8: Documentation and release process

As the next engineer, I want the new authority model written down where the next change will look.

Acceptance criteria:
- `docs/development/architecture.md` Model Catalog AS IS / TO BE and the Sprint 89 decision memo describe the existence / runnability / presentation split, runtime declarations, the static merge rule, and the publisher.
- The `release` skill gains a step: when a shell release changes the bundled Claude Code version, add it to the publisher's canary versions and keep the feed's non-Anthropic lineup current for older clients.
- The `ritemark-public` README documents the publisher, its switches and its secrets.
- The new tests run in `npm test`.

## Non-Requirements

- Updating the bundled CLI outside a shell release (C2) is a separate shell-tier decision. This sprint makes model visibility independent of it.
- Automatic default changes. The recommended default stays human-curated.
- Automatic retirement. Only people add tombstones; automation never removes or deprecates.
- Automated `behavesAs` profiles (audit: risk of `thinking: disabled` in CLI side paths).
- Auto-publishing OpenAI, Gemini, Codex or OpenCode models. R3's merge rule applies to every provider, but R4 publishes Anthropic only.
- Using Claude Code's OAuth token from Ritemark code.
- Depending on Anthropic's server-served CLI catalog. It is welcome when present, but not required.
- A signed feed. The Sprint 89 deferral stands; R7 guardrails limit the blast radius.

## Resolved Questions

- **2026-09-24 (Jarmo):** existence / runnability / presentation are separate authorities; the CLI list is not the existence authority.
- **2026-09-24 (Jarmo):** subscription users may see a model before the CLI knows it natively, through a runtime declaration after a canary.
- **2026-09-24 (Jarmo):** publishing is fully automatic and immediate.
- **2026-09-24 — Q1, where the publisher runs:** it runs in `ritemark-public`. This session was denied push access there, so the publisher is delivered as an apply-ready, tested payload ([ritemark-public/APPLY.md](./ritemark-public/APPLY.md)) for Jarmo to apply.
- **2026-09-24 — Q4, branch:** the local branch is `sprint-127-day-zero-models`, pushed to the remote ref `claude/anthropic-models-bundled-cli-gtjld9`, the only ref this session may push.
- **2026-09-24 — Q5, context window:** deferred. The feed carries no `contextWindow` until audit A3 shows how `CLAUDE_CODE_MAX_CONTEXT_TOKENS` behaves for an unknown model. Until then, an undeclared window uses the CLI's conservative default.

## Open Questions

- **Q2 — Credentials.** Jarmo creates a dedicated Anthropic workspace API key with a spend cap, stored as `MODEL_CATALOG_ANTHROPIC_API_KEY` in `ritemark-public`, and sets `MODEL_CATALOG_AUTOPUBLISH=on`. The publisher is inert until both exist.
- **Q3 — Release vehicle.** The client half ships with v1.12.0 by default. release-manager may pick an earlier extension-tier release if main allows. The feed bootstrap and the publisher go live when applied, independent of any app release.
