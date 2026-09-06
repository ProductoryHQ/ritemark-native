import assert from 'node:assert/strict';
import test from 'node:test';
import { DocumentProtocolError, parseDocumentHostMessage, parseDocumentViewMessage } from './protocol';

const identity = {
  uri: 'file:///tmp/example.md',
  documentSessionId: 'document-session',
  viewEpoch: 'view-epoch',
};
const sha = 'a'.repeat(64);

test('accepts an exact ready message', () => {
  assert.equal(parseDocumentViewMessage({ type: 'document:ready', ...identity }).type, 'document:ready');
});

test('rejects unknown fields and malformed hashes', () => {
  assert.throws(
    () => parseDocumentViewMessage({ type: 'document:ready', ...identity, extra: true }),
    DocumentProtocolError,
  );
  assert.throws(
    () => parseDocumentViewMessage({ type: 'document:applied', ...identity, revision: 1, payloadHash: 'weak' }),
    DocumentProtocolError,
  );
});

test('accepts an empty markdown edit body and structured properties', () => {
  const message = parseDocumentViewMessage({
    type: 'document:edit',
    ...identity,
    basedOnRevision: 2,
    clientSequence: 4,
    payload: { fileType: 'markdown', content: '', properties: { title: 'Draft' } },
  });
  assert.equal(message.type, 'document:edit');
});

test('retry apply does not pretend to resolve a conflict', () => {
  const message = parseDocumentViewMessage({
    type: 'document:conflict-action',
    ...identity,
    action: 'retry-apply',
  });
  assert.equal(message.action, 'retry-apply');
  assert.throws(() => parseDocumentViewMessage({
    type: 'document:conflict-action',
    ...identity,
    action: 'retry-apply',
    conflictRevision: 1,
    diskHash: sha,
  }), DocumentProtocolError);
});

test('validates host update payloads at runtime', () => {
  const message = parseDocumentHostMessage({
    type: 'document:update',
    ...identity,
    revision: 1,
    baseDiskHash: sha,
    modelHash: sha,
    payloadHash: sha,
    reason: 'open',
    attempt: 1,
    payload: {
      fileType: 'markdown',
      filename: 'example.md',
      content: '# Example',
      properties: {},
      hasProperties: false,
      imageMappings: {},
      features: { voiceDictation: false, markdownExport: true },
    },
  });
  assert.equal(message.type, 'document:update');
});

test('accepts exact CSV edit, applied receipt, and resolution messages', () => {
  assert.equal(parseDocumentViewMessage({
    type: 'document:edit',
    ...identity,
    basedOnRevision: 3,
    clientSequence: 5,
    payload: { fileType: 'csv', content: 'name,status\na,done' },
  }).type, 'document:edit');
  assert.equal(parseDocumentViewMessage({
    type: 'document:applied',
    ...identity,
    revision: 3,
    payloadHash: sha,
  }).type, 'document:applied');
  assert.equal(parseDocumentViewMessage({
    type: 'document:conflict-action',
    ...identity,
    conflictRevision: 2,
    diskHash: sha,
    action: 'keep-local',
  }).type, 'document:conflict-action');
});

test('validates every host message family', () => {
  assert.equal(parseDocumentHostMessage({
    type: 'document:sync-state',
    ...identity,
    state: 'conflict',
    revision: 4,
    acknowledgedRevision: 3,
    conflictRevision: 2,
    diskHash: sha,
  }).type, 'document:sync-state');
  assert.equal(parseDocumentHostMessage({
    type: 'document:edit-result',
    ...identity,
    clientSequence: 5,
    status: 'accepted',
    revision: 4,
    payloadHash: sha,
  }).type, 'document:edit-result');
  assert.equal(parseDocumentHostMessage({
    type: 'document:conflict',
    ...identity,
    conflictRevision: 2,
    revision: 4,
    diskHash: sha,
    filename: 'example.md',
  }).type, 'document:conflict');
});

test('rejects malformed optional feature fields instead of silently dropping them', () => {
  assert.throws(() => parseDocumentHostMessage({
    type: 'document:update',
    ...identity,
    revision: 1,
    baseDiskHash: sha,
    modelHash: sha,
    payloadHash: sha,
    reason: 'open',
    attempt: 1,
    payload: {
      fileType: 'markdown',
      filename: 'example.md',
      content: '# Example',
      properties: {},
      hasProperties: false,
      imageMappings: {},
      features: { voiceDictation: false, markdownExport: true, commentCallouts: 'yes' },
    },
  }), DocumentProtocolError);
});
