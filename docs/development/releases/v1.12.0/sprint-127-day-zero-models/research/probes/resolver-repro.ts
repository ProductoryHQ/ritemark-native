/**
 * Sprint 127 reproduction: why a newly released Anthropic model never reaches
 * the Claude Code picker. Runs the UNCHANGED resolver against real inputs:
 *  - CLI 2.1.270 supportedModels() rows captured by Sprint 116 (Max account),
 *  - the published remote feed as of 2026-09-24,
 *  - a hypothetical fresh feed that adds claude-opus-5-5,
 *  - the shipped bundled catalog.
 *
 * Run from the repository root:  npx -y tsx <this file>
 */
import * as fs from 'fs';
import * as path from 'path';
import { findModelEntry, isCatalogAtLeastAsFresh, resolveAll } from '../../../../../../../extensions/ritemark/src/ai/modelCatalog/resolver';
import { validateCatalog, type ModelCatalog, type ModelEntry } from '../../../../../../../extensions/ritemark/src/ai/modelCatalog/schema';
import { BUNDLED_CATALOG } from '../../../../../../../extensions/ritemark/src/ai/modelCatalog/bundledCatalog';

const ROOT = process.cwd();
const SPRINT = path.join(ROOT, 'docs/development/releases/v1.12.0/sprint-127-day-zero-models');
const APP_VERSION = '1.12.0';
const NEW_MODEL = 'claude-opus-5-5';

// CLI 2.1.270 supportedModels(), mapped exactly as providerDiscovery.discoverAnthropic() maps SDK rows.
const cliRows = JSON.parse(fs.readFileSync(path.join(
  ROOT,
  'docs/development/releases/v1.11.0/sprint-116-runtime-model-baseline/research/evidence/candidate-effort-models.json',
), 'utf-8')).claude as Array<{ id: string; resolvedModel?: string; displayName: string; supportsEffort?: boolean; supportedEffortLevels?: string[] }>;
const oauthLive: ModelEntry[] = cliRows.map((m, i) => ({
  id: m.id, label: m.displayName, description: '', tier: 'medium', deprecated: false, order: i,
  ...(m.supportsEffort === undefined ? {} : { thinkingEffort: { levels: (m.supportsEffort ? m.supportedEffortLevels ?? [] : []) as never } }),
  ...(m.resolvedModel ? { resolvedModel: m.resolvedModel } : {}),
}));

// API-key user: GET /v1/models is the provider-cadence list (id + display_name).
const apiKeyLive: ModelEntry[] = [
  [NEW_MODEL, 'Claude Opus 5.5'], ['claude-fable-5-1', 'Claude Fable 5.1'], ['claude-opus-5', 'Claude Opus 5'],
  ['claude-sonnet-5', 'Claude Sonnet 5'], ['claude-haiku-4-5-20251001', 'Claude Haiku 4.5'],
].map(([id, label], i) => ({ id, label, description: '', tier: 'medium', deprecated: false, order: i }));

const publishedFeed = validateCatalog(JSON.parse(fs.readFileSync(
  path.join(SPRINT, 'research/evidence/published-feed-2026-09-24.json'), 'utf-8',
)));

// What a launch-day publish would look like: the bundled lineup plus the new model, fresh timestamp.
const freshFeed: ModelCatalog = {
  schemaVersion: 1,
  updatedAt: '2026-09-24T08:00:00Z',
  providers: {
    ...BUNDLED_CATALOG.providers,
    anthropic: {
      defaults: BUNDLED_CATALOG.providers.anthropic!.defaults,
      models: [
        { id: NEW_MODEL, label: 'Opus 5.5', description: 'Newest Opus model', tier: 'high', deprecated: false, order: 0.5 },
        ...BUNDLED_CATALOG.providers.anthropic!.models,
      ],
    },
  },
};

function show(name: string, live: ModelEntry[] | null, remote: ModelCatalog | null) {
  const r = resolveAll({ anthropic: live }, remote, remote, BUNDLED_CATALOG, APP_VERSION).anthropic;
  const visible = findModelEntry(r.models, NEW_MODEL) !== undefined;
  console.log(`\n## ${name}`);
  console.log(`source=${r.source}  ${NEW_MODEL} visible=${visible}`);
  console.log('rows:', r.models.map((m) => (m.resolvedModel ? `${m.id}→${m.resolvedModel}` : m.id)).join(', '));
}

console.log(`published feed updatedAt=${publishedFeed.updatedAt}; bundled updatedAt=${BUNDLED_CATALOG.updatedAt}`);
console.log(`published feed eligible (>= bundled)? ${isCatalogAtLeastAsFresh(publishedFeed, BUNDLED_CATALOG)}`);
console.log(`published feed lists ${NEW_MODEL}? ${publishedFeed.providers.anthropic?.models.some((m) => m.id === NEW_MODEL)}`);

show('A. OAuth user today (CLI supportedModels live + published feed)', oauthLive, publishedFeed);
show('B. OAuth user after a FRESH feed that lists Opus 5.5', oauthLive, freshFeed);
show('C. OAuth user, live probe unavailable (no workspace / timeout) + fresh feed', null, freshFeed);
show('D. OAuth user, live probe unavailable + published (stale) feed', null, publishedFeed);
show('E. API-key user (/v1/models live)', apiKeyLive, publishedFeed);
