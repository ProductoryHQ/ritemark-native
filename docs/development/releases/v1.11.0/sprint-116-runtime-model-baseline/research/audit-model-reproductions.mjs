// Replay captured public/sanitized inputs against unchanged product code.
// No account reads or network calls are needed for this reproduction.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const evidence = path.join(path.dirname(fileURLToPath(import.meta.url)), 'evidence');
const read = name => JSON.parse(fs.readFileSync(path.join(evidence, name), 'utf8'));
const require = createRequire(path.resolve('extensions/ritemark/package.json'));
const { discoverCodex } = require(path.resolve('extensions/ritemark/src/ai/modelCatalog/providerDiscovery.ts'));
const { resolveAll } = require(path.resolve('extensions/ritemark/src/ai/modelCatalog/resolver.ts'));
const { BUNDLED_CATALOG } = require(path.resolve('extensions/ritemark/src/ai/modelCatalog/bundledCatalog.ts'));
const captured = read('codex-cache-shape-reproduction.json');
const syntheticCache = { models: captured.rows.map((row, priority) => ({ slug: row.id, visibility: 'list', priority, default_reasoning_level: row.expectedDefault, supported_reasoning_levels: row.expectedLevels.map(effort => ({ effort })) })) };
const originalRead = fs.readFileSync;
let discovered;
try {
  fs.readFileSync = function (file, ...args) { return typeof file === 'string' && file.endsWith('/.codex/models_cache.json') ? JSON.stringify(syntheticCache) : originalRead.call(this, file, ...args); };
  discovered = await discoverCodex();
} finally { fs.readFileSync = originalRead; }
const oldCatalog = read('published-model-catalog.json').data;
const models = read('candidate-effort-models.json').codex;
const newest = models.find(model => model.isDefault);
const candidate = structuredClone(BUNDLED_CATALOG);
candidate.updatedAt = '2026-09-13T09:00:00Z';
candidate.providers.codex.models.unshift({ id: newest.id, label: newest.displayName, description: 'Captured candidate runtime model', tier: 'high', deprecated: false, order: -1 });
const cases = [
  ['remote only', oldCatalog, null],
  ['cache only', null, oldCatalog],
  ['remote and cache', oldCatalog, oldCatalog],
].map(([name, remote, cache]) => {
  const resolved = resolveAll({}, remote, cache, candidate, '1.11.0').codex;
  return { name, source: resolved.source, newBundledModelVisible: resolved.models.some(model => model.id === newest.id), ids: resolved.models.map(model => model.id) };
});
const result = { capturedAt: new Date().toISOString(), inputs: 'Previously captured sanitized cache shape and published catalog', cacheEffort: { modelsReturned: discovered?.length ?? 0, modelsWithEffort: discovered?.filter(model => model.thinkingEffort).length ?? 0 }, staticCatalogCases: cases };
fs.writeFileSync(path.join(evidence, 'model-reproduction-check.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
