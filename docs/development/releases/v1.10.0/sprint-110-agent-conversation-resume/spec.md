# Sprint 110 Spec — Agent Conversation Resume

**Parent:** [sprint-plan.md](./sprint-plan.md) · **Release:** [v1.10.0](../release-plan.md) · **Issue:** [#204](https://github.com/ProductoryHQ/ritemark-native/issues/204) · **Dependency:** Sprint 109 · **Evidence:** [research/runtime-continuation-audit.md](./research/runtime-continuation-audit.md)

## Purpose

Make reopening a durable conversation continue with truthful agent context. Prefer same-runtime native resume when the pinned Claude, Codex, or OpenCode integration proves it; otherwise create a new session with a bounded normalized transcript context and disclose the boundary instead of pretending that visible history equals model memory.

## Principles

- **Resume what was actually resumed.** Visible transcript and runtime memory are separate facts.
- **Native first, measured not assumed.** Version-specific protocol behavior is audited before adapter changes.
- **Fallback is explicit and bounded.** The user sees when context came from transcript and what was omitted.
- **Runtime handoff is intentional.** Switching providers never silently transfers or binds context.
- **Host owns native identity.** Provider session/thread IDs never become webview authority.
- **No executable replay.** Tool calls, approvals, and transient runtime state are history, not commands to rerun.

## Requirements

### R1: Pinned-runtime continuation capability audit

As the team, we want measured behavior for the exact shipped runtime versions before promising continuation.

Acceptance criteria:
- A Phase 0 audit records bundled/pinned versions and live results for Claude SDK session resume, Codex app-server thread resume/read/fork behavior, and bundled ACP/OpenCode load/resume capabilities.
- Each runtime receives a decision: `native-resume`, `native-resume-with-limits`, or `fallback-only`, with invalid/expired/auth-loss/upgrade behavior documented.
- The audit tests two parallel conversations and proves that native IDs cannot cross-bind.
- The audit crosses runtime-switch timing with dispatch certainty: failure before send, confirmed provider acceptance without a final answer, ambiguous acceptance, partial/progress/tool activity without a final answer, and a late old-runtime event after handoff.
- Any unsupported or unstable capability reduces that adapter’s scope to fallback; it does not block the other runtimes or trigger an unplanned protocol rewrite.

### R2: Host-owned continuation descriptor contract

As a user, I want the correct provider session associated with the correct durable conversation.

Acceptance criteria:
- `AgentRuntime`/`RuntimeSessionConfig` gains one shared continuation input/checkpoint contract; no fourth runtime or runtime-specific webview messages are added.
- Each durable conversation may hold opaque, versioned descriptors keyed by runtime kind; descriptors include scope/runtime/version metadata plus `coveredThroughEventId` so the host can reject stale/mismatched use and calculate only uncovered transcript delta.
- Descriptors are created/updated by runtime adapters through a host callback and persisted by the Sprint 109 store; the webview receives only status, never raw provider IDs.
- Model/runtime/auth/policy changes cannot silently bind a descriptor that the adapter considers incompatible.
- Scheduled tasks and Flows do not read or write Agent Chat continuation descriptors.

### R3: Same-runtime native resume where proven

As a user, I want reopening with the same agent to recover its real working context when supported.

Acceptance criteria:
- Opening/selecting a conversation is read-only: it starts no runtime, auth flow, network request, native resume, or fallback build. Continuation negotiation begins only on the first subsequent Send or explicit Continue action.
- Continuation state begins as `not-attempted`, moves through `pending`, and ends in `native-restored`, `transcript-restored`, `context-unavailable`, or `runtime-unavailable`.
- A proven native descriptor is attempted before fallback when continuation is triggered with the same runtime.
- Successful native resume emits `native-restored`; the transcript remains the Sprint 109 canonical record and is reconciled without duplicate turns.
- Expired, missing, incompatible, unauthenticated, or rejected native resume takes the tested fallback/unavailable path and records a diagnostic without deleting history.
- Two concurrently reopened conversations retain isolated native contexts and event routing by Ritemark conversation ID.
- Runtime process restart and supported binary/app upgrades are covered by the audit matrix; unsupported upgrade paths are disclosed.

### R4: Bounded normalized transcript fallback

As a user, I want a saved conversation to remain meaningfully continuable even when native resume is unavailable.

Acceptance criteria:
- Fallback creates a fresh runtime session and supplies a deterministic context pack derived from the canonical transcript through the event immediately before the newly accepted prompt.
- The pack includes every relevant ordered user prompt — including a prior durably saved prompt with no matching assistant final answer — and assistant final text plus minimal runtime/source labels. It omits raw tool calls/results, approvals, assistant questions awaiting user input, transient progress/partial text, rejected plans, hidden system prompts, and attachment binaries.
- The pack has a documented byte/token budget and deterministic truncation: preserve the conversation purpose, the most recent unanswered user request, and then the most recent complete turns; disclose when older context was omitted.
- The transcript shows a one-time boundary before the new turn: **Context restored from transcript — a new agent session was started.**
- The newly accepted prompt is persisted before negotiation/dispatch but excluded from the fallback context pack and sent exactly once as the actual runtime prompt.
- A prior unanswered prompt is labelled as an unanswered request from the previous runtime and supplied only as context. It is never silently replayed as a second executable prompt; the user's newly accepted handoff instruction controls what the new runtime should do.
- The agent is instructed not to claim access to omitted tool state/files unless it rechecks them.

### R5: Explicit cross-runtime handoff

As a user, I want to continue a conversation with another agent without being misled about shared memory.

Acceptance criteria:
- Changing runtime on a non-empty conversation requires an explicit **Continue with …** action that previews native-context loss and fallback scope.
- Cross-runtime handoff always creates/uses that runtime’s own descriptor; it never passes another provider’s opaque ID. A descriptor’s `coveredThroughEventId` determines the normalized delta not yet present in that provider context.
- On return to a previously used runtime, native resume receives only canonical events after its coverage watermark before the current prompt. On ambiguous crash between provider acceptance and watermark checkpoint, the adapter must reconcile safely or abandon that native descriptor for a fresh deterministic fallback rather than risk silent duplication.
- The transcript records a visible runtime/context boundary and the selected agent.
- Switching back may resume that runtime’s own compatible descriptor; it cannot reuse the other runtime’s session.
- Composer text is preserved across the confirmation flow and no runtime call starts before confirmation.
- If the previous runtime produced no saved final answer, the handoff includes its preceding canonical user request regardless of whether dispatch was known-failed, known-accepted, or ambiguous. Dispatch certainty is recorded as safe metadata; provider-specific partial/tool state is not transferred.

### R6: Truthful continuation states in the UI

As a user, I want to know whether the agent really remembers the conversation.

Acceptance criteria:
- Continuation resolves host-side from `not-attempted`/`pending` into one terminal result: `native-restored`, `transcript-restored`, `context-unavailable`, or `runtime-unavailable`.
- Native restoration is quiet except for diagnostics; transcript restoration and unavailable states show an inline, accessible notice before the composer/new turn. Internal enum names are never user-facing.
- Plain-language mapping is fixed: transcript restored → **Previous messages were included, but this is a new agent session.**; interrupted handoff → **The previous agent did not return a saved answer. Your earlier request was included as context.**; truncated → **Some older messages were left out.**; context unavailable → **You can read this conversation, but the agent can’t use its earlier context.**; runtime unavailable names sign-in/change-agent/start-new next actions.
- Legacy read-only entries state that they can be read but not continued until moved/migrated.
- No copy says “pick up exactly where you left off” unless native resume was proven and succeeded.
- Continuation notices are not permanent list clutter after the user has acknowledged them; the transcript boundary remains as history.

### R7: Continuation-safe conversation rail

As a user, I want reopening or continuing a conversation to preserve the simple rail navigation and the same durable record.

Acceptance criteria:
- Preserve Sprint 109’s permanent 56px top-aligned conversation rail: primary New; up to five explicitly Pinned shortcuts; current, every Working/Needs you, and three recent idle shortcuts derived automatically; then All conversations immediately after the final chat button, with 40×40 targets and 12px vertical spacing. Conversation navigation is not duplicated in the native header.
- Native resume, transcript fallback, and unavailable states update the existing canonical conversation and derived/Pinned rail item; they never create a duplicate row, persist automatic membership, or silently Pin/Unpin.
- Native resume and fallback keep the shared `chat-circle` visual; opening or resuming without a new turn does not alter real activity time or reorder Recents.
- The All conversations button and conversation rail aggregate authoritative state with `Needs you` overriding `Working`, expose accessible counts, and have no indicator when idle.
- Reading/selecting any saved conversation is unlimited and lazy. Any limit applies only when starting simultaneous runtime work and uses active-work wording.
- Current project remains the only browsing scope in v1.10.0; no other-project result can bind to the current workspace runtime.
- Conversation search, All-project browsing, runtime filter, and continuation-state filter are explicitly deferred beyond v1.10.0. Rename remains the Sprint 109 behavior.

### R8: Resilience, privacy, and release verification

As the team, we want continuation to fail safely across real runtime and storage conditions.

Acceptance criteria:
- The cross-runtime matrix covers restart, close/reopen, process death, binary upgrade, auth loss, invalid descriptor, oversized transcript, attachments, plan/approval history, two parallel chats, runtime unavailable, and runtime switch at every dispatch-certainty/no-final-answer stage.
- Debug traces identify the attempted continuation mode and failure category without logging transcript content or provider secrets/IDs.
- Unit/integration tests cover descriptor validation, state transitions, coverage watermarks/deltas, native/fallback selection, normalization/truncation, explicit handoff, crash/idempotency, duplicate-turn reconciliation, conversation-rail identity/derived-membership preservation, and isolation.
- Live dev evidence walks every scenario in [scenarios.md](./scenarios.md) possible with available auth; unexercised paths are listed explicitly and not claimed.
- Architecture, user docs, changelog, release notes, test checklist, release tracker, and issue are complete before release feature-complete status.

## Non-Requirements

- Invisible universal memory shared by all agents.
- Replay or reactivation of tool calls, approvals, questions, plan cards, background subprocesses, or attachment binaries.
- Resuming a turn that was executing when the desktop process exited.
- Semantic memory/RAG, cloud sync, collaboration, or conversation export.
- Conversation search, All-project browsing, runtime/continuation filters, tags, folders, archive, or trash. Rename is already part of Sprint 109.
- Sharing conversation context with scheduled tasks or Flows.
- Guaranteeing native resume for a runtime whose pinned implementation fails Phase 0.

## Resolved Questions

- **Default:** same-runtime native resume when proven; deterministic transcript fallback otherwise.
- **Cross-runtime:** explicit handoff only.
- **Fallback content:** user prompts + assistant final text; no executable/provider-specific artifacts.
- **Authority:** descriptors remain host-owned and opaque to the webview.
- **Truth:** continuation state is a first-class result, not inferred from visible transcript.
- **Timing:** open/select is lazy; negotiation starts on Send/explicit Continue and the current prompt is never included twice.
- **Handoff coverage:** each runtime descriptor tracks `coveredThroughEventId`; only uncovered canonical delta crosses on resume/handoff.
- **Interrupted handoff:** a prior saved-but-unanswered user prompt always crosses as labelled canonical context; partial provider state never does, and the new user instruction is the only newly dispatched prompt.
- **Pinned runtime decision:** Claude, Codex and OpenCode are all `native-resume-with-limits`; each passed semantic recall after process restart plus two-conversation isolation on the exact shipped versions.
- **ACP method:** use `session/resume` only. `session/load` replayed provider history and is excluded to prevent duplicate transcript/UI events.
- **Fallback budget:** 32,000 UTF-8 bytes total; 12,000 bytes per selected message with deterministic head+tail truncation; first user purpose, latest unanswered request and newest complete turns receive priority without an LLM summary.
- **Upgrade/model/policy safety:** exact compatibility only in v1.10.0. A mismatch invalidates only that runtime descriptor and uses transcript fallback.
- **Watermark safety:** advance coverage only with the atomically saved assistant final; any accepted/ambiguous no-final crash invalidates that runtime descriptor before the next continuation.
- **Dispatch receipt:** persist `not-sent`, then pessimistic `ambiguous` before transport, then `accepted` only on a runtime-specific positive receipt; unknown stays ambiguous.

## Open Questions

- No unresolved product/architecture questions remain for Phase 1. Live auth-loss, unavailable-runtime, and failure-injection rows remain mandatory implementation evidence; they do not change the frozen safe-fallback decisions above.
