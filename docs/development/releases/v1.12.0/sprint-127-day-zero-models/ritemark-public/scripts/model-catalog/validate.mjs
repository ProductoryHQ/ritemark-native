#!/usr/bin/env node
// Validate the published feed and the publisher config.
//
//   node scripts/model-catalog/validate.mjs                 # schema, size cap, config
//   node scripts/model-catalog/validate.mjs --base <ref>    # and: only appended auto rows since <ref> (S21)

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { assertAdditionsOnly, assertSize, validateCatalog, validateConfig } from './schema.mjs';

const FEED_PATH = 'feeds/model-catalog.json';
const CONFIG_PATH = 'feeds/model-catalog.config.json';

const baseIndex = process.argv.indexOf('--base');
const base = baseIndex >= 0 ? process.argv[baseIndex + 1] : undefined;
if (baseIndex >= 0 && !base) throw new Error('--base needs a git ref');

const feed = JSON.parse(readFileSync(FEED_PATH, 'utf8'));
validateCatalog(feed);
assertSize(feed);
validateConfig(JSON.parse(readFileSync(CONFIG_PATH, 'utf8')));
if (base) {
  const before = JSON.parse(execFileSync('git', ['show', `${base}:${FEED_PATH}`], { encoding: 'utf8' }));
  assertAdditionsOnly(before, feed);
}
console.log(`${FEED_PATH} is valid${base ? ` and only appends to ${base}` : ''}.`);
