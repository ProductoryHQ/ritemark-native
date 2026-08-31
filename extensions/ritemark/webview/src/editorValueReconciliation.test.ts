import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldApplyIncomingEditorValue } from './editorValueReconciliation';

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
