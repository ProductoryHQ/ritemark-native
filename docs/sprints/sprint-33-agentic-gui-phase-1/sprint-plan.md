# Sprint 33: Agentic GUI - Phase 1

## Goal

Make the AI assistant agentic: users can ask the assistant to perform multi-step file operations (read, write, search, organize) through a friendly GUI -- no terminal required. Phase 1 focuses on extending the existing Claude Agent SDK integration from Flows into the main AI sidebar.

## Feature Flag Check

- [x] Does this sprint need a feature flag?
  - ✅ **Experimental feature** (agent autonomy is new, potentially risky)
  - ✅ **Large UI change** (new mode selector, activity feed, major UX shift)
  - ✅ **Needs kill-switch** (file modification risks require emergency disable)
  - ❌ NOT platform-specific (works on darwin, win32, linux)
  - ❌ NOT premium (uses user's own API key)

**Flag Definition:**

| Property | Value |
|----------|-------|
| ID | `agentic-assistant` |
| Name | Agentic AI Assistant |
| Description | Enable autonomous agent mode with file modifications |
| Status | `experimental` (opt-in, default OFF) |
| Platforms | darwin, win32, linux |
| Setting | `ritemark.experimental.agenticAssistant` |

**Lifecycle:**
- Sprint 33-35: Experimental (opt-in only, gather feedback)
- Sprint 36+: Promote to stable (default ON after battle-testing)
- Future: Remove flag (permanent feature)

## Success Criteria

- [x] AgentRunner service successfully extracted from ClaudeCodeNodeExecutor
- [ ] Flows continue to work (no regression) — needs verification
- [x] Unified AI View has agent selector dropdown (Ritemark Agent / Claude Code)
- [x] Agent selection persists across sessions (stored in VS Code settings)
- [x] Activity feed shows structured cards when Claude Code agent is selected
- [x] Excluded folders setting allows users to restrict agent access
- [ ] Research tool integrates RAG with agent — DEFERRED to Phase 2
- [x] Feature flag properly gates Claude Code agent option
- [x] Users can enable feature via Settings UI
- [ ] Setup wizard detects missing Claude Code and guides user through installation
- [ ] All changes work in both dev and production builds — dev verified, prod pending

## Deliverables

| Deliverable | Status | Description |
|-------------|--------|-------------|
| AgentRunner service | ✅ Done | Reusable agent service with persistent sessions, streaming input, multi-turn conversations (`src/agent/AgentRunner.ts`) |
| Agent + Model selector | ✅ Done | Merged dropdown: Ritemark Agent / Claude Code (Sonnet·Opus·Haiku). Persisted in `ritemark.ai.selectedAgent` + `selectedModel`. |
| Activity feed UI | ✅ Done | Structured cards with icons, timestamps, file tracking, expand/collapse details, rendered markdown responses |
| Multi-turn sessions | ✅ Done | Persistent process with message queue (~2-3s follow-ups). Turn tracking + interrupt support. |
| Image paste | ✅ Done | Cmd+V screenshots into Claude Code chat, thumbnails, sent as base64 ImageBlockParam |
| Clickable file paths | ✅ Done | Code elements with `/` in agent responses open files on click |
| Active file context | ✅ Done | Agent sees focused file via TabGroups API (works with custom editors) |
| Excluded folders | ✅ Done | `ritemark.ai.excludedFolders` setting restricts agent access |
| Feature flag | ✅ Done | `agentic-assistant` flag with Settings UI integration |
| Setup wizard | Planned | Auto-detect + install Claude Code CLI, browser-based login. No Node.js needed. |
| Research tool | Deferred | RAG integration for agent — moved to Phase 2 |
| Folder permissions UI | Deferred | Visual folder picker — using settings for now |

## Implementation Checklist

### Phase 1: Research ✓ COMPLETED

- [x] Analyze existing ClaudeCodeNodeExecutor implementation
- [x] Analyze UnifiedViewProvider architecture
- [x] Document reusable patterns and gaps
- [x] Design AgentRunner extraction strategy
- [x] Design UX for three-mode selector and activity feed
- [x] Design writing-specific tools (Research tool for Phase 1)
- [x] Evaluate feature flag requirements (YES - experimental)
- [x] Document folder permission model
- [x] Create research documents in `research/`

### Phase 2: AgentRunner Extraction ✓ COMPLETED

- [x] Create `src/agent/` directory structure
- [x] Create `src/agent/types.ts` with shared interfaces
- [x] Create `src/agent/AgentRunner.ts` core service
- [x] Extract SDK import logic from ClaudeCodeNodeExecutor
- [x] Extract event stream parsing
- [x] Extract file modification tracking
- [x] Extract cost/duration tracking
- [x] Add folder permission validation (excluded folders)
- [ ] Unit tests for AgentRunner (mock SDK calls)
- [ ] Refactor ClaudeCodeNodeExecutor to use AgentRunner
- [ ] Verify Flows still work (regression test)

### Phase 3: Feature Flag Setup ✓ COMPLETED

- [x] Add `agentic-assistant` flag to `src/features/flags.ts`
- [x] Add setting to `package.json` (`ritemark.experimental.agenticAssistant`)
- [x] Update `src/features/settings.ts` to sync flag state
- [x] Test flag evaluation logic (ON/OFF states)
- [x] Send feature state to webview on initialization

### Phase 4: Unified View Backend Integration ✓ COMPLETED

- [x] Update UnifiedViewProvider to accept AgentRunner instance
- [x] Add `ai-execute-agent` message handler
- [x] Implement `_handleAgentExecution()` method
- [x] Stream progress events to webview (`agent-progress`)
- [x] Send result to webview (`agent-result`)
- [x] Add folder permission validation before execution
- [x] Gate agent messages with feature flag check
- [x] Handle abort/cancel for agent execution

### Phase 5: Webview UI - Agent Selector ✓ COMPLETED

- [x] Update webview types to include agent selection
- [x] Create `AgentSelector.tsx` component — merged dropdown with model sub-options
- [x] Add state management for selected agent (persisted via VS Code settings)
- [x] Claude Code option visible when feature flag is ON, hidden when OFF
- [x] Send agent selection change to extension (`ai-select-agent` message)
- [x] Style dropdown (VS Code theme integration, Radix UI Select)
- [x] Load persisted selection on webview init

### Phase 5b: Model Selector ✓ COMPLETED (added during development)

- [x] Merged agent + model dropdown (Option C from UX discussion)
- [x] Claude Code shows model sub-options: Sonnet, Opus, Haiku
- [x] Trigger displays "Claude Code · Sonnet" format
- [x] Model selection persists to `ritemark.ai.selectedModel` setting
- [x] Model change recreates AgentSession with new model
- [x] `CLAUDE_MODELS` and `DEFAULT_MODEL` defined in `src/agent/types.ts`

### Phase 6: Webview UI - Activity Feed ✓ COMPLETED

- [x] Create `AgentView.tsx` (conversation + activity feed)
- [x] Create `ActivityCard.tsx` for progress events (init, thinking, tool_use, text, done, error)
- [x] Create `ActivityDetails.tsx` for expand/collapse card details
- [x] Create `AgentResponse.tsx` for agent results with rendered markdown
- [x] Create `RunningIndicator.tsx` for agent-running animation
- [x] Create `FilesSummary.tsx` for modified files list
- [x] Icons from lucide-react (Wrench, FileCode, etc.)
- [x] Expand/collapse for card details
- [x] Timestamp display (relative time)
- [x] Style cards with VS Code theme colors
- [x] Agent view replaces chat view when Claude Code selected

### Phase 6b: Multi-Turn Conversations ✓ COMPLETED (added during development)

- [x] Persistent AgentSession with streaming input + message queue pattern
- [x] Process stays warm across turns (~2-3s follow-ups vs ~8s with resume pattern)
- [x] AsyncGenerator yields user messages on demand via unbounded async channel
- [x] Turn tracking prevents stale results after interrupt
- [x] `interrupt()` sends SDK interrupt + force-resolves current turn
- [x] `close()` kills process, resets all state, unblocks pending dequeue

### Phase 6c: Image Paste Support ✓ COMPLETED (added during development)

- [x] Cmd+V pastes screenshots into chat input (Claude Code mode only)
- [x] Thumbnail strip with X-to-remove buttons
- [x] Images sent as base64 to AgentRunner → SDK ImageBlockParam
- [x] Image thumbnails displayed in conversation history
- [x] Send button stays as arrow icon regardless of attached images

### Phase 6d: Clickable File Paths ✓ COMPLETED (added during development)

- [x] `RenderedMarkdown.tsx` intercepts clicks on `<code>` elements containing `/`
- [x] Posts `open-source` message to extension → opens file in editor
- [x] Cursor pointer + hover styling on path-like code elements

### Phase 6e: Active File Context ✓ COMPLETED (added during development)

- [x] Agent receives currently focused file path + selection as context
- [x] Uses `vscode.window.tabGroups` API (works for custom editors like Ritemark)
- [x] Falls back to `activeTextEditor` for standard text files

### Phase 7: Webview UI - Folder Selector — DEFERRED

Replaced with simpler `excludedFolders` setting (workspace-scoped permissions).
- [x] `ritemark.ai.excludedFolders` setting in `package.json`
- [x] Excluded folders passed to AgentSession on creation
- [ ] UI for managing excluded folders (currently settings-only)

### Phase 8: Research Tool Integration — DEFERRED to Phase 2

### Phase 9: Extension Backend - Folder Permissions ✓ COMPLETED (simplified)

- [x] Workspace-scoped permissions via `excludedFolders` config
- [x] Passed to AgentSession → SDK `--disallowedDirectories`
- [ ] Full path validation middleware (deferred)

### Phase 12: Claude Code Installation & Onboarding — PLANNED

Automated setup wizard that detects missing prerequisites and installs them for the user. Zero terminal knowledge required.

**Background:** Claude Code requires two things to work: the CLI binary and authentication. As of 2026, Anthropic provides native installers that bundle their own runtime — **Node.js is NOT required**. This dramatically simplifies installation.

#### Prerequisites (what we detect)

| Prerequisite | Detection | Install method |
|---|---|---|
| Claude Code CLI | `which claude` (macOS/Linux), `where claude` (Windows) | Native installer (see below) |
| Authentication | `claude auth status` or attempt SDK init | `claude login` → browser OAuth |

#### Native Installer Commands (no Node.js needed)

| Platform | Command |
|----------|---------|
| macOS / Linux | `curl -fsSL https://claude.ai/install.sh \| bash` |
| Windows (PowerShell) | `irm https://claude.ai/install.ps1 \| iex` |

The native binary ships its own runtime, handles PATH setup, and auto-updates.

#### Authentication Methods

| Method | UX | Target user |
|--------|------|-------------|
| `claude login` | Opens browser → OAuth with Claude.ai account | Everyone (recommended) |
| `ANTHROPIC_API_KEY` env var | Manual key entry | Power users / enterprise |

#### User Flow

1. User selects Claude Code in agent dropdown
2. Extension runs prerequisite checks (`child_process.exec`)
3. If anything is missing → **Setup Wizard** replaces empty state in sidebar
4. Wizard shows checklist with explanation of what will be installed
5. User clicks "Set up Claude Code"
6. Extension runs installer automatically, shows progress
7. Extension runs `claude login`, browser opens for OAuth
8. All checks pass → wizard disappears, normal chat appears
9. Future sessions: checks are cached, wizard skipped

#### Implementation Checklist

- [ ] Create `src/agent/setup.ts` — prerequisite detection service
  - [ ] `checkClaudeInstalled()`: exec `which claude` / `where claude`
  - [ ] `checkClaudeAuth()`: exec `claude auth status` or parse output
  - [ ] `getSetupStatus()`: returns `{ cliInstalled, authenticated }`
  - [ ] Cache results (re-check on demand, not every render)
- [ ] Create `src/agent/installer.ts` — automated installer service
  - [ ] `installClaude()`: runs native installer for current platform
  - [ ] `runClaudeLogin()`: exec `claude login` (opens browser)
  - [ ] Progress callbacks for UI updates
  - [ ] Error handling with user-friendly messages
  - [ ] Platform detection (darwin, win32, linux)
- [ ] Update `UnifiedViewProvider.ts`
  - [ ] Run prerequisite check on `ai-execute-agent` (before creating session)
  - [ ] New message types: `agent:setup-status`, `agent:setup-progress`
  - [ ] Handle `ai-setup-claude` message from webview → trigger installer
  - [ ] Handle `ai-login-claude` message from webview → trigger login
  - [ ] Send setup status to webview on agent selection change
- [ ] Create `webview/src/components/ai-sidebar/SetupWizard.tsx`
  - [ ] Checklist UI with step status (pending, running, done, error)
  - [ ] "Set up Claude Code" primary action button
  - [ ] Progress indicator during installation
  - [ ] "Use API key instead" secondary link
  - [ ] Error state with retry button
  - [ ] Success state → auto-transition to chat
- [ ] Update `webview/src/components/ai-sidebar/store.ts`
  - [ ] Add `setupStatus: { cliInstalled, authenticated }` state
  - [ ] Add `setupProgress` state (for install/login progress)
  - [ ] Handle `agent:setup-status` and `agent:setup-progress` messages
  - [ ] `triggerSetup()` and `triggerLogin()` actions
- [ ] Update `webview/src/components/ai-sidebar/AISidebar.tsx`
  - [ ] Show SetupWizard when Claude Code selected but prerequisites missing
  - [ ] Show normal AgentView only when all prerequisites pass
- [ ] Update `webview/src/components/ai-sidebar/types.ts`
  - [ ] Add `SetupStatus`, setup-related `ExtensionMessage` types

#### Security Considerations

- Installer scripts are fetched from `claude.ai` (Anthropic's domain) — trusted source
- On macOS/Linux: `curl | bash` runs with user permissions (no sudo)
- On Windows: PowerShell script runs with user permissions
- We must show the user exactly what we're about to run before executing
- `claude login` opens the user's default browser — no credentials handled by Ritemark

#### Platform Notes

**macOS:**
- `curl` is pre-installed on all macOS versions
- No admin privileges needed for native installer
- PATH update may require shell restart (new terminal tab)

**Windows:**
- PowerShell is available on all modern Windows (5.1+ / 7+)
- `irm` (Invoke-RestMethod) is a built-in PowerShell cmdlet
- Execution policy may block scripts: may need `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`
- After install, `claude` may not be in PATH until terminal restart — our extension should detect the install path directly

**Linux:**
- `curl` usually pre-installed, fallback to `wget`
- Same flow as macOS

#### Edge Cases

| Case | Handling |
|------|----------|
| Install succeeds but `claude` not in PATH yet | Check known install locations directly (`~/.claude/`, `~/.local/bin/`) |
| User cancels browser login | Show "Login incomplete" with retry button |
| User already has Claude Code via npm | `which claude` still finds it — works fine |
| Corporate proxy blocks `claude.ai` | Show error with manual install instructions |
| User has Claude Code but old version | `claude update` or re-run installer |
| Offline | Show "Internet connection required for setup" |

### Phase 10: Integration & Polish — IN PROGRESS

- [x] Update message protocol between extension and webview
- [x] Test both agents (Ritemark Agent, Claude Code)
- [x] Test agent switching preserves/clears conversation correctly
- [x] Test abort/cancel with Claude Code agent
- [x] Test with real Claude API calls
- [x] Fix TypeScript errors (compiles clean)
- [ ] Test feature flag toggle (enable/disable without restart)
- [ ] Verify webview bundle size is acceptable (~4MB, should review)
- [ ] Test on all platforms (macOS, Windows, Linux)

### Phase 11: Documentation & Cleanup — IN PROGRESS

- [x] Update sprint plan status (this document)
- [ ] Update `docs/sprints/WISHLIST.md` (mark items as in-progress)
- [ ] Update CLAUDE.md if needed (agent usage guidelines)
- [ ] Document known limitations
- [ ] Create user-facing documentation for agent modes

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| AgentRunner breaks Flows | Low | HIGH | Comprehensive regression testing, feature flag for rollback |
| Feature flag doesn't gate properly | Medium | Medium | Test flag ON/OFF states thoroughly, add safety checks |
| Folder permissions can be bypassed | Medium | HIGH | Path normalization, symlink resolution, absolute path validation |
| UI too complex for non-technical users | Medium | Medium | User testing, clear help text, progressive disclosure |
| Webview bundle size too large | Low | Medium | Code splitting, lazy loading for agent UI |
| Claude API rate limits | Low | Medium | Clear error messages, retry logic |
| Agent makes destructive changes | High | HIGH | Feature flag opt-in, folder restrictions, future: checkpoint/undo system |
| Native installer blocked on Windows | Medium | HIGH | PowerShell execution policy, corporate firewalls. Fallback: manual install instructions |
| PATH not updated after install | Medium | Medium | Check known install paths directly (~/.claude/, ~/.local/bin/) instead of relying on PATH |
| OAuth login fails silently | Low | Medium | Parse `claude auth status` output, show clear retry UI |

## Technical Notes

### AgentSession Architecture

The agent uses a **streaming input with message queue** pattern for fast multi-turn conversations:

```
sendMessage(prompt) → enqueue → AsyncGenerator yields → SDK query() consumes
                                ↑                           ↓
                          dequeue waits               for await loop
                                                     processes results
```

- `_createMessageStream()`: Long-lived AsyncGenerator yielding messages on demand
- `_consumeLoop()`: Background `for await` loop for session lifetime
- `_enqueueInput()` / `_dequeueInput()`: Unbounded async channel with promise-based waiting
- Turn tracking (`_turnId` / `_consumerTurnId`) prevents stale results after interrupt

### Message Protocol (Implemented)

**Extension → Webview:**
- `agent:config` - Agent list, model list, selected agent/model, feature flag state
- `agent-progress` - Progress event (init, thinking, tool_use, text, done, error)
- `agent-result` - Final result (text, filesModified, metrics, error)

**Webview → Extension:**
- `ai-select-agent` - User changed agent selection (persists to settings)
- `ai-select-model` - User changed model (persists, recreates session)
- `ai-execute-agent` - Execute agent with prompt + optional images
- `ai-cancel-agent` - Interrupt current agent execution

### Folder Permission Algorithm

```
1. Normalize all paths (absolute, resolve symlinks)
2. For each requested file path:
   a. Check if path is within allowed folders
   b. Check if path is a system directory (deny)
   c. Check if path is outside workspace (deny)
3. If any check fails, return permission denied
4. Otherwise, allow operation
```

### Research Tool Schema

```typescript
{
  name: 'research',
  description: 'Search workspace documents using semantic search',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      topK: { type: 'number', default: 5, description: 'Number of results' },
      fileTypes: {
        type: 'array',
        items: { type: 'string' },
        description: 'File extensions to search (e.g., ["md", "txt"])'
      }
    },
    required: ['query']
  }
}
```

## Testing Checklist

### AgentRunner Service
- [ ] Dynamic SDK import works
- [ ] Event stream parsing works
- [ ] File modification tracking works
- [ ] Cost/duration tracking works
- [ ] Abort signal works
- [ ] Timeout handling works
- [ ] Permission validation works
- [ ] Works standalone (no Flow dependencies)

### Unified View Integration
- [ ] Agent selector dropdown appears in sidebar
- [ ] Claude Code option disabled/hidden when feature flag is OFF
- [ ] Agent selection persists across sessions
- [ ] Activity feed replaces chat messages when Claude Code is selected
- [ ] Folder selector appears when Claude Code is selected
- [ ] Progress events stream correctly
- [ ] Result displays correctly (success and error cases)
- [ ] Abort/cancel works
- [ ] Switching back to Ritemark Agent restores original chat UI

### Feature Flag
- [ ] Flag ON: Claude Code option available in agent selector
- [ ] Flag OFF: Claude Code option disabled/hidden in agent selector
- [ ] Settings UI shows experimental setting
- [ ] Setting persists across restarts

### Research Tool
- [ ] RAG search returns relevant results
- [ ] Results include file paths and snippets
- [ ] Agent can read files from search results
- [ ] Progress events show search activity

### Folder Permissions
- [ ] User can select folders
- [ ] User can remove folders
- [ ] Paths outside allowed folders are blocked
- [ ] System directories are blocked
- [ ] Symlinks are resolved correctly
- [ ] Warning shows if entire workspace selected

### Setup Wizard
- [ ] Detects Claude Code CLI installed/not installed (macOS)
- [ ] Detects Claude Code CLI installed/not installed (Windows)
- [ ] Shows setup wizard when Claude Code selected but CLI missing
- [ ] Native installer runs successfully (macOS)
- [ ] Native installer runs successfully (Windows)
- [ ] `claude login` opens browser for OAuth
- [ ] Auth detection works after successful login
- [ ] Wizard transitions to chat after all checks pass
- [ ] "Use API key instead" flow works
- [ ] Retry works after failed install
- [ ] Already-installed state skips wizard

### Regression Testing
- [ ] Flows still work (ClaudeCodeNode executes correctly)
- [ ] Chat mode still works (no impact on existing functionality)
- [ ] RAG search still works independently
- [ ] Markdown editor unaffected
- [ ] Other AI features unaffected

### Build Testing
- [ ] Dev mode works
- [ ] Production build succeeds
- [ ] Webview bundle size reasonable
- [ ] No TypeScript errors
- [ ] No console errors in production

## Status

**Current Phase:** 3 (DEVELOP) — near completion
**Next Phase:** 4 (TEST & VALIDATE)

## Approval

- [x] Jarmo approved this sprint plan (approved 2026-02-07: "I take your advice but I still approve development of Sprint-33 :)")

---

## Research Documents

1. **Existing Architecture** (`research/01-existing-architecture.md`)
   - ClaudeCodeNodeExecutor analysis
   - UnifiedViewProvider analysis
   - Gaps and reusable patterns

2. **Extraction Strategy** (`research/02-extraction-strategy.md`)
   - AgentRunner API design
   - Extraction steps
   - Validation criteria

3. **UX Design** (`research/03-ux-design.md`)
   - Three-mode selector design
   - Activity feed card types
   - Folder selector UI
   - Checkpoint timeline (future)

4. **Writing Tools** (`research/04-writing-tools.md`)
   - Research tool (Phase 1)
   - Future tools (Reorganize, Expand, etc.)
   - Implementation strategy

5. **Feature Flags Analysis** (`research/05-feature-flags-analysis.md`)
   - Flag evaluation
   - Lifecycle plan
   - Implementation details
   - Kill-switch strategy

6. **Installation & Onboarding** (`research/06-installation-onboarding.md`)
   - Native installer discovery (no Node.js needed)
   - OAuth login vs API key authentication
   - Platform-specific install commands (macOS, Windows, Linux)
   - Setup wizard architecture
   - Edge cases and open questions
