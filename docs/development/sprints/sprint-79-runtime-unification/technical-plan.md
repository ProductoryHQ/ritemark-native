# Sprint 79 Technical Plan — Runtime Unification

## Architecture Diagram (Target State)

```
Webview (AI sidebar)                Extension Host                    External processes
┌───────────────────┐  agent-        ┌───────────────────────────┐
│ AgentSelector      │  execute       │ UnifiedViewProvider        │
│ ApprovalCard       │──────────────▶│   (≤1100 LOC post-sprint) │
│ ProgressStream     │  agent-approve │   ↓                        │
│                    │◀──────────────│ RuntimeRegistry             │
│ [unified msgs]     │  agent-approve │   ↓ get(agentId)           │
└───────────────────┘  -request      │ AgentRuntime (interface)   │
                                     │   ├─ ClaudeCodeRuntime ────▶ claude binary (SDK)
                                     │   ├─ CodexRuntime ─────────▶ codex-app-server (stdio)
                                     │   └─ AcpRuntime ───────────▶ opencode acp (stdio)
                                     │                              │
                                     │ UnifiedApprovalGate         │
                                     │   └─ one Promise per req    │
                                     │                              │
                                     │ BrowserToolsInjector        │
                                     │   └─ mcpServers → all runtimes
                                     │                              │
                                     │ AgentDaemon (inactive)      │
                                     │   └─ uses RuntimeRegistry   │
                                     └───────────────────────────┘
```

## Phase 0: Audits (before any code — Phase 3 starts only after Q1+Q2 answered)

### `research/acp-browser-audit.md`
- Spawn `opencode acp` and send an `initialize` request with an MCP server entry.
- Verify: does OpenCode expose injected MCP tools to the agent? What's the field name in `initialize`?
- Decision: **use MCP injection** / **fallback: inject browser context as system prompt only** / **defer browser support for ACP**.

### `research/codex-mcp-injection-audit.md`
- Read `codexAppServer.ts` initialize flow and Codex protocol docs.
- Determine: can we pass an MCP server list at session start (replacing the dynamic tool injection in `codexBrowserTools.ts`)?
- Decision: **replace with MCP** / **keep dynamic injection but move into CodexRuntime adapter** / **two-step: keep dynamic, MCP in follow-up sprint**.

### `research/arch-1-esbuild-audit.md`
- Run a production build with `@agentclientprotocol/sdk` included.
- Check for `dynamic require` warnings in the Gulp/esbuild output.
- Decision: **no issue** / **needs bundler config fix** / **needs SDK version pin change**.
- If work is needed: record the required fix as **ARCH-8** in `docs/development/architecture.md` (extension host esbuild bundling) and add to Sprint 80 planning. The full esbuild bundling win (ARCH-8) is out of Sprint 79 scope regardless of this audit outcome — the audit only validates that `@agentclientprotocol/sdk` will not block the future bundling sprint.

## Workstream 1: `src/runtime/` — Interface + Registry (R1)

### Files

| File | Content |
|---|---|
| `src/runtime/AgentRuntime.ts` | Interface + all shared types (`RuntimeSessionConfig`, `RuntimeTurnConfig`, `RuntimeStatus`, `UnifiedAttachment`) |
| `src/runtime/RuntimeRegistry.ts` | `class RuntimeRegistry { get(id): AgentRuntime; getAll(): AgentRuntime[]; dispose(): void }` |
| `src/runtime/UnifiedApprovalGate.ts` | `class UnifiedApprovalGate { request(params): Promise<ApprovalResult>; respond(requestId, result): void }` — holds pending Map, wired to webview by `UnifiedViewProvider` |
| `src/runtime/BrowserToolsInjector.ts` | `getServers(enabled: boolean): MCP servers config` — wraps `createBrowserMcpServer` from `src/browser/` |
| `src/runtime/index.ts` | Public exports |

### `AgentRuntime` interface (full)

```typescript
export interface AgentRuntime {
  readonly id: AgentId;

  /** Initialize the runtime. Called once per workspace session. */
  start(config: RuntimeSessionConfig): Promise<void>;

  /** Send a prompt turn. Streams progress via config.onProgress. */
  prompt(turn: RuntimeTurnConfig): Promise<void>;

  /** Cancel the current turn. Must resolve within 3 seconds. */
  cancel(): Promise<void>;

  /** Handle an approval response from the webview. */
  respondToApproval(requestId: string, approved: boolean, alwaysAllow: boolean): void;

  /** Runtime-specific status (auth, binary, version). */
  getStatus(): Promise<RuntimeStatus>;

  /** Clean up process handles and event listeners. */
  dispose(): void;
}

export interface RuntimeSessionConfig {
  workspacePath: string;
  model?: string;
  excludedFolders?: string[];
  extraSystemPrompt?: string;
  mcpServers?: Record<string, unknown>;
  onProgress: (p: AgentProgress) => void;
  onApprovalRequest: (req: UnifiedApprovalRequest) => void;
}

export interface RuntimeTurnConfig {
  prompt: string;
  attachments?: UnifiedAttachment[];
  activeFile?: ActiveFileContext;
  timeoutMinutes?: number;
}

export interface UnifiedAttachment {
  id: string;
  kind: 'image' | 'pdf' | 'text';
  name: string;
  data: string;       // base64 for image/pdf; raw text for text
  mediaType: string;
}

export interface UnifiedApprovalRequest {
  requestId: string;
  agentId: AgentId;
  kind: 'file-write' | 'shell-command' | 'permission' | 'plan';
  // kind-specific optional fields:
  filePath?: string;       // file-write
  diff?: string;           // file-write
  command?: string;        // shell-command
  workingDir?: string;     // shell-command
  permissionLabel?: string; // permission
  planText?: string;       // plan
}

export interface RuntimeStatus {
  ready: boolean;
  authState: 'authenticated' | 'needs-auth' | 'not-installed' | 'error';
  version?: string;
  diagnostics: string[];
}
```

### Adapter implementation notes

**`ClaudeCodeRuntime`** (`src/agent/ClaudeCodeRuntime.ts`):
- `start()` → creates `AgentSession` from existing `AgentRunner`
- `prompt()` → calls `session.prompt(turn)`, maps SDK events to `AgentProgress` (existing logic from `_handleAgentExecution`)
- `cancel()` → `session.interrupt()`
- `respondToApproval()` → `_handleAgentPlanAnswer()` / `_handleAgentQuestionAnswer()` (existing)
- MCP servers → `AgentSessionConfig.mcpServers` (no change needed)

**`CodexRuntime`** (`src/codex/CodexRuntime.ts`):
- `start()` → initializes `CodexManager` (existing)
- `prompt()` → `codexManager.execute(...)`, maps Codex events to `AgentProgress` (from `_handleCodexExecution`)
- `cancel()` → `codexManager.cancel()`
- `respondToApproval()` → routes to `codexManager.approveRequest(...)` or `rejectRequest(...)`
- Browser: Phase 0 audit determines if MCP injection replaces `codexBrowserTools.ts`

**`AcpRuntime`** (`src/acp/AcpRuntime.ts`):
- `start()` → `acpManager.start()`
- `prompt()` → `acpManager.prompt(...)`, maps `session/update` to `AgentProgress` (existing)
- `cancel()` → `acpManager.cancel()`
- `respondToApproval()` → routes to `acpManager.respondPermission(...)` or `respondFsWrite(...)`
- Browser: MCP server list passed in ACP `initialize` (pending Phase 0 audit)

## Workstream 2: Unified Approval Gate (R3)

### Approval flow (new)

```
Runtime adapter receives native approval request
  → calls config.onApprovalRequest(UnifiedApprovalRequest)
  → UnifiedViewProvider receives it
  → sends { type: 'agent-approval-request', ...request } to webview
  → webview renders ApprovalCard
  → user clicks Approve/Reject
  → webview sends { type: 'agent-approve', requestId, approved, alwaysAllow }
  → UnifiedViewProvider calls runtime.respondToApproval(requestId, approved, alwaysAllow)
  → runtime adapter resolves native Promise and continues
```

### Webview changes (R2 + R3 combined)

Old messages (deleted):
- `ai-execute-agent`, `codex-execute`, `acp-execute` → replaced by `agent-execute { agentId, prompt, model, attachments }`
- `ai-cancel-agent`, `codex-cancel`, `acp-cancel` → `agent-cancel { agentId }`
- `codex-approve`, `acp-approval-response`, `agent-answer-plan` → `agent-approve { agentId, requestId, approved, alwaysAllow, kind }`

New messages (extension → webview):
- `agent-approval-request { agentId, requestId, kind, ...payload }`
- `agent-progress { agentId, progress }` (unifies existing per-runtime progress posts)

`ApprovalCard.tsx` (new unified component):
- Receives `kind` prop — renders appropriate content for file-write / shell-command / permission / plan
- Replaces: `PlanApprovalCard.tsx`, `CodexApprovalCard.tsx`, `AcpApprovalCard.tsx` (if it exists separately)

## Workstream 3: Browser Tool Injection (R4)

Dependent on Phase 0 audits. Two paths:

**Path A (preferred if audits confirm MCP injection works for both):**
- `BrowserToolsInjector.getServers()` returns MCP server config
- All three runtime adapters call it in `start()` and pass to their native session config
- `codexBrowserTools.ts` deleted
- `UnifiedViewProvider._codexBrowserToolsEnabledForThread` state deleted

**Path B (fallback if Codex MCP injection is blocked):**
- `BrowserToolsInjector` has two modes: `mode: 'mcp'` (Claude Code, ACP) and `mode: 'dynamic-tools'` (Codex fallback)
- `codexBrowserTools.ts` is kept but wrapped inside `CodexRuntime`, no longer directly in `UnifiedViewProvider`
- `_codexBrowserToolsEnabledForThread` moves from `UnifiedViewProvider` to `CodexRuntime`
- Record Path B as ARCH-8 debt in `architecture.md` for resolution in a future sprint

Decision captured in `research/codex-mcp-injection-audit.md`.

## Workstream 4: File Attachments (R5)

### Codex attachment handling in `CodexRuntime.prompt()`:

```typescript
function prepareCodexPrompt(prompt: string, attachments: UnifiedAttachment[]): string {
  const blocks = attachments
    .filter(a => a.kind !== 'image') // images handled as data URLs below
    .map(a => `**Attachment: ${a.name}**\n\`\`\`\n${a.data}\n\`\`\``);
  return blocks.length ? `${blocks.join('\n\n')}\n\n${prompt}` : prompt;
}

function toDataUrl(a: UnifiedAttachment): string {
  return `data:${a.mediaType};base64,${a.data}`;
}
```

### ACP attachment handling in `AcpRuntime.prompt()`:
- Check if selected provider supports multimodal (lookup `BYOK_PROVIDER_MODELS[provider].supportsMultimodal`).
- If yes: pass images as inline base64 in the ACP prompt content array (OpenCode BYOK models that support images accept the Anthropic/OpenAI multimodal format — verify during Phase 0).
- If no: downgrade to fenced block (same as Codex), emit `{ type: 'text', message: 'Note: image attached as text (provider does not support multimodal)' }`.

## Workstream 5: Model Config Consolidation (R6)

Changes in `src/ai/modelConfig.ts`:
- Add `CLAUDE_MODELS: ModelOption[]` (copied from `agent/types.ts`)
- Add `DEFAULT_MODEL: string` (copied from `agent/types.ts`)
- Existing: `OPENAI_LLM_MODELS`, `BYOK_PROVIDER_MODELS` (already here)

Changes in `src/agent/types.ts`:
- Remove `CLAUDE_MODELS`, `DEFAULT_MODEL` (replaced by re-exports from modelConfig.ts or direct import)
- Remove `CODEX_MODELS` entirely (deprecated, no live callers after migration)
- Keep all interface and type definitions unchanged

Run `grep -rn "CLAUDE_MODELS\|DEFAULT_MODEL\|CODEX_MODELS" src/` before starting — migrate all imports.

## Workstream 6: Daemon Foundation (R8)

```
src/daemon/
├── AgentDaemon.ts          cron registration, scheduling, fire
├── DaemonSession.ts        headless RuntimeTurnConfig execution + auto-approval policy
├── DaemonResultStore.ts    workspaceState persistence
└── DaemonStatusEvents.ts   VS Code notification + output channel trace
```

`AgentDaemon` is **registered but not activated** in `extension.ts`. The wiring to `schedule:` frontmatter and the Agent Library UI is Sprint 80's job.

Dependencies:
- `cron-parser` (already installed via Sprint 77, check version — use v4 API if v4 is what's installed)
- No new npm packages expected

## Workstream 7: Cleanup + Docs (R7, R9)

Deletions:
- `src/codex/codexApproval.ts` (logic absorbed into `CodexRuntime`)
- `codexBrowserTools.ts` (if Path A confirmed)
- `CODEX_MODELS` from `types.ts`

Modifications:
- `flags.ts`: `document-search` status → `'disabled'`
- `docs/development/architecture.md`: update AS IS → post-sprint state; close ARCH-2,3,4,5 (or 6 if Path B); add Version History entry
- `CLAUDE.md`: model config section (already updated pre-sprint)

## Implementation Order

```
Phase 0: Audits (W0) — gate for W3 browser injection path
  ↓
W1: src/runtime/ — interface + registry + approval gate (no behavior change yet)
  ↓
W6: AgentDaemon foundation (depends on W1 interface only)
  ↓
W4: Adapter wrappers (ClaudeCodeRuntime, CodexRuntime, AcpRuntime) — start() and prompt() only
  ↓
W2: Replace UnifiedViewProvider dispatch — switch to registry.get(agentId).prompt(...)
    (runtime-specific handlers deleted; approval gate wired)
  ↓
W3: Browser injection (Path A or B per audits)
  ↓
W5: File attachments (R5) — UnifiedAttachment plumbed through
  ↓
W7: Cleanup + architecture doc update
```

## Test Strategy

- **Unit:** `RuntimeRegistry.test.ts`, `UnifiedApprovalGate.test.ts`, `AgentDaemon.test.ts`, `BrowserToolsInjector.test.ts`
- **Adapter unit:** `ClaudeCodeRuntime.test.ts`, `CodexRuntime.test.ts`, `AcpRuntime.test.ts` — mock the underlying manager, verify `AgentRuntime` contract
- **Integration (manual):** Run all three runtimes in dev mode, send a prompt, attach a file, trigger an approval, cancel mid-run. Verify no regression from v1.7.3 behavior.
- **Browser integration:** Claude Code + browser action; Codex + browser action (regression test post-`codexBrowserTools.ts` removal or migration)

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Codex MCP injection blocked (Path B needed) | Medium | Low — Path B is well-defined | Audit first; Path B adds 0 LOC to W3 scope |
| ACP browser support not achievable this sprint | Medium | Low — ACP browser not shipped yet | Stub `AcpRuntime` browser as "unsupported" with a note in ARCH-8 |
| Webview message rename breaks conversation history for in-progress sessions | Low | Low — history is by agentId not message type | Session reset on upgrade acceptable |
| `cron-parser` v4 vs v5 API break in daemon | Low | Low — Sprint 77 already pinned a version | Check installed version before using |
