#!/usr/bin/env node
// Model-catalog autopublisher (Ritemark Sprint 127, R4).
//
// Each run reads Anthropic's model list with a Ritemark key and selects new
// Claude models. It runs the canary on every pinned Claude Code version and
// appends the models that pass to feeds/model-catalog.json. It only appends
// (assertAdditionsOnly): defaults, curation and tombstones stay with people.
//
// Switches: the repository variable MODEL_CATALOG_AUTOPUBLISH=on enables it,
// the secret MODEL_CATALOG_ANTHROPIC_API_KEY authenticates it, and
// MODEL_CATALOG_DRY_RUN=true runs everything but writes nothing.

import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { listModels as listAnthropicModels } from './anthropic.mjs';
import { isCoolingDown, newModels, nextCooldown, nextWatermark } from './candidates.mjs';
import { runCanary as runRealCanary } from './canary.mjs';
import { buildAutoRow } from './rows.mjs';
import { assertAdditionsOnly, assertSize, serializeCatalog, validateCatalog, validateConfig } from './schema.mjs';

export const FEED_PATH = 'feeds/model-catalog.json';
export const CONFIG_PATH = 'feeds/model-catalog.config.json';
export const STATE_DIR = '.catalog-state';

/**
 * One publishing pass over in-memory documents. Nothing here touches the disk
 * or the network except through the injected `listModels` and `runCanary`.
 */
export async function publishOnce({ catalog, config, cooldowns, apiKey, listModels, runCanary, now = Date.now(), log = () => {} }) {
  validateCatalog(catalog);
  validateConfig(config);
  const eligible = newModels(await listModels({ apiKey }), catalog, { watermark: config.watermark });
  const ready = eligible.filter((model) => !isCoolingDown(cooldowns[model.id], now)).slice(0, config.maxAdditionsPerRun);
  for (const model of eligible.filter((candidate) => !ready.includes(candidate))) {
    log(`${model.id}: waiting (${isCoolingDown(cooldowns[model.id], now) ? 'cooling down after a failed canary' : "over this run's cap"}).`);
  }
  if (ready.length === 0) {
    if (eligible.length === 0) log('No new Claude models.');
    return { catalog, config, cooldowns, added: [], failed: [] };
  }

  if (Date.parse(catalog.updatedAt) > now) {
    throw new Error(`${FEED_PATH} is dated ${catalog.updatedAt}, in the future; correct updatedAt before the publisher can append`);
  }
  // Second precision, like the rest of the feed.
  const publishedAt = new Date(now).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const anthropicRows = [...(catalog.providers.anthropic?.models ?? [])];
  const nextCooldowns = { ...cooldowns };
  const added = [];
  const failed = [];
  for (const model of ready) {
    const row = buildAutoRow(model, {
      anthropicRows,
      publishedAt,
      minAppVersion: config.autoRowMinAppVersion,
      maxOutputTokensCap: config.maxOutputTokensCap,
    });
    const results = [];
    for (const cliVersion of config.canary.claudeCodeVersions) {
      results.push(await runCanary({
        modelId: row.id,
        label: row.label,
        maxOutputTokens: row.claudeCode.maxOutputTokens,
        cliVersion,
        sdkVersion: config.canary.agentSdkVersion,
        apiKey,
      }));
    }
    if (results.length > 0 && results.every((result) => result.ok)) {
      log(`${row.id}: canary passed on Claude Code ${results.map((result) => result.cliVersion).join(', ')}.`);
      added.push({ model, row, results });
      anthropicRows.push(row);
      delete nextCooldowns[row.id];
    } else {
      const reasons = results.filter((result) => !result.ok).map((result) => `${result.cliVersion}: ${result.reason}`);
      log(`${row.id}: canary failed (${reasons.join('; ')}).`);
      failed.push({ model, results });
      nextCooldowns[row.id] = nextCooldown(cooldowns[row.id], now);
    }
  }

  if (added.length === 0) return { catalog, config, cooldowns: nextCooldowns, added, failed };

  const next = structuredClone(catalog);
  next.providers.anthropic ??= { defaults: {}, models: [] };
  next.providers.anthropic.models.push(...added.map((entry) => entry.row));
  next.updatedAt = publishedAt;
  validateCatalog(next);
  assertAdditionsOnly(catalog, next);
  assertSize(next);
  const publishedModels = added.map((entry) => entry.model);
  const pending = eligible.filter((model) => !publishedModels.includes(model));
  const nextConfig = { ...config, watermark: nextWatermark(config.watermark, publishedModels, pending) };
  return { catalog: next, config: nextConfig, cooldowns: nextCooldowns, added, failed };
}

export function commitMessage(added) {
  const ids = added.map((entry) => entry.row.id).join(', ');
  const lines = added.map((entry) => `- ${entry.row.id} ("${entry.row.label}"): ${entry.results
    .map((result) => `Claude Code ${result.cliVersion} passed in ${(result.durationMs / 1000).toFixed(1)} s`)
    .join(', ')}`);
  return `feed(model-catalog): auto-add ${ids}\n\n`
    + 'Canary: declared through settings.modelPicker to the pinned Claude Code, one tool-less turn.\n'
    + `${lines.join('\n')}\n`;
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    if (fallback !== undefined && error?.code === 'ENOENT') return fallback;
    throw error;
  }
}

/** The workflow entry point. Returns the process exit code. */
export async function main({
  env = process.env,
  cwd = process.cwd(),
  listModels = listAnthropicModels,
  runCanary = runRealCanary,
  now = Date.now(),
  log = (line) => console.log(line),
} = {}) {
  const dryRun = env.MODEL_CATALOG_DRY_RUN === 'true';
  if (env.MODEL_CATALOG_AUTOPUBLISH !== 'on' && !dryRun) {
    log('Model-catalog autopublish is off (MODEL_CATALOG_AUTOPUBLISH is not "on").');
    return 0;
  }
  const apiKey = env.MODEL_CATALOG_ANTHROPIC_API_KEY;
  if (!apiKey) {
    log('MODEL_CATALOG_ANTHROPIC_API_KEY is not configured.');
    return 1;
  }
  const root = resolve(cwd);
  const stateDir = join(root, STATE_DIR);
  const scratch = env.RUNNER_TEMP ?? tmpdir();
  const cooldowns = readJson(join(stateDir, 'cooldowns.json'), {});
  const outcome = await publishOnce({
    catalog: readJson(join(root, FEED_PATH)),
    config: readJson(join(root, CONFIG_PATH)),
    cooldowns,
    apiKey,
    listModels,
    runCanary: (input) => runCanary({ ...input, cacheDir: join(scratch, 'catalog-runtimes') }),
    now,
    log,
  });

  const changed = outcome.added.length > 0 && !dryRun;
  const stateChanged = JSON.stringify(outcome.cooldowns) !== JSON.stringify(cooldowns) && !dryRun;
  const outputs = { changed, failed: outcome.failed.length > 0, state_changed: stateChanged };
  if (stateChanged) {
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(join(stateDir, 'cooldowns.json'), `${JSON.stringify(outcome.cooldowns, null, 2)}\n`);
  }
  if (changed) {
    writeFileSync(join(root, FEED_PATH), serializeCatalog(outcome.catalog));
    writeFileSync(join(root, CONFIG_PATH), `${JSON.stringify(outcome.config, null, 2)}\n`);
    outputs.commit_message_file = join(scratch, 'model-catalog-commit-message.txt');
    writeFileSync(outputs.commit_message_file, commitMessage(outcome.added));
  } else if (dryRun && outcome.added.length > 0) {
    log(`Dry run: would add ${outcome.added.map((entry) => entry.row.id).join(', ')}; nothing written.`);
  }
  if (outcome.failed.length > 0) outputs.failed_models = outcome.failed.map((entry) => entry.model.id).join(', ');
  if (env.GITHUB_OUTPUT) {
    appendFileSync(env.GITHUB_OUTPUT, Object.entries(outputs).map(([key, value]) => `${key}=${value}\n`).join(''));
  }
  // A failed canary is reported by the workflow's last step, after any model
  // that passed in the same run has been committed.
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().then((code) => { process.exitCode = code; }, (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
