import assert from 'node:assert/strict'
import test from 'node:test'
import type { DocumentHostMessage } from '../../src/editorSync/protocol'
import {
  initialDocumentViewSyncState,
  reduceDocumentViewSync,
  selectDocumentSyncAction,
} from './documentSyncReducer'

const identity = {
  uri: 'file:///tmp/example.md',
  documentSessionId: 'session',
  viewEpoch: 'epoch',
}
const sha = 'a'.repeat(64)

test('stale host state cannot replace a newer visible revision', () => {
  const current = { ...initialDocumentViewSyncState, revision: 4, state: 'synced' as const }
  const stale: DocumentHostMessage = {
    type: 'document:sync-state',
    ...identity,
    revision: 3,
    acknowledgedRevision: 3,
    state: 'apply-error',
  }
  assert.equal(reduceDocumentViewSync(current, stale), current)
})

test('healthy and local-only states never expose a header action', () => {
  assert.equal(selectDocumentSyncAction(initialDocumentViewSyncState), undefined)
  assert.equal(selectDocumentSyncAction({ revision: 2, state: 'local-only' }), undefined)
  assert.equal(selectDocumentSyncAction({ revision: 2, state: 'applying' }), undefined)
})

test('only conflict and exhausted application states expose an action', () => {
  assert.equal(selectDocumentSyncAction({ revision: 2, state: 'conflict' }), 'conflict')
  assert.equal(selectDocumentSyncAction({ revision: 2, state: 'apply-error' }), 'retry')
  assert.equal(selectDocumentSyncAction({ revision: 2, state: 'failed' }), 'retry')
})

test('a stale optimistic edit becomes a visible recovery state instead of a silent replay', () => {
  const stale: DocumentHostMessage = {
    type: 'document:edit-result',
    ...identity,
    clientSequence: 3,
    status: 'stale',
    revision: 4,
    message: 'The document advanced before this edit arrived.',
  }
  const next = reduceDocumentViewSync(initialDocumentViewSyncState, stale)
  assert.equal(next.state, 'failed')
  assert.equal(selectDocumentSyncAction(next), 'retry')
})

test('a successful state clears conflict evidence only after host resolution', () => {
  const conflict: DocumentHostMessage = {
    type: 'document:conflict',
    ...identity,
    revision: 5,
    conflictRevision: 2,
    diskHash: sha,
    filename: 'example.md',
  }
  const conflicted = reduceDocumentViewSync(initialDocumentViewSyncState, conflict)
  assert.equal(conflicted.conflict?.diskHash, sha)

  const synced: DocumentHostMessage = {
    type: 'document:sync-state',
    ...identity,
    revision: 6,
    acknowledgedRevision: 6,
    state: 'synced',
  }
  assert.equal(reduceDocumentViewSync(conflicted, synced).conflict, undefined)
})

test('a held import keeps its reason for the review\'s words (Sprint 145 R1, #588)', () => {
  const held: DocumentHostMessage = {
    type: 'document:conflict',
    ...identity,
    revision: 5,
    conflictRevision: 3,
    diskHash: sha,
    filename: 'Module 3.md',
    reason: 'held-import',
  }
  const conflicted = reduceDocumentViewSync(initialDocumentViewSyncState, held)
  assert.equal(conflicted.conflict?.reason, 'held-import')
  const applying: DocumentHostMessage = {
    type: 'document:sync-state',
    ...identity,
    revision: 5,
    acknowledgedRevision: 4,
    state: 'conflict',
    conflictRevision: 3,
    diskHash: sha,
  }
  assert.equal(reduceDocumentViewSync(conflicted, applying).conflict?.reason, 'held-import')
  const usual = reduceDocumentViewSync(initialDocumentViewSyncState, { ...held, reason: undefined, conflictRevision: 4 })
  assert.equal(usual.conflict?.reason, undefined)
})

test('an applying retry keeps current conflict evidence when the host still names it', () => {
  const conflict: DocumentHostMessage = {
    type: 'document:conflict',
    ...identity,
    revision: 5,
    conflictRevision: 2,
    diskHash: sha,
    filename: 'example.md',
  }
  const conflicted = reduceDocumentViewSync(initialDocumentViewSyncState, conflict)
  const applying: DocumentHostMessage = {
    type: 'document:sync-state',
    ...identity,
    revision: 5,
    acknowledgedRevision: 4,
    state: 'applying',
    conflictRevision: 2,
    diskHash: sha,
  }
  assert.equal(reduceDocumentViewSync(conflicted, applying).conflict?.filename, 'example.md')
})

// Sprint 145 R1 (revised 1 November, #588): Review changes for the places both the person and a writer changed.
test('paragraphs to review show Review changes, survive state changes, and clear when answered', () => {
  const paragraphs: DocumentHostMessage = {
    type: 'document:paragraphs', ...identity, revision: 3, items: [{ id: 1, mine: 'Mine.', theirs: 'Theirs.' }], writer: 'Claude',
  }
  const withParagraphs = reduceDocumentViewSync({ revision: 2, state: 'local-only' }, paragraphs)
  assert.deepEqual(withParagraphs.paragraphs, { items: [{ id: 1, mine: 'Mine.', theirs: 'Theirs.' }], writer: 'Claude' })
  assert.equal(selectDocumentSyncAction(withParagraphs), 'paragraphs')

  const synced = reduceDocumentViewSync(withParagraphs, { type: 'document:sync-state', ...identity, revision: 4, acknowledgedRevision: 4, state: 'synced' })
  assert.equal(selectDocumentSyncAction(synced), 'paragraphs', 'a save does not answer them')

  const conflict = reduceDocumentViewSync(synced, { type: 'document:conflict', ...identity, revision: 5, conflictRevision: 1, diskHash: sha, filename: 'example.md' })
  assert.equal(selectDocumentSyncAction(conflict), 'conflict', 'the whole-document question comes first')
  assert.ok(conflict.paragraphs)

  const answered = reduceDocumentViewSync(synced, { type: 'document:paragraphs', ...identity, revision: 6, items: [] })
  assert.equal(answered.paragraphs, undefined)
  assert.equal(selectDocumentSyncAction(answered), undefined)
})
