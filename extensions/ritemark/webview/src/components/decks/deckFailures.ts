type DeckFailureOutcome = { kind: 'failure'; text: string } | { kind: 'success' }

/** Keep each failed operation visible until that operation succeeds. */
export function updateDeckFailures(
  failures: ReadonlyMap<string, string>,
  operation: string,
  outcome: DeckFailureOutcome,
): ReadonlyMap<string, string> {
  if (outcome.kind === 'failure') {
    if (failures.get(operation) === outcome.text) return failures
    return new Map(failures).set(operation, outcome.text)
  }
  if (!failures.has(operation)) return failures
  const remaining = new Map(failures)
  remaining.delete(operation)
  return remaining
}
