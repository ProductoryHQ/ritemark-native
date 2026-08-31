export type ThreeWaySyncState = 'synced' | 'local-only' | 'external-only' | 'converged' | 'conflict';

export interface ThreeWaySnapshot {
  baseDiskHash: string;
  baseModelHash: string;
  diskHash: string;
  modelHash: string;
}

export interface InitialThreeWayState {
  baseDiskLogicalHash: string;
  baseModelHash: string;
  state: 'synced' | 'local-only';
}

export interface ViewResolutionReceipt {
  visible: boolean;
  disposed: boolean;
  acknowledgedRevision: number;
}

export type StaleViewEditDisposition = 'already-current' | 'materialize-conflict' | 'reject';

export interface LocalSaveEcho {
  remainingHashes: string[];
  state: 'synced' | 'local-only';
}

/**
 * Match a disk snapshot to content captured by VS Code immediately before a
 * local save. The model may already have advanced again by the time those bytes
 * become observable on disk; that is save lag, not a two-writer conflict.
 *
 * Use the newest matching occurrence so a collapsed sequence of saves retires
 * every older pending snapshot while preserving any later save still in flight.
 */
export function consumeLocalSaveEcho(
  pendingHashes: readonly string[],
  diskHash: string,
  modelHash: string,
): LocalSaveEcho | undefined {
  const matchIndex = pendingHashes.lastIndexOf(diskHash);
  if (matchIndex < 0) return undefined;
  return {
    remainingHashes: pendingHashes.slice(matchIndex + 1),
    state: diskHash === modelHash ? 'synced' : 'local-only',
  };
}

/**
 * Decide whether a full-document edit from an older visible revision can be
 * preserved safely. If the current model still equals disk, the stale view and
 * disk are the two independent descendants and can be materialized as a normal
 * conflict. A dirty/current model means a third version exists, so replacing it
 * would lose peer or local work and must be rejected.
 */
export function classifyStaleViewEdit(
  currentModelHash: string,
  currentDiskHash: string | undefined,
  staleViewHash: string,
): StaleViewEditDisposition {
  if (staleViewHash === currentModelHash) return 'already-current';
  if (currentDiskHash !== undefined && currentModelHash === currentDiskHash) return 'materialize-conflict';
  return 'reject';
}

export function normalizeLogicalText(content: string): string {
  return content.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

export function classifyThreeWay(snapshot: ThreeWaySnapshot): ThreeWaySyncState {
  const diskChanged = snapshot.diskHash !== snapshot.baseDiskHash;
  const modelChanged = snapshot.modelHash !== snapshot.baseModelHash;

  if (!diskChanged && !modelChanged) return 'synced';
  if (!diskChanged && modelChanged) return 'local-only';
  if (diskChanged && !modelChanged) return 'external-only';
  return snapshot.diskHash === snapshot.modelHash ? 'converged' : 'conflict';
}

/**
 * Anchor a newly attached custom editor to the confirmed disk snapshot.
 *
 * A TextDocument can already be dirty when Ritemark attaches (for example,
 * after reopening it with a different editor or adding a split view). Treating
 * that dirty model as its own base would let the next external write look like
 * a clean disk-only change and overwrite the pre-existing local work.
 */
export function initializeThreeWayState(
  diskHash: string,
  modelHash: string,
  modelIsDirty: boolean,
): InitialThreeWayState {
  if (diskHash === modelHash) {
    return { baseDiskLogicalHash: diskHash, baseModelHash: modelHash, state: 'synced' };
  }
  if (modelIsDirty) {
    return { baseDiskLogicalHash: diskHash, baseModelHash: diskHash, state: 'local-only' };
  }
  // A clean model can briefly lag a disk write while VS Code's file service is
  // catching up. Anchor both bases to that clean model so the first immediate
  // reconcile classifies the disk snapshot as external-only and imports it.
  return { baseDiskLogicalHash: modelHash, baseModelHash: modelHash, state: 'synced' };
}

export function classifyAcceptedModelEdit(
  baseModelHash: string,
  modelHash: string,
  conflictActive: boolean,
  resolutionPending: boolean,
): 'synced' | 'local-only' | 'conflict' {
  if (conflictActive && !resolutionPending) return 'conflict';
  return modelHash === baseModelHash ? 'synced' : 'local-only';
}

export function canCompleteViewResolution(
  revision: number,
  views: readonly ViewResolutionReceipt[],
): boolean {
  return views
    .filter(view => view.visible && !view.disposed)
    .every(view => view.acknowledgedRevision >= revision);
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
