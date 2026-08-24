import assert from 'node:assert/strict';
import { parseTranscriptWorkbenchRequest, WorkbenchProtocolError } from './workbenchProtocol';

assert.deepEqual(parseTranscriptWorkbenchRequest({
  type: 'workbench:generateInsights',
  language: 'et',
}), { type: 'workbench:generateInsights', language: 'et' });
assert.deepEqual(parseTranscriptWorkbenchRequest({
  type: 'workbench:renameSpeaker',
  speakerId: 'speaker_0',
  label: 'Jarmo Tuisk',
}), { type: 'workbench:renameSpeaker', speakerId: 'speaker_0', label: 'Jarmo Tuisk' });
assert.throws(
  () => parseTranscriptWorkbenchRequest({ type: 'workbench:generateInsights', language: 'Estonian' }),
  WorkbenchProtocolError,
);
assert.throws(
  () => parseTranscriptWorkbenchRequest({ type: 'workbench:generateInsights', language: 'et', prompt: 'inject' }),
  WorkbenchProtocolError,
);
assert.throws(() => parseTranscriptWorkbenchRequest({ type: 'workbench:save', overwrite: true }), WorkbenchProtocolError);

console.log('workbenchProtocol.test.ts: all tests passed');
