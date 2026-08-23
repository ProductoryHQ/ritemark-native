# Sprint 112 Thinking Effort Capability Audit

**Status:** Template; execute after Sprint 111 merges<br>
**Prepared:** 2026-08-22

## Objective

Measure the exact effort controls exposed by the final v1.10.0 runtime/model combinations and decide which canonical Ritemark values can be offered without guessing.

## Canonical Vocabulary

| Ritemark value | User label | Meaning |
|---|---|---|
| `auto` | Auto | Omit override; runtime/model decides. |
| `low` | Low | Fastest supported explicit level. |
| `medium` | Medium | Moderate explicit reasoning. |
| `high` | High | High explicit reasoning. |
| `xhigh` | Extra | Vendor xhigh/extra level where actually supported. |
| `max` | Max | Maximum vendor level where actually supported. |

No row is selectable merely because it exists here. Runtime/model evidence decides visibility.

## Runtime/Model Matrix

Fill with final Sprint 111 pins:

| Runtime | Model | Capability source | Provider choices | Ritemark choices | Wire location | Default | Applied value observable? | Result |
|---|---|---|---|---|---|---|---|---|
| Claude | discovered model 1 | SDK/catalog | — | — | SDK `effort` | adaptive/omitted | — | Pending |
| Claude | discovered model 2 | SDK/catalog | — | — | SDK `effort` | adaptive/omitted | — | Pending |
| Codex | model 1 | app-server metadata | — | — | measured turn/collaboration field | omitted | — | Pending |
| Codex | model 2 | app-server metadata | — | — | measured turn/collaboration field | omitted | — | Pending |
| OpenCode | provider/model 1 | ACP live config | — | — | advertised config ID | provider default | — | Pending |

## Claude Probes

- Auto/omitted behavior under adaptive thinking.
- Low, medium, high, xhigh, max acceptance by each discovered model.
- SDK error vs silent downgrade for an unsupported level.
- Where the applied level appears in hook/result metadata and whether it is safe to expose as metadata.
- Two sessions with different levels and plan/permission interaction.

## Codex Probes

- Model-list metadata and supported reasoning-effort values.
- Exact `turn/start`/collaboration-mode field on execute and plan-first turns.
- Auto omission vs explicit null semantics.
- Invalid level error timing and duplicate-prompt risk.
- Two threads with different levels; resume behavior and model switch.

## OpenCode/ACP Probes

- Whether session creation returns an option with category `thought_level`.
- Advertised option ID, values, labels, current value, and update notifications.
- Whether `session/set_config_option` acknowledgement guarantees application before the following prompt.
- Behavior when provider/model changes, option disappears, or selected value is rejected.
- Confirmation that no capability can be discovered without violating lazy open/select.

## UX Validation Matrix

- normal/minimum sidebar width
- 100% and 200% zoom
- light/dark/high-contrast themes
- keyboard only and screen reader announcements
- reduced motion
- Auto, each supported manual level, unsupported model, downgrade, rejection
- running turn, queued prompt, conversation/runtime/model switch, reload

## Decision Rules

- Offer a value only when the final runtime/model accepts it in a controlled probe or authoritative capability metadata.
- Auto always means omission/provider default, never an invented medium mapping.
- Do not map `xhigh` to `high` or `max`; expose Extra only when `xhigh` exists.
- Do not launch OpenCode during open/select to discover configuration.
- If provider acceptance timing is ambiguous, follow Sprint 110’s no-duplicate-prompt rule and default to Auto.

## Decision

- **Ship full matrix:** Claude and Codex mappings proven; qualifying OpenCode mappings proven.
- **Ship partial matrix:** name every unsupported runtime/model and exact honest UI behavior.
- **Block:** name the ambiguous/unsafe contract and smallest next audit.

**Jarmo decision:** Pending.
