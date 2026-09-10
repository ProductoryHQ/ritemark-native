import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canonicalMarkdownProjection,
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

// Shared with src/editorSync/state.test.ts — keep both tables identical.
const canonicalProjectionVectors: Array<[string, string, string]> = [
  ['alpha\n', 'alpha', 'trailing newline added by ensureTrailingNewline'],
  ['alpha\n\n\n', 'alpha', 'several trailing newlines'],
  ['\nalpha', 'alpha', 'leading newline left by gray-matter behind front matter'],
  ['\n\n# Title\n\nbody\n', '# Title\n\nbody', 'both ends trimmed, inner blank line kept'],
  ['alpha\r\nbeta\r\n', 'alpha\nbeta', 'CRLF document compares as LF'],
  ['\uFEFFalpha\n', 'alpha', 'UTF-8 BOM'],
  ['', '', 'empty document'],
  ['\n', '', 'newline-only document'],
  ['  indented', '  indented', 'leading spaces are content'],
  ['alpha  \n', 'alpha  ', 'trailing spaces before the newline are content'],
  ['- [ ]', '- [ ]', 'a bare task marker is content'],
];

test('canonicalMarkdownProjection matches the host definition vector for vector', () => {
  for (const [input, expected, why] of canonicalProjectionVectors) {
    assert.equal(canonicalMarkdownProjection(input), expected, why);
  }
});

test("the host's echo of an accepted edit differs only by the persisted trailing newline and is not applied", () => {
  assert.equal(shouldApplyIncomingEditorValue({
    initialMount: false,
    incomingValue: '# Title\n\n- alpha\n',
    currentMarkdown: '# Title\n\n- alpha',
    lastOnChangeValue: '# Title\n\n- alpha',
    imageMappingsChanged: false,
  }), false);
});

test('a front-matter body with a leading newline is not applied either', () => {
  assert.equal(shouldApplyIncomingEditorValue({
    initialMount: false,
    incomingValue: '\n# Title\n\n- alpha\n',
    currentMarkdown: '# Title\n\n- alpha',
    lastOnChangeValue: '# Title\n\n- alpha',
    imageMappingsChanged: false,
  }), false);
});

test('a CRLF host value that equals the LF projection is not applied', () => {
  assert.equal(shouldApplyIncomingEditorValue({
    initialMount: false,
    incomingValue: '# Title\r\n\r\n- alpha\r\n',
    currentMarkdown: '# Title\n\n- alpha',
    lastOnChangeValue: '# Title\n\n- alpha',
    imageMappingsChanged: false,
  }), false);
});

test('a genuinely different host value is still applied', () => {
  assert.equal(shouldApplyIncomingEditorValue({
    initialMount: false,
    incomingValue: '# Title\n\n- alpha\n- beta\n',
    currentMarkdown: '# Title\n\n- alpha',
    lastOnChangeValue: '# Title\n\n- alpha',
    imageMappingsChanged: false,
  }), true);
});
