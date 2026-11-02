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

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { aiNameOf } from './homeState';

/**
 * #623: a switch's two notes are written only as this window goes (`writePendingNotes`, from `deactivate`), not when
 * the person answers. After Ritemark's answer another participant can still stop the reload (unsaved files, a running
 * terminal), or has stopped it already, and the extension is never told; the window that stays then left notes for a
 * switch that never happened. By `deactivate` the extension host has cut its link to the workbench, so global state
 * can no longer be written (`terminate()` in VS Code's extHostExtensionService.ts); the notes are files in global
 * storage instead, shared by every window as global state is, beside `projects/v1/windows/` (projectWindows.ts).
 */
export const SWITCHED_FROM_FILE = 'switched-from.json';
/** The note shows only on the window the switch opened, not on a later start. */
export const SWITCHED_NOTE_MS = 2 * 60 * 1000;
/**
 * R9: "The next project opens on its Home". Every switch in place leaves this for the next window, Go back and
 * VS Code's own routes included (Go back leaves no `SWITCHED_FROM_FILE`); the window's tab check takes it once and
 * brings Home forward.
 */
export const LANDING_FILE = 'land-on-home.json';

/**
 * #623 (Sprint 152, patch 018): the shell's answer to whether the reload it asked about, by its attempt's number, still
 * goes on. Another participant can stop it while the person reads Ritemark's question; then the answer is no one's to
 * act on.
 */
export const RELOAD_GOES_ON_COMMAND = '_ritemark.projects.reloadGoesOn';

/** Whether the shell's reload `attempt` still goes on. An older shell passes no number, or has no such command: yes, as before. */
async function reloadGoesOn(attempt: unknown): Promise<boolean> {
  if (typeof attempt !== 'number') return true;
  try {
    return (await vscode.commands.executeCommand<boolean>(RELOAD_GOES_ON_COMMAND, attempt)) !== false;
  } catch {
    return true;
  }
}

export function switchNoteFile(globalStoragePath: string, name: string): string {
  return path.join(globalStoragePath, 'projects', 'v1', name);
}

interface Landing {
  /** The folder the switch left. */
  from: string | null;
  /** The folder it opens, when the window knows it (not for Open Folder…, a drop or Close Folder). */
  target: string | null;
  at: number;
}

const sameFolder = (a: string, b: string) => a.replace(/\/+$/, '') === b.replace(/\/+$/, '');

export interface SwitchedFrom {
  folderUri: string;
  name: string;
  /** The folder the switch opened (#623): the note is shown there only. */
  target: string;
  at: number;
}

/** What a window does with a note it reads: takes it (it is for this window), keeps it for the window it is for, or drops it. */
export type NoteVerdict = 'take' | 'keep' | 'drop';

const unusable = (note: { at?: unknown } | null | undefined, now: number): boolean =>
  !note || typeof note !== 'object' || typeof note.at !== 'number' || now - note.at > SWITCHED_NOTE_MS || now < note.at;

/**
 * The landing note, read before it is taken (#623, as the shell's `ritemarkReadLanding` in patch 018): a window lands on
 * Home and takes it when it is for this window; a window on another folder, or with no folder, keeps it for the window
 * it is for (it expires by itself); a note that is not one, has no time, is older than two minutes or from the future is
 * dropped. A note with no target (Open Folder…, a drop, Close Folder) can't name the window it is for, and keeps
 * today's rule: the first window that reads it takes it, and lands when it is on a folder other than the one left. In
 * the folder it left it is that switch's own window (Open Folder… into the same folder), with nothing to land on. Pure.
 */
export function readLanding(note: unknown, here: string | null, now: number): NoteVerdict {
  const landing = note as Partial<Landing> | null | undefined;
  if (unusable(landing, now)) return 'drop';
  if (typeof landing!.target === 'string') return here && sameFolder(landing!.target, here) ? 'take' : 'keep';
  return here && (typeof landing!.from !== 'string' || !sameFolder(landing!.from, here)) ? 'take' : 'drop';
}

/**
 * The "Switched from" note, by the same rule (#623): shown and taken in the folder the switch opened, kept for it by a
 * window on another folder or with none, dropped when unusable (no target among them) or about the project itself. Pure.
 */
export function readSwitchedFrom(note: unknown, here: string | null, now: number): NoteVerdict {
  const from = note as Partial<SwitchedFrom> | null | undefined;
  if (unusable(from, now) || typeof from!.folderUri !== 'string' || !from!.folderUri || typeof from!.name !== 'string'
    || typeof from!.target !== 'string') return 'drop';
  if (!here || !sameFolder(from!.target, here)) return 'keep';
  return sameFolder(from!.folderUri, here) ? 'drop' : 'take';
}

/** A note file's contents: `undefined` when there is none (or it can't be read), `null` when it is not JSON. */
function readNoteFile(file: string): unknown {
  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function removeNoteFile(file: string): void {
  try {
    fs.rmSync(file, { force: true });
  } catch (error) {
    console.warn('[Projects] Could not remove a switch note:', error);
  }
}

/** Read first, take only what the verdict says (#623): a note meant for another window stays for it. */
function takeNote<T>(globalStoragePath: string, name: string, read: (note: unknown) => NoteVerdict): T | null {
  const file = switchNoteFile(globalStoragePath, name);
  const note = readNoteFile(file);
  if (note === undefined) return null;
  const verdict = read(note);
  if (verdict !== 'keep') removeNoteFile(file);
  return verdict === 'take' ? note as T : null;
}

/** The notes of the switch this window answered, held until it goes; stamped when they are written. */
interface PendingNotes {
  /** When the person let the switch go ahead. */
  heldAt: number;
  landing: Omit<Landing, 'at'>;
  /** The note for the next window's Home; null takes an older one away (Go back); undefined leaves it. */
  switchedFrom?: Omit<SwitchedFrom, 'at'> | null;
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
  // VS Code's own ways where the folder isn't known: no new window to offer, and Cancel is the default, since the
  // other button stops the AI (S33). It goes first, as the dialog's close button too.
  return {
    title,
    detail: `Switching projects stops ${pronoun}.`,
    buttons: [
      { choice: 'cancel', label: 'Cancel' },
      { choice: 'switch-and-stop', label: 'Switch and stop' },
    ],
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
  /** Ritemark asked already: the reload it starts next, for that folder, is let through by the veto. */
  private asked: { target: string; until: number } | undefined;
  /** The notes of the switch the person let go ahead, written as the window goes (#623). */
  private pending: PendingNotes | undefined;

  constructor(private readonly deps: SwitchDependencies) {}

  /** Ask while a chat works; undefined when nothing does. */
  private async ask(there: string | null): Promise<SwitchChoice | undefined> {
    const working = this.deps.workingChats();
    if (working.length === 0) return undefined;
    const question = switchQuestion(working.map((chat) => chat.runtimeId), this.deps.hereName(), there);
    // A Cancel of the question's own is the dialog's close button (and, first, its default); otherwise VS Code adds one.
    const picked = await vscode.window.showWarningMessage(
      question.title,
      { modal: true, detail: question.detail },
      ...question.buttons.map((button) => ({ title: button.label, isCloseAffordance: button.choice === 'cancel' })),
    );
    return question.buttons.find((button) => button.label === picked?.title)?.choice ?? 'cancel';
  }

  /**
   * Hold the notes of the switch the person let go ahead (#623): the landing, and the "Switched from" note when the
   * folder it opens is known (`from: 'leave'` for VS Code's routes that don't know it, `'forget'` for Go back, S32).
   * Nothing is written until the window goes; an answer that a newer one replaces leaves nothing.
   */
  private hold(target: string | null, from: 'remember' | 'forget' | 'leave'): void {
    const here = this.deps.hereUri();
    this.pending = {
      heldAt: Date.now(),
      landing: { from: here, target },
      switchedFrom: from === 'forget'
        ? null
        : from === 'remember' && here && target ? { folderUri: here, name: this.deps.hereName(), target } : undefined,
    };
  }

  /**
   * Write the held notes, as the window goes (extension.ts `deactivate`, #623): only then is the reload known to have
   * gone ahead, past every other participant's question. Synchronous, since the extension host exits soon after. The
   * notes carry this moment, the switch's, as the shell's own note does: their two minutes start when the window goes.
   * An answer more than two minutes old is not the switch that ends this window (its reload was stopped; this is a
   * later close), and leaves nothing.
   */
  writePendingNotes(now = Date.now()): void {
    const pending = this.pending;
    this.pending = undefined;
    if (!pending || now - pending.heldAt > SWITCHED_NOTE_MS) return;
    const globalStoragePath = this.deps.context.globalStorageUri.fsPath;
    const write = (name: string, note: object) => {
      const file = switchNoteFile(globalStoragePath, name);
      const partial = `${file}.${process.pid}.tmp`;
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(partial, JSON.stringify({ ...note, at: now }));
        fs.renameSync(partial, file);
      } catch (error) {
        console.warn('[Projects] Could not leave a switch note for the next window:', error);
        try {
          fs.rmSync(partial, { force: true });
        } catch {
          // Nothing more to do as the window goes.
        }
      }
    };
    write(LANDING_FILE, pending.landing);
    if (pending.switchedFrom) write(SWITCHED_FROM_FILE, pending.switchedFrom);
    else if (pending.switchedFrom === null) removeNoteFile(switchNoteFile(globalStoragePath, SWITCHED_FROM_FILE));
  }

  /**
   * Switch this window to the folder, asking first when a chat works. Going back
   * (the note's Go back) leaves no note of its own on the project it returns to (S32).
   */
  async switchTo(target: vscode.Uri, options: { newWindow?: boolean; goingBack?: boolean } = {}): Promise<SwitchChoice | 'switched'> {
    if (options.newWindow) {
      this.pending = undefined;
      await vscode.commands.executeCommand('vscode.openFolder', target, { forceNewWindow: true });
      return 'new-window';
    }
    const choice = await this.ask(this.deps.nameOf(target.toString()));
    if (choice === 'cancel') {
      this.pending = undefined;
      return 'cancel';
    }
    if (choice === 'new-window') {
      this.pending = undefined;
      await vscode.commands.executeCommand('vscode.openFolder', target, { forceNewWindow: true });
      return 'new-window';
    }
    if (choice === 'switch-and-stop') await this.deps.stopWorkingChats();
    this.hold(target.toString(), options.goingBack ? 'forget' : 'remember');
    this.asked = { target: target.toString(), until: Date.now() + 10_000 };
    await vscode.commands.executeCommand('vscode.openFolder', target, { forceReuseWindow: true });
    return 'switched';
  }

  /**
   * The veto's question (patch 018): VS Code is about to reload this window
   * for another folder. True stops the reload. `target` is the folder when the
   * window knows it (Open Recent), undefined when only the main process does.
   *
   * The answer is this window's vote, not the outcome: another participant may stop the reload before or after it
   * (#623). So the notes wait for the window to go (`hold`). Stopping the chats can't wait: past `deactivate` a turn
   * can no longer be recorded as the person's stop, only as "Ritemark closed while this turn was running". So once the
   * person answers, the shell is asked whether its reload `attempt` still goes on (Sprint 152): when it was stopped
   * meanwhile, the window stays, and its chats go on working.
   */
  async beforeReload(target: unknown, attempt?: unknown): Promise<boolean> {
    const targetUri = typeof target === 'string' ? vscode.Uri.parse(target) : target instanceof vscode.Uri ? target : undefined;
    // switchTo's own reload: the guard is passed its folder (the host service notes it). Another folder is another
    // switch (switchTo's reload was stopped), asked about and held for itself.
    if (this.asked && Date.now() < this.asked.until && (!targetUri || sameFolder(targetUri.toString(), this.asked.target))) return false;
    const choice = await this.ask(targetUri ? this.deps.nameOf(targetUri.toString()) : null);
    if (choice === 'cancel' || (choice === 'new-window' && targetUri)) {
      this.pending = undefined;
      if (choice === 'new-window') await vscode.commands.executeCommand('vscode.openFolder', targetUri, { forceNewWindow: true });
      return true;
    }
    if (choice !== undefined && !(await reloadGoesOn(attempt))) {
      this.pending = undefined;
      return false;
    }
    if (choice !== undefined) await this.deps.stopWorkingChats();
    this.hold(targetUri?.toString() ?? null, targetUri ? 'remember' : 'leave');
    return false;
  }

  /**
   * Whether this window came from a switch in place, so it lands on Home (R9, S30): once, only right after the
   * switch, and only in the folder it opened (or, when the window did not know it, in any other folder). A note for
   * another window is left for it (#623).
   */
  static takeLanding(context: vscode.ExtensionContext, hereUri: string | null): boolean {
    const now = Date.now();
    return takeNote<Landing>(context.globalStorageUri.fsPath, LANDING_FILE, (note) => readLanding(note, hereUri, now)) !== null;
  }

  /** The note on the next window's Home: once, only right after a switch, and only in the folder it opened. */
  static takeSwitchedFrom(context: vscode.ExtensionContext, hereUri: string | null): SwitchedFrom | null {
    const now = Date.now();
    return takeNote<SwitchedFrom>(context.globalStorageUri.fsPath, SWITCHED_FROM_FILE, (note) => readSwitchedFrom(note, hereUri, now));
  }
}
