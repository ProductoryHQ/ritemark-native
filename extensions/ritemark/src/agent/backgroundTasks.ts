/**
 * Sprint 128 — background tasks reported by the Claude Agent SDK.
 *
 * Claude runs subagents (and Bash commands) as tasks, by default in the
 * background. The SDK reports them as `system` messages: `task_started`,
 * `task_updated`, `task_progress`, `task_notification`, and the live set in
 * `background_tasks_changed` (replace semantics). Phase 0 recordings:
 * docs/development/releases/v1.13.0/sprint-128-background-agent-turns/research/.
 *
 * This file turns those messages into card events and the live set. It is
 * pure (no SDK import, no I/O) so it can be tested without a session.
 *
 * Card identity: a subagent card is created from the Agent tool_use block, so
 * its id is the `toolu_…` tool_use id. Task messages carry both `task_id` and
 * `tool_use_id`; the card id is the tool_use id, the task id the fallback.
 */

export type TaskTerminalStatus = 'completed' | 'failed' | 'stopped';
export type TaskStatus = 'running' | TaskTerminalStatus;

export interface TaskInfo {
  taskId: string;
  toolUseId?: string;
  taskType?: string;
  description?: string;
  backgrounded: boolean;
  /** A task a subagent started (its own Bash). Never a card of its own. */
  ownedBySubagent: boolean;
  ambient: boolean;
  status: TaskStatus;
}

/** One entry of the live set: work still running, as the SDK reports it. */
export interface LiveTask {
  taskId: string;
  taskType?: string;
  description?: string;
}

export interface TaskCardEvent {
  kind: 'card';
  /** The card to update: the Agent tool_use id, or the task id when the SDK gave none. */
  cardId: string;
  taskId: string;
  status: TaskStatus;
  backgrounded: boolean;
  /** One line for the card: the task's latest summary or progress description. */
  detail?: string;
}

export interface LiveSetEvent {
  kind: 'live-set';
  tasks: LiveTask[];
}

export type TaskEvent = TaskCardEvent | LiveSetEvent;

export interface BackgroundTaskState {
  tasks: Map<string, TaskInfo>;
  live: LiveTask[];
}

export function createBackgroundTaskState(): BackgroundTaskState {
  return { tasks: new Map(), live: [] };
}

type TaskMessage = {
  type?: string;
  subtype?: string;
  task_id?: string;
  tool_use_id?: string;
  task_type?: string;
  description?: string;
  is_backgrounded?: boolean;
  owned_by_subagent?: boolean;
  ambient?: boolean;
  status?: string;
  summary?: string;
  patch?: { status?: string; is_backgrounded?: boolean };
  tasks?: Array<{ task_id?: string; task_type?: string; description?: string; ambient?: boolean }>;
};

const TASK_SUBTYPES = new Set(['task_started', 'task_updated', 'task_progress', 'task_notification', 'background_tasks_changed']);

/** True for the SDK messages this module reduces. */
export function isTaskMessage(message: unknown): boolean {
  const m = message as TaskMessage | null;
  return Boolean(m && m.type === 'system' && m.subtype && TASK_SUBTYPES.has(m.subtype));
}

function terminal(status: string | undefined): TaskTerminalStatus | null {
  return status === 'completed' || status === 'failed' || status === 'stopped' ? status : null;
}

function cardEvent(info: TaskInfo, detail?: string): TaskCardEvent | null {
  // A subagent's own Bash has no card; ambient work is never reported.
  if (info.ownedBySubagent || info.ambient) return null;
  return {
    kind: 'card',
    cardId: info.toolUseId ?? info.taskId,
    taskId: info.taskId,
    status: info.status,
    backgrounded: info.backgrounded,
    ...(detail ? { detail } : {}),
  };
}

/**
 * Apply one SDK message to the state and return the events it produces.
 * Unknown messages produce nothing and leave the state as it was.
 */
export function reduceTaskMessage(state: BackgroundTaskState, message: unknown): TaskEvent[] {
  const m = message as TaskMessage | null;
  if (!m || m.type !== 'system') return [];

  if (m.subtype === 'background_tasks_changed') {
    state.live = (m.tasks ?? [])
      .filter((task) => task.task_id && !task.ambient)
      .map((task) => ({
        taskId: task.task_id!,
        ...(task.task_type ? { taskType: task.task_type } : {}),
        ...(task.description ? { description: task.description } : {}),
      }));
    return [{ kind: 'live-set', tasks: state.live }];
  }

  const taskId = m.task_id;
  if (!taskId) return [];
  const known = state.tasks.get(taskId);

  if (m.subtype === 'task_started') {
    // A task can start again under the same id: a finished subagent that is
    // resumed (Phase 0, P3/P6). It is running again.
    const info: TaskInfo = {
      taskId,
      toolUseId: m.tool_use_id ?? known?.toolUseId,
      taskType: m.task_type ?? known?.taskType,
      description: m.description ?? known?.description,
      backgrounded: m.is_backgrounded === true,
      ownedBySubagent: m.owned_by_subagent === true,
      ambient: m.ambient === true,
      status: 'running',
    };
    state.tasks.set(taskId, info);
    const event = cardEvent(info);
    return event ? [event] : [];
  }

  // Updates for a task we never saw start: keep what the message says.
  const info: TaskInfo = known ?? {
    taskId,
    toolUseId: m.tool_use_id,
    taskType: m.task_type,
    description: m.description,
    backgrounded: false,
    ownedBySubagent: m.owned_by_subagent === true,
    ambient: m.ambient === true,
    status: 'running',
  };
  if (m.tool_use_id && !info.toolUseId) info.toolUseId = m.tool_use_id;
  state.tasks.set(taskId, info);

  if (m.subtype === 'task_updated') {
    if (m.patch?.is_backgrounded !== undefined) info.backgrounded = m.patch.is_backgrounded;
    // A terminal status is only recorded here: the task_notification that
    // always follows ends the card once, with its summary (Phase 0).
    const status = terminal(m.patch?.status);
    if (status) {
      info.status = status;
      return [];
    }
    const event = cardEvent(info);
    return event ? [event] : [];
  }

  if (m.subtype === 'task_progress') {
    if (info.status !== 'running') return [];
    const event = cardEvent(info, m.summary ?? m.description);
    return event ? [event] : [];
  }

  if (m.subtype === 'task_notification') {
    info.status = terminal(m.status) ?? 'completed';
    const event = cardEvent(info, m.summary);
    return event ? [event] : [];
  }

  return [];
}

/** Whether a known Agent card's task runs in the background (its tool_result is only the launch). */
export function isBackgroundedCard(state: BackgroundTaskState, cardId: string): boolean {
  for (const info of state.tasks.values()) {
    if ((info.toolUseId ?? info.taskId) === cardId) return info.backgrounded;
  }
  return false;
}

/** Live tasks that can still be stopped by id. */
export function liveTaskIds(state: BackgroundTaskState): string[] {
  return state.live.map((task) => task.taskId);
}
