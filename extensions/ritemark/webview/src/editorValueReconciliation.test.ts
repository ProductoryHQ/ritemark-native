import assert from 'node:assert/strict';
import test from 'node:test';
import {
  shouldApplyIncomingEditorValue,
  shouldPublishEditorChange,
} from './editorValueReconciliation';

test('canonical no-op editor transactions are never published', () => {
  assert.equal(shouldPublishEditorChange({
    nextMarkdown: '- [ ] Alpha\n- [x] Beta',
    canonicalBaseline: '- [ ] Alpha\n- [x] Beta',
  }), false);
});

test('a real task-state change is published', () => {
  assert.equal(shouldPublishEditorChange({
    nextMarkdown: '- [x] Alpha\n- [x] Beta',
    canonicalBaseline: '- [ ] Alpha\n- [x] Beta',
  }), true);
});

test("an empty heading projection is not replaced by the editor's own empty value", () => {
  assert.equal(shouldApplyIncomingEditorValue({
    initialMount: false,
    incomingValue: '',
    currentMarkdown: '',
    lastOnChangeValue: '',
    imageMappingsChanged: false,
  }), false);
});

test('initial and genuinely external values still apply', () => {
  assert.equal(shouldApplyIncomingEditorValue({
    initialMount: true,
    incomingValue: '',
    currentMarkdown: '',
    lastOnChangeValue: '',
    imageMappingsChanged: false,
  }), true);
  assert.equal(shouldApplyIncomingEditorValue({
    initialMount: false,
    incomingValue: '',
    currentMarkdown: 'local text',
    lastOnChangeValue: 'local text',
    imageMappingsChanged: false,
  }), true);
});

test('image mapping refresh remains an independent apply reason', () => {
  assert.equal(shouldApplyIncomingEditorValue({
    initialMount: false,
    incomingValue: 'same',
    currentMarkdown: 'same',
    lastOnChangeValue: 'same',
    imageMappingsChanged: true,
  }), true);
});
