/**
 * Sprint 134 (R13, W10): Flows' storage creates nothing when it lists, and a
 * save never brings back a project folder that has gone.
 * Run: npx tsx src/flows/FlowStorage.test.ts
 */

import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { isProjectFolderError } from '../projects/projectFolderGuard';
import { FlowStorage } from './FlowStorage';

function tempProject(): { parent: string; root: string } {
  const parent = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'rm-flow-storage-')));
  const root = path.join(parent, 'Notes');
  fs.mkdirSync(root);
  return { parent, root };
}

const flowsDir = (root: string) => path.join(root, '.ritemark', 'flows');

async function main(): Promise<void> {
  // ── Listing a project with no flows creates nothing ───────────────────────
  {
    const { root } = tempProject();
    const storage = new FlowStorage(root);
    assert.deepEqual(await storage.listFlows(), []);
    assert.deepEqual(await storage.listFlows(), [], 'a second tick, as the scheduler runs every 30 s');
    assert.equal(fs.existsSync(path.join(root, '.ritemark')), false, 'no empty .ritemark/flows from opening a project');
    assert.deepEqual(fs.readdirSync(root), []);
  }

  // ── A project that exists behaves as today: a save makes the folder ───────
  {
    const { root } = tempProject();
    const storage = new FlowStorage(root);
    const flow = storage.createNewFlow('Weekly digest');
    await storage.saveFlow(flow);
    assert.ok(fs.existsSync(storage.getFlowPath(flow.id)), 'the flow file is written');
    assert.equal(path.dirname(storage.getFlowPath(flow.id)), flowsDir(root));
    const listed = await storage.listFlows();
    assert.deepEqual(listed.map((item) => item.id), [flow.id], 'and listed');
    assert.equal(JSON.parse(fs.readFileSync(storage.getFlowPath(flow.id), 'utf8')).name, 'Weekly digest');

    const second = storage.createNewFlow('Another');
    await storage.saveFlow(second);
    assert.equal((await storage.listFlows()).length, 2, 'a save into the existing folder');
  }

  // ── The project's folder deleted while open: listing brings nothing back ──
  {
    const { parent, root } = tempProject();
    const storage = new FlowStorage(root);
    await storage.saveFlow(storage.createNewFlow('Before'));
    fs.rmSync(root, { recursive: true });

    assert.deepEqual(await storage.listFlows(), [], 'a gone folder lists no flows');
    assert.deepEqual(await storage.listFlows(), []);
    assert.equal(fs.existsSync(root), false, 'the deleted project folder stays deleted');
    assert.deepEqual(fs.readdirSync(parent), []);
  }

  // ── A save after the project's folder is deleted fails and makes nothing ──
  {
    const { parent, root } = tempProject();
    const storage = new FlowStorage(root);
    fs.rmSync(root, { recursive: true });

    await assert.rejects(
      () => storage.saveFlow(storage.createNewFlow('After')),
      (error: unknown) => isProjectFolderError(error) && error.code === 'missing' && /is not where it was/.test(error.message),
    );
    assert.equal(fs.existsSync(root), false, 'the save does not bring the folder back');
    assert.deepEqual(fs.readdirSync(parent), []);
  }

  // ── Something else with the project's name: refused, left as it is ────────
  {
    const { parent, root } = tempProject();
    const storage = new FlowStorage(root);
    fs.rmSync(root, { recursive: true });
    fs.writeFileSync(root, 'a file now');

    assert.deepEqual(await storage.listFlows(), []);
    await assert.rejects(
      () => storage.saveFlow(storage.createNewFlow('After')),
      (error: unknown) => isProjectFolderError(error) && error.code === 'not-a-folder',
    );
    assert.equal(fs.readFileSync(root, 'utf8'), 'a file now');
    assert.deepEqual(fs.readdirSync(parent), ['Notes']);
  }

  console.log('flows/FlowStorage: all assertions passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
