# Agent Lifecycle Analysis: AskUserQuestion, Plan Mode, Dev Mode

Date: 2026-03-17
Repo: `ritemark-native`
Scope: Claude agent sidebar, Codex sidebar, extension <-> webview interaction lifecycle

## Goal

Make the full agent lifecycle reliable:

1. normal execution in dev mode
2. enter plan mode
3. ask clarifying questions while planning
4. update/render plan state clearly
5. approve or reject the plan
6. exit plan mode correctly
7. continue execution in the same turn

This document is intentionally written before the final fix is completed, so the target lifecycle is explicit and reviewable first.

## Executive Summary

There are two different problems, not one:

1. Claude support is mostly present in the SDK and partly present in our UI, but our integration breaks the lifecycle in the middle.
2. Codex capability is split between what the current CLI can expose and what Ritemark currently consumes. Our checked-in app-server protocol layer is a simplified, outdated subset, so the current "capability gap" is partly an integration gap, not purely a dependency limitation.

The current Claude integration has three architectural mistakes:

1. `AskUserQuestion` UI exists in the webview, but nothing emits the event that would render it.
2. Plan approval is modeled as "send a new follow-up prompt", but Claude plan approval is actually a response to a pending `ExitPlanMode` tool call.
3. Plan text is inferred from generic `thinking` snippets instead of being tracked as explicit plan-mode state.

The practical consequence is the bug seen in the sidebar:

- the agent can show a plan-like result
- the user can click `Approve plan`
- but Claude may still remain in plan mode because we answered with a new prompt instead of resolving the pending `ExitPlanMode` transition

## What The Current Code Does

### Claude

Relevant files:

- `extensions/ritemark/src/agent/AgentRunner.ts`
- `extensions/ritemark/src/agent/types.ts`
- `extensions/ritemark/src/views/UnifiedViewProvider.ts`
- `extensions/ritemark/webview/src/components/ai-sidebar/store.ts`
- `extensions/ritemark/webview/src/components/ai-sidebar/AgentView.tsx`
- `extensions/ritemark/webview/src/components/ai-sidebar/AgentResponse.tsx`
- `extensions/ritemark/webview/src/components/ai-sidebar/AgentQuestion.tsx`

Observed behavior before the final fix:

1. Claude assistant messages are streamed and reduced to generic `agent-progress`.
2. `EnterPlanMode` and `ExitPlanMode` are only recognized as progress markers.
3. `AgentQuestion.tsx` exists but is effectively dead code because no extension message renders it.
4. Plan review UI appears after a turn result and is handled by sending a new prompt like `Plan approved. Proceed with implementation.`

This is the wrong lifecycle for Claude plan mode.

### Codex

Relevant files:

- `extensions/ritemark/src/codex/codexProtocol.ts`
- `extensions/ritemark/src/codex/codexAppServer.ts`
- `extensions/ritemark/src/views/UnifiedViewProvider.ts`
- `extensions/ritemark/webview/src/components/ai-sidebar/CodexView.tsx`

Observed behavior in the checked-in Ritemark integration:

1. Our local `codexProtocol.ts` only models turn start/completion, streamed deltas, item start/completion, and approvals.
2. We already surface command/file approvals correctly.
3. The current integration uses `experimentalRawEvents: false`.
4. We do not currently consume typed Codex events for question input or plan updates anywhere in Ritemark.

Important correction from a fresh audit on 2026-03-18:

1. The installed Codex CLI is `0.114.0`, while `codexProtocol.ts` in this repo is labeled as a simplified snapshot generated from `v0.106.0`.
2. Running `codex app-server generate-ts --out <tmpdir>` on the local CLI produced richer types than Ritemark currently checks in.
3. The generated protocol includes:
   - server request `item/tool/requestUserInput`
   - notification `turn/plan/updated`
   - notification `item/plan/delta`
   - MCP-related notifications and requests
4. This means the current Codex limitation in Ritemark is not "the dependency definitely cannot do it". It is "our checked-in protocol/client layer does not yet consume the richer surface exposed by the current dependency".

## External Findings

### Anthropic / Claude

Primary sources checked:

- Anthropic Claude Code SDK docs: <https://docs.anthropic.com/en/docs/claude-code/sdk/sdk-typescript>
- Anthropic SDK package page: <https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk>
- local installed SDK types under `extensions/ritemark/node_modules/@anthropic-ai/claude-agent-sdk/`

Important findings:

1. The SDK exposes `canUseTool`, which is the intended control point for handling tool execution.
2. `AskUserQuestion` is a built-in tool and is explicitly present in the SDK tool schemas.
3. The SDK control path supports returning `behavior: 'allow'` with `updatedInput`.
4. The local SDK source strongly suggests that `AskUserQuestion` is resolved by returning `updatedInput` that includes `answers`.
5. `SDKUserMessage` also contains `parent_tool_use_id` and `tool_use_result`, which confirms the SDK is built for interactive tool flows.

Most important design implication:

- `AskUserQuestion` should not be modeled as a normal text turn.
- it is a pending tool interaction that pauses execution until the host app answers it

### OpenAI / Codex

Primary sources checked:

- official OpenAI Codex docs: <https://developers.openai.com/codex/>
- official OpenAI Codex CLI repository: <https://github.com/openai/codex>
- local installed Codex CLI and generated protocol types

Important findings:

1. Our local Codex CLI version is `0.114.0`.
2. The checked-in Ritemark protocol file is a simplified subset generated from `v0.106.0`.
3. A fresh `codex app-server generate-ts --out <tmpdir>` run from the installed CLI shows server request `item/tool/requestUserInput` and server notifications including `turn/plan/updated` and `item/plan/delta`.
4. Official Codex materials confirm MCP support is configured through `~/.codex/config.toml`, and an open issue shows project-specific MCP config is still a gap in Codex CLI today.

Inference note:

- the older "Codex does not expose question/plan events" conclusion is no longer strong enough. The more precise conclusion is that Ritemark currently does not consume the richer app-server surface from the newer Codex CLI.

Most important design implication:

- we still must not pretend Claude SDK and Codex app-server are identical
- but we also should not artificially cap Codex to the older subset if the installed dependency now exposes typed question and plan events
- the next Codex phase should start by refreshing `codexProtocol.ts` from the current CLI and updating `codexAppServer` / `UnifiedViewProvider` to consume the richer event surface

## MCP Access Findings

### Claude SDK MCP loading

The Claude MCP problem had a concrete root cause in our integration.

Observed local setup:

- user-scope MCP server `pencil` exists in `~/.claude.json`
- there is no project `.mcp.json` in this repo
- `AgentRunner` was launching the SDK with `settingSources: ['project']`

Observed runtime result:

- with `settingSources: ['project']`, the SDK init event only showed Claude.ai connectors and did not include `pencil`
- with `settingSources: ['user', 'project', 'local']`, the same init event showed `pencil` as `connected`

Design implication:

- if Ritemark wants Claude sessions to see the same user/project/local MCP configuration as Claude Code, the SDK session must load all three setting sources by default
- project-only loading is too narrow for normal interactive usage

Implementation status:

- `AgentRunner` now defaults to `['user', 'project', 'local']`
- custom overrides are still possible through explicit `settingSources`

Additional nuance:

- loading an MCP server is not sufficient on its own
- Anthropic's SDK docs also require explicit MCP tool permission in `allowedTools`, using names like `mcp__server__*`, or direct `mcpServers` passed in code

### Codex MCP loading

Codex uses a different configuration model.

Observed local/official behavior:

- Codex CLI supports MCP servers via `mcp_servers` in `~/.codex/config.toml`
- the official repo issue tracker still has an open feature gap around project-specific MCP config

Design implication:

- Claude and Codex should not share one assumption about MCP scope resolution
- Claude supports user/project/local scope distinctions
- Codex currently appears centered on user config, with project-specific MCP support still not established in the official CLI flow

## Root Cause Breakdown

### Root Cause 1: AskUserQuestion is disconnected

The webview has a real UI for agent questions:

- `extensions/ritemark/webview/src/components/ai-sidebar/AgentQuestion.tsx`

But the extension never emits a typed question event, and the store never holds pending question state for a turn.

Result:

- Claude asks
- the SDK waits
- Ritemark never renders the UI needed to answer

### Root Cause 2: Plan approval is modeled as a new prompt

Current behavior in the sidebar:

- user clicks `Approve plan`
- store sends a new agent prompt
- a new turn is created

That is semantically wrong.

For Claude, plan approval is not a new user turn. It is the answer to a pending `ExitPlanMode` tool call. If we send a new prompt instead, the model may still be in plan mode and the lifecycle drifts out of sync.

This matches the bug seen in the screenshot:

- the UI says the plan was approved
- Claude still says it first needs to exit plan mode

### Root Cause 3: Plan state is inferred from generic text

Current plan rendering uses generic `thinking` activity text as the plan preview source.

That is fragile because:

1. not every `thinking` chunk is plan content
2. plan text can span multiple assistant messages
3. the state change is actually semantic:
   - entered plan mode
   - produced plan content
   - requested exit from plan mode
   - received approval or rejection
   - resumed execution

This should be tracked as lifecycle state, not reconstructed from snippets after the fact.

## Correct Claude Lifecycle

The correct turn lifecycle should be:

1. user sends a prompt
2. agent starts in normal execution mode
3. agent may call `EnterPlanMode`
4. host marks the turn as `plan mode active`
5. assistant text emitted while plan mode is active is accumulated into `planText`
6. agent may call `AskUserQuestion`
7. host renders a typed question card and pauses until the user answers
8. host returns the answer as `updatedInput.answers`
9. agent continues in the same turn
10. agent calls `ExitPlanMode`
11. host renders a plan approval card tied to that pending tool call
12. user approves or rejects the pending plan request
13. if approved, host allows the tool call and Claude exits plan mode
14. if rejected, host denies the tool call with feedback and Claude remains in plan mode
15. Claude continues execution in the same turn
16. final result arrives after actual implementation or final response

Critical point:

- `Approve plan` must not create a new turn
- it must resolve the pending `ExitPlanMode` tool call inside the current turn

## Correct UI State Model

Each Claude turn needs explicit interactive state:

- `isRunning`
- `planModeActive`
- `planText`
- `pendingQuestion`
- `pendingPlanApproval`
- `result`

This is better than treating everything as generic activities because interactive states are mutually exclusive in important ways:

- a running turn with a pending question should not show a generic spinner as the primary action
- a running turn with pending plan approval should show approve/reject controls tied to the pending tool request
- a completed turn should show result state, not interactive state

## Recommended Implementation Model

### Claude

Implement three typed extension -> webview events:

1. `agent-question`
2. `agent-plan-approval`
3. `agent-progress` with explicit `plan_text`

Implement two typed webview -> extension responses:

1. `agent-answer-question`
2. `agent-answer-plan`

In `AgentSession`, keep two pending promises:

1. pending ask-user-question response
2. pending exit-plan-mode approval response

When `canUseTool` receives:

- `AskUserQuestion`
  - emit `agent-question`
  - wait for UI response
  - return `allow` with `updatedInput.answers`

- `ExitPlanMode`
  - emit `agent-plan-approval`
  - wait for UI response
  - if approved: return `allow`
  - if rejected: return `deny` with feedback

Implementation status as of 2026-03-17:

- Claude `AskUserQuestion` is now wired as a pending tool interaction end-to-end.
- Claude `ExitPlanMode` is now modeled as a pending approval in the same turn, not a synthetic follow-up prompt.
- The remaining work is validation-heavy: dev smoke tests for approve/reject/cancel behavior and ensuring no stale UI state remains after interruption.

### Codex

Do not fake universal support.

Instead:

1. keep the internal turn model conceptually aligned with Claude
2. only populate interactive fields when Codex app-server actually emits them
3. if the protocol does not expose a feature, surface that as unsupported rather than emulating it from prose

That avoids building a misleading abstraction where Claude is event-driven and Codex is text-scraped.

## Why A Shared "Universal" Abstraction Still Makes Sense

It is still worth having one internal model for the UI, but the model must be capability-based.

Example shared UI concepts:

- `pendingQuestion`
- `pendingPlanApproval`
- `approval`
- `streamingText`
- `activities`

But each provider advertises what it can actually produce:

- Claude:
  - question: yes
  - plan approval: yes
  - plan text: yes
  - command/file approval: no in this integration

- Codex app-server `0.114.0`:
  - question: not exposed
  - plan approval: not exposed
  - plan text: not exposed as typed event
  - command/file approval: yes

## Minimal Safe Rollout

Recommended implementation order:

1. Fix Claude `AskUserQuestion` end-to-end.
2. Fix Claude `ExitPlanMode` approval as a pending tool response.
3. Convert plan rendering to explicit `planText` lifecycle state.
4. Leave Codex on its currently exposed event set.
5. Add logging or diagnostics around unknown Codex notifications so future app-server versions are easy to adopt.

## Validation Checklist

Claude manual tests:

1. agent asks a multiple-choice question and waits
2. answering resumes the same turn
3. agent enters plan mode
4. plan text renders incrementally
5. `Approve plan` exits plan mode and continues in the same turn
6. `Reject` keeps the agent in plan mode and lets it revise
7. cancelling during a pending question or plan approval does not leave stale UI

Codex manual tests:

1. command approval still renders
2. file approval still renders
3. no regression in streaming text
4. no false promise of unsupported question/plan interaction

Build validation:

- `cd extensions/ritemark && npm run compile`
- `cd extensions/ritemark/webview && npm run build`
- `./scripts/validate-qa.sh`

## Recommended Decision

Proceed with this exact design:

1. Claude gets a proper pending-tool lifecycle for `AskUserQuestion` and `ExitPlanMode`.
2. Plan approval stops being a synthetic follow-up prompt.
3. Codex remains capability-based until the app-server protocol exposes richer interactive events.

This is the smallest design that is both technically correct and durable.
