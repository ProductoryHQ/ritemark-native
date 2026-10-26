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
| S35–S41 | Merge 2 | See *Merge 2*, below |
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

## Decision 10, 27 October

- **The change:** OpenCode's Google group now leads with Gemini 3.8 Flash (free tier, per Google's pricing page of 2026-10-26), with Argon second.
- **Tests:** `modelCatalog.test.ts` covers the new order and an unchanged Flows list and default; `feedExport.test.ts` passes.
- **`check:model-feed`** was re-run on a freshly exported candidate: exit 0 with `--accept legacy:codex`. Every release from 1.8.1 gets 3.8 Flash as the group's first row; before, it was 3.1 Pro (1.8.1–1.14.0) or Argon (2.0.x).
- **Correction:** the payload listed under *The AI sheet's payload* above was captured before this change, so it still shows Argon first.
- **The CHANGELOG's free-key line** ("which a free AI Studio key can use") rests on Google's pricing page, https://ai.google.dev/gemini-api/docs/pricing (updated 2026-10-26), which lists Gemini 3.8 Flash as free of charge on the free tier. It was not run: no Google key was used, so S12 (a run on the new default) and S40 (a new Google model with a key) were not run.

## QA pass, 27 October

After the qa-validator review of #562 at `a73bf362`:
- **Rebased** onto `origin/main` at `72f509e8` (#560). `package.json` keeps main's home, guidance and splitButton tests plus this sprint's; `media/webview.js` was rebuilt, not merged; the CHANGELOG, `architecture.md` and `release-plan.md` keep both sprints' rows.
- **`scripts/run-flow-test.ts` and `.js`:** the developer script sent the Gemini key as `?key=` in the URL. It now sends it in the `x-goog-api-key` header, and S50's scan in `geminiRequest.test.ts` now covers `scripts/` too.
- **`webview/src/config/modelConfig.test.ts`** is now in `npm test`.
- **Checks on this branch's head:** see *Checks, QA pass* below.
- **The final rebase**, onto `origin/main` at `beac93b2` (#564 as `5019e42b`, then #565): `src/flows/FlowEditorProvider.ts` keeps Sprint 143's `pickerFolder` import and its two dialogs' `defaultUri` beside this sprint's `listGeminiModels` and `flowModelDefaults` imports; `package.json`'s test line keeps main's new tests (`dialogDefaults`, `codexRetry`, `HomePanel` and the rest) plus this sprint's; `media/webview.js` was rebuilt (+16 bytes over main's, `office-preview.js` byte for byte); the CHANGELOG, `architecture.md` and `release-plan.md` keep every sprint's rows. The release plan's 142 merge 2 and 143 rows now say merged. See *Checks, final rebase* below.

### Checks, QA pass

Run on the rebased branch with this pass's changes, before the commit that records them (on top of `873d5556`):
- `npm run compile`: exit 0.
- `npm test` (the full chain, now with `webview/src/config/modelConfig.test.ts`): exit 0.
- The webview's `tsc --noEmit`: clean.
- `./scripts/validate-qa.sh`: exit 0 ("Codex QA validation passed").
- The pre-commit validator, run by hand with `CLAUDE_PROJECT_DIR` set to the worktree: pass.

### Checks, final rebase

Run on the branch rebased onto `beac93b2` at `71a3a1cc`, before the commit that records them. A fresh webview build matched the committed bundle byte for byte.
- `npm run compile`: exit 0.
- `npm test` (main's chain with Sprint 143's and 142's tests plus this sprint's; `runtimeErrorPresentation` passes its Sprint 127, 139, 141 and 143 cases): exit 0.
- The webview's `tsc --noEmit`: clean.
- `./scripts/validate-qa.sh`: exit 0.
- The pre-commit validator, run by hand with `CLAUDE_PROJECT_DIR` set to the worktree: pass.

## Merge 2 (R10, #529), 27 October

| Scenario | Result | Evidence |
|---|---|---|
| S35 | Pass, on merge 2 restacked on merge 1's `3bf3805b` (on `origin/main` `beac93b2`, decision 10 included). Earlier passes: `28d5eb57`, whose merge 1 predated decision 10, and `3fe3342d` on merge 1's `d3857ab1` | `opencodeLiveList.test.ts` with A3's fixture (the list OpenCode 1.19.4 builds from the models.dev registry for the four providers' keys): catalog labels and order for known models, OpenCode's name for a new one (GPT-6.1 Terra). The Google group's first row is Gemini 3.8 Flash, Argon second (decision 10) |
| S36 | Pass | The same: no embedding, speech, image, live, batch or real-time routes; OpenRouter limited to the lineup's families plus Llama 3.3 70B. Offered per group: Google 5, OpenAI 8, Anthropic 5, OpenRouter 16 |
| S37 | Pass | A vendor without live rows keeps its static rows, and OpenCode stays ready (`deriveRuntimeAvailabilities`) |
| S38 | Pass | No live list gives today's static list. In a dev instance of the merge-2 build with no OpenCode session yet, the AI sheet's payload offers Google 5, OpenAI 7, Anthropic 5 and OpenRouter 12: the static rows. No catalog error in the log |
| S39 | Pass | The keyless run (`research/opencode-lists-audit.md`): 10 free `opencode/*` models, `{ value, name }` only, the first `session/new` in 320 ms and a second in 4 ms. None becomes a Ritemark row |
| S40 | **Not run** | Needs a Google key |
| S41 | **Not run** | No Windows PC access from this session |

- **What can't be seen without a key.** The composer shows OpenCode's groups only for a provider with a key, so the new menu can't be shown in a screenshot here. The Experience lead's look waits for a key, or for Gate 2.
- **The parts not unit-tested.** The wiring (`AcpManager.onModelOptions` to `noteOpenCodeModels`) is checked by `tsc` and the AcpRuntime and acpManager tests. The globalState round trip has no test of its own: it is a plain read and write.

### Merge 2's restack, 27 October

- **Restacked** on merge 1's QA-pass head `d3857ab1` (on `origin/main` `72f509e8`), then again on merge 1's final head `3bf3805b` (on `origin/main` `beac93b2`); the second time only `package.json`'s test line and this file conflicted. Conflicts: the CHANGELOG, `architecture.md` and this file kept both merges' text; `package.json` keeps merge 1's test chain plus `opencodeLiveList.test.ts`. No webview source changes in merge 2, so `media/webview.js` is merge 1's.
- **The fix the restack needed:** `opencodeLiveList.test.ts`'s S35 expected Argon as the first row; with decision 10 it is Gemini 3.8 Flash.
- **Checks on the restacked branch, before the commit that records them:** see *Checks, merge 2's restack* below.

