# Ritemark v1.5.2

**Status:** Open release  
**Type:** Minor release  
**Focus:** Codex Flow Node, Scheduled Flow Runs, and Editor Reactions

---

## Summary

Ritemark v1.5.2 expands Flows in two important ways and adds a lightweight in-editor feedback loop.

It adds a dedicated **Codex** node to Flows and hardens the surrounding flow editor/runtime wiring so the feature behaves like a first-class node instead of a partial integration.

It also adds **Scheduled Flow Runs**, allowing eligible flows to execute automatically at defined times while Ritemark is open for the relevant workspace.

While a dedicated **Claude** node already existed, there was no equivalent agent node for people who prefer OpenAI models or want to use their ChatGPT subscription for autonomous coding work. Now Codex can be used in Flows the same way as Claude.

At the same time, recurring flow automation no longer depends on manual triggering. Flows can now be configured to run daily or at shorter repeating intervals without external cron setup.

This release also adds **Ritemark Reactions** in the editor toolbar, making it easier to send quick product feedback without leaving the current file.

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

### Editor Reactions

Love it? Hate it? Ritemark now includes a lightweight reactions action in the editor title toolbar.

- **Quick feedback:** Send a reaction from the editor without switching context
- **Optional detail:** Add a short free-text note when you want to explain more
- **App-specific analytics routing:** Anonymous app events to help to improve product. You can always opt-out.

---

## User Impact

If you use Flows for repo automation or coding tasks, you can now model those steps visually with Codex instead of keeping them limited to the AI sidebar.

More importantly, this release removes a provider gap in the flow editor. Claude users already had a dedicated agent node. OpenAI-first users did not. That gap is now closed.

This release also removes a workflow gap: flows no longer have to be started manually every time. If a flow is fully automatable, it can now run on a recurring schedule while Ritemark is open.

It also creates a simple feedback path from inside the editor. Instead of collecting feedback only through external channels, users can react in place while they are working.

Typical use cases:

- generate or update project files from a prompt with Codex
- chain Codex after Trigger inputs or earlier node outputs
- mix Codex with Save File and other flow nodes in the same workflow
- choose between Claude and Codex based on which model family is stronger for the job
- run recurring flows every morning, every hour, or every few minutes without manual intervention
- keep routine internal automations inside Ritemark instead of setting up external cron jobs
- send fast product feedback from the editor toolbar while staying in context

---

## Analytics Disclosure

Starting with v1.5.2, Ritemark collects anonymous usage analytics via PostHog (EU-hosted). This section is a complete and transparent list of every event the app can send. No personal information is collected.

### What is collected

| Event | When it fires | Data sent |
| --- | --- | --- |
| `app_session_start` | Each time Ritemark launches | App version, platform (e.g. `darwin`) |
| `feature_used` | When you open a file or use an export | Feature name: `editor`, `csv_editor`, `flows`, `excel_preview`, `word_preview`, `pdf_preview`, `export_pdf`, `export_word` |
| `agent_used` | When an AI agent runs inside a Flow | Agent name: `claude`, `codex`, or `ritemark_llm` |
| `reaction_submitted` | When you send a reaction from the toolbar | Reaction choice (e.g. `love_it`), optional free-text message |
| `feedback_sent` | When you include a message with a reaction | Your message text, reaction choice |

### What is NOT collected

- No file contents, filenames, or folder paths
- No API keys or credentials
- No IP-based geolocation (PostHog EU instance, no geo enrichment)
- No personal identifiers (name, email, account)
- No keystroke or interaction tracking
- No clipboard contents

### How it works

- A random anonymous UUID is generated on first launch and stored locally. It is not linked to any identity.
- All events include `$process_person_profile: false`, which tells PostHog not to create a person profile.
- Events are sent to `https://eu.i.posthog.com` (EU data residency).

### How to opt out

Go to **Settings** and disable **Analytics**. When disabled, no events are sent. The setting takes effect immediately per-event — no restart needed.

You can also set `"ritemark.analytics.enabled": false` in your settings JSON.

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
- editor-toolbar reactions command and PostHog-backed anonymous app analytics

---

## Included Work

- `feat: add Codex flow node for OpenAI Codex CLI integration`
- follow-up fixes for Codex node canvas/config stability
- follow-up fixes for Codex flow execution/result handling
- `flows: add scheduled flow run support`
- `feat: add PostHog-backed Ritemark reactions`
