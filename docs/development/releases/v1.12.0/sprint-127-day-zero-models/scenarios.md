# Sprint 127 Scenarios

BDD examples for [spec.md](./spec.md). ★ scenarios require automated or native evidence. Negative scenarios are marked (refusal).

## Feature: Subscription users on the bundled CLI (R1)

### ★ S1: A newly published model appears without a restart
Given a Max subscriber runs Ritemark with bundled Claude Code 2.1.270 and the Agent sidebar open
And the feed gains an automated row for `claude-opus-5-5` declared for the Claude Code runtime
When the client's next feed check completes
Then the Claude model menu shows one "Opus 5.5" row
And no restart, CLI update or Ritemark update was needed

### ★ S2: The published model runs on the bundled CLI
Given "Opus 5.5" is chosen in the model menu
When the user sends a prompt
Then the session init reports `claude-opus-5-5` with no "Model mismatch" line
And the first request uses adaptive thinking, never `disabled` or `budget_tokens`
And `max_tokens` equals the declared output budget

### S3: The runtime later learns the model natively
Given the feed declares `claude-opus-5-5`
And a later bundled CLI lists `opus[1m]` resolving to `claude-opus-5-5[1m]`
When the model menu is built
Then it shows one Opus 5.5 row, not two
And choosing it sends the request id the runtime lists natively

### S4: An older system CLI cannot take declarations (refusal)
Given the user prefers a system-installed Claude Code that predates `modelPicker`
When the feed declares `claude-opus-5-5`
Then the probe does not echo it
And the model menu does not offer it

### S5: The organization decides (refusal)
Given managed settings define `availableModels` without `claude-opus-5-5`, or define their own `modelPicker`
When Ritemark declares `claude-opus-5-5`
Then the runtime does not offer it
And Ritemark does not show it

### S6: The runtime probe is unavailable
Given no workspace folder is open, so the runtime probe cannot run
When the catalog resolves
Then the feed row "Opus 5.5" is offered from the merged catalog
And choosing it still declares the model to the session that runs it

## Feature: The list follows the running credential (R2)

### ★ S7: Subscription user with a saved API key
Given the Claude runtime authenticates with a subscription
And an Anthropic API key is saved for other features
When the catalog resolves
Then the Claude list comes from the runtime plus declared feed models
And not from `/v1/models` for that key

### ★ S8: API-key user sees a new model on day zero
Given the Claude runtime authenticates with an API key
And `/v1/models` lists `claude-opus-5-5` with effort low through max
When the catalog resolves
Then the menu shows "Opus 5.5" with those effort levels
And no feed publish was needed

### S9: Switching sign-in method re-resolves
Given the list was resolved for API-key sign-in
When the user signs out and signs in with a subscription
Then the list is resolved again for the subscription

## Feature: Catalog merge (R3)

### ★ S10: A stale feed cannot hide bundled models
Given the bundled catalog (2026-09-13) lists GPT-6 Astra
And the feed (2026-07-25) does not
When the catalog resolves
Then Astra is offered

### ★ S11: A stale feed cannot resurrect dropped models (refusal)
Given the feed (2026-07-25) lists `gpt-5.3-codex`
And the bundled catalog (2026-09-13) deliberately omits it
When the catalog resolves
Then `gpt-5.3-codex` is not offered

### ★ S12: A model published after the build is added
Given the bundled catalog is dated 2026-09-13
And the feed has an automated `claude-opus-5-5` row added 2026-09-24
When the catalog resolves
Then Opus 5.5 is offered, even though the build does not list it

### S13: A fresher feed updates presentation
Given the feed is fresher than the bundled catalog and relabels a bundled row
When the catalog resolves
Then the menu shows the feed's label
And the bundled exact-pin effort capability still applies

### ★ S14: A tombstone removes a model everywhere
Given a fresher feed marks `claude-opus-5-5` as `retired: true`
When the catalog resolves
Then the model is not offered
And it is not declared to the runtime

### S15: Automated rows never become the default (refusal)
Given a feed names an automated row as the `claude-code` default
When the catalog resolves
Then the default remains the curated default (Sonnet 5)

## Feature: Automatic publishing (R4)

*Withdrawn 2026-09-24 (D4). S16–S23 are kept for the record and are not tested.*

### ★ S16: A new model is published within one scheduled run
Given `/v1/models` newly lists `claude-opus-6` with `created_at` after the watermark
When the scheduled publisher runs
Then the canary passes on every configured Claude Code version
And one commit appends an automated row for `claude-opus-6` and advances `updatedAt` and the watermark
And the commit message names the model, the CLI versions and the canary duration

### ★ S17: A failing canary publishes nothing (refusal)
Given the canary for a candidate fails on CLI 2.1.270
When the publisher runs
Then the feed is unchanged
And the workflow run is marked failed
And the candidate is retried only after the cooldown

### S18: A dated snapshot of a known model is ignored
Given `/v1/models` lists `claude-opus-5-5-20260920` alongside the feed's `claude-opus-5-5`
When the publisher runs
Then no row is added

### S19: Legacy models are not backfilled
Given `/v1/models` lists `claude-3-haiku-20240307`, created before the watermark
When the publisher runs
Then no row is added

### S20: The kill switch stops publishing
Given `MODEL_CATALOG_AUTOPUBLISH` is not `on`
When the schedule fires
Then the job exits without reading `/v1/models` or writing the feed

### ★ S21: The publisher only appends (refusal)
Given a publish run would change an existing row, a default, or a non-Anthropic provider
When the additions-only check runs
Then the run fails without committing

### S22: Pull requests cannot reach the secret (refusal)
Given someone opens a pull request that edits the publisher
When the pull request's checks run
Then the publish workflow does not run
And no secret is available to the pull request's code

### S23: Overlapping runs publish once
Given a manual dispatch starts while a scheduled run is publishing
When both finish
Then the feed contains the new row once

## Feature: Immediate pickup (R5)

### ★ S24: Publish to menu within 15 minutes
Given Ritemark is online with the sidebar open
When a feed commit adds a model
Then the model appears in the menu within 15 minutes
And the time is recorded in QA evidence

### S25: An unchanged feed costs a 304
Given the feed has not changed
When the client checks it
Then the response is 304
And no runtime probe is started

### S26: Offline
Given the device is offline
When the client checks the feed
Then the last good cache is used
And no error is shown

### S27: A long-idle sidebar checks on show
Given the last feed check was 30 minutes ago
When the Agent sidebar becomes visible
Then a conditional feed check runs immediately

## Feature: Honest substitution (R6)

### ★ S28: An unavailable saved model is named
Given `ritemark.ai.selectedModel` is a model the catalog no longer offers
When the user sends a prompt
Then the transcript says which model was requested and which one is used, before the turn runs
And in a new conversation the notice appears once, although its first turn gives it a new id (added 2026-09-25, Codex review of #349)

### ★ S29: The account cannot use the model (refusal)
Given a subscription plan that cannot use a published model
When the user sends a prompt with that model
Then the error names the model and suggests choosing another
And after choosing another model the conversation continues

## Feature: Guardrails (R7)

### ★ S30: Malformed ids are rejected (refusal)
Given a feed row with the id `not a model; rm -rf /`
When the client validates the feed
Then the feed is rejected fail-closed and the last good cache or the bundled floor is used
And nothing is declared to the runtime

### S31: Automated rows cannot carry a behavior profile (refusal)
Given an automated row includes `behavesAs: claude-opus-5`
When runtime declarations are built
Then `behavesAs` is omitted for that row

### S32: The flag switches the whole path off
Given `remote-model-catalog` is disabled
When the catalog refreshes
Then no feed fetch, runtime probe or runtime declaration happens

### S33: Older clients are unaffected (refusal)
Given a Ritemark build older than this sprint's client reads a feed with automated rows
When it resolves its catalog
Then the automated rows are filtered out by `minAppVersion`

## Feature: Documentation (R8)

### S34: The next change finds the rules
Given an engineer opens `architecture.md` Model Catalog or the `release` skill
When they look for how Anthropic models become visible
Then they find the authority split, runtime declarations, the merge rule, the publisher, its switches, and the canary-version release step

*(Revised 2026-09-24, D4.)* Then they find the authority split, runtime declarations, the merge rule, the Claude Code currency rule, the pre-release check and the rules for hand edits to the feed. There is no publisher.

## Feature: Current Claude Code (R9, added 2026-09-24, D4)

### ★ S35: Opus 5.5 is in the menu on v1.12.0
Given a Claude Max subscriber on Ritemark v1.12.0, which bundles Claude Code 2.1.281
When they open the Claude Code model menu
Then "Opus 5.5" is listed once, because the bundled Claude Code lists it natively
And choosing it starts a session whose init reports `claude-opus-5-5`, with no "Model mismatch" line

### S36: Runtime pins stay in lockstep (refusal)
Given the runtime manifest says Claude Code 2.1.281
When `package.json` or `package-lock.json` pins another Agent SDK patch, or an optional SDK platform package differs
Then the runtime manifest validator fails and names the mismatch

### S37: Sonnet 5 stays the default
Given the bundled lineup gains Opus 5.5
When a new user opens the Claude Code model menu
Then the default is still Sonnet 5

## Feature: Pre-release check (R10, added 2026-09-24, D4)

### ★ S38: The check passes and names the models
Given Anthropic's catalog is reachable, valid and not expired
And no Claude Code model in it needs a newer Claude Code than the bundled one
When the release owner runs `npm run check:anthropic-models`
Then it exits 0 and prints the catalog version, its expiry, the bundled Claude Code version and the `main` models
And a `main` model missing from the bundled lineup is printed as a warning, where a dated snapshot of a bundled id counts as present

### ★ S39: A Claude Code that has fallen behind raises an alert (refusal)
Given the catalog lists a model with `min_claude_code_version` 2.1.290
And the runtime manifest bundles Claude Code 2.1.281
When the check runs
Then it exits non-zero with an ALERT naming the model and both versions
And a full release does not continue until Claude Code is updated or Jarmo defers it explicitly

### ★ S40: A moved, broken or expired catalog raises an alert (refusal)
Given the catalog URL answers with an error, invalid JSON, an unexpected shape, or an expired document
When the check runs
Then it exits non-zero with an ALERT naming the problem
And no user is affected, because the app never reads the catalog
