# Who reads the model feed, and what the refresh does to each (A1)

Audit for R6–R9, 26–27 October 2026. It used:
- each release's own catalog code (`git archive` of its tag);
- the live feed (`ritemark-public` `c4808be`, read-only);
- a candidate exported from this branch.

**Nothing was written to `ritemark-public`.**

## The readers

| Releases | Resolver | `getDefault` (reads the configured default) | Declarations to Claude Code |
|---|---|---|---|
| 1.8.1–1.9.0 | Feed whole, whatever its date | As written, else the first row (`rp.defaults[surface] ?? rp.models[0]`) | None |
| 1.10.0–1.10.1 | Feed whole, whatever its date | The default if listed, else the first row | None |
| 1.11.0 | Feed whole, when at least as new as the bundled catalog | The default if listed, else the first row | None |
| 1.12.0–2.0.1 | Row by row (Sprint 127) | The default if listed, else the first row; a default whose row is gated away is skipped for the bundled one | From 1.12.0 |
| 2.1 (this branch) | Row by row | The same | Bundled ids from the bundled row (R7) |

The `getDefault` rule was read from each tag's `index.ts`, and `check:model-feed` prints it for every release.

**Who is on them** (the User lead's PostHog counts, 26 September – 26 October 2026, test profiles removed):

| Releases | People | Active in the last 7 days |
|---|---|---|
| 1.8.1–1.11.0 | 37, most of them one-time 1.11 Store newcomers | 4 |
| 1.14 | 29 | 16 |
| 2.0.x | 14 | 14 |

## The candidate

- **How it was made:**
  - `npx tsx scripts/export-bundled-model-catalog.ts --merge <live feed> --updated-at 2026-10-27T00:00:00Z`, with R6's carry-over;
  - `feedGates.ts`'s gates;
  - 2.1's bundled lineup.
- **The release step makes it again** from the release source: the lineup may still move, with W4's runtimes.

**Gates** (`src/ai/modelCatalog/feedGates.ts`, applied by the export only):

| Row | `minAppVersion` | Why |
|---|---|---|
| Codex `gpt-6.1-sol` | 1.14.0 | Codex 0.161.0 made it its own default; 1.14.0 is the first release with such a Codex (0.162.1). 1.13.0's 0.160.0 is older |
| Anthropic `claude-haiku-5-5` | 1.14.0 | Claude Code 2.1.296 (1.14.0) is the first bundled CLI whose `haiku` is Haiku 5.5 |
| OpenCode's new rows (Argon on Google and OpenRouter, the Claude 5.5s, GPT-6.1 Sol, OpenRouter's Claude Sonnet 5.5 and GPT-6.1 Sol) | 2.0.0 | OpenCode 1.19.3 (2.0.0) is the version Argon was run on (`c4808be`). Older OpenCode builds do fetch the current registry (A3), but nothing was run on them |

**No gate on a bundled row.** The plan allowed a bundled gate up to `main`'s version. The code showed otherwise: before activation, `modelCatalog` resolves with app version `0.0.0` (`index.ts`, `_appVersion`). A gate there would hide the row from the build itself until activation. So bundled rows carry none, and a unit test says so (R6, revised).

## What each release gets

`research/feed-check-report.md` has the full report. Exit 0 with `--accept legacy:codex`. In short:
- **No release loses a row** it lists today (S30).
- **Every release's validator accepts the candidate** (S29).
- **Claude Code's default:**
  - 1.8.1–1.12.0 move from Sonnet 5 to Sonnet 5.5;
  - 1.13.0 and later keep Sonnet 5.5;
  - 1.12.0 gets it through the carried declaration, which its Claude Code 2.1.281 needs (S26);
  - 1.8.1–1.11.0 have no declarations. Where a person chose no model, they ask their older Claude Code for `claude-sonnet-5-5`. The CLI passes an id it doesn't know through to the API, with its own 32K output default (Sprint 127). Not run.
- **Codex's default:**
  - 1.12.0 and 1.13.0 keep GPT-5.6 Sol (the gated default skipped for their bundled one, S28);
  - 1.14.0 to 2.1 keep GPT-6.1 Sol;
  - 1.10.0–1.11.0 fall to the first row they can see, GPT-6 Astra. This is decision 9, accepted. 1.11.0 reads this default only for comment tasks (`_commentTaskRuntimeSettings`);
  - 1.8.1–1.9.0 return GPT-6.1 Sol as written. No code in 1.8.1–1.9.0 reads the Codex catalog default (`git grep "getDefault('codex'"` finds nothing there), so nothing changes for their people. This is not what decision 9 assumed for these releases: the check showed it. The manager is told.
- **Flows' Gemini default:** Gemini 3.5 Flash Lite from the catalog for a step with no model of its own, on every release. Before 2.1, the editor proposes its build's own default for a new step (R4).
- **OpenCode's first row:**
  - Gemini 3.1 Pro up to 1.14.0, Gemini 4 Argon from 2.0.0, unchanged (Argon has been in the feed since 24 October);
  - OpenCode has no default; the first row is the one-shot model.
- **Shared rows on 1.12.0 and later take 2.1's presentation:**
  - Opus 4.8 and Haiku 4.5 are "Retained for saved selections";
  - the 2.5 Gemini rows are deprecated.

  On 1.13.0, which hides nothing, Opus 4.8 then appears in the Claude menu as a deprecated extra.
- **2.1 with the candidate** resolves exactly to its bundled floor (S31, `feedExport.test.ts`).

## Sonnet 5.5's declaration on 1.13.0–2.0.x

The refreshed feed carries `claudeCode: { inject: true, maxOutputTokens: 64000 }` on Sonnet 5.5. 1.13.0–2.0.x lack R7, so they declare it to their Claude Code, which already knows it natively.

**What was run.** Each release's own resolver and declarations were replayed:
- the live list its Claude Code reports, from the unauthenticated probes recorded in `agent-runtime-compatibility.md` (2.1.289, 2.1.296, 2.1.304);
- the candidate as the feed.

| Release | Declared | Menu | A new chat runs | A saved `claude-sonnet-5-5` runs | Session declaration |
|---|---|---|---|---|---|
| 1.13.0 | Sonnet 5.5 | `sonnet` (Sonnet 5.5), Opus 5.5, Fable 5.1, Opus 4.8 (deprecated), Haiku 4.5 | `sonnet` | `sonnet` | None |
| 1.14.0 | Sonnet 5.5 | `sonnet` (Sonnet 5.5), Opus 5.5, Fable 5.1, Haiku 5.5 | `sonnet` | `sonnet` | None |
| 2.0.x | Sonnet 5.5 | the same | `sonnet` | `sonnet` | None |

The declared row is shadowed by the native `sonnet` row (Sprint 127's S3). Every session runs `sonnet`, so no session carries `modelPicker` or the 64,000-token cap. The v2.0.0 compatibility entry also recorded that 2.1.304, given a `modelPicker` for a model it knows, lists the same rows.

**Not run: the Claude Code probes themselves** (`model-picker-probe.mjs`, `request-capture.mjs`) on old CLIs. They change `HOME` for the CLI they start, and this sprint's rules say never to change HOME. The replay and the recorded probe results stand in for them.

**Decision:** carry the declaration (decision 6). It is harmless on 1.13.0–2.0.x and needed on 1.12.0. 2.1 is immune through R7.

## Decisions

- **The gates:** the table above.
- **The report is accepted:**
  - 1.10.0–1.11.0's Codex fallback (decision 9);
  - 1.8.1–1.9.0's as-written Codex default, which nothing reads.
- **The release step** makes the candidate again from the release source, re-runs `check:model-feed` with `--accept legacy:codex`, and publishes with 2.1 (R8, decision 7).
