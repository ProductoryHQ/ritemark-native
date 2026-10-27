# Sprint 141 Tasks

Nothing here starts before the plan is approved. Tick a box only when the change is on the sprint branch.
- W numbers are workstreams in [technical-plan.md](technical-plan.md).
- R and E numbers are requirements in [spec.md](spec.md).
- S numbers are scenarios in [scenarios.md](scenarios.md).
- A numbers are the Phase 1 audits.

## Phase 0: Branch and starting tree

- [x] `git checkout -b sprint-141-model-lineup` from `origin/main`; `git branch --show-current` shows it
- [x] `git fetch --tags`, so the check (R9) can read every release tag
- [x] `media/webview.js` size recorded in `notes/bundle.md` (E4)
- [x] Ask the Development manager for:
  - the last 30 days' distinct ids by `app_version` from PostHog, for A1;
  - the decisions in `sprint-plan.md` (*Decisions*) not already given with the approval

## Phase 1: Audits first

- [x] `research/runtime-review.md` (A4; R11). It comes first, because A1 and A3 run on the runtimes that ship:
  - each runtime's releases since the bundled one, and what touches Ritemark;
  - a recommendation for each;
  - `check:anthropic-models`;
  - the verification plan
- [x] `research/feed-readers-audit.md` (A1; R6–R9):
  - version counts;
  - the candidate exported from this branch, and the check's report;
  - Sonnet 5.5's declaration on the Claude Code of 1.12.0, 1.13.0, 1.14.0, 2.0.x and 2.1 (`model-picker-probe.mjs`, `request-capture.mjs`);
  - the gate list;
  - `getDefault` in every release's `index.ts`;
  - the decision, including 1.8.1–1.11.0's Codex default (*Open Questions* 9)
- [x] `research/gemini-default-audit.md` (A2; R3, R5):
  - Google's legacy wording and documented refusal, dated;
  - 3.8 Flash's and 3.5 Flash Lite's thinking against `maxOutputTokens: 2000`;
  - Flows that name a 2.5 model;
  - the default and the matchers.

  Not run: a new account's answer
- [x] `research/opencode-lists-audit.md` (A3; R2, R10):
  - the three ways to read OpenCode's list, keyless, with cost;
  - providers from the environment (from OpenCode's source);
  - the registry, live or snapshot, and older OpenCode builds;
  - the shape and fixtures;
  - the filter and the menu's length;
  - narrowing;
  - go or cut for merge 2
- [x] Where an audit changes a requirement, `spec.md` changes first (the Mid-Sprint Scope Change Protocol)

## Phase 2: The lineup (W1)

- [x] `src/ai/modelConfig.ts`: `GEMINI_MODEL_IDS.ARGON_4`, Argon's `GEMINI_LLM_MODELS` row, `OPENAI_MODEL_IDS.SOL_6_1`, and OpenRouter's own ids in `OPENROUTER_MODEL_IDS` (R1, R2, E1)
- [x] `src/ai/modelCatalog/bundledCatalog.ts` (R1, R2, R3):
  - Argon in `gemini` and `opencode` (Google, OpenRouter);
  - OpenCode's Anthropic, OpenAI and OpenRouter rows;
  - the 2.5 rows deprecated, "Retained for saved selections", last;
  - A1's gates no higher than `main`'s version;
  - `updatedAt` and the header comment
- [x] Tests (E3):
  - `modelConfig.test.ts`;
  - `modelCatalog.test.ts`: Argon first offline, once with a `c4808be` fixture, OpenRouter's ids, Claude below 5 hidden in `getByokProviderModels()`;
  - every bundled `minAppVersion` no higher than `package.json`'s version

## Phase 3: Flows (W2)

- [x] `src/ai/modelConfig.ts`: `DEFAULT_MODELS.flowLLMGemini` is A2's model (R3)
- [x] `bundledCatalog.ts`: the `flow-llm` defaults name `DEFAULT_MODELS.flowLLM` and `DEFAULT_MODELS.flowLLMGemini` (R4)
- [x] `src/flows/FlowEditorProvider.ts`: `sendModelConfig()` sends the catalog's `flow-llm` defaults, and sends again on `modelCatalog.onUpdate` (R4)
- [x] `src/runtime/runtimeErrorPresentation.ts`: export the documented Google model matchers for reuse; no copy (R5)
- [x] `src/flows/nodes/LLMNodeExecutor.ts`: on a Gemini failure, `providerModelRefusal()` gives R5's sentence with the catalog label; Google's sentence once otherwise; the raw body to the execution log; key, quota and rate limit unchanged (R5)
- [x] Tests (E3):
  - the executor with a mocked `fetch`: no `model` → the catalog default; the documented 404; an unmatched error; key, quota and rate limit;
  - the config message with a test feed;
  - the webview's new Gemini step
- [x] `.claude/skills/ritemark-flows/SKILL.md`: the model list points to `modelConfig.ts` and the catalog's defaults (E5)

## Phase 3b: The Gemini key and list (W2b; R12, R13, R5 revised; added 2026-10-26)

- [x] `src/ai/geminiRequest.ts` (new): `geminiUrl()` and `geminiHeaders()` (R12)
- [x] Every Gemini call site uses them (R12):
  - `providerDiscovery.ts`;
  - `FlowEditorProvider.ts`;
  - `LLMNodeExecutor.ts`;
  - `ImageNodeExecutor.ts` (both paths);
  - `RitemarkSettingsProvider.ts`
- [x] `geminiRequest.test.ts`: the source scan with its failing fixture, and the helper (S50)
- [x] Call-site tests with a mocked `fetch`: the header, the URL, error messages free of the key (S49, S51)
- [x] `discoverGemini`: `pageSize=1000`, `nextPageToken` up to 5 pages, a failed page keeps the rest; tested (R13, S52, S53)
- [x] Found in QA (R4): `NodeConfigPanel.tsx`'s model selects show the default for a step with no model, as its card and the run do
- [x] `LLMNodeExecutor`: the structural 404 refusal and the `MAX_TOKENS` sentence; tested (R5 revised, S54, S55)

## Phase 4: The feed tooling (W3)

- [x] `src/ai/modelCatalog/feedExport.ts`: `carryOver()` for `claudeCode` and `minAppVersion` (R6)
- [x] `src/ai/modelCatalog/runtimeDeclarations.ts`: `withBundledDeclarations()`; `index.ts` `computeDeclarations()` uses it (R7)
- [x] `scripts/check-model-feed.ts` and `npm run check:model-feed`: refs, `git archive` per ref, both feeds resolved with each ref's own code, the Markdown report, the exit codes (R9)
- [x] Fixture feeds under `src/ai/modelCatalog/testdata/` for the check's negative cases (S33, S34)
- [x] Tests (E3):
  - `feedExport.test.ts` (S20–S23);
  - `runtimeDeclarations.test.ts` (S24, S25);
  - the check (S32–S34)
- [x] `.claude/skills/release/SKILL.md`: *Hand edits to the feed* (the refresh at each shell release; hand edits between releases; the check), replacing "Bump `updatedAt` with every edit" (R9)
- [x] A1's candidate and report recorded in `research/feed-readers-audit.md`. Nothing is written to `ritemark-public` (R8)

## Phase 5: The runtime updates (W4), as decided after A4

- [x] Claude Code and the SDK in lockstep:
  - the manifest rows, measured;
  - `npm install --save-exact @anthropic-ai/claude-agent-sdk@0.3.N`;
  - the lockstep snapshots and their test;
  - `anthropicCatalogCheck.test.ts`'s pinned version (R11)
- [x] Codex: the manifest rows from the release assets, the members, the snapshots (R11)
- [x] OpenCode: the manifest rows from npm, the snapshots (R11)
- [x] Verify:
  - `validate-agent-runtime-manifest.mjs`;
  - `fetch-agent-runtimes.mjs --all-platforms` and `--verify-only`;
  - `tsc --noEmit`, the full `npm test`;
  - `verify-agent-runtimes.sh` with OpenCode's HARD GATE;
  - the model-picker and request-capture probes;
  - Codex `model/list`;
  - `check:anthropic-models` (S42–S45)
- [x] The lineup follows the new runtimes: any change in W1's rows, in this merge (S44, S45)
- [x] `docs/development/agent-runtime-compatibility.md`: the v2.1.0 section, with what was not proven and why (E5)
- [x] The sprint plan's tier line confirmed (shell if any runtime moved)

## Phase 6: QA and merge 1

- [x] Manual QA on the Mac: S1–S3, S5–S7, S9–S11, S13–S18, S20–S34, S42–S46. S46 uses Jarmo's own ChatGPT sign-in
- [x] Recorded as not run, with why: S4, S8, S12, S19; S47 unless a Claude sign-in exists
- [ ] Windows overlay round on the latest Windows build from `main`: the Flow editor's default, the lists in the bootstrap payload (E6). **Not run in this session** (no Windows PC access); Gate 2 and Windows CI
- [x] `media/webview.js` measured after; `notes/bundle.md` (E4)
- [x] `architecture.md`:
  - *Model Catalog resolver*;
  - *Existence, runnability and presentation*: R7, the two resolver families, the refresh and its check;
  - a version-history row (E5)
- [x] `docs/CHANGELOG.md`; the release notes draft to the Development manager (E5)
- [x] `npm test`, the webview tests, `./scripts/validate-qa.sh`; the pre-commit validator by hand on the worktree (`CLAUDE_PROJECT_DIR="$PWD"`)
- [ ] PR opened, with A1, A2 and A4. Then:
  - `qa-validator`;
  - the Development manager's smoke test;
  - the release plan's tracker row;
  - the admin merge

## Phase 7: OpenCode's live lists and merge 2 (W5), if A3 says go

A3 said go (27 October). As built, the shape differs from the plan's names, as the technical plan's W5 note says:
- one function, `openCodeLiveRows()`, filters and narrows;
- `AcpManager` hands the `session/new` model option to `modelCatalog.noteOpenCodeModels()`, which keeps it and re-resolves;
- `extension.ts` is unchanged: the catalog adds the live rows to every discovery result itself (`withOpenCodeLive`).


- [x] `src/ai/modelCatalog/opencodeLiveList.ts` (new): `filterOpenCodeModels()`, `narrowToProvider()` (R10)
- [x] `src/ai/modelCatalog/providerDiscovery.ts`: `discoverOpenCode()` with A3's read; `src/acp/acpManager.ts` keeps the last `session/new` model option, if A3 chose (a) or (c) (R10)
- [x] `src/ai/modelCatalog/resolver.ts`: the per-vendor merge for `opencode` (R10)
- [x] `src/extension.ts`: `results.opencode` in the discovery provider; a BYOK key change calls `modelCatalog.refreshDiscovery()` (R10)
- [x] Tests:
  - the filter, the narrowing, the per-vendor merge and the fallback with A3's fixtures;
  - the readiness invariant;
  - Claude below 5 hidden (S35–S38, E3)
- [x] QA: S35–S39 by unit tests with A3's fixtures and the keyless run. S40 recorded as not run (no key). S41 (Windows overlay) not run in this session
- [ ] Screenshots of the composer's OpenCode groups to the Experience lead. **Not possible without a key**: the composer shows OpenCode's groups only for providers with a key. The menu each group would show is listed in `qa-evidence.md` instead
- [x] `architecture.md`: OpenCode's live layer; the version-history row amended (E5)
- [ ] PR. Then:
  - `qa-validator`;
  - the Development manager's smoke test;
  - the admin merge.

  If A3 said cut: #529 moves to v2.2.0 with A3 attached, and this phase closes unbuilt

## Phase 8: The release step and closeout

- [ ] **At 2.1's publication** (a release task, recorded here for the trail):
  - the candidate exported from the release source with `--merge` against the live feed;
  - A1's hand gates added;
  - `check:model-feed` run, with the report in the release evidence;
  - `feeds/model-catalog.json` committed to `jarmo-productory/ritemark-public` as `jarmo-productory` (R8)
- [ ] Linked issues closed with evidence, or moved: #532, #531, #530, #529
- [ ] The release plan's tracker, its *Runtime versions*, and its checklist row for the feed publish (through the Development manager)
- [ ] `node ./scripts/worktree-hygiene.mjs --report` (cleaning is a human-authorized step)
