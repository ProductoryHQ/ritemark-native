/**
 * Sprint 172 (R7, Codex on #941): the chat's file picker and its kind for a dropped file take a deck (`.rtms`), as
 * they take an older `.deck.md` by its `.md`. Without it a `.rtms` deck is hidden by the picker, and refused when the
 * system gives its file no type or a generic one.
 *
 * Run: npx tsx webview/src/components/ai-sidebar/chatAttachments.test.ts
 */
import assert from 'node:assert/strict';
import { CHAT_ATTACHMENT_EXTENSIONS, splitPickedFiles } from '../../../../src/views/chatAttachmentProtocol';
import { classifyFile, rebuildPickedFile } from './chatAttachments';

assert.ok(CHAT_ATTACHMENT_EXTENSIONS.includes('rtms'), 'the picker shows .rtms files');
assert.ok(CHAT_ATTACHMENT_EXTENSIONS.includes('md'));
for (const type of ['', 'application/octet-stream']) {
  assert.equal(classifyFile({ name: 'Day one.rtms', type }), 'text', `a .rtms deck with type "${type}" is text`);
  assert.equal(classifyFile({ name: 'DAY ONE.RTMS', type }), 'text', 'any case');
  assert.equal(classifyFile({ name: 'Training.deck.md', type }), 'text', 'an old deck, as before');
  assert.equal(classifyFile({ name: 'archive.zip', type }), null, 'what is not text stays out');
}
const originalBytes = Uint8Array.of(0, 128, 255);
const base64 = Buffer.from(originalBytes).toString('base64');
const fixtures = [
  ['Photo.PNG', 'image/png', 'image'],
  ['Photo.jpg', 'image/jpeg', 'image'],
  ['Photo.jpeg', 'image/jpeg', 'image'],
  ['Animation.gif', 'image/gif', 'image'],
  ['Photo.webp', 'image/webp', 'image'],
  ['Guide.pdf', 'application/pdf', 'pdf'],
  ['Notes.md', 'text/markdown', 'text'],
  ['Workshop.rtms', 'application/octet-stream', 'text'],
] as const;

async function main() {
  for (const [name, originalMimeType, kind] of fixtures) {
    const original = new File([originalBytes], name, { type: originalMimeType });
    const { inlineFiles: [{ mimeType }] } = splitPickedFiles([name]);
    const rebuilt = rebuildPickedFile({ name, mimeType, base64 });
    assert.equal(rebuilt.name, original.name);
    assert.equal(rebuilt.type, mimeType);
    assert.equal(classifyFile(original), kind);
    assert.equal(classifyFile(rebuilt), kind);
    assert.deepEqual(new Uint8Array(await rebuilt.arrayBuffer()), originalBytes);
  }
  console.log('chatAttachments: passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
