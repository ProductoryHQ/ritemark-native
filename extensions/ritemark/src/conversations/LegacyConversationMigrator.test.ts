import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConversationStore } from './ConversationStore';
import { LegacyConversationMigrator, type LegacyConversationCandidateV1 } from './LegacyConversationMigrator';
import { resolveProjectScope, unassignedLegacyScope } from './projectScope';

interface FixtureEntry { key: string; value?: unknown; rawValue?: string }

function fixture(name: string): { currentScope: { platform: NodeJS.Platform; workspaceFileUri: string | null; folderUris: string[] }; legacyEntries: FixtureEntry[] } {
  return JSON.parse(fs.readFileSync(path.resolve(
    __dirname,
    `../../../../docs/development/releases/v1.10.0/sprint-109-durable-chat-history/research/fixtures/${name}.json`,
  ), 'utf8'));
}

function candidates(entries: FixtureEntry[]): { candidates: LegacyConversationCandidateV1[]; issues: string[] } {
  const result: LegacyConversationCandidateV1[] = [];
  const issues: string[] = [];
  const metadataEntries = entries.filter((entry) => entry.key.endsWith('metadata') && Array.isArray(entry.value));
  const dataEntries = entries.filter((entry) => !entry.key.endsWith('metadata') && !entry.key.endsWith('open-threads'));
  const consumed = new Set<string>();
  for (const metadataEntry of metadataEntries) {
    for (const rawMeta of metadataEntry.value as unknown[]) {
      const meta = rawMeta as Record<string, unknown>;
      if (typeof meta.id !== 'string') { issues.push('invalid-metadata'); continue; }
      const prefix = metadataEntry.key.slice(0, -'metadata'.length);
      const dataEntry = dataEntries.find((entry) => entry.key === `${prefix}${meta.id}`);
      if (!dataEntry?.value) { issues.push('missing-record-data'); continue; }
      consumed.add(dataEntry.key);
      result.push({
        sourceKey: dataEntry.key,
        sourceId: meta.id,
        title: typeof meta.title === 'string' ? meta.title : undefined,
        agentId: typeof meta.agentId === 'string' ? meta.agentId : undefined,
        createdAt: typeof meta.createdAt === 'number' ? meta.createdAt : undefined,
        updatedAt: typeof meta.updatedAt === 'number' ? meta.updatedAt : undefined,
        data: dataEntry.value,
      });
    }
  }
  for (const entry of dataEntries) {
    if (consumed.has(entry.key)) continue;
    if (entry.rawValue !== undefined) { issues.push('invalid-json'); continue; }
    const data = entry.value as Record<string, unknown> | undefined;
    if (!data || typeof data.id !== 'string') continue;
    result.push({
      sourceKey: entry.key,
      sourceId: data.id,
      title: typeof data.title === 'string' ? data.title : undefined,
      agentId: typeof data.agentId === 'string' ? data.agentId : undefined,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : undefined,
      updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : undefined,
      data,
    });
  }
  return { candidates: result, issues };
}

async function run(): Promise<void> {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-legacy-migration-'));
  try {
    const known = fixture('known-scoped');
    const knownScope = resolveProjectScope(known.currentScope);
    const knownStore = new ConversationStore(path.join(temp, 'known'));
    const knownMigrator = new LegacyConversationMigrator(knownStore);
    const knownCandidates = candidates(known.legacyEntries).candidates;
    const first = await knownMigrator.importBatch(knownCandidates, knownScope);
    assert.equal(first.currentScopeCount, 2);
    assert.equal(first.unassignedCount, 0);
    assert.equal((await knownStore.list(knownScope.scopeId)).length, 2);
    const second = await knownMigrator.importBatch(knownCandidates, knownScope);
    assert.equal(second.created.length, 0, 'second migration is idempotent');
    assert.equal(second.deduplicated.length, 2);

    const global = fixture('global-duplicate-malformed');
    const globalScope = resolveProjectScope(global.currentScope);
    const globalStore = new ConversationStore(path.join(temp, 'global'));
    const globalMigrator = new LegacyConversationMigrator(globalStore);
    const parsed = candidates(global.legacyEntries);
    const report = await globalMigrator.importBatch(parsed.candidates, globalScope);
    assert.equal(report.currentScopeCount, 0);
    assert.equal(report.unassignedCount, 3);
    assert.equal(report.deduplicated.length, 2, 'exact duplicate plus same-content different-id deduplicate');
    assert.deepEqual(report.conflicts, ['conv-shared']);
    assert.equal((await globalStore.list(unassignedLegacyScope().scopeId)).length, 3);
    assert.deepEqual(parsed.issues.sort(), ['invalid-json', 'invalid-metadata', 'missing-record-data']);

    console.log('LegacyConversationMigrator.test.ts: all tests passed');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

run().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
