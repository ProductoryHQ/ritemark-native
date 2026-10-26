# Flows' Gemini default and Google's refusals (A2)

Audit for R3 and R5, 26 October 2026. It reads Google's public Gemini API docs only. **No request was made to Google, and no key was used.**

**One thing shapes the reading.** Since mid-2026 the docs' main pages describe Google's newer Interactions API (`/v1beta/interactions`). The generateContent docs, which Ritemark's Flows call, sit in their own tree, `/gemini-api/docs/generate-content/...`. Where the two disagree, this audit follows the generate-content pages. Google says generateContent "remains fully supported" (the migration page, updated 23 September).

## The 2.5 models

- **The models page** (<https://ai.google.dev/gemini-api/docs/models>, updated 22 October), each 2.5 model page and the deprecations page all say:
  - access to Gemini 2.5 Pro, Flash and Flash Lite is limited to users who used them in the past;
  - they are "not deprecated", with no shutdown date;
  - new projects should use "3.5 Flash-Lite or 3.8 Flash".
- The page doesn't call them "legacy", as #531 said. The troubleshooting page does call them deprecated.
- **Google's changelog** dates the limit to 18 September 2026.
- **What a new project gets is not documented.** On Google's developer forum, people report a 404 `NOT_FOUND`. The message reads "This model models/gemini-2.5-flash is no longer available to new users", then points to a newer model. Reports came in July and on 19 September. A 10 September report adds that `models.get` still lists the model for such a project.
- **Not run:** what a new account's key answers. It needs that key (Jarmo, 26 October: "Mitte praegu").

## Google's errors

- **The generateContent error page** (<https://ai.google.dev/gemini-api/docs/generate-content/api-errors>, updated 23 October) documents these statuses. None of them is specific to a model:
  - 400 `INVALID_ARGUMENT` (an invalid key is 400 with reason `API_KEY_INVALID`, not 401);
  - 400 `FAILED_PRECONDITION`;
  - 402 `RESOURCE_EXHAUSTED` (prepaid credits);
  - 403 `PERMISSION_DENIED`;
  - 404 `NOT_FOUND` ("the requested resource wasn't found");
  - 429 `RESOURCE_EXHAUSTED`.
- **The error body** is `{error: {code, message, status, details[]}}`.
- **"… is not found for API version v1beta, or is not supported for generateContent"** appears on Google's forum, not in the docs. Sprint 139's corpus listed it as documented; it is "seen".

**Decision for R5:** match structurally. A 404 `NOT_FOUND` from a generateContent call whose message names `models/<that model>` is the refusal, whatever the words around it. Both seen wordings are fixtures (S16, S54). Any other error shows Google's own sentence once.

## Thinking and the 2,000-token default

From the generateContent thinking guide (<https://ai.google.dev/gemini-api/docs/generate-content/thinking>, updated 14 October) and the model pages:

| Model | Status | Thinks by default | Default with no `thinkingConfig` |
|---|---|---|---|
| `gemini-3.8-flash` | Stable (2 September) | Yes | `medium`; `minimal` is an error |
| `gemini-3.5-flash-lite` | Stable (21 July) | Yes | `minimal`, which "does not guarantee that thinking is off" |
| `gemini-4-argon` | Stable (13 October) | Yes, can't be turned off | `medium`; Google says to raise any output cap below 32,768; not on the free tier |
| `gemini-2.5-flash` | Access-limited | Yes | Dynamic budget |
| `gemini-2.5-flash-lite` | Access-limited | No | — |

- **Thinking tokens count against the output limit.** The guide says `max_output_tokens` includes thought tokens.
- **A request can end with nothing.** At the limit it stops with `MAX_TOKENS` and "truncated or empty output", and the thinking is still billed. Google's advice is a lower thinking level rather than a small output limit.

**Decision for R3, by its own rule:**
- A Flow's Gemini step sends `maxOutputTokens: 2000` and no `thinkingConfig`.
- At `medium`, 3.8 Flash can use that up, so the default is **Gemini 3.5 Flash Lite**.
- 3.5 Flash Lite also thinks, at `minimal`, so the risk is lower but not zero. Hence R5's revised Max-tokens sentence (S55).
- Changing the request (a `thinkingConfig` per model) would be a new behaviour; 2.5 models reject `thinkingLevel`. It is not in this sprint.

**Price** (<https://ai.google.dev/gemini-api/docs/pricing>, updated 26 October). Both models have a free tier.
- 3.5 Flash Lite: $0.30 input and $2.50 output per million tokens.
- 3.8 Flash: $0.75 and $3.75 until 31 December, then $1.50 and $7.50.

**Also found:**
- `temperature` is ignored by Gemini 3.6 Flash and newer, 3.5 Flash Lite included (API reference). A Flow step's temperature does nothing on the new default. It is recorded here, not changed.
- Imagen was shut down on 17 August 2026 (<https://ai.google.dev/gemini-api/docs/imagen>). The Imagen path in `ImageNodeExecutor.ts` is moved to the header by R12 like every other path; its future is not this sprint's.

## The key header (R12)

- Google's API overview (<https://ai.google.dev/api>, updated 26 October) says every request "must include a x-goog-api-key header". The generateContent key page shows it with v1beta.
- The reference pages' own samples for `models.list` and `models.get` still use `?key=`. A header example for v1 `models.list` is not shown. The API versions page says the Models API is in both v1 and v1beta.
- R12's mocks prove what Ritemark sends; that Google accepts it on each endpoint can't be run without a key.

## The model list (R13)

- `models.list` returns 50 models per page by default, with a `nextPageToken` (API reference). `discoverGemini()` reads only the first page.
- The troubleshooting page says list endpoints "only validate that your API key exists". So for a new account the list may still name the 2.5 models (forum reports agree). Narrowing OpenCode's list by Google's (R10) therefore can't drop them.

## Flows that name a 2.5 model

- Nothing shipped names one:
  - no Flow file in the repository;
  - nothing in the starter pack (`extensions/ritemark/starter-pack/`);
  - no fixture outside the tests.
- The flows skill (`.claude/skills/ritemark-flows/SKILL.md`) still lists `gemini-2.5-flash`, `gemini-3-pro` and `imagen-4`. E5 points it to `modelConfig.ts`.
- A person's own saved Flows keep their model (R3).
