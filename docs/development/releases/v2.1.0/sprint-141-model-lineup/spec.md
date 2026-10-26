# Sprint 141 Spec — 2.1's model lineup

## Purpose

This is the model half of the 2.1 shape's item 4, "The AI you chose keeps working" (`ritemark-dev`: `releases/v2.1.0/shape.md`, approved by Jarmo on 21 October 2026). Sprint 139 split it off on 26 October.

What it delivers:
- **Model lists that match what the providers offer today.** Gemini 4 Argon, and the current Claude and GPT models in OpenCode's lists.
- **Flows that start on a Gemini model a new account can use.**
- **A model feed that is right for every app version that reads it**, from 1.8.1 to 2.1, and stays right after this release.
- **OpenCode's lists from what the providers and OpenCode itself offer**, so a new model needs no feed edit (#529, the first to cut).
- **The release's runtime review:** the bundled Claude Code, Codex and OpenCode against their latest versions.

## Principles

- **Model ids live in `src/ai/modelConfig.ts`. Model lists and defaults come from `src/ai/modelCatalog/`** (`CLAUDE.md`). `modelConfig.test.ts` already fails on an id literal anywhere else; nothing here weakens that.
- **The runtime decides what it can run.** Claude Code's `supportedModels()` does that for Claude (Sprint 127). OpenCode's own model list does it for OpenCode (R10). The provider decides what exists for a key. Ritemark decides how it is presented.
- **The feed serves every version at once.** Fourteen shipped releases read `feeds/model-catalog.json`, with two different resolvers (*Engineering requirements*, E2). A feed change is checked against each of them before it is published (R9).
- **The bundled catalog is the record.** The feed is exported from it at each shell release. Hand edits between releases add rows; they don't rewrite the lineup.
- **No unproven claims.** A proof that needs a Google, OpenAI or OpenRouter key is listed as not run, never worked around. Jarmo, 26 October: "Mitte praegu". A matcher for an error is built only from an error seen or documented, never guessed (Sprint 139's rule).
- **No silent change for a saved choice.** A Flow, chat or OpenCode pick saved on a model keeps it. Only new choices move.
- **People's names for things.** Gemini, ChatGPT, Claude, OpenCode. Never Codex in anything a person reads.

## Requirements

### R1: Gemini 4 Argon in the lineup (#532)

As someone who uses Gemini in a Flow or through OpenCode, I want Google's flagship model offered, even before Ritemark has fetched its model feed.

Acceptance criteria:
- `modelConfig.ts` has Argon's id in `GEMINI_MODEL_IDS`, and a row in `GEMINI_LLM_MODELS`.
- The bundled catalog lists Argon first in two places:
  - Flows' Gemini list (`gemini`): "Gemini 4 Argon", "Google's flagship reasoning model";
  - OpenCode's Google group (`opencode`, `google/gemini-4-argon`): "Gemini 4 Argon", "Google — flagship reasoning".
- OpenCode's OpenRouter group lists Argon (`openrouter/google/gemini-4-argon`). OpenRouter serves it: it is in OpenRouter's public model list with tool calling (checked on 26 October).
- A fresh profile with no network lists Argon in all three places.
- Online, the feed's hand-added Argon rows (ritemark-public `c4808be`) and the bundled rows show Argon once, not twice.
- The bundled catalog's `updatedAt` moves to the day the lineup changes, so the bundled rows count as newer than the current feed.

### R2: OpenCode's hand-made lists follow the lineup (#529's fallback; *Open Questions* 3)

As someone who uses OpenCode with my own key, I want its lists to carry the current models, even when the live lists of R10 aren't available.

Today OpenCode's Anthropic group stops at Claude Sonnet 5 and Opus 5, and its OpenAI group has no GPT-6.1 Sol. These bundled rows are also what the feed publishes to every older app (R8).

Acceptance criteria:
- OpenCode's bundled rows add:
  - Anthropic: Claude Sonnet 5.5, Opus 5.5 and Haiku 5.5;
  - OpenAI: GPT-6.1 Sol;
  - OpenRouter: Argon (R1), Claude Sonnet 5.5 and GPT-6.1 Sol.
- A row joins only when two lists name it:
  - the provider's own public list (Anthropic's Claude Code catalog, OpenAI's and Google's model pages, OpenRouter's `/api/v1/models`);
  - the model registry the bundled OpenCode reads (models.dev), under that provider, with tool calling.

  On 26 October models.dev named every row above. So did Anthropic's catalog for the Claude rows and OpenRouter's list for its routes. OpenAI's own page for GPT-6.1 Sol through the API wasn't read; A3 reads it. GPT-6.1 Sol is Codex's default, and OpenRouter lists `openai/gpt-6.1-sol`.
- OpenRouter routes use OpenRouter's own ids, which differ from the provider's for Claude: `anthropic/claude-sonnet-5.5`, not `anthropic/claude-sonnet-5-5`. These ids go in `OPENROUTER_MODEL_IDS` in `modelConfig.ts`.
- Claude below 5 stays hidden in OpenCode's groups and resolvable for a saved pick (v1.14.0's rule).
- A turn on each new row needs that provider's key. Those turns are listed as not run.

### R3: Flows' Gemini default is a model a new account can use (#531)

As someone new to Google's Gemini API, I want a Flow's Gemini step to start on a model my key can use.

Acceptance criteria:
- A Flow's new Gemini step proposes Gemini 3.8 Flash. If audit A2 finds that its thinking can use up the step's default 2,000 output tokens and leave no answer, it proposes Gemini 3.5 Flash Lite instead, which doesn't reason.
- The Gemini 2.5 models stay in Flows' Gemini list, and Gemini 2.5 Pro in OpenCode's Google group. They are marked deprecated, described "Retained for saved selections" (the words the catalog already uses for Opus 4.8 and GPT-5.4), and listed after the current models.
- A Flow saved on a 2.5 model keeps it and runs it as before. Nothing moves a saved step to another model.
- According to #531, Google's models page (updated 22 October) lists 2.5 as legacy, with access limited to past users. A2 re-reads it. Whether a new account's key is refused is **not proven**: it needs a key from a new Google account (*Not runnable*, below).

**R3, revised 2026-10-26 after A2** (`research/gemini-default-audit.md`):
- **The default is Gemini 3.5 Flash Lite.** Google documents that thinking tokens count against `maxOutputTokens`, and that a request can stop at `MAX_TOKENS` with truncated or empty output. Gemini 3.8 Flash thinks at `medium` by default, so R3's rule chose 3.5 Flash Lite.
- **3.5 Flash Lite also thinks,** at `minimal` by default ("minimal does not guarantee that thinking is off"). It is not "a model that doesn't reason", as R3 first said.
- Google's models page tells new projects to use "3.5 Flash-Lite or 3.8 Flash".
- The page does not use the word "legacy". It says access to the 2.5 models is limited to users who used them before, that they are not deprecated, and that no shutdown date is announced. The limit dates from 18 September 2026 (Google's changelog).
- The rows' wording, "Retained for saved selections", stands.

### R4: One default, in the editor and in the run (#531, an adjacent fix)

As someone building a Flow, I want the model the editor proposes to be the one the step runs when I leave it unset.

Today they come from two places:
- the editor takes `DEFAULT_MODELS` from `modelConfig.ts`;
- the run takes the catalog's `flow-llm` default.

A feed default reaches the run and never the editor.

Acceptance criteria:
- The Flow editor's defaults for the OpenAI and Gemini LLM steps come from the catalog (`modelCatalog.getDefault(provider, 'flow-llm')`), as the run's do.
- The bundled catalog's `flow-llm` defaults name `DEFAULT_MODELS.flowLLM` and `DEFAULT_MODELS.flowLLMGemini`, so the default is written in one place.
- An LLM step with no model in its JSON runs on the same model that the editor shows for it.

### R5: A saved Flow on a model Google refuses says so (#531)

As someone whose saved Flow uses a model Google no longer offers me, I want the step to say which model and what to do, not show a raw API error.

Acceptance criteria:
- When a Gemini step fails because Google doesn't offer the model to that key, the run shows one sentence that names the model by its catalog label and says what to do. Proposed wording: "Google doesn't offer Gemini 2.5 Flash to this API key. Choose another model in this step, then run the Flow again."
- What counts as that failure comes from Sprint 139's matchers (`runtime/runtimeErrorPresentation.ts`). That includes Google's documented "… is not found for API version v1beta, or is not supported for generateContent", and any wording A2 finds documented for legacy models. The matchers are not copied.
- Any other Google error shows Google's own sentence once, unwrapped, never JSON. Today's key, quota and rate-limit sentences stay as they are.
- The raw response stays in the run's details for diagnosis.
- What a new account actually sees for a 2.5 model is not proven (no key). Until it is seen, only the documented wording is matched.

**R5, revised 2026-10-26 after A2** (`research/gemini-default-audit.md`):
- **Google's error page doesn't document a model-specific error for generateContent.** It lists 404 `NOT_FOUND` as "the requested resource wasn't found". Two wordings for a refused model are publicly reported on Google's own developer forum, so they count as seen errors:
  - "This model models/gemini-2.5-flash is no longer available to new users." (404 `NOT_FOUND`, reported from July and in September 2026);
  - "… is not found for API version v1beta, or is not supported for generateContent".

  So the match is structural, not on words: a 404 `NOT_FOUND` from a model call whose error message names that model (`models/<id>`) is R5's refusal. Any other 404 shows Google's own sentence.
- **An answer cut off at Max tokens says so.** When Google returns `finishReason: MAX_TOKENS` and no text, the step says "The answer used up this step's Max tokens before any text came back. Raise Max tokens in this step, then run the Flow again." (proposed words). Today it says "No response from Gemini API". Thinking models make this more likely, and the docs say so.
- Google returns an invalid key as 400 `INVALID_ARGUMENT` with reason `API_KEY_INVALID`, not as 401. Today's key sentence keys on the message text and is unchanged.

### R6: The export keeps what older apps need (#530)

As the person refreshing the feed, I want the export to keep the fields that only older apps need, so a refresh can't take a model away from them.

Acceptance criteria:
- `scripts/export-bundled-model-catalog.ts --merge` carries two fields from the current feed onto a row that the bundled lineup also has:
  - `claudeCode`, when the bundled row has none;
  - `minAppVersion`, when the bundled row has none.

  The bundled row's own value always wins.
- Exporting today's feed keeps two values:
  - Sonnet 5.5's `claudeCode: { inject: true, maxOutputTokens: 64000 }`;
  - the OpenCode Argon row's `minAppVersion: '2.0.0'`.
- The existing rules stay:
  - automated rows and tombstones are kept unless curated again;
  - a curated feed-only row is dropped;
  - defaults come from the bundled lineup;
  - an unknown provider is kept.
- A bundled row may carry `minAppVersion` to gate the row for older apps through the feed. That version must be no higher than the version `main` builds, so that dev runs and tests still see the row. A gate above it is a hand edit in the feed at publish time, and R6 carries it on.

**R6, revised 2026-10-27 after A1** (`research/feed-readers-audit.md`):
- **No bundled row carries `minAppVersion`.** Before activation, `modelCatalog` resolves with app version `0.0.0`, so a bundled gate would hide the row from the build itself until activation, whatever its version.
- The gates for older apps are listed once, in `src/ai/modelCatalog/feedGates.ts`, and the export adds them to the published feed.
- A stricter gate already in the feed is kept.
- Fields are carried on only from a curated feed row. An automated row's fields belonged to the withdrawn publisher, and the curated bundled row replaces it whole.

### R7: 2.1 declares to its Claude Code only what it doesn't know (#530; *Open Questions* 6)

As someone on 2.1, I want my Claude sessions to run as the bundled Claude Code intends, whatever the feed declares for older apps.

Acceptance criteria:
- For a Claude model in 2.1's bundled catalog, the declaration (`claudeCode`) comes from the bundled row. A feed row with the same id can't add one.
- So the Sonnet 5.5 declaration that 1.12.0 needs (R6) never reaches 2.1's Claude Code:
  - no `modelPicker` row for it;
  - no `CLAUDE_CODE_MAX_OUTPUT_TOKENS` for its sessions.
- A Claude model the feed adds and 2.1 doesn't bundle is still declared, as Sprint 127 built.

### R8: The feed refreshed to 2.1's lineup, right for every version (#530)

As someone on any Ritemark from 1.8.1 to 2.1, I want the feed to show me models my app can run, with defaults that make sense for it.

Acceptance criteria:
- **Rows and defaults:** the published feed's rows and defaults are 2.1's bundled lineup, exported with R6, and checked with R9 before it is published.
- **Gates:** rows an older app's runtime can't run are gated with `minAppVersion` to the first version whose runtime runs them. A1 sets the list. The planning check proposes:
  - GPT-6.1 Sol in Codex's list: from 1.14.0, the first release whose Codex (0.162.1) offers it;
  - Haiku 5.5: from 1.14.0, the first Claude Code (2.1.296) that knows it;
  - OpenCode's new rows: from 2.0.0, as Argon's, unless A3 shows that older OpenCode builds read the current registry.
- **Defaults per version.** Today's defaults move as follows, and the check (R9) prints them for every version:

  | Surface | Before | After the refresh |
  |---|---|---|
  | Claude Code | Sonnet 5 on 1.12, Sonnet 5.5 on 1.13 and later | Sonnet 5.5 everywhere: declared to 1.12.0's Claude Code, native from 1.13 |
  | Codex | GPT-5.6 Sol (feed), GPT-6.1 Sol on 1.14 and later (bundled) | GPT-6.1 Sol from 1.14.0. 1.12 and 1.13 skip the gated default and keep their bundled GPT-5.6 Sol |
  | Flows' Gemini | Gemini 2.5 Flash | R3's model for a step with no model of its own. Before 2.1 the editor proposes its build's own default for a new step, so older apps keep proposing 2.5 Flash there (R4 fixes that from 2.1) |

  1.8.1–1.11.0 show the feed as a whole, and for them a gated default falls to the first row they can see. A1 records which model that is and decides (*Open Questions* 9).
- **No version loses a model it lists today** without it being named in the check's report and accepted in the QA evidence.
- **No tombstones** in this refresh: 1.8.1–1.11.0 don't know `retired`, and would show a tombstone as an ordinary row.
- **`updatedAt` is the publish time,** so the feed is newer than every bundled catalog, 2.1's included. That is safe only because the feed is then 2.1's lineup.
- **The publish is a cross-repo step.** It is a commit to `jarmo-productory/ritemark-public` `feeds/model-catalog.json` by `jarmo-productory`, made with 2.1's publication (*Open Questions* 7). The check's report goes into the release evidence. Until then, the feed stays as it is: 2.1's bundled catalog is newer than it, so 2.1 doesn't need the refresh in order to ship.

### R9: The check before every feed publish (#530)

As the person publishing the feed, I want to see what each app version will show before I publish, the way `c4808be` was checked by hand.

Acceptance criteria:
- `npm run check:model-feed -- --candidate <file> [--current <file>]` resolves the current and the candidate feed with the resolver, validator and bundled catalog of each release:
  - every tag from v1.8.1 to v1.14.0, and v2.0.0;
  - 2.0.1 by its source commit `7810385d`, because the native repository has no `v2.0.1` tag;
  - the working tree.
- For each version it prints:
  - rows added, removed or changed per provider;
  - each surface's default, with that version's own `getDefault` rules;
  - the Claude models declared to its Claude Code.
- It exits non-zero when any version's validator rejects the candidate, when a provider resolves to no rows, or when a default would fall back to "the first row" on a version where it didn't before.
- The release skill's *Hand edits to the feed* says when to use which:
  - **the refresh at each shell release:** export with `--merge`, add gates, run the check, publish with the release;
  - **a hand edit between releases:** a new row with its own `addedAt`, leaving `updatedAt` alone, as in `c4808be`; a changed default or shared row only after the check.

  This replaces today's "Bump `updatedAt` with every edit", which is wrong for a hand edit made between releases.

### R10: OpenCode's lists from the live lists (#529; the first to cut; *Open Questions* 1, 2)

As someone who uses OpenCode with my own key, I want a model my provider adds to show up in OpenCode's list without a Ritemark release or feed edit, and only if the bundled OpenCode can run it.

Acceptance criteria:
- For each provider with a key (Google, OpenAI, Anthropic, OpenRouter), OpenCode's group comes from the live list:
  - **what the bundled OpenCode itself offers** (its own model list, the runnability authority; audit A3 decides how it is read);
  - **narrowed to what the provider lists for that key**, where Ritemark already asks the provider with that key for Flows (Google, OpenAI). A model the key can't use then drops out by itself. Anthropic and OpenRouter aren't asked: that would be a new request, and OpenCode's list and the filter below are enough.
- The live rows are filtered:
  - chat models with tool calling only;
  - no embedding, speech, image or batch variants;
  - OpenRouter's group limited to the model families of Ritemark's lineup (Google, OpenAI, Anthropic) plus the catalog's own OpenRouter rows (Llama 3.3 70B).

  The filter is A3's, as one pure module.
- Labels, descriptions, tiers and order come from the catalog for a known model, and from OpenCode's own name for a new one.
- Claude below 5 stays hidden. A saved pick that is no longer listed resolves and runs, or is replaced visibly (Sprint 139 R6).
- **Fallback:** a provider with no key, an OpenCode that hasn't answered yet, a failed probe or no network leaves that provider's group on the static rows (bundled and feed). One provider's failure never empties another's group.
- **OpenCode stays ready:** a provider with a key always has at least one row, so OpenCode is never shown as needing setup because of a probe (`runtime/availability.ts`).
- **Version gates by construction:** a model the bundled OpenCode doesn't offer is never listed live.
- No new process per probe beyond what A3 accepts. Nothing new leaves the computer: OpenCode's own list is read locally, and the provider requests are the ones Flows already make.
- **Done when (#529):** with a Google key, a model Google adds shows up in OpenCode's list without a feed edit or a release, and a turn on it works. This is **not runnable** without a Google key; the keyless proofs are in *scenarios.md* (S35–S41).

### R11: The release's runtime review

As the people releasing 2.1, we want the bundled agent runtimes current, and the model lineup to match them.

Acceptance criteria:
- `research/runtime-review.md` compares each bundled runtime with its latest release and recommends, for each, whether to update. It covers:
  - Claude Code and the Agent SDK in lockstep;
  - Codex `codex-app-server`;
  - OpenCode.

  On 26 October:

  | Runtime | Bundled (2.0.1, `main`) | Latest |
  |---|---|---|
  | Claude Code / SDK | 2.1.304 / 0.3.304 | 2.1.310 / 0.3.310 |
  | Codex | 0.163.0 | 0.164.0 |
  | OpenCode | 1.19.3 | 1.19.4 |

  The ACP SDK is 1.4.0 against 2.0.2 latest. It is a major version and stays out of this review (*Non-Requirements*).
- `npm run check:anthropic-models` passes on the sprint branch after any Claude Code update, and again on the release source. On 26 October it returned OK on `main`: catalog v3177, no warnings, with these main models:
  - Opus 5.5 (Claude Code 2.1.280 or later);
  - Sonnet 5.5;
  - Fable 5.1 (2.1.251 or later);
  - Haiku 5.5.
- Each update the review recommends is made the release skill's way:
  - manifest values measured by script;
  - the lockstep snapshots updated;
  - `fetch-agent-runtimes.mjs --all-platforms` and `verify-agent-runtimes.sh`, including OpenCode's permission gate (HARD GATE);
  - Sprint 127's model probes;
  - a new row in `docs/development/agent-runtime-compatibility.md` (pre-commit check 11).
- The lineup follows the runtimes:
  - Claude's catalog rows match what the new Claude Code lists;
  - Codex's default matches what the new Codex offers;
  - OpenCode's rows (R2, R10) are checked on the OpenCode that ships.
- A newer runtime that appears after the merge is the release's call, not this sprint's.

### R12: The Gemini key never travels in a URL (#558; added 2026-10-26)

Added by the Development manager on 26 October under the scope-change protocol: "You're already in those files, and it's small."

As someone who saved a Google AI Studio key in Ritemark, I want it kept out of URLs. A URL ends up in proxy and gateway logs, crash reports and error messages.

Acceptance criteria:
- Every request Ritemark makes to `generativelanguage.googleapis.com` sends the key in the `x-goog-api-key` header and nothing in the URL's query. Google's API overview says every request "must include a x-goog-api-key header". The call sites:
  - the model probe (`providerDiscovery.ts`, `discoverGemini`);
  - the Flow editor's image-model list (`FlowEditorProvider.ts`);
  - a Flow's Gemini LLM step (`LLMNodeExecutor.ts`);
  - its Imagen and Gemini image steps (`ImageNodeExecutor.ts`);
  - Settings' Google key Test (`RitemarkSettingsProvider.ts`, which #558 didn't list).
- No error message, log line or run detail that Ritemark writes contains the key.
- **A test** scans the extension's source and fails on any Gemini URL with `key=` in it, the way `modelConfig.test.ts` scans for model ids.
- Each call site has a unit test with a mocked `fetch` that checks the header and the URL.
- Without a key, nothing else can prove it. No request reaches Google from a test.
- OpenCode's own Google calls are OpenCode's (the key reaches it as an environment variable), and so out of scope.

### R13: Gemini's model list is read in full (A2's finding; added 2026-10-26)

As someone with a Google key, I want Flows' Gemini list to hold every model Google offers me, not just the first page.

Google's `models.list` returns 50 models per page by default, with a `nextPageToken` for the rest (API reference). `discoverGemini()` reads only the first page.

Acceptance criteria:
- The probe asks for Google's largest page and follows `nextPageToken`, up to a fixed number of pages, within the probe's timeout.
- A failed later page keeps the pages already read.
- A unit test with mocked pages checks both.
- `models.list` doesn't check what a key may use: Google's troubleshooting page says a 200 "doesn't guarantee" inference access. So narrowing OpenCode's list by Google's (R10) can't drop the 2.5 models for a new account. R10's narrowing still drops a model Google doesn't list at all.

## Engineering requirements

### E1: One home for ids and lists

- Every new id is in `modelConfig.ts`, OpenRouter's own ids included. Every list and default is read through `modelCatalog`.
- The Flow editor stops reading `DEFAULT_MODELS` directly (R4).
- `modelConfig.test.ts`'s literal scan stays green.

### E2: Version skew

- **Two resolver families read the feed** (checked while planning; *technical-plan.md*):
  - **1.8.1–1.11.0** take the feed as a whole: 1.8.1–1.10.1 whatever its date, 1.11.0 when it is at least as new as their bundled catalog. They take its defaults as written, fall back to the first visible row for a default they can't see, and don't know `provenance`, `addedAt` or `retired` (1.11.0's code; A1 confirms the older ones);
  - **1.12.0–2.1** merge row by row. A default whose row is gated away from them is skipped for the next candidate.
- The candidate feed passes every version's validator (R9).
- 2.1 with today's feed, which stays until 2.1 publishes, resolves to its bundled lineup plus the feed's additions, with Argon once.

### E3: Tests

- **Extension unit tests:**
  - the lineup rows and the `modelConfig` scan;
  - the export's carry-over (R6);
  - the bundled-id declaration rule (R7);
  - the catalog-sourced Flow defaults (R4);
  - the Gemini step's error mapping, with fixtures (R5);
  - `check-model-feed`'s report and exit codes, against fixture feeds (R9);
  - OpenCode's live-list filter, merge per provider and fallback, against A3's recorded fixtures (R10).
- **Webview tests:** the Flow editor proposes the catalog's default for a new Gemini step.
- `npm test`, the webview tests and `./scripts/validate-qa.sh`.

### E4: The bundle (#107)

- This sprint adds no dependency.
- `media/webview.js` is measured before and after, because the Flow editor changes.

### E5: Docs

- **`architecture.md`:**
  - *Model Catalog resolver*: OpenCode's live layer replaces "deferred";
  - *Existence, runnability and presentation*: the bundled-id declaration rule, the two resolver families, the feed refresh and its check;
  - a version-history row.
- **The release skill:** *Hand edits to the feed* (R9), and *Claude Code and model currency* if the review changes a step.
- **`.claude/skills/ritemark-flows/SKILL.md`:** its model list (it still names `gpt-5-mini`, `gemini-3-pro` and `imagen-4`) points to `modelConfig.ts` and the catalog's defaults instead of listing ids. The harness equalizer carries it to `.agents/`.
- **`agent-runtime-compatibility.md`:** a row for each runtime update (R11).
- **`docs/CHANGELOG.md`**, and the 2.1 release notes draft through the Development manager.

### E6: Windows

- **Before merge 1**, through the test overlay on the latest Windows build from `main`:
  - Flows' new default in the editor (R3, R4);
  - the lists in the AI sheet's bootstrap payload (R1, R2).
- **The runtime updates** reach Windows only through a shell build: Windows CI on the sprint branch's merge, then 2.1's Gate 2.
- **Before merge 2**, through the overlay: R10's fallback and filter on Windows.

## Non-Requirements

- **OpenCode's free `opencode/*` models in Ritemark's menu.** OpenCode offers them with no key. Whether Ritemark shows them is a product decision for later.
- **A default model for OpenCode.** It has none today, and Sprint 139's model card relies on that.
- **Codex's model source** (#377), the same question as #529 for Codex.
- **Flows' OpenAI list and default.** A key holder's list is already live; GPT-5.2 stays the default.
- **Hiding deprecated rows from menus.** Only Claude below 5 is hidden, as today.
- **The ACP SDK 2.x update.** It is a major version, with its own review.
- **Electron and Node** (#515). They stay in the release's own runtime step, on the pinned VS Code.
- ~~**Moving the Gemini API key out of the request URL.**~~ Moved into scope on 26 October as R12 (#558).
- **Publishing the feed before 2.1** (*Open Questions* 7).

## Not runnable without keys

Jarmo, 26 October: no test keys or accounts for now ("Mitte praegu"). These are listed in the QA evidence as not run:
- a Flow's Gemini step on the new default (R3); a Google key;
- what a new Google account's key answers for `gemini-2.5-flash` and `gemini-2.5-pro` (R3, R5); a key from a new account;
- a 2.1 turn on `google/gemini-4-argon` (R1). It was proven on 2.0.1's candidate on 24 October with OpenCode 1.19.3;
- OpenRouter turns on the new routes (R1, R2); an OpenRouter key;
- OpenCode turns on the new Anthropic and OpenAI rows (R2); those keys;
- #529's done-when (R10); a Google key;
- authenticated Claude turns on the updated Claude Code, and Sprint 128's background probes (R11), unless Jarmo's Claude sign-in is available to the dev instance. Sprint 139 had none.

Runnable without keys:
- Sprint 127's model-picker probe (Claude Code lists models unauthenticated);
- its request-capture probe (a local server; a placeholder key that never reaches a provider);
- Codex's `model/list` with an isolated `CODEX_HOME`;
- OpenCode's permission gate and model list with its free models;
- OpenRouter's public model list;
- the models.dev registry;
- Codex turns with Jarmo's own ChatGPT sign-in on the Mac (Sprint 139 ran ChatGPT in full).

## Resolved Questions

- **2026-10-21 (Jarmo, the shape approved "with recommendations"):** item 4 is in 2.1, the model items with it.
- **2026-10-24 (Jarmo):** "jah, lisa gemini-4-argon ja OpenCode #376 alla": Argon joins the lineup.
- **2026-10-26 (the Development manager, Sprint 139's approval, decision 1):** #529–#532 become this sprint.
- **2026-10-26 (Jarmo):** no test keys or accounts for now ("Mitte praegu").
- **2026-10-26 (engineering, in this plan):**
  - 1.12.0's resolver does skip a feed default whose row is gated by `minAppVersion` for the next candidate, its bundled default. This was read in the code and run against a test feed. 1.8.1–1.11.0's resolver doesn't: it falls to the first visible row (*technical-plan.md*, *Checked while planning*);
  - only 1.12.0 needs Sonnet 5.5's declaration. Its Claude Code, 2.1.281, resolves `sonnet` to Sonnet 5. 2.1.289 (1.13.0) and later know Sonnet 5.5 natively (`agent-runtime-compatibility.md`);
  - gates go on bundled rows when the version is no higher than `main`'s, and in the feed by hand otherwise (R6);
  - OpenRouter's ids are OpenRouter's own (`claude-sonnet-5.5`), kept in `OPENROUTER_MODEL_IDS`.

## Open Questions

All are for the Development manager, who approves 2.1's plans under Jarmo's delegation. Each has a recommendation. The sprint plan repeats them under *Decisions*.

**Decided on 26 October, all nine as recommended** (`sprint-plan.md`, *Approval*). For decision 9, the User lead's counts (26 September – 26 October) show 37 people on 1.8.1–1.11.0, 4 of them active in the last 7 days, so GPT-6 Astra is accepted as their static fallback.

1. **#529's design.**
   - Recommended:
     - OpenCode's own model list decides what can run, as Claude Code's does;
     - the provider's list for the person's key narrows it where Ritemark already asks for Flows (Google, OpenAI);
     - OpenRouter is limited to the lineup's families.
   - The issue proposed provider probes with a version rule. OpenCode's own list makes the version rule unnecessary, and A3 confirms it can be read cheaply.
2. **#529 without a Google key.** Recommended:
   - build it last, as merge 2;
   - ship it on the keyless proofs (A3, fixtures, the free-model run), with the key proof listed as not run;
   - cut it to v2.2.0 if A3 shows that reading OpenCode's list needs a new process for every probe, or can't be filtered to a short menu.
3. **OpenCode's hand-made rows follow the lineup (R2),** on the evidence of the public lists, with turns not run. Recommended: yes. A model a provider refuses lands on Sprint 139's model card.
4. **Flows' Gemini default.** Recommended:
   - Gemini 3.8 Flash, or 3.5 Flash Lite if A2 finds thinking can use up the step's 2,000 tokens;
   - changed without a run, which isn't possible without a key, because a new account's 2.5 Flash probably fails today.
5. **The Gemini 2.5 rows.** Recommended:
   - kept, deprecated, "Retained for saved selections", listed last;
   - no tombstone, because 1.8.1–1.11.0 would show it, and past users still run them.
6. **Sonnet 5.5's declaration.** Recommended:
   - carried in the feed for 1.12.0 (R6);
   - 2.1 takes declarations for the models it bundles from its own catalog (R7).

   2.1 is then immune whatever older apps need, and 1.13–2.0.x stay on Sprint 127's shadowing, which A1 re-checks.
7. **When the feed is published.** Recommended:
   - with 2.1's publication, as a release step in `ritemark-public`, with the check's report;
   - a row in the release plan's checklist.

   Before then, 2.1 doesn't need it, and 2.0.1 would get a lineup it can't fully run.
8. **The runtime updates.** Recommended:
   - all three to their latest at merge 1: on 26 October, Claude Code 2.1.310 / SDK 0.3.310, Codex 0.164.0 and OpenCode 1.19.4;
   - the ACP SDK stays at 1.4.0.
9. **1.8.1–1.11.0's static Codex default after the refresh.** They show the feed whole, and fall back to the first row they can see (GPT-6 Astra in today's order) when GPT-6.1 Sol is gated away from them. They use this default only when no Codex cache matches their Codex. Recommended: accept it, if A1's version counts show few or none of these versions. Otherwise keep GPT-5.6 Sol first among the rows they can see.
