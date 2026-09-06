# Sprint 110 Research — Runtime Continuation Audit Baseline

**Prepared:** 2026-08-21<br>
**Status:** Phase 0 decision gate prepared — live semantic-resume and two-conversation isolation matrix passed on 2026-08-23; production implementation remains gated on Jarmo's matrix approval.<br>
**Decision rule:** Native resume ships per adapter only after live proof; otherwise that adapter uses the bounded transcript fallback.

## Current Ritemark behavior

- `RuntimeSession` is created per Ritemark conversation but has no durable continuation input/checkpoint contract.
- Claude reports an SDK `session_id` during execution but Ritemark does not persist or supply it on reopen.
- Codex stores `threadId` only in the in-memory session adapter and currently starts new threads.
- ACP/OpenCode currently calls `session/new`; Ritemark does not persist a load/resume descriptor.
- Reopening history restores transcript arrays only. The next prompt therefore starts fresh provider context even when the UI looks continuous.

## Kickoff preparation evidence (pre-Phase 0)

These checks are read-only capability and version probes. They prepare the audit harness but do **not** count as native-resume proof because no persisted provider context was resumed and no model prompt was sent.

| Surface | Shipped/pinned version | 2026-08-23 preparation observation | What remains unproven |
|---|---:|---|---|
| Claude Code / Agent SDK | CLI `2.1.217`; SDK `0.3.217` | Manifest and local `claude --version` agree. SDK types expose `query({ options: { resume: sessionId } })`; `system:init` already supplies `session_id`, but `AgentSession` only traces it. | Capture/persist/resume across app and process restart, invalid/auth/model/upgrade behavior, duplicate history, and two-session isolation. |
| Codex app-server | `0.144.4` | Manifest and direct `codex-app-server --version` agree. Initialize followed by invalid-ID probes reached `thread/read`, `thread/resume`, and `thread/fork` validation (`-32600` invalid ID, not method-not-found), while production only implements `thread/start`. | Valid persisted-thread resume/read ordering, restart/auth/upgrade behavior, reconciliation, ambiguous acceptance, and two-thread isolation. |
| OpenCode / ACP SDK | OpenCode `1.18.4`; ACP SDK `0.22.1` | Manifest and local `opencode --version` agree. Initialize advertises `loadSession: true` plus `sessionCapabilities.close/fork/list/resume`; production still calls only `session/new`. | Whether OpenCode persists IDs across restart, load versus resume replay semantics, auth/provider/config changes, invalid IDs, duplication, and two-session isolation. |

Probe notes:

- `./scripts/verify-agent-runtimes.sh --versions` passed Claude and OpenCode. In the restricted shell, Codex wrote a PATH-alias warning before its version line, so that script compared the wrong first line; a direct unsandboxed `codex-app-server --version` returned `0.144.4`.
- OpenCode capability output is candidate evidence only. The ACP contract explicitly gates `loadSession` and `resumeSession` on advertised capabilities, and live behavior can still be incompatible or unstable.
- No descriptor shape, context budget, reconciliation source, or adapter ship decision is frozen by these preparation probes.

## Live pinned-runtime results — 2026-08-23

Fixture: [`runtime-continuation-fixture.mjs`](./runtime-continuation-fixture.mjs). Redacted machine-readable evidence: [`runtime-continuation-results-2026-08-23.json`](./runtime-continuation-results-2026-08-23.json). The fixture stores no provider reference, prompt body, response body, credential, or raw transcript.

| Runtime | Semantic resume over process restart | Invalid reference | Two-conversation isolation | Phase 0 adapter decision |
|---|---|---|---|---|
| Claude CLI `2.1.217` / SDK `0.3.217` | **PASS** — `query.options.resume` restored an exact audit token in a new SDK query/subprocess. | Rejected; normalize the SDK error to `invalid-descriptor`. | **PASS** — two distinct session IDs each recalled only their own token after restart. | `native-resume-with-limits`; exact pinned CLI+SDK compatibility only, fallback mandatory. |
| Codex app-server `0.144.4` | **PASS** — `thread/read` found the persisted thread, `thread/resume` returned the same ID, and a new app-server process recalled the exact token. | Rejected as not found/invalid. | **PASS** — two threads resumed in one restarted app-server and recalled only their own token. | `native-resume-with-limits`; use `thread/resume`; `thread/read` is existence/diagnostic evidence, never transcript authority. |
| OpenCode `1.18.4` / ACP SDK `0.22.1` | **PASS** — initialize advertised resume and `session/resume` restored the exact token in a new ACP process. | Rejected through a generic protocol error; normalize it. | **PASS** — two resumed ACP sessions recalled only their own token. | `native-resume-with-limits`; capability-check every process and use `session/resume` only. |

OpenCode's `session/load` also succeeded but replayed six historical `session/update` notifications, including agent text. Ritemark must **not** use it for continuation: replay would compete with the canonical transcript and risks duplicate UI events. `session/resume` is the approved ACP path because it restores model context without history replay.

Commands used the exact bundled binaries and installed SDK packages, a read-only audit workspace, no tools, and fresh provider subprocesses. Each provider ran a second matrix with two simultaneous native identities. Raw audit tokens were intentionally reduced to boolean match evidence in the saved result.

## API evidence resolved live

### Claude

The pinned `@anthropic-ai/claude-agent-sdk` type surface includes a query resume option and session IDs. The fixture proved semantic resume, process restart, invalid-ID rejection, and two-session isolation. Exact-version/model/policy compatibility plus fallback avoids an unproven upgrade/config promise; auth loss remains a production failure-injection row.

### Codex

The app-server protocol documents thread lifecycle methods including resume/read/fork. Ritemark’s current client implements thread start/turn flows but not durable resume. The isolated fixture proved read/resume, same-ID return, process restart, invalid-ID rejection and two-thread isolation. `thread/fork` is not required for this sprint.

Reference: <https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md>

### ACP / OpenCode

The ACP SDK exposes optional session load/resume concepts and bundled OpenCode advertised both. Live `session/resume` passed; live `session/load` replayed history and is excluded from production.

## Frozen Phase 0 decision matrix

| Runtime | Native path | Reconciliation source | Compatibility/invalidation | Decision |
|---|---|---|---|---|
| Claude | SDK `resume: sessionId` | Canonical Ritemark events only; provider history is not imported. | Exact adapter contract + pinned CLI/SDK version + scope/model/policy match; any mismatch, auth rejection, invalid ID, or ambiguous no-final crash invalidates this runtime's descriptor and falls back. | `native-resume-with-limits` |
| Codex | app-server `thread/resume` | Canonical Ritemark events; `thread/read` may prove existence/turn metadata but cannot overwrite canonical text. | Exact adapter contract + pinned app-server version + scope/model/policy match; invalid/auth/mismatch/ambiguous no-final paths fall back. | `native-resume-with-limits` |
| OpenCode/ACP | ACP `session/resume` after advertised capability check | Canonical Ritemark events only; never accept replayed `session/load` history into the transcript. | Exact adapter contract + pinned OpenCode/ACP versions + scope/model/policy match; capability disappearance or generic resume rejection falls back. | `native-resume-with-limits` |

No binary upgrade is resumed blindly in v1.10.0. An exact version mismatch is a deterministic incompatibility and starts a fresh transcript-restored session. This deliberately converts an unbounded upgrade matrix into a safe fallback rather than promising cross-version native state.

## Frozen host descriptor contract

One canonical conversation holds a descriptor map keyed by runtime ID; switching runtime never replaces another runtime's entry. The common host envelope is version 1:

```ts
interface RuntimeContinuationDescriptorV1 {
  descriptorVersion: 1;
  runtimeId: 'claude-code' | 'codex' | 'opencode';
  nativeReference: string;          // host-only opaque provider ID
  scopeId: string;                  // exact project binding
  runtimeVersion: string;           // exact pinned binary version
  adapterContractVersion: 1;
  modelId: string | null;
  compatibilityFingerprint: string; // model/auth binding/approval/sandbox, no raw secret
  coveredThroughEventId: string | null;
  capturedAt: string;
}
```

The provider ID never crosses the host/webview boundary and is redacted from diagnostics. When Ritemark has an API/BYOK value or stable account identifier, the compatibility fingerprint uses a keyed HMAC with a host-local random salt; it stores neither the credential/account value nor an offline-comparable unsalted hash. Provider-managed auth without a stable host identity is still verified by the native resume call; an auth rejection is non-destructive and routes to sign-in or fallback.

Old Sprint 109's singular `continuation` field is accepted only as a migration input and normalized into the keyed map; new writes use the map. A descriptor is reusable only when scope, runtime, exact runtime version, adapter contract, model and compatibility fingerprint match.

`coveredThroughEventId` advances only in the same atomic host checkpoint that persists the successful assistant final event. A user prompt without a saved final never advances it. If transport acceptance was possible but that final checkpoint is absent, Ritemark removes only that runtime's descriptor and uses a fresh deterministic fallback on the next continuation; v1.10.0 does not risk duplicating an uncovered delta into uncertain native memory.

## Frozen dispatch-certainty contract

Each accepted user turn receives append-only host receipt events; no provider ID is recorded:

1. Persist user message + `not-sent` receipt atomically.
2. Before the transport write, append `ambiguous`. A crash after this point stays pessimistically ambiguous even if the provider never received bytes.
3. Append `accepted` only after the runtime-specific positive signal below.

| Runtime | Positive `accepted` signal | Signals that are **not** enough |
|---|---|---|
| Claude | First assistant event (including tool use) or terminal result for that SDK session/turn. | `system:init` alone; query construction; process spawn. |
| Codex | Successful `turn/start` response carrying the matching thread and turn IDs. | Request write without response; process existence. |
| OpenCode/ACP | First matching `session/update` or the matching `session/prompt` response. | Sending the JSON-RPC request without an update/response. |

Failure before step 2 remains `not-sent`; disconnect/crash after step 2 but before a positive signal remains `ambiguous`; partial/tool/progress after a positive signal is `accepted`. In **all** three states, if no assistant final was saved, the canonical user request crosses a runtime handoff as labelled context and is never executable replay. Binding generation rejects every late event from the old runtime.

## Normalized fallback baseline

Allowlist:

- user prompt text;
- assistant final answer text;
- minimal turn order/runtime label;
- conversation purpose/initial framing, the most recent unanswered user request, and recent complete turns;
- safe dispatch-certainty label (`not-sent`, `accepted`, or `ambiguous`) when a runtime failed without a saved final answer.

Denylist:

- raw tool calls/results;
- approvals and pending questions;
- plan cards/rejected plans and transient progress;
- hidden system/capability prompts;
- provider IDs/secrets;
- attachment binary/base64 content.

Frozen budget and ordering:

- hard maximum: **32,000 UTF-8 bytes**, including framing and omission markers; no tokenizer-specific promise is made across three providers;
- normalize line endings/outer whitespace; cap an individual selected message at 12,000 UTF-8 bytes with deterministic head+tail retention and an inline omission marker;
- reserve in order: first non-empty user request as purpose framing, the most recent unanswered request before the current prompt, then the newest complete user/final-assistant turn pairs working backward; deduplicate by event ID and serialize the selected events back into canonical order;
- older unanswered requests may fill remaining space after the protected items; every omitted message/turn count is disclosed;
- no LLM summary call. “Purpose” means the bounded first user request, not generated interpretation.

The newly accepted prompt is persisted before continuation negotiation but excluded from this pack and dispatched exactly once afterward. Runtime-specific adapters may wrap the same normalized pack, but they may not change selection or omission semantics.

## Interrupted handoff audit

The live matrix must reproduce the user path: save a request for runtime A, prevent runtime A from returning a final answer, switch to runtime B, and send a short instruction such as “Solve it yourself.” The earlier request is canonical user intent even though it is not a complete turn. Runtime B must receive it as labelled context, while the short new instruction is the only newly dispatched prompt.

Audit five failure points per runtime: failure before transport send; confirmed provider acceptance with no final answer; ambiguous acceptance after disconnect/crash; partial/progress/tool activity without a final answer; and late events after the binding was invalidated by handoff. Freeze which signals can safely produce `not-sent`, `accepted`, or `ambiguous`; unknown stays `ambiguous`. No provider partial/tool state crosses the boundary, and a late old-runtime event cannot resolve or overwrite the canonical unanswered request.

Phase 0 resolves these five rows through the frozen append-only receipt state machine above. Phase 1 must implement failure-injection tests against the shared contract and each adapter before any runtime can be marked production-ready. Native semantic recall does not waive this gate.

## Remaining implementation matrix after the Phase 0 decision gate

The protocol decision required exact versions, valid semantic resume, process restart, invalid descriptor handling, replay behavior and two parallel conversations; those rows now have redacted live evidence. Phase 1–6 must still prove the host contract and UX rows: lazy open/select, close/reopen/app restart, auth loss, unavailable runtime, model/config mismatch, exact-version mismatch fallback, oversized transcript, current-prompt-once, unanswered-prompt handoff at all five dispatch/failure points, attachments/tool/plan history, cross-runtime return, coverage watermark delta, ambiguous crash between provider acceptance and watermark save, late event after switch, and multiple unanswered prompts.

Descriptors must track canonical transcript coverage (`coveredThroughEventId` or an audit-proven equivalent). Native resume/handoff receives only uncovered normalized delta; when provider acceptance is ambiguous after a crash, the safe outcome is descriptor invalidation plus fresh fallback unless the runtime supplies reliable reconciliation evidence.

## Stop conditions

- Native events cannot be reliably scoped to the correct conversation.
- Resume duplicates/reorders history and cannot be reconciled deterministically.
- Provider ID becomes exposed to/untrusted from the webview.
- Resume silently crosses runtime/model/auth/project boundaries.
- A durably saved unanswered user prompt disappears from the next runtime’s normalized context or is replayed as an executable prompt without a new explicit user instruction.
- The provider’s advertised capability differs from live behavior without a stable detection path.

Any stop condition makes that adapter fallback-only for v1.10.0; it does not justify weakening the safety contract.
