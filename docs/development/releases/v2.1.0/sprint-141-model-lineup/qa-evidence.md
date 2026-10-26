# Sprint 141 QA evidence

**Merge 1** (R1–R9, R11–R13), 27 October 2026, on `sprint-141-model-lineup`.

**The dev instance:**
- one hidden dev instance of this worktree's build, CDP port 9243;
- `--use-mock-keychain`, throwaway `--user-data-dir`, `--extensions-dir` and `--shared-data-dir`;
- `RITEMARK_BUILD_CHANNEL=test`, with usage data sending nowhere: no PostHog key is given to a test run;
- `CODEX_HOME` and `CLAUDE_CONFIG_DIR` pointed at throwaway folders, so the newer runtimes didn't touch Jarmo's own Codex or Claude state;
- `HOME` unchanged;
- one launch, reused for every step, then stopped.

**No provider key and no sign-in was used.** Nothing was written to `ritemark-public`.

**Known dev noise:**
- "Ritemark 2.0.1 is available" toast: the cloned `vscode/product.json` carries an older version (memory: CoW clone). Dismissed, not a product issue.
- "Loading models…" under a Flow step's model list for up to 5 s: the editor asks the host for a live list, and with no Google key it keeps the catalog's. This is today's behaviour.

## Results

| Scenario | Result | Evidence |
|---|---|---|
| S1 | Pass | The AI sheet's `agent:bootstrap` payload: Argon first in OpenCode's Google group and in OpenRouter's. Flows' Gemini list starts with Argon (`qa/flow-gemini-model-list.png`). Offline resolution in `modelCatalog.test.ts` |
| S2 | Pass | Dev run with the live feed (`c4808be`): Argon once in every list. `modelCatalog.test.ts` S141 R1/S2 |
| S3 | Pass | `modelConfig.test.ts` |
| S4 | **Not run** | Needs a Google key. Argon was run on 2.0.1's candidate on 24 October |
| S5, S6 | Pass | Bootstrap payload (below); `modelCatalog.test.ts` |
| S7 | Pass | Payload: `anthropic/claude-opus-4-8` `hidden` |
| S8 | **Not run** | Needs Anthropic, OpenAI and OpenRouter keys |
| S9 | Pass | A step switched to OpenAI proposed GPT-5.2; back to Gemini, Gemini 3.5 Flash Lite, and the flow file saved `gemini-3.5-flash-lite` |
| S10 | Pass | The model list: the 2.5 models last (`qa/flow-gemini-model-list.png`). Descriptions in the catalog (the Flow list shows names only) |
| S11 | Pass | The saved step kept `gemini-2.5-flash` on screen and in the file |
| S12 | **Not run** | Needs a Google key |
| S13 | Pass | The step with no model: its card and, after the R4 fix to the panel, its config panel show Gemini 3.5 Flash Lite (`qa/flow-unset-gemini-step.png`). `geminiCallSites.test.ts`: the run requests the same model |
| S14, S15 | Pass | `geminiCallSites.test.ts` (S14); `modelCatalog.test.ts` S141 R6 at app version 0.0.0 (S15) |
| S16–S18 | Pass | `geminiCallSites.test.ts`, mocked `fetch` |
| S19 | **Not run** | Needs a key from a new Google account |
| S20–S23 | Pass | `feedExport.test.ts` |
| S24, S25 | Pass | `runtimeDeclarations.test.ts`. The request-capture probe was not run: it changes `HOME` for its CLI |
| S26–S31 | Pass | `research/feed-check-report.md` (exit 0 with `--accept legacy:codex`); `research/feed-readers-audit.md` for the declaration replay. S31 also in `feedExport.test.ts` |
| S32–S34 | Pass | `checkModelFeed.test.ts` |
| S35–S41 | Merge 2 | — |
| S42 | Pass | `check:anthropic-models`: OK, catalog v3183, Claude Code 2.1.310 |
| S43 | Pass | `fetch-agent-runtimes` 12/12 PASS; `verify-agent-runtimes.sh` all executed checks pass, one SKIP (Windows sandbox helpers) |
| S44 | Pass | Claude Code 2.1.310's live list in the dev instance: `sonnet`, `opus`, `fable`, `haiku`; the lineup unchanged |
| S45 | Pass | Codex 0.164.0 `model/list`: GPT-6.1 Sol default |
| S46 | **Not run** | It needs a ChatGPT sign-in, and the only one is Jarmo's shared `~/.codex`. Running Codex 0.164.0 against it, newer than the installed app's 0.163.0, could migrate his Codex state. It moves to Gate 2 on a test profile |
| S47 | **Not run** | No Claude sign-in |
| S48 | **Not run** | Windows CI on the merge, then Gate 2 |
| S49–S51 | Pass | `geminiRequest.test.ts` (the source scan and its failing fixture), `geminiCallSites.test.ts` (each call site's header and URL; errors free of the key). Settings' key Test and the Flow editor's image list call the tested helpers, and the scan covers them |
| S52, S53 | Pass | `geminiRequest.test.ts` and `geminiCallSites.test.ts` |
| S54, S55 | Pass | `geminiCallSites.test.ts` |

**Windows overlay round (E6): not run in this session.** There is no Windows PC access from here. The extension side (the Flow editor's default, the lists in the payload) and the updated runtimes go to Gate 2 and Windows CI.

## Found and fixed during QA (R4)

The Flow editor's config panel showed the first model of the list for a step with no model, while the card and the run use the catalog's default. Before this sprint it was the same: Gemini 3.1 Pro shown, 2.5 Flash run.

`NodeConfigPanel.tsx`'s two model selects now fall back to the default first (`getDefaultLLMModel`, `getDefaultImageModel`). Screenshot after the fix: `qa/flow-unset-gemini-step.png`.

## The AI sheet's payload (dev run, live feed)

`byokProviderModels`, from the `agent:bootstrap` the AI sheet received:
- **Google:** Gemini 4 Argon, 3.1 Pro, 3.8 Flash, 3.5 Flash Lite, 2.5 Pro ("Retained for saved selections").
- **OpenAI:** GPT-6.1 Sol, GPT-6 Astra, GPT-5.6 Sol, Terra and Luna, GPT-5.2, GPT-4o.
- **Anthropic:** Claude Sonnet 5.5, Opus 5.5, Haiku 5.5, Sonnet 5, Opus 5, Opus 4.8 (hidden).
- **OpenRouter:** `google/gemini-4-argon`, `anthropic/claude-sonnet-5.5`, `anthropic/claude-sonnet-5`, `openai/gpt-6.1-sol`, Gemini 3.1 Pro and 3.8 Flash, GPT-6 Astra, GPT-5.6 Sol, Terra and Luna, GPT-5.2, Llama 3.3 70B.

Claude's live list (Claude Code 2.1.310, unauthenticated): `sonnet`, `opus`, `fable`, `haiku`, then hidden `claude-opus-4-8` and `claude-haiku-4-5-20251001`. The default representative is `sonnet`.

## Checks

- `npm test` (the full chain, with the new tests): pass.
- `npm run compile`: clean.
- The webview's `tsc --noEmit`: clean.
- The webview build: `media/webview.js` +16 bytes, `office-preview.js` byte for byte (`notes/bundle.md`).
- The pre-commit validator, run by hand with `CLAUDE_PROJECT_DIR` set to the worktree: pass.
- `./scripts/validate-qa.sh`: see the PR.
