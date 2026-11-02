/**
 * Home and Tasks, always the first two tabs (Sprint 134, R5; W5).
 *
 * Every project window has Home and the Task board as its first two tabs,
 * pinned and drawn as icons (Jarmo, 16 October). Patch 019 keeps a pinned
 * Home or Task board tab first and permanent once it is there (Sprint 132,
 * R9); this module makes sure both are there, in that order, after the window
 * restores its tabs and whenever one goes, and returns the person to the tab
 * they were on. With the `task-board` flag off, Home stands first alone.
 *
 * A click on the Home place brings Home's tab forward, as the Tasks place
 * does for the board (Jarmo, 17 October: "when I click Tasks, the board
 * ALWAYS opens too"): `ritemark.placeClickedAgain` (patch 018) for a click on
 * the open place, the view becoming visible for the first click.
 *
 * Ported from the proof of concept (`poc/2.0-surfaces`, permanentTabs.ts),
 * with the order decision made pure (`planPermanentTabs`) and tested.
 */

import * as vscode from 'vscode';

// Sprint 152 (R7): the view types and Home's place are the frame manifest's, kept in one module the release check reads
import { BOARD_TAB_VIEW_TYPE, HOME_PLACE_ID, HOME_TAB_VIEW_TYPE } from '../frameIdentifiers';
export { BOARD_TAB_VIEW_TYPE, HOME_PLACE_ID, HOME_TAB_VIEW_TYPE };
export const TASKS_PLACE_ID = 'workbench.view.extension.ritemark-tasks';

export type PermanentKind = 'home' | 'board';

export interface TabFact {
  kind: PermanentKind | 'other';
  pinned: boolean;
}

/**
 * What to do with the first group's tabs, in order. Home: open it when it is
 * missing, or pin it and move it first when it is not; the board the same,
 * pinned after Home. With the board turned off, a board tab the window
 * restored goes. Empty when all is as it should be.
 */
export function planPermanentTabs(tabs: readonly TabFact[], boardEnabled: boolean): { kind: PermanentKind; action: 'open' | 'pin' | 'remove' }[] {
  const plan: { kind: PermanentKind; action: 'open' | 'pin' | 'remove' }[] = [];
  const homeIndex = tabs.findIndex((tab) => tab.kind === 'home');
  if (homeIndex < 0) plan.push({ kind: 'home', action: 'open' });
  else if (!tabs[homeIndex].pinned || homeIndex !== 0) plan.push({ kind: 'home', action: 'pin' });
  if (boardEnabled) {
    const boardIndex = tabs.findIndex((tab) => tab.kind === 'board');
    if (boardIndex < 0) plan.push({ kind: 'board', action: 'open' });
    else if (!tabs[boardIndex].pinned) plan.push({ kind: 'board', action: 'pin' });
  } else if (tabs.some((tab) => tab.kind === 'board')) {
    plan.push({ kind: 'board', action: 'remove' });
  }
  return plan;
}

function kindOf(tab: vscode.Tab): TabFact['kind'] {
  if (!(tab.input instanceof vscode.TabInputWebview)) return 'other';
  if (tab.input.viewType.endsWith(HOME_TAB_VIEW_TYPE)) return 'home';
  if (tab.input.viewType.endsWith(BOARD_TAB_VIEW_TYPE)) return 'board';
  return 'other';
}

function firstGroup(): vscode.TabGroup | undefined {
  return vscode.window.tabGroups.all.find((group) => group.viewColumn === vscode.ViewColumn.One);
}

/**
 * Bring a tab forward even when VS Code has not revived its webview yet (it
 * revives restored webviews only when shown): focus its group and open the
 * editor at its index, as Ctrl+1..9 does.
 */
async function revealTab(tab: vscode.Tab): Promise<void> {
  const index = tab.group.tabs.indexOf(tab);
  if (index < 0) return;
  if (tab.group.viewColumn === vscode.ViewColumn.One) await vscode.commands.executeCommand('workbench.action.focusFirstEditorGroup');
  await vscode.commands.executeCommand('workbench.action.openEditorAtIndex', index);
}

async function pinActive(first: boolean): Promise<void> {
  await vscode.commands.executeCommand('workbench.action.pinEditor');
  if (first) await vscode.commands.executeCommand('moveActiveEditor', { to: 'first', by: 'tab' });
}

export interface PermanentTabsDependencies {
  /** Open Home's tab in the first group, in front. */
  openHome: () => Promise<void>;
  /** Open the Task board's tab in the first group, in front. */
  openBoard: () => Promise<void>;
  boardEnabled: () => boolean;
  /** True once, in a window a switch in place opened: it lands on Home, not on the tab it was left with (R9). */
  landOnHome?: () => boolean;
  /**
   * Sprint 144 (P5, #569): this window was opened by a switch in place and lands on Home, so the first check runs at
   * once: the restored document it was left with is otherwise in front, its editor still loading, for the 800 ms wait.
   */
  landingPending?: boolean;
}

/** Make sure Home (first) and Tasks (second) are pinned in the first group. */
export async function ensurePermanentTabs(deps: PermanentTabsDependencies): Promise<void> {
  const land = deps.landOnHome?.() ?? false;
  const before = vscode.window.tabGroups.activeTabGroup.activeTab;
  const facts = () => (firstGroup()?.tabs ?? []).map((tab) => ({ tab, kind: kindOf(tab), pinned: tab.isPinned }));
  const plan = planPermanentTabs(facts(), deps.boardEnabled());
  if (plan.length === 0) {
    const home = land ? facts().find((fact) => fact.kind === 'home')?.tab : undefined;
    if (home && !home.isActive) await revealTab(home);
    return;
  }
  for (const step of plan) {
    const existing = facts().find((fact) => fact.kind === step.kind)?.tab;
    if (step.action === 'remove') {
      // S22: only the extension can close a permanent tab (patch 019), by disposing its panel, and VS Code revives
      // a restored webview only when it is shown. Shown, the board's serializer disposes it (the board is off).
      if (existing) await revealTab(existing);
      for (let waited = 0; facts().some((fact) => fact.kind === 'board') && waited < 3000; waited += 50) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      continue;
    }
    if (step.action === 'pin' && existing) await revealTab(existing);
    else if (step.kind === 'home') await deps.openHome();
    else await deps.openBoard();
    await pinActive(step.kind === 'home');
  }
  // The person goes back to the tab they were on; a window with nothing else opens on Home.
  const beforeKind = before ? kindOf(before) : 'other';
  if (before && beforeKind === 'other' && !land) {
    const again = vscode.window.tabGroups.all.flatMap((group) => group.tabs)
      .find((tab) => tab.label === before.label && tab.group.viewColumn === before.group.viewColumn && kindOf(tab) === 'other');
    if (again) await revealTab(again);
  } else {
    const home = facts().find((fact) => fact.kind === 'home')?.tab;
    if (home) await revealTab(home);
    // A window that had no tab of its own is a fresh project window: Home's place too (W5).
    if (!before) await vscode.commands.executeCommand('workbench.view.extension.ritemark-home');
  }
}

/** Run the check after the window restored its tabs, and again when Home or the board goes or is unpinned. */
export function registerPermanentTabs(deps: PermanentTabsDependencies): vscode.Disposable {
  let busy = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const check = (delay: number) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      timer = undefined;
      if (busy) return;
      busy = true;
      try {
        await ensurePermanentTabs(deps);
      } catch (error) {
        console.warn('[Permanent tabs] The check failed:', error);
      } finally {
        busy = false;
      }
    }, delay);
  };
  // The window's tabs are restored before the extension activates; the wait covers a slow restore in an ordinary start
  check(deps.landingPending ? 50 : 800);
  const listener = vscode.window.tabGroups.onDidChangeTabs((event) => {
    if (busy) return;
    const ours = (tab: vscode.Tab) => kindOf(tab) !== 'other';
    if (event.closed.some(ours) || event.changed.some((tab) => ours(tab) && !tab.isPinned)) check(400);
  });
  return {
    dispose: () => {
      listener.dispose();
      if (timer) clearTimeout(timer);
    },
  };
}

/** A click on a place that is already chosen (patch 018): Home and Tasks bring their tab forward. */
export function registerPlaceClicks(show: { home: () => Promise<void>; board: (() => Promise<void>) | null }): vscode.Disposable {
  return vscode.commands.registerCommand('ritemark.placeClickedAgain', async (placeId?: unknown) => {
    if (placeId === HOME_PLACE_ID) await show.home();
    else if (placeId === TASKS_PLACE_ID && show.board) await show.board();
  });
}
