# Sprint 110 Research — Runtime Continuation Audit Baseline

**Prepared:** 2026-08-21<br>
**Status:** Preliminary code/API evidence only — live pinned protocol matrix is mandatory in Sprint 110 Phase 0.<br>
**Decision rule:** Native resume ships per adapter only after live proof; otherwise that adapter uses the bounded transcript fallback.

## Current Ritemark behavior

- `RuntimeSession` is created per Ritemark conversation but has no durable continuation input/checkpoint contract.
- Claude reports an SDK `session_id` during execution but Ritemark does not persist or supply it on reopen.
- Codex stores `threadId` only in the in-memory session adapter and currently starts new threads.
- ACP/OpenCode currently calls `session/new`; Ritemark does not persist a load/resume descriptor.
- Reopening history restores transcript arrays only. The next prompt therefore starts fresh provider context even when the UI looks continuous.

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
