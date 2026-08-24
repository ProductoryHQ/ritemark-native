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
