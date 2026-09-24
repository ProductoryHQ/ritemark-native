// Which models Anthropic lists that the feed should gain (R4).

const CLAUDE_ID = /^claude-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATED_SNAPSHOT = /^(.*)-(\d{8})$/;
const HOUR = 60 * 60 * 1000;

/**
 * New Claude models, oldest first: listed by Anthropic, absent from the feed
 * (tombstones count as present), created after the watermark (no legacy
 * backfill), and not a dated snapshot of a model already known or listed.
 */
export function newModels(models, catalog, { watermark }) {
  const since = Date.parse(watermark);
  if (!Number.isFinite(since)) throw new Error('config.watermark must be an ISO-8601 timestamp');
  const known = new Set((catalog.providers.anthropic?.models ?? []).map((row) => row.id));
  const listed = new Set(models.map((model) => model?.id).filter((id) => typeof id === 'string'));
  return models
    .filter((model) => typeof model?.id === 'string' && CLAUDE_ID.test(model.id))
    .filter((model) => !known.has(model.id))
    .filter((model) => !isDatedSnapshotOf(model.id, known, listed))
    .filter((model) => Date.parse(model.created_at) > since)
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id));
}

function isDatedSnapshotOf(id, known, listed) {
  const match = DATED_SNAPSHOT.exec(id);
  return match !== null && (known.has(match[1]) || listed.has(match[1]));
}

/** A candidate whose canary failed waits until its cooldown has passed. */
export function isCoolingDown(entry, now = Date.now()) {
  return entry !== undefined && Number.isFinite(entry.retryAfter) && entry.retryAfter > now;
}

/** Backoff after a failed canary: 1 h, doubling, at most 24 h. */
export function nextCooldown(previous, now = Date.now()) {
  const failures = (previous?.failures ?? 0) + 1;
  return { failures, retryAfter: now + Math.min(HOUR * 2 ** (failures - 1), 24 * HOUR) };
}

/**
 * The watermark moves up to the newest published model, but stays below every
 * model still pending (failed, cooling down, or over this run's cap) so the
 * next run still sees it. It never moves backwards.
 */
export function nextWatermark(current, published, pending) {
  const base = Date.parse(current);
  let next = Math.max(base, ...published.map((model) => Date.parse(model.created_at)));
  for (const model of pending) next = Math.min(next, Date.parse(model.created_at) - 1);
  return new Date(Math.max(base, next)).toISOString();
}
