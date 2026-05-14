# Sprint 69: AI Agent Browser Control

## Goal

Wire Ritemark's Claude Code SDK and Codex runtimes to a focused MVP subset of VS Code's existing Playwright browser action tools (navigate, click, fill/type, scroll, and post-action page-state readback), so the AI sidebar can autonomously control the integrated browser — not just read it.

## Feature Flag Check

- Does this sprint need a feature flag?
  - **Yes.** Browser control grants the AI agent write-level access to the browser — navigation, form submission, arbitrary code execution via `run_playwright_code`. This is materially more powerful than read-only access (Sprint 67) and should be gated so users can opt in with full awareness.
  - Flag ID: `browser-agent-control`
  - Default status: `experimental` (opt-in via Settings > Ritemark Features)
  - Platforms: `darwin` only for now (browser integration is macOS-only)
  - Consent gate inside the feature: separate `sharedWithAgentForControl` flag on `IBrowserViewModel`, requiring a stronger one-time-per-session consent prompt distinct from the existing `sharedWithAgent` (read) prompt.

## Success Criteria

- [ ] The AI sidebar can navigate, click, fill/type, scroll, and read updated page state in the active integrated browser tab.
- [ ] Each browser action returns updated page state (ARIA snapshot / summary) so the AI sees the result without needing a separate read call.
- [ ] A dedicated "browser control" consent prompt is shown once per session, separate from the read-only share consent.
- [ ] The `browser-agent-control` feature flag gates the entire capability; when disabled, tools are not registered.
- [ ] No regression to Sprint 67 read-only browser context (URL, title, summary, screenshot still work when control is disabled).
- [ ] A later Claude Code or Codex validation pass can prove the feature end-to-end in the dev app using documented setup steps, test pages, prompts, expected UI prompts, logs, and pass/fail evidence.
- [ ] Pre-commit hook passes; dev build works.

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| Patch 010: browser action bridge | New VS Code patch adding `BrowserViewCommandId` entries and Action2 commands for each browser action, callable from the extension host via `vscode.commands.executeCommand` |
| `BrowserActionTools.ts` | Extension-side wrappers that call the bridge commands, await the action, then call `getActiveSummary` and return an updated ARIA snapshot as the tool result |
| `sharedWithAgentForControl` consent | Add `sharedWithAgentForControl: boolean` + `setSharedWithAgentForControl()` to `IBrowserViewModel` in patch 010; add a dedicated workbench consent command; extend `BrowserContextStore` with control-consent logic |
| Tool registration in `UnifiedViewProvider.ts` | Register action tools for both Claude Code SDK and Codex execution paths; handle tool dispatch; return `tool_result` with updated page state |
| Feature flag `browser-agent-control` | Add to `flags.ts`; gate tool registration behind `isEnabled('browser-agent-control')` |

## Scope Triage Against Issue #67

Issue #67 is the broader feature vision. Sprint 69 should ship the smallest browser-control loop that proves the product value without taking on every existing VS Code browser tool at once.

**MVP / required for Sprint 69**
- Navigate to a URL in the visible active integrated browser tab.
- Click an element by ARIA ref or selector.
- Fill/type into inputs.
- Scroll enough to reach or observe target content.
- Return updated ARIA page state after every action.
- Keep all actions in the visible user-owned browser tab.
- Gate control behind `browser-agent-control` and a separate browser-control consent prompt.

**May include if cheap, but not Sprint 69 blockers**
- Back/forward/reload as subcommands of navigate.
- Screenshot as a control-visible result, preferably reusing the existing Sprint 67 read-side screenshot path.
- JavaScript dialog handling.
- Hover.
- Double-click/right-click as optional click parameters.

**Deferred from Sprint 69**
- Drag-and-drop.
- Raw `run_playwright_code` / evaluate as a general-purpose escape hatch.
- Basic file upload handling.
- Cross-origin iframe interaction.
- Autonomous multi-tab orchestration.
- Persistent session recording / replay.
- Coordinate/vision-first clicking. Use ARIA-first control for the MVP.

## Implementation Checklist

### Phase 0: Runtime protocol spike — required before implementation
- [x] Verify how Claude Code SDK can receive extension-defined browser tools:
  - whether `AgentSession` can pass custom tool definitions to the SDK;
  - whether browser `tool_use` blocks can be executed by extension code before the turn completes;
  - how `tool_result` is injected back into the same agent turn.
- [x] Verify how Codex App Server can receive extension-defined browser tools:
  - whether `turn/start` accepts tool definitions or requires another protocol path;
  - which event shape represents custom browser tool calls;
  - how the extension sends browser tool results back to Codex.
- [x] Record the implementation decision in this sprint plan before Phase 1:
  - native custom tools;
  - MCP/browser bridge;
  - prompt-mediated fallback;
  - Claude-only MVP with Codex deferred.
- [x] Update the implementation phases if the spike shows Claude and Codex need different approaches.

### Phase 1: VS Code patch — action bridge (Patch 010)
- [ ] Add new MVP `BrowserViewCommandId` entries in `src/vs/platform/browserView/common/browserView.ts`:
  - `ClickElement`, `FillElement`, `Navigate`, `Scroll`, `TypeInPage`
  - `EnsureActiveBrowserControlShared` — new consent command
- [ ] Add `sharedWithAgentForControl: boolean` + `onDidChangeSharedWithAgentForControl` event + `setSharedWithAgentForControl()` method to `IBrowserViewModel` and `BrowserViewModel` in `src/vs/workbench/contrib/browserView/common/browserView.ts`
  - Rule: control consent requires read consent; revoking read consent also revokes control consent
- [ ] Create `ritemarkBrowserActionFeature.ts` under `features/` with:
  - `EnsureActiveBrowserControlSharedAction` — consent prompt, stronger wording than read-only prompt; returns DTO with `sharedWithAgentForControl`
  - One Action2 per MVP tool (click, fill, navigate, scroll, type) that: checks `sharedWithAgentForControl`, calls `IPlaywrightService`, then calls `playwrightService.getSummary()` and returns `{ summary, error? }`
- [ ] Import `ritemarkBrowserActionFeature.js` in `browserView.contribution.ts`
- [ ] Generate patch 010 from the diff

### Phase 2: Feature flag
- [ ] Add `browser-agent-control` to `FlagId` union and `FLAGS` registry in `extensions/ritemark/src/features/flags.ts`
  - Status: `experimental`, platforms: `['darwin']`

### Phase 3: Extension — `BrowserActionTools.ts`
- [ ] Create `extensions/ritemark/src/browser/BrowserActionTools.ts`
- [ ] Define TypeScript interfaces for each tool's parameters (mirroring the JSON schema in the patch)
- [ ] Implement `callBrowserAction(command, params)` helper — calls the bridge command, returns `{ summary, error }`, calls `BrowserContextStore.instance.refreshMetadata()` to keep the read-side store in sync
- [ ] Export one function per MVP tool: `browserClick`, `browserFill`, `browserNavigate`, `browserScroll`, `browserType`
- [ ] Export `ensureBrowserControlConsent()` — calls `EnsureActiveBrowserControlShared` command, stores result in `BrowserContextStore`

### Phase 4: `BrowserContextStore.ts` extensions
- [ ] Add `sharedWithAgentForControl` to `BrowserContextSnapshot` interface
- [ ] Add `ensureControlConsentForActiveTab()` method (mirrors `ensureSharedForActiveTab()` but calls the new control consent command; separate per-session set)
- [ ] Expose `isControlConsented(): boolean` helper

### Phase 5: Tool wiring in `UnifiedViewProvider.ts`
- [ ] Add tool definitions array (JSON-schema style, compatible with both Claude Code SDK and Codex tool format):
  - `browser_click`, `browser_fill`, `browser_navigate`, `browser_scroll`, `browser_type`
  - Each tool description references the `pageId` from the active browser context snapshot
- [ ] Claude Code SDK path (`_handleAgentExecution`): pass tools array to `AgentSession.sendMessage()`; in the `onProgress` callback, detect `tool_use` blocks for browser tools, dispatch to `BrowserActionTools`, inject `tool_result` back into the message stream
- [ ] Codex path (`_handleCodexExecution`): pass tool definitions to `turnStart`; handle `tool_call` events in the Codex event loop, dispatch, inject response
- [ ] Both paths: gate tool registration behind `isEnabled('browser-agent-control')` and `BrowserContextStore.instance.isControlConsented()`
- [ ] Both paths: prepend `pageId` to tool descriptions from the active snapshot so the AI doesn't need to ask for it
- [ ] Auto-trigger control consent on first browser-control request if not yet consented

### Phase 6: Settings UI (lightweight — just surface the flag)
- [ ] Verify `browser-agent-control` flag appears in Settings > Ritemark Features (existing feature flags UI renders all flags automatically)

### Phase 7: Dev environment e2e validation handoff
- [ ] Document exact dev startup commands for the validator:
  - VS Code/Ritemark dev app launch command;
  - extension/webview build command if separate;
  - required feature flag state;
  - required auth/runtime state for Claude Code SDK and Codex.
- [ ] Add or document a deterministic local test page that covers:
  - navigation;
  - click;
  - fill/type;
  - scroll;
  - hover;
  - dialog handling;
  - screenshot/summary refresh;
  - a harmless `run_playwright_code` call.
- [ ] Provide validation prompts for both runtimes:
  - Claude prompt that should exercise at least navigate, fill, click, dialog, and summary readback;
  - Codex prompt with the same expected browser actions, or an explicit note if Codex is out of MVP scope.
- [ ] Define pass/fail evidence the validator must capture:
  - active browser URL/title before and after;
  - consent prompt behavior;
  - visible browser state after each action;
  - returned ARIA summary after each action;
  - AI sidebar transcript showing tool call and tool result;
  - relevant extension host / Codex / Claude trace log excerpts.
- [ ] Include negative e2e checks:
  - feature flag disabled -> browser control tools unavailable;
  - read consent declined -> no URL/title/summary reaches the runtime;
  - control consent declined -> read-only context still works but actions fail safely;
  - no active browser tab -> clear tool error;
  - `run_playwright_code` requires the intended stronger confirmation path.
- [ ] Run repository QA after the e2e pass:
  - `./scripts/validate-qa.sh`
  - targeted extension tests for browser context/action tooling
  - dev smoke with screenshots/logs attached to sprint notes

## Phase 0 Decision

### Claude Code SDK (`_handleAgentExecution` / `AgentSession`)

**Tool definitions:** The SDK does not accept a caller-supplied tool schema array. `AgentSession._startSession()` passes only `allowedTools` (a string array of tool _names_) and `canUseTool` (a callback that can allow/deny/modify per-tool call). There is no `tools: [...]` parameter for injecting custom JSON-schema definitions.

**`tool_use` block surfacing:** `tool_use` blocks arrive via the `message.type === 'assistant'` path in `_consumeLoop`. The content array is iterated in `processAssistantMessage()`; each block has `{ type: 'tool_use', name, id, input }`. These are surfaced as `AgentProgress` events (type `'tool_use'`) pushed to `onProgress`. There is no mid-turn hook to intercept a `tool_use` block, execute extension code, and return a `tool_result` before the SDK continues — the consumer loop is a `for await` that processes messages sequentially after they arrive; it does not pause waiting for a tool result from the extension side.

**`tool_result` injection:** The `_createMessageStream` generator yields user messages; the next `yield` is the follow-up user turn. There is no `tool_result` content block path in `buildUserMessage` — it only builds `user` role messages. The SDK's `canUseTool` callback is the only synchronous interception point, and its return value is `allow | deny` — not a tool result payload. Injecting a `tool_result` back into the same in-flight turn is not supported by the current wrapper.

**Conclusion:** Native extension-defined tool execution is not supported in the current Claude Code SDK wrapper. The SDK itself (`@anthropic-ai/claude-agent-sdk`) may support it at a lower level, but the `AgentSession` abstraction does not expose it.

### Codex path (`_handleCodexExecution` / `CodexAppServer`)

**Tool definitions:** `turnStart()` accepts `threadId`, `input`, `model`, and `collaborationMode`. The `TurnStartParams` protocol type has no `tools` field. The Codex app-server protocol (`codexProtocol.ts`) has no mechanism for the client to register custom tool schemas.

**Tool call event shape:** Codex tool use surfaces as `item/started` and `item/completed` notifications where `params.item.type` carries the tool name (e.g., `agentMessage`, `apply_patch`, `shell`). There is no custom-tool event shape — only the built-in Codex tools emit these events.

**Tool result injection:** Codex's bidirectional RPC is used only for built-in approval workflows: `sendApprovalResponse()` (accept/decline) and `sendToolRequestUserInputResponse()` (question answers). There is no mechanism to send a tool execution result for an extension-defined tool.

**Conclusion:** Codex app-server has no protocol support for extension-defined custom tools.

### Decision: (B) Claude-only MVP — prompt-mediated, with `canUseTool` dispatch

Neither runtime has native custom-tool injection at the protocol level in their current wrappers. However, for the Claude Code SDK there is a workable alternative: the `canUseTool` callback is called synchronously (with `await`) before the SDK processes each tool use. If we register browser action tool _names_ in `allowedTools` and define matching tool schemas in the system prompt (so Claude knows how to call them), the `canUseTool` callback receives `(toolName, input, { signal, toolUseID })` and can:

1. Execute the browser action (call the VS Code bridge command).
2. Return `{ behavior: 'allow', updatedInput: { ...input, _result: summary } }` — this injects the action result into the tool input that the SDK passes back to Claude as the tool result.

This is the same mechanism already used for `AskUserQuestion` and `ExitPlanMode`. It is synchronous-await compatible and does not require protocol changes.

For Codex: no equivalent hook exists. Codex MVP is deferred. The sprint plan already lists this as an acceptable path (option B).

**Implementation path for Phase 1+:**

- Register browser tool names (`browser_navigate`, `browser_click`, `browser_fill`, `browser_scroll`, `browser_type`) in `AgentSessionConfig.allowedTools` when `browser-agent-control` is enabled and control consent is active.
- Add tool schemas to the system prompt `append` so Claude knows the expected input shape for each tool.
- Handle each browser tool name in `_handleCanUseTool` (same pattern as `AskUserQuestion`): call the VS Code bridge command, await result, return `{ behavior: 'allow', updatedInput: { ...input, _result: summary } }`.
- The ARIA summary returned via `updatedInput._result` becomes the tool result Claude sees.
- This requires no changes to `AgentSession`'s public API — just additions to `allowedTools`, the system prompt, and the `canUseTool` dispatch block.
- Codex: no changes needed for MVP. Document as "Codex support deferred."

**Phase updates required:** Phase 5 (tool wiring in `UnifiedViewProvider.ts`) must be revised: there is no `sendMessage()` tools parameter, and no `onProgress` tool_use interception. Tool dispatch happens entirely inside `_handleCanUseTool`. The `UnifiedViewProvider` feeds `allowedTools` and system prompt via `AgentSessionConfig` at session creation time.

## Risks and Open Questions

| Risk | Mitigation |
|------|-----------|
| Tool dispatch in AgentSession mid-stream | Phase 0 must prove whether Claude Code SDK supports extension-defined tool execution in the current wrapper before any bridge code is built |
| Codex tool call event shape | Phase 0 must prove whether `CodexAppServer` supports custom tool definitions/results; if not, split Codex support out of the MVP |
| `playwrightService.getSummary()` latency | Called after every action; if the page hasn't settled, summary may be stale — add a short `waitForLoadState('domcontentloaded')` inside the bridge action before calling `getSummary` |
| Patch 010 size | Keep it surgically small; reuse `IPlaywrightService` and the existing Playwright action logic rather than duplicating it |
| Control consent UX | Must be clearly distinct from read consent to avoid user confusion; use a dedicated `confirmationMessages` object in the Action2 |
| E2E validation ambiguity | Phase 7 must leave exact dev startup, prompts, test page, logs, screenshots, and pass/fail expectations so Claude or Codex can validate without reconstructing intent |

## Status

**Track:** Runtime spike + full implementation + e2e validation handoff
**Current Phase:** 0 (runtime protocol spike / plan hardening)
**Approval Required:** Yes

## Approval

- [ ] Jarmo approved this sprint plan
