# Ritemark v1.5.2

**Status:** Open release  
**Type:** Minor release  
**Focus:** Codex Flow Node and Scheduled Flow Runs

---

## Summary

Ritemark v1.5.2 expands Flows in two important ways.

It adds a dedicated **Codex** node to Flows and hardens the surrounding flow editor/runtime wiring so the feature behaves like a first-class node instead of a partial integration.

It also adds **Scheduled Flow Runs**, allowing eligible flows to execute automatically at defined times while Ritemark is open for the relevant workspace.

While a dedicated **Claude** node already existed, there was no equivalent agent node for people who prefer OpenAI models or want to use their ChatGPT subscription for autonomous coding work. Now Codex can be used in Flows the same way as Claude.

At the same time, recurring flow automation no longer depends on manual triggering. Flows can now be configured to run daily or at shorter repeating intervals without external cron setup.

---

## What's New

### Codex in Flows

The Flow Editor now includes a new **Codex** node under the AI section.

- **Dedicated flow node:** Codex is available directly in the node palette
- **Claude-style workflow:** You can now use Codex in Flows in the same way as the existing Claude node
- **Node configuration:** Prompt, model, and timeout can be edited from the properties panel
- **Execution support:** Flow execution now recognizes and runs `codex` nodes instead of treating them as unknown node types

### Scheduled Flow Runs

Flows can now be scheduled to run automatically while Ritemark is open for the relevant workspace.

- **Flow-level scheduling:** Schedule is configured at the flow level, not on individual nodes
- **Supported recurrence types:** `daily`, `weekdays`, `weekly`, `hourly`, and `every N minutes`
- **Workspace-local execution:** Runs happen only while that workspace is open in Ritemark
- **Runtime visibility:** The editor shows next run timing and last scheduled run status
- **Safe scheduling behavior:** Duplicate slots are suppressed and overlapping runs of the same flow are skipped instead of running in parallel

### Freedom of Choice

Ritemark is intended to be a genuinely open platform for AI-assisted work. The goal is not to lock users into one model vendor, but to support freedom of choice and let people combine the best available tools.

- **Anthropic and OpenAI side by side:** Ritemark supports both Claude and Codex instead of forcing a single provider
- **Subscription flexibility:** Teams that already rely on ChatGPT subscriptions can now use Codex directly in Flows
- **Composable workflows:** You can choose the agent that fits the task instead of shaping the task around one model family
- **Future-facing platform direction:** Gemini and other model ecosystems remain open as future additions

---

## User Impact

If you use Flows for repo automation or coding tasks, you can now model those steps visually with Codex instead of keeping them limited to the AI sidebar.

More importantly, this release removes a provider gap in the flow editor. Claude users already had a dedicated agent node. OpenAI-first users did not. That gap is now closed.

This release also removes a workflow gap: flows no longer have to be started manually every time. If a flow is fully automatable, it can now run on a recurring schedule while Ritemark is open.

Typical use cases:

- generate or update project files from a prompt with Codex
- chain Codex after Trigger inputs or earlier node outputs
- mix Codex with Save File and other flow nodes in the same workflow
- choose between Claude and Codex based on which model family is stronger for the job
- run recurring flows every morning, every hour, or every few minutes without manual intervention
- keep routine internal automations inside Ritemark instead of setting up external cron jobs

---

## Technical Notes

Includes flow work across:

- `extensions/ritemark/src/flows/`
- `extensions/ritemark/webview/src/components/flows/`

Key areas:

- backend flow execution wiring for `codex`
- execution panel support for Codex progress
- flow node type mapping and regression tests
- extension-host scheduler runtime for flow schedules
- workspace-scoped schedule runtime state and dedupe tracking
- flow-level schedule editor UI and save/remove UX

---

## Included Work

- `feat: add Codex flow node for OpenAI Codex CLI integration`
- follow-up fixes for Codex node canvas/config stability
- follow-up fixes for Codex flow execution/result handling
- `flows: add scheduled flow run support`
