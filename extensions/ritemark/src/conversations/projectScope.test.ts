import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { projectScopeId, resolveProjectScope } from './projectScope';

interface ScopeFixture {
  id: string;
  equivalenceGroup?: string;
  platform: NodeJS.Platform;
  input: { workspaceFileUri: string | null; folderUris: string[] };
  expectedDescriptor: { kind: string; workspaceFileUri: string | null; folderUris: string[] };
  mustDifferFrom?: string[];
  automaticRelinkAllowed?: boolean;
}

function run(): void {
  const fixturePath = path.resolve(
    __dirname,
    '../../../../docs/development/releases/v1.10.0/sprint-109-durable-chat-history/research/fixtures/project-scopes.json',
  );
  const fixtures = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as { cases: ScopeFixture[] };
  const resolved = new Map<string, ReturnType<typeof resolveProjectScope>>();

  for (const fixture of fixtures.cases) {
    const result = resolveProjectScope({ ...fixture.input, platform: fixture.platform });
    resolved.set(fixture.id, result);
    assert.deepEqual(result.descriptor, fixture.expectedDescriptor, `${fixture.id}: descriptor is canonical`);
    assert.equal(result.scopeId, projectScopeId(result.descriptor), `${fixture.id}: id hashes the descriptor`);
    assert.match(result.scopeId, /^ps1-[0-9a-f]{40}$/);
  }

  for (const fixture of fixtures.cases) {
    if (fixture.equivalenceGroup) {
      const peers = fixtures.cases.filter((candidate) => candidate.equivalenceGroup === fixture.equivalenceGroup);
      for (const peer of peers) {
        assert.equal(resolved.get(fixture.id)?.scopeId, resolved.get(peer.id)?.scopeId, fixture.equivalenceGroup);
      }
    }
    for (const differentId of fixture.mustDifferFrom ?? []) {
      assert.notEqual(resolved.get(fixture.id)?.scopeId, resolved.get(differentId)?.scopeId, `${fixture.id} differs from ${differentId}`);
    }
  }

  assert.equal(resolved.get('moved-folder')?.scopeId === resolved.get('single-root')?.scopeId, false);
  assert.equal(fixtures.cases.find((item) => item.id === 'moved-folder')?.automaticRelinkAllowed, false);

  console.log('projectScope.test.ts: all tests passed');
}

run();
