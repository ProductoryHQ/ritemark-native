/**
 * The document's bar before Share (Sprint 134, R12; `comparison/after-write.png`):
 * Saved for `synced`, nothing while an edit is written, today's save-problem
 * actions in Saved's place.
 *
 * Run: npx tsx webview/src/components/header/DocumentSyncAction.test.ts
 */
import assert from 'node:assert/strict';
import type { DocumentSyncState } from '../../../../src/editorSync/protocol';
import {
  initialDocumentViewSyncState,
  reduceDocumentViewSync,
  selectDocumentSyncAction,
  type DocumentViewSyncState,
} from '../../documentSyncReducer';
import { documentBarStatus, type DocumentSyncAction } from './DocumentSyncAction';

/** App.tsx's mapping from the reducer's selection to the bar's action. */
function actionFor(view: DocumentViewSyncState): DocumentSyncAction | undefined {
  const selected = selectDocumentSyncAction(view);
  if (selected === 'conflict') return { kind: 'conflict', label: 'Review changes', onClick: () => {} };
  if (selected === 'retry') return { kind: 'retry', label: 'Retry document update', onClick: () => {} };
  return undefined;
}
const statusFor = (state: DocumentSyncState) => {
  const view: DocumentViewSyncState = { revision: 1, state };
  return documentBarStatus(view.state, actionFor(view));
};

const expected: Record<DocumentSyncState, ReturnType<typeof documentBarStatus>> = {
  synced: 'saved',
  'local-only': 'none',
  applying: 'none',
  conflict: 'action',
  'apply-error': 'action',
  failed: 'action',
};

// Every state the host sends (the Record's type makes the list complete).
for (const state of Object.keys(expected) as DocumentSyncState[]) assert.equal(statusFor(state), expected[state], state);

// The actions keep today's kinds: Review changes for a conflict, Retry for a failed write.
assert.equal(actionFor({ revision: 1, state: 'conflict' })?.kind, 'conflict');
assert.equal(actionFor({ revision: 1, state: 'apply-error' })?.kind, 'retry');
assert.equal(actionFor({ revision: 1, state: 'failed' })?.kind, 'retry');

// A conflict the person has not resolved keeps its action even when the host says synced.
const stillInConflict: DocumentViewSyncState = {
  revision: 2,
  state: 'synced',
  conflict: { conflictRevision: 2, diskHash: 'h', filename: 'Brief.md' },
};
assert.equal(documentBarStatus(stillInConflict.state, actionFor(stillInConflict)), 'action');

// A document opens Saved (the reducer starts synced), goes quiet while an edit is written, and says Saved again.
let view = initialDocumentViewSyncState;
assert.equal(documentBarStatus(view.state, actionFor(view)), 'saved');
const syncState = (revision: number, state: DocumentSyncState) => ({
  type: 'document:sync-state' as const,
  uri: 'file:///Brief.md',
  documentSessionId: 's',
  viewEpoch: 'e',
  revision,
  acknowledgedRevision: revision,
  state,
});
view = reduceDocumentViewSync(view, syncState(1, 'local-only'));
assert.equal(documentBarStatus(view.state, actionFor(view)), 'none');
view = reduceDocumentViewSync(view, syncState(2, 'synced'));
assert.equal(documentBarStatus(view.state, actionFor(view)), 'saved');
view = reduceDocumentViewSync(view, syncState(3, 'failed'));
assert.equal(documentBarStatus(view.state, actionFor(view)), 'action');

// Before App passes the state, the bar shows nothing rather than a Saved it cannot vouch for.
assert.equal(documentBarStatus(undefined, undefined), 'none');

console.log('webview/DocumentSyncAction: all assertions passed');
