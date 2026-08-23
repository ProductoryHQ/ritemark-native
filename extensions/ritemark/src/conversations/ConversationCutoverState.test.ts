import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConversationCutoverState } from './ConversationCutoverState';
import { ConversationStore } from './ConversationStore';
import { resolveProjectScope } from './projectScope';

async function run(): Promise<void> {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-cutover-'));
  const store = new ConversationStore(temp);
  const cutover = new ConversationCutoverState(store, { now: () => new Date('2026-08-22T15:00:00.000Z') });
  const scope = resolveProjectScope({ folderUris: ['file:///fixtures/cutover'], platform: 'darwin' });
  try {
    assert.equal(await cutover.resolve(true), 'legacy', 'flag-on alone does not claim authority before a host write');
    assert.equal(await cutover.resolve(false), 'legacy');

    await store.create({
      conversationId: '20000000-0000-4000-8000-000000000001',
      scopeId: scope.scopeId,
      scope: scope.descriptor,
      title: 'First host record',
    });
    assert.equal(await cutover.resolve(true), 'host-canonical', 'canonical records repair a missing marker');
    assert.equal(await cutover.resolve(false), 'host-compat', 'flag-off after cutover stays on host storage');
    assert.equal(JSON.parse(fs.readFileSync(path.join(temp, 'migration.json'), 'utf8')).authority, 'host');

    fs.writeFileSync(path.join(temp, 'migration.json'), '{ damaged marker');
    const repaired = new ConversationCutoverState(store, { now: () => new Date('2026-08-22T15:01:00.000Z') });
    assert.equal(await repaired.resolve(false), 'host-compat', 'host records prevent rollback after marker damage');

    console.log('ConversationCutoverState.test.ts: all tests passed');
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
