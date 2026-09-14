import assert from 'node:assert/strict';
import { modelOptionsWithPersistedSelection } from './modelConfig';

const available = [{ id: 'current', name: 'Current' }];
assert.deepEqual(modelOptionsWithPersistedSelection(available, 'current'), {
  models: available,
  unavailable: false,
});
assert.deepEqual(modelOptionsWithPersistedSelection(available, 'retired'), {
  models: [{ id: 'retired', name: 'Unavailable: retired' }, ...available],
  unavailable: true,
});
assert.deepEqual(modelOptionsWithPersistedSelection(available, undefined), {
  models: available,
  unavailable: false,
});

console.log('webview modelConfig.test.ts passed');
