import * as vscode from 'vscode';
import type { TaskResult } from './ScheduledTask';

const STATUS_BAR_PRIORITY = 98;

export class DaemonStatusEvents {
  private readonly statusBar: vscode.StatusBarItem;
  private scheduledCount = 0;
  private needsReviewCount = 0;

  constructor(context: vscode.ExtensionContext) {
    this.statusBar = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      STATUS_BAR_PRIORITY
    );
    this.statusBar.name = 'Ritemark Scheduled Tasks';
    this.statusBar.command = 'ritemark.daemon.showScheduledRuns';
    context.subscriptions.push(this.statusBar);
  }

  setScheduledCount(count: number): void {
    this.scheduledCount = count;
    this.refresh();
  }

  emitRunStarted(label: string): void {
    this.statusBar.text = `$(sync~spin) ${label}…`;
    this.statusBar.tooltip = 'Scheduled agent running — click to view history';
    this.statusBar.backgroundColor = undefined;
    this.statusBar.show();
  }

  emitRunCompleted(taskId: string, runId: string, result: TaskResult): void {
    this.needsReviewCount = Math.max(0, this.needsReviewCount - 1);
    this.refresh();
    const label = result.outputFirstLine
      ? `"${result.outputFirstLine.slice(0, 80)}"`
      : 'Task completed.';
    vscode.window.showInformationMessage(
      `${result.taskId} finished — ${label}`,
      'Open result',
      'Show runs'
    ).then(choice => {
      if (choice === 'Show runs') {
        vscode.commands.executeCommand('ritemark.daemon.showScheduledRuns');
      } else if (choice === 'Open result') {
        vscode.commands.executeCommand('ritemark.daemon.openResult', taskId, runId);
      }
    });
  }

  emitRunBlocked(taskId: string, runId: string, result: TaskResult): void {
    this.needsReviewCount += 1;
    this.refresh();
    const detail = result.blockedAction
      ? `Agent wants to ${result.blockedAction.kind === 'file-write' ? 'write' : 'run shell command'} \`${result.blockedAction.target}\`. Scheduled runs can't ${result.blockedAction.kind === 'file-write' ? 'write' : 'run commands'} unattended.`
      : 'A restricted action was blocked.';
    vscode.window.showWarningMessage(
      `${taskId} paused — approval needed`,
      { detail },
      'Review & approve',
      'Dismiss'
    ).then(choice => {
      if (choice === 'Review & approve') {
        vscode.commands.executeCommand('ritemark.daemon.approveScheduledAction', taskId, runId);
      }
    });
  }

  emitRunErrored(taskId: string, result: TaskResult): void {
    this.refresh();
    vscode.window.showErrorMessage(
      `${taskId} errored — ${result.errorMessage ?? 'unknown error'}`,
      'Show runs'
    ).then(choice => {
      if (choice === 'Show runs') {
        vscode.commands.executeCommand('ritemark.daemon.showScheduledRuns');
      }
    });
  }

  private refresh(): void {
    if (this.needsReviewCount > 0) {
      this.statusBar.text = `$(warning) ${this.needsReviewCount} needs review`;
      this.statusBar.tooltip = 'Scheduled run needs your approval — click to review';
      this.statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      this.statusBar.show();
    } else if (this.scheduledCount > 0) {
      this.statusBar.text = `$(clock) ${this.scheduledCount} scheduled`;
      this.statusBar.tooltip = 'Scheduled agent tasks — click to view history';
      this.statusBar.backgroundColor = undefined;
      this.statusBar.show();
    } else {
      this.statusBar.hide();
    }
  }
}
