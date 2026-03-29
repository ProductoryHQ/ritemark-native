# Scheduled Flow Runs: Initial Codebase Findings

## Relevant Existing Areas

### Flow persistence

- `extensions/ritemark/src/flows/FlowStorage.ts`
- Handles CRUD for `.flow.json` files in the workspace
- Good place for schedule config
- Not a good place for mutable runtime timestamps because scheduled execution would constantly rewrite user files

### Flow execution

- `extensions/ritemark/src/flows/FlowExecutor.ts`
- Shared execution path for flow nodes
- Scheduler should dispatch into existing execution machinery instead of creating a second execution stack

### Manual run orchestration

- `extensions/ritemark/src/flows/FlowsViewProvider.ts`
- Already coordinates manual flow runs and result delivery to the flows panel
- Likely integration point for surfacing scheduled run results

### Flow editor webview bridge

- `extensions/ritemark/src/flows/FlowEditorProvider.ts`
- Owns `.flow.json` custom editor messaging and model loading
- Good candidate for exposing schedule metadata and feature-gated UI state to the editor

### Current flow editor UX layout

- `extensions/ritemark/webview/src/components/flows/FlowEditor.tsx`
- Current layout is explicitly 3-column:
  - left: `NodePalette`
  - center: `FlowCanvas`
  - right: `NodeConfigPanel` or `ExecutionPanel`
- Header currently contains flow name, description, and validation warnings
- This makes the header the cleanest place for a flow-level schedule entry point

### Current right-panel constraint

- `extensions/ritemark/webview/src/components/flows/NodeConfigPanel.tsx`
- The right sidebar is currently node-centric and only appears when a node is selected
- Reusing it directly for schedule controls would blur flow-level and node-level concerns
- Better v1 direction:
  - keep node config for node properties
  - add a separate flow settings mode/panel for schedule configuration

### Extension activation lifecycle

- `extensions/ritemark/src/extension.ts`
- Natural place to construct and dispose a scheduler service

### Existing extension state storage

- VS Code `workspaceState` is the right default for mutable per-workspace scheduler runtime state
- That keeps `lastRunAt`, `lastScheduledFor`, and status metadata out of `.flow.json`
- It also avoids file watcher churn and git diff noise from routine scheduled runs

### Existing scheduling pattern

- `extensions/ritemark/src/update/updateScheduler.ts`
- Very small example of delayed scheduling inside the extension host
- Not enough by itself, but confirms extension-host timing work is already acceptable in this repo

### Feature flags

- `extensions/ritemark/src/features/flags.ts`
- Existing flags include `ritemark-flows` and `codex-integration`
- Scheduled flow runs should be added as a separate experimental flag

## Recommended V1 Shape

- One scheduler service per extension host
- Scheduler polls on an interval and evaluates flow files for the current workspace
- Schedule config is flow-level metadata, not a node type
- Schedule runtime state is stored separately in `workspaceState`
- Only run while the workspace is open in an active Ritemark session
- No missed-run replay after restart or sleep
- Schedule UX lives in flow-level editor chrome, not in a node card

## Concrete V1 Decisions

1. Weekday numbering uses ISO 8601:
   - Monday=`1`
   - Tuesday=`2`
   - Wednesday=`3`
   - Thursday=`4`
   - Friday=`5`
   - Saturday=`6`
   - Sunday=`7`
2. Tick interval is 30 seconds
3. Grace window for delayed ticks is 5 minutes
4. Overlapping runs of the same flow are skipped, not queued
5. Required inputs without defaults make a flow ineligible for scheduled execution
6. Multi-workspace coordination remains out of scope for v1

## Open Technical Questions

1. Should scheduled runs appear in the existing Results panel even when the flow editor tab is not open?
2. Do we want a scheduler-specific run source marker, such as `manual` vs `scheduled`, in execution metadata?
3. Should the Flows list later show a schedule badge or column after v1 editor support lands?

## First Implementation Slice

1. Add feature flag and flow schedule types
2. Build pure next-run calculation utilities with tests
3. Add extension-host scheduler service
4. Connect scheduler to existing flow execution path
5. Add minimal but explicit flow-level schedule UI in the webview header/panel
