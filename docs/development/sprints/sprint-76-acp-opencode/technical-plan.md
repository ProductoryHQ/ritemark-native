# Sprint 76 Technical Plan — ACP Client + OpenCode BYOK Runtime

## Architecture Overview

```
webview (AI sidebar)                 extension host                      external process
┌──────────────────┐   bridge    ┌──────────────────────┐   stdio     ┌──────────────────┐
│ AgentSelector     │──────────▶│ UnifiedViewProvider   │            │                  │
│  'opencode:g/m'   │  acp-      │  case 'acp-execute'  │            │  opencode acp    │
│ Approval cards    │  execute   │        │             │  JSON-RPC  │  (bundled binary)│
│ Progress stream   │◀──────────│        ▼             │◀──────────▶│                  │
└──────────────────┘   progress  │  src/acp/AcpManager  │  via       │  user's BYOK     │
                                 │  src/acp/AcpClient   │  @agent-   │  keys in env     │
        Settings (BYOK keys) ───▶│  SecretStorage       │  client-   └──────────────────┘
                                 └──────────────────────┘  protocol/sdk
```

The integration mirrors `src/codex/` structurally. Reference LOC for effort calibration:
`codex/` is ~2,438 LOC total (codexManager 906, codexAppServer 470, codexProtocol 463,
codexAuth 163, approval/models/status/trace/index ~177, tests ~259). The ACP equivalent should be
**smaller** because `@agentclientprotocol/sdk` replaces the hand-written protocol layer
(codexProtocol.ts's 463 lines) and OpenCode has no OAuth flow (codexAuth.ts's 163 lines reduce to
env-var injection).

## Workstream 0: Audits (Phase 0 — before any implementation code)

Two audit documents under `research/`, per the audit-first rule:

### `research/acp-e2e-audit.md`
- Spawn the real OpenCode binary (`opencode acp`) on darwin-arm64; drive it with a minimal
  Node script using `@agentclientprotocol/sdk`.
- Verify: handshake, `session/new`, `session/prompt` with a Gemini key in env, streaming
  `session/update`, `fs/write_text_file` proxying, `session/request_permission`, cancellation.
- Verify model selection mechanism over ACP (session modes? env config? `opencode.json`?) —
  this resolves the R6 open mechanism.
- Decision recorded: **ship / fallback to HTTP server mode / defer**.

### `research/opencode-bundling-audit.md`
- Measure the darwin-arm64 binary size (compressed + on disk).
- Confirm MIT license file location for NOTICE bundling.
- Test codesigning + notarization of the Bun-compiled binary inside a signed app bundle
  (known risk: Bun binaries embed a runtime; Apple notarization may flag unsigned nested
  executables).
- Decision recorded for Q1: **bundle in DMG / download on first use**.

## Workstream 1: ACP client core (R1)

### Extension Host

New module `extensions/ritemark/src/acp/`:

| File | Responsibility | Pattern source |
| --- | --- | --- |
| `acpClient.ts` | Wraps `@agentclientprotocol/sdk` ClientSideConnection: spawn process, wire stdio streams, expose typed async API (`newSession`, `prompt`, `cancel`, `dispose`) | `codexAppServer.ts` |
| `acpManager.ts` | Session lifecycle, progress-event mapping (`session/update` → `AgentProgress`), error/exit handling, trace logging | `codexManager.ts` |
| `acpApproval.ts` | `session/request_permission` + `fs/write_text_file` gating; workspace-root path validation | `codexApproval.ts` |
| `acpFsProxy.ts` | `fs/read_text_file` / `fs/write_text_file` handlers backed by `vscode.workspace.fs` | new |
| `acpTrace.ts` | Output-channel tracing | `codexTrace.ts` |
| `index.ts` | Public exports | `codex/index.ts` |

Proposed progress mapping (final shape may adjust after Phase 0 audit):

```ts
// session/update notification → AgentProgress
agent_message_chunk   → { type: 'text', message: chunk.text }
agent_thought_chunk   → { type: 'thinking', message: chunk.text }
tool_call (pending)   → { type: 'tool_use', tool: call.title, file: call.locations?.[0]?.path }
tool_call (completed) → (no event — completion implied by next update)
plan                  → { type: 'plan_text', message: ... }
```

Dependency: add `@agentclientprotocol/sdk` to `extensions/ritemark/package.json`, **pinned exact
version** (pre-1.0 SDK).

### Tests
- `acpClient.test.ts` — handshake/prompt/cancel against a mock child process emitting scripted
  JSON-RPC (same technique as `codexManager.test.ts`).
- `acpApproval.test.ts` — approve/reject/auto-reject-outside-workspace paths.

## Workstream 2: OpenCode bundling & runtime discovery (R2)

### Extension Host
- `src/utils/bundledAgentRuntime.ts`: add `'opencode'` to `AgentRuntimeKind` (line 4); extend
  `executableNames()` (`opencode` / `opencode.exe`) and reuse `candidateRuntimePaths()` unchanged.
- `binaries/agents/manifest.json`: add three entries (darwin-arm64, darwin-x64, win32-x64):

```jsonc
{
  "agent": "opencode",
  "vendor": "sst",
  "version": "<pin at sprint start>",
  "platform": "darwin",
  "arch": "arm64",
  "sourceType": "github-release",
  "sourceUrl": "https://github.com/sst/opencode/releases/download/v<ver>/opencode-darwin-arm64.zip",
  "sha256": "<computed>",
  "installName": "opencode",
  "invocationMode": "acp",
  "validationArgs": ["--version"],
  "license": { "spdx": "MIT", "redistribution": "permitted", "noticeUrl": "https://github.com/sst/opencode/blob/dev/LICENSE" }
}
```

- `src/agent/types.ts`: `AgentId` gains `'opencode'`; `AGENTS` registry entry. Note:
  `AgentInfo.requiresApiKey` type (`'anthropic' | 'openai' | null`) gains `'byok'` to drive the
  R3 setup prompt.
- Fetch script: confirm it iterates manifest entries generically (expected — codex/claude entries
  are data-driven); if any codex-specific branch exists, generalize it.

### Webview Side
- `AgentSelector.tsx`: third agent group. Composite value prefix `opencode:` (lines 56–133
  pattern).

## Workstream 3: BYOK keys via Settings (R3)

### Extension Host
- Key storage: VS Code SecretStorage keys `ritemark.byok.gemini`, `ritemark.byok.openai`,
  `ritemark.byok.anthropic`, `ritemark.byok.openrouter` (reuse whatever helper Settings already
  uses for the Anthropic/OpenAI keys — confirm exact module during Phase 1).
- `acpManager.ts` builds the spawn env:

```ts
const env = {
  ...process.env,
  ...(geminiKey && { GEMINI_API_KEY: geminiKey, GOOGLE_GENERATIVE_AI_API_KEY: geminiKey }),
  ...(openaiKey && { OPENAI_API_KEY: openaiKey }),
  ...(anthropicKey && { ANTHROPIC_API_KEY: anthropicKey }),
  ...(openrouterKey && { OPENROUTER_API_KEY: openrouterKey }),
};
```

- Hard rule: keys never serialize into any webview message. The webview only learns *which
  providers are configured* (booleans), for the model dropdown (R6) and the setup prompt.

### Webview Side
- Settings page: new "Bring Your Own Keys" section (4 password fields + save/clear), built with
  the existing Settings components and `dialog.tsx` primitives — invoke `ux-expert` for layout
  before implementation.
- AI sidebar: "Set up your keys" empty-state card when OpenCode selected and no providers
  configured; button posts `open-settings-byok` message.

## Workstream 4: Approval gating + progress streaming (R4, R5)

### Extension Host
- `acpApproval.ts` validates every `fs/write_text_file`:
  1. Path inside workspace root (resolve symlinks, reject `..` traversal) — auto-reject otherwise.
  2. Session "always allow" check.
  3. Otherwise → post approval request to webview, await user response, send ACP outcome.
- `session/request_permission` (non-file permissions, e.g. terminal commands) routes through the
  same approval surface with the ACP-provided option set.

### Webview Side
- Reuse the existing Codex approval card component; it receives the same payload shape
  (`UnifiedViewProvider` normalizes ACP and Codex approvals to one webview message type — this is
  deliberate pre-alignment with TO BE #2 typed protocol).

### Dispatch wiring
- `UnifiedViewProvider.ts`: new cases `'acp-execute'`, `'acp-cancel'`, `'acp-approval-response'`
  alongside `'ai-execute-agent'` (line 326) and `'codex-execute'` (line 418).

## Workstream 5: Model selection (R6)

### Extension Host
- `src/ai/modelConfig.ts`: add `BYOK_PROVIDER_MODELS: Record<ByokProvider, ModelOption[]>` —
  curated default models per provider (Gemini 3 Pro/Flash, GPT-5.x, Claude 4.x, plus an
  OpenRouter free-form entry). This is the single source (CLAUDE.md rule); webview receives it
  via the existing `flow:modelConfig` message channel.
- Mechanism for telling OpenCode which model to use: resolved by Phase 0 audit
  (candidates: ACP session mode, `--model` flag at spawn, `OPENCODE_MODEL` env, or generated
  `opencode.json` in a temp config dir).

### Webview Side
- `AgentSelector.tsx`: OpenCode group lists models filtered by configured providers
  (booleans from R3). Composite value `opencode:<provider>/<model>`.

## Workstream 6: Feature flag (R7)

- `src/features/flags.ts`: add `'opencode-integration'` to `FlagId` (line 24) and `FLAGS`
  registry — `status: 'stable'` (spec Q3 resolution), `platforms: ['darwin', 'win32', 'linux']`.
- Gate points: agent registry exposure (host side), AgentSelector entry (webview), Settings BYOK
  section. Same gating call sites as `codex-integration` — grep for it and mirror.

## Build / Release Touchpoints

- `.claude/hooks/pre-commit-validator.sh` — confirm the webview bundle sentinel and extension TS
  compile checks pass with the new module; no hook changes expected.
- `package.json` dependency addition (`@agentclientprotocol/sdk`) — note for TO BE #1: this dep
  must be esbuild-bundleable (it is pure TS/JS; verify no dynamic requires).
- Production build: OpenCode binary joins the signing/notarization path → outcome of the
  bundling audit (Workstream 0) gates this.
- NOTICE/attribution: add OpenCode MIT license text to the third-party notices file.
