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

*(Revised 2026-09-24, D4.)* The mechanism stays, for hand-added feed rows. A feed row may declare a model only when Anthropic's catalog gives that model no minimum Claude Code version, or a minimum that the bundled Claude Code meets. Opus 5.5 needs 2.1.280, so it reaches users through R9, not through a declaration to 2.1.270. The acceptance criteria above therefore apply to a feed-declared model in general; the `claude-opus-5-5` example is historical.

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

**Withdrawn 2026-09-24 (D4).** Anthropic ties new models to a minimum Claude Code version and already publishes a signed catalog of them ([audit](./research/anthropic-served-catalog.md)). An automatic publisher that declares new models to an older bundled CLI would work against both. R9 and R10 replace it. The publisher payload built for R4 was removed; its history is in commit `e03b8fc`.

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

*(Revised 2026-09-24, D4.)* With the publisher withdrawn, these guardrails protect feed rows edited by hand. The criteria are unchanged.

### R8: Documentation and release process

As the next engineer, I want the new authority model written down where the next change will look.

Acceptance criteria:
- `docs/development/architecture.md` Model Catalog AS IS / TO BE and the Sprint 89 decision memo describe the existence / runnability / presentation split, runtime declarations, the static merge rule, and the publisher.
- The `release` skill gains a step: when a shell release changes the bundled Claude Code version, add it to the publisher's canary versions and keep the feed's non-Anthropic lineup current for older clients.
- The `ritemark-public` README documents the publisher, its switches and its secrets.
- The new tests run in `npm test`.

*(Revised 2026-09-24.)* The publisher's documentation is `feeds/README.md` in `ritemark-public`, next to the feed. The repository's root README is the product landing page, and it is left unchanged.

*(Revised 2026-09-24, D4.)* The R8 documentation now covers R9 and R10. The release skill gains the pre-release check, the Claude Code currency steps and the rules for hand edits to the feed. The `ritemark-public` README item is withdrawn with R4.

### R9: The bundled Claude Code supports every model Anthropic currently offers (added 2026-09-24, D4)

As a Ritemark user, I want the Claude Code inside Ritemark to be one that Anthropic says supports the current models, so the newest model is in the menu and runs as Anthropic intends.

Acceptance criteria:
- v1.12.0 bundles Claude Code 2.1.281 for darwin-arm64, darwin-x64 and win32-x64, and Claude Agent SDK 0.3.281, in lockstep. The runtime manifest validator, the approved snapshot list, `package.json` and `package-lock.json` all agree, including all eight optional SDK platform packages.
- The manifest rows carry the npm integrity, the archive SHA-256 and the installed-binary SHA-256 measured from the npm packages, and pass `fetch-agent-runtimes` verification for every target.
- `docs/development/agent-runtime-compatibility.md` records the 2.1.281 measurements, and every check that could not run is marked as not proven (pre-commit check 11).
- `src/ai/modelConfig.ts` has the Opus 5.5 id, and the bundled lineup has a curated Opus 5.5 row without a Claude Code declaration. Sonnet 5 stays the default.
- A subscription user on v1.12.0 sees Opus 5.5 in the model menu because the bundled Claude Code lists it natively, and can run it.

### R10: A pre-release check of Anthropic's catalog raises an alert (added 2026-09-24, D4)

As the release owner, I want every release to check Anthropic's published model catalog, so a Claude Code that has fallen behind, or a catalog that has moved or changed, is caught before users are.

Acceptance criteria:
- `npm run check:anthropic-models` in `extensions/ritemark` fetches `https://downloads.claude.ai/model-catalog/v1/catalog.json` and parses it with a strict, unit-tested parser.
- It exits non-zero with an `ALERT` line naming the problem when:
  - the catalog cannot be fetched, is not JSON, fails the expected shape, or has expired;
  - any Claude Code model (surface `cc`) carries a `min_claude_code_version` newer than the Claude Code version in the runtime manifest, on any target.
- It prints a warning, and still exits 0, when a `main` model is missing from the bundled lineup. Dated snapshots of a bundled id count as present.
- On success it prints the catalog version, its expiry, the bundled Claude Code version and the `main` models.
- The release skill runs it in Step 0 (full release) and in the extension-only release, and release-manager Gate 1 requires it. An alert stops a full release until the bundled Claude Code is updated or Jarmo defers it explicitly. In an extension-only release, which cannot change Claude Code, the alert is reported to Jarmo.
- The app itself does not read this catalog. Nothing that users see depends on this URL.

## Non-Requirements

- Updating the bundled CLI outside a shell release (C2) is a separate shell-tier decision. This sprint makes model visibility independent of it. *(Revised 2026-09-24, D4: it no longer does. Anthropic ties new models to a CLI version, so delivering them between releases needs that channel.)*
- Automatic default changes. The recommended default stays human-curated.
- Automatic retirement. Only people add tombstones; automation never removes or deprecates.
- Automated `behavesAs` profiles (audit: risk of `thinking: disabled` in CLI side paths).
- Auto-publishing OpenAI, Gemini, Codex or OpenCode models. R3's merge rule applies to every provider, but R4 publishes Anthropic only. *(D4: R4 is withdrawn, so nothing is auto-published.)*
- Using Claude Code's OAuth token from Ritemark code.
- Depending on Anthropic's server-served CLI catalog. It is welcome when present, but not required. *(D4: the app still does not read it at runtime. R10 reads it at release time only.)*
- A signed feed. The Sprint 89 deferral stands; R7 guardrails limit the blast radius.

## Resolved Questions

- **2026-09-24 (Jarmo):** existence / runnability / presentation are separate authorities; the CLI list is not the existence authority.
- **2026-09-24 (Jarmo):** subscription users may see a model before the CLI knows it natively, through a runtime declaration after a canary.
- **2026-09-24 (Jarmo):** publishing is fully automatic and immediate.
- **2026-09-24 — Q1, where the publisher runs:** it runs in `ritemark-public`. This session was denied push access there, so the publisher is delivered as an apply-ready, tested payload for Jarmo to apply. *(Withdrawn by D4 on the same day; the payload is preserved in commit `e03b8fc`.)*
- **2026-09-24 — Q4, branch:** the local branch is `sprint-127-day-zero-models`, pushed to the remote ref `claude/anthropic-models-bundled-cli-gtjld9`, the only ref this session may push.
- **2026-09-24 — Q5, context window:** deferred. The feed carries no `contextWindow` until audit A3 shows how `CLAUDE_CODE_MAX_CONTEXT_TOKENS` behaves for an unknown model. Until then, an undeclared window uses the CLI's conservative default.

- **2026-09-24 (Jarmo) — D4: follow Anthropic's catalog and keep Claude Code current.** R4 is withdrawn, R9 and R10 are added, and R1 is narrowed. The basis is the [served-catalog audit](./research/anthropic-served-catalog.md).
- **2026-09-24 — Q2, credentials:** not needed. No Anthropic API key or workspace is used (D4).
- **2026-09-24 — Q3, release vehicle:** v1.12.0. The Claude Code bump (R9) is shell-tier, and v1.12.0 is a shell release already (D4).

## Open Questions

- ~~**Q2 — Credentials.**~~ Resolved by D4 (see above). Jarmo creates a dedicated Anthropic workspace API key with a spend cap, stored as `MODEL_CATALOG_ANTHROPIC_API_KEY` in `ritemark-public`, and sets `MODEL_CATALOG_AUTOPUBLISH=on`. The publisher is inert until both exist.
- ~~**Q3 — Release vehicle.**~~ Resolved by D4 (see above). The client half ships with v1.12.0 by default. release-manager may pick an earlier extension-tier release if main allows. The feed bootstrap and the publisher go live when applied, independent of any app release.
