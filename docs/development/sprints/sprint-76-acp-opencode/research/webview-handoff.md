# Sprint 76 — Webview Implementation Handoff (Mac Session)

**Date:** 2026-06-01
**For:** local Claude Code session on Jarmo's Mac (this work CANNOT be done in the remote Linux
environment — webview deps are darwin-pinned, and the pre-commit hook requires a fresh webview
bundle after source changes).

## Setup

```bash
git fetch origin sprint-76-acp-opencode && git checkout sprint-76-acp-opencode
cd extensions/ritemark/webview && npm install   # works on darwin
```

All host-side work is DONE and committed (Phases 1–6 host portions). The host's message
contracts below are implemented and tested — the webview just needs to speak them.

## Remaining work (the `[WEBVIEW — Mac session]` items in tasks.md)

### 1. Settings page (`webview/src/components/settings/RitemarkSettings.tsx`) — R3a

Design contract: `research/prototypes/settings.html` (S1–S5) + `research/ux-design-spec.md` revision section.

- Update "Used for:" copy on the three existing key cards (flag-gated wording — `opencodeEnabled`
  arrives in the settings data):
  - OpenAI: `AI Chat, Flows (LLM), Image Generation (GPT Image 1.5), OpenCode (GPT models)`
  - Google AI: `Gemini models in OpenCode, Flows`
  - Anthropic: `Claude in Ritemark (alternative to signing in with Claude.ai), OpenCode (Claude models)`
- **Remove "Imagen 3 (coming soon)"** from the Google AI card unconditionally (NOT flag-gated).
- Add the **OpenRouter API Key card** (optional) after Anthropic, rendered only when
  `settings.data.openrouterEnabled` is true. Bind to the existing `setApiKey`/`testApiKey`
  message handlers with `key: 'openrouter-api-key'`; configured status from
  `openrouterKeyConfigured`; test result arrives with `key: 'openrouter'`. Card anatomy identical
  to existing key cards (placeholder `sk-or-...`, "Get an OpenRouter key" → https://openrouter.ai/keys).

### 2. AgentSelector (`webview/src/components/ai-sidebar/AgentSelector.tsx`) — R6

Design contract: `research/prototypes/model-picker.html` (A1–A6, approved by Jarmo).

- Add OpenCode `<SelectGroup>` **after Codex**. Two-line rows: model label + provider name as
  description. Composite value format: `opencode:<provider>/<model>`.
- Model list source: `byokProviderModels` + `acpProviders` booleans from the `agent:config`
  message (or post `acp-get-providers`; reply type `acp-providers`).
- Filter: only show models for providers whose boolean is true.
- No keys at all → show the non-selectable "Add API keys to use OpenCode → Open Settings" row (A2).
- Trigger label: `OpenCode · <Model Label>`; stale state (provider removed): `OpenCode · Select a model…` muted (A6).
- No Edit/Plan mode rail for OpenCode (A3).
- When the `opencode-integration` flag is off (`opencodeEnabled` false / `opencode` absent from
  the agents list in `agent:config`), the group does not render at all (R7).

### 3. Sidebar execution wiring — R4/R5

- **Execute:** post `acp-execute` with `{ prompt, model: '<provider>/<model>' }` (strip the
  `opencode:` prefix — host expects bare `provider/model`).
- **Progress:** arrives as the existing `codex-progress` / `codex-streaming` / `codex-result`
  messages — the existing sidebar rendering works unchanged. `codex-result` `{ status: 'cancelled' }`
  after cancel.
- **Cancel:** post `acp-cancel`. Host kills the process; idle within ~2s.
- **Approvals:** arrive as the existing `codex-approval` payload (same card renders). BUT: when the
  approval's `requestId` starts with `acp-`, post the response as `acp-approval-response`
  `{ requestId, approved, alwaysAllow }` instead of the codex response message.
- **Zero-key state (A4):** when OpenCode selected and all four `acpProviders` booleans are false,
  show the "Set up your API keys" card (CodexSetupView pattern) deep-linking to Settings.

### 4. Verification (scenarios.md is the QA matrix)

- Rebuild the webview bundle (`npm run build` in webview/) — pre-commit hook checks freshness +
  `ai-sidebar` sentinel + size.
- Run the R3a/R6/R7 scenarios from `scenarios.md`, plus end-to-end dev-mode verification:
  text streaming, tool_use display, error surfacing, cancel ≤ 2s, approval approve/reject paths.
- The fetch script must be run once on the Mac to install the OpenCode binary:
  `./scripts/fetch-agent-runtimes.sh --agent opencode` (validates file arch + `--version` smoke test
  — the validations that couldn't run on Linux).

## Host message contract summary (already implemented + tested)

| Direction | Type | Payload |
| --- | --- | --- |
| webview → host | `acp-execute` | `{ prompt: string, model: 'provider/model-id' }` |
| webview → host | `acp-cancel` | `{}` |
| webview → host | `acp-approval-response` | `{ requestId, approved: boolean, alwaysAllow?: boolean }` |
| webview → host | `acp-get-providers` | `{}` |
| host → webview | `acp-providers` | `{ enabled: boolean, providers: { google, openai, anthropic, openrouter } }` |
| host → webview | `codex-progress` / `codex-streaming` / `codex-result` | (existing shapes, reused) |
| host → webview | `codex-approval` | (existing shape; ACP ones have `requestId` starting `acp-`) |
| host → webview | `agent:config` | now includes `opencodeEnabled`, `acpProviders`, `byokProviderModels` |

## Hard rules that still apply

- Settings/selector implementation must match the approved prototypes (spec R3a/R6 design contract)
- Keys NEVER appear in webview messages (host enforces this; don't request them)
- Pre-commit hook must pass (webview bundle freshness — rebuild after source changes)
- qa-validator review before the sprint-end commit (Phase 7)
