/**
 * Sprint 148 (R1, R4): what the host hands the worker, without `vscode`, so tests can run it.
 */

export type FsEvent = { kind: 'created' | 'changed' | 'deleted'; path: string };

/** The person's `files.exclude` patterns that are on (`true`); a `when` clause is left to VS Code's tree. */
export function enabledPatterns(setting: unknown): string[] {
  if (!setting || typeof setting !== 'object') return [];
  return Object.entries(setting as Record<string, unknown>)
    .filter(([, value]) => value === true)
    .map(([pattern]) => pattern);
}

/** Merges a batch of events: the last word on each path wins, and a create then a change stays a create. */
export function mergeEvents(events: readonly FsEvent[]): FsEvent[] {
  const byPath = new Map<string, FsEvent>();
  for (const event of events) {
    const previous = byPath.get(event.path);
    if (previous?.kind === 'created' && event.kind === 'changed') continue;
    byPath.delete(event.path);
    byPath.set(event.path, event);
  }
  return [...byPath.values()];
}
