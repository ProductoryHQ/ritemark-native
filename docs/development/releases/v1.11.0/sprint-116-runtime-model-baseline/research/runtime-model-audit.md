# Sprint 116 — Runtime and model audit

**Captured:** 2026-09-13, starting 08:59 UTC.<br>
**Status:** Exact package approved and implemented; final QA plus native Intel/Windows CI remain before sprint readiness. This is not release sign-off.<br>
**Branch:** `codex/sprint-116-runtime-model-baseline`.<br>
**Source:** `30ea2ab32d15be161991d1bb8924a4c4ca331f8c`.<br>
**Decision document:** [phase-0-recommendation.md](./phase-0-recommendation.md).

## Outcome

The approved set is Claude Code **2.1.270** with Claude Agent SDK **0.3.270**, Codex official app-server packages **0.154.0**, OpenCode **1.18.30** with its own ripgrep **15.1.0**, and unchanged ACP SDK **1.4.0**. The initial 14 single-artifact audit passed, then dependency analysis replaced it with a complete schema-v3 package model: 12 downloaded source rows produce 25 installed files. All target archives pass hash, safe-layout, member, and architecture inspection. Native Apple Silicon startup and final Codex immediate Stop + resend pass.

The audit also reproduced three existing correctness gaps: Codex cache discovery drops effort metadata; a stale remote catalog hides a newer bundled floor; and an explicit unknown Codex thread ID is routed to the sole live conversation. Provider documentation identifies retired curated Gemini models, including the existing Flow image default. These need bounded fixes as part of the refresh.

Jarmo approved the Phase 0 package on 2026-09-13. The product manifest, dependency lock, runtime resolver, adapters, and catalog now implement that exact package. The original isolated audit material remains under `/private/tmp/ritemark-s116-audit-YfLYRv`; checked-in evidence preserves the pre-change baseline separately from implementation results.

## Baseline and rollback

[baseline.json](./evidence/baseline.json) records the branch, source commit and SHA-256 of the manifest, extension package and lockfile, model configuration, bundled catalog, manifest validator and three adapters. The candidate SDK lockfile is separately fingerprinted in [component-sdk-comparison.json](./evidence/component-sdk-comparison.json).

| Boundary | Checked-in baseline | Recommended candidate |
|---|---|---|
| Claude Code, three targets | 2.1.239 | 2.1.270 |
| Claude Agent SDK, including all eight optional packages | 0.3.239 | 0.3.270 |
| Codex app-server, three targets | 0.153.0 | 0.154.0 |
| Codex code-mode-host, three targets | 0.153.0 | 0.154.0 |
| Codex Windows sandbox setup and command runner | 0.153.0 | 0.154.0 |
| OpenCode, three targets | 1.18.21 | 1.18.30 |
| ACP SDK | 1.4.0 | 1.4.0 |

Last released product evidence is [v1.10.1 TEST-CHECKLIST](../../../../../releases/v1.10.1/TEST-CHECKLIST.md), candidate 3 at `23493cef`: all three published artifacts, notarized macOS packages, Windows installation roundtrip and owner approval are recorded there. Its detailed candidate-3 evidence is newer than the stale opening status in the v1.10.1 release plan. Those results establish rollback history, not coverage of these candidates.

Rollback must restore the complete baseline set together: manifest, validator and fixtures, SDK package/lockfile, catalog/default changes and any adapter change. Rebuild from the rollback source and rerun runtime verification. Do not mix old code-mode-host or Windows helpers with a newer app-server. Restoring the old application cannot restore a provider-retired model; the model retirement fixes need a separate disposition if a binary rollback becomes necessary.

The primary development checkout's locally installed app-server reports **0.149.0**, although the checked-in manifest says 0.153.0. It was not used as the baseline executable or as evidence about 0.153.0 behavior. Candidate probes use explicit paths to the newly verified binaries.

## Official snapshot and supply chain

The npm and GitHub source responses, capture timestamps and response hashes are preserved in `evidence/`. Codex npm and the [Codex 0.154.0 release](https://github.com/openai/codex/releases/tag/rust-v0.154.0) agree; OpenCode npm and the [OpenCode 1.18.30 release](https://github.com/anomalyco/opencode/releases/tag/v1.18.30) agree. Exact Claude package metadata is recorded for the [CLI](https://registry.npmjs.org/@anthropic-ai/claude-code/2.1.270) and [SDK](https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk/0.3.270). The [ACP package](https://registry.npmjs.org/@agentclientprotocol/sdk/1.4.0) needs no version change.

[candidate-manifest.json](./evidence/candidate-manifest.json) is the historical initial 14 single-artifact view. It is superseded by the approved [candidate-package-manifest.json](./evidence/candidate-package-manifest.json), which models the complete Codex packages and OpenCode's runtime-owned ripgrep. [artifact-results.json](./evidence/artifact-results.json) retains the original component results for audit traceability.

| Component | darwin-arm64 | darwin-x64 | win32-x64 |
|---|---|---|---|
| Codex app-server | Archive + architecture + startup pass | Archive + architecture pass | Archive + architecture pass |
| Codex code-mode-host | Archive + architecture + startup pass | Archive + architecture pass | Archive + architecture pass |
| Codex windows-sandbox-setup | Not applicable | Not applicable | Archive + architecture pass; parent-driven execution pending |
| Codex command-runner | Not applicable | Not applicable | Archive + architecture pass; parent-driven execution pending |
| Claude | Archive + architecture + startup pass | Archive + architecture pass | Archive + architecture pass |
| OpenCode | Archive + architecture + startup pass | Archive + architecture pass | Archive + architecture pass |

The original audit had **14 rows: 8 Codex + 3 Claude + 3 OpenCode**. The approved product manifest has **12 source rows**: three complete Codex packages, three Claude runtimes, three OpenCode runtimes, and three OpenCode ripgrep packages. These install **25 files**. The original count remains useful only as a record of why archive-by-archive component enumeration was incomplete.

### Dependency completeness — explicit follow-up from the v1.10.1 lesson

The current artifact audit starts from the existing manifest. Passing all 14 known rows does **not** prove that a new runtime needs no additional dependency. The v1.10.1 Windows failure came from missing separately published sandbox helpers: full-access mode hid that defect by bypassing the affected execution path. Likewise, chat startup without code-mode-host does not prove file tools work.

Jarmo reinforced this requirement during the audit. Before final pins, independently inspect upstream companion artifacts and package dependencies, SDK transitive/optional packages, dynamic libraries/DLLs, spawned executables and assets installed on first use. Each non-OS requirement needs an explicit packaging or supported-installation decision and verification; avoid silently relying on developer-installed Node, npm, tools, PATH entries or warm caches. Exercise the packaged set in the normal sandbox on native targets.

[runtime-dependency-inventory.json](./evidence/runtime-dependency-inventory.json), generated by `audit-runtime-dependencies.py`, records every member of the 14 candidate archives, their embedded package dependency/script declarations, macOS linked-library names and Windows DLL imports. This is static inventory only: lazy downloads, dynamically constructed library/tool names and clean-machine behavior still require execution evidence. Do not mark dependency completeness passed solely from this inventory.

[license-audit.json](./evidence/license-audit.json) records version-specific Apache-2.0 evidence for Codex and MIT evidence for OpenCode. OpenCode's target npm packages contain no license file, so distribution notices must retain the upstream license. Claude's three archives contain proprietary notices; redistribution continues to rely on the existing 2026-05-06 product-owner decision documented in the runtime README. This audit does not claim a new vendor permission or a legal review of all linked terms. Candidate notice URLs now identify the exact Codex/OpenCode versions.

## SDK and behavior evidence

| Probe | Result | Evidence / limit |
|---|---|---|
| Baseline extension TypeScript compile | Pass | `baseline-tests.json` |
| Candidate SDK compile against unchanged extension | Pass | `candidate-tests.json`; isolated SDK installation only |
| Claude SDK optional-package lockstep | Pass | All eight optional packages are 0.3.270; `component-sdk-comparison.json` |
| Existing focused runtime/model/sidebar tests | 20 test files pass | `baseline-tests.json` plus `baseline-webview-retry.json` |
| Codex file read/edit through sibling code-mode-host | Pass | `codex-canaries.json`; synthetic fixture changed, completed turn |
| Codex plan question | Pass | `item/tool/requestUserInput` observed and answered in read-only plan mode |
| Codex cancellation after streaming starts | Pass | `codex-canaries-retry.json`; terminal status `interrupted` |
| Codex immediate cancellation after turn/start receipt | Unresolved | Initial probe returned `-32600 no active turn to interrupt`; do not erase this result |
| Later Codex adapter session and direct protocol rechecks | Audit-auth interruption explained; fresh direct probe passes | Denied Keychain access explained the timeouts; `codex-canaries-session-start-diagnostics.json` records the successful 0.154.0 file-tool run; see A5 |
| Claude approved / denied edit | Pass / pass | `claude-canaries.json`; allowed fixture changed, denied fixture unchanged |
| Claude single-query cancellation | Diagnostic failure observed | `claude-canaries-retry.json`; SDK emitted an error on interruption; persistent-session check is recorded separately |
| Claude production AgentSession cancellation + immediate follow-up | Pass | `claude-session-cancel.json`; denied pending edit stayed unchanged, follow-up returned expected text in the same session |
| ACP initialize / session capabilities | Pass | Protocol 1, resume/list/fork/close and model config options; `acp-canaries.json` |
| Codex continuation across app-server restart | Pass | `codex-continuation.json`; same thread resumed, synthetic recall matched, invalid ID rejected |
| Claude continuation across subprocess restart | Pass | `claude-continuation.json`; synthetic recall matched, invalid ID rejected |
| OpenCode continuation across process restart | Pass, free provider only | `acp-continuation.json`; `opencode/big-pickle`, not authenticated BYOK evidence |
| OpenCode session/load | Replays history | Four updates replayed; continue using session/resume for the shared continuation contract |

The first test invocation used the `tsx` CLI and hit its sandbox IPC-socket restriction. Running Node with `--import tsx` removed that harness dependency. Three sidebar test files then needed the existing webview lockfile dependencies (`zustand`); installing those dependencies and rerunning only those failures made all 20 files pass. Original environmental failures are retained beside their successful retries.

These tests cover existing contracts and selected live canaries. They do not prove the complete Sprint 110/112 matrices, native Intel/Windows behavior, signed packaging, or all provider account states.

## Measured defects and bounded work

### A1 — Codex cache effort metadata is dropped

The actual cache has `default_reasoning_level` and `supported_reasoning_levels: [{ effort, description }]`. `providerDiscovery.ts` reads different field names and expects string levels. Calling the unchanged `discoverCodex()` against the local cache returns models without effort metadata. The captured cache identifies client 0.153.0, so this is a pre-existing compatibility gap. [Reproduction](./evidence/codex-cache-shape-reproduction.json).

Recommended fix: accept the measured cache schema and retained legacy shapes, validate levels through the existing shared vocabulary, and add a sanitized regression fixture. Keep live app-server model discovery authoritative for its running session. Do not invent `ultra` for API models from Codex data.

### A2 — stale remote catalog defeats a newer bundled floor

The [published catalog](https://raw.githubusercontent.com/jarmo-productory/ritemark-public/main/feeds/model-catalog.json) is dated 2026-07-25 and contains only three old Codex entries. In a reproduction using the real remote response and an audit-only newer bundled catalog, `resolveAll()` selects the old remote entries and hides Astra. [Original reproduction](./evidence/stale-remote-reproduction.json). A deterministic replay also proves the same problem when the old snapshot is provided as cache only, or as both remote and cache: [three source cases](./evidence/model-reproduction-check.json).

Recommended fix for approval: when selecting between static catalogs, remote and cached snapshots older than the bundled snapshot must not override it. Keep live provider discovery authoritative, preserve equal-date source ordering, and treat an unparseable static snapshot timestamp as ineligible to override the dated bundled floor. Add older/newer/equal/invalid timestamp cases for both remote and cache, and avoid merging unrelated provider routes. Publishing a refreshed remote catalog can follow separately; it must not be the only way a new binary gets a usable floor.

### A3 — explicit unknown thread IDs can reach a live conversation

`CodexRuntime._sessionForThread()` falls back to the sole session even when an explicit different thread ID was supplied. The unchanged method reproduces this with synthetic session mappings. Late events from a retired thread can therefore affect the remaining conversation. This contradicts Sprint 116 R5. [Reproduction](./evidence/codex-routing-reproduction.json).

Recommended fix: drop explicit unknown IDs before the singleton fallback; preserve only the documented missing-ID fallback where appropriate. Add a regression for a retired thread while one conversation remains, including completion and approval routing. This is not attributed to the candidate binary.

### A4 — cancellation timing required an adapter-level retry

Codex's `turn/start` receipt can precede an interruptible active turn. The approved adapter waits for `turn/started`, retries the exact `no active turn to interrupt` race once, and tracks completion by the exact turn ID. [Final adapter evidence](./evidence/codex-session-cancel-final.json) passes immediate Stop (`interrupted`) and immediate resend (`completed`); the focused regression reproduces the first rejected interrupt and accepted retry.

Claude's one-shot query emitted an interruption diagnostic. Its production path uses a persistent input stream and resolves cancellation locally. The unchanged AgentSession subsequently passed interruption during a pending edit approval and an immediate follow-up in the same session, with no error events or file mutation. No Claude adapter change is justified by that one-shot diagnostic alone; full UI and other cancellation timings remain separate checks.

### A5 — later Codex session creation was interrupted by Keychain denial

The actual unchanged `CodexSession` and `CodexAppServer` were exercised with an audit transport that selected the verified binary directly. `initialize` succeeded, but `thread/start` did not complete before the bounded test timeout. Direct 0.154.0 and exact-baseline 0.153.0 probes showed the same symptom, which already excluded a candidate-specific regression.

Jarmo then confirmed that he had selected **Deny** on the macOS Keychain access prompt because the separate Codex launch was not identified as part of the audit. This accounts for the otherwise unexplained authentication/session-start interruption. No product protocol change is inferred from those negative runs.

The interrupted adapter command was `node --import ./extensions/ritemark/node_modules/tsx/dist/loader.mjs docs/development/releases/v1.11.0/sprint-116-runtime-model-baseline/research/audit-codex-session-cancel.mjs retry`. It never reached immediate Stop/resend, so it provides no cancellation verdict.

The same direct probe against exact checked-in 0.153.0 artifacts also timed out at `thread/start`: [baseline result](./evidence/codex-canaries-baseline-start-comparison.json). Its two Apple Silicon components were separately verified against the checked-in manifest; see [baseline comparison artifacts](./evidence/codex-baseline-comparison-artifacts.json). This is retained as evidence that the denied shared credential path affected both versions.

Baseline command: `S116_AUDIT_BINARY_DIR=/private/tmp/ritemark-s116-audit-YfLYRv/baseline-codex-0.153.0 node docs/development/releases/v1.11.0/sprint-116-runtime-model-baseline/research/audit-runtime-canaries.mjs codex 'file tools through code-mode host' baseline-start-comparison`. A fresh candidate command then completed the file-tool path: [successful diagnostics](./evidence/codex-canaries-session-start-diagnostics.json). Future audit launches that may request Keychain access must be announced to Jarmo before execution so the prompt is attributable.

## Model catalog audit

[model-inventory.json](./evidence/model-inventory.json) captures every current curated entry and default, the published static catalog and public OpenRouter availability. [candidate-effort-models.json](./evidence/candidate-effort-models.json) captures candidate Claude SDK and authenticated Codex model discovery.

### Runtime identities and effort

| Codex visible model | Provider default effort | Advertised levels |
|---|---|---|
| `gpt-6-astra` — runtime's current default | medium | low, medium, high, xhigh, max, ultra |
| `gpt-5.6-sol` | low | low, medium, high, xhigh, max, ultra |
| `gpt-5.6-terra` | medium | low, medium, high, xhigh, max, ultra |
| `gpt-5.6-luna` | medium | low, medium, high, xhigh, max |
| `gpt-5.5` | medium | low, medium, high, xhigh |
| `gpt-5.3-codex-spark` | high | low, medium, high, xhigh |

The bundled list lacks Astra. Its GPT-5.4 and GPT-5.4 Mini entries are absent from this account's visible live list; that is not proof of API retirement. Keep saved selections distinguishable from advertised current choices.

Claude SDK discovery returns five selector rows resolving to four identities. `default` and `opus[1m]` both resolve to `claude-opus-5[1m]`; `claude-fable-5-1[1m]` resolves to `claude-fable-5-1`; `sonnet` resolves to `claude-sonnet-5`; `haiku` resolves to `claude-haiku-4-5-20251001`. The first three identities advertise low through max; Haiku advertises no effort control. Deduplicate the exact alias pair while preserving both request selector and resolved identity. Do not globally strip `[1m]`.

The [Claude model overview](https://platform.claude.com/docs/en/models/overview) documents Fable 5.1. Older Fable 5 and Opus 4.8 remain active according to the [deprecation table](https://platform.claude.com/docs/en/about-claude/model-deprecations); being older does not make them retired.

OpenCode's unauthenticated default session exposes seven free-provider models and no thought-level option for its default. The real BYOK `configOptions` matrix remains unverified. Do not infer effort support from a similar model exposed by another runtime.

### Provider-backed catalog corrections

| Surface | Finding | Recommended disposition |
|---|---|---|
| OpenAI text | Curated “latest” stops at GPT-5.2 | Add Astra and the 5.6 family with API-specific metadata; remove stale “latest” descriptions from retained entries |
| Gemini text | `gemini-3-pro-preview` shut down 2026-03-09 | Replace new-choice entry with `gemini-3.1-pro-preview` |
| Gemini text | 3.8 Flash and 3.5 Flash-Lite missing | Add current stable choices; keep valid 2.5 selections |
| Gemini images | All three curated Imagen 4 IDs shut down 2026-08-17, including the default | Replace default with `gemini-3.1-flash-image`; remove retired IDs from new-choice lists |
| Gemini images | `gemini-3-pro-image-preview` shut down 2026-06-25 | Use `gemini-3-pro-image` |
| Gemini images | 2.5 Flash Image has a 2026-10-02 shutdown date | Mark deprecated and exclude from defaults |
| OpenAI images | Image 1.5 deprecated, shutdown 2026-12-01; Image 1 shutdown 2026-10-23 | Replace default with documented migration target `gpt-image-2`; retain deprecated IDs only where needed for saved-flow presentation |
| OpenAI images | Image 2.5 Flare/Sunburst absent | Audit their supported size/quality contracts before adding optional choices; no new UI quality levels in this sprint |
| OpenAI images | DALL-E 3 is already shut down | Existing deprecated flag is insufficient if a picker still exposes it as a runnable new choice |

Sources: [OpenAI model catalog](https://developers.openai.com/api/docs/models/all), [OpenAI retirement schedule](https://developers.openai.com/api/docs/deprecations), [Image 2](https://developers.openai.com/api/docs/models/gpt-image-2), [Image 2.5 Flare](https://developers.openai.com/api/docs/models/gpt-image-2.5-flare), [Gemini models](https://ai.google.dev/gemini-api/docs/models), [Gemini retirement schedule](https://ai.google.dev/gemini-api/docs/deprecations). Public documentation establishes IDs and lifecycle facts; authenticated account availability and generation results still need direct API canaries.

The four existing OpenRouter curated routes are present in the [public model API](https://openrouter.ai/api/v1/models). Astra, Sol/Terra/Luna and Gemini 3.8 Flash are listed as candidate routes. The inspected response does not establish a Fable 5.1 route. Preserve provider prefixes; direct Anthropic and OpenRouter Anthropic are different routes, as are batch/pro variants. Public listing is not account access evidence.

### Defaults and source of truth

Recommend retaining valid text defaults for continuity: assistant `gpt-4o-mini`, OpenAI Flow `gpt-5.2`, Gemini Flow `gemini-2.5-flash`, and curated Codex `gpt-5.6-sol`. Add Astra as a choice and report the live runtime default truthfully. These are product defaults, not a claim that providers still call them their recommended latest model. Replace the broken/deprecated image defaults as above after direct generation canaries.

Put canonical identifiers in `modelConfig.ts`, deriving bundled projections and provider routes from them. The model resolver remains the authority for availability and presentation. Update the stale architecture paragraph claiming modelConfig contains only image types; its current LLM arrays contradict that description. Preserve saved user choices and saved Flow IDs; retired selections require an explicit actionable message, not an undocumented automatic substitution.

## Remaining release and CI evidence

- Direct OpenAI, Gemini, Anthropic API and OpenCode BYOK keys are absent from this terminal's environment. The approved catalog uses dated provider documents and runtime discovery; account-specific API/image execution remains a release-validation item.
- Complete authenticated BYOK file/tool, permission, cancellation, failure and effort checks; complete API availability and image generation checks before final model freeze.
- Finish cancellation timing and full effort/default/unsupported-selection matrices through the unchanged/current adapters, then rerun after approved fixes.
- Codex immediate Stop and immediate resend are complete on the final adapter; retain this check in future runtime bumps.
- Exercise actual `UnifiedApprovalGate`, browser injection and sidebar provider isolation in the dev app. Existing unit tests are evidence for contracts, not a substitute for the full UI matrix.
- Run native Intel and Windows behavior, including both Windows helpers through app-server. Cross-inspection on Apple Silicon does not satisfy native startup or packaged behavior.
- Final extension build, staged target-set checks, repository QA, architecture and release documentation remain implementation/closeout tasks. Signed/notarized release artifacts have their own release gates.
- GitHub milestone [v1.11.0](https://github.com/ProductoryHQ/ritemark-native/milestone/11) exists. Publishing the [prepared Sprint 116 issue](./github-issue-draft.md) was rejected by automatic approval review pending explicit authorization for that external payload and destination.

## Reproduction entry points

Run from the dedicated worktree with Node 22.22.1. Scripts write audit evidence only. Source lookup and runtime canaries require network access; canaries use synthetic temporary fixtures and existing provider sign-ins.

1. `research/audit-official-sources.mjs` captures public metadata and baseline hashes. Do not overwrite the original dated snapshot when auditing a later release; use a new evidence directory.
2. `research/audit-candidate-artifacts.mjs` verifies and extracts candidates to the isolated directory recorded in `evidence/audit-environment.json`.
3. `research/audit-licenses.mjs` records license facts and exact notice URLs in the audit candidate manifest.
4. `research/audit-focused-tests.mjs` runs baseline fixtures and candidate compilation. Node `--import tsx` avoids the CLI IPC socket.
5. `research/audit-runtime-canaries.mjs codex|claude|acp` runs the bounded direct protocol probes; the optional last argument selects one check and retains a separate retry result.
6. `research/audit-routing-reproduction.mjs` invokes the unchanged Codex routing method with synthetic mappings; no binary or network is used.
7. `research/audit-claude-session-cancel.mjs` checks cancellation and immediate follow-up through the unchanged production AgentSession against the candidate SDK.
8. Reused fixtures: Sprint 110 `research/runtime-continuation-fixture.mjs` and Sprint 112 `research/runtime-effort-probe.mjs`, with candidate binary and SDK paths supplied explicitly.
9. `research/audit-model-reproductions.mjs` replays sanitized cache and captured catalog inputs against the unchanged discovery/resolver; no account access or network is needed.
10. `research/audit-codex-session-cancel.mjs` exercises the actual Codex adapter. `retry`, `params`, and `warmup` retain separate diagnostics; only the last two adjust the audit transport as described in A5.

See [evidence-integrity.json](./evidence/evidence-integrity.json) for final baseline preservation and snapshot fingerprints.
