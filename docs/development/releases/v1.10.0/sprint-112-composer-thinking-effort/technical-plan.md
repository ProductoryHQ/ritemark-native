# Sprint 112 Technical Plan

## Architecture Overview

Sprint 112 adds one canonical per-turn effort value across the existing path:

```text
Composer draft
  → typed agent-execute turn snapshot
  → UnifiedViewProvider validation
  → RuntimeTurnConfig.thinkingEffort
  → ClaudeCodeRuntime | CodexRuntime | AcpRuntime capability adapter
```

The webview never imports provider SDK types. The host owns capability truth and runtime mapping. This changes the shared `AgentRuntime` interface and webview↔host contract, so the Sprint Architecture Gate applies.

## Workstream 0: Final capability audit and design gate (R1, R2, R6–R8)

- Consume Sprint 111’s final pins, protocol fixtures, Claude effort types, Codex model metadata, and ACP `thought_level` evidence.
- For each supported Claude/Codex model, record canonical values, vendor wire values, default behavior, downgrade observability, and whether effort is per turn or session.
- Measure OpenCode timing: when config options appear, how `thought_level` is categorized, and whether `setSessionConfigOption` settles before the next prompt.
- Confirm that open/select remains runtime/auth/network-lazy.
- Review [design.md](./design.md) with Jarmo and record exact approved copy/states.
- End with a Jarmo decision before shared contracts change.

## Workstream 1: Shared effort types and capability contract (R1, R5, R9)

Primary files:
- `extensions/ritemark/src/runtime/AgentRuntime.ts`
- `extensions/ritemark/src/runtime/capabilities.ts`
- typed conversation/webview protocol modules introduced by Sprint 109
- `extensions/ritemark/webview/src/components/ai-sidebar/types.ts`

Proposed shared shapes:

```ts
type ThinkingEffort = 'auto' | 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'ultra';

interface ThinkingEffortCapability {
  selectable: ThinkingEffort[];
  source: 'model-catalog' | 'runtime-live';
  supportsAppliedValue: boolean;
}
```

- Add `thinkingEffort?: ThinkingEffort` to `RuntimeTurnConfig`; normalize `auto` to `undefined` at the adapter edge.
- Extend host capability/config payloads with model/runtime-scoped selectable levels and evidence source.
- Validate incoming wire values at the host boundary. Provider strings never enter webview state.
- Add experimental/default-on `composer-thinking-effort` to `src/features/flags.ts` and package configuration; flag-off omits UI and runtime override.

## Workstream 2: Conversation draft, durable metadata, and queue snapshot (R4, R5)

Primary files:
- Sprint 109 conversation schema/store modules under `src/conversations/`
- `webview/src/components/ai-sidebar/conversationState.ts`
- `store.ts`, `promptQueue.ts`, and migration helpers

- Store per-runtime draft preferences inside the durable conversation’s Composer metadata, defaulting to Auto.
- On model change, revalidate against the host capability map; retain valid values and visibly reset invalid ones to Auto.
- Snapshot effort into the accepted/queued turn record before dispatch, alongside runtime/model/mode.
- Store requested/applied values as metadata. Exclude them from user-visible fallback prompt text and do not retrofit historical turns.
- Ensure queue dequeue uses its captured effort rather than the current Composer draft.

## Workstream 3: Runtime adapters (R6–R8)

### Claude
- Map explicit canonical values to final SDK `effort` values; Auto omits the field.
- Preserve adaptive-thinking defaults; never translate effort into hidden prompts or guessed `budgetTokens`.
- Capture applied/downgraded value only from a measured SDK/hook result; never infer it from latency.

### Codex
- Read supported values from the pinned app-server model/protocol data captured in Sprint 111.
- Set the measured reasoning-effort field for execute and plan collaboration modes.
- Remove the current plan-mode `reasoning_effort: null` overwrite when an explicit effort exists.
- Keep effort per conversation/turn; do not store mutable adapter-global state.

### OpenCode
- Discover the ACP semantic `thought_level` option after session creation and route its advertised ID/value choices to the conversation capability cache.
- Set the exact advertised option before the prompt and await acknowledgement.
- On missing/rejected/disappearing capability, return a typed fallback-to-Auto result and preserve the turn.

## Workstream 4: Composer UI (R2, R3, R8)

Primary files:
- `webview/src/components/ai-sidebar/ChatInput.tsx`
- new focused `ThinkingEffortControl.tsx` plus tests
- existing Ritemark popover/radio/slider primitives and tokens

- Keep runtime/model and mode code out of the new component; pass current label, selectable levels, state, and callbacks.
- Render the trigger adjacent to model/mode and implement [design.md](./design.md) with Sofia Sans, Ritemark tokens, standard focus, Phosphor-only icon policy, and no decorative icon.
- Implement Auto separately from the discrete manual scale.
- Add tooltip/help, invalidation/downgrade notices, polite live-region announcements, reduced-motion behavior, viewport collision handling, and narrow-width wrap.
- Do not render unsupported levels or hardcode runtime/model IDs.

## Workstream 5: Tests, rollout, and documentation (R9)

- Pure tests: canonical label mapping, capability filtering, model-switch validation, Auto omission, queue snapshot, flag-off.
- Adapter contract tests: Claude explicit/auto/downgrade, Codex execute/plan/concurrency, ACP advertised/missing/rejected option.
- Webview tests: trigger/popover, keyboard, focus return, 200% zoom/min width, reduced motion, live-region copy.
- Live matrix on final Sprint 111 pins for Claude, Codex, and qualifying OpenCode providers/models.
- Update architecture, changelog, user docs, release notes/test checklist, tracker, and issue #206.

## Error Contract

- Invalid stale wire value: reject/omit before adapter call and log redacted diagnostics.
- Model no longer supports selection: reset draft to Auto and inform the user before Send.
- Provider downgrade: keep the successful turn, store requested/applied values, show non-blocking notice.
- Provider rejects effort: retry/fallback only if the adapter can prove the prompt has not been accepted; otherwise do not duplicate the prompt. Use the Sprint 110 ambiguous-dispatch rule.
- Flag off: ignore stored overrides and use provider defaults without deleting metadata.

## Rollback

Disable `composer-thinking-effort`. The UI disappears and adapters omit overrides; saved metadata remains forward-compatible and inert. No transcript or provider session is deleted, and the existing runtime/model/mode path remains intact.
