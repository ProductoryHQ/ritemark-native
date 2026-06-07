# Sprint 80 Tasks — Scheduled Tasks Daemon

**Track:** SDD
**Branch:** `sprint-80-scheduled-tasks-daemon`
**Spec:** [spec.md](spec.md) | **Technical plan:** [technical-plan.md](technical-plan.md)

Sprint-79-dependent tasks are marked `[S79]`. All others are independent and can be implemented and reviewed before Sprint 79 merges.

---

## Phase 1: Foundation (Sprint-79-independent)

### 1.1 Feature flag

- [ ] Add `scheduled-tasks-daemon` flag to `src/features/flags.ts` with `status: 'disabled'`
- [ ] Verify `featureGate.ts` can evaluate the new flag without errors

### 1.2 Types — `src/daemon/ScheduledTask.ts`

- [ ] Define `TaskOutcome` union type (`success | blocked | error | skipped`)
- [ ] Define `TaskContext` interface
- [ ] Define `BlockedAction` interface
- [ ] Define `TaskResult` interface
- [ ] Define `AutoApprovalPolicy` type
- [ ] Define `ScheduledTask` interface
- [ ] TypeScript compiles without errors

### 1.3 Frontmatter parser — `src/daemon/frontmatter/scheduleParser.ts`

- [ ] Implement `parseSchedule(fileContent: string): ParsedSchedule | null`
- [ ] Implement `validateCron(expr: string): { valid: boolean; error?: string }` — check 5-field count and basic range validation
- [ ] Handle missing `schedule` block (return `null`, no error)
- [ ] Handle `enabled: false` — parse successfully, return `enabled: false`
- [ ] Write unit tests: valid cron, invalid cron, missing block, `enabled: false`, label fallback
- [ ] All unit tests pass

### 1.4 Result store — `src/daemon/DaemonResultStore.ts`

- [ ] Implement `record(taskId, result)` with 50-entry cap per task
- [ ] Implement `getHistory(taskId)` returning most-recent-first array
- [ ] Implement `getAllHistory()` returning full map
- [ ] Implement `clearHistory(taskId?)` — clear one task or all
- [ ] Use `vscode.ExtensionContext.workspaceState` for persistence
- [ ] Write unit tests: record, cap at 50, clear, persist across simulated restarts
- [ ] All unit tests pass

### 1.5 Status events — `src/daemon/DaemonStatusEvents.ts`

- [ ] Create status bar item (left-aligned, priority 100); hidden initially
- [ ] Implement `emitRunStart(label)` — show spinner + label
- [ ] Implement `emitRunComplete(result)` — update icon + tooltip; show completion toast with "Show history" button
- [ ] Implement `emitRunBlocked(result)` — show warning icon; show blocked toast with "Show history" button
- [ ] Implement `emitRunError(result)` — show error icon
- [ ] Implement `emitWarning(message)` — status bar warning without toast (used for skipped runs)
- [ ] Implement `updateIdleState(scheduledCount)` — static icon + count when no run active; hide if count = 0
- [ ] Implement `dispose()` — clean up status bar item
- [ ] Manual test: status bar item appears/disappears correctly

### 1.6 Handler stubs

- [ ] Create `src/daemon/handlers/GitSyncHandler.ts` — class that implements `ScheduledTask` interface with a single `run()` that throws `new Error('not implemented')`; includes a TODO comment citing the future sprint
- [ ] Create `src/daemon/handlers/ScriptHandler.ts` — same pattern
- [ ] TypeScript compiles without errors

---

## Phase 2: Scheduler — `src/daemon/Scheduler.ts`

- [ ] On `activate()`: scan all `.md` files in workspace; parse frontmatter; register cron jobs for files with valid `enabled: true` schedules
- [ ] Register `vscode.workspace.createFileSystemWatcher('**/*.md')`; on file save, re-parse frontmatter and update (add/remove/reschedule) the corresponding task
- [ ] Implement concurrency guard: if a task is already running when its cron fires, skip the firing (record outcome `skipped`, reason `concurrent-run`)
- [ ] On cron fire: check `isEnabled('scheduled-tasks-daemon')` feature flag; if inactive, skip silently
- [ ] On cron fire: dynamic import guard for `RuntimeRegistry` (catches import error if Sprint 79 not present); record `skipped` + `agent-runtime-unavailable` and emit warning
- [ ] Call `task.run(ctx)` for valid runs; pass result to `DaemonResultStore` and `DaemonStatusEvents`
- [ ] On invalid cron expression: emit `DaemonStatusEvents.emitWarning()` with file name and error; do not crash
- [ ] Implement `dispose()`: cancel all cron jobs; dispose file watcher; dispose status events
- [ ] Write integration test: mock `ScheduledTask.run()`, advance fake timer, verify task fires exactly once; verify concurrent-run guard skips second firing
- [ ] All integration tests pass

---

## Phase 3: AgentTaskHandler `[S79]`

These tasks require Sprint 79's `AgentRuntime` interface (`src/runtime/AgentRuntime.ts` and `RuntimeRegistry.ts`) to be present in the codebase.

- [ ] `[S79]` Create `src/daemon/handlers/AgentTaskHandler.ts` implementing `ScheduledTask`
- [ ] `[S79]` In `run(ctx)`: call `RuntimeRegistry.getInstance().get(defaultAgentId).start(config)` with a daemon-local `onProgress` and `onApprovalRequest` — no interaction with `UnifiedViewProvider`
- [ ] `[S79]` Implement `AutoApprovalPolicy` enforcement in `onApprovalRequest`: auto-approve file reads (`approved: true`); auto-block file writes and shell commands (`approved: false`); record each blocked action in `blockedActions` array
- [ ] `[S79]` Collect agent output stream; build `outputSummary` (first 500 chars) and `outputFirstLine`
- [ ] `[S79]` Return `TaskResult` with correct `outcome`: `success` if run completes without blocks; `blocked` if any action was blocked; `error` if runtime throws
- [ ] `[S79]` Wire `AgentTaskHandler` into `Scheduler.ts` as the default handler for `.md` agent files (replacing the runtime-unavailability skip path when Sprint 79 is present)
- [ ] `[S79]` Integration test: mock `AgentRuntime.prompt()` to emit a file-write approval request; verify it is blocked and recorded
- [ ] `[S79]` All tests pass

---

## Phase 4: Extension wiring — `extension.ts`

- [ ] Import `Scheduler` and instantiate on extension activation
- [ ] Pass `extensionContext` to `Scheduler` (for `workspaceState` and disposable registration)
- [ ] Register command `ritemark.showDaemonHistory`: open a VS Code output channel or simple webview listing `DaemonResultStore.getAllHistory()` entries
- [ ] Register "Show history" button handler (from toast) to execute `ritemark.showDaemonHistory`
- [ ] Add `Scheduler` to `context.subscriptions` for automatic disposal
- [ ] TypeScript compiles without errors
- [ ] Extension activates without errors in dev mode

---

## Phase 5: QA and cleanup

- [ ] Run all unit and integration tests; all pass
- [ ] Manual QA against scenarios S1–S10 in `scenarios.md`
- [ ] Verify no interactive conversation history is modified during a scheduled run (S1)
- [ ] Verify missed run is not executed retroactively (S6)
- [ ] Verify history persists across simulated app restart (S7)
- [ ] Verify Sprint 79 absence guard works correctly (S8) — test by temporarily removing the dynamic import target
- [ ] Remove any debug logging added during development
- [ ] Verify pre-commit hook passes

---

## Phase 6: Architecture doc update

- [ ] Update `docs/development/architecture.md`: add `src/daemon/` to Subsystem Map
- [ ] Document `ScheduledTask` interface and `AutoApprovalPolicy` in architecture doc
- [ ] Document Sprint 79 dependency and activation strategy
- [ ] Update `Last updated` date in architecture doc
- [ ] Commit architecture doc update as its own commit

---

## Definition of Done

- [ ] All Phase 1–4 tasks complete (Phase 3 complete only if Sprint 79 is merged before Sprint 80 closes; otherwise deferred)
- [ ] All unit + integration tests pass
- [ ] Manual QA: S1–S10 pass (S8 passes regardless of Sprint 79 state)
- [ ] Pre-commit hook passes (no TS errors, no failing checks)
- [ ] Feature flag `scheduled-tasks-daemon` is `disabled` in the merged artifact (Jarmo enables manually to test)
- [ ] Architecture doc updated
- [ ] No debug code
