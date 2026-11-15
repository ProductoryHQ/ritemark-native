# OpenCode 1.19.4 retries a usage limit silently (measured 16 November 2026)

For a follow-up issue to #686. Sprint 160's PR C makes the card say the limit plainly once the turn ends; this note is about the minute or more before it ends, which PR C does not change.

## How it was measured

- The bundled OpenCode 1.19.4 (`opencode-darwin-arm64`, the version `binaries/agents/manifest.json` pins), run two ways: `opencode run -m google/gemini-2.5-flash "Say hi"` with its own config and data folders under a scratch folder, and inside a hidden Ritemark dev instance with isolated homes (`scripts/qa/dev-launch-isolated.sh`).
- Google was a local stand-in, [`probes/fake-google-429.mjs`](probes/fake-google-429.mjs): every call gets `429` with the Gemini API's `RESOURCE_EXHAUSTED` body, its message ending "Please retry in 41.143481245s." and a `RetryInfo` detail of `"retryDelay": "41s"`. It logs each call's time and path, never a key.
- OpenCode reached it through `OPENCODE_CONFIG_CONTENT={"provider":{"google":{"options":{"baseURL":"http://127.0.0.1:<port>/v1beta"}}}}`. It does reach it, both from the command line and through Ritemark, which passes its environment on to OpenCode.
- The key was a placeholder, saved in Ritemark's Settings for the dev run and given as `GOOGLE_GENERATIVE_AI_API_KEY` on the command line. No real key was used. Ritemark's own model-list check doesn't follow the base address, so in the dev run it may have sent the placeholder to Google's model list; the plan accepts that (decision 11).

## What OpenCode does

| The 429 carried | Calls for one message | Waits between calls (s) | First call to the error |
| --- | --- | --- | --- |
| No time at all | 6 | 2.2, 4.5, 9.9, 19.8, 36.4 | 72.7 s |
| The time in the body only ("Please retry in 41s", `RetryInfo`) | 6 | 2.1, 4.9, 8.9, 16.3, 39.4 | 71.5 s |
| An HTTP `Retry-After: 41` header | 6 | 41.0, 41.0, 41.0, 41.0, 41.0 | 205.1 s |

- **Five retries, then the error.** The waits double from 2 s, with jitter. The body's own time is not read: only the HTTP header is.
- **`Retry-After` is followed exactly, with no cap seen.** Five times the header's wait passes before the person hears anything. The technical plan read a cap of 2,147,483,647 ms in the code. A daily quota's header of an hour or more would outlast Ritemark's 15-minute OpenCode limit (`AcpRuntime.ts`), and the turn would end with the general "did not respond" instead of the limit card. That case was worked out, not run.
- **A second model is retried as well.** Each message also starts OpenCode's title step on `gemini-3.8-flash`, whatever the chat's model. It made three calls per message (two retries) and then gave up quietly. On a real key these calls count against that model's quota too.
- **The error that ends the turn** reaches Ritemark as an ACP internal error with Google's message text only: "Internal error: You exceeded your current quota, … Please retry in 41.143481245s." The `RESOURCE_EXHAUSTED` status and the `RetryInfo` detail don't come with it. PR C reads the time from the text.

## What a person sees in Ritemark

Seven turns in the dev runs (four on main, three on the PR C branch), all against the stand-in with the time in the body:

- "Working" showed for 65.7 to 71.4 s, and then the card.
- The status line read "Working — Starting OpenCode…" for the whole wait, as far as it was watched. No retry notice reached the sheet. The ACP messages themselves were not traced.
- Stop during the wait gives "Interrupted" (from the code; not run tonight).

## For the follow-up issue

- Say on the sheet that OpenCode is waiting on the provider, as ChatGPT's busy line does (Sprint 143): OpenCode would have to send its `retry` status over ACP, which 1.19.4 doesn't.
- Or cap the wait from Ritemark's side: end the turn once the provider has turned it away for a set time, with PR C's card.
- Ask OpenCode upstream to send the retry status over ACP and to cap `Retry-After`. Whether a report goes upstream is Jarmo's call, as with the pptx-renderer reports.
- The title step's retries spend the same quota. Worth naming in the issue, not fixing in Ritemark.

## Not measured

- A real Google key with an exhausted plan: the live body, and whether Google sends `Retry-After` (the stand-in's three cases cover what OpenCode does with each).
- Windows.
- OpenAI's, Anthropic's and OpenRouter's 429s through OpenCode.
