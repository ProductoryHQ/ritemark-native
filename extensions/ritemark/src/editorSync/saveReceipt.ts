const RITEMARK_SAVED_LOGICAL_HASH = Symbol.for('ritemark.savedLogicalHash');
const SHA256_HEX = /^[a-f0-9]{64}$/;

/**
 * Read the save-scoped receipt supplied by the Ritemark VS Code shell patch.
 * Standard VS Code builds do not expose it, so absence must remain
 * conservative: callers cannot claim that a disk write was local.
 */
export function readRitemarkSavedLogicalHash(document: object): string | undefined {
  const value = (document as Record<symbol, unknown>)[RITEMARK_SAVED_LOGICAL_HASH];
  return typeof value === 'string' && SHA256_HEX.test(value) ? value : undefined;
}

export const ritemarkSavedLogicalHashSymbol = RITEMARK_SAVED_LOGICAL_HASH;
