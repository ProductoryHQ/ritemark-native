// Guards on the workflow files (R4, S22): the publisher never runs on
// pull-request code, the test workflow never sees a secret, actions are pinned.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { REPO_ROOT } from './test-helpers.mjs';

const read = (name) => readFileSync(join(REPO_ROOT, '.github', 'workflows', name), 'utf8');
const publishWorkflow = read('model-catalog-autopublish.yml');
const testWorkflow = read('model-catalog-tests.yml');

function triggers(yaml) {
  const block = /^on:\n((?:[ \t]+.*\n|\n)*)/m.exec(yaml)?.[1] ?? '';
  return [...block.matchAll(/^  ([a-z_]+):/gm)].map((match) => match[1]);
}

test('the publisher runs only on schedule and dispatch (S22)', () => {
  assert.deepEqual(triggers(publishWorkflow).sort(), ['schedule', 'workflow_dispatch']);
  assert.match(publishWorkflow, /cron: '\*\/10 \* \* \* \*'/);
});

test('overlapping publisher runs queue instead of racing (S23)', () => {
  assert.match(publishWorkflow, /concurrency:\n\s+group: model-catalog-autopublish\n\s+cancel-in-progress: false/);
});

test('the publisher is switched by the repository variable (S20)', () => {
  assert.match(publishWorkflow, /vars\.MODEL_CATALOG_AUTOPUBLISH == 'on'/);
});

test('the secret reaches only the publish step', () => {
  assert.equal(publishWorkflow.match(/secrets\.MODEL_CATALOG_ANTHROPIC_API_KEY/g)?.length, 1);
  assert.doesNotMatch(testWorkflow, /secrets\./);
});

test('least privilege: read by default, write only for the publishing job', () => {
  assert.match(publishWorkflow, /^permissions:\n  contents: read$/m);
  assert.match(publishWorkflow, /^    permissions:\n      contents: write$/m);
  assert.match(testWorkflow, /^permissions:\n  contents: read$/m);
  assert.doesNotMatch(testWorkflow, /contents: write/);
});

test('every action is pinned to a full commit SHA', () => {
  for (const yaml of [publishWorkflow, testWorkflow]) {
    for (const [, ref] of yaml.matchAll(/uses: ([^\s#]+)/g)) {
      assert.match(ref, /@[0-9a-f]{40}$/, ref);
    }
  }
});

test('checkouts do not leave the token in the git config', () => {
  for (const yaml of [publishWorkflow, testWorkflow]) {
    const checkouts = yaml.match(/uses: actions\/checkout@/g)?.length ?? 0;
    assert.equal(yaml.match(/persist-credentials: false/g)?.length ?? 0, checkouts);
  }
});
