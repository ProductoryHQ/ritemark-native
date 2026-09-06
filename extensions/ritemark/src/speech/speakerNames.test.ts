import assert from 'node:assert/strict';
import { normalizeSpeakerLabel } from './speakerNames';

assert.equal(normalizeSpeakerLabel('Jarmo Tuisk'), 'Jarmo Tuisk');
assert.equal(normalizeSpeakerLabel('  Jarmo   Tuisk  '), 'Jarmo Tuisk');
assert.equal(normalizeSpeakerLabel('Õie-Kärt Žuravljov'), 'Õie-Kärt Žuravljov');
assert.equal(normalizeSpeakerLabel('Jarmo\nTuisk'), 'Jarmo Tuisk');
assert.equal(normalizeSpeakerLabel('   '), null);
assert.equal(normalizeSpeakerLabel(null), null);

console.log('speakerNames.test.ts: all tests passed');
