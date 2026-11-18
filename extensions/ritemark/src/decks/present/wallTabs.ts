/**
 * Sprint 163 (decks README "Present"): the tab each Tabs block on the wall's slide shows, chosen on the presenter view's
 * Now, by the block's place among the slide's Tabs blocks (from 0, as the renderer draws them); a block without a choice
 * shows its first tab. Not kept: a move starts every block at its first tab again, and nothing goes in the file.
 *
 * Pure and without imports, so the host's protocol and the presenter view read and write the same choice.
 */
export type WallTabs = number[];

/** A Tabs block's place on a slide, and a tab's in it: at most this. */
const MAX_TAB = 99;

export function isTab(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_TAB;
}

/** The tabs chosen, as the windows may get them: whole numbers, at most `MAX_TAB` + 1 of them, each at most `MAX_TAB`. */
export function tabsOf(value: unknown): WallTabs {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_TAB + 1).map(entry => (isTab(entry) ? entry : 0));
}

/** The tabs chosen with Tabs block `block` showing tab `tab` (the blocks before it keep theirs, or their first). */
export function withTab(tabs: readonly number[], block: number, tab: number): WallTabs {
  const next = tabsOf(tabs);
  if (!isTab(block) || !isTab(tab)) return next;
  while (next.length <= block) next.push(0);
  next[block] = tab;
  return next;
}
