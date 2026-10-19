/**
 * The left column's head (Ritemark 2.0, Sprint 132, R10; experience 31): the entries of its menus.
 *
 * The shell draws the head (the project's name, New and Search) on Documents and on Agents; its
 * menus come from here, through the `ritemark/projectHead`, `ritemark/projectHead/new` and
 * `ritemark/projectHead/agents/new` menus in package.json, so an extension release can change
 * their words, icons and entries.
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
  // Sprint 134 (R8): the shell opens the projects flyout for it; run on its own, it shows Home's projects list.
  { id: 'ritemark.projectHead.switchProject', runs: 'ritemark.projects.switch' },
  { id: 'ritemark.projectHead.openFolder', runs: 'workbench.action.files.openFolder' },
  { id: 'ritemark.projectHead.revealInFinder', runs: 'revealFileInOS', onFolder: true },
  { id: 'ritemark.projectHead.revealInFileExplorer', runs: 'revealFileInOS', onFolder: true },
  { id: 'ritemark.projectHead.aboutProject', runs: 'ritemark.aboutProject' },
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

/** New on Agents (experience 31): the library's four kinds; Flow is the same entry as in New on Documents. */
export const AGENTS_NEW_MENU_COMMANDS: readonly ProjectHeadCommand[] = [
  { id: 'ritemark.projectHead.newAgent', runs: 'ritemark.agentLibrary.newAgent' },
  { id: 'ritemark.projectHead.newSkill', runs: 'ritemark.agentLibrary.newSkill' },
  { id: 'ritemark.projectHead.newCommand', runs: 'ritemark.agentLibrary.newCommand' },
  { id: 'ritemark.projectHead.newFlow', runs: 'ritemark.flows.new' },
];

/**
 * The rows under the head (Sprint 134, R16): the shell draws each row with its command's title and icon from
 * package.json. New opens the place's New menu under the row; run on its own (a key), it makes a document.
 */
export const HEAD_ROW_COMMANDS: readonly ProjectHeadCommand[] = [
  { id: 'ritemark.projectHead.newRow', runs: 'ritemark.newDocument' },
  { id: 'ritemark.projectHead.search', runs: 'workbench.view.search' },
];

/** Every head command once (a command can sit in two menus). */
export const PROJECT_HEAD_COMMANDS: readonly ProjectHeadCommand[] = [...new Map(
  [...PROJECT_MENU_COMMANDS, ...NEW_MENU_COMMANDS, ...AGENTS_NEW_MENU_COMMANDS, ...HEAD_ROW_COMMANDS].map(command => [command.id, command]),
).values()];

export function registerProjectHeadCommands(context: vscode.ExtensionContext): void {
  for (const { id, runs, onFolder } of PROJECT_HEAD_COMMANDS) {
    context.subscriptions.push(
      vscode.commands.registerCommand(id, () => onFolder
        ? vscode.commands.executeCommand(runs, vscode.workspace.workspaceFolders?.[0]?.uri)
        : vscode.commands.executeCommand(runs)),
    );
  }
}
