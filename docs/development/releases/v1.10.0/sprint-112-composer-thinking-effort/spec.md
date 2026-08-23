# Sprint 112 Spec — Composer Thinking Effort

## Purpose

Let users choose how much reasoning effort the selected Claude or Codex model should spend on the next Agent Chat turn, directly in the message Composer. The control remains capability-driven and honest: Ritemark exposes only levels the selected runtime/model can accept and never implies that a higher setting guarantees a better answer.

## Principles

- Effort belongs to the next message, so its control belongs in the Composer.
- `Auto` is the safe default and means “let the runtime/model decide.”
- Runtime capability truth comes from the host/adapters, never component-level runtime checks.
- Requested and applied effort are distinct facts; silent coercion is not acceptable.
- Changing a draft setting never mutates an in-flight or already queued turn.
- The control uses Ritemark’s compact Indigo-Editorial chrome, not a vendor UI clone.

## Requirements

### R1: Shared effort vocabulary

As a user, I want one understandable scale across runtimes, so I do not have to learn three vendor-specific settings systems.

Acceptance criteria:
- The canonical requested values are `auto`, `low`, `medium`, `high`, `xhigh`, and `max`.
- User-facing labels are **Auto**, **Low**, **Medium**, **High**, **Extra**, and **Max**; internal `xhigh` is never displayed.
- `Auto` is the default for a new conversation and omits an explicit override so the runtime/model chooses its normal behavior.
- Only values supported by the selected runtime/model are selectable. A missing option is not fabricated or mapped to a different level.
- The UI says higher effort can take longer and use more provider quota; it never labels the scale “smarter” or guarantees quality.

### R2: Composer placement and interaction

As a user, I want effort next to the runtime/model and mode controls, so I can set it while composing the message it affects.

Acceptance criteria:
- A compact trigger appears in the Composer footer beside the runtime/model and Manual/Auto/Plan controls, labeled **Effort · Auto**, **Effort · High**, **Effort · Extra**, and so on.
- Activating the trigger opens a small anchored popover titled **Thinking effort** with the current value, an Auto choice, and a discrete Faster→More thorough manual scale containing only supported levels.
- The trigger and popover use existing Ritemark surface, ink, hairline, focus, radius, and motion tokens. No gradient, vendor blue/orange, oversized card, decorative icon, or off-system control is introduced.
- Clicking outside or pressing Escape closes the popover and returns focus to the trigger without changing the selection.
- The popover never obscures the Send action at supported sidebar widths; at narrow widths the footer may wrap predictably without clipping controls.

### R3: Keyboard, screen reader, and reduced motion

As a keyboard or assistive-technology user, I want the same control and context, so effort is not mouse-only or visually ambiguous.

Acceptance criteria:
- The trigger is reachable in normal Composer tab order and announces the selected runtime/model plus current effort.
- Auto and manual levels form one named radio group; arrow keys move among selectable manual levels, Enter/Space selects, and disabled/unsupported values are not focusable.
- Every point has a textual accessible name. Meaning is never conveyed by position or indigo alone.
- Focus uses the standard Ritemark focus ring; reduced-motion mode removes thumb/track animation without removing state.
- At 200% zoom and the minimum supported sidebar width, the control remains operable and labels do not overlap.

### R4: Per-conversation draft and per-turn snapshot

As a user, I want effort to apply predictably, so switching conversations or editing the next setting does not rewrite other turns.

Acceptance criteria:
- Each durable conversation remembers its last valid draft effort separately for Claude and Codex; returning to a runtime restores that runtime’s preference.
- OpenCode may remember a value only after a capability-advertising ACP session exposes matching choices.
- When a prompt is accepted or queued, the current requested effort is snapshotted with that turn before dispatch. Later Composer changes affect only later turns.
- A running turn keeps the effort with which it started. The control remains editable for the next turn and clearly does not alter work already running.
- Requested and applied effort are stored as metadata, not injected into transcript fallback text or shown as a user/assistant message.

### R5: Typed host and runtime contract

As the team, we want effort carried through one shared contract, so each runtime adapter does not invent a separate webview message.

Acceptance criteria:
- `RuntimeTurnConfig` accepts a canonical optional `thinkingEffort`; `auto` is normalized to omission at the adapter boundary.
- The typed `agent-execute`/conversation protocol carries the turn snapshot through the host and rejects unknown values.
- Host-provided capability data names the selectable values for the current runtime/model and distinguishes static catalog evidence from live runtime evidence.
- No model ID or vendor-specific effort label is hardcoded in `ChatInput.tsx` or another UI component.
- The change extends the existing `AgentRuntime` adapters and unified execution path; no fourth runtime or runtime-specific approval/execution message is added.

### R6: Claude effort mapping

As a Claude user, I want my Composer choice applied through Claude’s supported effort API, so the control changes the actual turn rather than only its label.

Acceptance criteria:
- Sprint 111/Phase 0 evidence defines supported levels per discovered Claude model and confirms the final Agent SDK contract.
- `auto` omits explicit effort and preserves the SDK/model’s adaptive default.
- Explicit values map to the SDK’s `effort` field without token-budget guessing or hidden prompt instructions.
- If the SDK reports a silent model downgrade, Ritemark records requested and applied values and shows concise non-blocking copy: **Effort adjusted to High for this model.**
- Unsupported Claude models use Auto and explain why; the prompt remains sendable.

### R7: Codex effort mapping

As a Codex user, I want my Composer choice sent as Codex reasoning effort, so Agent Chat matches the capability already available in Codex products.

Acceptance criteria:
- Supported levels come from the pinned Codex app-server’s model/protocol metadata measured after Sprint 111, not a generic constant copied from another runtime.
- `auto` sends no explicit reasoning-effort override.
- Explicit values are carried in the supported turn/collaboration setting for both execute and plan-first turns; plan mode never resets effort to `null` accidentally.
- Changing model revalidates the draft choice. If the level is unavailable, Ritemark switches that draft to Auto and says **Extra isn’t available for this model. Using Auto.**
- Two concurrent Codex conversations can use different effort levels without sharing or overwriting configuration.

### R8: Capability-driven OpenCode behavior

As an OpenCode user, I want Ritemark to use ACP’s thought-level capability when it is genuinely available, so the UI does not overpromise across BYOK providers.

Acceptance criteria:
- Ritemark identifies an ACP option by semantic category `thought_level` and uses the option’s advertised ID/current value/choices; it does not assume the config ID or labels.
- Open/select remains runtime-lazy per Sprint 110. Ritemark does not launch OpenCode merely to populate the effort control.
- Before live capability evidence exists, the trigger is absent or disabled with honest explanatory text; the first turn remains sendable with provider defaults.
- Once a session advertises compatible choices, the control appears for subsequent turns and calls `session/set_config_option` before the associated prompt.
- Unknown, disappearing, or rejected options fall back to Auto with a visible non-destructive notice and do not damage the conversation.

### R9: Rollout and regression safety

As the release team, we want a reversible rollout, so effort can be disabled without breaking Agent Chat or stored conversations.

Acceptance criteria:
- A `composer-thinking-effort` feature flag is experimental, defaults on for v1.10.0, and gates the UI plus host application of overrides.
- With the flag off, stored effort metadata remains readable, the control is hidden, and every runtime receives its normal default behavior.
- Tests cover Claude, Codex, capability-advertising and non-advertising OpenCode, runtime/model switching, Auto, every supported explicit level, unsupported/rejected levels, plan mode, queue snapshots, two conversations, reload, and flag-off.
- Architecture, changelog, v1.10.0 release notes/test checklist, user docs, issue #206, and release tracker are updated before closeout.
- `./scripts/validate-qa.sh` and the release-specific Composer/runtime canary pass before ready handoff.

## Non-Requirements

- A global Settings-only effort preference or vendor-specific Composer designs.
- Exposing raw thinking tokens, chain of thought, token budgets, or hidden provider reasoning.
- Claiming that more effort is always smarter or cheaper.
- Retrofitting effort metadata onto historical turns.
- Adding effort controls to Ritemark Flows, scheduled tasks, legacy single-shot AI, or agent configuration frontmatter.
- Launching a runtime during conversation open/select only to discover capabilities.

## Resolved Questions

- **2026-08-22 — New Sprint 112, not an expansion of Sprint 109/110.** Durable history and continuation stay independently reviewable.
- **2026-08-22 — Runtime refresh first.** Effort maps to the final Sprint 111 pins and protocols.
- **2026-08-22 — Composer, not Settings.** The choice is snapshotted per accepted turn and belongs beside model/mode.
- **2026-08-22 — Ritemark vocabulary.** Use Auto/Low/Medium/High/Extra/Max and Faster/More thorough; do not clone “Smarter” language.
- **2026-08-22 — Claude and Codex are first-class; OpenCode is capability-driven.** BYOK/provider diversity makes a universal OpenCode claim dishonest without ACP evidence.

## Open Questions

- Phase 0 must capture the exact Codex 0.149.0 field and model-level option metadata after Sprint 111 lands.
- Phase 0 must decide whether Claude’s reported applied effort can be observed synchronously or only from hooks/result metadata.
- Phase 0 must measure when OpenCode 1.18.21 publishes `thought_level` and whether a config change is guaranteed to apply before the immediately following prompt.
