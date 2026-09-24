/**
 * Print the bundled model catalog as ritemark-public's feed document
 * (Sprint 127, R4/R8). Bootstraps `feeds/model-catalog.json` and, at each
 * shell release, refreshes it so clients on older builds stay current.
 *
 *   cd extensions/ritemark
 *   npx tsx scripts/export-bundled-model-catalog.ts \
 *     [--merge <current feeds/model-catalog.json>] [--updated-at <ISO-8601>] > /tmp/model-catalog.json
 *
 * --merge keeps the feed's automated rows and tombstones (rules in
 * src/ai/modelCatalog/feedExport.ts). Write to a temporary file first: a shell
 * redirect onto the merged file would empty it before it is read.
 */

import * as fs from 'fs';
import { BUNDLED_CATALOG } from '../src/ai/modelCatalog/bundledCatalog';
import { buildPublishedFeed } from '../src/ai/modelCatalog/feedExport';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`--${name} needs a value`);
  return value;
}

const mergePath = option('merge');
const current: unknown = mergePath ? JSON.parse(fs.readFileSync(mergePath, 'utf8')) : undefined;
const updatedAt = option('updated-at') ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
process.stdout.write(`${JSON.stringify(buildPublishedFeed(BUNDLED_CATALOG, current, updatedAt), null, 2)}\n`);
