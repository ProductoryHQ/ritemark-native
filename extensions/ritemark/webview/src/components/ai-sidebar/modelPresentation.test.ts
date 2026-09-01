import assert from 'node:assert/strict';
import { modelDisplayName, parseModelDescription } from './modelPresentation';

assert.deepEqual(
  parseModelDescription('Sonnet 5 · Efficient for routine tasks'),
  { versionLine: 'Sonnet 5', tagline: 'Efficient for routine tasks' },
);
assert.equal(
  modelDisplayName(
    { id: 'sonnet', label: 'Sonnet', description: 'Sonnet 5 · Efficient for routine tasks' },
    true,
  ),
  'Sonnet 5',
  'the closed selector must use the same versioned name as its dropdown row',
);
assert.equal(
  modelDisplayName({ id: 'generic', label: 'Canonical label', description: 'Marketing phrase · More detail' }),
  'Canonical label',
  'non-Claude providers do not opt into the Claude SDK description convention',
);
assert.equal(
  modelDisplayName({ id: 'gpt-5.6-sol', label: 'GPT-5.6-Sol', description: 'Latest frontier model' }),
  'GPT-5.6-Sol',
  'non-Claude descriptions without a version line must not replace the canonical label',
);

console.log('modelPresentation.test.ts: consistent model naming passed');
