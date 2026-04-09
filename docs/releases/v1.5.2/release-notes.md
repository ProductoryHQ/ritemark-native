# Ritemark v1.5.2

**Status:** Open release  
**Type:** Minor release  
**Focus:** Unified Onboarding, Codex Flow Node, Scheduled Flows, Reactions, Offline Guard

---

## Downloads

| Platform | Download |
|----------|----------|
| macOS Apple Silicon (M1/M2/M3) | [Ritemark-arm64.dmg](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-arm64.dmg) |
| macOS Intel | [Ritemark-x64.dmg](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-x64.dmg) |
| Windows | [Ritemark-Setup.exe](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-1.5.2-win32-x64-setup.exe) |

---

## Summary

Ritemark v1.5.2 replaces the fragmented per-agent setup screens with a **Unified Onboarding Wizard**, expands Flows with a dedicated **Codex** node and **Scheduled Flow Runs**, adds lightweight **Editor Reactions** for in-app feedback, and hardens the **offline experience** so users can continue composing when disconnected.

This release also fixes all 53 pre-existing webview TypeScript errors, improves Codex CLI installation reliability on both macOS and Windows, and refines the AI sidebar agent selector ordering.

---

## What's New

### Unified Onboarding Wizard

The AI sidebar now opens with a single onboarding wizard instead of separate setup screens for each agent.

- **Single entry point:** One checklist covers Git, Node.js, Claude CLI, and Codex CLI
- **1-click installs:** Dependencies install via terminal commands (winget on Windows, npm/nvm on macOS)
- **3-step flow:** Checklist (install dependencies) -> Authenticate (sign in to Claude and/or Codex) -> Ready
- **Auto-selects best agent:** The sidebar defaults to the best available agent: Claude > Codex > Ritemark Document Agent
- **Windows Node.js support:** A "Get Node.js" button appears when Node is missing on Windows, matching the existing Git-for-Windows pattern
- **Auth cards shown independently:** Claude and Codex authentication cards appear side by side regardless of which dependencies are installed

### Codex in Flows

The Flow Editor now includes a new **Codex** node under the AI section.

- **Dedicated flow node:** Codex is available directly in the node palette
- **Claude-style workflow:** Use Codex in Flows the same way as the existing Claude node
- **Node configuration:** Prompt, model, and timeout can be edited from the properties panel
- **Execution support:** Flow execution now recognizes and runs `codex` nodes instead of treating them as unknown node types

### Scheduled Flow Runs

Flows can now be scheduled to run automatically while Ritemark is open for the relevant workspace.

- **Flow-level scheduling:** Schedule is configured at the flow level, not on individual nodes
- **Supported recurrence types:** `daily`, `weekdays`, `weekly`, `hourly`, and `every N minutes`
- **Workspace-local execution:** Runs happen only while that workspace is open in Ritemark
- **Runtime visibility:** The editor shows next run timing and last scheduled run status
- **Safe scheduling behavior:** Duplicate slots are suppressed and overlapping runs of the same flow are skipped instead of running in parallel

### Editor Reactions

Love it? Hate it? Ritemark now includes a lightweight reactions action in the editor title toolbar.

- **Quick feedback:** Send a reaction from the editor without switching context
- **Optional detail:** Add a short free-text note when you want to explain more
- **App-specific analytics routing:** Anonymous app events to help improve the product. You can always opt out.

### Offline Send Guard

The AI chat input now correctly handles offline/disconnected states.

- **Composing always works:** You can type and edit messages even when offline
- **Send blocked when offline:** The send button is disabled when no network connection is available, preventing silent failures
- **Clear feedback:** Visual indication when the connection is unavailable

---

## Improvements

### Codex CLI Reliability

Codex installation and repair have been substantially hardened, especially for nvm users.

- **nvm path resolution:** `findBinaryPath()` now scans `~/.nvm/versions/node/*/bin/` as a fallback when Codex is installed under an nvm-managed Node version
- **Architecture detection:** `getBinaryArchitecture()` checks the Node binary, not the Codex text script, to determine the correct architecture
- **Repair command fix:** Repair now uninstalls from the install-time Node and reinstalls under the runtime Node
- **PATH fix for spawning:** `buildSpawnEnv()` detects nvm paths and prepends the matching bin dir to PATH before spawning Codex, preventing native module errors
- **Semver-aware nvm sorting:** Version scanning uses semver sort (v22 > v9) instead of lexicographic

### Agent Selector

- **Reordered:** Claude > Codex > Ritemark Document Agent (was alphabetical)
- **Renamed:** "Ritemark Agent" is now "Ritemark Document Agent" for clarity

### Settings Page

- **Claude auth UX:** Added "Switch to Claude.ai sign-in" button for users currently using an API key
- **Manual refresh:** Added "Refresh Status" button for manual auth state refresh

### Code Quality

- **53 TypeScript errors fixed:** All pre-existing webview TypeScript errors resolved (18 unused imports/variables, 25 type mismatches, 10 other fixes)
- **Zero remaining type errors:** `tsc --noEmit` passes clean

### Analytics Events

- **Editor provider tracking:** `trackEvent` calls added to all editor providers (DOCX, Excel, PDF, Flows, Markdown) for `feature_used` events

---

## Freedom of Choice

Ritemark is intended to be a genuinely open platform for AI-assisted work. The goal is not to lock users into one model vendor, but to support freedom of choice and let people combine the best available tools.

- **Anthropic and OpenAI side by side:** Ritemark supports both Claude and Codex instead of forcing a single provider
- **Subscription flexibility:** Teams that already rely on ChatGPT subscriptions can now use Codex directly in Flows
- **Composable workflows:** Choose the agent that fits the task instead of shaping the task around one model family
- **Future-facing platform direction:** Gemini and other model ecosystems remain open as future additions

---

## User Impact

If you use Flows for repo automation or coding tasks, you can now model those steps visually with Codex instead of keeping them limited to the AI sidebar.

More importantly, this release removes the fragmented onboarding experience. Instead of encountering separate setup screens depending on which agent you pick, you see a single checklist that installs everything needed and lets you authenticate with both providers.

Typical use cases:

- Set up Claude and Codex from a single onboarding flow
- Generate or update project files from a prompt with Codex
- Chain Codex after Trigger inputs or earlier node outputs
- Mix Codex with Save File and other flow nodes in the same workflow
- Choose between Claude and Codex based on which model family is stronger for the job
- Run recurring flows every morning, every hour, or every few minutes without manual intervention
- Send fast product feedback from the editor toolbar while staying in context
- Continue composing AI chat messages while offline

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

Includes work across:

- `extensions/ritemark/src/flows/` — Codex node, scheduler runtime
- `extensions/ritemark/webview/src/components/flows/` — Codex node UI, schedule editor
- `extensions/ritemark/webview/src/components/ai-sidebar/` — OnboardingWizard, AgentSelector, store
- `extensions/ritemark/src/codex/` — codexManager nvm/path/arch fixes
- `extensions/ritemark/src/agent/` — installer, setup, types
- `extensions/ritemark/src/analytics/` — event tracking for all editor providers
- `extensions/ritemark/webview/src/components/settings/` — Claude auth UX

Key areas:

- backend flow execution wiring for `codex`
- execution panel support for Codex progress
- flow node type mapping and regression tests
- extension-host scheduler runtime for flow schedules
- workspace-scoped schedule runtime state and dedupe tracking
- flow-level schedule editor UI and save/remove UX
- unified onboarding wizard replacing fragmented per-agent setup
- codex CLI nvm path resolution, architecture detection, and repair
- editor-toolbar reactions command and PostHog-backed anonymous app analytics
- offline send guard for AI chat input
- 53 webview TypeScript error fixes

---

## Included Work

- `feat: unified onboarding wizard + Codex nvm repair (#24)`
- `feat: add Codex flow node for OpenAI Codex CLI integration`
- `flows: add scheduled flow run support`
- `feat: add PostHog-backed Ritemark reactions`
- `fix: prevent sending while offline, allow composing (#25)`
- `fix: prepend nvm bin dir to PATH when spawning codex`
- `fix: use plain @openai/codex in repair command, not platform tag`
- `chore: commit orphaned changes from previous sprints` (analytics tracking, build improvements)
