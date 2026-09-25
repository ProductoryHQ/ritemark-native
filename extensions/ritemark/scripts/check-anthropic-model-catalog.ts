/**
 * Pre-release check of Anthropic's Claude Code model catalog (Sprint 127 R10).
 *
 *   cd extensions/ritemark && npm run check:anthropic-models
 *
 * Exits 1 with ALERT lines when the catalog cannot be read, has changed shape
 * or expired, or lists a model that needs a newer Claude Code than the one in
 * binaries/agents/manifest.json. A `main` model missing from the bundled
 * lineup is a WARNING and keeps exit code 0. The app never reads this catalog.
 * Rules: src/ai/modelCatalog/anthropicCatalogCheck.ts.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  ANTHROPIC_MODEL_CATALOG_URL,
  bundledClaudeCodeVersions,
  checkAnthropicCatalog,
  parseAnthropicCatalog,
  type AnthropicCatalog,
} from '../src/ai/modelCatalog/anthropicCatalogCheck';
import { BUNDLED_CATALOG } from '../src/ai/modelCatalog/bundledCatalog';

const FETCH_TIMEOUT_MS = 20_000;
const MANIFEST_PATH = path.join(__dirname, '..', 'binaries', 'agents', 'manifest.json');

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function main(): Promise<number> {
  let raw: unknown;
  try {
    const response = await fetch(ANTHROPIC_MODEL_CATALOG_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    raw = await response.json();
  } catch (error) {
    console.error(`ALERT: Anthropic's model catalog could not be read from ${ANTHROPIC_MODEL_CATALOG_URL} (${reason(error)}).`);
    console.error('       The URL may have moved. New models then reach Ritemark only through a Claude Code update; check before releasing.');
    return 1;
  }

  let catalog: AnthropicCatalog;
  try {
    catalog = parseAnthropicCatalog(raw, Date.now());
  } catch (error) {
    console.error(`ALERT: Anthropic's model catalog is not in the expected format: ${reason(error)}.`);
    console.error('       Update src/ai/modelCatalog/anthropicCatalogCheck.ts (and its test) before releasing.');
    return 1;
  }

  const versions = bundledClaudeCodeVersions(JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')));
  const bundledIds = (BUNDLED_CATALOG.providers.anthropic?.models ?? []).map((model) => model.id);
  const result = checkAnthropicCatalog({ catalog, claudeCodeVersions: versions, bundledModelIds: bundledIds });

  console.log(`Anthropic model catalog v${catalog.version}, issued ${catalog.issuedAt}, expires ${catalog.expiresAt}.`);
  console.log(`Bundled Claude Code: ${versions.join(', ') || '<none>'}.`);
  console.log(`Main models: ${result.mainModels
    .map((model) => `${model.name} (${model.id}${model.minClaudeCodeVersion ? `, needs ${model.minClaudeCodeVersion}+` : ''})`)
    .join('; ')}.`);
  for (const warning of result.warnings) console.warn(`WARNING: ${warning}`);
  for (const alert of result.alerts) console.error(`ALERT: ${alert}`);
  if (result.alerts.length > 0) return 1;
  console.log('OK: the bundled Claude Code supports every model in Anthropic\'s Claude Code catalog.');
  return 0;
}

main().then((code) => process.exit(code), (error) => {
  console.error(`ALERT: the check itself failed: ${reason(error)}`);
  process.exit(1);
});
