/**
 * Status-bar "Relaunch to update" affordance.
 *
 * Sprint 93 R7: after a silent extension update stages successfully (see
 * updateService.ts's applyUpdateSilently), this is the only UI surfaced —
 * no confirmation dialog, since the staged files are already the active
 * ones on disk (userExtensionInstaller.ts's atomic-rename model has no
 * separate "activate" step short of a reload).
 */

import * as vscode from 'vscode';

export const RELAUNCH_COMMAND_ID = 'ritemark.updates.relaunch';

export class UpdateStatusBar {
  private item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = RELAUNCH_COMMAND_ID;
    this.item.hide();
  }

  show(version: string): void {
    this.item.text = `$(sync) Ritemark ${version} ready`;
    this.item.tooltip = 'Click to relaunch and update';
    this.item.show();
  }

  hide(): void {
    this.item.hide();
  }

  dispose(): void {
    this.item.dispose();
  }
}
