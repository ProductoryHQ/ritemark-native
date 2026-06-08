import * as vscode from 'vscode';
import { Scheduler } from './Scheduler';
import { DaemonResultStore } from './DaemonResultStore';
import { DaemonStatusEvents } from './DaemonStatusEvents';

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

  if (workspacePath) {
    const status = new DaemonStatusEvents(context);
    scheduler = new Scheduler(context, store, status, workspacePath, () => runsChanged.fire());
    scheduler.start();
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.daemon.showScheduledRuns', () => {
      vscode.commands.executeCommand('ritemark.agentLibraryView.focus');
    }),
    vscode.commands.registerCommand('ritemark.daemon.openResult', (_taskId: string, _runId: string) => {
      // [S79] Open the run result detail — implemented after Sprint 79
      vscode.commands.executeCommand('ritemark.daemon.showScheduledRuns');
    }),
    vscode.commands.registerCommand('ritemark.daemon.approveScheduledAction', async (taskId: string, runId: string) => {
      // [S79] Inline approval — requires AgentRuntime (Sprint 79)
      try {
        require('../runtime/RuntimeRegistry');
      } catch {
        vscode.window.showWarningMessage(
          'Cannot retry — AgentRuntime unavailable. Ensure Sprint 79 is merged.',
          'Dismiss'
        );
        return;
      }
      // [S79] TODO: implement allow-list re-run
      // 1. store.getBlockedResult(taskId, runId)
      // 2. Build oneTimeAllowList from blockedAction
      // 3. Re-run via scheduler entry's task.run(ctx, { oneTimeAllowList })
      // 4. store.append(newResult); store.supersede(taskId, runId, newResult.runId)
      // 5. runsChanged.fire()
      void taskId; void runId;
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
