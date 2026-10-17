/**
 * The left column's head (Ritemark 2.0, Sprint 132, R10): the entries of its two menus.
 *
 * The shell draws the head (the project's name, New and Search); its menus come from
 * here, through the `ritemark/projectHead` and `ritemark/projectHead/new` menus in
 * package.json, so an extension release can change their words, icons and entries.
 * Each command below carries Ritemark's word for an action and runs the command that
 * does it. Reveal in Finder (Reveal in File Explorer on Windows) is two commands, one
 * per system, because a command's title cannot change with the system; both run
 * VS Code's `revealFileInOS` on the project's folder.
 */

import * as vscode from 'vscode';

export interface ProjectHeadCommand {
  /** The command the menu shows (declared in package.json with its title). */
  readonly id: string;
  /** The command that does the work. */
  readonly runs: string;
  /** It works on the project's folder, which it is given. */
  readonly onFolder?: true;
}

/** The project's menu, behind the chevron: project things only (Switch project, Open a folder, Reveal) and the folder tools. */
export const PROJECT_MENU_COMMANDS: readonly ProjectHeadCommand[] = [
  { id: 'ritemark.projectHead.switchProject', runs: 'workbench.action.openRecent' },
  { id: 'ritemark.projectHead.openFolder', runs: 'workbench.action.files.openFolder' },
  { id: 'ritemark.projectHead.revealInFinder', runs: 'revealFileInOS', onFolder: true },
  { id: 'ritemark.projectHead.revealInFileExplorer', runs: 'revealFileInOS', onFolder: true },
  { id: 'ritemark.projectHead.newFolder', runs: 'explorer.newFolder' },
  { id: 'ritemark.projectHead.collapseFolders', runs: 'workbench.files.action.collapseExplorerFolders' },
];

/** New: every kind of new file Ritemark makes today. */
export const NEW_MENU_COMMANDS: readonly ProjectHeadCommand[] = [
  { id: 'ritemark.projectHead.newText', runs: 'ritemark.newDocument' },
  { id: 'ritemark.projectHead.newTable', runs: 'ritemark.newTable' },
  { id: 'ritemark.projectHead.newFlow', runs: 'ritemark.flows.new' },
  { id: 'ritemark.projectHead.newFile', runs: 'explorer.newFile' },
  { id: 'ritemark.projectHead.newFolderInNew', runs: 'explorer.newFolder' },
];

export function registerProjectHeadCommands(context: vscode.ExtensionContext): void {
  for (const { id, runs, onFolder } of [...PROJECT_MENU_COMMANDS, ...NEW_MENU_COMMANDS]) {
    context.subscriptions.push(
      vscode.commands.registerCommand(id, () => onFolder
        ? vscode.commands.executeCommand(runs, vscode.workspace.workspaceFolders?.[0]?.uri)
        : vscode.commands.executeCommand(runs)),
    );
  }
}
