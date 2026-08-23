import assert from 'node:assert/strict';
import {
  fallbackTitleFromPrompt,
  normalizeGeneratedTitle,
  normalizeManualTitle,
} from './ConversationTitlePolicy';

assert.equal(fallbackTitleFromPrompt('  Build   durable chat history. Then document it.'), 'Build durable chat history.');
assert.equal(fallbackTitleFromPrompt(''), 'New conversation');
assert.ok(fallbackTitleFromPrompt('A '.repeat(100)).length <= 80);

assert.equal(normalizeGeneratedTitle('"Durable project chat history."'), 'Durable project chat history');
assert.equal(normalizeGeneratedTitle('Title: Vestluste ajaloo parandamine nüüd'), 'Vestluste ajaloo parandamine nüüd');
assert.equal(normalizeGeneratedTitle('one two'), null);
assert.equal(normalizeGeneratedTitle('one two three four five six seven eight'), 'one two three four five six');
assert.equal(normalizeGeneratedTitle('one two three\nextra'), null);

assert.equal(normalizeManualTitle('  My   own title  '), 'My own title');
assert.equal(normalizeManualTitle('   '), null);

console.log('ConversationTitlePolicy.test.ts: all tests passed');
