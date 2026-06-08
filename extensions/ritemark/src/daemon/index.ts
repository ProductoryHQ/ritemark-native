import * as vscode from 'vscode';
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

let scheduler: Scheduler | undefined;

export function initDaemon(context: vscode.ExtensionContext): DaemonController {
  const store = new DaemonResultStore(context.workspaceState);
  const runsChanged = new vscode.EventEmitter<void>();
  context.subscriptions.push(runsChanged);

  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspacePath = workspaceFolders?.length ? workspaceFolders[0].uri.fsPath : undefined;

  // Gated on the 'scheduled-tasks-daemon' flag (currently 'disabled' → ships inert).
  // When the flag is off the scheduler is never created: no workspace scan, no
  // cron timers, no runs. The store + commands remain so the UI degrades cleanly.
  if (workspacePath && isEnabled('scheduled-tasks-daemon')) {
    const status = new DaemonStatusEvents(context);
    scheduler = new Scheduler(context, store, status, workspacePath, () => runsChanged.fire());
    scheduler.start();
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.daemon.showScheduledRuns', () => {
      vscode.commands.executeCommand('ritemark.agentLibraryView.focus');
    }),
    vscode.commands.registerCommand('ritemark.daemon.openResult', (_taskId: string, _runId: string) => {
      vscode.commands.executeCommand('ritemark.daemon.showScheduledRuns');
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
      const oneTimeAllowList = [{ kind: blockedAction.kind, target: blockedAction.target }];

      const ctx = {
        workspacePath: workspacePath ?? '',
        extensionContext: context,
      };

      const newResult = await entry.task.run(ctx, { oneTimeAllowList });
      await store.append(newResult);
      await store.supersede(taskId, runId, newResult.runId);
      runsChanged.fire();
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
