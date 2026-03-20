# Dependency Drift Upkeep Plan

Date: 2026-03-18
Scope: Claude SDK, Codex CLI app-server protocol, MCP configuration behavior, sidebar lifecycle adapters

## Problem

The failure mode in this sprint was not just a bug in one handler.

It was protocol drift:

- Claude SDK behavior was newer/richer than our assumptions about MCP loading
- Codex CLI `0.114.0` exposed a richer app-server surface than the simplified protocol snapshot checked into Ritemark
- the UI kept relying on local adapter assumptions instead of verifying current dependency behavior

Fast-moving agent dependencies will keep changing. We need a repeatable process that catches drift before it becomes a user-visible lifecycle failure.

## Operating Model

Treat agent providers as external protocols with adapters, not as stable internals.

That means:

1. keep provider-specific capabilities explicit
2. verify current behavior from the installed dependency, not memory
3. snapshot the protocol boundary we actually consume
4. run a small smoke suite after each dependency bump or CLI reinstall

## Concrete Upkeep Routine

### 1. Add a scheduled protocol audit

Trigger:

- every Codex CLI version bump
- every Claude SDK version bump
- any unexplained lifecycle regression in the sidebar

Checklist:

- run `codex app-server generate-ts --out <tmpdir>`
- diff the generated types against `extensions/ritemark/src/codex/codexProtocol.ts`
- note new server requests, new notifications, and changed enum values
- inspect the local Claude SDK types under `extensions/ritemark/node_modules/@anthropic-ai/claude-agent-sdk/`
- confirm `settingSources`, MCP config behavior, and tool permission expectations still match our adapter

Output:

- one short audit note in the active sprint or maintenance sprint
- a decision: no changes, adapter update, or UI capability update

### 2. Keep a checked-in capability matrix

Maintain a small source-of-truth table for each provider:

- supports question requests
- supports plan updates
- supports plan approval
- supports MCP startup state
- supports MCP tool progress
- config scope model

This should live next to the adapter code or in sprint-maintenance docs and must be updated whenever a provider bump changes the answer.

### 3. Add protocol snapshot tests

Add small tests that fail loudly when our local assumptions drift:

- Codex:
  - expected request method names
  - expected notification names we consume
  - current approval decision enum values
- Claude:
  - default `settingSources`
  - synchronous question/plan-answer lifecycle

These do not need to be end-to-end. They only need to guard the adapter boundary.

### 4. Add one dev smoke flow per provider

After any provider bump or adapter change, manually verify:

- Claude:
  - AskUserQuestion
  - plan approve
  - plan reject
  - return from plan mode into same turn
  - user-scope MCP appears when expected
- Codex:
  - command approval
  - file approval
  - requestUserInput
  - plan update rendering

Record pass/fail in sprint notes. Do not rely only on compile success.

### 5. Separate dependency bumps from feature work

Do not combine:

- provider version bump
- protocol adapter rewrite
- UI redesign

Preferred sequence:

1. bump dependency on a dedicated branch
2. regenerate or audit protocol
3. adapt the Ritemark bridge
4. run smoke checks
5. only then resume feature work

This keeps regressions attributable.

### 6. Create a maintenance sprint lane

Use a recurring maintenance sprint or maintenance issue bucket for:

- CLI/SDK refreshes
- protocol diff review
- MCP behavior changes
- auth/config flow changes

This prevents "silent drift" from piling up until a feature sprint breaks unexpectedly.

## Near-Term Follow-Up

1. Refresh `extensions/ritemark/src/codex/codexProtocol.ts` more fully from the current Codex CLI instead of extending it ad hoc.
2. Add Codex-side snapshot tests for the new request/notification methods we now rely on.
3. Add a short provider capability matrix document referenced from the sidebar adapter.
4. Consider a small script that generates a temporary Codex protocol snapshot and reports newly added methods in CI or pre-release checks.

## Implemented In Sprint 45

The first production guardrail is now in place for Codex:

- Ritemark inspects the active `codex` binary at runtime and records both version-range compatibility and observed protocol capabilities.
- Settings now surfaces whether Codex is fully compatible, runnable with limits, or outside the audited range.
- The Codex chat view now shows a dismissable notice when the current CLI is limited or untested, instead of silently pretending every lifecycle feature is available.

This is the baseline for future upkeep. It does not replace protocol audits or smoke tests after provider changes.

## Reference Commands

```bash
codex --version
codex app-server generate-ts --out /tmp/codex-protocol
cd extensions/ritemark && npm run compile
cd extensions/ritemark/webview && npm run build
./scripts/validate-qa.sh
```

## External References

- Anthropic Claude Code settings: https://docs.anthropic.com/en/docs/claude-code/settings
- Anthropic Claude Code MCP: https://docs.anthropic.com/en/docs/claude-code/mcp
- OpenAI Codex repo: https://github.com/openai/codex
