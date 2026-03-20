# Sprint 45: Agent Lifecycle Hardening

## Goal

Make the Claude and Codex agent lifecycle in the AI sidebar predictable and reviewable, with Claude fully supporting question/plan interactions and Codex explicitly modeled by actual protocol capabilities.

## Why This Sprint Exists

The current agent UX shows lifecycle drift:

- `AskUserQuestion` does not render or resume correctly
- plan approval is treated like a new prompt instead of a pending tool response
- the UI can say a plan is approved while Claude remains in plan mode
- Codex and Claude are currently mixed together as if they expose the same interaction primitives

This is a cross-cutting state-machine problem, so the sprint starts with an audit before more implementation continues.

## Feature Flag Check

- [x] Does this sprint need a feature flag? NO.
  This is lifecycle hardening for existing agent behavior, not a new user-facing experiment.

## Success Criteria

- [ ] Claude `AskUserQuestion` renders as an interactive card in the sidebar
- [ ] Answering a Claude question resumes the same running turn
- [ ] Claude plan text is tracked explicitly as plan state, not reconstructed from generic activity snippets
- [ ] `Approve plan` resolves the pending `ExitPlanMode` transition instead of sending a new prompt
- [ ] `Reject plan` keeps Claude in plan mode with usable feedback
- [ ] Cancelling during pending question or plan approval does not leave stale UI state
- [ ] Codex UI only claims lifecycle features that are actually exposed by the current app-server protocol
- [ ] Dev-mode validation covers question flow, plan flow, and return-to-execution flow

## Deliverables

| Deliverable | Description | Status |
| --- | --- | --- |
| Lifecycle audit | Root-cause and target-state analysis for Claude/Codex lifecycle | Done |
| Claude question flow | Typed question event and answer roundtrip | Done |
| Claude plan flow | Explicit plan-mode state and correct `ExitPlanMode` handling | In progress |
| Shared sidebar state model | Clear pending question / pending plan approval state in webview store | Done |
| Shared lifecycle UI primitives | Reuse the same plan review and active-plan UI building blocks across Claude and Codex | In progress |
| Codex capability alignment | Refresh understanding of actual app-server support and keep UI aligned to what we truly consume | Done |
| MCP configuration alignment | Make Claude SDK sessions load expected MCP scopes and document Codex MCP differences | Done |
| Validation notes | TDD-style lifecycle regression coverage plus build and QA validation for lifecycle transitions | In progress |

## Scope

### In Scope

- `extensions/ritemark/src/agent/`
- `extensions/ritemark/src/views/UnifiedViewProvider.ts`
- `extensions/ritemark/webview/src/components/ai-sidebar/`
- Codex protocol audit for lifecycle capability mapping
- sprint docs and validation notes

### Out of Scope

- changing `.claude/**`
- inventing unsupported Codex lifecycle features
- shipping a generic cross-provider abstraction that hides protocol differences

## Implementation Checklist

### Phase 1: Audit

- [x] Inspect current Claude lifecycle in extension and webview layers
- [x] Verify Anthropic SDK support for `AskUserQuestion` and plan-related tool flow
- [x] Inspect current Codex app-server protocol surface in the local dependency version
- [x] Write lifecycle analysis document with target design

### Phase 2: Claude State Model

- [x] Add explicit sidebar state for pending question, pending plan approval, and plan text
- [x] Stop relying on generic `thinking` snippets as the only plan representation
- [x] Ensure one running turn can pause and resume without synthetic extra turns

### Phase 3: Claude Tool Interaction Flow

- [x] Wire `AskUserQuestion` through the SDK callback path
- [x] Render the interactive question card and return answers to the pending tool call
- [x] Wire `ExitPlanMode` approval as a pending tool interaction
- [x] Ensure approval/rejection updates the active turn instead of creating fake follow-up turns

### Phase 4: Codex Capability Alignment

- [x] Keep approvals working as-is
- [x] Audit the actual current Codex CLI protocol surface, not only the checked-in simplified subset
- [x] Refresh checked-in Codex protocol/client modeling to match the current dependency where safe
- [x] Avoid UI promises for unsupported or still-unconsumed Codex interactions

### Phase 4A: MCP Configuration Alignment

- [x] Reproduce Claude MCP loading gap with project-only settings
- [x] Change Claude SDK default setting sources to `user`, `project`, `local`
- [x] Add regression coverage for default setting sources
- [x] Document Codex MCP configuration differences versus Claude

### Phase 5: Validation

- [x] `cd extensions/ritemark && npm run compile`
- [x] `cd extensions/ritemark/webview && npm run build`
- [x] `./scripts/validate-qa.sh`
- [x] Add targeted lifecycle tests to the repo QA path
- [x] Sanity-check Claude SDK MCP loading with `project` vs `user+project+local`
- [ ] Dev smoke test: Claude question flow
- [x] Dev smoke test: Claude plan approve flow
- [ ] Dev smoke test: Claude plan reject flow
- [ ] Dev smoke test: return from plan mode into implementation in same turn
- [ ] Dev smoke test: Codex approvals still render

## Key Research

- [Agent lifecycle analysis](/Users/jarmotuisk/Projects/ritemark-native/docs/development/analysis/2026-03-17-agent-lifecycle-planmode-analysis.md)
- [Sprint audit](/Users/jarmotuisk/Projects/ritemark-native/docs/development/sprints/sprint-45-agent-lifecycle-hardening/research/lifecycle-audit.md)
- [User flow lifecycle contract](/Users/jarmotuisk/Projects/ritemark-native/docs/development/sprints/sprint-45-agent-lifecycle-hardening/notes/user-flow-lifecycle-contract.md)

## Key Files

| File | Purpose |
| --- | --- |
| `extensions/ritemark/src/agent/AgentRunner.ts` | Claude SDK lifecycle and pending tool interactions |
| `extensions/ritemark/src/agent/types.ts` | Shared extension-side lifecycle types |
| `extensions/ritemark/src/views/UnifiedViewProvider.ts` | Extension <-> webview event bridge |
| `extensions/ritemark/webview/src/components/ai-sidebar/store.ts` | Sidebar state machine |
| `extensions/ritemark/webview/src/components/ai-sidebar/AgentView.tsx` | Turn rendering and interactive cards |
| `extensions/ritemark/webview/src/components/ai-sidebar/AgentResponse.tsx` | Plan rendering and approval UI |
| `extensions/ritemark/src/codex/codexProtocol.ts` | Current Codex app-server protocol surface |

## Status

**Current Phase:** TDD lifecycle coverage added for helper/store seams, next fixes should be test-driven from failing lifecycle scenarios  
**Current Branch:** `feature/sprint-45-agent-lifecycle-hardening`  
**Next Gate:** Add failing tests for the remaining Codex post-approval re-planning bug, then fix the execution-mode transition against those tests
