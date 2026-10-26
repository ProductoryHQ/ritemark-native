# A2: the error corpus (R3–R5, R8, E1)

26 October 2026. The failures the one classifier (`src/runtime/runtimeErrorPresentation.ts`, `classifyRuntimeError`) knows, per runtime and kind, each with where it was seen. Every row is a fixture in `src/runtime/runtimeErrorPresentation.test.ts`.

**Sources**, by how sure they are:
- **Seen**: the error happened in Ritemark (an issue, Jarmo's report, or this sprint's ChatGPT run).
- **Bundled**: read in the bundled runtime itself (Codex 0.163.0's `codex-app-server` strings, OpenCode 1.19.3's ACP code, Claude Agent SDK 0.3.304's types).
- **Documented**: the provider's documented error body. Anchored on the provider's own phrase, never on a guess.

No matcher was built from a guess. The Claude plan refusal (#496) has no row: there is no Claude Free reproduction (audit A1, not run), so the classifier has no `plan` kind.

## Structured codes first

| Runtime | Where | Codes the classifier reads |
|---|---|---|
| Claude | The SDK's assistant event `error` (`SDKAssistantMessageError`), carried from `AgentRunner` as `errorCode` | `authentication_failed` → sign-in; `model_not_found` → model; `rate_limit` → a plan's limit; `billing_error` → credits **only with an API key** (with a Claude.ai sign-in it is A1's question, so it stays the provider's sentence) |
| ChatGPT | Codex's `TurnError.codexErrorInfo` (bundled 0.163.0: `contextWindowExceeded`, `usageLimitExceeded`, `rateLimitExceeded`, `httpConnectionFailed`, `responseStreamConnectionFailed`, `responseStreamDisconnected`, `unauthorized`, `badRequest`, …), read leniently by `codexTurnErrorCode` | `unauthorized` → sign-in; `usageLimitExceeded` → a plan's limit; the three connection variants **without** an HTTP status → no connection |
| OpenCode | ACP `RequestError`: `data.errorName` (OpenCode's `ACPServiceFailureError`), or JSON-RPC −32000 (`authRequired`), read by `acpTurnErrorCode` | `ProviderModelNotFoundError` → model; `ProviderAuthError` and −32000 → sign-in (a refused key) |

## The corpus

| Kind | Runtime | Error (abridged) | Source | Sentence or card |
|---|---|---|---|---|
| model | ChatGPT | `{"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The 'gpt-6.1-sol' model is not supported when using Codex with a ChatGPT account."}}` | Seen (#376, 1 October) | Card "ChatGPT couldn't use GPT-6.1 Sol", Use <default> |
| model | ChatGPT | the same envelope for `gpt-5.4-mini`, with `"code":"model_not_found"` | Seen (this sprint's run, 26 October) | Same card, live and after a restart |
| model | ChatGPT | `The '<model>' model requires a newer version of Codex. Please upgrade…` | Seen (a comment task, 14 September) | Same card |
| model | Claude | `There's an issue with the selected model (…)`, `not_found_error … model: …`, `… is not available. Your organization restricts model selection`, `… with 1M context is not available for your account` | Seen (Sprint 127 R6) | Same card, Claude's name |
| model | OpenCode | `Model not found: google/…` (OpenCode's own), `models/… is not found for API version v1beta`, ``The model `…` does not exist``, `… is not a valid model ID` | Bundled; documented | Card, no button (no catalog default for OpenCode) |
| sign-in | ChatGPT | `codexErrorInfo: unauthorized`; `Your access token could not be refreshed …`, `… Please log out and sign in again.` | Bundled | Card "ChatGPT needs you to sign in again", Sign in to ChatGPT |
| sign-in | Claude | `Failed to authenticate…`, `OAuth session expired…`, `Please run /login` | Seen (v1.10.0) | Claude's existing cards, unchanged |
| sign-in | OpenCode | −32000 `provider authentication required`; `API key not valid`, `Incorrect API key provided`, `invalid x-api-key`, `No auth credentials found` | Bundled; documented | Card "Google didn't accept the API key" (the company when known, else "OpenCode needs a working API key"), Open AI Settings |
| limit (credits) | OpenCode (Google) | `Internal error: Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects …` | Seen (Jarmo, 24 October) | "Google stopped this request" / "Your Gemini API credits have run out. Add credits in Google AI Studio, then send your message again." Where to go in words (A3) |
| limit (quota) | OpenCode (OpenAI, Google) | `insufficient_quota`; `You exceeded your current quota, please check your plan and billing details.` (both providers use it; the provider is read from the text, else the model) | Documented | "OpenAI stopped this request" / "Your OpenAI API key has reached its quota. Check your plan and billing on OpenAI's platform, then send your message again." |
| limit (credits) | OpenCode, Claude with a key (Anthropic) | `Your credit balance is too low to access the Anthropic API.` | Documented | A button, Open Claude Console (a trusted link domain) |
| limit (credits) | OpenCode (OpenRouter) | `Insufficient credits …` (only with an OpenRouter model, or OpenRouter named) | Documented | Words |
| limit (plan) | ChatGPT | `codexErrorInfo: usageLimitExceeded`; `You've hit your usage limit. … or try again at 3:05 PM.` | Bundled | "You've used ChatGPT's limit for now. It resets at 3:05 PM." Without a time: "Try again later." No reset time invented. Continue with <AI> when another AI is ready |
| limit (plan) | Claude | SDK `rate_limit`; the reset clause read when the text has one (`resets 3pm …`) | Bundled (the category) | "You've used Claude's limit for now. It resets at 3pm …" |
| network | all | `ENOTFOUND`, `EAI_AGAIN`, `ECONNREFUSED`, `ENETUNREACH`, `getaddrinfo`, `API Error: Connection error.`, `fetch failed`, `error sending request for url`, OpenCode's own list (`network connection was lost`, `failed to fetch`, …) | Bundled; Node | Card "Ritemark couldn't reach <AI>" / "Check your connection, then send your message again." |
| provider | all | anything else, unwrapped: `API Error: 500 {…"message":"Internal server error"}` → "Internal server error"; an envelope with nothing to say, or one cut short, gives no sentence of its own | — | Card "<AI> couldn't finish this request" / the provider's own sentence once, never JSON, then "Send your message again." |
| provider | ChatGPT, OpenCode | the runtime exits mid-turn | Ritemark | Card "<AI> stopped unexpectedly" / "Send your message again." (`errorDetail.exited`; the chat and the record now say the same; 2.0 said two different things) |

`ECONNRESET` and `ETIMEDOUT` are deliberately not "no connection": a server that answered and then dropped is not the person's connection.

## The words

The sentences above are the spec's proposals (R3–R5), with two narrow choices:
- **R4's sentence for the record** (2.0.x shows it, and comments and task cards use it): "<AI> couldn't use <model>. It isn't available in Ritemark right now." The card adds the way on. Claude's model sentence changes from Sprint 127's "Claude can't use … with this account. Choose another model…" to the same shape (R4: the same card for all three, with no word about the account).
- **OpenCode's refused key** names the company when the model says which ("Google didn't accept the API key. Check it in AI Settings, then send your message again.").

The Experience lead set the final words on 26 October (experience 13, *When the AI's turn fails*); this table carries them.
