/**
 * Sprint 134 (R9, W8): switching projects in the same window.
 *
 * Every Ritemark way of switching comes here: Home's projects list, the head's
 * Switch project ▸ and Open a folder…, File ▸ Switch project's list, Go back
 * and Find it…. VS Code's own ways (Open Recent, Open Folder…, a drop on the
 * Dock icon, Close Folder) reach the same question through patch 018's veto
 * on a reload, which runs `_ritemark.projects.beforeReload`.
 *
 * Switching reloads the window. While a chat in this window works, it asks
 * first (experience 33, frame 3): Cancel, Switch and stop, and Open in a new
 * window as the default. With nothing working it never asks.
 *
 * Research: docs/development/releases/v2.0.0/sprint-134-project-at-the-centre/
 *   research/switch-audit.md
 */

import * as vscode from 'vscode';
import { aiNameOf } from './homeState';

export const SWITCHED_FROM_KEY = 'ritemark.projects.switchedFrom';
/** The note shows only on the window the switch opened, not on a later start. */
export const SWITCHED_NOTE_MS = 2 * 60 * 1000;

export interface SwitchedFrom {
  folderUri: string;
  name: string;
  at: number;
}

export type SwitchChoice = 'cancel' | 'switch-and-stop' | 'new-window';

/** The question's words (pure, tested): "Claude is still working in Leadership programme". */
export function switchQuestion(workingRuntimes: readonly (string | null)[], here: string, there: string | null): {
  title: string;
  detail: string;
  buttons: { choice: SwitchChoice; label: string }[];
} {
  const names = [...new Set(workingRuntimes.map((id) => aiNameOf(id) ?? 'The AI'))];
  const who = names.length <= 1 ? (names[0] ?? 'The AI') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  const verb = names.length > 1 ? 'are' : 'is';
  const pronoun = names.length > 1 ? 'them' : 'it';
  const subject = names.length > 1 ? 'them' : names[0] ?? 'the AI';
  const title = `${who} ${verb} still working in ${here}`;
  if (there) {
    return {
      title,
      detail: `Switching projects stops ${pronoun}. Open ${there} in a new window to let ${subject} finish.`,
      // The first is the dialog's default (experience 33: Open in a new window).
      buttons: [
        { choice: 'new-window', label: 'Open in a new window' },
        { choice: 'switch-and-stop', label: 'Switch and stop' },
      ],
    };
  }
  // VS Code's own ways where the folder isn't known: no new window to offer; Cancel is the default.
  return {
    title,
    detail: `Switching projects stops ${pronoun}.`,
    buttons: [{ choice: 'switch-and-stop', label: 'Switch and stop' }],
  };
}

export interface SwitchDependencies {
  context: vscode.ExtensionContext;
  /** The open project's name, as Home and the head draw it. */
  hereName: () => string;
  hereUri: () => string | null;
  nameOf: (folderUri: string) => string;
  workingChats: () => { conversationId: string; runtimeId: string | null }[];
  stopWorkingChats: () => Promise<void>;
}

export class ProjectSwitcher {
  /** Ritemark asked already: the reload it starts next is let through by the veto. */
  private askedUntil = 0;

  constructor(private readonly deps: SwitchDependencies) {}

  /** Ask while a chat works; undefined when nothing does. */
  private async ask(there: string | null): Promise<SwitchChoice | undefined> {
    const working = this.deps.workingChats();
    if (working.length === 0) return undefined;
    const question = switchQuestion(working.map((chat) => chat.runtimeId), this.deps.hereName(), there);
    const picked = await vscode.window.showWarningMessage(
      question.title,
      { modal: true, detail: question.detail },
      ...question.buttons.map((button) => button.label),
    );
    return question.buttons.find((button) => button.label === picked)?.choice ?? 'cancel';
  }

  private async rememberHere(): Promise<void> {
    const here = this.deps.hereUri();
    if (!here) return;
    const from: SwitchedFrom = { folderUri: here, name: this.deps.hereName(), at: Date.now() };
    await this.deps.context.globalState.update(SWITCHED_FROM_KEY, from);
  }

  /** Switch this window to the folder, asking first when a chat works. */
  async switchTo(target: vscode.Uri, options: { newWindow?: boolean } = {}): Promise<SwitchChoice | 'switched'> {
    if (options.newWindow) {
      await vscode.commands.executeCommand('vscode.openFolder', target, { forceNewWindow: true });
      return 'new-window';
    }
    const choice = await this.ask(this.deps.nameOf(target.toString()));
    if (choice === 'cancel') return 'cancel';
    if (choice === 'new-window') {
      await vscode.commands.executeCommand('vscode.openFolder', target, { forceNewWindow: true });
      return 'new-window';
    }
    if (choice === 'switch-and-stop') await this.deps.stopWorkingChats();
    await this.rememberHere();
    this.askedUntil = Date.now() + 10_000;
    await vscode.commands.executeCommand('vscode.openFolder', target, { forceReuseWindow: true });
    return 'switched';
  }

  /**
   * The veto's question (patch 018): VS Code is about to reload this window
   * for another folder. True stops the reload. `target` is the folder when the
   * window knows it (Open Recent), undefined when only the main process does.
   */
  async beforeReload(target: unknown): Promise<boolean> {
    if (Date.now() < this.askedUntil) return false;
    const targetUri = typeof target === 'string' ? vscode.Uri.parse(target) : target instanceof vscode.Uri ? target : undefined;
    const choice = await this.ask(targetUri ? this.deps.nameOf(targetUri.toString()) : null);
    if (choice === undefined) {
      if (targetUri) await this.rememberHere();
      return false;
    }
    if (choice === 'cancel') return true;
    if (choice === 'new-window' && targetUri) {
      await vscode.commands.executeCommand('vscode.openFolder', targetUri, { forceNewWindow: true });
      return true;
    }
    await this.deps.stopWorkingChats();
    if (targetUri) await this.rememberHere();
    return false;
  }

  /** The note on the next window's Home: once, and only right after a switch. */
  static takeSwitchedFrom(context: vscode.ExtensionContext, hereUri: string | null): SwitchedFrom | null {
    const from = context.globalState.get<SwitchedFrom>(SWITCHED_FROM_KEY);
    if (!from) return null;
    void context.globalState.update(SWITCHED_FROM_KEY, undefined);
    if (Date.now() - from.at > SWITCHED_NOTE_MS || !from.folderUri || from.folderUri === hereUri) return null;
    return from;
  }
}
