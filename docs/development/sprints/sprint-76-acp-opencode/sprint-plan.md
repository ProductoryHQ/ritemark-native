# Sprint 76 — ACP Client + OpenCode BYOK Runtime

**Track:** SDD | **Phase:** 2 (planning — awaiting approval) | **Branch:** `sprint-76-acp-opencode` | **Worktree:** main checkout

## What this sprint is about

Ritemark's AI sidebar currently offers two agent runtimes: Claude Code (Anthropic subscription /
API key) and Codex (ChatGPT subscription / API key). Users who want Google Gemini, OpenRouter, or
local models have no path — and the research for issue #52 showed that Google's own CLIs
(Gemini CLI, Antigravity CLI) are dead ends for embedding.

This sprint adds a third runtime the *protocol-first* way: one **Agent Client Protocol (ACP)**
client, with **OpenCode** (MIT, 168K stars, 75+ providers) bundled as the default ACP agent. Users
bring their own API keys — Gemini, OpenAI, Anthropic, OpenRouter — configured once in Ritemark
Settings. Any future ACP agent (Goose, Qwen Code, …) plugs into the same client with a manifest
entry, no new protocol work.

## Linked issues & research

- [#52 — Third agent runtime research](https://github.com/ProductoryHQ/ritemark-native/issues/52) (research complete → this sprint implements)
- [#92 — Cursor CLI as third runtime](https://github.com/ProductoryHQ/ritemark-native/issues/92) (superseded in approach by ACP — Cursor CLI can be revisited as an ACP agent if it ever supports the protocol)
- Research: `docs/development/analysis/2026-06-01-third-agent-runtime-research.md`

## MVP Scope

1. ACP client core (`src/acp/`) — agent-agnostic (R1)
2. OpenCode bundled + discoverable (R2)
3. BYOK keys via Ritemark Settings, env-injected at spawn (R3)
4. File-edit approval parity with Codex (R4)
5. Streaming progress in the sidebar (R5)
6. Provider-filtered model selection (R6)
7. `opencode-integration` feature flag, ON by default (R7)

Out of scope: Goose bundling, replacing Claude/Codex native integrations, OpenCode HTTP server
mode, custom agent binary picker, Linux packaging, ACP session resume.

## Success Criteria

- [ ] A user with only a Gemini API key can run an autonomous agent session in the AI sidebar (R2+R3+R5)
- [ ] No file on disk changes without explicit user approval during an OpenCode session (R4)
- [ ] BYOK keys never appear in webview messages or on-disk config (R3)
- [ ] OpenCode selectable in the agent dropdown with provider-filtered models (R2+R6)
- [ ] Disabling the `opencode-integration` flag removes all traces of the feature from the UI (R7)
- [ ] All Claude Code and Codex functionality unchanged (regression gate)
- [ ] `src/acp/` contains nothing OpenCode-specific (R1 — verified by code review)

## Product Decisions

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-06-01 | Protocol-first: integrate ACP, bundle OpenCode as default agent | Issue #52 research: immune to vendor CLI deprecation (Gemini CLI lesson); one client unlocks all current/future ACP agents |
| 2026-06-01 | Single key UI in Ritemark Settings; env-injection to agent | TO BE architecture alignment — avoid key-management fragmentation |
| 2026-06-01 | Sprint named by Jarmo: `sprint-76-acp-opencode`; SDD track | Multi-requirement, multi-component, security-sensitive (approval gating) |
| 2026-06-01 | UI label = "OpenCode"; flag status = `stable`; proceed without waiting for typed-protocol refactor | Jarmo's answers to spec Q2/Q3/Q4 |
| 2026-06-01 | **UX prototypes of Settings BYOK section and model picker must be approved before implementation** — added to Phase 0 | Jarmo: user-facing surfaces are prototyped first, not designed mid-implementation |

## Risks

| Risk | Mitigation |
| --- | --- |
| OpenCode's ACP mode has untested gaps (model selection mechanism, permission flows) | Phase 0 e2e audit before any implementation; HTTP server mode is the documented fallback |
| Bun-compiled binary may complicate macOS notarization | Phase 0 bundling audit; first-use download is the fallback |
| `@agentclientprotocol/sdk` is pre-1.0 | Pin exact version; protocol itself is stable v1 |
| New webview messages added to stringly-typed bridge (TO BE #2 not yet done) | Normalize ACP/Codex approval payloads to one shape now; migrate to typed protocol when TO BE #2 lands (spec Q4 — Jarmo to confirm sequencing) |
| OpenCode bus factor (SST-driven, not foundation) | ACP client is agent-agnostic by spec (R1); Goose (Linux Foundation) addable later via manifest |

## SDD Artifacts

- [spec.md](spec.md) is the product and behavior contract.
- [technical-plan.md](technical-plan.md) records the architecture.
- [scenarios.md](scenarios.md) captures behavior examples.
- [tasks.md](tasks.md) is the implementation checklist.
- [research/](research/) holds the Phase 0 audits (created during Phase 0).

## Status Log

| Date | Update |
| --- | --- |
| 2026-06-01 | Sprint created from issue #52 research. Branch renamed from `claude/serene-ride-STPCa` → `sprint-76-acp-opencode`. Five SDD artifacts drafted. |
| 2026-06-01 | Spec Q2/Q3/Q4 resolved by Jarmo. |
| 2026-06-01 | **Phase 0 deliverables complete:** ACP e2e audit (DECISION: ship via ACP), bundling audit (RECOMMENDATION: bundle, 103.7 MB), UX design spec, 13-state HTML prototypes. **Awaiting Jarmo: prototype review, Q1 + Q-UX1..5 decisions, Phase 2→3 approval.** Residual risks: OpenCode 1.15.13 lacks session/cancel (process-kill fallback planned); Bun-binary notarization unverified until first production build. |
