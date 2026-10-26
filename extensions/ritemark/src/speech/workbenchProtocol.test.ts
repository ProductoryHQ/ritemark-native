import assert from 'node:assert/strict';
import { parseTranscriptWorkbenchRequest, WorkbenchProtocolError, workbenchOpensBehind } from './workbenchProtocol';

assert.deepEqual(parseTranscriptWorkbenchRequest({
  type: 'workbench:generateInsights',
  language: { kind: 'known', code: 'et' },
}), { type: 'workbench:generateInsights', language: { kind: 'known', code: 'et' } });
assert.deepEqual(parseTranscriptWorkbenchRequest({
  type: 'workbench:generateInsights',
  language: { kind: 'custom', name: 'Klingon' },
}), { type: 'workbench:generateInsights', language: { kind: 'custom', name: 'Klingon' } });
assert.deepEqual(parseTranscriptWorkbenchRequest({
  type: 'workbench:renameSpeaker',
  speakerId: 'speaker_0',
  label: 'Jarmo Tuisk',
}), { type: 'workbench:renameSpeaker', speakerId: 'speaker_0', label: 'Jarmo Tuisk' });
assert.throws(
  () => parseTranscriptWorkbenchRequest({ type: 'workbench:generateInsights', language: { kind: 'custom', name: ' bad ' } }),
  WorkbenchProtocolError,
);
assert.throws(
  () => parseTranscriptWorkbenchRequest({ type: 'workbench:generateInsights', language: { kind: 'known', code: 'et' }, prompt: 'inject' }),
  WorkbenchProtocolError,
);
assert.throws(
  () => parseTranscriptWorkbenchRequest({ type: 'workbench:generateInsights', language: 'et' }),
  WorkbenchProtocolError,
);
assert.throws(() => parseTranscriptWorkbenchRequest({ type: 'workbench:save', overwrite: true }), WorkbenchProtocolError);
assert.deepEqual(parseTranscriptWorkbenchRequest({ type: 'workbench:renameRecording' }), { type: 'workbench:renameRecording' });
assert.throws(() => parseTranscriptWorkbenchRequest({ type: 'workbench:renameRecording', name: 'x' }), WorkbenchProtocolError, 'the host asks for the name itself');

// Sprint 142 (R13, #517): a started transcription's tab never takes the keyboard from a document being typed in
assert.equal(workbenchOpensBehind({ kind: 'custom', viewType: 'ritemark.editor' }, true), true, 'behind a Ritemark document');
assert.equal(workbenchOpensBehind({ kind: 'text' }, true), true, 'behind a text editor');
assert.equal(workbenchOpensBehind({ kind: 'custom', viewType: 'ritemark.transcriptWorkbench' }, true), false, 'in front of another recording');
assert.equal(workbenchOpensBehind({ kind: 'other' }, true), false, 'in front of Home or the board');
assert.equal(workbenchOpensBehind({ kind: 'custom', viewType: 'ritemark.editor' }, false), false, 'a window in the background: in front');
assert.equal(workbenchOpensBehind(null, true), false, 'an empty desk');

console.log('workbenchProtocol.test.ts: all tests passed');
