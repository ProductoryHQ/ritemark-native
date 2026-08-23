# Sprint 110 Research — Runtime Continuation Audit Baseline

**Prepared:** 2026-08-21<br>
**Status:** Kickoff baseline captured 2026-08-23 — live pinned protocol matrix remains mandatory in Sprint 110 Phase 0.<br>
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

## API evidence to verify live

### Claude

The pinned `@anthropic-ai/claude-agent-sdk` type surface includes a query resume option and session IDs. Phase 0 must prove behavior across app restart, invalid ID, auth loss, model/config change, two sessions, and pinned binary upgrade. Type availability alone is not sufficient.

### Codex

The app-server protocol documents thread lifecycle methods including resume/read/fork. Ritemark’s current client implements thread start/turn flows but not durable resume. Phase 0 must add an isolated audit client or temporary harness and measure ordering, history duplication, invalidation, process restart, auth loss, and binary upgrade before changing the production adapter.

Reference: <https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md>

### ACP / OpenCode

The ACP SDK exposes optional session load/resume concepts, but support is agent-capability-dependent. Phase 0 must inspect bundled OpenCode initialize capabilities and live behavior with a configured provider. Unless both are proven, OpenCode is fallback-only.

## Preliminary decision matrix

| Runtime | Current durable behavior | Native candidate | Planning decision |
|---|---|---|---|
| Claude | Session ID memory/log only | SDK resume option | Audit first; likely native candidate, fallback mandatory. |
| Codex | App-server thread ID memory only | `thread/resume` + optional `thread/read` | Audit first; likely native candidate, reconciliation unknown. |
| OpenCode/ACP | Always `session/new` | Optional ACP load/resume if advertised | Fallback-only until live capability proof. |

## Normalized fallback baseline

Allowlist:

- user prompt text;
- assistant final answer text;
- minimal turn order/runtime label;
- conversation purpose/initial framing and recent complete turns.

Denylist:

- raw tool calls/results;
- approvals and pending questions;
- plan cards/rejected plans and transient progress;
- hidden system/capability prompts;
- provider IDs/secrets;
- attachment binary/base64 content.

The audit must freeze a deterministic size budget and exact truncation algorithm without introducing a summarization-model dependency. The newly accepted prompt is persisted before continuation negotiation but excluded from this pack and dispatched exactly once afterward.

## Phase 0 required matrix

For every runtime: lazy open/select, first session, second turn, close/reopen, app restart, process restart, invalid descriptor, auth loss, unavailable runtime, model/config change, binary upgrade, oversized transcript fallback, current-prompt-once, attachments/tool/plan history, cross-runtime return, coverage watermark delta, ambiguous crash between provider acceptance and watermark save, and two parallel conversations. Record exact versions, fixture prompts, redacted traces, result, and decision.

Descriptors must track canonical transcript coverage (`coveredThroughEventId` or an audit-proven equivalent). Native resume/handoff receives only uncovered normalized delta; when provider acceptance is ambiguous after a crash, the safe outcome is descriptor invalidation plus fresh fallback unless the runtime supplies reliable reconciliation evidence.

## Stop conditions

- Native events cannot be reliably scoped to the correct conversation.
- Resume duplicates/reorders history and cannot be reconciled deterministically.
- Provider ID becomes exposed to/untrusted from the webview.
- Resume silently crosses runtime/model/auth/project boundaries.
- The provider’s advertised capability differs from live behavior without a stable detection path.

Any stop condition makes that adapter fallback-only for v1.10.0; it does not justify weakening the safety contract.
