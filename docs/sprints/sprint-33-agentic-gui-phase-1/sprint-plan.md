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

- [ ] AgentRunner service successfully extracted from ClaudeCodeNodeExecutor
- [ ] Flows continue to work (no regression)
- [ ] Unified AI View has agent selector dropdown (Ritemark Agent / Claude Code)
- [ ] Agent selection persists across sessions (stored in VS Code settings)
- [ ] Activity feed shows structured cards when Claude Code agent is selected
- [ ] Folder permission UI allows users to restrict agent access
- [ ] Research tool integrates RAG with agent (agent can search workspace)
- [ ] Feature flag properly gates Claude Code agent option
- [ ] Users can enable feature via Settings UI
- [ ] All changes work in both dev and production builds

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| AgentRunner service | Reusable agent execution service (`src/agent/AgentRunner.ts`) |
| Agent selector | Persistent dropdown: Ritemark Agent (default) / Claude Code. Stored in `ritemark.ai.selectedAgent` setting. Extensible for future agents (Codex, Gemini). |
| Activity feed UI | Structured cards with icons, timestamps, file tracking (Claude Code agent only) |
| Folder permissions | UI to select allowed folders, path validation |
| Research tool | Custom tool that integrates RAG search for agent |
| Feature flag | `agentic-assistant` flag with Settings UI integration |
| Documentation | Updated WISHLIST, architecture docs, UX guide |

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

### Phase 2: AgentRunner Extraction

- [ ] Create `src/agent/` directory structure
- [ ] Create `src/agent/types.ts` with shared interfaces
- [ ] Create `src/agent/AgentRunner.ts` core service
- [ ] Extract SDK import logic from ClaudeCodeNodeExecutor
- [ ] Extract event stream parsing
- [ ] Extract file modification tracking
- [ ] Extract cost/duration tracking
- [ ] Add folder permission validation
- [ ] Unit tests for AgentRunner (mock SDK calls)
- [ ] Refactor ClaudeCodeNodeExecutor to use AgentRunner
- [ ] Verify Flows still work (regression test)

### Phase 3: Feature Flag Setup

- [ ] Add `agentic-assistant` flag to `src/features/flags.ts`
- [ ] Add setting to `package.json` (`ritemark.experimental.agenticAssistant`)
- [ ] Update `src/features/settings.ts` to sync flag state
- [ ] Test flag evaluation logic (ON/OFF states)
- [ ] Send feature state to webview on initialization

### Phase 4: Unified View Backend Integration

- [ ] Update UnifiedViewProvider to accept AgentRunner instance
- [ ] Add `ai-execute-agent` message handler
- [ ] Implement `_handleAgentExecution()` method
- [ ] Stream progress events to webview (`agent-progress`)
- [ ] Send result to webview (`agent-result`)
- [ ] Add folder permission validation before execution
- [ ] Gate agent messages with feature flag check
- [ ] Handle abort/cancel for agent execution

### Phase 5: Webview UI - Agent Selector

- [ ] Update webview types to include agent selection
- [ ] Create `AgentSelector.tsx` component (dropdown: Ritemark Agent / Claude Code)
- [ ] Add state management for selected agent (persisted via VS Code settings)
- [ ] Show Claude Code option as "(experimental)" when feature flag is ON
- [ ] Disable/hide Claude Code option when feature flag is OFF
- [ ] Send agent selection change to extension (`ai-select-agent` message)
- [ ] Style dropdown (VS Code theme integration)
- [ ] Load persisted selection on webview init

### Phase 6: Webview UI - Activity Feed

- [ ] Create `ActivityFeed.tsx` component
- [ ] Create card components for each event type:
  - [ ] ThinkingCard (💭)
  - [ ] ReadingCard (📖)
  - [ ] WritingCard (✏️)
  - [ ] EditingCard (✏️)
  - [ ] SearchingCard (🔍)
  - [ ] DoneCard (✅)
  - [ ] ErrorCard (❌)
- [ ] Add icons from lucide-react or VS Code codicons
- [ ] Implement expand/collapse for card details
- [ ] Add timestamp display (relative time)
- [ ] Style cards with VS Code theme colors
- [ ] Replace existing message list with activity feed (conditional on mode)

### Phase 7: Webview UI - Folder Selector

- [ ] Create `FolderSelector.tsx` component
- [ ] Show/hide based on selected agent (Claude Code only)
- [ ] Send folder picker request to extension
- [ ] Display selected folders with checkboxes
- [ ] Add "Add Folder" button
- [ ] Add remove folder action
- [ ] Default to workspace root with clear indicator
- [ ] Persist folder selections in VS Code settings

### Phase 8: Research Tool Integration

- [ ] Create `src/agent/tools/research.ts`
- [ ] Implement research tool handler (calls RAG vector store)
- [ ] Register research tool with AgentRunner
- [ ] Test research tool in agent context
- [ ] Document research tool usage in progress events
- [ ] Show search results in activity feed (SearchingCard)

### Phase 9: Extension Backend - Folder Permissions

- [ ] Create `src/agent/permissions.ts`
- [ ] Implement path validation logic
- [ ] Implement folder containment check
- [ ] Add permission middleware for AgentRunner
- [ ] Handle permission denied errors gracefully
- [ ] Test edge cases (symlinks, parent paths, absolute vs relative)

### Phase 10: Integration & Polish

- [ ] Update message protocol between extension and webview
- [ ] Test both agents (Ritemark Agent, Claude Code)
- [ ] Test agent switching preserves/clears conversation correctly
- [ ] Test feature flag toggle (enable/disable without restart)
- [ ] Test abort/cancel with Claude Code agent
- [ ] Verify file modification tracking works
- [ ] Test with real Claude API calls (not mocks)
- [ ] Verify webview bundle size is acceptable
- [ ] Fix TypeScript errors
- [ ] Test on all platforms (macOS, Windows, Linux)

### Phase 11: Documentation & Cleanup

- [ ] Update `docs/sprints/WISHLIST.md` (mark items as in-progress)
- [ ] Update CLAUDE.md if needed (agent usage guidelines)
- [ ] Add agent architecture diagram to research docs
- [ ] Document known limitations
- [ ] Update sprint plan status (this document)
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

## Technical Notes

### AgentRunner vs ClaudeCodeNodeExecutor

| Aspect | ClaudeCodeNodeExecutor | AgentRunner |
|--------|----------------------|-------------|
| Context | Flow node execution | Generic agent execution |
| Variables | Interpolates from Flow context | Direct prompt only |
| Progress | Flow-specific callback | Generic progress callback |
| Permissions | Always `bypassPermissions` | Configurable (ask/allow/deny) |
| Tools | Fixed set (Bash, Read, Write...) | Configurable set + custom tools |

### Message Protocol

**Extension → Webview:**
- `features:state` - Feature flag states
- `agent:selected` - Currently selected agent (on init)
- `agent-progress` - Progress event (thinking, tool_use, etc.)
- `agent-result` - Final result (success/error, files modified, cost)

**Webview → Extension:**
- `ai-select-agent` - User changed agent selection (persists to settings)
- `ai-execute-agent` - Execute agent with prompt
- `ai-cancel-agent` - Abort current agent execution
- `agent-select-folder` - Open folder picker dialog

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

**Current Phase:** 3 (DEVELOP)
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
