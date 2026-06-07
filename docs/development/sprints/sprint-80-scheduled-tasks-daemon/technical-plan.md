# Sprint 80 Technical Plan — Scheduled Tasks Daemon

**Track:** SDD
**Branch:** `sprint-80-scheduled-tasks-daemon`
**Spec:** [spec.md](spec.md)
**Scenarios:** [scenarios.md](scenarios.md)

---

## Sprint 79 Dependency and Feature-Flag Strategy

Sprint 79 (`sprint-79-runtime-unification`) is in development in parallel. Its key output — the `AgentRuntime` interface in `src/runtime/AgentRuntime.ts` — is required by `AgentTaskHandler` to run an agent headlessly via `runtime.prompt()`.

**Strategy:**

All daemon infrastructure (Scheduler, ScheduledTask interface, DaemonResultStore, DaemonStatusEvents, frontmatter parser) is **independent of Sprint 79** and can be built and merged without it.

`AgentTaskHandler` is built fully (not stubbed), but its activation is gated at the call site in `Scheduler.ts`:

```typescript
import { isEnabled } from '../features/featureGate';

// Inside Scheduler.run():
if (!isEnabled('scheduled-tasks-daemon')) {
  result = { outcome: 'skipped', reason: 'feature-flag-inactive' };
  return;
}

// AgentRuntime lookup — guard against Sprint 79 not yet merged:
let registry: RuntimeRegistry | undefined;
try {
  const { RuntimeRegistry } = await import('../runtime/RuntimeRegistry');
  registry = RuntimeRegistry.getInstance();
} catch {
  result = { outcome: 'skipped', reason: 'agent-runtime-unavailable' };
  store.record(taskId, result);
  statusEvents.emitWarning(`Scheduled task skipped — AgentRuntime not available`);
  return;
}
```

This means Sprint 80 can merge to `main` before Sprint 79 merges. The daemon infrastructure ships inert. Once Sprint 79 merges and the feature flag is toggled on, `AgentTaskHandler` becomes active automatically.

**Feature flag ID:** `scheduled-tasks-daemon`
**Default state:** `disabled` (activated manually by Jarmo for testing; enabled by default in a future sprint once Sprint 79 is stable)

---

## File Map

### New files — `src/daemon/`

#### `src/daemon/ScheduledTask.ts`

Defines all shared types for the daemon subsystem. No dependency on any runtime.

```typescript
export type TaskOutcome = 'success' | 'blocked' | 'error' | 'skipped';

export interface TaskContext {
  workspacePath: string;
  taskId: string;
  label: string;
  sourceFile: string;   // absolute path to the .md agent file
}

export interface TaskResult {
  outcome: TaskOutcome;
  startedAt: number;    // Date.now() ms
  durationMs: number;
  outputSummary?: string;    // first 500 chars of agent output
  outputFirstLine?: string;  // first line only, for toast
  blockedActions?: BlockedAction[];
  reason?: string;           // for 'skipped' — e.g. 'agent-runtime-unavailable'
  error?: string;
}

export interface BlockedAction {
  kind: 'file-write' | 'shell-command';
  detail: string;   // file path or command string
}

export type AutoApprovalPolicy = {
  fileReads: 'allow';
  fileWrites: 'block';
  shellCommands: 'block';
};

export interface ScheduledTask {
  readonly id: string;
  readonly schedule: string;           // cron expression
  readonly label: string;
  readonly autoApprovalPolicy: AutoApprovalPolicy;
  run(ctx: TaskContext): Promise<TaskResult>;
}
```

**Independent of Sprint 79.** Can be built and merged first.

---

#### `src/daemon/Scheduler.ts`

Central coordinator. Owns the map of active `ScheduledTask` instances and drives cron firing. **Never imports `AgentRuntime` directly** — the runtime lookup is done inside handlers at run-time (with the guard described above).

Responsibilities:
- Parse frontmatter from all `.md` files in the workspace on activation.
- Register a `FileSystemWatcher` for `**/*.md` changes; re-parse frontmatter on save.
- Map file path → `ScheduledTask` instance.
- Use `node-cron` (or equivalent lightweight scheduler) to register cron jobs.
- On cron fire: check feature flag → check runtime availability → call `task.run(ctx)` → emit result to `DaemonResultStore` and `DaemonStatusEvents`.
- Ensure only one run per task at a time (skip concurrent firing — see S8 variant).

**Dependencies:** `ScheduledTask`, `DaemonResultStore`, `DaemonStatusEvents`, feature flag gate. No `AgentRuntime` import at module level.

**Note on cron library:** `vscode` extensions cannot use `node-cron` (native Node, not bundled by webpack). Use a pure-JS cron parser (e.g. `cron-parser` for expression evaluation + `setTimeout`/`setInterval` scheduling driven by the extension's own timer loop). Evaluate during implementation — document choice in `notes/`.

---

#### `src/daemon/handlers/AgentTaskHandler.ts`

Implements `ScheduledTask`. Runs an agent file headlessly via `AgentRuntime.prompt()`.

**Sprint 79 dependency:** This file imports `RuntimeRegistry` from `src/runtime/RuntimeRegistry.ts`. It compiles only if Sprint 79 has landed. The `Scheduler.ts` dynamic import guard (see above) prevents this from being called at runtime if Sprint 79 is absent; however, the TypeScript compiler still needs the file to type-check. Two options (decide during implementation):

**Option A — conditional import guard at Scheduler level:** `AgentTaskHandler` is imported statically but the guard in `Scheduler.ts` ensures `run()` is never called if `RuntimeRegistry` throws. This requires Sprint 79 types to exist at compile time. Preferred once Sprint 79 branch is open and types are available.

**Option B — separate compile target:** `AgentTaskHandler` is excluded from the main tsconfig and compiled separately. More complex; use only if Option A causes build issues.

Document the chosen approach in `notes/` during Phase 3.

Responsibilities:
- On `run(ctx)`: call `registry.get(defaultAgentId).prompt(...)` with the agent file's contents as the prompt.
- Apply `AutoApprovalPolicy`: intercept `onApprovalRequest` callbacks — auto-respond `approved: true` for file reads, `approved: false` for file writes and shell commands; record blocked actions in `TaskResult`.
- Collect streaming output; build `outputSummary` (first 500 chars) and `outputFirstLine`.
- Return a `TaskResult` with outcome `success`, `blocked`, or `error`.

**Headless session contract (from Jarmo's decision #2):** Each scheduled run starts a fresh `runtime.start(config)` call with a new session. The `onProgress` callback and `onApprovalRequest` callback are daemon-local — they do not touch `UnifiedViewProvider`'s conversation history in any way. Results go only to `DaemonResultStore`.

---

#### `src/daemon/handlers/GitSyncHandler.ts`

Interface-only stub. Proves extensibility of the `ScheduledTask` interface. No implementation.

```typescript
// TODO: Sprint N — implement git pull/push on schedule
export class GitSyncHandler implements ScheduledTask { ... }
```

---

#### `src/daemon/handlers/ScriptHandler.ts`

Interface-only stub. Same pattern as `GitSyncHandler`.

---

#### `src/daemon/DaemonResultStore.ts`

Persists run history to `workspaceState`. API:

```typescript
class DaemonResultStore {
  record(taskId: string, result: TaskResult): void;
  getHistory(taskId: string): TaskResult[];   // most-recent first, max 50
  getAllHistory(): Map<string, TaskResult[]>;
  clearHistory(taskId?: string): void;        // undefined = clear all
}
```

Storage key pattern: `ritemark.daemon.results.${taskId}` in `vscode.ExtensionContext.workspaceState`.

Max 50 entries per task — on `record()`, trim oldest if over limit.

**Independent of Sprint 79.** Can be built and merged first.

---

#### `src/daemon/DaemonStatusEvents.ts`

Manages the VS Code status bar item and toast notifications.

Status bar:
- Created lazily on first scheduled task registration.
- Hidden when no tasks are scheduled.
- Uses `vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100)`.
- During run: `$(sync~spin) ${label}…` — `$(sync~spin)` is VS Code's built-in spinner icon id.
- After success: `$(clock) ${scheduledCount} scheduled`; tooltip = first line of last output.
- After blocked: `$(warning) ${label} — blocked`.
- After error: `$(error) ${label} — error`.

Toasts (`vscode.window.showInformationMessage` / `showWarningMessage`):
- Completion: `"${label} finished"` + first line of output. Button: "Show history".
- Blocked: `"${label} paused — approval needed"` + blocked action detail. Button: "Show history".

"Show history" button triggers `vscode.commands.executeCommand('ritemark.showDaemonHistory')`.

**Independent of Sprint 79.** Can be built and merged first.

---

### New files — `src/daemon/frontmatter/`

#### `src/daemon/frontmatter/scheduleParser.ts`

Parses the `schedule` block from `.md` frontmatter. Uses `gray-matter` (already a project dependency — verify during implementation; if not present, use a minimal YAML front-matter regex parser to avoid adding dependencies).

```typescript
export interface ParsedSchedule {
  cron: string;
  label?: string;
  enabled: boolean;
}

export function parseSchedule(fileContent: string): ParsedSchedule | null;
export function validateCron(expr: string): { valid: boolean; error?: string };
```

`parseSchedule` returns `null` if no `schedule` block is present, or if parsing fails.
`validateCron` checks field count (must be 5) and field ranges.

**Independent of Sprint 79.**

---

### Modified files

#### `src/features/flags.ts`

Add:

```typescript
{
  id: 'scheduled-tasks-daemon',
  status: 'disabled',
  description: 'Background daemon that runs AI agent tasks on a cron schedule. Requires Sprint 79 AgentRuntime interface.',
  platforms: ['all'],
}
```

#### `extension.ts`

Register `Scheduler` instance on activation. Pass `extensionContext` for `workspaceState` access. Dispose on deactivation.

Register command: `ritemark.showDaemonHistory` — opens a simple output channel or webview panel with run history (scope: basic output channel for Sprint 80; richer UI is a future sprint).

---

## Workstream Independence Summary

| Component | Sprint 79 dependency | Can ship without Sprint 79? |
|---|---|---|
| `ScheduledTask.ts` (types) | None | Yes |
| `Scheduler.ts` | None at module level; dynamic import guard | Yes |
| `DaemonResultStore.ts` | None | Yes |
| `DaemonStatusEvents.ts` | None | Yes |
| `scheduleParser.ts` | None | Yes |
| `GitSyncHandler.ts` (stub) | None | Yes |
| `ScriptHandler.ts` (stub) | None | Yes |
| `AgentTaskHandler.ts` | Imports `RuntimeRegistry` | Compiles if Sprint 79 types present; runtime-guarded |
| Feature flag entry | None | Yes |
| `extension.ts` wiring | None | Yes |

---

## External Dependencies

No new npm dependencies are expected. Verify:
- `gray-matter` or equivalent — check `package.json` in `extensions/ritemark/`.
- Cron scheduling — pure-JS approach (no `node-cron`); document chosen library or home-rolled approach in `notes/`.

If a new dependency is unavoidable, raise it with Jarmo before adding it (sprint scope requires no new dependencies by default — revisit if cron parsing needs one).

---

## Testing Approach

- Unit tests for `scheduleParser.ts` — valid expressions, invalid expressions, missing block, `enabled: false`.
- Unit tests for `DaemonResultStore.ts` — record, retrieve, 50-entry cap, clear.
- Integration test for `Scheduler.ts` — mock `ScheduledTask.run()`, advance fake timer, verify task fires.
- Manual QA matrix: scenarios S1–S10 from `scenarios.md`.

---

## Architecture Doc Update

At sprint close, update `docs/development/architecture.md`:
- Add `src/daemon/` to the Subsystem Map.
- Document the `ScheduledTask` interface and `AutoApprovalPolicy`.
- Note the Sprint 79 dependency and activation strategy.
- Update `Last updated` date.
