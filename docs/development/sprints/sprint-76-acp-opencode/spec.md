# Sprint 76 Spec — ACP Client + OpenCode BYOK Runtime

**Track:** SDD
**Branch:** `sprint-76-acp-opencode`
**Source research:** `docs/development/analysis/2026-06-01-third-agent-runtime-research.md` (issue #52)

## Purpose

Give Ritemark users a third agent runtime where they bring their own API keys — Gemini, OpenAI,
Anthropic, OpenRouter, or local models — instead of being limited to Claude/ChatGPT subscriptions.
Achieved by implementing one Agent Client Protocol (ACP) client and bundling OpenCode (MIT) as the
default ACP agent, making this the *last* runtime integration Ritemark ever needs to build.

## Principles

- **Protocol over product** — Ritemark integrates ACP, not OpenCode specifically. OpenCode is the
  bundled default; any ACP agent must work through the same client.
- **One key UI** — users configure provider keys in Ritemark Settings only. Ritemark passes keys
  to the agent at spawn. No second key-management surface (TO BE alignment: avoids key
  fragmentation).
- **Approval parity** — ACP agents get exactly the same file-edit approval gating as Claude Code
  and Codex. No silent writes, ever.
- **Existing patterns, not new ones** — follow the `codex/` integration shape (manager / protocol /
  approval / models / status events), the `binaries/agents/manifest.json` bundling pattern, and
  the `codex-integration` feature-flag pattern.

## Requirements

### R1: ACP client core

As a Ritemark developer, I want a reusable ACP client module that can spawn any ACP-compatible
agent binary and run a full agent session over JSON-RPC 2.0/stdio, so future runtimes plug in
without new protocol work.

Acceptance criteria:
- New module `extensions/ritemark/src/acp/` built on `@agentclientprotocol/sdk` (Apache-2.0, version pinned).
- Client implements: `initialize` (capability negotiation), `session/new`, `session/prompt`,
  `session/cancel`, and graceful process shutdown.
- Client handles agent-initiated requests: `fs/read_text_file`, `fs/write_text_file`,
  `session/request_permission`.
- Client receives `session/update` notifications and maps them to `AgentProgress` events
  (`src/agent/types.ts:73`).
- The agent binary path is a constructor parameter — nothing in `src/acp/` is OpenCode-specific.
- Unit tests cover: protocol handshake, prompt round-trip, permission request/response,
  process-exit handling (mock agent process, same approach as `codexManager.test.ts`).

### R2: OpenCode bundled as default ACP agent

As a user, I want OpenCode available in the AI sidebar's agent selector out of the box, so I can
use my own API keys without installing anything.

Acceptance criteria:
- `binaries/agents/manifest.json` gains OpenCode entries for `darwin-arm64`, `darwin-x64`,
  `win32-x64` with `sourceUrl`, `sha256`, version, and `license: { spdx: "MIT", redistribution: "permitted" }`.
- `AgentRuntimeKind` (`src/utils/bundledAgentRuntime.ts:4`) gains `'opencode'`;
  `executableNames()` and `candidateRuntimePaths()` resolve it (bundled-first, system-PATH fallback).
- `AgentId` (`src/agent/types.ts:11`) gains `'opencode'`; `AGENTS` registry gains an entry
  (label/description per UX review).
- The fetch script downloads, sha256-verifies, and installs the OpenCode binary like it does for
  codex-app-server.
- OpenCode appears in `AgentSelector.tsx` and is selectable.

### R3: BYOK key configuration through Ritemark Settings

As a user, I want to enter my provider API keys (Google Gemini, OpenAI, Anthropic, OpenRouter)
once in Ritemark Settings and have the OpenCode agent use them, so I never configure keys in two
places.

Acceptance criteria:
- Settings page gains a "Bring Your Own Keys" section with fields for at minimum: Google Gemini,
  OpenAI, Anthropic, OpenRouter. Keys stored via VS Code SecretStorage (same mechanism as existing
  API keys).
- At agent spawn, configured keys are injected as environment variables
  (`GEMINI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`,
  `OPENROUTER_API_KEY`) into the OpenCode process only — never written to disk, never sent to the webview.
- If no keys are configured and the user selects OpenCode, the sidebar shows a setup prompt that
  deep-links to the Settings BYOK section (no dead-end error).
- Keys configured in Ritemark are not required to also exist in `~/.config/opencode` — the env
  injection alone is sufficient for OpenCode to list and use those providers.

### R4: File-edit approval gating

As a user, I want every file change the OpenCode agent attempts to be approved by me first, so an
autonomous agent can never silently modify my documents.

Acceptance criteria:
- `fs/write_text_file` requests from the agent are intercepted; the write happens only after
  Ritemark-side approval (reuse the approval surface pattern from `codexApproval.ts`).
- `session/request_permission` requests render the same approval UI as Codex approvals in the
  AI sidebar.
- Rejection sends the corresponding ACP rejection outcome to the agent; the session continues
  (does not crash or hang).
- Writes outside the workspace root are rejected automatically with a visible notice (parity with
  existing runtime behaviour).
- An "always allow for this session" option matches the existing Codex approval semantics.

### R5: Streaming progress in the AI sidebar

As a user, I want to see OpenCode's activity streaming live (text, tool calls, file edits) exactly
like I do for Claude and Codex, so the experience is consistent across runtimes.

Acceptance criteria:
- `session/update` notifications (message chunks, thought chunks, tool-call updates) are mapped to
  existing `AgentProgressType` values — no new webview rendering components are required for the
  baseline experience.
- Tool calls show tool name and target file where available.
- Errors from the agent process (crash, non-zero exit, malformed JSON) surface as `error` progress
  events with actionable text, not silent failure.
- Cancellation from the sidebar sends `session/cancel` and the UI returns to idle within 2 seconds.

### R6: Model selection for the OpenCode runtime

As a user, I want to pick which provider/model OpenCode uses from the same model dropdown I use
today, so switching between e.g. Gemini 3 Pro and GPT-5.x is one click.

Acceptance criteria:
- `AgentSelector.tsx` composite values gain the `opencode:` prefix
  (pattern: `opencode:<provider>/<model>` — mirrors `claude-code:` / `codex:` at lines 56–133).
- The model list shown for OpenCode is derived from which BYOK keys the user has configured
  (only show Gemini models if a Gemini key exists, etc.).
- Curated default model list per provider lives in `src/ai/modelConfig.ts` (CLAUDE.md hard rule —
  no model IDs hardcoded elsewhere).
- Selected model is passed to the ACP session (via `session/new` `mcpServers`/mode params or
  OpenCode's model env/config — exact mechanism resolved in technical plan).

### R7: Feature flag and platform gating

As the product owner, I want the ACP/OpenCode runtime behind a feature flag that ships ON, so it
can be disabled per-platform or per-user without code changes if something goes wrong post-release.

Acceptance criteria:
- New `FlagId` `'opencode-integration'` in `src/features/flags.ts`, following the
  `codex-integration` pattern.
- Status `experimental` (matches Codex's introduction), platforms `['darwin', 'win32', 'linux']`,
  enabled by default (HARD RULE #2 — features ON by default).
- When the flag is off, OpenCode does not appear in the agent selector and the BYOK settings
  section is hidden.

## Non-Requirements

- **Goose as a second bundled agent** — deferred. The ACP client (R1) must be agent-agnostic so
  Goose can be added later by manifest entry + registry entry only.
- **Replacing Claude Code / Codex native integrations with ACP adapters** — explicitly out of
  scope. The existing integrations are richer; convergence is a future evaluation.
- **OpenCode HTTP server mode** (`opencode serve`) — ACP/stdio only this sprint. The HTTP path is
  the documented fallback if the ACP audit (Phase 0) fails.
- **"Point at any ACP agent binary" power-user setting** — stretch goal, not committed. The
  architecture must allow it (R1), the UI for it is not in scope.
- **Linux packaging** — runtime support lands (flag includes linux), but Ritemark doesn't ship
  Linux builds yet; no Linux binary in the manifest this sprint.
- **Session persistence/resume across Ritemark restarts for ACP sessions** — depends on agent
  capability over ACP; not committed this sprint.

## Resolved Questions

*(none yet — populated as decisions are made during the sprint)*

## Open Questions

| # | Question | Owner | Blocking |
| --- | --- | --- | --- |
| Q1 | **Bundle OpenCode in the DMG or download on first use?** OpenCode ships as a Bun-compiled self-contained binary — size and macOS notarization behaviour inside our signed DMG are unverified. Phase 0 audit measures both. Codex precedent = bundle; if the binary is very large (>80 MB) or breaks notarization, first-use download is the fallback. | Jarmo (after audit data) | R2 |
| Q2 | **UI label:** "OpenCode", "Open Agent (BYOK)", or "Bring Your Own Key"? Needs ux-expert input. | Jarmo | R2 (cosmetic) |
| Q3 | **Flag status `experimental` vs `stable` at launch?** Spec assumes `experimental` (Codex precedent). | Jarmo | No |
| Q4 | **Does TO BE #2 (typed webview↔host protocol) need to land first?** Research alignment said "ACP after typed protocol". Starting Sprint 76 now means the new `acp-execute` messages are added to the stringly-typed bridge and migrated later. Accept or re-sequence? | Jarmo | Sprint sequencing |
