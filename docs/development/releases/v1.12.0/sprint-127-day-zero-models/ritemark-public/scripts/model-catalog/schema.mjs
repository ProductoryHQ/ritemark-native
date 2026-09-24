// Feed validation for the model-catalog publisher.
//
// Mirrors the Ritemark client's validateCatalog() (extensions/ritemark/src/ai/
// modelCatalog/schema.ts in ritemark-native) so the publisher never writes a
// document that clients would reject. Unknown providers are allowed here: the
// publisher must preserve what it does not own.

export const CLAUDE_MODEL_ID = /^claude-[a-z0-9]+(?:-[a-z0-9]+)*(?:\[1m\])?$/;
export const SIZE_CAP_BYTES = 512 * 1024;

const TIERS = new Set(['low', 'medium', 'high']);
const EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max', 'ultra']);
const PROVENANCE = new Set(['curated', 'auto']);
const MAX_DECLARED_OUTPUT_TOKENS = 1_000_000;

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(message) {
  throw new Error(`invalid catalog: ${message}`);
}

function isDate(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function validateEntry(entry, where, provider) {
  if (!isObject(entry)) fail(`${where} is not an object`);
  const { id, label, description, tier, deprecated, order, minAppVersion, thinkingEffort, provenance, addedAt, retired, claudeCode } = entry;
  if (typeof id !== 'string' || id.length === 0) fail(`${where}.id must be a non-empty string`);
  if (provider === 'anthropic' && !CLAUDE_MODEL_ID.test(id)) fail(`${where}.id must be a Claude model id`);
  if (typeof label !== 'string') fail(`${where}.label must be a string`);
  if (typeof description !== 'string') fail(`${where}.description must be a string`);
  if (!TIERS.has(tier)) fail(`${where}.tier must be low|medium|high`);
  if (typeof deprecated !== 'boolean') fail(`${where}.deprecated must be a boolean`);
  if (typeof order !== 'number' || !Number.isFinite(order)) fail(`${where}.order must be a finite number`);
  if (minAppVersion !== undefined && typeof minAppVersion !== 'string') fail(`${where}.minAppVersion must be a string`);
  if (thinkingEffort !== undefined) {
    if (!isObject(thinkingEffort) || !Array.isArray(thinkingEffort.levels) || !thinkingEffort.levels.every((level) => EFFORTS.has(level))) {
      fail(`${where}.thinkingEffort.levels must contain canonical effort values`);
    }
    if (new Set(thinkingEffort.levels).size !== thinkingEffort.levels.length) fail(`${where}.thinkingEffort.levels must be deduplicated`);
    if (thinkingEffort.defaultLevel !== undefined && !thinkingEffort.levels.includes(thinkingEffort.defaultLevel)) {
      fail(`${where}.thinkingEffort.defaultLevel must be included in levels`);
    }
  }
  if (provenance !== undefined && !PROVENANCE.has(provenance)) fail(`${where}.provenance must be curated|auto`);
  if (addedAt !== undefined && !isDate(addedAt)) fail(`${where}.addedAt must be a parseable ISO-8601 timestamp`);
  if (retired !== undefined && typeof retired !== 'boolean') fail(`${where}.retired must be a boolean`);
  if (claudeCode !== undefined) {
    if (provider !== 'anthropic') fail(`${where}.claudeCode is only valid on anthropic rows`);
    if (!isObject(claudeCode)) fail(`${where}.claudeCode must be an object`);
    if (claudeCode.inject !== undefined && typeof claudeCode.inject !== 'boolean') fail(`${where}.claudeCode.inject must be a boolean`);
    const max = claudeCode.maxOutputTokens;
    if (max !== undefined && (!Number.isSafeInteger(max) || max <= 0 || max > MAX_DECLARED_OUTPUT_TOKENS)) {
      fail(`${where}.claudeCode.maxOutputTokens must be a positive integer`);
    }
    if (claudeCode.behavesAs !== undefined && (typeof claudeCode.behavesAs !== 'string' || !CLAUDE_MODEL_ID.test(claudeCode.behavesAs))) {
      fail(`${where}.claudeCode.behavesAs must be a Claude model id`);
    }
  }
}

/** Throws on the first violation; returns the document unchanged. */
export function validateCatalog(doc) {
  if (!isObject(doc)) fail('root is not an object');
  if (doc.schemaVersion !== 1) fail(`schemaVersion must be 1 (got ${JSON.stringify(doc.schemaVersion)})`);
  if (!isDate(doc.updatedAt)) fail('updatedAt must be a parseable ISO-8601 timestamp');
  if (!isObject(doc.providers)) fail('providers must be an object');
  for (const [provider, catalog] of Object.entries(doc.providers)) {
    const where = `providers.${provider}`;
    if (!isObject(catalog)) fail(`${where} is not an object`);
    if (!Array.isArray(catalog.models)) fail(`${where}.models must be an array`);
    catalog.models.forEach((entry, index) => validateEntry(entry, `${where}.models[${index}]`, provider));
    const ids = catalog.models.map((entry) => entry.id);
    if (new Set(ids).size !== ids.length) fail(`${where}.models has duplicate ids`);
    if (catalog.defaults !== undefined) {
      if (!isObject(catalog.defaults)) fail(`${where}.defaults must be an object`);
      for (const [surface, id] of Object.entries(catalog.defaults)) {
        if (typeof id !== 'string') fail(`${where}.defaults.${surface} must be a string`);
      }
    }
  }
  return doc;
}

const VERSION = /^\d+\.\d+\.\d+$/;

/** feeds/model-catalog.config.json. Throws on the first violation. */
export function validateConfig(config) {
  const bad = (message) => { throw new Error(`invalid config: ${message}`); };
  if (!isObject(config)) bad('root is not an object');
  if (!isDate(config.watermark)) bad('watermark must be a parseable ISO-8601 timestamp');
  if (!Number.isSafeInteger(config.maxAdditionsPerRun) || config.maxAdditionsPerRun < 1) bad('maxAdditionsPerRun must be a positive integer');
  if (typeof config.autoRowMinAppVersion !== 'string' || !VERSION.test(config.autoRowMinAppVersion)) bad('autoRowMinAppVersion must be x.y.z');
  const cap = config.maxOutputTokensCap;
  if (!Number.isSafeInteger(cap) || cap < 1 || cap > MAX_DECLARED_OUTPUT_TOKENS) bad('maxOutputTokensCap must be a positive integer');
  if (!isObject(config.canary)) bad('canary must be an object');
  const versions = config.canary.claudeCodeVersions;
  if (!Array.isArray(versions) || versions.length === 0 || !versions.every((version) => typeof version === 'string' && VERSION.test(version))) {
    bad('canary.claudeCodeVersions must list at least one x.y.z version');
  }
  if (typeof config.canary.agentSdkVersion !== 'string' || !VERSION.test(config.canary.agentSdkVersion)) bad('canary.agentSdkVersion must be x.y.z');
  return config;
}

export function assertSize(doc) {
  const bytes = Buffer.byteLength(serializeCatalog(doc), 'utf8');
  if (bytes > SIZE_CAP_BYTES) fail(`document is ${bytes} bytes, over the ${SIZE_CAP_BYTES}-byte client cap`);
}

export function serializeCatalog(doc) {
  return `${JSON.stringify(doc, null, 2)}\n`;
}

/**
 * The publisher may only append automated Anthropic rows (R4). Any edit to an
 * existing row, a default, or another provider fails the run before commit.
 */
export function assertAdditionsOnly(before, after) {
  if (after.schemaVersion !== before.schemaVersion) fail('publisher changed schemaVersion');
  if (Date.parse(after.updatedAt) < Date.parse(before.updatedAt)) fail('publisher moved updatedAt backwards');
  const beforeProviders = Object.keys(before.providers).sort();
  const afterProviders = Object.keys(after.providers).sort();
  if (JSON.stringify(beforeProviders) !== JSON.stringify(afterProviders)) fail('publisher added or removed a provider');
  for (const provider of beforeProviders) {
    if (provider === 'anthropic') continue;
    if (JSON.stringify(before.providers[provider]) !== JSON.stringify(after.providers[provider])) {
      fail(`publisher changed provider ${provider}`);
    }
  }
  const beforeAnthropic = before.providers.anthropic ?? { models: [], defaults: {} };
  const afterAnthropic = after.providers.anthropic ?? { models: [], defaults: {} };
  if (JSON.stringify(beforeAnthropic.defaults ?? {}) !== JSON.stringify(afterAnthropic.defaults ?? {})) {
    fail('publisher changed an Anthropic default');
  }
  const afterById = new Map(afterAnthropic.models.map((row) => [row.id, row]));
  for (const row of beforeAnthropic.models) {
    const kept = afterById.get(row.id);
    if (!kept || JSON.stringify(kept) !== JSON.stringify(row)) fail(`publisher changed or removed ${row.id}`);
  }
  const beforeIds = new Set(beforeAnthropic.models.map((row) => row.id));
  for (const row of afterAnthropic.models.filter((candidate) => !beforeIds.has(candidate.id))) {
    if (row.provenance !== 'auto') fail(`${row.id}: an added row must be provenance auto`);
    if (row.claudeCode?.inject !== true) fail(`${row.id}: an added row must be declared to Claude Code`);
    if (row.claudeCode?.behavesAs !== undefined) fail(`${row.id}: automation never sets behavesAs`);
    if (row.retired !== undefined) fail(`${row.id}: automation never adds tombstones`);
    if (typeof row.minAppVersion !== 'string') fail(`${row.id}: an added row must carry minAppVersion`);
  }
}
