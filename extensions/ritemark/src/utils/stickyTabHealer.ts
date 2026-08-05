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
}

export interface TabGroupLike {
  viewColumn: number;
  tabs: readonly TabLike[];
}

export interface StuckTabCandidate {
  /** The text tab's file URI (opaque — handed back to vscode.openWith). */
  uri: { path: string };
  isActive: boolean;
  isPinned: boolean;
  viewColumn: number;
}

/**
 * `resolveTextInput` abstracts `input instanceof vscode.TabInputText` +
 * scheme check (injected so tests need no vscode module): returns the tab's
 * file URI when the input is a plain TEXT editor on a file:// resource,
 * null otherwise (custom editors, diffs, untitled, webviews, notebooks).
 */
export function findStuckMarkdownTabs(
  tabGroups: readonly TabGroupLike[],
  resolveTextInput: (input: unknown) => { path: string } | null,
): StuckTabCandidate[] {
  const out: StuckTabCandidate[] = [];
  for (const group of tabGroups) {
    for (const tab of group.tabs) {
      const uri = resolveTextInput(tab.input);
      if (!uri) continue;
      if (!/\.(md|markdown)$/i.test(uri.path)) continue;
      out.push({ uri, isActive: tab.isActive, isPinned: tab.isPinned, viewColumn: group.viewColumn });
    }
  }
  return out;
}
