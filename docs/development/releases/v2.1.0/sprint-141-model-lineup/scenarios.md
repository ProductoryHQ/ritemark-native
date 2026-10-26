# Sprint 141 Scenarios

These are the manual QA matrix. Each one names the requirement it shows. "S" numbers are stable: a new scenario gets a new number.

**Where they run.** Unless a scenario says otherwise, it runs on the Mac, on a dev instance launched in the background with:
- its own short user-data directory;
- `--use-mock-keychain`;
- one launch reused for every step of a feature (memory: dev-instance CDP isolation; no pop-up test windows).

**Without keys.** There are no test keys (Jarmo, 26 October: "Mitte praegu"). Without a key, OpenCode's groups don't show in the composer, so the lists are read in two places:
- the host's `agent:bootstrap` payload (`byokProviderModels`), through the bridge trace (memory: webview bridge trace + hold-back);
- the Flow editor's `flow:modelConfig` message.

A scenario that needs a provider key says **Not runnable** and is recorded that way in the QA evidence.

**Test feeds.** A "test feed" is a document written to the dev profile's catalog cache (`modelCatalog_v1` in globalState) before launch, with an `updatedAt` newer than the live feed's. The resolver uses the fresher of remote and cache, so a dev run sees it without touching `ritemark-public`.

## Feature: Gemini 4 Argon in the lineup (R1)

### S1: Offline, a fresh profile
Given a fresh profile and no network
When a Flow's LLM step is switched to Gemini
Then its model list starts with Gemini 4 Argon
And the bootstrap payload's OpenCode `google` group starts with Gemini 4 Argon
And its `openrouter` group contains Gemini 4 Argon (`google/gemini-4-argon`).

### S2: Online with today's feed, Argon once
Given the live feed of `c4808be`, which carries its own Argon rows
When the catalog resolves
Then Flows' Gemini list and OpenCode's Google group each list Argon once
And the other rows and defaults are the bundled lineup's.

### S3: The ids live in one place
When `modelConfig.test.ts` runs
Then it finds no model id literal outside `modelConfig.ts`, with Argon and the new OpenRouter ids included.

### S4: A turn on Argon (Not runnable)
With a Google key, a 2.1 OpenCode turn on `google/gemini-4-argon` answers. It needs a Google key. It was proven on 2.0.1's candidate on 24 October.

## Feature: OpenCode's hand-made lists follow the lineup (R2)

### S5: The new rows
Given no network
When the bootstrap payload is read
Then `anthropic` lists Claude Sonnet 5.5, Opus 5.5 and Haiku 5.5, and still Sonnet 5 and Opus 5
And `openai` lists GPT-6.1 Sol
And `openrouter` lists Gemini 4 Argon, Claude Sonnet 5.5 and GPT-6.1 Sol.

### S6: OpenRouter's own ids
Then OpenRouter's Claude Sonnet 5.5 route is `anthropic/claude-sonnet-5.5`, the id in OpenRouter's public model list, and not `anthropic/claude-sonnet-5-5`.

### S7: Claude below 5 stays hidden (negative)
Then Opus 4.8 is in the payload marked `hidden`
And a chat saved on `anthropic/claude-opus-4-8` still resolves to it with no substitution line.

### S8: Turns on the new rows (Not runnable)
A turn on each new Anthropic, OpenAI and OpenRouter row answers. Each needs that provider's key.

## Feature: Flows' Gemini default (R3)

### S9: A new Gemini step
Given a new Flow with an LLM step
When the step's provider is switched to Gemini
Then its model is Gemini 3.8 Flash (or 3.5 Flash Lite, if A2 chose it)
And the step's card shows that model.

### S10: The 2.5 rows
When the Gemini model list opens
Then Gemini 2.5 Pro, 2.5 Flash and 2.5 Flash Lite are listed after the current models, each described "Retained for saved selections".

### S11: A saved Flow keeps its model (negative)
Given a Flow saved with a Gemini step on `gemini-2.5-flash`
When it is opened
Then the step still shows Gemini 2.5 Flash, not the new default
And the saved file is unchanged.

### S12: A run on the new default (Not runnable)
A Gemini step on the new default answers within its 2,000-token default. It needs a Google key.

## Feature: One default, in the editor and the run (R4)

### S13: The run uses the editor's default
Given a Flow file whose Gemini step has no `model`
When the step's card is shown
Then it names the catalog's Gemini default
And the run's request (a unit test with a mocked `fetch`) is made to that same model.

### S14: A feed default reaches both
Given a test feed whose Gemini `flow-llm` default is Gemini 3.5 Flash Lite
When the Flow editor opens
Then a new Gemini step proposes Gemini 3.5 Flash Lite
And `modelCatalog.getDefault('gemini', 'flow-llm')` returns the same.

### S15: Offline
Given no network and no cache
Then the editor and the run both use the bundled default.

## Feature: A saved Flow on a model Google refuses (R5)

These run as unit tests, with Google's documented responses as fixtures. No request reaches Google.

### S16: The documented refusal
Given a Gemini step on `gemini-2.5-flash`
When Google answers 404 with "models/gemini-2.5-flash is not found for API version v1beta, or is not supported for generateContent"
Then the run says "Google doesn't offer Gemini 2.5 Flash to this API key. Choose another model in this step, then run the Flow again.", once
And no JSON is shown
And the raw response is in the run's details.

### S17: Another Google error
Given Google answers with an error A2 has no matcher for
Then the run shows Google's own sentence once, unwrapped.

### S18: Key, quota and rate limits keep their sentences (negative)
Given Google answers with an invalid key, a quota or a rate-limit error
Then the run says what it says today, and not the model sentence.

### S19: What a new account sees (Not runnable)
What a key from a new Google account answers for `gemini-2.5-flash` and `gemini-2.5-pro`. It needs that key. Until it is seen, only the documented wording is matched.

## Feature: The export keeps what older apps need (R6)

### S20: Sonnet 5.5's declaration
Given today's feed and 2.1's bundled catalog
When `export-bundled-model-catalog.ts --merge` runs
Then the exported `claude-sonnet-5-5` row carries `claudeCode: { inject: true, maxOutputTokens: 64000 }`.

### S21: Argon's gate
Then the exported `google/gemini-4-argon` row carries `minAppVersion: '2.0.0'`, and appears once.

### S22: The bundled row's own value wins (negative)
Given a bundled row with its own `minAppVersion`
And a feed row with the same id and another `minAppVersion`
Then the export keeps the bundled row's.

### S23: The old rules stand
Then a curated feed-only row is dropped, an automated row or tombstone is kept unless curated again, and the defaults are the bundled lineup's (the existing `feedExport.test.ts` cases).

## Feature: 2.1 declares only what it doesn't know (R7)

### S24: No declaration for a bundled Claude model
Given a test feed whose Sonnet 5.5 row carries `claudeCode.inject`
When 2.1's catalog computes its declarations
Then Sonnet 5.5 is not among them
And a Claude session on Sonnet 5.5 is built with no `settings.modelPicker` and no `CLAUDE_CODE_MAX_OUTPUT_TOKENS` (the `AgentRunner` option assembly, unit-tested; the request-capture probe on a local server).

### S25: A feed-only Claude model is still declared (negative)
Given a test feed with a curated Claude row that 2.1 doesn't bundle, carrying `claudeCode.inject`
Then it is declared, as Sprint 127's S1.

## Feature: The refreshed feed (R8)

These run through the check (R9) on the candidate feed. They use the Claude Code probes where a CLI is involved.

### S26: 1.12.0 keeps Sonnet 5.5
Given the candidate
Then 1.12.0's Claude default is Sonnet 5.5, and Sonnet 5.5 is among its declarations
And Sprint 127's model-picker probe on Claude Code 2.1.281, unauthenticated, with that declaration lists `claude-sonnet-5-5`.

### S27: 1.13.0 to 2.0.1 list Sonnet 5.5 once
Given the candidate
Then the model-picker probe on Claude Code 2.1.289, 2.1.296 and 2.1.304 with the declared Sonnet 5.5 lists it once, as `sonnet` resolving to `claude-sonnet-5-5` (Sprint 127's S3)
And the request-capture probe shows which request id and `max_tokens` a session on the catalog's default sends. A1 records it.

### S28: Codex's default per version
Then the check reports:
- GPT-5.6 Sol on 1.12.0 and 1.13.0 (the gated GPT-6.1 Sol default skipped for their bundled one);
- GPT-6.1 Sol on 1.14.0 to 2.1;
- the first row they can see on 1.8.1 to 1.11.0, as A1 decided (*Open Questions* 9).

### S29: Every validator accepts it
Then the validator of every version from 1.8.1 to 2.1 accepts the candidate.

### S30: Nothing lost unnoticed (negative)
Then every model a version lists today that it wouldn't list after the refresh is named in the report, and accepted or fixed in the QA evidence.

### S31: 2.1 sees its own lineup
Given the candidate in a 2.1 dev profile's cache
Then every provider's rows and defaults equal the bundled floor's.

## Feature: The check before every feed publish (R9)

### S32: The report
When `npm run check:model-feed -- --candidate <file> --current <live feed>` runs on a checkout with tags
Then it prints, for v1.8.1 to v1.14.0, v2.0.0, 2.0.1 (`7810385d`) and the working tree, the rows added, removed and changed, each surface's default and the declared Claude models
And it exits 0 for the accepted candidate.

### S33: A validator rejects the candidate (negative)
Given a fixture candidate with a row that an older validator rejects
Then the check names that version and exits non-zero.

### S34: A default falls to the first row (negative)
Given a fixture candidate whose Codex default names a row gated away from a version that had a proper default before
Then the check flags that version's fallback and exits non-zero.

## Feature: OpenCode's lists from the live lists (R10)

Merge 2. The first to cut.

### S35: The live list, from fixtures
Given A3's recorded OpenCode model list for a provider with a key (a fixture)
When the catalog resolves
Then that provider's group is the filtered live list, with catalog labels for known models and OpenCode's names for new ones
And the other providers keep their static rows.

### S36: The filter
Given a live list with embedding, speech, image and batch variants, and a full OpenRouter list
Then none of those variants is listed
And OpenRouter's group holds only Google, OpenAI and Anthropic routes, plus the catalog's own OpenRouter rows.

### S37: A probe that fails (negative)
Given the provider probe or OpenCode's list fails or times out
Then that provider's group falls back to its static rows
And OpenCode stays ready for a provider with a key.

### S38: No network
Given no network
Then every group shows its static rows, as today.

### S39: The keyless run
Given the bundled OpenCode with no provider key, in an isolated XDG home
When Ritemark reads OpenCode's list the way A3 chose
Then it returns OpenCode's free `opencode/*` models
And the read's time and process cost are recorded in A3
And none of these models is shown in Ritemark's menu (*Non-Requirements*).

### S40: A new Google model with a key (Not runnable)
With a Google key, a model Google adds shows up in OpenCode's Google group without a feed edit or a release, and a turn on it works. It needs a Google key.

### S41: Windows
Through the test overlay on the latest Windows build from `main`: S35's fixtures, S37 and S38 behave as on the Mac.

## Feature: The release's runtime review (R11)

### S42: The Anthropic catalog check
After the Claude Code update, `npm run check:anthropic-models` prints OK on the sprint branch, with no warning that the lineup lacks a main model.

### S43: The runtimes verify
`fetch-agent-runtimes.mjs --all-platforms` and `--verify-only` give PASS for every row, and `verify-agent-runtimes.sh` on darwin-arm64 passes:
- version discovery for all three;
- the Codex code-mode host;
- OpenCode's permission gate (HARD GATE) with a free model: a write pauses, denial blocks, approval writes, cancel settles.

### S44: Claude's lineup matches its Claude Code
The model-picker probe on the new Claude Code, unauthenticated, lists the same models as the catalog's Anthropic rows, or the lineup changes in this sprint to match.

### S45: Codex's default matches its Codex
`model/list` on the new Codex, with an isolated `CODEX_HOME` and unauthenticated, names a default that the catalog's Codex default agrees with.

### S46: A ChatGPT chat after the update
Given a ChatGPT chat on a model other than the default, saved by `main`'s build
When the branch's build with the new Codex opens it, with Jarmo's own ChatGPT sign-in on the Mac
Then it keeps its model (Sprint 139 R6) and continues its own thread.
Codex 0.164.0 now "restores saved thread settings instead of replacing them with global defaults" when it resumes; this is where that would show.

### S47: Claude turns (Not runnable unless signed in)
An authenticated Claude turn on the new Claude Code, and Sprint 128's background probes. They need Jarmo's Claude sign-in on the dev instance; without it they are recorded as not run.

### S48: Windows
The updated runtimes on the Windows build from the merge (CI), then in 2.1's Gate 2: a Codex turn and the OpenCode permission gate.

## Feature: The Gemini key never travels in a URL (R12, #558; added 2026-10-26)

Unit tests with a mocked `fetch`. No request reaches Google, and no real key is used.

### S49: Every call site sends the header
Given a placeholder key value in the test's fake secret store
When each Gemini call runs (the model probe, a Flow's LLM step, its Imagen and Gemini image steps, the Flow editor's image-model list, Settings' Google key Test)
Then the request carries `x-goog-api-key` with that value
And its URL has no query parameter holding the key.

### S50: The source scan (negative)
When the source scan runs
Then it finds no `generativelanguage.googleapis.com` URL with `key=` in `src/` or `webview/src/`
And, on a fixture line that puts `?key=` in such a URL, it fails and names the file.

### S51: Errors don't carry the key
Given each call site's request fails (an HTTP error, a thrown `fetch`)
Then the message Ritemark shows or logs does not contain the key value.

## Feature: Gemini's model list is read in full (R13; added 2026-10-26)

### S52: Every page
Given a mocked `models.list` with two pages, joined by `nextPageToken`
Then the probe returns the models of both pages, asking for the largest page size.

### S53: A later page fails (negative)
Given the second page fails or times out
Then the probe returns the first page's models.

## Feature: R5, revised after A2 (added 2026-10-26)

### S54: "No longer available to new users"
Given a Gemini step on `gemini-2.5-flash`
When Google answers 404 `NOT_FOUND` with "This model models/gemini-2.5-flash is no longer available to new users." (the wording reported on Google's forum)
Then the run says R5's sentence for Gemini 2.5 Flash, once.

### S55: An answer cut off at Max tokens
Given a Gemini step whose response has `finishReason: MAX_TOKENS` and no text
Then the run says the answer used up the step's Max tokens, and to raise it, instead of "No response from Gemini API".
