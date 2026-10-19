/**
 * stickyTabHealer — Sprint 107 R3: pure candidate selection for the one-shot
 * "stuck markdown text tab" healer.
 *
 * Before R1 shipped, a first-ever `.md` open could land in the plain-text
 * editor and PIN itself there for that profile. On activation (once per
 * profile, globalState-marked) the extension reopens such tabs with
 * `ritemark.editor`. This module decides WHICH tabs qualify; the vscode
 * command orchestration stays in extension.ts so this stays unit-testable.
 */

/** Structural mirror of vscode.Tab — fabricated in tests. */
export interface TabLike {
  input: unknown;
  isActive: boolean;
  isPinned: boolean;
  isDirty?: boolean;
}

export interface TabGroupLike {
  viewColumn: number;
  tabs: readonly TabLike[];
}

export interface StuckTabCandidate<T extends TabLike = TabLike> {
  /** The text tab's file URI (opaque — handed back to vscode.openWith). */
  uri: { path: string };
  isActive: boolean;
  isPinned: boolean;
  viewColumn: number;
  /** The text tab itself, closed once the Ritemark editor has opened (#429). */
  tab: T;
  /**
   * Sprint 133 (R11, #429): the healer replaces the text tab instead of
   * opening the Ritemark editor beside it. A text tab with unsaved changes is
   * kept (closing it would ask to save); it stays beside the Ritemark tab.
   */
  replace: boolean;
}

/**
 * `resolveTextInput` abstracts `input instanceof vscode.TabInputText` +
 * scheme check (injected so tests need no vscode module): returns the tab's
 * file URI when the input is a plain TEXT editor on a file:// resource,
 * null otherwise (custom editors, diffs, untitled, webviews, notebooks).
 */
/**
 * Sprint 133 (#429): the text tab to close once the Ritemark editor has opened
 * for the same file. Looked up again after the open, because the extension
 * host can replace its tab objects when the tabs change, and a tab captured
 * before the open may no longer be closable. A dirty tab is left alone.
 */
export function findReplacedTextTab<T extends TabLike>(
  tabGroups: readonly { viewColumn: number; tabs: readonly T[] }[],
  resolveTextInput: (input: unknown) => { path: string } | null,
  target: { path: string; viewColumn: number },
): T | undefined {
  const group = tabGroups.find((candidate) => candidate.viewColumn === target.viewColumn);
  return group?.tabs.find((tab) => resolveTextInput(tab.input)?.path === target.path && tab.isDirty !== true);
}

export function findStuckMarkdownTabs<T extends TabLike>(
  tabGroups: readonly { viewColumn: number; tabs: readonly T[] }[],
  resolveTextInput: (input: unknown) => { path: string } | null,
): StuckTabCandidate<T>[] {
  const out: StuckTabCandidate<T>[] = [];
  for (const group of tabGroups) {
    for (const tab of group.tabs) {
      const uri = resolveTextInput(tab.input);
      if (!uri) continue;
      if (!/\.(md|markdown)$/i.test(uri.path)) continue;
      out.push({ uri, isActive: tab.isActive, isPinned: tab.isPinned, viewColumn: group.viewColumn, tab, replace: tab.isDirty !== true });
    }
  }
  return out;
}
