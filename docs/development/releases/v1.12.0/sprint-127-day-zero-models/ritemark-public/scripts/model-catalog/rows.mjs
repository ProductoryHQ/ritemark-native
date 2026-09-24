// Building an automated feed row from a /v1/models entry (R4).
//
// Deterministic: the same model and feed always produce the same row. The row
// is declared to Claude Code (claudeCode.inject) with an output budget, never
// with a behavior profile (behavesAs), and never becomes a default.

const FAMILY_TIER = { opus: 'high', fable: 'high', mythos: 'high', sonnet: 'medium', haiku: 'low' };
const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'];

export function familyOf(id) {
  return /^claude-([a-z]+)/.exec(id)?.[1] ?? 'unknown';
}

export function labelOf(model) {
  const name = String(model.display_name ?? model.id).trim().replace(/^Claude\s+/i, '');
  return name.length > 0 ? name : model.id;
}

export function descriptionOf(family) {
  return family in FAMILY_TIER
    ? `Newest ${family[0].toUpperCase()}${family.slice(1)} model`
    : 'New Anthropic model';
}

/** Just before the family's current head (lowest order); unknown family last. */
export function orderFor(family, anthropicRows) {
  const sameFamily = anthropicRows.filter((row) => familyOf(row.id) === family && !row.retired);
  if (sameFamily.length > 0) return Math.min(...sameFamily.map((row) => row.order)) - 0.5;
  return Math.max(-1, ...anthropicRows.map((row) => row.order)) + 1;
}

/** Capability tree → effort levels; unsupported effort means Auto only. */
export function effortOf(capabilities) {
  const effort = capabilities?.effort;
  if (typeof effort !== 'object' || effort === null) return undefined;
  if (effort.supported !== true) return { levels: [] };
  return { levels: EFFORT_LEVELS.filter((level) => effort[level]?.supported === true) };
}

export function buildAutoRow(model, { anthropicRows, publishedAt, minAppVersion, maxOutputTokensCap }) {
  const family = familyOf(model.id);
  const effort = effortOf(model.capabilities);
  const maxOutputTokens = Number.isSafeInteger(model.max_tokens) && model.max_tokens > 0
    ? Math.min(model.max_tokens, maxOutputTokensCap)
    : undefined;
  return {
    id: model.id,
    label: labelOf(model),
    description: descriptionOf(family),
    tier: FAMILY_TIER[family] ?? 'medium',
    deprecated: false,
    order: orderFor(family, anthropicRows),
    minAppVersion,
    ...(effort ? { thinkingEffort: effort } : {}),
    provenance: 'auto',
    addedAt: publishedAt,
    claudeCode: { inject: true, ...(maxOutputTokens ? { maxOutputTokens } : {}) },
  };
}
