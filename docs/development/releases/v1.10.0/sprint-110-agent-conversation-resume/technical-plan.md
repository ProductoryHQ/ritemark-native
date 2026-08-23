# Sprint 110 Technical Plan

Architecture and implementation approach for [spec.md](./spec.md), gated by [research/runtime-continuation-audit.md](./research/runtime-continuation-audit.md) and the stable store delivered by Sprint 109.

## Architecture Overview

Sprint 110 extends the existing three-runtime adapter boundary rather than adding a new continuation service per provider:

```text
ConversationStore (Sprint 109)
  record.continuations[runtimeKind] = opaque versioned descriptor
          ↕ host-only
ConversationController
          ↕ shared RuntimeContinuation contract
RuntimeRegistry
  ├── ClaudeCodeRuntime → SDK session resume or fallback session
  ├── CodexRuntime      → app-server thread resume or fallback session
  └── AcpRuntime        → ACP load/resume if proven, otherwise fallback session
          ↕
AI Sidebar receives status/boundary only, never native IDs
```

Proposed shared runtime shapes (exact naming frozen after Phase 0):

```ts
type ContinuationMode =
  | 'not-attempted'
  | 'pending'
  | 'native-restored'
  | 'transcript-restored'
  | 'context-unavailable'
  | 'runtime-unavailable';

interface RuntimeContinuationRequest {
  descriptor?: RuntimeContinuationDescriptor;
  fallbackContext?: NormalizedConversationContext;
}

interface RuntimeSessionConfig {
  // existing callbacks...
  continuation?: RuntimeContinuationRequest;
  onContinuationCheckpoint?: (descriptor: RuntimeContinuationDescriptor) => void;
  onContinuationState?: (state: ContinuationState) => void;
}
```

Descriptors are opaque tagged unions validated by their adapter and stored by the host. Every descriptor carries `coveredThroughEventId`; the webview protocol exposes only `ContinuationState` and human-safe metadata.

## Workstream 0: Live pinned-protocol audit (R1)

- Claude: verify SDK session ID capture, resume after process/app restart, invalid ID, auth loss, model change, two sessions, and any transcript duplication behavior.
- Codex: implement an audit harness for app-server `thread/resume`, `thread/read`, optional fork semantics, invalid thread, process restart, binary upgrade, auth loss, and two threads.
- ACP/OpenCode: inspect initialize capabilities and live-test `session/load` / `session/resume` only if advertised by bundled OpenCode; never assume SDK method availability means server support.
- Record exact versions, commands/fixtures, traces with redacted IDs, observations, and ship/fallback decision per runtime.
- Freeze descriptor tags, validation rules, `coveredThroughEventId` and ambiguous-crash policy, context budget, reconciliation source, lazy negotiation timing, and unavailable behavior in the SDD artifacts.
- Stop for Jarmo’s explicit Phase 0 decision approval before Workstream 1.

## Workstream 1: Continuation contract and store integration (R2, R8)

- Extend `runtime/AgentRuntime.ts` with one shared request/checkpoint/state contract; maintain one adapter per runtime and one runtime session per conversation.
- Add versioned descriptor codecs in each adapter or a shared discriminated union without exposing provider internals to webview code.
- Add coverage watermark and binding-generation validation; derive normalized delta only after the descriptor’s `coveredThroughEventId`.
- Route descriptor checkpoints through `ConversationController` into Sprint 109 serialized store operations.
- Redact IDs and transcript content from diagnostics; log runtime kind, mode attempted, compatibility result, and failure category.
- Reject wrong project/runtime/adapter-version descriptors before binding.

## Workstream 2: Same-runtime native adapters (R3)

- Claude adapter: resume only using Phase 0-proven SDK option/session lifecycle; checkpoint the authoritative session ID.
- Codex adapter: add minimal app-server protocol/client methods proven in Phase 0; preserve existing shared-process event routing by `threadId`.
- ACP adapter: implement load/resume only when the bundled server advertises and passes tests; otherwise explicitly declare fallback-only capability.
- Normalize adapter result into `ContinuationState`; never let provider-native history overwrite the canonical Sprint 109 transcript silently.
- Keep open/select runtime/auth/network-lazy; the continuation coordinator runs only after an accepted Send/explicit Continue.
- Add failure injection for expired/invalid/auth/runtime-unavailable paths.

## Workstream 3: Normalized context fallback (R4)

- Add `src/conversations/contextPack.ts` with deterministic selection/serialization and tests.
- Include user prompt and assistant final text event types only, with minimal turn/runtime labels; exclude executable/provider-specific/transient artifacts.
- Apply a Phase 0-decided byte/token budget without an extra summarization model dependency. Preserve first purpose-bearing turn(s) and most recent complete turns; record omitted turn count.
- Build through the event before the newly accepted prompt; that prompt is persisted first and dispatched once outside the context pack.
- Render runtime-specific input framing in adapters while keeping one canonical normalized pack.
- Insert a durable transcript boundary and host-derived `transcript-restored` state before the first fallback turn.

## Workstream 4: Explicit runtime handoff (R5, R6)

- Runtime selector on a non-empty conversation becomes a `Continue with …` flow with shadcn confirmation dialog and context-loss explanation.
- Preserve composer draft through confirmation/cancel.
- On confirm, keep the canonical conversation ID, choose/create the target runtime’s descriptor, pass only normalized events after its coverage watermark, and insert a runtime/context boundary.
- Checkpoint watermark advancement only after proven provider acceptance. If a crash makes acceptance ambiguous and cannot be reconciled, invalidate the descriptor and use a fresh fallback rather than risk duplicate delta.
- Reject late events from the previous binding using existing conversation scoping plus a continuation binding generation.
- Show transcript/unavailable/runtime-unavailable notices inline; native-restored remains unobtrusive.

## Workstream 5: Continuation-safe conversation rail (R7)

- Preserve Sprint 109’s permanent 56px top-aligned conversation rail and its New / Pinned / automatic active-and-recent / All conversations order, including 40×40 targets, 12px button spacing, and history immediately after the final chat button. Keep every rail button selection-only and preserve the same canonical conversation ID through native resume or fallback.
- Re-run the derived rail selector after continuation-state transitions so all Working/Needs you conversations remain visible, the three recent idle positions use real activity, and Pinned+active IDs remain deduplicated.
- Aggregate `Needs you` > `Working` > idle on the All conversations button and conversation rail with accessible counts and reduced-motion behavior.
- Ensure continuation transitions update the existing rail/history item rather than creating a duplicate or changing Pin state implicitly.
- Keep browsing current-project-only and runtime-lazy; active-work protection applies only at Send, never when reading/selecting/saving.
- Explicitly defer search, rename, All projects, runtime filters, and continuation-state filters beyond v1.10.0.

## Workstream 6: Cross-runtime verification and release close (R8)

- Unit tests: descriptor codecs/compatibility, state transitions, watermarks/deltas, context pack/truncation, handoff generation, crash/idempotency, reconciliation, redaction.
- Integration tests: lazy open, native success/failure, current-prompt-once fallback, runtime unavailable, two parallel chats, process restart, late events, current-project privacy, and conversation-rail identity/derived-membership preservation.
- Live matrix for all available authenticated runtimes; capture exact unexercised rows and never mark them passed by inference.
- Update architecture runtime contract/session table/conversation subsystem/protocol; update user docs, changelog, release notes, test checklist, tracker, and issue. Architecture `Last updated` must be on/after the Sprint 110 branch creation date.
- Run QA and release-specific migration+resume canary before declaring v1.10.0 feature complete.

## Implementation Order

W0 audit/decision matrix + Jarmo gate → W1 contract/store integration → W2 proven native adapters → W3 fallback → W4 handoff/UX → W5 final navigation → W6 QA/docs/release close. Unsupported runtime-native resume stops only that W2 adapter and routes to W3; it does not block the release if fallback and truth criteria pass.

## Architecture Gate

Triggered by changes to `AgentRuntime`/`RuntimeSessionConfig`, provider protocol methods, conversation message contracts, and host store schema. Update `docs/development/architecture.md` before close. Preserve locked invariants: exactly three runtime adapters, shared approval gate, browser tools path, model IDs in the shared catalog, and no runtime-specific webview message families.
