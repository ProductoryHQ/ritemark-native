import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { Scheduler } from './Scheduler';
import { DaemonResultStore } from './DaemonResultStore';
import { DaemonStatusEvents } from './DaemonStatusEvents';
import { isEnabled } from '../features/featureGate';

export interface DaemonController {
  store: DaemonResultStore;
  /** Register a listener fired whenever run history changes (for UI refresh). */
  onRunsChanged(listener: () => void): void;
  scheduler?: Scheduler;
}

/**
 * Minimal surface the daemon needs to reveal a scheduled run in the UI, without
 * coupling the daemon to the Agent Library view. Implemented by
 * AgentLibraryViewProvider; supplied lazily because the provider is created
 * after initDaemon() runs.
 */
export interface ScheduledRunRevealer {
  revealScheduled(taskId?: string, runId?: string): void;
}

let scheduler: Scheduler | undefined;

export function initDaemon(
  context: vscode.ExtensionContext,
  getRevealer?: () => ScheduledRunRevealer | null | undefined
): DaemonController {
  const store = new DaemonResultStore(context.workspaceState);
  const runsChanged = new vscode.EventEmitter<void>();
  context.subscriptions.push(runsChanged);

  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspacePath = workspaceFolders?.length ? workspaceFolders[0].uri.fsPath : undefined;

  // Gated on the 'scheduled-tasks-daemon' flag. When the flag is off the
  // scheduler is never created: no workspace scan, no cron timers, no runs.
  // The store + commands remain so the UI degrades cleanly.
  let status: DaemonStatusEvents | undefined;
  if (workspacePath && isEnabled('scheduled-tasks-daemon')) {
    status = new DaemonStatusEvents(context, store);
    scheduler = new Scheduler(context, store, status, workspacePath, () => runsChanged.fire());
    scheduler.start();
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.daemon.showScheduledRuns', () => {
      const revealer = getRevealer?.();
      if (revealer) {
        revealer.revealScheduled();
      } else {
        void vscode.commands.executeCommand('ritemark.agentLibraryView.focus');
      }
    }),
    vscode.commands.registerCommand('ritemark.daemon.openResult', (taskId: string, runId: string) => {
      const revealer = getRevealer?.();
      if (revealer) {
        revealer.revealScheduled(taskId, runId);
      } else {
        void vscode.commands.executeCommand('ritemark.agentLibraryView.focus');
      }
    }),
    vscode.commands.registerCommand('ritemark.daemon.approveScheduledAction', async (taskId: string, runId: string) => {
      const blockedResult = await store.getBlockedResult(taskId, runId);
      if (!blockedResult?.blockedAction) {
        vscode.window.showWarningMessage('Blocked run not found — it may have already been superseded.');
        return;
      }

      const entry = scheduler?.getEntry(taskId);
      if (!entry) {
        vscode.window.showWarningMessage('Scheduled task not found — the agent file may have been removed or disabled.');
        return;
      }

      const { blockedAction } = blockedResult;
      const label = entry.config.label || taskId;
      const actionDesc = blockedAction.kind === 'file-write'
        ? `Write file:\n${blockedAction.target}`
        : `Run shell command:\n${blockedAction.target}`;

      // Modal confirmation so the user sees exactly what they are approving
      // before anything runs. Cancel is added automatically by VS Code.
      const choice = await vscode.window.showWarningMessage(
        `Approve blocked action for "${label}"?`,
        {
          modal: true,
          detail: `${actionDesc}\n\nApproving re-runs the agent from the start with this single action allowed. Future scheduled runs stay restricted.`,
        },
        'Approve & re-run'
      );
      if (choice !== 'Approve & re-run') {
        return;
      }

      const oneTimeAllowList = [{ kind: blockedAction.kind, target: blockedAction.target }];
      const ctx = {
        workspacePath: workspacePath ?? '',
        extensionContext: context,
      };

      // Same live feedback as a normal scheduled run: spinner while running,
      // completion/blocked/errored toast at the end.
      status?.emitRunStarted(label);
      let newResult;
      try {
        newResult = await entry.task.run(ctx, { oneTimeAllowList });
      } catch (err) {
        const now = new Date().toISOString();
        newResult = {
          taskId,
          runId: crypto.randomUUID(),
          outcome: 'errored' as const,
          startedAt: now,
          finishedAt: now,
          durationMs: 0,
          errorMessage: err instanceof Error ? err.message : String(err),
        };
      }
      await store.append(newResult);
      await store.supersede(taskId, runId, newResult.runId);
      runsChanged.fire();

      switch (newResult.outcome) {
        case 'completed':
          status?.emitRunCompleted(taskId, newResult.runId, newResult);
          break;
        case 'blocked':
          status?.emitRunBlocked(taskId, newResult.runId, newResult);
          break;
        case 'errored':
          status?.emitRunErrored(taskId, newResult);
          break;
      }
    }),
    { dispose: () => scheduler?.stop() }
  );

  return {
    store,
    scheduler,
    onRunsChanged: (listener) => {
      context.subscriptions.push(runsChanged.event(listener));
    },
  };
}
