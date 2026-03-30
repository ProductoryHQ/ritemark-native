# Sprint 49: Windows Node.js Install UX

## Goal

Fix the bug where Windows users see "cannot find Node" when installing Ritemark by adding an actionable "Get Node.js" button — following the exact same pattern already established for "Get Git for Windows".

## Feature Flag Check

- [ ] Does this sprint need a feature flag?
  - NO. This is a bug fix: a missing UI affordance for a dependency that is already detected. No new feature, no experiment, no platform-specific premium behaviour. The Node detection (`nodeInstalled`) already exists; we are only surfacing the missing install action.

## Success Criteria

- [ ] When Node.js is missing on Windows, `recommendedAction` returns `'install-node'`
- [ ] `AgentEnvironmentRecommendedAction` union includes `'install-node'` in both `types.ts` files
- [ ] `EnvironmentStatusNotice` renders a contextual hint for `'install-node'`
- [ ] `SetupWizard` shows a "Get Node.js" secondary button when Node is missing (install/repair step)
- [ ] The "Install Claude" button is blocked (`installBlockedByEnvironment`) when Node is missing
- [ ] Clicking "Get Node.js" opens `https://nodejs.org/en/download` in the browser
- [ ] Existing Git-for-Windows behaviour is unchanged
- [ ] Unit test covers `recommendedEnvironmentAction` returning `'install-node'`

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| `setup.ts` update | `recommendedEnvironmentAction` gains `nodeInstalled` input; returns `'install-node'` for win32 + no Node |
| Type union update (x2) | `'install-node'` added to `AgentEnvironmentRecommendedAction` in extension + webview `types.ts` |
| `EnvironmentStatusNotice.tsx` update | Contextual hint shown when `recommendedAction === 'install-node'` |
| `SetupWizard.tsx` update | `missingNode` flag, gate added to `installBlockedByEnvironment`, "Get Node.js" button |
| `store.ts` update | `openNodeDownload` action (posts `agent-setup:open-node-download` message) |
| `UnifiedViewProvider.ts` update | Handler opens `https://nodejs.org/en/download` |

## Implementation Checklist

### Phase 1: Types
- [ ] `extensions/ritemark/src/agent/types.ts` — add `'install-node'` to `AgentEnvironmentRecommendedAction`
- [ ] `extensions/ritemark/webview/src/components/ai-sidebar/types.ts` — same change

### Phase 2: Detection logic
- [ ] `extensions/ritemark/src/agent/setup.ts` — add `nodeInstalled` to `recommendedEnvironmentAction` input; add `'install-node'` return branch (after git check, before null)
- [ ] `getAgentEnvironmentStatus` already passes the right data; verify the call site passes `nodeInstalled`

### Phase 3: Webview store
- [ ] `extensions/ritemark/webview/src/components/ai-sidebar/store.ts` — add `openNodeDownload: () => void` to interface and implementation

### Phase 4: UI components
- [ ] `extensions/ritemark/webview/src/components/ai-sidebar/EnvironmentStatusNotice.tsx` — add `'install-node'` hint block
- [ ] `extensions/ritemark/webview/src/components/ai-sidebar/SetupWizard.tsx` — add `missingNode`, update `installBlockedByEnvironment`, add "Get Node.js" `SecondaryButton`

### Phase 5: Extension message handler
- [ ] `extensions/ritemark/src/views/UnifiedViewProvider.ts` — add `case 'agent-setup:open-node-download'`

### Phase 6: Tests
- [ ] `extensions/ritemark/src/agent/setup.test.ts` — add test for `'install-node'` return value

## Status

**Current Phase:** 3 (DEVELOP)
**Approval Required:** No — approved by Jarmo 2026-03-30

## Approval

- [x] Jarmo approved this sprint plan
