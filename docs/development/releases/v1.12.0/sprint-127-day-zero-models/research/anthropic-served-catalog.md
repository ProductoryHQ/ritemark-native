# Anthropic's served model catalog and minimum Claude Code versions

Date: 2026-09-24. This audit followed Jarmo's challenge "I don't believe the CLI doesn't know new models". It led to product decision D4 ([sprint-plan](../sprint-plan.md#product-decisions)).

## What was checked

1. **The bundled binary.** We scanned the Claude Code binaries 2.1.270 (bundled) and 2.1.281 (npm `latest`) for model ids and for the code that handles the served catalog. The binaries were fetched from npm with integrity checks.
2. **The published catalog.** We fetched Anthropic's public catalog, `https://downloads.claude.ai/model-catalog/v1/catalog.json`, together with its detached signature (`.raw-sig.json`).
3. **npm dist-tags** for `@anthropic-ai/claude-code` and `@anthropic-ai/claude-agent-sdk`.

Evidence: [evidence/anthropic-served-catalog-2026-09-24.json](./evidence/anthropic-served-catalog-2026-09-24.json).

## What we observed

- **Claude Code can learn models without an update, but Anthropic controls when.** Since at least 2.1.270, the CLI can replace its compiled-in model list with Anthropic's signed catalog.
  - The signature is RSASSA-PKCS1-v1_5 with SHA-512; the embedded floor document is version 0.
  - The mode (`off`, `shadow` or `primary`) comes from Anthropic's server-side flag `tengu_delegated_quail`, and the default is `off`.
  - It also requires all of the following: a claude.ai (subscription) sign-in, a first-party API host, an organization, the policy `allow_model_catalog`, and traffic that is not limited to essentials.
  - Ritemark sets none of the environment switches that disable it.
  - Our earlier probes ran without a sign-in and with essential traffic only, so they could never see this path. When Anthropic leaves the flag `off` for an account, the CLI shows only its compiled-in list.
- **The catalog already lists Opus 5.5.** Version 1088, issued 2026-09-24T11:21:38Z and expiring 2026-10-01, lists 11 models for Claude Code (`cc`). Four are in the `main` section: Opus 5.5, Sonnet 5, Fable 5.1 and Haiku 4.5.
- **Anthropic ties new models to a minimum CLI version.** In the catalog, Opus 5.5 carries `min_claude_code_version: "2.1.280"` and Fable 5.1 carries `2.1.251`; older models carry none.
  - 2.1.270 contains neither the id `claude-opus-5-5` nor the field name `min_claude_code_version`.
  - 2.1.281 contains both, 51 and 11 times; every occurrence of the field is in its embedded catalog snapshots.
- **npm on 2026-09-24:**
  - `claude-code`: `latest` 2.1.281 (published 2026-09-23), `next` 2.1.282, `stable` 2.1.273. The `stable` release does not know Opus 5.5.
  - `claude-agent-sdk`: `latest` 0.3.281.

## What this means

Declaring Opus 5.5 to the bundled 2.1.270 would go against Anthropic's stated minimum for that model. That was the Sprint 127 R1 mechanism for this case, and nothing had shipped yet. The supported way for users to get a new model is a Claude Code version that Anthropic says supports it.

So the lever is to keep the bundled Claude Code current, and to check at every release whether it still is. The catalog tells us that without an API key.

## Decision (D4, approved by Jarmo on 2026-09-24: "nii sobib!")

1. **v1.12.0 bundles Claude Code 2.1.281 with Agent SDK 0.3.281.** Opus 5.5 joins the bundled lineup and is served natively.
2. **A pre-release check reads this catalog and raises an alert** when either:
   - the catalog cannot be fetched or parsed, has changed format, or has expired; or
   - a model needs a newer Claude Code than the build bundles.

   It warns when a `main` model is missing from the bundled lineup.
3. **Ritemark's own feed stays, edited by hand.** It serves OpenAI, Gemini, Codex and OpenCode, and can add or hide a model. It never declares a model to a Claude Code older than Anthropic's minimum for that model.
4. **The automatic publisher is withdrawn** (R4): no API key, no workspace, no scheduled workflow.
5. **Getting new models between releases** needs a way to update the bundled Claude Code without a full app release. That is a separate decision; there is no other supported path.
