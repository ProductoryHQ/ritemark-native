# Sprint 112 Thinking Effort Capability Audit

**Status:** Approved for implementation<br>
**Audited:** 2026-08-24<br>
**Final pins:** Codex app-server `0.149.0`; Claude Code `2.1.239`; Claude Agent SDK `0.3.239`; OpenCode `1.18.21`; ACP SDK `1.4.0`

## Objective

Measure the effort controls exposed by the exact v1.10.0 runtime/model combinations and decide which canonical Ritemark values can be offered without guessing.

## Evidence

- [`runtime-effort-probe.mjs`](./runtime-effort-probe.mjs) is a read-only local probe. It asks Claude SDK `supportedModels()` and Codex app-server `model/list`; it sends no user prompt and prints capability metadata only.
- [`runtime-effort-capabilities-2026-08-24.json`](./runtime-effort-capabilities-2026-08-24.json) is the captured exact-pin output.
- Sprint 111's [`runtime-version-audit.md`](../../sprint-111-agent-runtime-refresh/research/runtime-version-audit.md) supplies the live OpenCode/ACP `thought_level` canary.
- Codex `0.149.0`'s generated [`TurnStartParams`](https://github.com/openai/codex/blob/rust-v0.149.0/codex-rs/app-server-protocol/schema/typescript/v2/TurnStartParams.ts) defines the top-level nullable `effort` override for this and subsequent turns.
- Claude SDK `0.3.239` types expose `Options.effort`, per-model effort metadata, and warm-query `applyFlagSettings({ effortLevel })`.
- ACP SDK `1.4.0` defines semantic category `thought_level`; new/resume/set responses and `config_option_update` carry the full option state.

## Recommended Canonical Vocabulary

| Ritemark value | User label | Meaning |
|---|---|---|
| `auto` | Auto | No user-selected override; use the captured runtime/model default. |
| `low` | Low | Lowest advertised explicit level. |
| `medium` | Medium | Moderate explicit reasoning. |
| `high` | High | High explicit reasoning. |
| `xhigh` | Extra | Vendor `xhigh` where advertised. |
| `max` | Max | Vendor `max` where advertised. |
| `ultra` | Ultra | Codex `ultra` where advertised; never coerce to Max. |

The original six-value proposal ended at Max. Exact Codex metadata proves that Sol and Terra expose a distinct higher `ultra` value. Calling Max the endpoint would be false, so Phase 0 recommends adding `ultra` to the canonical union while showing it only where advertised.

## Runtime/Model Matrix

| Runtime | Model | Advertised explicit choices | Auto/default | Applied value evidence | Result |
|---|---|---|---|---|---|
| Claude | Default → `claude-opus-4-8[1m]` | low, medium, high, xhigh, max | adaptive thinking | SDK model metadata; query flag state is available to hooks | Ship Low–Max |
| Claude | Opus → `claude-opus-4-8[1m]` | low, medium, high, xhigh, max | adaptive thinking | same | Ship Low–Max |
| Claude | Fable → `claude-fable-5` | low, medium, high, xhigh, max | adaptive thinking | same | Ship Low–Max |
| Claude | Sonnet → `claude-sonnet-5` | low, medium, high, xhigh, max | adaptive thinking | same | Ship Low–Max |
| Claude | Haiku → `claude-haiku-4-5-20251001` | none | model default | `supportsEffort: false` | Disabled Auto state |
| Codex | `gpt-5.6-sol` | low, medium, high, xhigh, max, ultra | low | `model/list`; thread start/settings responses expose effective effort | Ship Low–Ultra |
| Codex | `gpt-5.6-terra` | low, medium, high, xhigh, max, ultra | medium | same | Ship Low–Ultra |
| Codex | `gpt-5.6-luna` | low, medium, high, xhigh, max | medium | same | Ship Low–Max |
| Codex | `gpt-5.5` | low, medium, high, xhigh | medium | same | Ship Low–Extra |
| Codex | `gpt-5.4` | low, medium, high, xhigh | medium | same | Ship Low–Extra |
| Codex | `gpt-5.4-mini` | low, medium, high, xhigh | medium | same | Ship Low–Extra |
| Codex | `gpt-5.3-codex-spark` | low, medium, high, xhigh | high | same | Ship Low–Extra |
| OpenCode | default `opencode/big-pickle` | none | provider default | no ACP `thought_level` option | Disabled Auto state |
| OpenCode | Sprint 111 effort-capable canary model | low, medium, high | live option `currentValue` | acknowledged config update before next prompt | Ship live advertised levels only |

Unknown or newly discovered models are not inferred from their name. They remain Auto-only until authoritative metadata is available.

## Runtime Mapping Decision

### Claude

- New query: Auto omits `Options.effort`; an explicit value is passed as `Options.effort`.
- Warm query: before enqueueing a follow-up, await `applyFlagSettings({ effortLevel })`; Auto uses `effortLevel: null` to remove Ritemark's prior override.
- The accepted turn keeps its requested snapshot. Applied/downgraded metadata comes only from SDK-observable state; Ritemark does not infer success from the label.
- Haiku and any model with `supportsEffort: false` show a disabled, focusable **Effort · Auto** control with the explanation “This model chooses its own thinking effort.”

### Codex

- Explicit execute turns send top-level `turn/start.effort`.
- Explicit plan turns send the same value both top-level and in `collaborationMode.settings.reasoning_effort`, avoiding the current accidental plan-mode `null` overwrite.
- The override is sticky for subsequent turns. Therefore Auto can be a pure omission only before Ritemark has applied a manual value. On a warm thread, Auto must restore the effective default captured from `thread/start`/`thread/resume` before dispatch. This preserves the user's pre-existing Codex/project default instead of inventing Medium.
- `thread/settings/updated` or the next start/resume response is the source of effective value. Unknown/rejected values fail before prompt dispatch; there is no silent `xhigh → high`, `ultra → max`, or duplicate retry.

### OpenCode / ACP

- Discover by semantic `category === "thought_level"`, never by the observed option ID (`effort`).
- Capture option state from new session, resumed session, set response, and `config_option_update`.
- An explicit selection calls `session/set_config_option` with the advertised `configId` and awaits the returned full `configOptions` before prompting.
- Auto restores the session's captured initial `currentValue`; it is not offered as a fabricated ACP value.
- If the option disappears or rejects the value before prompt acceptance, reset to Auto and notify. Once acceptance is ambiguous, follow Sprint 110: do not retry the prompt automatically.

## OpenCode Laziness Proof

Current open/select behavior is runtime-lazy:

1. `conversation:selected` only records the selected conversation and last-used time in `UnifiedViewProvider`.
2. `_openRuntimeSession()` is reached from accepted `agent-execute` dispatch, not from open/select.
3. `AcpRuntime.createSession()` is the first path that calls `_ensureManager()` and starts the bundled OpenCode process.

Sprint 112 may therefore show OpenCode as **Effort · Auto** before first dispatch, but it must not claim manual levels or start OpenCode merely to populate the control. Live choices appear only after the existing lazy session exists.

## UX Contract Validation

The interactive [`prototype.html`](../prototype.html) follows Ritemark's secondary-sidebar and Composer-footer geometry:

- footer ghost trigger: **Effort** for Auto and **Effort · value** for manual levels, with no decorative icon or duplicate adjacent Auto label;
- Auto is a checkbox below the manual scale;
- scale copy is limited to **Faster → More thorough**; a native draggable range input provides the filled pill track and large thumb, while discrete values remain available through `aria-valuetext` without persistent stop labels;
- options are model-filtered, including Codex-only Ultra and unsupported-model Auto;
- 420 px and 280 px sidebar states, footer wrapping, and a 200% zoom state are encoded;
- native buttons, focus-visible ring, arrow-key scale navigation, Escape close/focus return, polite invalidation notice, and reduced-motion CSS are encoded.

Automated Browser Use could not navigate the local `file://` prototype because that scheme is blocked by browser security policy and no already-open prototype tab was available to claim. This is not recorded as a visual pass. Live light/dark/high-contrast, 200% zoom, screen-reader, and collision checks remain implementation QA gates in Phase 4/5.

## Risks Closed by the Audit

- **False endpoint:** adding capability-filtered Ultra avoids calling Max the highest Codex level when it is not.
- **Sticky Codex override:** warm Auto restores the captured effective default rather than merely omitting a sticky field.
- **Plan-mode overwrite:** one requested value owns both Codex fields.
- **Fake OpenCode parity:** ACP determines the choices only after lazy session start.
- **Silent coercion:** unsupported and rejected values reset before dispatch; no neighboring level substitution.

## Phase 0 Recommendation

Approve the full capability-driven matrix with these amendments:

1. Extend `ThinkingEffort` with `ultra`, labelled **Ultra**, visible only where advertised.
2. Define Auto as “no user-selected override / restore captured runtime default”; first-turn omission remains preferred, but warm APIs may require an explicit reset to the captured default.
3. Approve the Composer footer/popover contract in `design.md` and `prototype.html`.
4. Keep OpenCode capability discovery lazy and session-local.

**Jarmo decision:** Approved 2026-08-24. This includes the capability-filtered Ultra value, warm-session Auto restoration, lazy OpenCode discovery, and the final compact native-range Composer design.
