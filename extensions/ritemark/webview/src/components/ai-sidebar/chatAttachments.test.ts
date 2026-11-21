/**
 * Sprint 172 (R7, Codex on #941): the chat's file picker and its kind for a dropped file take a deck (`.rtms`), as
 * they take an older `.deck.md` by its `.md`. Without it a `.rtms` deck is hidden by the picker, and refused when the
 * system gives its file no type or a generic one.
 *
 * Run: npx tsx webview/src/components/ai-sidebar/chatAttachments.test.ts
 */
import assert from 'node:assert/strict';
import { classifyFile, TEXT_EXTENSIONS } from './ChatInput';

assert.ok(TEXT_EXTENSIONS.split(',').includes('.rtms'), 'the picker shows .rtms files');
assert.ok(TEXT_EXTENSIONS.split(',').includes('.md'));
for (const type of ['', 'application/octet-stream']) {
  assert.equal(classifyFile({ name: 'Day one.rtms', type }), 'text', `a .rtms deck with type "${type}" is text`);
  assert.equal(classifyFile({ name: 'DAY ONE.RTMS', type }), 'text', 'any case');
  assert.equal(classifyFile({ name: 'Training.deck.md', type }), 'text', 'an old deck, as before');
  assert.equal(classifyFile({ name: 'archive.zip', type }), null, 'what is not text stays out');
}
console.log('chatAttachments: passed');
