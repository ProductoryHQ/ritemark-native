# RC correction audit: Agent Chat model bootstrap

**Status:** Architecture and repository QA passed; merge/release preflight pending  
**Release:** v1.10.0  
**Observed:** 2026-09-01 in the signed RC installed at `/Applications/Ritemark.app`  
**Scope:** Bug fix / RC correction, not a new sprint

## User-visible failure

A newly opened Ritemark window can render the Agent Chat composer with
`Claude · Model` instead of a real selected model. The placeholder can remain
indefinitely. The installed application, bundled extension, model-catalog cache,
and persisted settings were all present; reopening or waiting was not a reliable
recovery.

The UI state is internally contradictory:

- the webview considers itself ready and renders `ChatInput`;
- the global model arrays and the active conversation's selected model are still
  empty;
- the model selector therefore has neither a label nor selectable rows.

## Current causal chain

The current `ready` handshake starts several unrelated operations:

1. `ai-key-status` reads one secret and sets webview `ready: true`;
2. `_sendAgentConfig()` builds the only message that contains the model lists;
3. before posting that message it may read several secrets, inspect Claude and
   Codex binaries, inspect Claude auth, start/initialize the Codex app-server,
   read Codex account and rate-limit status, scan workspace/user agent files,
   and inspect environment commands;
4. any delay, hung dependency, or uncaught rejection before the final
   `postMessage` withholds the whole payload;
5. the webview has no bootstrap timeout/error state and keeps rendering the
   placeholder forever.

This is an architectural failure, not just a slow call. `agent:config` currently
mixes four domains with different authorities and failure modes:

| Domain | Authority | Change cadence | May block/fail |
|---|---|---|---|
| UI and feature configuration | local settings/static registries | startup/settings | should not |
| Model catalog + selected alias reconciliation | `src/ai/modelCatalog/` | startup/catalog refresh | synchronous bundled/cache floor |
| Runtime/auth/setup status | Claude/Codex/OpenCode adapters + OS credentials | independently, often | yes |
| Agent/command discovery | workspace and user files | workspace/filesystem | yes |

Additional audit findings:

- stable OpenCode support makes `_readByokKeys()` part of every full config;
  its `Promise.all` is not caught locally, so one SecretStorage rejection can
  suppress every model list permanently;
- `getAgentEnvironmentStatus({ setupStatus: undefined })` invokes Claude setup
  inspection even when Codex is selected;
- every full config probes Codex status even when a Claude conversation is
  active;
- overlapping ready/catalog/auth refreshes have no generation or latest-wins
  guard;
- async work started for a disposed webview posts through mutable `this._view`,
  so it can land in a replacement view;
- a syntactically valid remote/cache provider with zero compatible models can
  currently outrank the bundled provider floor and produce an empty list.
- the editor webview cache-busts `media/webview.js` with its mtime, but Agent
  Chat used the same bundle through an unversioned URI. An existing profile can
  therefore keep executing an earlier sidebar bundle after the host updates;
  unlike the fresh-profile baseline, waiting can never reconcile that protocol
  split. The same host/bundle protocol split was reproduced in RunDev and
  produced the exact permanent `Model` placeholder; rebuilding and loading the
  mtime-versioned Agent Chat script removed it without changing the persisted
  profile settings.

## Rejected fixes

### Wait longer

Rejected. It cannot recover an exception, a hung credential read, an empty
catalog result, or a response lost to a replaced view. It also keeps the UI's
readiness claim false.

### Add a debounce or arbitrary timeout before showing the composer

Rejected. This changes when the contradiction appears without removing it.

### Send the existing monolithic `agent:config` twice

Rejected as the final design. An early partial copy plus a late full copy still
has ambiguous semantics, duplicate sources of truth, and stale-response races.

### Fall back to the literal persisted model id in the label

Rejected. It could hide an empty or stale catalog while offering no valid picker
row and could reintroduce model-mismatch behavior.

## Target architecture

### 1. Atomic core bootstrap

Agent Chat gets an explicit, typed `agent:bootstrap` request/response contract.
The response is built only from synchronous local authorities:

- feature flags and static agent registry;
- workspace/global configuration reads;
- `modelCatalog.getModels()` / `getDefault()` / alias reconciliation;
- bundled BYOK model metadata;
- runtime capability registry;
- workspace identity and SDK version metadata already in memory.

It does **not** read SecretStorage, scan files, spawn a process, initialize a
runtime, or access the network.

The webview state machine is:

```text
waiting-for-bootstrap
  ├─ valid agent:bootstrap → configured
  └─ explicit bootstrap failure/timeout → recoverable bootstrap-error
```

Only `configured` may render an enabled model selector. `ai-key-status`,
connectivity, onboarding, or a runtime status can never set this state.

The core payload is atomic: selected model and the catalog row that represents
it arrive together. A stale persisted alias is reconciled before the message is
sent. Model arrays for selectable bundled providers must be non-empty; a broken
remote/cache layer falls through to the bundled compatible floor instead of
becoming an empty successful catalog.

### 2. Independent operational hydration

After the bootstrap message has been posted, the host starts independent status
producers. Each producer owns its error state and cannot suppress another:

- Claude setup/environment status;
- Codex binary/auth status;
- OpenCode provider-key availability;
- generic OpenAI-key status;
- onboarding summary;
- workspace/user agent and command discovery;
- connectivity and active context.

Runtime status uses a discriminated runtime message (or the existing
provider-specific status messages during the compatibility transition).
Discovery gets its own message. No operational message carries model catalogs.

The selected runtime remains visibly `checking` and Send remains unavailable
until that runtime's operational status is known. The already configured model
label stays visible during the check. A failure produces the appropriate setup
or repair state, never a generic model placeholder.

### 3. View-session and refresh ordering

Every resolved webview gets a host-side generation. All async hydration work
captures that generation and the exact webview instance. A result is discarded
when either no longer matches.

Each independently refreshable domain also uses latest-request-wins ordering.
A late pre-login status, old catalog refresh, or old view callback cannot
overwrite a newer completed login or a replacement view.

Repeated `ready` messages in the same generation are idempotent: the host may
re-send the current atomic bootstrap, but it must not start duplicate runtime
probes.

The Agent Chat script URI must carry the same mtime version as the editor
webview. Updating the extension host and its webview bundle is one atomic
protocol deployment; an unversioned cached script is not a supported state.

### 4. Conversation restore is order-independent

Both valid arrival orders converge:

```text
bootstrap → conversation restore
conversation restore → bootstrap
```

The current catalog reconciles the restored conversation's model. Empty or stale
model ids fall back to that runtime's catalog default; a valid per-conversation
selection is preserved. Restoring a conversation may choose a runtime but may
not erase the global catalogs.

### 5. Diagnostics

Bootstrap and each hydration domain record begin/end/error plus elapsed time,
without credentials or model prompts. A bootstrap invariant failure is visible
and retryable in the sidebar. Operational failures name their domain in the
extension-host log and in the corresponding setup surface.

## Edge-case validation matrix

The design is not accepted until all rows are executable tests or RunDev proof.

| Case | Expected invariant |
|---|---|
| API-key status arrives first | composer/model selector stays unconfigured |
| Bootstrap arrives first | real selected model is visible immediately |
| Claude probe never resolves | Claude status remains checking/error; catalog stays usable |
| Codex app-server times out | Codex setup reports it; Claude/OpenCode catalogs remain usable |
| Any BYOK SecretStorage read rejects | OpenCode key state reports failure; Claude/Codex model lists remain |
| Discovery throws or scans no files | agents/commands are empty/error only; model selector remains |
| Persisted `opus[1m]` alias | exactly one canonical/default row is selected |
| Remote/cache provider is empty | compatible bundled floor is used |
| Catalog refresh removes selected id | all open conversations reconcile deterministically |
| Restore before bootstrap | final runtime/model equals bootstrap-before-restore result |
| Duplicate ready in one view | one hydration run; idempotent bootstrap |
| Old view resolves after replacement | old result is discarded |
| Two Ritemark windows | each window gets its own complete bootstrap |
| Narrow sidebar | real model label has priority; no `Model` placeholder |
| Runtime status is still checking | model visible, Send unavailable, checking state visible |
| Bootstrap invariant fails | explicit retryable error, not an apparently usable composer |

## Pre-implementation gates

1. Source dependency audit proves every field in `agent:bootstrap` is synchronous
   and process/network/credential/filesystem independent.
2. A pure state-model test proves message-order commutativity and that no
   operational result can clear a valid catalog.
3. Failure-injection tests cover rejected/hung runtime, SecretStorage, and
   discovery dependencies.
4. The model-catalog resolver test proves empty higher-priority providers cannot
   erase the bundled compatible floor.
5. Only after 1–4 pass may implementation replace the current monolithic path.

### Validation record

- **2026-09-01 — synchronous dependency audit passed for the proposed core.**
  `isEnabled()` and VS Code configuration reads are synchronous; `AGENTS` and
  `RUNTIME_CAPABILITIES` are static registries; `modelCatalog.getModels()`,
  `getModel()`, `getDefault()`, and `getByokProviderModels()` are synchronous
  in-memory reads with a compiled bundled floor. SecretStorage, discovery,
  environment inspection, setup inspection, runtime construction, subprocesses,
  and network refresh are excluded from the proposed bootstrap.
- **2026-09-01 — executable state model passed 10/10.**
  `research/rc-agent-bootstrap-model.test.ts` proves API-key independence,
  atomic alias reconciliation, restore/bootstrap commutativity, operational
  failure isolation, latest-revision wins, view-generation rejection,
  duplicate-ready idempotence, explicit empty-bootstrap failure, isolated
  rejection/never-resolving failure injection, and bootstrap delivery before
  hydration starts.
- **2026-09-01 — current resolver defect reproduced.** A valid remote Anthropic
  provider with `models: []` resolves as `{ source: "remote", count: 0,
  default: null }`, suppressing the non-empty bundled floor. This must gain a
  production regression test before implementation is accepted.
- **2026-09-01 — unchanged RunDev baseline captured and visually inspected.** A
  fresh profile with `selectedAgent: codex` and stale `selectedModel: opus[1m]`
  eventually rendered `GPT-5.6-Sol`, but the extension host became
  `UNRESPONSIVE` twice during startup/AI-handshake before recovering. This
  baseline did not reproduce the user's indefinite state, so the exact
  user-profile trigger remains unproven; it did prove that blocking probes run
  on the critical bootstrap path. Evidence:
  `/tmp/ritemark-model-bootstrap-screenshots/before-ai.png` and the RunDev log
  timestamps beginning at 16:23:53 Europe/Tallinn.
- **2026-09-01 — production protocol tests passing.** The pure bootstrap builder
  covers alias/default/invalid-runtime/empty-catalog invariants; the real
  Zustand store proves API-key independence plus view-generation and
  domain-revision rejection without catalog loss; the resolver production test
  now preserves the bundled floor for empty and future-gated sources.
- **2026-09-01 — exact stale-bundle failure class reproduced and corrected.** A
  newly compiled extension host paired with the prior Agent Chat bundle rendered
  `Claude · Model` indefinitely. After building the same source and reloading the
  mtime-versioned script, both the workspace window and a second simultaneous
  no-workspace window rendered `Codex · OpenAI · GPT-5.6-Sol`; their DOMs loaded
  the same review-final `webview.js?v=1788272930071`. The workspace capture also
  proves the selected model remains visible while Codex is checking and after it
  reaches ready. Visual evidence:
  `research/screenshots/agent-bootstrap-workspace-window.png` and
  `research/screenshots/agent-bootstrap-second-window.png`.
- **2026-09-01 — operational ordering reviewed.** Initial Claude and Codex
  results are reused by onboarding instead of probing both runtimes twice.
  Claude authentication status and the current in-memory catalog reach the UI
  before an independent remote catalog refresh; a slow refresh therefore cannot
  hide successful sign-in feedback. Runtime checks, discovery, key reads, and
  webview delivery each fail within their own guarded domain.
- **2026-09-01 — compatibility path reviewed.** The current bundle requests and
  consumes `agent:bootstrap`. If a prior bundle still sends its legacy `ready`
  handshake, the host answers with `agent:config` derived from the same pure
  atomic bootstrap data, then projects the independently completed discovery
  result through a later compatibility `agent:config` update. It does not
  reintroduce the old runtime/keychain-bound config builder.
- **2026-09-01 — PR review findings closed in source.** Review identified that a
  legacy view would otherwise miss new-format discovery results and that Codex
  selection still requested two overlapping status probes. The compatibility
  projection now includes discovered agents/commands after the non-blocking
  core response, and `ai-select-agent` is the sole host-owned runtime refresh;
  focused regressions cover both contracts.
- **2026-09-01 — repository QA passed.** `./scripts/validate-qa.sh` passed the
  runtime manifest, pre-commit checks, patch state, product icon metadata,
  native VS Code TypeScript check, agent lifecycle coverage, Codex approval
  matrix, and webview lifecycle suites. The additional broad `npm test` run
  passed all deterministic suites until the unchanged real-SDK flow test tried
  to execute directly under `tsx`; that non-extension-host harness cannot
  resolve the `vscode` module and reported 5 failures. Neither that test nor its
  import chain differs from `main`; the repository's official QA path remains
  green.
- **2026-09-01 — release preflight passed with only expected branch warnings.**
  All 14 VS Code patches apply, CI asset parity, extension/webview bundle,
  dependencies, clean install simulation, TypeScript, Apple-silicon build
  environment, and Developer ID identity pass. The two warnings are deliberate
  until merge: uncommitted changes and the non-`main` bugfix branch. Public
  releases stop at v1.9.0, so v1.10.0 remains the next valid version.

## Post-implementation release gate

- focused unit/integration tests and full extension/webview QA pass;
- RunDev is opened with a fresh profile containing a stale model alias;
- the AI sidebar is tested in a new window and a second simultaneous window;
- runtime and SecretStorage failures are injected independently;
- screenshots are captured and visually inspected at normal and narrow widths;
- the replacement RC is rebuilt only after this evidence is recorded.
