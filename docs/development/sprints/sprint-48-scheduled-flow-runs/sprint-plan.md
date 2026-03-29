# Sprint 48: Scheduled Flow Runs

## Goal

Add scheduled execution for Ritemark Flows so a flow can run automatically at a defined local time while Ritemark is running for that workspace.

## Problem

Flows can currently be run only manually. That works for ad hoc tasks, but it blocks recurring automations such as a daily morning AI summary, routine file generation, or a scheduled content prep flow. Users who keep Ritemark open need a simple local scheduler without setting up external cron infrastructure.

## V1 Scope

- Local-only scheduling inside the Ritemark extension host
- Schedule attached to individual `.flow.json` files
- Runs only while the relevant Ritemark window and workspace are open
- Time-based recurrence only: daily, weekdays, weekly
- Local timezone semantics
- Grace-period semantics for wake/sleep and delayed ticks
- No cloud execution, no background daemon, no backfill for missed runs
- Explicit flow-level UX in the editor for configuring and monitoring schedule state

## Feature Flag Check

- [x] Does this sprint need a feature flag?
  - Yes. This is a large new automation feature with failure risk and UX implications.
  - Add a new experimental flag: `scheduled-flow-runs`
  - The scheduler, schedule editing UI, and automatic run triggers should all be gated behind this flag until validated.

## Success Criteria

- [ ] A flow can be configured with an enabled schedule from the flow editor
- [ ] Supported schedule types in v1 are `daily`, `weekdays`, and `weekly`
- [ ] A user can define local trigger time, for example `09:00`
- [ ] While the workspace is open in Ritemark and the feature flag is enabled, the scheduled flow executes automatically at the configured time
- [ ] Scheduled runs reuse the existing flow execution pipeline instead of duplicating node execution logic
- [ ] Run results are recorded in the same execution/result UI shape used by manual runs
- [ ] The scheduler avoids duplicate execution within the same scheduled slot
- [ ] The scheduler avoids overlapping runs of the same flow by skipping a due slot while that flow is already running
- [ ] If the app is closed, sleeping, or not running that workspace at the trigger time, the run is skipped instead of replayed later
- [ ] If a delayed tick occurs within the grace window, the run still fires once; if outside the grace window, it is skipped as stale
- [ ] The user can see the next scheduled run time and last scheduled run time in the flow UI
- [ ] Scheduled execution failures surface a visible status/result instead of failing silently
- [ ] The schedule state is visible without selecting a node
- [ ] The schedule editor is clearly flow-level, not node-level
- [ ] Schedule config survives flow save and reload without loss
- [ ] Scheduling is discoverable from the flow editor without prior documentation
- [ ] Flows that require unresolved runtime input are not auto-run silently; they are skipped with a visible reason

## Non-Goals

- Catch-up runs after app restart or wake
- Cron expression editor
- Monthly or arbitrary interval schedules
- Multi-workspace coordination across app windows
- Remote or server-side execution
- Running flows when Ritemark is fully closed

## Proposed Data Model

Separate immutable user config from mutable runtime state.

### Flow file config

- Stored in `.flow.json`
- Owned by the user
- Should not change during routine scheduled execution

- Extend flow metadata with optional `schedule`
- Initial shape:

```json
{
  "schedule": {
    "enabled": true,
    "type": "daily",
    "time": "09:00",
    "days": [1, 2, 3, 4, 5]
  }
}
```

Notes:
- `days` is used only for `weekly`
- Day numbering uses ISO 8601 semantics: Monday=`1` ... Sunday=`7`
- `weekdays` is a first-class schedule type and does not require `days`

### Runtime schedule state

- Not stored in `.flow.json`
- Stored in VS Code `workspaceState`, keyed by workspace + flow URI
- Owned by the scheduler runtime
- Used for dedupe, observability, and recent status

Initial runtime shape:

```json
{
  "lastRunAt": null,
  "lastScheduledFor": null,
  "lastStatus": "idle",
  "lastError": null
}
```

Notes:
- `lastScheduledFor` is the dedupe key
- timestamps are stored as ISO strings
- keeping runtime state out of the flow file avoids git noise and editor reload churn

## Eligibility Rules For Scheduled Runs

- Scheduled flows must be fully automatable
- If a flow requires runtime input and a required input has no default value, the scheduler skips the run
- Skipped runs must record a visible reason, for example `Missing required input: Release number`
- If all required inputs have defaults, the scheduler may use those defaults in v1
- There is no interactive prompt collection during scheduled execution

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| `src/features/flags.ts` (edit) | Add `scheduled-flow-runs` experimental flag |
| `src/flows/types.ts` (edit) | Add schedule metadata types to flow definition |
| `src/flows/FlowStorage.ts` (edit) | Persist and load schedule config with flow files |
| `src/flows/FlowScheduleState.ts` | Workspace-scoped runtime state storage for last run metadata and dedupe |
| `src/flows/FlowScheduler.ts` | New runtime scheduler service that computes due runs and triggers execution |
| `src/flows/FlowsViewProvider.ts` and/or `src/flows/FlowEditorProvider.ts` (edit) | Surface scheduled run status to webviews and invoke scheduler-safe execution |
| `src/extension.ts` (edit) | Activate and dispose the flow scheduler service |
| `webview/src/components/flows/FlowEditor.tsx` (edit) | Add visible schedule summary/entry point in the flow editor header |
| `webview/src/components/flows/FlowSettingsPanel.tsx` | Dedicated flow-level schedule configuration UI |
| `webview/src/components/flows/stores/flowEditorStore.ts` (edit) | Carry schedule metadata through editor state and serialization |
| Scheduler tests | Unit tests for next-run calculation, due-run detection, and dedupe behavior |
| Flow integration tests | Verify a scheduled flow dispatches through existing execution path |

## Architecture Direction

- Scheduler lives in extension code, not in the webview
- Scheduler ticks on a lightweight fixed interval of 30 seconds in v1
- Tick evaluation compares wall-clock schedule slots, not timer counts, so interval drift does not accumulate logic errors
- On each tick:
  - enumerate known flow files for the workspace
  - load enabled schedules
  - compute whether a schedule is due in local time
  - skip if `lastScheduledFor` already matches the due slot
  - dispatch execution through the same backend flow executor path as manual runs
- Webview remains configuration and status surface only

### Timing policy

- Target precision in v1 is minute-level, not second-level
- A 30-second tick gives at most about 30 seconds of normal trigger delay
- Use a `SCHEDULE_GRACE_MS` tolerance window of 5 minutes
- Example:
  - scheduled time `09:00`
  - tick at `09:03` => still due, run once
  - tick at `09:10` => stale, skip
- This keeps wake-from-sleep behavior explicit and prevents accidental backfill

### Concurrency policy

- Maintain an in-memory `runningFlowIds` set inside the scheduler/runtime layer
- If a due slot is reached while the same flow is already executing, skip that slot instead of queueing it
- V1 does not queue overlapping scheduled runs
- Skip reason should be recorded in runtime status for observability

## UX Direction

The current Flows editor is a 3-column layout:
- left: node palette
- center: canvas
- right: node properties or execution results

That matters because schedule is a property of the whole flow, not of any node. In v1 we should keep that distinction explicit.

### UX decisions for v1

- Schedule is edited from a dedicated flow-level entry point in the editor header, near flow name and description
- Use a clock icon plus compact status text for discoverability
- The header should show a compact schedule summary when enabled, for example:
  - `Daily at 09:00`
  - `Weekdays at 09:00`
  - `Next run: today 09:00`
- When no schedule exists, the header should still expose a clear affordance such as `Add schedule`
- Opening schedule settings should show a dedicated flow settings panel, not reuse node config fields
- Node selection must not hide the fact that the flow itself has a schedule
- When a schedule exists, the editor should expose at least:
  - enabled/disabled state
  - recurrence type
  - time
  - next run
  - last run
  - last result status if available

### UX decisions explicitly out of scope for v1

- Calendar picker
- Cron editor
- Separate schedules per node
- Complex analytics/history view for scheduled runs
- Notification center redesign
- Dedicated schedule column in the flows list view

## Implementation Checklist

### Phase 1: Research and Contract

- [ ] Confirm where flow-level metadata should live in the `.flow.json` contract
- [ ] Define the exact meaning of "active":
  - working assumption for v1: a Ritemark window with the workspace is open and extension host is alive
- [ ] Finalize runtime state storage in `workspaceState`, keyed by flow URI
- [ ] Finalize scheduled-run eligibility rules for required inputs and defaults

### Phase 2: Feature Flag and Types

- [ ] Add `scheduled-flow-runs` to `src/features/flags.ts`
- [ ] Add flow schedule types to `src/flows/types.ts`
- [ ] Document ISO 8601 weekday numbering in schedule types/comments
- [ ] Update any flow type tests that assert node/flow contracts

### Phase 3: Scheduler Runtime

- [ ] Create `src/flows/FlowScheduler.ts`
- [ ] Create `src/flows/FlowScheduleState.ts`
- [ ] Add next-run calculation helper(s)
- [ ] Add interval-based due check
- [ ] Add dedupe using `lastScheduledFor`
- [ ] Add stale-slot handling using `SCHEDULE_GRACE_MS`
- [ ] Add per-flow overlap prevention with skip-on-busy behavior
- [ ] Add logging for schedule evaluation and dispatch
- [ ] Wire service startup/disposal from `src/extension.ts`

### Phase 4: Execution Wiring

- [ ] Reuse the existing flow execution backend path instead of duplicating runner logic
- [ ] Ensure scheduler-triggered runs can report results back to flow UI state
- [ ] Ensure scheduled runs with unresolved required inputs are skipped with explicit status
- [ ] Ensure scheduled run source is distinguishable from manual run source in execution metadata/logging

### Phase 5: Editor UI

- [ ] Add a flow-level schedule entry point in the editor header
- [ ] Add schedule summary text visible even when no node is selected
- [ ] Add dedicated flow settings panel instead of putting schedule controls in `NodeConfigPanel`
- [ ] Add controls for enable/disable, recurrence type, time, and day selection where relevant
- [ ] Display next run and last run metadata
- [ ] Display last scheduled run status when available
- [ ] Add discoverability affordance when no schedule is configured
- [ ] Gate UI behind `scheduled-flow-runs`

### Phase 6: Tests

- [ ] Unit test next run calculation for daily, weekdays, and weekly
- [ ] Unit test ISO 8601 weekday mapping
- [ ] Unit test due-run detection around edge times
- [ ] Unit test stale-slot skip behavior outside grace window
- [ ] Unit test dedupe with `lastScheduledFor`
- [ ] Unit test overlap skip when the flow is already running
- [ ] Unit test disabled schedules are ignored
- [ ] Unit test required-input eligibility rules
- [ ] Integration test scheduler dispatches through flow execution path
- [ ] Integration test schedule config survives save and reload

## Risk Register

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Duplicate runs after reload or frequent polling | Medium | Persist `lastScheduledFor` and compare exact schedule slot |
| Timezone and daylight-saving edge cases | Medium | Keep v1 in local time only and test date math explicitly |
| Sleep/wake causes delayed timer execution | Medium | Use wall-clock slot comparison plus 5-minute grace window, skip stale slots |
| Scheduler work across many flows causes noise or overhead | Low | Poll infrequently and only load enabled schedules |
| UI confusion between flow-level settings and node-level settings | Medium | Keep schedule controls clearly outside node config |
| Writing runtime timestamps into flow files creates git noise | High | Store runtime state in `workspaceState`, not in `.flow.json` |
| Results for scheduled runs are invisible if flow editor is closed | Medium | Reuse persisted run metadata and add basic logging/status propagation |

## Status

**Current Phase:** 1 (RESEARCH + PLAN)
**Approval Required:** No hard gate requested yet
