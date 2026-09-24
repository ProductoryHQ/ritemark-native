# GitHub issue draft — Sprint 127

Not yet published: opening it on `ProductoryHQ/ritemark-native` needs Jarmo's go-ahead.

**Title:** New Anthropic models don't reach Claude subscription users until a shell release

**Labels:** `enhancement` · **Milestone:** v1.12.0 (proposed)

**Body:**

When Anthropic releases a model (most recently Claude Opus 5.5), Ritemark users who sign in with a Claude subscription cannot choose it. The Claude Code model menu is built from the bundled CLI's compiled picker (Claude Code 2.1.270), and the model-catalog resolver treats that list as the only allowed set. The remote feed that was meant to add models without an app release cannot add a Claude model for these users. It has also been ignored by every current build since 2026-07-25, because it is older than the bundled catalog. API-key users are not affected: they get `GET /v1/models`.

The bundled CLI is not the obstacle. It runs an unknown first-party model with a valid current-generation request. It lists the model when Ritemark declares it through the SDK's `settings.modelPicker`, which is documented as "independent of the built-in lineup and of Claude Code releases".

Sprint 127 plan: [sprint-plan.md](../sprint-plan.md). The evidence and reproduction are in [research/model-visibility-audit.md](./model-visibility-audit.md).

- Split the model-catalog authorities: existence belongs to Anthropic, runnability to the runtime, presentation to Ritemark.
- Publish new Anthropic models to the feed fully automatically, after a canary on the pinned CLI.
- Declare published models to the bundled CLI; merge feed and bundled rows per row; poll the feed every 10 minutes.
- Never substitute a model silently.
